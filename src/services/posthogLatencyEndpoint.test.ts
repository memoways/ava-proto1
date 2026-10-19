// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ handler: null as null | ((req: Request) => Promise<Response>), auth: vi.fn() }));
vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({ serve: (handler: typeof mocks.handler) => { mocks.handler = handler; } }));
vi.mock("../../supabase/functions/_shared/adminAuth.ts", () => ({ requireAdmin: mocks.auth }));
// Keep Deno-only imports outside the browser TypeScript compilation graph.
const endpointPath = "../../supabase/functions/posthog-latency-stats/index.ts";
await import(endpointPath);

const request = (filters: Record<string, string> = {}, from = "2026-10-18T00:00:00Z") => new Request("https://ava.invalid", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ period: "custom", from, to: "2026-10-19T00:00:00Z", filters }),
});
const row = (video?: string, wait?: number) => ["voice_turn_completed", "2026-10-18T12:00:00Z", "s", `s:${video ?? "tts"}`, 1,
  "max", "llm", "stt", video ? null : "local-tts", "Chromium", 500, 1800, "measured", 5000, 100, 100, 300,
  video ? null : 300, null, video ? "video" : "unknown", "ok", false,
  ...(video ? [video, "actual-avatar", "started", wait] : [])];

describe("Lovable Cloud PostHog latency endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ ok: true });
    vi.stubGlobal("Deno", { env: { get: (key: string) => ({ POSTHOG_PERSONAL_API_KEY: "test-key", POSTHOG_PROJECT_ID: "137897" })[key] } });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("queries and aggregates video properties, retaining legacy unmeasured rows", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ results: [row("future-video", 1200), row("other-video", 2000), row()] }));
    vi.stubGlobal("fetch", fetch);
    const result = await mocks.handler!(request());
    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.latency.video).toEqual({ p50: 1200, p95: 2000, measured: 2 });
    expect(data.latency.tts).toEqual({ p50: 300, p95: 300, measured: 1 });
    expect(data.totals.turns).toBe(3);
    expect(data.providers.video).toHaveLength(2);
    expect(data.slowestTurns.find(t => t.video === "future-video")).toMatchObject({ videoMs: 1200, videoModel: "actual-avatar", videoStatus: "started", firstSoundMs: 1800 });
    expect(data.slowestTurns.find(t => !t.video).videoMs).toBeNull();
    const query = JSON.parse(String(fetch.mock.calls[0][1]?.body)).query.query;
    expect(query).toContain("properties.video_provider");
    expect(query).toContain("properties.t_video_wait_ms");
  });
  it("filters by actual video provider using the existing allowlist and quoting", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ results: [] })); vi.stubGlobal("fetch", fetch);
    await mocks.handler!(request({ video: "provider's-video" }));
    const query = JSON.parse(String(fetch.mock.calls[0][1]?.body)).query.query;
    expect(query).toContain("toString(properties.video_provider) = 'provider\\'s-video'");
  });
  it("keeps admin authorization before analytics requests", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    mocks.auth.mockResolvedValue({ ok: false, response: new Response("Forbidden", { status: 403 }) });
    expect((await mocks.handler!(request())).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
});
