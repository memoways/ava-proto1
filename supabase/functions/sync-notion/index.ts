import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    "Ce que tu sais de l'utilisateur",
    "Ce que tu sais de l’utilisateur",
    "Ce que tu sais de l utilisateur",
  ],
  dynamique_conversation: ["Dynamique de la conversation"],
  sujets_sensibles: ["Sujets sensibles"],
  profondeur_par_niveau: ["Profondeur par niveau"],
};

function extractPromptFields(props: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [col, aliases] of Object.entries(PROMPT_FIELD_ALIASES)) {
    let value = "";
    for (const alias of aliases) {
      if (props[alias]) {
        value = extractRichText(props[alias]).trim();
        if (value) break;
      }
    }
    out[col] = value;
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) throw new Error('NOTION_API_KEY is not configured');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: SyncRequest = await req.json().catch(() => ({}));
    const charactersDbId = body.databases?.characters;
    const videosDbId = body.databases?.videos;
    if (!charactersDbId && !videosDbId) {
      return new Response(JSON.stringify({ error: "databases.characters or databases.videos is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (charactersDbId && !OPENAI_API_KEY && !VOYAGE_API_KEY) {
      throw new Error('No embedding provider configured');
    }
    const useVoyage = !!VOYAGE_API_KEY;

    // ---- Notion helpers ----
    async function fetchNotionDatabase(databaseId: string): Promise<NotionPage[]> {
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
          body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
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

    // Global wipe (used by "Wipe & rebuild RAG" button)
    let wipedAll = false;
    if (body.wipe_all && charactersDbId) {
      const { error: delErr } = await supabase
        .from('embeddings')
        .delete()
        .not('id', 'is', null);
      if (delErr) {
        console.error('[sync-notion] Global wipe failed:', delErr);
      } else {
        wipedAll = true;
        console.log('[sync-notion] Global wipe: all embeddings deleted');
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

    async function generateEmbedding(text: string): Promise<{ vector: number[]; provider: 'voyage' | 'openai'; dim: number }> {
      const truncated = text.slice(0, 18000);
      if (useVoyage) {
        const r = await fetch(`${VOYAGE_API_URL}/embeddings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'voyage-3', input: [truncated], input_type: 'document', output_dimension: 1024 }),
        });
        if (!r.ok) throw new Error(`Voyage embeddings error [${r.status}]: ${await r.text()}`);
        const d = await r.json();
        return { vector: d.data[0].embedding, provider: 'voyage', dim: 1024 };
      }
      const r = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: truncated }),
      });
      if (!r.ok) throw new Error(`OpenAI Embeddings error [${r.status}]: ${await r.text()}`);
      const d = await r.json();
      return { vector: d.data[0].embedding, provider: 'openai', dim: 1536 };
    }

    function buildEmbeddingPayload(emb: { vector: number[]; provider: 'voyage' | 'openai' }, characterId: string) {
      const base: Record<string, unknown> = { embedding_provider: emb.provider, character_id: characterId };
      if (emb.provider === 'voyage') base.embedding_v = JSON.stringify(emb.vector);
      else base.embedding = JSON.stringify(emb.vector);
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

    async function generateSituationSummary(name: string, pageContent: string): Promise<string> {
      if (!OPENROUTER_API_KEY || !pageContent.trim()) return '';
      const prompt = `Tu vas lire le récit complet du personnage "${name}" (faits, événements, situation actuelle). Résume en 100-150 mots STRICTEMENT FACTUELS sa situation actuelle au moment de l'expérience (qui il/elle est, ce qui s'est passé récemment, ce qui le/la préoccupe). Pas de fioritures, pas de "il semble que", pas d'interprétation : juste les faits. Français, à la 3e personne.\n\nRÉCIT:\n${pageContent.slice(0, 6000)}\n\nRésumé factuel (100-150 mots):`;
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
    if (charactersDbId) {
      console.log('[sync-notion] Syncing characters DB:', charactersDbId);
      const pages = await fetchNotionDatabase(charactersDbId);
      const filtered = body.only_notion_id ? pages.filter((p) => p.id === body.only_notion_id) : pages;

      for (const page of filtered) {
      const props = page.properties;
      const name = extractTitle(props['Nom du caractère']);
      if (!name) continue;
      if (name.trim().toLowerCase() === 'identité & présentation' || name.trim().toLowerCase() === 'identite & presentation') {
        console.log(`[sync-notion] Skipping non-character entry: "${name}"`);
        continue;
      }

      const pageContent = await fetchPageContent(page.id);
      const resume = extractRichText(props['Résumé']);
      const archetype = extractSelect(props['Archétype narratif']) || '';
      const mbti = extractSelect(props['Type MBTI']) || '';
      const genre = extractSelect(props['Genre']);

      console.log(`[sync-notion] "${name}": page=${pageContent.length} chars, archetype=${archetype}`);

      const charRecord = {
        notion_id: page.id,
        name,
        backstory: pageContent || resume,
        personality: `${archetype}${mbti ? ` - ${mbti}` : ''}`.trim(),
        branch: genre === 'Femme' ? 'female' : 'male',
        updated_at: new Date().toISOString(),
      };
      const { data: charRow, error: charErr } = await supabase
        .from('characters')
        .upsert(charRecord, { onConflict: 'notion_id' })
        .select()
        .single();
      if (charErr) {
        console.error(`[sync-notion] character upsert error for ${name}:`, charErr);
        continue;
      }

      const promptFields = extractPromptFields(props);
      const filledCount = Object.values(promptFields).filter((v) => v && v.trim()).length;
      const situationSummary = await generateSituationSummary(name, pageContent);

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

      if (!wipedAll) {
        await supabase
          .from('embeddings')
          .delete()
          .eq('source_table', 'characters')
          .eq('character_id', charRow.id);
      }

      let chunksCreated = 0;
      if (pageContent.trim().length >= 10) {
        const headerPrefix = `Personnage: ${name}${archetype ? ` | Archétype: ${archetype}` : ''}`;
        const chunks = chunkText(pageContent);
        for (let i = 0; i < chunks.length; i++) {
          const chunkContent = `${headerPrefix} | Partie ${i + 1}/${chunks.length}\n${chunks[i]}`;
          const emb = await generateEmbedding(chunkContent);
          const payload = buildEmbeddingPayload(emb, charRow.id);
          await supabase.from('embeddings').insert({
            source_table: 'characters',
            source_id: charRow.id,
            content: chunkContent,
            ...payload,
          });
          chunksCreated++;
        }
      }

      perCharacter.push({
        name,
        id: charRow.id,
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

    return new Response(JSON.stringify({
      success: true,
      characters_synced: perCharacter.length,
      per_character: perCharacter,
      videos_synced: videosSynced,
      per_video: perVideo,
      wiped_all: wipedAll,
      total_embeddings_in_db: totalEmb || 0,
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
