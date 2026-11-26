// Admin-only: lists the Gumlet videos missing from the Notion "Vidéos AVA" base and
// creates their pages ("A vérifier"). Writes only new pages in that base: it never
// edits an existing page, another base or the app catalogue (video_triggers).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/adminAuth.ts";
import {
  buildNotionPage,
  GUMLET_WORKSPACE_ID,
  type GumletVideo,
  knownAssetIds,
  missingRequiredProperties,
  parseGumletVideo,
  parseImportRequest,
  VIDEOS_DATABASE_ID,
} from "../_shared/gumletImport.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_API_URL = "https://api.notion.com/v1";
const GUMLET_API_URL = "https://api.gumlet.com/v1";
/** Gumlet allows 1000 requests per hour: one detail call per listed video, newest first. */
const MAX_LISTED = 100;
const MAX_ASSET_PAGES = 20;
const DETAIL_CONCURRENCY = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

class UpstreamError extends Error {
  constructor(readonly code: string, readonly status = 502) {
    super(code);
  }
}

async function gumlet(path: string, key: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${GUMLET_API_URL}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401 || res.status === 403) throw new UpstreamError("gumlet_unauthorized");
  if (res.status === 429) throw new UpstreamError("gumlet_rate_limited", 429);
  if (!res.ok) throw new UpstreamError(`gumlet_${res.status}`);
  return await res.json();
}

async function notion(path: string, key: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${NOTION_API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    console.error('[import-gumlet-videos] notion', res.status, (await res.text()).slice(0, 500));
    throw new UpstreamError(`notion_${res.status}`);
  }
  return await res.json();
}

/** All pages of the base: a partial read would offer duplicates, so any failure aborts. */
async function readNotionPages(key: string) {
  const pages: Array<{ properties?: Record<string, unknown> }> = [];
  let cursor: string | undefined;
  do {
    const data = await notion(`/databases/${VIDEOS_DATABASE_ID}/query`, key, {
      method: "POST",
      body: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/** Asset ids of the whole workspace, newest first. */
async function listAssetIds(key: string): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_ASSET_PAGES; page++) {
    const data = await gumlet(
      `/video/assets/list/${GUMLET_WORKSPACE_ID}?page_size=100&page_number=${page}&sortBy=created_at&orderBy=desc`,
      key,
    );
    if (!Array.isArray(data.all_assets)) throw new UpstreamError("gumlet_unexpected_response");
    for (const asset of data.all_assets as Array<{ asset_id?: unknown }>) {
      if (typeof asset?.asset_id === "string") ids.push(asset.asset_id.toLowerCase());
    }
    if (data.all_assets.length < 100) break;
  }
  return [...new Set(ids)];
}

async function readVideo(assetId: string, key: string): Promise<GumletVideo> {
  const details = await gumlet(`/video/assets/${assetId}`, key);
  const video = parseGumletVideo(details);
  if (!video) throw new UpstreamError("gumlet_unexpected_response");
  // A video of another workspace would import but never play.
  if (details.workspace_id && details.workspace_id !== GUMLET_WORKSPACE_ID) {
    throw new UpstreamError("gumlet_other_workspace", 422);
  }
  return video;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  try {
    const parsed = parseImportRequest(await req.json().catch(() => ({})));
    if (!parsed.ok) return json({ error: parsed.error }, 400);

    const gumletKey = Deno.env.get('GUMLET_API_KEY');
    const notionKey = Deno.env.get('NOTION_API_KEY');
    if (!gumletKey) return json({ error: 'gumlet_key_missing' }, 503);
    if (!notionKey) return json({ error: 'NOTION_API_KEY is not configured' }, 500);

    const database = await notion(`/databases/${VIDEOS_DATABASE_ID}`, notionKey);
    const schema = (database.properties ?? {}) as Record<string, { type?: string }>;
    const missing = missingRequiredProperties(schema);
    if (missing.length) return json({ error: 'notion_schema_mismatch', missing }, 409);

    // Read again on every import: a video added meanwhile is never created twice.
    const known = knownAssetIds(await readNotionPages(notionKey));

    if (parsed.value.action === "list") {
      const all = await listAssetIds(gumletKey);
      const fresh = all.filter((id) => !known.has(id));
      const shown = fresh.slice(0, MAX_LISTED);
      const videos: GumletVideo[] = [];
      const unreadable: string[] = [];
      for (let start = 0; start < shown.length; start += DETAIL_CONCURRENCY) {
        const batch = shown.slice(start, start + DETAIL_CONCURRENCY);
        const results = await Promise.allSettled(batch.map((id) => readVideo(id, gumletKey)));
        results.forEach((result, index) => {
          if (result.status === "fulfilled") videos.push(result.value);
          else unreadable.push(batch[index]);
        });
      }
      return json({
        videos,
        unreadable,
        total_gumlet: all.length,
        already_in_notion: all.length - fresh.length,
        not_shown: fresh.length - shown.length,
      });
    }

    const { assetIds, defaults } = parsed.value;
    const created: Array<{ asset_id: string; title: string; notion_url: string }> = [];
    const skipped: string[] = [];
    const failed: Array<{ asset_id: string; error: string }> = [];
    const ignoredProperties = new Set<string>();
    // One at a time: Notion limits writes, and each result is reported on its own.
    for (const assetId of assetIds) {
      if (known.has(assetId)) {
        skipped.push(assetId);
        continue;
      }
      try {
        const video = await readVideo(assetId, gumletKey);
        const built = buildNotionPage(video, schema, defaults);
        built.skipped.forEach((name) => ignoredProperties.add(name));
        const page = await notion('/pages', notionKey, { method: "POST", body: built.page });
        created.push({ asset_id: assetId, title: video.title, notion_url: page.url });
        known.add(assetId);
      } catch (error) {
        failed.push({ asset_id: assetId, error: (error as Error).message });
      }
    }
    return json({ created, skipped, failed, ignored_properties: [...ignoredProperties] });
  } catch (error) {
    if (error instanceof UpstreamError) return json({ error: error.code }, error.status);
    console.error('[import-gumlet-videos]', error);
    return json({ error: (error as Error).message }, 500);
  }
});
