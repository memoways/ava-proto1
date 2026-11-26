import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock("./llmUsageTracker", () => ({ trackLLMCall: vi.fn() }));
vi.mock("./settingsService", async (importOriginal) => ({ ...(await importOriginal<object>()), isReasoningEnabledForModel: () => false }));
vi.mock("./debugLogger", () => ({ debugLogger: { log: vi.fn(), logFetch: vi.fn(), logResponse: vi.fn() } }));
import { authenticatedFunctionFetch } from "./gameAuth";
import { callLLMWithUsage } from "./openRouterLLM";
import { buildEvalTurnOverrides, buildReferenceCandidateConfigs, parseSnapshotOverrides, type EvalLiveSnapshot, type EvalTurnConfig } from "./evalJudgePipeline";

/**
 * Latency lot 2: the judge and the long recall replay must play a candidate the
 * way the bench measured it (provider pinned, reasoning lowered), or gpt-oss and
 * Claude Haiku 5.5 spend their whole output budget thinking. Evaluation only.
 */
describe("routage et raisonnement du personnage en évaluation (latence, lot 2)", () => {
  it("lit provider, reasoningEffort et disableReasoning d'un instantané, et refuse une valeur invalide", () => {
    const { overrides, errors } = parseSnapshotOverrides('{"model":"openai/gpt-oss-120b","provider":{"only":["cerebras"],"allow_fallbacks":false},"reasoningEffort":"low","disableReasoning":true}');
    expect(errors).toEqual([]);
    expect(overrides).toMatchObject({ provider: { only: ["cerebras"], allow_fallbacks: false }, reasoningEffort: "low", disableReasoning: true });
    expect(parseSnapshotOverrides('{"provider":{"only":["bad slug!"]}}').errors).toHaveLength(1);
    expect(parseSnapshotOverrides('{"provider":{"data_collection":"allow"}}').errors).toHaveLength(1);
    expect(parseSnapshotOverrides('{"reasoningEffort":"max"}').errors).toHaveLength(1);
  });

  it("transmet les leviers au tour seulement quand le candidat les demande, avec un libellé lisible", () => {
    const live = { model: "openai/gpt-5.6-luna", temperature: 0.8, topP: 0.95, maxTokens: 360, ragTopK: 4, ragRetrieveK: 8, ragRerank: true, ragThreshold: 0.3, ragRerankModel: "rerank-2.5", ragRerankTruncation: false, promptVariant: "optimized_v3" } as EvalLiveSnapshot;
    const [reference, candidate] = buildReferenceCandidateConfigs(live, {}, { model: "openai/gpt-oss-120b", provider: { only: ["cerebras"] }, reasoningEffort: "low" });
    expect(buildEvalTurnOverrides(reference, "max").llm).toEqual({ model: "openai/gpt-5.6-luna", temperature: 0.8, maxTokens: 360, topP: 0.95 });
    expect(buildEvalTurnOverrides(candidate as EvalTurnConfig, "max").llm).toMatchObject({ provider: { only: ["cerebras"] }, reasoningEffort: "low" });
    expect(candidate.label).toContain('provider={"only":["cerebras"]}');
  });

  beforeEach(() => vi.mocked(authenticatedFunctionFetch).mockReset());

  it("envoie provider et reasoning_effort à proxy-llm, et rien de plus sans eux", async () => {
    const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: "Oui." }, finish_reason: "stop" }], usage: {} }), { status: 200 });
    vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());
    await callLLMWithUsage([{ role: "user", content: "Q" }], { model: "openai/gpt-oss-120b", provider: { only: ["cerebras"] }, reasoningEffort: "low" });
    await callLLMWithUsage([{ role: "user", content: "Q" }], { model: "openai/gpt-5.6-luna" });
    const bodies = vi.mocked(authenticatedFunctionFetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0]).toMatchObject({ provider: { only: ["cerebras"] }, reasoning_effort: "low" });
    expect(bodies[1]).not.toHaveProperty("provider");
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");
  });
});
