// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handler: null as null | ((req: Request) => Promise<Response>),
  auth: vi.fn(),
  row: null as null | Record<string, unknown>,
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
const endpointPath = "../../supabase/functions/transcribe-video/index.ts";
await import(endpointPath);

const NOTION_ID = "40b62322-e595-80f9-b5bb-c177ffbda6f9";
const ASSET = "6ae6fc5f90944ced717fe68b";
const MASTER = `#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="${ASSET}_0_en_192k.m3u8",DEFAULT=YES\n#EXT-X-STREAM-INF:RESOLUTION=640x360,CODECS="avc1.1,mp4a.40.2"\n${ASSET}_0_360p.m3u8\n`;
const VIDEO_ONLY = `#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=640x360,CODECS="avc1.1"\n${ASSET}_0_360p.m3u8\n`;
const AUDIO_PL = `#EXTM3U\n#EXT-X-MAP:URI="${ASSET}_0_en_192k.mp4?token=t",BYTERANGE="9@0"\n#EXTINF:4,\n#EXT-X-BYTERANGE:10@9\n${ASSET}_0_en_192k.mp4?token=t\n`;

const request = (body: unknown = { notion_id: NOTION_ID }) => new Request("https://ava.invalid", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer admin" }, body: JSON.stringify(body),
});

function stubNetwork(opts: { aiText?: string; master?: string; llmStatuses?: number[]; size?: number } = {}) {
  const statuses = [...(opts.llmStatuses ?? [])];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/main.m3u8")) return new Response(opts.master ?? MASTER);
    if (url.endsWith("_en_192k.m3u8")) return new Response(AUDIO_PL);
    if (url.includes("_en_192k.mp4")) {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-length": String(opts.size ?? 3) } });
    }
    if (url.includes("openrouter.ai")) {
      const status = statuses.shift();
      if (status && status >= 400) return new Response("bad", { status });
      return Response.json({ choices: [{ message: { content: opts.aiText ?? "Voix 1 : Signez ici." } }], usage: { cost: 0.001 } });
    }
    if (url.includes("api.notion.com")) return Response.json({ id: NOTION_ID });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const callsTo = (fetch: ReturnType<typeof vi.fn>, host: string) => fetch.mock.calls.filter(([i]) => String(i).includes(host));

describe("transcribe-video edge function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selects = []; mocks.updates = [];
    mocks.row = { notion_id: NOTION_ID, video_url: `https://gumlet.tv/watch/${ASSET}`, nature: "extract", dialogue: "spoken", transcription: null, transcription_verified: false };
    mocks.auth.mockResolvedValue({ ok: true, userId: "admin" });
    vi.stubGlobal("Deno", { env: { get: (key: string) => ({
      NOTION_API_KEY: "notion-test", OPENROUTER_API_KEY: "or-test", SUPABASE_URL: "https://db.invalid", SUPABASE_SERVICE_ROLE_KEY: "svc",
    })[key] } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refuses non-admin callers before any read or call", async () => {
    const fetch = stubNetwork();
    mocks.auth.mockResolvedValue({ ok: false, response: new Response("Forbidden", { status: 403 }) });
    expect((await mocks.handler!(request())).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.selects).toEqual([]);
  });

  it("transcribes from the audio rendition and writes Transcription only, unverified", async () => {
    const fetch = stubNetwork();
    const res = await mocks.handler!(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, written: true, transcription: "Voix 1 : Signez ici.", audio_bytes: 3, verified_cleared: false });
    const [[, aiInit]] = callsTo(fetch, "openrouter.ai");
    expect(JSON.parse(String(aiInit?.body)).messages[0].content[1]).toEqual({ type: "input_audio", input_audio: { data: "AQID", format: "m4a" } });
    const [[, notionInit]] = callsTo(fetch, "api.notion.com");
    expect(Object.keys(JSON.parse(String(notionInit?.body)).properties)).toEqual(["Transcription"]);
    expect(mocks.updates).toEqual([{ transcription: "Voix 1 : Signez ici." }]);
  });

  it("retries once as an MP4 media part when the audio part is rejected", async () => {
    const fetch = stubNetwork({ llmStatuses: [400] });
    expect((await mocks.handler!(request())).status).toBe(200);
    const ai = callsTo(fetch, "openrouter.ai");
    expect(ai).toHaveLength(2);
    expect(JSON.parse(String(ai[1][1]?.body)).messages[0].content[1].video_url.url).toBe("data:video/mp4;base64,AQID");
  });

  it.each([
    ["silent", "dialogue_silent"], [null, "dialogue_missing"],
  ])("refuses dialogue=%s without any media or model call", async (dialogue, error) => {
    const fetch = stubNetwork();
    mocks.row = { ...mocks.row!, dialogue };
    const res = await mocks.handler!(request());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe(error);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a cinematic", async () => {
    const fetch = stubNetwork();
    mocks.row = { ...mocks.row!, nature: "transformed" };
    expect((await mocks.handler!(request())).status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing transcription without reanalyze, nor a verified one without confirmation", async () => {
    const fetch = stubNetwork();
    mocks.row = { ...mocks.row!, transcription: "ancien", transcription_verified: true };
    expect((await mocks.handler!(request())).status).toBe(409);
    expect((await mocks.handler!(request({ notion_id: NOTION_ID, reanalyze: true }))).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("replaces a verified transcription after confirmation and unticks the case in Notion and the mirror", async () => {
    const fetch = stubNetwork();
    mocks.row = { ...mocks.row!, transcription: "ancien", transcription_verified: true };
    const res = await mocks.handler!(request({ notion_id: NOTION_ID, reanalyze: true, confirm_overwrite_verified: true }));
    expect((await res.json()).verified_cleared).toBe(true);
    const [[, notionInit]] = callsTo(fetch, "api.notion.com");
    const props = JSON.parse(String(notionInit?.body)).properties;
    expect(Object.keys(props).sort()).toEqual(["Transcription", "Transcription vérifiée"]);
    expect(props["Transcription vérifiée"]).toEqual({ checkbox: false });
    expect(mocks.updates).toEqual([{ transcription: "Voix 1 : Signez ici.", transcription_verified: false }]);
  });

  it("fails explicitly without audio rendition: no model call, nothing written", async () => {
    const fetch = stubNetwork({ master: VIDEO_ONLY });
    const res = await mocks.handler!(request());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_audio_rendition");
    expect(callsTo(fetch, "openrouter.ai")).toHaveLength(0);
    expect(callsTo(fetch, "api.notion.com")).toHaveLength(0);
  });

  it("fails explicitly when the audio is too large", async () => {
    const fetch = stubNetwork({ size: 50 * 1024 * 1024 });
    const res = await mocks.handler!(request());
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("video_too_large");
    expect(callsTo(fetch, "openrouter.ai")).toHaveLength(0);
  });

  it("writes nothing and reports when no speech is detected", async () => {
    const fetch = stubNetwork({ aiText: "[AUCUNE PAROLE]" });
    const data = await (await mocks.handler!(request())).json();
    expect(data).toMatchObject({ ok: true, written: false, reason: "no_speech_detected" });
    expect(callsTo(fetch, "api.notion.com")).toHaveLength(0);
    expect(mocks.updates).toEqual([]);
  });

  it("reads only the catalogue labels, never a URL from the caller", async () => {
    const fetch = stubNetwork();
    await mocks.handler!(request({ notion_id: NOTION_ID, video_url: "https://evil.invalid/x" }));
    expect(callsTo(fetch, "evil.invalid")).toHaveLength(0);
    expect(mocks.selects).toEqual(["notion_id, video_url, nature, dialogue, transcription, transcription_verified"]);
  });
});
