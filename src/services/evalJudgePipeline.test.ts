import { describe, expect, it } from "vitest";
import {
  EVAL_REPEATS,
  buildJudgePrompt,
  buildOfatConfigs,
  clampScore,
  defaultOfatSelection,
  estimateEvalRun,
  listEvalWorkItems,
  parseJudgeResponse,
  parseUsdPerMillion,
  rankConfigs,
  resultWorkKey,
  strongestFactor,
  type EvalItem,
  type EvalLiveSnapshot,
  type EvalTurnConfig,
} from "./evalJudgePipeline";

const live: EvalLiveSnapshot = {
  model: "google/gemini-2.5-flash",
  temperature: 0.8,
  topP: 0.9,
  maxTokens: 220,
  ragTopK: 3,
  ragRetrieveK: 8,
  ragRerank: true,
  ragThreshold: 0.3,
  ragRerankModel: "rerank-2.5-lite",
  ragRerankTruncation: true,
  promptVariant: "legacy",
};

function item(id: string, question: string): EvalItem {
  return {
    id,
    notion_page_id: id,
    question,
    gold_answer: "Je vis à Lausanne.",
    must_include: "Lausanne",
    must_not: "adresse exacte",
    tone: "retenu",
    max_length: 2,
    category: "factuel",
    active: true,
    character_name: "Max",
    sort_order: 1,
    judge_notes: "",
    synced_at: "2026-08-25T00:00:00Z",
    created_at: "2026-08-25T00:00:00Z",
    updated_at: "2026-08-25T00:00:00Z",
  };
}

describe("OFAT configs", () => {
  it("keeps the live baseline and varies one factor at a time", () => {
    const configs = buildOfatConfigs(live, {
      extraModels: ["openai/gpt-5-mini", "google/gemini-2.5-flash"],
      samplingTemps: [0, 0.8],
      ragVariants: [
        { key: "conservative", topK: 1, rerank: true },
        { key: "generous", topK: 8, rerank: true },
      ],
    });
    expect(configs[0]).toMatchObject({ factor: "baseline", model: live.model, temperature: 0.8, ragTopK: 3 });
    const models = configs.filter((config) => config.factor === "model");
    expect(models).toHaveLength(1);
    expect(models[0].model).toBe("openai/gpt-5-mini");
    expect(models[0].temperature).toBe(live.temperature);
    expect(models[0].ragTopK).toBe(live.ragTopK);
    const sampling = configs.filter((config) => config.factor === "sampling");
    expect(sampling).toHaveLength(1);
    expect(sampling[0].temperature).toBe(0);
    expect(sampling[0].model).toBe(live.model);
    const rag = configs.filter((config) => config.factor === "rag");
    expect(rag.map((config) => config.ragTopK).sort()).toEqual([1, 8]);
    expect(rag.every((config) => config.model === live.model && config.temperature === live.temperature)).toBe(true);
  });

  it("defaults extra models and RAG variants away from live", () => {
    const selection = defaultOfatSelection(live);
    expect(selection.extraModels).not.toContain(live.model);
    expect(selection.samplingTemps).toContain(0);
    expect(selection.samplingTemps).not.toContain(0.8);
    expect(selection.ragVariants.some((variant) => variant.key === "conservative")).toBe(true);
    expect(selection.ragVariants.some((variant) => variant.key === "generous")).toBe(true);
  });
});

describe("cost estimate", () => {
  it("multiplies items × configs × repeats × 4 LLM calls", () => {
    const configs = buildOfatConfigs(live, {
      extraModels: ["openai/gpt-5-mini"],
      samplingTemps: [0],
      ragVariants: [{ key: "generous", topK: 8, rerank: true }],
    });
    const estimate = estimateEvalRun(15, configs, EVAL_REPEATS);
    expect(configs).toHaveLength(4);
    expect(estimate.turns).toBe(15 * 4 * 3);
    expect(estimate.llmCalls).toBe(estimate.turns * 4);
    expect(estimate.estimatedCostUsd).toBeGreaterThan(0);
    expect(parseUsdPerMillion("$0.30")).toBe(0.3);
  });
});

describe("judge JSON", () => {
  it("extracts scores from noisy completions and clamps them", () => {
    const parsed = parseJudgeResponse(`Voici:\n{"gold_fidelity": 9, "must_include": 4, "must_not": 5, "tone": 3, "length_ok": true, "character_voice": 4, "overall": 12, "rationale": "Retenu et factuel."}\n`);
    expect(parsed.gold_fidelity).toBe(5);
    expect(parsed.overall).toBe(10);
    expect(parsed.length_ok).toBe(true);
    expect(parsed.rationale).toContain("Retenu");
    expect(clampScore("nope", 0, 5)).toBe(0);
  });

  it("builds a prompt that privileges the rubric over the gold text", () => {
    const prompt = buildJudgePrompt(item("1", "Où habites-tu ?"), "J'habite à Lausanne.");
    expect(prompt).toContain("MUST INCLUDE");
    expect(prompt).toContain("Ne récompense PAS le copier-coller");
    expect(prompt).toContain("J'habite à Lausanne.");
  });
});

describe("ranking", () => {
  it("reports mean, stddev, delta vs baseline and the strongest factor", () => {
    const ranked = rankConfigs([
      { config_label: "référence (live)", factor: "baseline", overall_score: 6 },
      { config_label: "référence (live)", factor: "baseline", overall_score: 8 },
      { config_label: "modèle: gpt-5-mini", factor: "model", overall_score: 9 },
      { config_label: "modèle: gpt-5-mini", factor: "model", overall_score: 9 },
      { config_label: "RAG: généreux (k=8)", factor: "rag", overall_score: 5 },
      { config_label: "sampling: temp 0", factor: "sampling", overall_score: 7 },
    ]);
    const baseline = ranked.find((row) => row.factor === "baseline");
    const model = ranked.find((row) => row.factor === "model");
    expect(baseline?.mean).toBe(7);
    expect(model?.delta).toBe(2);
    expect(ranked[0].label).toBe("modèle: gpt-5-mini");
    const strongest = strongestFactor(ranked);
    expect(strongest?.factor).toBe("model");
  });
});

describe("resume queue", () => {
  it("skips completed question × config × repeat triples", () => {
    const configs: EvalTurnConfig[] = [
      { ...live, label: "référence (live)", factor: "baseline" },
      { ...live, label: "modèle: x", factor: "model", model: "x" },
    ];
    const items = [item("a", "Q1"), item("b", "Q2")];
    const done = new Set([
      resultWorkKey({ config_label: "référence (live)", item_id: "a", repeat_index: 1 }),
    ]);
    const queue = listEvalWorkItems(configs, items, 2, done);
    expect(queue).toHaveLength(2 * 2 * 2 - 1);
    expect(queue.some((work) => work.key === "référence (live)::a::1")).toBe(false);
  });
});
