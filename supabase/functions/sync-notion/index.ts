import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminAuth.ts";
import {
  getRagEmbeddingProfile,
  isRagEmbeddingProfileId,
  LEGACY_OPENAI_PROFILE_ID,
  LEGACY_VOYAGE_PROFILE_ID,
  type RagEmbeddingProfile,
  type RagEmbeddingProfileId,
} from "../_shared/ragProfiles.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const OPENAI_API_URL = "https://api.openai.com/v1";
const VOYAGE_API_URL = "https://api.voyageai.com/v1";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

interface SyncRequest {
  databases?: { characters?: string; videos?: string };
  /** When true, delete ALL embeddings before re-inserting. */
  wipe_all?: boolean;
  /** Optional: only sync this single character by Notion page ID. */
  only_notion_id?: string;
  /**
   * Character sync scope:
   * - "full" (default) : prompts fields + RAG embeddings + situation_summary
   * - "fields_only"    : only character_prompts fields + situation_summary (NO embeddings touched)
   * - "rag_only"       : only re-embed page content (NO character_prompts touched)
   */
  mode?: "full" | "fields_only" | "rag_only";
  /** Build embeddings in this versioned profile. Defaults to the active profile. */
  rag_profile?: RagEmbeddingProfileId;
  /** Atomically activate rag_profile after every requested character was indexed successfully. */
  activate_profile?: boolean;
  /** Activate an already-built non-empty profile without rebuilding it (admin rollback/canary switch). */
  activate_existing_profile?: boolean;
}

// --- Notion property extractors ---
function extractRichText(prop: any): string {
  if (!prop?.rich_text) return '';
  return prop.rich_text.map((t: any) => t.plain_text).join('');
}
function extractTitle(prop: any): string {
  if (!prop?.title) return '';
  return prop.title.map((t: any) => t.plain_text).join('');
}
function extractSelect(prop: any): string | null {
  return prop?.select?.name || null;
}
function extractStatus(prop: any): string | null {
  return prop?.status?.name || extractSelect(prop);
}
function extractMultiSelect(prop: any): string[] {
  if (!prop?.multi_select) return [];
  return prop.multi_select.map((o: any) => o.name).filter(Boolean);
}
function extractNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}
function extractUrl(prop: any): string | null {
  return prop?.url || null;
}

// ---- Property name mapping (Notion → DB column) ----
const PROMPT_FIELD_ALIASES: Record<string, string[]> = {
  identite_fondamentale: ["Identité fondamentale", "Identite fondamentale"],
  qui_tu_es: ["Qui tu es"],
  ce_que_tu_ne_fais_jamais: ["Ce que tu ne fais jamais"],
  ce_que_tu_sais_utilisateur: [
    "Qui t'appelle",
    "Qui t’appelle",
    "Qui t appelle",
    "Ce que tu sais de l'utilisateur",
    "Ce que tu sais de l’utilisateur",
    "Ce que tu sais de l utilisateur",
  ],
  dynamique_conversation: ["Dynamique de la conversation"],
  sujets_sensibles: ["Sujets sensibles"],
  profondeur_par_niveau: [
    "Références intellectuelles",
    "References intellectuelles",
    "Profondeur par niveau",
    "Profondeur par niveaux",
  ],
  timeline: ["Timeline", "Chronologie", "Historique"],
};

interface MappingWarning {
  field: string;
  expected_notion_property: string;
  accepted_aliases: string[];
  reason: "property_missing" | "property_empty";
  message: string;
}

function extractPromptFields(
  props: Record<string, any>,
  characterName: string,
): { fields: Record<string, string>; warnings: MappingWarning[] } {
  const out: Record<string, string> = {};
  const warnings: MappingWarning[] = [];
  for (const [col, aliases] of Object.entries(PROMPT_FIELD_ALIASES)) {
    let value = "";
    let matchedAlias: string | null = null;
    let aliasPresent = false;
    for (const alias of aliases) {
      if (alias in props) {
        aliasPresent = true;
        value = extractRichText(props[alias]).trim();
        if (value) { matchedAlias = alias; break; }
      }
    }
    out[col] = value;
    if (!value) {
      const reason = aliasPresent ? "property_empty" : "property_missing";
      const expected = aliases[0];
      const message = aliasPresent
        ? `« ${expected} » existe dans Notion mais est vide pour ${characterName} : remplis le champ puis relance la sync.`
        : `Aucune propriété Notion ne correspond à « ${expected} » pour ${characterName} : renomme la propriété dans « Base Caractères AVA » (alias acceptés : ${aliases.join(" / ")}) ou fais évoluer le mapping.`;
      warnings.push({ field: col, expected_notion_property: expected, accepted_aliases: aliases, reason, message });
      console.warn(`[sync-notion][mapping] ${characterName} · ${col} · ${reason} · ${message}`);
    } else if (matchedAlias && matchedAlias !== aliases[0]) {
      console.log(`[sync-notion][mapping] ${characterName} · ${col} mappé via alias de secours « ${matchedAlias} »`);
    }
  }
  return { fields: out, warnings };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Require an authenticated admin caller — this endpoint uses service role
  // to rewrite characters, video_triggers, and embeddings.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  try {
    const body: SyncRequest = await req.json().catch(() => ({}));
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const mode: "full" | "fields_only" | "rag_only" = body.mode || "full";
    const doFields = mode === "full" || mode === "fields_only";
    const doRag = mode === "full" || mode === "rag_only";
    const charactersDbId = body.databases?.characters;
    const videosDbId = body.databases?.videos;
    const { data: activeIndexState, error: activeIndexError } = await supabase
      .from("rag_index_state")
      .select("active_profile")
      .eq("id", true)
      .maybeSingle();
    if (activeIndexError) {
      console.warn("[sync-notion] rag_index_state unavailable, using legacy profile:", activeIndexError.message);
      if ((charactersDbId && doRag) || body.activate_existing_profile) {
        throw new Error("RAG profile migration is required before synchronizing embeddings (20260805120000_rag_embedding_profiles.sql)");
      }
    }
    if (body.rag_profile && !isRagEmbeddingProfileId(body.rag_profile)) {
      throw new Error(`Unknown RAG embedding profile: ${body.rag_profile}`);
    }
    const fallbackProfileId = VOYAGE_API_KEY ? LEGACY_VOYAGE_PROFILE_ID : LEGACY_OPENAI_PROFILE_ID;
    const targetProfile = getRagEmbeddingProfile(body.rag_profile || activeIndexState?.active_profile, fallbackProfileId);

    if (body.activate_existing_profile) {
      const [{ count: existingCount, error: countError }, { data: latestEmbedding }] = await Promise.all([
        supabase
          .from('embeddings')
          .select('id', { count: 'exact', head: true })
          .eq('embedding_profile', targetProfile.id),
        supabase
          .from('embeddings')
          .select('indexed_at')
          .eq('embedding_profile', targetProfile.id)
          .order('indexed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (countError) throw new Error(`Unable to inspect ${targetProfile.id}: ${countError.message}`);
      if (!existingCount) throw new Error(`Profile ${targetProfile.id} has no embeddings and cannot be activated`);
      const { error: activationError } = await supabase.from('rag_index_state').upsert({
        id: true,
        active_profile: targetProfile.id,
        previous_profile: activeIndexState?.active_profile && activeIndexState.active_profile !== targetProfile.id
          ? activeIndexState.active_profile
          : null,
        provider: targetProfile.provider,
        document_model: targetProfile.documentModel,
        query_model: targetProfile.queryModel,
        endpoint: targetProfile.endpoint,
        dimension: targetProfile.dimension,
        dtype: targetProfile.dtype,
        chunking_strategy: targetProfile.chunkingStrategy,
        chunk_size_chars: targetProfile.chunkSizeChars,
        chunk_overlap_chars: targetProfile.chunkOverlapChars,
        total_chunks: existingCount,
        status: 'active',
        last_rebuild_at: latestEmbedding?.indexed_at || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (activationError) throw new Error(`RAG profile activation failed: ${activationError.message}`);
      return new Response(JSON.stringify({
        success: true,
        rag_profile: targetProfile.id,
        activated_profile: targetProfile.id,
        profile_embeddings_in_db: existingCount,
        characters_synced: 0,
        activation_only: true,
        latency_ms: Date.now() - startedAt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!charactersDbId && !videosDbId) {
      return new Response(JSON.stringify({ error: "databases.characters or databases.videos is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!NOTION_API_KEY) throw new Error('NOTION_API_KEY is not configured');
    if (charactersDbId && targetProfile.provider === "voyage" && !VOYAGE_API_KEY) {
      throw new Error(`VOYAGE_API_KEY is required to build ${targetProfile.id}`);
    }
    if (charactersDbId && targetProfile.provider === "openai" && !OPENAI_API_KEY) {
      throw new Error(`OPENAI_API_KEY is required to build ${targetProfile.id}`);
    }
    if (body.activate_profile && body.only_notion_id) {
      throw new Error("A RAG profile can only be activated after a complete corpus rebuild");
    }

    // ---- Notion helpers ----
    async function fetchNotionDatabase(databaseId: string, filter?: Record<string, unknown>): Promise<NotionPage[]> {
      const pages: NotionPage[] = [];
      let cursor: string | undefined;
      do {
        const res = await fetch(`${NOTION_API_URL}/databases/${databaseId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
          },
          body: JSON.stringify({ start_cursor: cursor, page_size: 100, ...(filter ? { filter } : {}) }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Notion API error [${res.status}]: ${err}`);
        }
        const data = await res.json();
        pages.push(...data.results);
        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);
      return pages;
    }

    // ========== SYNC VIDEOS (independent path) ==========
    let videosSynced = 0;
    const perVideo: any[] = [];
    if (videosDbId) {
      console.log('[sync-notion] Syncing videos DB:', videosDbId);
      // Purge legacy fakes that never had a notion_id
      await supabase.from('video_triggers').delete().is('notion_id', null);

      const videoPages = await fetchNotionDatabase(videosDbId);
      const seenNotionIds: string[] = [];

      for (const page of videoPages) {
        const props = page.properties;
        const title = extractTitle(props['Titre de la vidéo']) || extractTitle(props['Titre']) || '';
        if (!title.trim()) continue;
        const context = extractRichText(props['Contexte']);
        const description = extractRichText(props['Description']);
        const priority = extractNumber(props['Priorité']) ?? extractNumber(props['Priorite']) ?? 1;
        const themes = extractMultiSelect(props['Thèmes']) || extractMultiSelect(props['Themes']);
        const type = extractSelect(props['Type']) || 'interlude';
        const transition = extractSelect(props['Style de transition']) || 'fade_black';
        const videoUrl = extractUrl(props['URL Gumlet']) || extractUrl(props['URL']);

        const record = {
          notion_id: page.id,
          title,
          type,
          themes,
          video_url: videoUrl,
          priority,
          transition_style: transition,
          context,
          description,
          post_video_context: context, // back-compat for legacy code path
          updated_at: new Date().toISOString(),
        };
        const { error: vErr } = await supabase
          .from('video_triggers')
          .upsert(record, { onConflict: 'notion_id' });
        if (vErr) {
          console.error(`[sync-notion] video upsert error for ${title}:`, vErr);
          continue;
        }
        seenNotionIds.push(page.id);
        videosSynced++;
        perVideo.push({ title, themes, priority, type, has_url: !!videoUrl });
      }

      // Optional: prune rows whose Notion page disappeared
      if (seenNotionIds.length) {
        await supabase
          .from('video_triggers')
          .delete()
          .not('notion_id', 'is', null)
          .not('notion_id', 'in', `(${seenNotionIds.map((id) => `"${id}"`).join(',')})`);
      }
    }

    // Profile-scoped wipe. Other profiles stay queryable until an explicit activation.
    let wipedAll = false;
    let inPlaceProfileRefresh = false;
    if (body.wipe_all && charactersDbId) {
      if (activeIndexState?.active_profile === targetProfile.id) {
        // Never empty the live corpus globally. The loop below replaces one character
        // at a time, while profile migrations use an inactive parallel profile.
        inPlaceProfileRefresh = true;
        console.log(`[sync-notion] Safe in-place refresh for active profile ${targetProfile.id}`);
      } else {
        const { error: delErr } = await supabase
          .from('embeddings')
          .delete()
          .eq('embedding_profile', targetProfile.id);
        if (delErr) {
          throw new Error(`Unable to clear target profile ${targetProfile.id}: ${delErr.message}`);
        }
        wipedAll = true;
        console.log(`[sync-notion] Profile wipe: ${targetProfile.id} embeddings deleted`);
      }
    }

    function extractBlockText(block: any): string {
      const type = block.type;
      const blockData = block[type];
      if (!blockData) return '';
      if (blockData.rich_text) {
        const text = blockData.rich_text.map((t: any) => t.plain_text).join('');
        if (type.startsWith('heading_')) return `\n## ${text}`;
        if (type === 'bulleted_list_item' || type === 'numbered_list_item') return `- ${text}`;
        if (type === 'to_do') return `- [${blockData.checked ? 'x' : ' '}] ${text}`;
        if (type === 'quote') return `> ${text}`;
        if (type === 'callout') return `📌 ${text}`;
        if (type === 'toggle') return `${text}`;
        return text;
      }
      if (type === 'divider') return '---';
      return '';
    }

    async function fetchPageContent(pageId: string, depth = 0): Promise<string> {
      if (depth > 5) return '';
      const blocks: string[] = [];
      let cursor: string | undefined;
      do {
        const url = `${NOTION_API_URL}/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${NOTION_API_KEY}`, 'Notion-Version': '2022-06-28' },
        });
        if (!res.ok) break;
        const data = await res.json();
        for (const block of data.results) {
          const text = extractBlockText(block);
          if (text.trim()) blocks.push(text);
          if (block.has_children) {
            const childContent = await fetchPageContent(block.id, depth + 1);
            if (childContent.trim()) blocks.push(childContent);
          }
        }
        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);
      return blocks.join('\n\n');
    }

    async function generateEmbeddings(texts: string[], profile: RagEmbeddingProfile): Promise<number[][]> {
      const inputs = texts.map((text) => text.slice(0, 18000));
      if (profile.provider === "voyage") {
        const r = await fetch(`${VOYAGE_API_URL}/${profile.endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(profile.endpoint === "contextualizedembeddings"
            ? {
                model: profile.documentModel,
                inputs: [inputs],
                input_type: 'document',
                output_dimension: profile.dimension,
                output_dtype: profile.dtype,
              }
            : {
                model: profile.documentModel,
                input: inputs,
                input_type: 'document',
                output_dimension: profile.dimension,
                output_dtype: profile.dtype,
              }),
        });
        if (!r.ok) throw new Error(`Voyage embeddings error [${r.status}]: ${await r.text()}`);
        const d = await r.json();
        const items = profile.endpoint === "contextualizedembeddings" ? d.data?.[0]?.data : d.data;
        if (!Array.isArray(items) || items.length !== inputs.length) {
          throw new Error(`Voyage ${profile.documentModel} returned ${items?.length ?? 0}/${inputs.length} embeddings`);
        }
        return [...items]
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);
      }
      const r = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: profile.documentModel, input: inputs }),
      });
      if (!r.ok) throw new Error(`OpenAI Embeddings error [${r.status}]: ${await r.text()}`);
      const d = await r.json();
      if (!Array.isArray(d.data) || d.data.length !== inputs.length) {
        throw new Error(`OpenAI ${profile.documentModel} returned ${d.data?.length ?? 0}/${inputs.length} embeddings`);
      }
      return [...d.data]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);
    }

    function buildEmbeddingPayload(
      vector: number[],
      profile: RagEmbeddingProfile,
      characterId: string,
      chunkIndex: number,
      chunkCount: number,
    ) {
      const base: Record<string, unknown> = {
        embedding_provider: profile.provider,
        embedding_profile: profile.id,
        embedding_model: profile.documentModel,
        embedding_dimension: profile.dimension,
        embedding_dtype: profile.dtype,
        chunking_strategy: profile.chunkingStrategy,
        chunk_index: chunkIndex,
        chunk_count: chunkCount,
        indexed_at: new Date().toISOString(),
        character_id: characterId,
      };
      if (profile.provider === 'voyage') base.embedding_v = JSON.stringify(vector);
      else base.embedding = JSON.stringify(vector);
      return base;
    }

    function chunkText(text: string, maxChunkSize = 1000, overlap = 150): string[] {
      const sections = text.split(/\n## /);
      const chunks: string[] = [];
      let currentChunk = '';
      for (const section of sections) {
        const sectionText = chunks.length === 0 && !text.startsWith('\n## ') ? section : `## ${section}`;
        if (sectionText.length > maxChunkSize) {
          if (currentChunk.trim()) { chunks.push(currentChunk.trim()); currentChunk = ''; }
          const paragraphs = sectionText.split(/\n\n|\n(?=-\s)/);
          let subChunk = '';
          for (const para of paragraphs) {
            if (para.length > maxChunkSize) {
              if (subChunk.trim()) { chunks.push(subChunk.trim()); subChunk = ''; }
              const sentences = para.split(/(?<=[.!?])\s+/);
              let sentenceChunk = '';
              for (const sentence of sentences) {
                if (sentenceChunk.length + sentence.length > maxChunkSize && sentenceChunk.length > 0) {
                  chunks.push(sentenceChunk.trim());
                  sentenceChunk = sentence;
                } else {
                  sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                }
              }
              if (sentenceChunk.trim()) subChunk = sentenceChunk;
            } else if (subChunk.length + para.length > maxChunkSize && subChunk.length > 0) {
              chunks.push(subChunk.trim());
              subChunk = para;
            } else {
              subChunk += (subChunk ? '\n' : '') + para;
            }
          }
          if (subChunk.trim()) currentChunk = subChunk;
        } else if (currentChunk.length + sectionText.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sectionText;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + sectionText;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      if (overlap > 0 && chunks.length > 1) {
        const overlapped: string[] = [chunks[0]];
        for (let i = 1; i < chunks.length; i++) {
          const prevTail = chunks[i - 1].slice(-overlap);
          overlapped.push(`…${prevTail}\n\n${chunks[i]}`);
        }
        return overlapped;
      }
      return chunks;
    }

    async function generateSituationSummary(
      name: string,
      pageContent: string,
      promptFields: Record<string, string>,
    ): Promise<string> {
      const timeline = (promptFields.timeline || '').trim();
      const identity = (promptFields.identite_fondamentale || '').trim();
      const storyTail = pageContent.trim().slice(-4500);
      if (!OPENROUTER_API_KEY || (!timeline && !storyTail)) return '';
      const prompt = `Tu rédiges la SITUATION ACTUELLE du personnage "${name}", au moment exact où commence l'expérience (l'utilisateur va lui parler au téléphone maintenant).

RÈGLES STRICTES D'ORDRE (impératives) :
1. Commence par le PRÉSENT IMMÉDIAT : où il/elle se trouve maintenant, ce qu'il/elle est en train de faire, dans quel état.
2. Puis les FAITS RÉCENTS : ce qui s'est passé aujourd'hui, puis hier, puis les jours précédents (du plus récent au plus ancien).
3. Puis ce qui le/la PRÉOCCUPE et ce qu'il/elle cherche ou attend maintenant.
4. EN DERNIER SEULEMENT, une seule phrase d'identité (âge, métier, proches), reprise littéralement de l'IDENTITÉ ci-dessous.

INTERDITS :
- Ne JAMAIS ouvrir par une phrase biographique du type "X est un ... de N ans" ou "X, journaliste, ...".
- Pas d'interprétation psychologique, pas de style littéraire, pas de spéculation.
- Aucun fait absent des sources ci-dessous.
- Ne jamais inventer ni approximer un âge, un métier, un nombre d'enfants ou un prénom : ces éléments viennent uniquement de l'IDENTITÉ.

OBLIGATION DE COUVERTURE : si les sources les mentionnent, aucun de ces éléments ne peut être omis — le lieu du présent, le retour de la montagne, l'arme pointée puis le désarmement, chaque enfant nommé (y compris un enfant absent ou retenu ailleurs, par exemple dans un camp), et l'attente d'une autorité qui ne répond pas.

FORME : 90-130 mots, français, 3e personne, présent de l'indicatif pour le présent immédiat, faits denses et vérifiables. Priorise la TIMELINE et la FIN DU RÉCIT : l'ouverture du document décrit le passé, pas le présent.

IDENTITÉ (source unique pour l'âge, le métier et les proches) :
${identity || '(absente)'}

TIMELINE STRUCTURÉE (source prioritaire du présent) :
${timeline || '(absente)'}

FIN DU RÉCIT :
${storyTail || '(absente)'}

Situation actuelle (présent d'abord, identité en dernier, 90-130 mots) :`;

      try {
        const r = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 260,
          }),
        });
        if (!r.ok) {
          console.error('[sync-notion] situation_summary error:', r.status, await r.text());
          return '';
        }
        const d = await r.json();
        return (d.choices?.[0]?.message?.content || '').trim();
      } catch (err) {
        console.error('[sync-notion] situation_summary exception:', err);
        return '';
      }
    }

    // ========== SYNC CHARACTERS ==========
    const perCharacter: any[] = [];
    const characterSyncErrors: string[] = [];
    if (charactersDbId) {
      console.log(`[sync-notion] Syncing characters DB: ${charactersDbId} (mode=${mode})`);
      const pages = await fetchNotionDatabase(charactersDbId, {
        property: 'État',
        status: { equals: 'En cours' },
      });
      if (pages.length === 0) {
        throw new Error('No character sheet with État = En cours was returned; synchronization stopped to protect existing data');
      }
      const filtered = body.only_notion_id ? pages.filter((p) => p.id === body.only_notion_id) : pages;

      // A full database sync mirrors only active character sheets. If a sheet later
      // leaves "En cours", remove its local character and cascade its prompts/RAG.
      if (!body.only_notion_id) {
        const activeNotionIds = pages.map((page) => page.id);
        let staleQuery = supabase.from('characters').delete().not('notion_id', 'is', null);
        if (activeNotionIds.length > 0) {
          staleQuery = staleQuery.not('notion_id', 'in', `(${activeNotionIds.join(',')})`);
        }
        const { error: staleDeleteError } = await staleQuery;
        if (staleDeleteError) {
          throw new Error(`Unable to remove inactive characters: ${staleDeleteError.message}`);
        }
      }

      for (const page of filtered) {
      const props = page.properties;
      if (extractStatus(props['État']) !== 'En cours') continue;
      const name = extractTitle(props['Nom du caractère']);
      if (!name) continue;
      if (name.trim().toLowerCase() === 'identité & présentation' || name.trim().toLowerCase() === 'identite & presentation') {
        console.log(`[sync-notion] Skipping non-character entry: "${name}"`);
        continue;
      }

      // Page content is only needed when we touch RAG or generate summary (fields mode includes summary).
      const pageContent = (doRag || doFields) ? await fetchPageContent(page.id) : '';
      const resume = extractRichText(props['Résumé']);
      const archetype = extractSelect(props['Archétype narratif']) || '';
      const mbti = extractSelect(props['Type MBTI']) || '';
      const genre = extractSelect(props['Genre']);

      console.log(`[sync-notion] "${name}": page=${pageContent.length} chars, archetype=${archetype}, mode=${mode}`);

      const charRecord: Record<string, unknown> = {
        notion_id: page.id,
        name,
        personality: `${archetype}${mbti ? ` - ${mbti}` : ''}`.trim(),
        branch: genre === 'Femme' ? 'female' : 'male',
        updated_at: new Date().toISOString(),
      };
      if (doRag) charRecord.backstory = pageContent || resume;
      const { data: charRow, error: charErr } = await supabase
        .from('characters')
        .upsert(charRecord, { onConflict: 'notion_id' })
        .select()
        .single();
      if (charErr) {
        console.error(`[sync-notion] character upsert error for ${name}:`, charErr);
        characterSyncErrors.push(`${name}: ${charErr.message}`);
        continue;
      }

      let filledCount = 0;
      let situationSummary = '';
      if (doFields) {
        const promptFields = extractPromptFields(props);
        filledCount = Object.values(promptFields).filter((v) => v && v.trim()).length;
        situationSummary = await generateSituationSummary(name, pageContent, promptFields);

        const { error: promptErr } = await supabase
          .from('character_prompts')
          .upsert(
            {
              character_id: charRow.id,
              ...promptFields,
              situation_summary: situationSummary,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'character_id' },
          );
        if (promptErr) console.error(`[sync-notion] character_prompts upsert error for ${name}:`, promptErr);
      }

      let chunksCreated = 0;
      if (doRag) {
        if (!wipedAll) {
          const { error: deleteEmbeddingError } = await supabase
            .from('embeddings')
            .delete()
            .eq('source_table', 'characters')
            .eq('character_id', charRow.id)
            .eq('embedding_profile', targetProfile.id);
          if (deleteEmbeddingError) {
            throw new Error(`Unable to clear ${targetProfile.id} embeddings for ${name}: ${deleteEmbeddingError.message}`);
          }
        }

        if (pageContent.trim().length >= 10) {
          const headerPrefix = `Personnage: ${name}${archetype ? ` | Archétype: ${archetype}` : ''}`;
          const chunks = chunkText(pageContent, targetProfile.chunkSizeChars, targetProfile.chunkOverlapChars);
          const chunkContents = chunks.map((chunk, index) =>
            `${headerPrefix} | Partie ${index + 1}/${chunks.length}\n${chunk}`
          );
          const vectors = await generateEmbeddings(chunkContents, targetProfile);
          const records = chunkContents.map((chunkContent, index) => ({
              source_table: 'characters',
              source_id: charRow.id,
              content: chunkContent,
              ...buildEmbeddingPayload(vectors[index], targetProfile, charRow.id, index, chunks.length),
            }));
          const { error: insertEmbeddingError } = await supabase.from('embeddings').insert(records);
          if (insertEmbeddingError) {
            throw new Error(`Unable to insert ${targetProfile.id} embeddings for ${name}: ${insertEmbeddingError.message}`);
          }
          chunksCreated = records.length;
        }
      }

      perCharacter.push({
        name,
        id: charRow.id,
        mode,
        page_chars: pageContent.length,
        chunks_created: chunksCreated,
        summary_chars: situationSummary.length,
        prompt_fields_filled: filledCount,
      });
      }
    }

    const { count: totalEmb } = await supabase
      .from('embeddings')
      .select('id', { count: 'exact', head: true });

    const { count: profileEmbeddingCount } = await supabase
      .from('embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('embedding_profile', targetProfile.id);

    if (body.activate_profile && characterSyncErrors.length > 0) {
      throw new Error(`RAG profile was built incompletely and was not activated: ${characterSyncErrors.join('; ')}`);
    }
    if (body.activate_profile && charactersDbId && doRag && perCharacter.length === 0) {
      throw new Error('RAG profile was not activated because no character was indexed');
    }

    let activatedProfile: string | null = null;
    if (body.activate_profile && charactersDbId && doRag) {
      const { error: activateError } = await supabase
        .from('rag_index_state')
        .upsert({
          id: true,
          active_profile: targetProfile.id,
          previous_profile: activeIndexState?.active_profile && activeIndexState.active_profile !== targetProfile.id
            ? activeIndexState.active_profile
            : null,
          provider: targetProfile.provider,
          document_model: targetProfile.documentModel,
          query_model: targetProfile.queryModel,
          endpoint: targetProfile.endpoint,
          dimension: targetProfile.dimension,
          dtype: targetProfile.dtype,
          chunking_strategy: targetProfile.chunkingStrategy,
          chunk_size_chars: targetProfile.chunkSizeChars,
          chunk_overlap_chars: targetProfile.chunkOverlapChars,
          total_chunks: profileEmbeddingCount || 0,
          status: 'active',
          last_rebuild_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      if (activateError) throw new Error(`RAG profile activation failed: ${activateError.message}`);
      activatedProfile = targetProfile.id;
      console.log(`[sync-notion] Activated RAG profile ${targetProfile.id} (${profileEmbeddingCount || 0} chunks)`);
    } else if (activeIndexState?.active_profile === targetProfile.id && charactersDbId && doRag) {
      await supabase
        .from('rag_index_state')
        .update({
          total_chunks: profileEmbeddingCount || 0,
          last_rebuild_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', true);
    }

    return new Response(JSON.stringify({
      success: true,
      characters_synced: perCharacter.length,
      per_character: perCharacter,
      videos_synced: videosSynced,
      per_video: perVideo,
      wiped_all: wipedAll,
      in_place_profile_refresh: inPlaceProfileRefresh,
      total_embeddings_in_db: totalEmb || 0,
      profile_embeddings_in_db: profileEmbeddingCount || 0,
      rag_profile: targetProfile.id,
      document_embedding_model: targetProfile.documentModel,
      query_embedding_model: targetProfile.queryModel,
      embedding_dimension: targetProfile.dimension,
      embedding_dtype: targetProfile.dtype,
      activated_profile: activatedProfile,
      latency_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('[sync-notion] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
