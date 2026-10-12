import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
const mock = vi.hoisted(() => ({ client: { from: vi.fn() } }));
vi.mock("../supabase", () => ({ supabaseForAdmin: vi.fn(async () => mock.client) }));
import tool from "./get-voice-latencies";
import { supabaseForAdmin } from "../supabase";
import { createVoiceTurnV2 } from "../../../services/voiceTurnTelemetryV2";
const ctx = { isAuthenticated: () => true } as unknown as ToolContext;
function query(data: unknown[]) {
  const builder = { select: vi.fn(), gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range: vi.fn(), eq: vi.fn(), in: vi.fn(), contains: vi.fn(), then: (resolve: (value: unknown) => void) => Promise.resolve({ data, error: null }).then(resolve) };
  for (const key of ["select", "gte", "lt", "order", "range", "eq", "in", "contains"] as const) builder[key].mockReturnValue(builder);
  return builder;
}
function fixture() {
  const events: unknown[] = [];
  const turn = createVoiceTurnV2({ session_id: "s1", turn_id: "s1:1", turn_index: 1, character: "emma", environment_id: "sandbox-ulrich", context_type: "sandbox", input_mode: "hands_free", latency_origin: "app_turn_decision" }, 1000, (event_name, metadata_json) => events.push({ id: String(events.length), created_at: "2026-10-12T12:00:00Z", event_name, metadata_json: { ...metadata_json, transcript: "private" } }));
  turn.finish("failed");
  return events;
}
describe("MCP V2 contract with legacy separation", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(supabaseForAdmin).mockResolvedValue(mock.client as never); });
  it("returns PRD4 failures and coverage, preserving legacy interpolation and measured zero", async () => {
    const voice = query(fixture()); const audio = query([{ direction: "in", t_stt_ms: 0, context_type: "sandbox" }]); const legacy = query([]);
    mock.client.from.mockImplementation((table) => table === "voice_turn_events" ? voice : table === "audio_latencies" ? audio : legacy);
    const result = await tool.handler!({ days: 1, environment: "sandbox-ulrich", character: "emma", provider: "gradium", transport: "websocket" }, ctx);
    const summary = (result.structuredContent as { summary: { v2: { summary: { attempts: number; statuses: unknown; voiceEndToOutputEstimatedMs: { p95: number | null } } }; audio: { sttMs: { p50: number } }; legacy: { additionalV2FiltersApplied: boolean } } }).summary;
    expect(summary.v2.summary.statuses).toEqual({ failed: 1 });
    expect(summary.v2.summary.voiceEndToOutputEstimatedMs.p95).toBeNull();
    expect(summary.audio.sttMs.p50).toBe(0);
    expect(summary.legacy.additionalV2FiltersApplied).toBe(false);
    expect(voice.eq).toHaveBeenCalledWith("environment_id", "sandbox-ulrich");
    expect(voice.eq).toHaveBeenCalledWith("metadata_json->>character", "emma");
    expect(voice.contains).toHaveBeenCalledWith("metadata_json", { services: [{ service: "tts", effective_provider: "gradium", transport: "websocket" }] });
    expect(legacy.contains).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("caps and paginates events using an extra row, with stable ordering", async () => {
    const rows = fixture(); const voice = query(rows);
    mock.client.from.mockImplementation((table) => table === "voice_turn_events" ? voice : query([]));
    const result = await tool.handler!({ limit: 1 }, ctx);
    expect(result.structuredContent).toMatchObject({ summary: { v2: { page: { offset: 0, limit: 1, nextOffset: 1, capped: false, cappedAt: 3000 }, summaryScope: "returned_page_not_full_cohort" } } });
    expect(voice.range).toHaveBeenCalledWith(0, 1);
    expect(voice.order).toHaveBeenCalledWith("id", { ascending: false });
  });
  it("rejects invalid filters and non-admin callers before reading data", async () => {
    await expect(tool.handler!({ offset: -1 }, ctx)).rejects.toThrow();
    expect(mock.client.from).not.toHaveBeenCalled();
    vi.mocked(supabaseForAdmin).mockRejectedValue(new Error("Admin access required"));
    await expect(tool.handler!({}, ctx)).rejects.toThrow("Admin access required");
    expect(mock.client.from).not.toHaveBeenCalled();
  });
  it("requires an authenticated caller", async () => {
    await expect(tool.handler!({}, { isAuthenticated: () => false } as unknown as ToolContext)).rejects.toThrow("Sign-in required");
  });
});
