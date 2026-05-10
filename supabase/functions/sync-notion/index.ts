import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const OPENAI_API_URL = "https://api.openai.com/v1";
const VOYAGE_API_URL = "https://api.voyageai.com/v1";

interface NotionPage {
  id: string;
  properties: Record<string, any>;
}

interface SyncRequest {
  databases: {
    characters?: string;
    storyworld?: string;
    gameplay_steps?: string;
    video_triggers?: string;
  };
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

function extractMultiSelect(prop: any): string[] {
  if (!prop?.multi_select) return [];
  return prop.multi_select.map((s: any) => s.name);
}

function extractSelect(prop: any): string | null {
  return prop?.select?.name || null;
}

function extractNumber(prop: any): number | null {
  return prop?.number ?? null;
}

function extractUrl(prop: any): string | null {
  return prop?.url || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) throw new Error('NOTION_API_KEY is not configured');

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const VOYAGE_API_KEY = Deno.env.get('VOYAGE_API_KEY');
    if (!OPENAI_API_KEY && !VOYAGE_API_KEY) throw new Error('No embedding provider configured (OPENAI_API_KEY or VOYAGE_API_KEY)');
    const useVoyage = !!VOYAGE_API_KEY;
    console.log(`[sync-notion] Embedding provider: ${useVoyage ? 'voyage-3 (1024d)' : 'openai-3-small (1536d)'}`);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: SyncRequest = await req.json();
    const results: Record<string, any> = {};

    // Snapshot embedding counts BEFORE sync
    const tablesToTrack = ['characters', 'storyworld', 'gameplay_steps', 'video_triggers'];
    const beforeCounts: Record<string, number> = {};
    for (const table of tablesToTrack) {
      const { count } = await supabase
        .from('embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('source_table', table);
      beforeCounts[table] = count || 0;
    }
    console.log('[sync-notion] Embeddings BEFORE sync:', beforeCounts);

    // Track embedding stats across all tables
    const embeddingStats: Record<string, { chunks_created: number; chars_embedded: number }> = {};
    function trackEmbedding(table: string, contentLength: number, chunksCount = 1) {
      if (!embeddingStats[table]) embeddingStats[table] = { chunks_created: 0, chars_embedded: 0 };
      embeddingStats[table].chunks_created += chunksCount;
      embeddingStats[table].chars_embedded += contentLength;
    }

    // Fetch all pages from a Notion database (handles pagination)
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

    // Extract text from a single Notion block
    function extractBlockText(block: any): string {
      const type = block.type;
      const blockData = block[type];
      if (!blockData) return '';

      // Handle rich_text based blocks
      if (blockData.rich_text) {
        const text = blockData.rich_text.map((t: any) => t.plain_text).join('');
        // Add heading markers for structure
        if (type.startsWith('heading_')) return `\n## ${text}`;
        if (type === 'bulleted_list_item' || type === 'numbered_list_item') return `- ${text}`;
        if (type === 'to_do') return `- [${blockData.checked ? 'x' : ' '}] ${text}`;
        if (type === 'quote') return `> ${text}`;
        if (type === 'callout') return `📌 ${text}`;
        if (type === 'toggle') return `${text}`;
        return text;
      }

      // Handle divider
      if (type === 'divider') return '---';

      return '';
    }

    // Fetch page body content RECURSIVELY (handles toggles, nested blocks, etc.)
    async function fetchPageContent(pageId: string, depth = 0): Promise<string> {
      if (depth > 5) return ''; // safety limit
      const blocks: string[] = [];
      let cursor: string | undefined;
      do {
        const url = `${NOTION_API_URL}/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        });
        if (!res.ok) break;
        const data = await res.json();
        for (const block of data.results) {
          const text = extractBlockText(block);
          if (text.trim()) blocks.push(text);

          // Recursively fetch children if block has them
          if (block.has_children) {
            const childContent = await fetchPageContent(block.id, depth + 1);
            if (childContent.trim()) blocks.push(childContent);
          }
        }
        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);
      return blocks.join('\n\n');
    }

    // Generate embedding via Voyage (preferred) or OpenAI fallback. Returns { vector, provider, dim }.
    async function generateEmbedding(text: string, inputType: "document" | "query" = "document"): Promise<{ vector: number[]; provider: 'voyage' | 'openai'; dim: number }> {
      const truncated = text.slice(0, 18000); // ~6k tokens safety
      if (useVoyage) {
        const r = await fetch(`${VOYAGE_API_URL}/embeddings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'voyage-3', input: [truncated], input_type: inputType, output_dimension: 1024 }),
        });
        if (!r.ok) {
          const err = await r.text();
          throw new Error(`Voyage embeddings error [${r.status}]: ${err}`);
        }
        const d = await r.json();
        return { vector: d.data[0].embedding, provider: 'voyage', dim: 1024 };
      }
      const r = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: truncated }),
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(`OpenAI Embeddings error [${r.status}]: ${err}`);
      }
      const d = await r.json();
      return { vector: d.data[0].embedding, provider: 'openai', dim: 1536 };
    }

    // Build the row payload depending on provider (writes to embedding or embedding_v).
    function buildEmbeddingPayload(emb: { vector: number[]; provider: 'voyage' | 'openai' }, characterId: string | null) {
      const base: Record<string, unknown> = {
        embedding_provider: emb.provider,
        character_id: characterId,
      };
      if (emb.provider === 'voyage') base.embedding_v = JSON.stringify(emb.vector);
      else base.embedding = JSON.stringify(emb.vector);
      return base;
    }

    // Upsert embedding for a record (single chunk).
    async function upsertEmbedding(sourceTable: string, sourceId: string, content: string, characterId: string | null = null) {
      if (!content || content.trim().length < 10) return;
      const emb = await generateEmbedding(content);
      const payload = buildEmbeddingPayload(emb, characterId);
      const { data: existing } = await supabase
        .from('embeddings')
        .select('id')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .maybeSingle();

      if (existing) {
        await supabase.from('embeddings').update({ content, ...payload }).eq('id', existing.id);
      } else {
        await supabase.from('embeddings').insert({ source_table: sourceTable, source_id: sourceId, content, ...payload });
      }
    }

    // For long character pages, split into chunks for better RAG retrieval.
    // Now uses 1000 chars max + 150-char overlap between consecutive chunks.
    function chunkText(text: string, maxChunkSize = 1000, overlap = 150): string[] {
      const sections = text.split(/\n## /);
      const chunks: string[] = [];
      let currentChunk = '';

      for (const section of sections) {
        const sectionText = chunks.length === 0 && !text.startsWith('\n## ') ? section : `## ${section}`;
        
        // If a single section exceeds maxChunkSize, split it by paragraphs
        if (sectionText.length > maxChunkSize) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          const paragraphs = sectionText.split(/\n\n|\n(?=-\s)/);
          let subChunk = '';
          for (const para of paragraphs) {
            // If a single paragraph is still too large, force-split by sentence or fixed size
            if (para.length > maxChunkSize) {
              if (subChunk.trim()) {
                chunks.push(subChunk.trim());
                subChunk = '';
              }
              // Split by sentences (period/exclamation/question followed by space)
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
          if (subChunk.trim()) {
            currentChunk = subChunk;
          }
        } else if (currentChunk.length + sectionText.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sectionText;
        } else {
          currentChunk += (currentChunk ? '\n' : '') + sectionText;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      return chunks;
    }

    // ========== SYNC CHARACTERS ==========
    if (body.databases.characters) {
      console.log('[sync-notion] Syncing characters...');
      const pages = await fetchNotionDatabase(body.databases.characters);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const name = extractTitle(props['Nom du caractère']);
        if (!name) continue;

        // Fetch page body RECURSIVELY for rich content
        const pageContent = await fetchPageContent(page.id);
        const resume = extractRichText(props['Résumé']);
        const genre = extractSelect(props['Genre']);

        console.log(`[sync-notion] Character "${name}": page content length = ${pageContent.length} chars`);

        const { data: existingCharacter } = await supabase
          .from('characters')
          .select('id, system_prompt')
          .eq('notion_id', page.id)
          .maybeSingle();

        const hasCustomPrompt = !!existingCharacter?.system_prompt?.trim();
        const preservedSystemPrompt = hasCustomPrompt
          ? existingCharacter!.system_prompt
          : resume;

        if (hasCustomPrompt && existingCharacter!.system_prompt !== resume) {
          console.log(`[sync-notion] Preserving custom system_prompt for "${name}" (${existingCharacter!.system_prompt.length} chars)`);
        }

        const record = {
          notion_id: page.id,
          name,
          backstory: pageContent || resume,
          personality: `${extractSelect(props['Archétype narratif']) || ''} - ${extractSelect(props['Type MBTI']) || ''}`.trim(),
          system_prompt: preservedSystemPrompt,
          branch: genre === 'Femme' ? 'female' : 'male',
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('characters')
          .upsert(record, { onConflict: 'notion_id' })
          .select()
          .single();

        if (error) {
          console.error(`[sync-notion] Error upserting character ${name}:`, error);
          continue;
        }

        // Create chunked embeddings for long character pages
        const fullText = `Personnage: ${name}\nRésumé: ${resume}\n${pageContent}`;
        const chunks = chunkText(fullText);

        if (chunks.length <= 1) {
          await upsertEmbedding('characters', data.id, fullText);
          trackEmbedding('characters', fullText.length, 1);
        } else {
          console.log(`[sync-notion] Character "${name}": splitting into ${chunks.length} chunks`);
          await supabase.from('embeddings')
            .delete()
            .eq('source_table', 'characters')
            .eq('source_id', data.id);

          for (let i = 0; i < chunks.length; i++) {
            const chunkContent = `[${name} - partie ${i + 1}/${chunks.length}]\n${chunks[i]}`;
            const embedding = await generateEmbedding(chunkContent);
            await supabase.from('embeddings')
              .insert({
                source_table: 'characters',
                source_id: data.id,
                content: chunkContent,
                embedding: JSON.stringify(embedding),
              });
          }
          trackEmbedding('characters', fullText.length, chunks.length);
        }
        synced++;
      }
      results.characters = { synced, total: pages.length };
    }

    // ========== SYNC STORYWORLD ==========
    if (body.databases.storyworld) {
      console.log('[sync-notion] Syncing storyworld...');
      const pages = await fetchNotionDatabase(body.databases.storyworld);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const title = extractTitle(props['Nom']);
        if (!title) continue;

        const record = {
          notion_id: page.id,
          title,
          content: extractRichText(props['Résumé']),
          category: extractSelect(props['Type']),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('storyworld')
          .upsert(record, { onConflict: 'notion_id' })
          .select()
          .single();

        if (error) {
          console.error(`[sync-notion] Error upserting storyworld ${title}:`, error);
          continue;
        }

        const tags = extractMultiSelect(props['Tags']).join(', ');
        const embeddingText = `${title}\nType: ${record.category || 'N/A'}\nTags: ${tags}\n${record.content}`;
        await upsertEmbedding('storyworld', data.id, embeddingText);
        trackEmbedding('storyworld', embeddingText.length, 1);
        synced++;
      }
      results.storyworld = { synced, total: pages.length };
    }

    // ========== SYNC GAMEPLAY STEPS ==========
    if (body.databases.gameplay_steps) {
      console.log('[sync-notion] Syncing gameplay_steps...');
      const pages = await fetchNotionDatabase(body.databases.gameplay_steps);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const name = extractTitle(props["Nom de l'étape"]);
        if (!name) continue;

        const record = {
          notion_id: page.id,
          name,
          type: extractSelect(props['Type']) || 'conversation',
          step_order: extractNumber(props['Ordre']),
          trigger_condition: extractRichText(props['Condition de déclenchement']),
          description: extractRichText(props['Description']),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('gameplay_steps')
          .upsert(record, { onConflict: 'notion_id' });

        if (error) {
          console.error(`[sync-notion] Error upserting gameplay_step ${name}:`, error);
          continue;
        }
        synced++;
      }
      results.gameplay_steps = { synced, total: pages.length };
    }

    // ========== SYNC VIDEO TRIGGERS ==========
    if (body.databases.video_triggers) {
      console.log('[sync-notion] Syncing video_triggers...');
      const pages = await fetchNotionDatabase(body.databases.video_triggers);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const title = extractTitle(props['Titre de la vidéo']);
        if (!title) continue;

        const record = {
          notion_id: page.id,
          title,
          type: extractSelect(props['Type']) || 'mid_conversation',
          themes: extractMultiSelect(props['Thèmes']),
          video_url: extractUrl(props['URL Gumlet']),
          placeholder_text: extractRichText(props['Description']),
          priority: extractNumber(props['Priorité']) || 1,
          transition_style: extractSelect(props['Style de transition']) || 'fade_black',
          post_video_context: extractRichText(props['Contexte post-vidéo']),
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('video_triggers')
          .upsert(record, { onConflict: 'notion_id' });

        if (error) {
          console.error(`[sync-notion] Error upserting video_trigger ${title}:`, error);
          continue;
        }
        synced++;
      }
      results.video_triggers = { synced, total: pages.length };
    }

    // Snapshot embedding counts AFTER sync
    const afterCounts: Record<string, number> = {};
    for (const table of tablesToTrack) {
      const { count } = await supabase
        .from('embeddings')
        .select('id', { count: 'exact', head: true })
        .eq('source_table', table);
      afterCounts[table] = count || 0;
    }
    const { count: totalEmbeddings } = await supabase
      .from('embeddings')
      .select('id', { count: 'exact', head: true });

    // Build diff report
    const embeddingDiff: Record<string, { before: number; after: number; delta: number }> = {};
    for (const table of tablesToTrack) {
      embeddingDiff[table] = {
        before: beforeCounts[table],
        after: afterCounts[table],
        delta: afterCounts[table] - beforeCounts[table],
      };
    }

    console.log('[sync-notion] Sync complete:', results);
    console.log('[sync-notion] Embeddings diff:', JSON.stringify(embeddingDiff));
    console.log('[sync-notion] Embedding generation stats:', embeddingStats);

    return new Response(JSON.stringify({
      success: true,
      results,
      embedding_stats: embeddingStats,
      embedding_diff: embeddingDiff,
      total_embeddings_in_db: totalEmbeddings || 0,
      synced_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[sync-notion] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
