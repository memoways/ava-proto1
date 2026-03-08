import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const OPENAI_API_URL = "https://api.openai.com/v1";

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
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: SyncRequest = await req.json();
    const results: Record<string, any> = {};

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

    // Fetch page body content (blocks) as plain text
    async function fetchPageContent(pageId: string): Promise<string> {
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
          const richTexts = block[block.type]?.rich_text;
          if (richTexts) {
            const text = richTexts.map((t: any) => t.plain_text).join('');
            if (text.trim()) blocks.push(text);
          }
        }
        cursor = data.has_more ? data.next_cursor : undefined;
      } while (cursor);
      return blocks.join('\n');
    }

    // Generate embedding via OpenAI
    async function generateEmbedding(text: string): Promise<number[]> {
      const res = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI Embeddings error [${res.status}]: ${err}`);
      }
      const data = await res.json();
      return data.data[0].embedding;
    }

    // Upsert embedding for a record
    async function upsertEmbedding(sourceTable: string, sourceId: string, content: string) {
      if (!content || content.trim().length < 10) return;
      const embedding = await generateEmbedding(content);
      const { data: existing } = await supabase
        .from('embeddings')
        .select('id')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .maybeSingle();

      if (existing) {
        await supabase.from('embeddings')
          .update({ content, embedding: JSON.stringify(embedding) })
          .eq('id', existing.id);
      } else {
        await supabase.from('embeddings')
          .insert({ source_table: sourceTable, source_id: sourceId, content, embedding: JSON.stringify(embedding) });
      }
    }

    // ========== SYNC CHARACTERS ==========
    // Notion props: "Nom du caractère" (title), "Résumé" (text), "Genre" (select), "Rôle familial" (select), "Archétype narratif" (select)
    // Page body contains detailed backstory, personality, system prompt
    if (body.databases.characters) {
      console.log('[sync-notion] Syncing characters...');
      const pages = await fetchNotionDatabase(body.databases.characters);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const name = extractTitle(props['Nom du caractère']);
        if (!name) continue;

        // Fetch page body for rich content (backstory, personality, etc.)
        const pageContent = await fetchPageContent(page.id);
        const resume = extractRichText(props['Résumé']);
        const genre = extractSelect(props['Genre']);

        const record = {
          notion_id: page.id,
          name,
          backstory: pageContent || resume,
          personality: `${extractSelect(props['Archétype narratif']) || ''} - ${extractSelect(props['Type MBTI']) || ''}`.trim(),
          system_prompt: resume,
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

        const embeddingText = `Personnage: ${name}\nRésumé: ${resume}\n${pageContent}`;
        await upsertEmbedding('characters', data.id, embeddingText);
        synced++;
      }
      results.characters = { synced, total: pages.length };
    }

    // ========== SYNC STORYWORLD ==========
    // Notion props: "Nom" (title), "Résumé" (text), "Type" (select), "Tags" (multi_select)
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
        synced++;
      }
      results.storyworld = { synced, total: pages.length };
    }

    // ========== SYNC GAMEPLAY STEPS ==========
    // Notion props: "Nom de l'étape" (title), "Type" (select), "Ordre" (number), "Condition de déclenchement" (text), "Description" (text)
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
    // Notion props: "Titre de la vidéo" (title), "Type" (select), "Thèmes" (multi_select),
    //   "URL Gumlet" (url), "Description" (text), "Priorité" (number),
    //   "Style de transition" (select), "Contexte post-vidéo" (text)
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

    console.log('[sync-notion] Sync complete:', results);

    return new Response(JSON.stringify({ success: true, results }), {
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
