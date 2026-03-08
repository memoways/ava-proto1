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
    rules?: string;
  };
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

    // Helper: fetch all pages from a Notion database
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

    // Helper: extract text from Notion rich text property
    function extractRichText(prop: any): string {
      if (!prop?.rich_text) return '';
      return prop.rich_text.map((t: any) => t.plain_text).join('');
    }

    // Helper: extract title from Notion title property
    function extractTitle(prop: any): string {
      if (!prop?.title) return '';
      return prop.title.map((t: any) => t.plain_text).join('');
    }

    // Helper: extract multi-select values
    function extractMultiSelect(prop: any): string[] {
      if (!prop?.multi_select) return [];
      return prop.multi_select.map((s: any) => s.name);
    }

    // Helper: extract select value
    function extractSelect(prop: any): string | null {
      return prop?.select?.name || null;
    }

    // Helper: extract number
    function extractNumber(prop: any): number | null {
      return prop?.number ?? null;
    }

    // Helper: extract URL
    function extractUrl(prop: any): string | null {
      return prop?.url || null;
    }

    // Helper: generate embedding via OpenAI
    async function generateEmbedding(text: string): Promise<number[]> {
      const res = await fetch(`${OPENAI_API_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI Embeddings error [${res.status}]: ${err}`);
      }

      const data = await res.json();
      return data.data[0].embedding;
    }

    // Helper: upsert embedding for a record
    async function upsertEmbedding(sourceTable: string, sourceId: string, content: string) {
      if (!content || content.trim().length < 10) return;

      const embedding = await generateEmbedding(content);

      // Check if embedding exists
      const { data: existing } = await supabase
        .from('embeddings')
        .select('id')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('embeddings')
          .update({ content, embedding: JSON.stringify(embedding) })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('embeddings')
          .insert({ source_table: sourceTable, source_id: sourceId, content, embedding: JSON.stringify(embedding) });
      }
    }

    // SYNC CHARACTERS
    if (body.databases.characters) {
      console.log('[sync-notion] Syncing characters...');
      const pages = await fetchNotionDatabase(body.databases.characters);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const name = extractTitle(props['Name'] || props['Nom'] || props['name']);
        if (!name) continue;

        const record = {
          notion_id: page.id,
          name,
          system_prompt: extractRichText(props['System Prompt'] || props['Prompt'] || props['system_prompt']),
          backstory: extractRichText(props['Backstory'] || props['Histoire'] || props['backstory']),
          personality: extractRichText(props['Personality'] || props['Personnalité'] || props['personality']),
          branch: extractSelect(props['Branch'] || props['Branche'] || props['branch']) || 'male',
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

        // Generate embedding from combined text
        const embeddingText = `Personnage: ${name}\n${record.backstory}\n${record.personality}\n${record.system_prompt}`;
        await upsertEmbedding('characters', data.id, embeddingText);
        synced++;
      }
      results.characters = { synced, total: pages.length };
    }

    // SYNC STORYWORLD
    if (body.databases.storyworld) {
      console.log('[sync-notion] Syncing storyworld...');
      const pages = await fetchNotionDatabase(body.databases.storyworld);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const title = extractTitle(props['Name'] || props['Titre'] || props['Title'] || props['name']);
        if (!title) continue;

        const record = {
          notion_id: page.id,
          title,
          content: extractRichText(props['Content'] || props['Contenu'] || props['content'] || props['Description']),
          category: extractSelect(props['Category'] || props['Catégorie'] || props['category']),
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

        const embeddingText = `${title}\n${record.content}`;
        await upsertEmbedding('storyworld', data.id, embeddingText);
        synced++;
      }
      results.storyworld = { synced, total: pages.length };
    }

    // SYNC GAMEPLAY STEPS
    if (body.databases.gameplay_steps) {
      console.log('[sync-notion] Syncing gameplay_steps...');
      const pages = await fetchNotionDatabase(body.databases.gameplay_steps);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const name = extractTitle(props['Name'] || props['Nom'] || props['name']);
        if (!name) continue;

        const record = {
          notion_id: page.id,
          name,
          type: extractSelect(props['Type'] || props['type']) || 'conversation',
          step_order: extractNumber(props['Order'] || props['Ordre'] || props['step_order']),
          trigger_condition: extractRichText(props['Condition'] || props['trigger_condition']),
          description: extractRichText(props['Description'] || props['description']),
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

    // SYNC VIDEO TRIGGERS
    if (body.databases.video_triggers) {
      console.log('[sync-notion] Syncing video_triggers...');
      const pages = await fetchNotionDatabase(body.databases.video_triggers);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const title = extractTitle(props['Name'] || props['Titre'] || props['Title'] || props['name']);
        if (!title) continue;

        const record = {
          notion_id: page.id,
          title,
          type: extractSelect(props['Type'] || props['type']) || 'mid_conversation',
          themes: extractMultiSelect(props['Themes'] || props['Thèmes'] || props['themes']),
          video_url: extractUrl(props['Video URL'] || props['video_url']),
          placeholder_text: extractRichText(props['Placeholder'] || props['placeholder_text'] || props['Description']),
          priority: extractNumber(props['Priority'] || props['Priorité'] || props['priority']) || 1,
          transition_style: extractSelect(props['Transition'] || props['transition_style']) || 'fade_black',
          post_video_context: extractRichText(props['Post Video Context'] || props['post_video_context'] || props['Contexte post-vidéo']),
          duration_seconds: extractNumber(props['Duration'] || props['Durée'] || props['duration_seconds']) || 10,
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

    // SYNC RULES
    if (body.databases.rules) {
      console.log('[sync-notion] Syncing rules...');
      const pages = await fetchNotionDatabase(body.databases.rules);
      let synced = 0;

      for (const page of pages) {
        const props = page.properties;
        const title = extractTitle(props['Name'] || props['Titre'] || props['Title'] || props['name']);
        if (!title) continue;

        const record = {
          notion_id: page.id,
          title,
          content: extractRichText(props['Content'] || props['Contenu'] || props['content']),
          category: extractSelect(props['Category'] || props['Catégorie'] || props['category']),
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('rules')
          .upsert(record, { onConflict: 'notion_id' })
          .select()
          .single();

        if (error) {
          console.error(`[sync-notion] Error upserting rule ${title}:`, error);
          continue;
        }

        const embeddingText = `Règle: ${title}\n${record.content}`;
        await upsertEmbedding('rules', data.id, embeddingText);
        synced++;
      }
      results.rules = { synced, total: pages.length };
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
