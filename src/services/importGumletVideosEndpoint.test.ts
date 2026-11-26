// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveNativeVideoSource } from "./videoPlayback";
import {
  buildNotionPage,
  GUMLET_WORKSPACE_ID,
  knownAssetIds,
  parseGumletVideo,
  parseImportRequest,
  VIDEOS_DATABASE_ID,
} from "../../supabase/functions/_shared/gumletImport";
import { AVA_NOTION_DATABASES } from "./ragService";

const mocks = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  auth: vi.fn(),
}));
vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (handler: typeof mocks.handler) => { mocks.handler = handler; } }));
vi.mock("../../supabase/functions/_shared/adminAuth.ts", () => ({ requireAdmin: mocks.auth }));
// Keep Deno-only imports outside the browser TypeScript compilation graph.
const endpointPath = "../../supabase/functions/import-gumlet-videos/index.ts";
await import(endpointPath);

const KNOWN = "6ae6fc5f90944ced717fe68b";
const KNOWN_BY_ID = "6ae6fc5f90944ced717fe68c";
const FRESH = "6acc8341689a80cf2e4a427d";

const SCHEMA = {
  "Titre de la vidéo": { type: "title" },
  "URL Gumlet": { type: "url" },
  "État": { type: "status" },
  "ID Gumlet": { type: "rich_text" },
  "Durée (s)": { type: "number" },
  "Uploadée sur Gumlet": { type: "date" },
  "Dimensions": { type: "rich_text" },
  "Poids (Mo)": { type: "number" },
  "Dossier Gumlet": { type: "rich_text" },
  "Tags Gumlet": { type: "rich_text" },
  "Description Gumlet": { type: "rich_text" },
  "Nature": { type: "select" },
  "Dialogue": { type: "select" },
  "Personnages": { type: "multi_select" },
};

const details = (assetId: string, overrides: Record<string, unknown> = {}) => ({
  asset_id: assetId,
  workspace_id: GUMLET_WORKSPACE_ID,
  status: "ready",
  created_at: Date.UTC(2026, 10, 24, 9, 30),
  folder: "Extraits",
  tag: ["max", "neige"],
  input: { title: "Max dans la neige", description: "", duration: 12.345, width: 1920, height: 1080, aspect_ratio: "16:9", size: 4_250_000 },
  output: { thumbnail_url: [`https://video.gumlet.io/x/${assetId}/thumbnail-1-0.png`] },
  ...overrides,
});

const NOTION_PAGES = [
  { properties: { "URL Gumlet": { url: `https://gumlet.tv/watch/${KNOWN}` } } },
  { properties: { "URL Gumlet": { url: null }, "ID Gumlet": { rich_text: [{ plain_text: KNOWN_BY_ID }] } } },
];

const request = (body: unknown) => new Request("https://ava.invalid", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer admin" }, body: JSON.stringify(body),
});

function stubNetwork(options: { gumletStatus?: number; asset?: Record<string, unknown>; schema?: object } = {}) {
  const writes: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("api.gumlet.com") && options.gumletStatus) return new Response("no", { status: options.gumletStatus });
    if (url.includes("/video/assets/list/")) {
      return Response.json({ all_assets: [KNOWN, KNOWN_BY_ID, FRESH].map((asset_id) => ({ asset_id })) });
    }
    const asset = url.match(/\/video\/assets\/([a-f0-9]{24})$/)?.[1];
    if (asset) return Response.json(details(asset, options.asset));
    if (url.endsWith("/query")) return Response.json({ results: NOTION_PAGES, has_more: false });
    if (url.endsWith(`/databases/${VIDEOS_DATABASE_ID}`)) return Response.json({ properties: options.schema ?? SCHEMA });
    if (url.endsWith("/v1/pages")) {
      writes.push({ url, method, body: JSON.parse(String(init?.body)) });
      return Response.json({ id: "page", url: "https://www.notion.so/page" });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, writes };
}

let env: Record<string, string | undefined>;

beforeEach(() => {
  vi.clearAllMocks();
  env = { NOTION_API_KEY: "notion-test", GUMLET_API_KEY: "gumlet-test" };
  mocks.auth.mockResolvedValue({ ok: true, userId: "admin" });
  vi.stubGlobal("Deno", { env: { get: (key: string) => env[key] } });
});
afterEach(() => vi.unstubAllGlobals());

describe("import-gumlet-videos edge function", () => {
  it("refuses non-admin callers before any call", async () => {
    const { fetch } = stubNetwork();
    mocks.auth.mockResolvedValue({ ok: false, response: new Response("Forbidden", { status: 403 }) });
    expect((await mocks.handler!(request({ action: "list" }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says when the Gumlet key is missing or refused", async () => {
    stubNetwork();
    env.GUMLET_API_KEY = undefined;
    const missing = await mocks.handler!(request({ action: "list" }));
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ error: "gumlet_key_missing" });

    env.GUMLET_API_KEY = "wrong";
    stubNetwork({ gumletStatus: 401 });
    expect(await (await mocks.handler!(request({ action: "list" }))).json()).toEqual({ error: "gumlet_unauthorized" });
  });

  it("lists only the videos absent from Notion, without writing", async () => {
    const { writes } = stubNetwork();
    const body = await (await mocks.handler!(request({ action: "list" }))).json();
    expect(body).toMatchObject({ total_gumlet: 3, already_in_notion: 2, not_shown: 0, unreadable: [] });
    expect(body.videos.map((video: { asset_id: string }) => video.asset_id)).toEqual([FRESH]);
    expect(writes).toEqual([]);
  });

  it("creates one « A vérifier » page per new video and never a duplicate", async () => {
    const { writes } = stubNetwork();
    const response = await mocks.handler!(request({
      action: "import", asset_ids: [FRESH, KNOWN], defaults: { nature: "Extrait du film", characters: ["Max"] },
    }));
    expect(await response.json()).toMatchObject({
      created: [{ asset_id: FRESH, title: "Max dans la neige", notion_url: "https://www.notion.so/page" }],
      skipped: [KNOWN],
      failed: [],
      ignored_properties: [],
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe("POST");
    expect(writes[0].body).toMatchObject({
      parent: { database_id: VIDEOS_DATABASE_ID },
      cover: { type: "external" },
      properties: {
        "État": { status: { name: "A vérifier" } },
        "URL Gumlet": { url: `https://gumlet.tv/watch/${FRESH}` },
        "Durée (s)": { number: 12.3 },
        "Poids (Mo)": { number: 4.3 },
        "Uploadée sur Gumlet": { date: { start: "2026-11-24T09:30:00.000Z" } },
        "Nature": { select: { name: "Extrait du film" } },
        "Personnages": { multi_select: [{ name: "Max" }] },
      },
    });
    expect(writes[0].body.properties).not.toHaveProperty("Dialogue");
    expect(writes[0].body.properties).not.toHaveProperty("Description");
  });

  it("refuses a video from another Gumlet workspace", async () => {
    const { writes } = stubNetwork({ asset: { workspace_id: "0".repeat(24) } });
    const body = await (await mocks.handler!(request({ action: "import", asset_ids: [FRESH] }))).json();
    expect(body.failed).toEqual([{ asset_id: FRESH, error: "gumlet_other_workspace" }]);
    expect(writes).toEqual([]);
  });

  it("imports nothing when the base lost a required field", async () => {
    const { writes } = stubNetwork({ schema: { ...SCHEMA, "État": { type: "select" } } });
    const response = await mocks.handler!(request({ action: "import", asset_ids: [FRESH] }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "notion_schema_mismatch", missing: ["État"] });
    expect(writes).toEqual([]);
  });
});

describe("Gumlet import rules", () => {
  it("targets the same base and Gumlet workspace as the app", () => {
    expect(VIDEOS_DATABASE_ID).toBe(AVA_NOTION_DATABASES.videos);
    expect(resolveNativeVideoSource(`https://gumlet.tv/watch/${FRESH}`).url).toContain(GUMLET_WORKSPACE_ID);
  });

  it("rejects malformed requests and unknown choices", () => {
    expect(parseImportRequest({ action: "delete" })).toEqual({ ok: false, error: "unknown_action" });
    expect(parseImportRequest({ action: "import", asset_ids: ["../x"] })).toEqual({ ok: false, error: "invalid_asset_ids" });
    expect(parseImportRequest({ action: "import", asset_ids: [FRESH], defaults: { characters: ["Zed"] } }))
      .toEqual({ ok: false, error: "invalid_characters" });
  });

  it("recognises every stored link form", () => {
    expect(knownAssetIds([
      { properties: { "URL Gumlet": { url: `https://play.gumlet.io/embed/${KNOWN}?autoplay=true` } } },
      { properties: { "URL": { url: `https://video.gumlet.io/${GUMLET_WORKSPACE_ID}/${FRESH}/main.m3u8` } } },
    ])).toEqual(new Set([KNOWN, FRESH]));
  });

  it("reports metadata fields that Notion does not have instead of creating them", () => {
    const video = parseGumletVideo(details(FRESH, { tag: "a, b" }))!;
    expect(video.tags).toEqual(["a", "b"]);
    const { page, skipped } = buildNotionPage(video, { "Durée (s)": { type: "number" } }, {});
    expect(Object.keys(page.properties as object)).toEqual(["Titre de la vidéo", "URL Gumlet", "État", "Durée (s)"]);
    expect(skipped).toContain("Tags Gumlet");
    expect(skipped).not.toContain("Description Gumlet");
  });
});
