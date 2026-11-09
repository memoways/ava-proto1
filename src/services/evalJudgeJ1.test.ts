import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/prd4Orchestrator", () => ({ processPRD4Turn: vi.fn() }));
vi.mock("@/services/experienceOrchestration", () => ({ getCharacterRuntimeReadiness: vi.fn() }));
vi.mock("@/services/characterIdentityGuard", () => ({ toCharacterExecutionContext: vi.fn() }));
vi.mock("@/services/characterPromptService", () => ({ loadCharacterPrompt: vi.fn() }));
vi.mock("@/services/environmentContext", () => ({
  loadEnvironmentSetting: vi.fn(),
  saveEnvironmentSetting: vi.fn(),
}));

import { processPRD4Turn } from "@/services/prd4Orchestrator";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { toCharacterExecutionContext } from "@/services/characterIdentityGuard";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { loadEnvironmentSetting } from "@/services/environmentContext";
import {
  buildJudgeCanonReference,
  judgeTimelineExcerpt,
  buildJudgePrompt,
  buildReferenceCandidateConfigs,
  EVAL_DEFAULT_JUDGE_MODEL,
  estimateEvalRun,
  evalCharacterKey,
  listEvalJudgeModels,
  parseJudgeResponse,
  parseSnapshotOverrides,
  runIsolatedEvalTurn,
  type EvalItem,
  type EvalLiveSnapshot,
  type EvalResult,
} from "./evalJudgePipeline";
import {
  DEFAULT_SCORE_WEIGHTS,
  EVAL_SCORE_CRITERIA,
  analyseEvalResults,
  auditEvalCorpus,
  compareReferenceCandidate,
  describeCriterion,
  loadScoreWeights,
  readJudgeSubScores,
  scoreOfResult,
  weightedScore,
  type EvalScoreWeights,
} from "./evalJudgeScoring";

const live: EvalLiveSnapshot = {
  model: "google/gemini-2.5-flash",
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 220,
  ragTopK: 6,
  ragRetrieveK: 12,
  ragRerank: true,
  ragThreshold: 0.3,
  ragRerankModel: "rerank-2.5-lite",
  ragRerankTruncation: true,
  promptVariant: "optimized_v3",
};

function item(id: string, character: string, overrides: Partial<EvalItem> = {}): EvalItem {
  return {
    id,
    notion_page_id: id,
    question: `Question ${id}`,
    gold_answer: "Réponse visée.",
    must_include: "un fait",
    must_not: "méta",
    tone: "retenu",
    max_length: 2,
    category: "emotion",
    active: true,
    character_name: character,
    sort_order: 1,
    judge_notes: "",
    synced_at: "2026-11-09T00:00:00Z",
    created_at: "2026-11-09T00:00:00Z",
    updated_at: "2026-11-09T00:00:00Z",
    ...overrides,
  };
}

/** A judge_json as stored before J1: six criteria, no play criteria. */
const LEGACY_JUDGE = {
  gold_fidelity: 4,
  must_include: 3,
  must_not: 5,
  tone: 4,
  length_ok: true,
  character_voice: 2,
  overall: 7,
  rationale: "ancien format",
};

const J1_JUDGE = {
  ...LEGACY_JUDGE,
  speech_quality: { sounds_spoken: 4, no_therapeutic_language: 4, non_caricatural: 4, facts_understandable: 4, hope_without_cure: 4 },
  not_meta: 1,
  lived_impact: 2,
  canon_timeline: 5,
  distinct_voice: 3,
};

function result(id: string, factor: string, label: string, itemId: string, judge: Record<string, unknown>, repeat = 1): EvalResult {
  return {
    id,
    run_id: "run",
    item_id: itemId,
    config_label: label,
    factor,
    repeat_index: repeat,
    max_response: "…",
    judge_json: judge,
    overall_score: Number(judge.overall ?? 0),
    rag_matches: null,
    gm_brief: null,
    validator: null,
    latencies: { total_ms: 1000 },
    tokens: null,
    error_message: null,
    created_at: "2026-11-09T00:00:00Z",
  } as unknown as EvalResult;
}

describe("J1 judge grid — parser", () => {
  it("parses and clamps the four play criteria", () => {
    const parsed = parseJudgeResponse(JSON.stringify({ ...LEGACY_JUDGE, not_meta: 7, lived_impact: -2, canon_timeline: "4", distinct_voice: 3.5 }));
    expect(parsed).toMatchObject({ not_meta: 5, lived_impact: 0, canon_timeline: 4, distinct_voice: 3.5 });
  });

  it("leaves play criteria absent when the judge did not return them", () => {
    const parsed = parseJudgeResponse(JSON.stringify(LEGACY_JUDGE));
    expect(parsed.not_meta).toBeUndefined();
    expect(parsed.canon_timeline).toBeUndefined();
  });
});

describe("J1 judge grid — prompt", () => {
  it("names Emma, contrasts her with Max and asks for the four criteria", () => {
    const prompt = buildJudgePrompt(item("e1", "Emma"), "Je n'arrive plus à dormir.", "### Timeline\nJ−2 : hôtel.");
    expect(prompt).toContain("RÉPONSE DE EMMA");
    expect(prompt).toContain("on reconnaît Emma, pas Max");
    for (const key of ["not_meta", "lived_impact", "canon_timeline", "distinct_voice"]) {
      expect(prompt).toContain(`"${key}": 0-5`);
    }
    expect(prompt).toContain("J−2 : hôtel.");
    expect(prompt).not.toMatch(/On entend Max/);
  });

  it("names Max for a Max item and contrasts him with Emma", () => {
    const prompt = buildJudgePrompt(item("m1", "Max"), "…");
    expect(prompt).toContain("on reconnaît Max, pas Emma");
    expect(prompt).toContain("fiche non fournie");
  });

  it("builds a bounded read-only canon excerpt", () => {
    const canon = buildJudgeCanonReference({ situation_summary: "x".repeat(5000), timeline: "J−2 hôtel", maniere_de_parler: "" });
    expect(canon).toContain("### Situation présente");
    expect(canon).toContain("J−2 hôtel");
    expect(canon).not.toContain("Manière de parler");
    expect(canon.length).toBeLessThan(2100);
    expect(buildJudgeCanonReference(null)).toBe("");
  });

  it("describes criteria with the item's character instead of a hardcoded Max", () => {
    const voice = EVAL_SCORE_CRITERIA.find((criterion) => criterion.key === "character_voice")!;
    const distinct = EVAL_SCORE_CRITERIA.find((criterion) => criterion.key === "distinct_voice")!;
    expect(voice.description).not.toContain("Max");
    expect(describeCriterion(voice.description, "Emma Munz")).toContain("On entend Emma");
    expect(describeCriterion(distinct.description, "Max")).toBe("On reconnaît Max, pas Emma.");
    expect(describeCriterion(voice.description, null)).toContain("le personnage de la question");
    const notMeta = EVAL_SCORE_CRITERIA.find((criterion) => criterion.key === "not_meta")!;
    expect(describeCriterion(notMeta.description, null)).toMatch(/^Le personnage de la question vit/);
  });
});

describe("J1 judge canon excerpt", () => {
  it("keeps the recent days whole, period headings and Mona lines from the sandbox timeline", async () => {
    const { readFileSync } = await import("node:fs");
    const sheets = JSON.parse(readFileSync("src/agents/__fixtures__/speechSandbox20261109.json", "utf8")) as Array<{ timeline: string }>;
    for (const sheet of sheets) {
      const excerpt = judgeTimelineExcerpt(sheet.timeline);
      expect(excerpt.length).toBeLessThan(5_800);
      expect(excerpt).toContain("Hier, jour 4 à la montagne");
      expect(excerpt).toContain("Aujourd'hui, à l'appartement de Lausanne");
      expect(excerpt).toContain("est tué par Agotha");
      expect(excerpt).toContain("Il y a trois semaines");
      expect(excerpt).toMatch(/Mona.*camp|camp.*Mona|protogyne/);
    }
  });
});

describe("J1 judge grid — weights and backward compatibility", () => {
  it("weights the four play criteria and speech_quality by default", () => {
    for (const key of ["speech_quality", "not_meta", "lived_impact", "canon_timeline", "distinct_voice"] as const) {
      expect(DEFAULT_SCORE_WEIGHTS[key]).toBeGreaterThan(0);
      expect(EVAL_SCORE_CRITERIA.some((criterion) => criterion.key === key)).toBe(true);
    }
  });

  it("makes speech_quality count in the weighted score", () => {
    const sub = readJudgeSubScores(J1_JUDGE)!;
    expect(sub.speech_quality).toBe(4);
    const zeroWeights = Object.fromEntries(Object.keys(DEFAULT_SCORE_WEIGHTS).map((key) => [key, 0])) as unknown as EvalScoreWeights;
    expect(weightedScore(sub, { ...zeroWeights, speech_quality: 1 })).toBe(8);
  });

  it("penalises a meta answer that lists facts without impact", () => {
    const good = readJudgeSubScores({ ...J1_JUDGE, not_meta: 5, lived_impact: 5 })!;
    const meta = readJudgeSubScores(J1_JUDGE)!;
    expect(weightedScore(meta, DEFAULT_SCORE_WEIGHTS)).toBeLessThan(weightedScore(good, DEFAULT_SCORE_WEIGHTS) - 1.5);
  });

  it("scores results stored before J1 on their own criteria, without a silent zero", () => {
    const sub = readJudgeSubScores(LEGACY_JUDGE)!;
    expect(sub.not_meta).toBeNull();
    expect(sub.speech_quality).toBeNull();
    // Old formula: the six historical criteria only.
    const old = { gold_fidelity: 1, must_include: 2, must_not: 3, tone: 1.5, length: 1, character_voice: 2.5 };
    const expected = ((1 * 4 + 2 * 3 + 3 * 5 + 1.5 * 4 + 1 * 5 + 2.5 * 2) / 5 / 11) * 10;
    expect(weightedScore(sub, { ...DEFAULT_SCORE_WEIGHTS, ...old })).toBeCloseTo(expected, 2);
    expect(scoreOfResult(result("r", "baseline", "ref", "i", LEGACY_JUDGE), DEFAULT_SCORE_WEIGHTS)).toBeGreaterThan(0);
    const analysis = analyseEvalResults({
      results: [result("r", "baseline", "ref", "i", LEGACY_JUDGE)],
      items: [item("i", "Max")],
      configs: [],
      weights: DEFAULT_SCORE_WEIGHTS,
    });
    expect(analysis.byCriterion.map((row) => row.key)).not.toContain("not_meta");
  });

  it("fills weights saved before J1 with the new defaults", async () => {
    vi.mocked(loadEnvironmentSetting).mockResolvedValueOnce({ gold_fidelity: 0.5, must_include: 2, must_not: 3, tone: 1, length: 1, character_voice: 4 });
    const weights = await loadScoreWeights();
    expect(weights.character_voice).toBe(4);
    expect(weights.gold_fidelity).toBe(0.5);
    expect(weights.not_meta).toBe(DEFAULT_SCORE_WEIGHTS.not_meta);
    expect(weights.canon_timeline).toBe(DEFAULT_SCORE_WEIGHTS.canon_timeline);
  });
});

describe("J1 cost estimate", () => {
  it("prices the judge as measured on the sandbox run (126 turns ≈ $2.10)", () => {
    const configs = buildReferenceCandidateConfigs({ ...live, model: "openai/gpt-5.6-luna" }, {}, { promptVariant: "rich_v2" });
    const estimate = estimateEvalRun(21, configs, 3);
    expect(estimate.turns).toBe(126);
    expect(estimate.estimatedCostUsd).toBeGreaterThan(1.9);
    expect(estimate.estimatedCostUsd).toBeLessThan(2.3);
    expect(estimateEvalRun(21, configs, 3, "openai/gpt-5-mini").estimatedCostUsd).toBeLessThan(estimate.estimatedCostUsd);
  });
});

describe("J1 judge model", () => {
  it("defaults to a judge still served by OpenRouter and offers it first", () => {
    expect(EVAL_DEFAULT_JUDGE_MODEL).not.toBe("anthropic/claude-sonnet-4");
    const models = listEvalJudgeModels();
    expect(models[0].id).toBe(EVAL_DEFAULT_JUDGE_MODEL);
    expect(new Set(models.map((model) => model.id)).size).toBe(models.length);
  });
});

describe("J1 characters", () => {
  it("recognises Max and Emma and rejects anything else in the corpus audit", () => {
    expect(evalCharacterKey("Emma Munz")).toBe("emma");
    expect(evalCharacterKey("max")).toBe("max");
    expect(evalCharacterKey("Ava")).toBeNull();
    const audit = auditEvalCorpus([item("a", "Ava")]);
    expect(audit.issues[0].level).toBe("error");
    expect(audit.issues[0].messages.join(" ")).toContain("Max ou Emma");
  });

  beforeEach(() => vi.clearAllMocks());

  it("replays an Emma item with Emma's context and the in-memory prompt variant", async () => {
    const emmaContext = { characterKey: "emma", characterId: "emma-id", displayName: "Emma Munz" };
    vi.mocked(getCharacterRuntimeReadiness).mockResolvedValue({ ready: true } as never);
    vi.mocked(toCharacterExecutionContext).mockReturnValue(emmaContext as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue({ timeline: "J−2 hôtel", situation_summary: "Appartement" } as never);
    vi.mocked(processPRD4Turn).mockResolvedValue({
      maxResponse: "Je n'arrive plus à dormir.",
      ragMatches: 3,
      timings: { rag_ms: 10, max_ms: 20, total_ms: 30 },
      postTurnPromise: Promise.resolve({ execution_status: "executed", latency_ms: 5 }),
    } as never);

    const [, candidate] = buildReferenceCandidateConfigs(live, {}, { promptVariant: "rich_v2" });
    const trace = await runIsolatedEvalTurn(item("e", "Emma"), candidate);

    expect(getCharacterRuntimeReadiness).toHaveBeenCalledWith("emma");
    const call = vi.mocked(processPRD4Turn).mock.calls[0][0];
    expect(call.characterContext).toBe(emmaContext);
    expect(call.evaluationOverrides?.promptVariant).toBe("rich_v2");
    expect(call.evaluationOverrides?.featureKey).toBe("llm_as_judge");
    // rich_v2 keeps the configured top-k; optimized_v3 widens it like the live turn.
    expect(call.evaluationOverrides?.ragTopK).toBe(6);
    vi.mocked(processPRD4Turn).mockClear();
    await runIsolatedEvalTurn(item("e", "Emma"), { ...candidate, promptVariant: "optimized_v3", ragTopK: 4, ragRetrieveK: 5 });
    expect(vi.mocked(processPRD4Turn).mock.calls[0][0].evaluationOverrides).toMatchObject({ ragTopK: 6, ragRetrieveK: 6 });
    vi.mocked(processPRD4Turn).mockClear();
    await runIsolatedEvalTurn(item("e", "Emma"), { ...candidate, promptVariant: "rich_v2", ragTopK: 4 });
    expect(vi.mocked(processPRD4Turn).mock.calls[0][0].evaluationOverrides?.ragTopK).toBe(4);
    expect(trace.canonReference).toContain("J−2 hôtel");
  });

  it("refuses an item without a known character", async () => {
    await expect(runIsolatedEvalTurn(item("x", ""), { ...live, label: "ref", factor: "baseline" })).rejects.toThrow(/No character/);
  });
});

describe("J1 reference vs candidate", () => {
  it("builds exactly a reference and a candidate from the live snapshot", () => {
    const configs = buildReferenceCandidateConfigs(live, {}, { promptVariant: "rich_v2", temperature: 0.5 });
    expect(configs).toHaveLength(2);
    expect(configs[0]).toMatchObject({ factor: "baseline", promptVariant: "optimized_v3", temperature: 0.8 });
    expect(configs[1]).toMatchObject({ factor: "candidate", promptVariant: "rich_v2", temperature: 0.5, model: live.model });
    expect(configs[0].label).toBe("référence (optimized_v3)");
    expect(configs[1].label).toBe("candidat (rich_v2 + temperature=0.5)");
    expect(new Set(configs.map((config) => config.label)).size).toBe(2);
  });

  it("keeps labels distinct when both sides are identical (A/A control)", () => {
    const configs = buildReferenceCandidateConfigs(live, {}, {});
    expect(configs[0].label).not.toBe(configs[1].label);
  });

  it("parses a pasted settings snapshot and reports invalid values", () => {
    expect(parseSnapshotOverrides("")).toEqual({ overrides: {}, errors: [] });
    expect(parseSnapshotOverrides('{"promptVariant":"rich_v2","ragTopK":8,"ragRerank":false,"unknown":1}').overrides)
      .toEqual({ promptVariant: "rich_v2", ragTopK: 8, ragRerank: false });
    expect(parseSnapshotOverrides('{"promptVariant":"v9"}').errors[0]).toContain("v9");
    expect(parseSnapshotOverrides('{"temperature":-1}').errors).toHaveLength(1);
    expect(parseSnapshotOverrides("{oops").errors).toEqual(["JSON illisible"]);
    expect(parseSnapshotOverrides("[1]").errors).toHaveLength(1);
  });

  it("reports Δ per criterion, per item and per character", () => {
    const ref = "référence (optimized_v3)";
    const cand = "candidat (rich_v2)";
    const results = [
      result("1", "baseline", ref, "m", J1_JUDGE),
      result("2", "baseline", ref, "e", J1_JUDGE),
      result("3", "candidate", cand, "m", { ...J1_JUDGE, not_meta: 5, lived_impact: 4 }),
      result("4", "candidate", cand, "e", J1_JUDGE),
    ];
    const comparison = compareReferenceCandidate({
      results,
      items: [item("m", "Max"), item("e", "Emma")],
      weights: DEFAULT_SCORE_WEIGHTS,
    })!;
    expect(comparison.referenceLabel).toBe(ref);
    expect(comparison.overall.delta).toBeGreaterThan(0);
    expect(comparison.byCriterion.find((row) => row.key === "not_meta")).toMatchObject({ reference: 1, candidate: 3, delta: 2 });
    expect(comparison.byCriterion.find((row) => row.key === "canon_timeline")?.delta).toBe(0);
    const max = comparison.byItem.find((row) => row.itemId === "m")!;
    expect(max.character).toBe("Max");
    expect(max.criteria).toContainEqual({ key: "not_meta", delta: 4 });
    expect(max.criteria).toContainEqual({ key: "lived_impact", delta: 2 });
    expect(comparison.byItem.find((row) => row.itemId === "e")?.delta).toBe(0);
    expect(comparison.byCharacter.map((row) => row.character).sort()).toEqual(["Emma", "Max"]);
    expect(comparison.verdict.level).toBe("good");
    expect(comparison.overall).toMatchObject({ itemsBetter: 1, itemsWorse: 0, repeatSpread: 0 });
    expect(comparison.verdict.text).toContain("1 question(s) en hausse, 0 en baisse");
  });

  it("measures noise between repeats of one question, not between questions", () => {
    const ref = "référence (optimized_v3)";
    const cand = "candidat (rich_v2)";
    const low = { ...J1_JUDGE, gold_fidelity: 0, must_include: 0, must_not: 0, tone: 0, character_voice: 0, length_ok: false, not_meta: 0, lived_impact: 0, canon_timeline: 0, distinct_voice: 0, speech_quality: undefined };
    const high = { ...J1_JUDGE, gold_fidelity: 5, must_include: 5, must_not: 5, tone: 5, character_voice: 5, not_meta: 5, lived_impact: 5, canon_timeline: 5, distinct_voice: 5, speech_quality: undefined };
    // Item "a" always scores low, item "b" always high: large spread between questions, none between repeats.
    const results = [1, 2, 3].flatMap((repeat) => [
      result(`ra${repeat}`, "baseline", ref, "a", low, repeat),
      result(`rb${repeat}`, "baseline", ref, "b", high, repeat),
      result(`ca${repeat}`, "candidate", cand, "a", low, repeat),
      result(`cb${repeat}`, "candidate", cand, "b", high, repeat),
    ]);
    const comparison = compareReferenceCandidate({ results, items: [item("a", "Max"), item("b", "Emma")], weights: DEFAULT_SCORE_WEIGHTS })!;
    expect(comparison.overall.repeatSpread).toBe(0);
    expect(comparison.verdict.text).not.toMatch(/varient trop/);
    expect(comparison.verdict.text).toContain("ne change rien");
    const analysis = analyseEvalResults({ results, items: [item("a", "Max"), item("b", "Emma")], configs: [], weights: DEFAULT_SCORE_WEIGHTS });
    expect(analysis.ranked.every((row) => row.reliable && row.stddev === 0)).toBe(true);
  });

  it("returns null for a one-factor-at-a-time run", () => {
    expect(compareReferenceCandidate({
      results: [result("1", "baseline", "référence (live)", "m", J1_JUDGE), result("2", "model", "modèle: x", "m", J1_JUDGE)],
      items: [item("m", "Max")],
      weights: DEFAULT_SCORE_WEIGHTS,
    })).toBeNull();
  });
});
