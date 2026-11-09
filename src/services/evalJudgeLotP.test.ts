import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/prd4Orchestrator", () => ({ processPRD4Turn: vi.fn() }));
vi.mock("@/services/experienceOrchestration", () => ({ getCharacterRuntimeReadiness: vi.fn() }));
vi.mock("@/services/characterIdentityGuard", () => ({ toCharacterExecutionContext: vi.fn() }));
vi.mock("@/services/characterPromptService", () => ({ loadCharacterPrompt: vi.fn() }));
vi.mock("@/services/environmentContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/environmentContext")>()),
  loadEnvironmentSetting: vi.fn(),
  saveEnvironmentSetting: vi.fn(),
}));

import { processPRD4Turn } from "@/services/prd4Orchestrator";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { toCharacterExecutionContext } from "@/services/characterIdentityGuard";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import {
  EvalRateLimitError,
  buildReferenceCandidateConfigs,
  isRateLimitError,
  parseSnapshotOverrides,
  runIsolatedEvalTurn,
  type EvalItem,
  type EvalLiveSnapshot,
} from "./evalJudgePipeline";
import { buildCompareConfigs, withRateLimitRetry } from "./evalJudgeRunner";
import { parseHeadlessEvalArgs } from "./evalJudgeHeadless";
import { formatCandidatePresents } from "./evalJudgeReport";
import { candidatePresentSnapshot, generateCandidatePresents } from "./evalSituationSummaryCandidate";

const live: EvalLiveSnapshot = {
  model: "openai/gpt-5.6-luna",
  temperature: 1.4,
  topP: 1,
  maxTokens: 360,
  ragTopK: 4,
  ragRetrieveK: 8,
  ragRerank: true,
  ragThreshold: 0.3,
  ragRerankModel: "rerank-2.5-lite",
  ragRerankTruncation: true,
  promptVariant: "optimized_v3",
};

const item = (character: string): EvalItem => ({
  id: character,
  notion_page_id: character,
  question: "Qu'est-ce qui s'est passé à la montagne ?",
  gold_answer: "",
  must_include: "",
  must_not: "",
  tone: "",
  max_length: 2,
  category: "emotion",
  active: true,
  character_name: character,
  sort_order: 1,
  judge_notes: "",
  synced_at: "2026-11-09T00:00:00Z",
  created_at: "2026-11-09T00:00:00Z",
  updated_at: "2026-11-09T00:00:00Z",
});

describe("lot P — snapshot levers", () => {
  it("reads a candidate PRÉSENT per character and a stream contract", () => {
    const { overrides, errors } = parseSnapshotOverrides(JSON.stringify({
      situationSummaries: { max: " Tu es dans le salon. ", emma: "Tu es dans la cuisine." },
      situationSummarySource: "v2_second_person",
      streamContract: "lived_v2",
    }));
    expect(errors).toEqual([]);
    expect(overrides).toEqual({
      situationSummaries: { max: "Tu es dans le salon.", emma: "Tu es dans la cuisine." },
      situationSummarySource: "v2_second_person",
      streamContract: "lived_v2",
    });
  });

  it("reports invalid levers instead of replacing them silently", () => {
    const { overrides, errors } = parseSnapshotOverrides(JSON.stringify({
      situationSummaries: { leo: "x", max: "", emma: "y".repeat(2_001) },
      streamContract: "v9",
    }));
    expect(overrides).toEqual({});
    expect(errors).toEqual([
      "streamContract inconnu : v9",
      "situationSummaries : personnage inconnu leo",
      "situationSummaries.max doit être un texte",
      "situationSummaries.emma dépasse 2000 caractères",
    ]);
    expect(parseSnapshotOverrides('{"situationSummaries":"texte"}').errors).toEqual(["situationSummaries doit être un objet { max, emma }"]);
  });

  it("labels the candidate side only, and keeps a témoin readable", () => {
    const [ref, cand] = buildReferenceCandidateConfigs(live, {}, {
      situationSummaries: { max: "Tu es dans le salon." },
      situationSummarySource: "v2_second_person",
    });
    expect(ref.label).toBe("référence (optimized_v3)");
    expect(ref.situationSummaries).toBeUndefined();
    expect(cand.label).toBe("candidat (optimized_v3 + PRÉSENT v2_second_person)");
    expect(cand.situationSummaries).toEqual({ max: "Tu es dans le salon." });

    const [, contract] = buildReferenceCandidateConfigs(live, {}, { streamContract: "lived_v2" });
    expect(contract.label).toBe("candidat (optimized_v3 + streamContract=lived_v2)");
    const [, witness] = buildReferenceCandidateConfigs(live, {}, {});
    expect(witness.label).toBe("candidat (optimized_v3) · témoin");
  });

  it("builds the same configurations from the CLI snapshot", () => {
    const { configs, errors } = buildCompareConfigs(
      live,
      { variant: "optimized_v3" },
      { variant: "optimized_v3", snapshotJson: JSON.stringify(candidatePresentSnapshot([
        { character: "max", name: "Max Lorenzo", stored: "s", candidate: "Tu es dans le salon.", model: "m" },
      ], "v2_second_person")) },
    );
    expect(errors).toEqual([]);
    expect(configs[1].situationSummaries).toEqual({ max: "Tu es dans le salon." });
    expect(configs[1].label).toContain("PRÉSENT v2_second_person");
  });

  it("parses --candidate-present and refuses an unknown version", () => {
    expect(parseHeadlessEvalArgs(["--candidate", "optimized_v3", "--candidate-present", "v2_second_person"]).options.candidatePresent).toBe("v2_second_person");
    expect(parseHeadlessEvalArgs(["--candidate", "optimized_v3"]).options.candidatePresent).toBeNull();
    expect(parseHeadlessEvalArgs(["--candidate", "optimized_v3", "--candidate-present", "v3"]).errors[0]).toMatch(/--candidate-present inconnu/);
  });
});

describe("lot P — isolated turn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands each character its own candidate PRÉSENT and the contract, in memory", async () => {
    vi.mocked(getCharacterRuntimeReadiness).mockResolvedValue({ ready: true } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue({ timeline: "Hier", situation_summary: "Stocké" } as never);
    vi.mocked(processPRD4Turn).mockResolvedValue({
      maxResponse: "…",
      ragMatches: 2,
      timings: { rag_ms: 1, max_ms: 1, total_ms: 2 },
      postTurnPromise: Promise.resolve({ execution_status: "executed", latency_ms: 1 }),
    } as never);
    const [ref, cand] = buildReferenceCandidateConfigs(live, {}, {
      situationSummaries: { max: "PRÉSENT MAX", emma: "PRÉSENT EMMA" },
      streamContract: "lived_v2",
    });

    vi.mocked(toCharacterExecutionContext).mockReturnValue({ characterKey: "emma", characterId: "e" } as never);
    await runIsolatedEvalTurn(item("Emma"), cand);
    vi.mocked(toCharacterExecutionContext).mockReturnValue({ characterKey: "max", characterId: "m" } as never);
    await runIsolatedEvalTurn(item("Max"), cand);
    await runIsolatedEvalTurn(item("Max"), ref);

    const overrides = vi.mocked(processPRD4Turn).mock.calls.map((call) => call[0].evaluationOverrides);
    expect(overrides[0]).toMatchObject({ situationSummary: "PRÉSENT EMMA", streamContract: "lived_v2" });
    expect(overrides[1]).toMatchObject({ situationSummary: "PRÉSENT MAX", streamContract: "lived_v2" });
    expect(overrides[2]?.situationSummary).toBeUndefined();
    expect(overrides[2]?.streamContract).toBeUndefined();
  });
});

describe("lot P — candidate PRÉSENT generation", () => {
  const timeline = "Aujourd'hui, à l'appartement\nSOUVENIR MAX aujourd'hui.01 / appartement / jour — L'appel attendu\n\nHier, jour 4\nSOUVENIR MAX J-1.08 / chalet / jour — Peter est tué par Agotha";

  it("generates once per character with the shared v2 prompt, and returns stored and candidate", async () => {
    const prompts: string[] = [];
    const presents = await generateCandidatePresents(["max", "emma"], "v2_second_person", {
      loadSources: async (character) => ({ name: character === "max" ? "Max Lorenzo" : "Emma Munz", timeline, identity: "55 ans", pageContent: "", stored: `stocké ${character}` }),
      generate: async (prompt) => {
        prompts.push(prompt);
        return { content: `  Tu es dans l'appartement (${prompts.length}).  `, model: "google/gemini-2.5-flash" };
      },
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain("Tu écris les REPÈRES DU PRÉSENT de Max Lorenzo");
    expect(prompts[0]).toContain("HIER, JOUR 4\n- chalet / jour — Peter est tué par Agotha");
    expect(presents.map((p) => [p.character, p.stored, p.candidate])).toEqual([
      ["max", "stocké max", "Tu es dans l'appartement (1)."],
      ["emma", "stocké emma", "Tu es dans l'appartement (2)."],
    ]);
    expect(candidatePresentSnapshot(presents, "v2_second_person")).toEqual({
      situationSummarySource: "v2_second_person",
      situationSummaries: { max: "Tu es dans l'appartement (1).", emma: "Tu es dans l'appartement (2)." },
    });
  });

  it("stops before any turn when a generation is empty or too long", async () => {
    const deps = (content: string) => ({
      loadSources: async () => ({ name: "Max", timeline, identity: "", pageContent: "", stored: "" }),
      generate: async () => ({ content, model: "m" }),
    });
    await expect(generateCandidatePresents(["max"], "v2_second_person", deps("  "))).rejects.toThrow(/vide/);
    await expect(generateCandidatePresents(["max"], "v2_second_person", deps("x".repeat(2_001)))).rejects.toThrow(/trop long/);
  });

  it("prints the in-memory PRÉSENT in the report", () => {
    const [, cand] = buildReferenceCandidateConfigs(live, {}, {
      situationSummaries: { max: "Tu es dans le salon.\nHier, Peter a été tué." },
      situationSummarySource: "v2_second_person",
    });
    const lines = formatCandidatePresents([cand]);
    expect(lines[0]).toBe("## PRÉSENT joué en mémoire — candidat (v2_second_person)");
    expect(lines).toContain("> Hier, Peter a été tué.");
    expect(formatCandidatePresents([{ ...cand, situationSummaries: undefined }])).toEqual([]);
  });
});

describe("lot P — rate limits never become a scored answer", () => {
  beforeEach(() => vi.clearAllMocks());

  const turnWith = (characterError: string | null) => ({
    maxResponse: "Réplique de secours.",
    characterError,
    ragMatches: 0,
    timings: { rag_ms: 1, max_ms: 1, total_ms: 2 },
    postTurnPromise: Promise.resolve({ execution_status: "executed", latency_ms: 1 }),
  });

  it("throws on a rate-limited character fallback and flags any other fallback", async () => {
    vi.mocked(getCharacterRuntimeReadiness).mockResolvedValue({ ready: true } as never);
    vi.mocked(toCharacterExecutionContext).mockReturnValue({ characterKey: "max", characterId: "m" } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue({ timeline: "", situation_summary: "" } as never);
    const [ref] = buildReferenceCandidateConfigs(live, {}, {});

    vi.mocked(processPRD4Turn).mockResolvedValue(turnWith('LLM error: 429 - {"error":"Rate limit exceeded"}') as never);
    await expect(runIsolatedEvalTurn(item("Max"), ref)).rejects.toBeInstanceOf(EvalRateLimitError);

    vi.mocked(processPRD4Turn).mockResolvedValue(turnWith("Character LLM response timed out") as never);
    const trace = await runIsolatedEvalTurn(item("Max"), ref);
    expect(trace.error).toBe("Personnage en repli : Character LLM response timed out");
  });

  it("waits and replays a 429, then gives up after the allowed attempts", async () => {
    const sleeps: number[] = [];
    const hooks = { rateLimitRetry: { attempts: 2, waitMs: 65_000, sleep: async (ms: number) => { sleeps.push(ms); } } };
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) throw new Error('LLM error: 429 - {"error":"Rate limit exceeded"}');
      return "ok";
    };
    await expect(withRateLimitRetry(flaky, new AbortController().signal, hooks)).resolves.toBe("ok");
    expect(sleeps).toEqual([65_000, 65_000]);

    const always = async () => { throw new Error("OpenRouter error: 429"); };
    await expect(withRateLimitRetry(always, new AbortController().signal, hooks)).rejects.toThrow(/429/);
    const other = vi.fn(async () => { throw new Error("JSON juge illisible"); });
    await expect(withRateLimitRetry(other, new AbortController().signal, hooks)).rejects.toThrow(/illisible/);
    expect(other).toHaveBeenCalledTimes(1);
    expect(isRateLimitError(new Error("Rate limit exceeded"))).toBe(true);
    expect(isRateLimitError("timeout")).toBe(false);
  });
});
