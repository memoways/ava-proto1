// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  auth: vi.fn(),
  row: null as null | { notion_id: string; video_url: string | null },
  selects: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
}));
vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (handler: typeof mocks.handler) => { mocks.handler = handler; } }));
vi.mock("../../supabase/functions/_shared/adminAuth.ts", () => ({ requireAdmin: mocks.auth }));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: () => ({
    from: () => ({
      select: (columns: string) => {
        mocks.selects.push(columns);
        return { eq: () => ({ maybeSingle: async () => ({ data: mocks.row, error: null }) }) };
      },
      update: (patch: Record<string, unknown>) => {
        mocks.updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));
// Keep Deno-only imports outside the browser TypeScript compilation graph.
const endpointPath = "../../supabase/functions/describe-video/index.ts";
await import(endpointPath);

const NOTION_ID = "40b62322-e595-80f9-b5bb-c177ffbda6f9";
const ASSET = "6ae6fc5f90944ced717fe68b";
const MASTER = `#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=684x360\n${ASSET}_avc_360p.m3u8\n`;
const VARIANT = `#EXTM3U\n#EXT-X-MAP:URI="${ASSET}_avc_360p.mp4?token=t",BYTERANGE="900@0"\n#EXTINF:4,\n#EXT-X-BYTERANGE:10@900\n${ASSET}_avc_360p.mp4?token=t\n`;

const request = (body: unknown = { notion_id: NOTION_ID }) => new Request("https://ava.invalid", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer admin" }, body: JSON.stringify(body),
});

function stubNetwork(aiText = "Une femme regarde le feu, la nuit.") {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/main.m3u8")) return new Response(MASTER);
    if (url.endsWith("_360p.m3u8")) return new Response(VARIANT);
    if (url.includes("_360p.mp4")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": "3" } });
    if (url.includes("openrouter.ai")) {
      return Response.json({ choices: [{ message: { content: aiText } }], usage: { prompt_tokens: 2600, completion_tokens: 40, cost: 0.001 } });
    }
    if (url.includes("api.notion.com")) return Response.json({ id: NOTION_ID });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const callsTo = (fetch: ReturnType<typeof vi.fn>, host: string) =>
  fetch.mock.calls.filter(([input]) => String(input).includes(host));

describe("describe-video edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selects = []; mocks.updates = [];
    mocks.row = { notion_id: NOTION_ID, video_url: `https://gumlet.tv/watch/${ASSET}` };
    mocks.auth.mockResolvedValue({ ok: true, userId: "admin" });
    vi.stubGlobal("Deno", { env: { get: (key: string) => ({
      NOTION_API_KEY: "notion-test", OPENROUTER_API_KEY: "or-test", SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "svc",
    })[key] } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses non-admin callers before any read, analysis or write", async () => {
    const fetch = stubNetwork();
    mocks.auth.mockResolvedValue({ ok: false, response: new Response("Forbidden", { status: 403 }) });
    expect((await mocks.handler!(request())).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.selects).toEqual([]);
    expect(mocks.updates).toEqual([]);
  });

  it("analyses the catalogue video and writes Description IA only, in Notion then the mirror", async () => {
    const fetch = stubNetwork();
    const res = await mocks.handler!(request());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ ok: true, notion_id: NOTION_ID, ai_description: "Une femme regarde le feu, la nuit.", video_bytes: 3 });
    expect(data.usage).toMatchObject({ prompt_tokens: 2600 });

    const [[, aiInit]] = callsTo(fetch, "openrouter.ai");
    const aiBody = JSON.parse(String(aiInit?.body));
    expect(aiBody.model).toBe("google/gemini-2.5-flash");
    expect(aiBody.messages[0].content[1].video_url.url).toBe("data:video/mp4;base64,AQID");

    const notionCalls = callsTo(fetch, "api.notion.com");
    expect(notionCalls).toHaveLength(1);
    const [notionUrl, notionInit] = notionCalls[0];
    expect(String(notionUrl)).toBe(`https://api.notion.com/v1/pages/${NOTION_ID}`);
    expect(notionInit?.method).toBe("PATCH");
    expect(Object.keys(JSON.parse(String(notionInit?.body)).properties)).toEqual(["Description IA"]);

    expect(mocks.updates).toEqual([{ ai_description: "Une femme regarde le feu, la nuit." }]);
  });

  it("never reads the human Description from the catalogue", async () => {
    stubNetwork();
    await mocks.handler!(request());
    expect(mocks.selects).toEqual(["notion_id, video_url"]);
  });

  it("takes the media URL from the catalogue, not from the caller", async () => {
    const fetch = stubNetwork();
    await mocks.handler!(request({ notion_id: NOTION_ID, video_url: "https://evil.invalid/x.mp4" }));
    expect(callsTo(fetch, "evil.invalid")).toHaveLength(0);
    expect(callsTo(fetch, `video.gumlet.io/673f29f4a5e1bf70aa645cb7/${ASSET}/main.m3u8`)).toHaveLength(1);
  });

  it("writes nothing when the model answers empty", async () => {
    const fetch = stubNetwork("   ");
    expect((await mocks.handler!(request())).status).toBe(502);
    expect(callsTo(fetch, "api.notion.com")).toHaveLength(0);
    expect(mocks.updates).toEqual([]);
  });

  it("rejects a missing notion_id and an unknown video without calling the model", async () => {
    const fetch = stubNetwork();
    expect((await mocks.handler!(request({}))).status).toBe(400);
    mocks.row = null;
    expect((await mocks.handler!(request())).status).toBe(404);
    expect(callsTo(fetch, "openrouter.ai")).toHaveLength(0);
  });

  it("refuses videos too large for an inline request", async () => {
    const fetch = stubNetwork();
    fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/main.m3u8")) return new Response(MASTER);
      if (url.endsWith("_360p.m3u8")) return new Response(VARIANT);
      return new Response("", { headers: { "content-length": String(50 * 1024 * 1024) } });
    });
    expect((await mocks.handler!(request())).status).toBe(413);
    expect(callsTo(fetch, "openrouter.ai")).toHaveLength(0);
  });
});
