import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), usage: vi.fn() }));
vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch: mocks.fetch, getCachedSession: vi.fn() }));
vi.mock("./llmUsageTracker", () => ({ trackLLMCall: mocks.usage }));
vi.mock("./settingsService", () => ({ isReasoningEnabledForModel: () => false }));
import { callLLMWithUsage } from "./openRouterLLM";
import { queryRAGDetailed } from "./ragService";
const server = { request_id: "edge1", clock: "edge_monotonic", spans: [{ name: "embedding", start_ms: 1, end_ms: 2, status: "failed" }] };
describe("failed HTTP technical observations", () => {
  beforeEach(() => { mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "provider unavailable", _ava_observability: server }), { status: 503 })); });
  it("keeps RAG error spans while preserving degraded response semantics", async () => {
    const result = await queryRAGDetailed("Question", undefined, 5, undefined, { characterId: "11111111-1111-4111-8111-111111111111" });
    expect(result.matches).toEqual([]);
    expect(result.error).toMatch(/^HTTP 503/);
    expect(result.serverObservation).toEqual(server);
  });
  it("reports LLM error spans before preserving the existing rejection", async () => {
    const observed = vi.fn();
    await expect(callLLMWithUsage([{ role: "user", content: "Question" }], { model: "openai/test", onServerObserved: observed })).rejects.toThrow("LLM error: 503");
    expect(observed).toHaveBeenCalledWith(server);
  });
  it("never changes the provider error if the observer throws", async () => {
    await expect(callLLMWithUsage([{ role: "user", content: "Question" }], { model: "openai/test", onServerObserved: () => { throw new Error("collector offline"); } })).rejects.toThrow("LLM error: 503");
  });
});
