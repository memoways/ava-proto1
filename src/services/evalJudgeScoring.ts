import type { EvalItem, EvalResult, EvalTurnConfig, EvalJudgeScore, EvalFactor } from "@/services/evalJudgePipeline";
import { mean, median, stddev, parseUsdPerMillion } from "@/services/evalJudgePipeline";
import { listLlmConfigModels } from "@/services/settingsService";
import { loadEnvironmentSetting, saveEnvironmentSetting } from "@/services/environmentContext";

export const EVAL_SCORE_WEIGHTS_KEY = "ava_eval_score_weights";

export interface EvalScoreWeights {
  gold_fidelity: number;
  must_include: number;
  must_not: number;
  tone: number;
  length: number;
  character_voice: number;
}

export const DEFAULT_SCORE_WEIGHTS: EvalScoreWeights = {
  gold_fidelity: 1,
  must_include: 2,
  must_not: 3,
  tone: 1.5,
  length: 1,
  character_voice: 2.5,
};

export const EVAL_SCORE_CRITERIA: Array<{
  key: keyof EvalScoreWeights;
  label: string;
  description: string;
}> = [
  {
    key: "gold_fidelity",
    label: "Fidélité à la réponse visée",
    description: "La réponse dit la même chose que l'exemple écrit dans Notion, sans le recopier.",
  },
  {
    key: "must_include",
    label: "Éléments exigés",
    description: "Les faits ou comportements listés dans « Must include » sont bien présents.",
  },
  {
    key: "must_not",
    label: "Interdits respectés",
    description: "Aucun spoiler, aucun déballage de lore, jamais hors personnage.",
  },
  {
    key: "tone",
    label: "Ton",
    description: "Le registre correspond au ton demandé (retenu, ouvert, défilé, factuel).",
  },
  {
    key: "length",
    label: "Longueur",
    description: "La réponse tient dans le nombre de phrases visé, comme à l'oral.",
  },
  {
    key: "character_voice",
    label: "Voix du personnage",
    description: "On entend Max, pas un assistant : hésitations, pudeur, façon de parler.",
  },
];

export async function loadScoreWeights(): Promise<EvalScoreWeights> {
  const stored = await loadEnvironmentSetting<EvalScoreWeights>(EVAL_SCORE_WEIGHTS_KEY, DEFAULT_SCORE_WEIGHTS);
  const safe = { ...DEFAULT_SCORE_WEIGHTS };
  for (const criterion of EVAL_SCORE_CRITERIA) {
    const value = Number(stored?.[criterion.key]);
    if (Number.isFinite(value) && value >= 0) safe[criterion.key] = value;
  }
  return safe;
}

export async function saveScoreWeights(weights: EvalScoreWeights): Promise<void> {
  await saveEnvironmentSetting(EVAL_SCORE_WEIGHTS_KEY, weights);
}

export type JudgeSubScores = Pick<
  EvalJudgeScore,
  "gold_fidelity" | "must_include" | "must_not" | "tone" | "character_voice" | "length_ok"
>;

export function readJudgeSubScores(raw: unknown): JudgeSubScores | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const num = (key: string) => {
    const parsed = Number(value[key]);
    return Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : null;
  };
  const gold = num("gold_fidelity");
  if (gold === null) return null;
  return {
    gold_fidelity: gold,
    must_include: num("must_include") ?? 0,
    must_not: num("must_not") ?? 0,
    tone: num("tone") ?? 0,
    character_voice: num("character_voice") ?? 0,
    length_ok: value.length_ok === true || value.length_ok === "true",
  };
}

/** Note pondérée sur 10, recalculée depuis les six sous-notes du juge. */
export function weightedScore(judge: JudgeSubScores, weights: EvalScoreWeights): number {
  const parts: Array<[keyof EvalScoreWeights, number]> = [
    ["gold_fidelity", judge.gold_fidelity],
    ["must_include", judge.must_include],
    ["must_not", judge.must_not],
    ["tone", judge.tone],
    ["length", judge.length_ok ? 5 : 0],
    ["character_voice", judge.character_voice],
  ];
  let weighted = 0;
  let total = 0;
  for (const [key, score] of parts) {
    const weight = weights[key] ?? 0;
    weighted += weight * (score / 5);
    total += weight;
  }
  if (total <= 0) return 0;
  return Number(((weighted / total) * 10).toFixed(3));
}

export function scoreOfResult(row: EvalResult, weights: EvalScoreWeights): number | null {
  const sub = readJudgeSubScores(row.judge_json);
  if (sub) return weightedScore(sub, weights);
  return typeof row.overall_score === "number" ? row.overall_score : null;
}

// ---------------------------------------------------------------- corpus audit

export type CorpusIssueLevel = "ok" | "warn" | "error";

export interface CorpusIssue {
  itemId: string;
  question: string;
  level: CorpusIssueLevel;
  messages: string[];
}

export interface CorpusAudit {
  total: number;
  active: number;
  usable: number;
  issues: CorpusIssue[];
  byCategory: Array<{ category: string; count: number }>;
  missingCategories: string[];
  blockers: string[];
  readyToRun: boolean;
}

export const EVAL_CATEGORIES = ["factuel", "piege", "emotion", "lore"] as const;
export const EVAL_MIN_ITEMS = 5;

export function auditEvalCorpus(items: EvalItem[]): CorpusAudit {
  const active = items.filter((item) => item.active);
  const issues: CorpusIssue[] = [];

  for (const item of active) {
    const messages: string[] = [];
    let level: CorpusIssueLevel = "ok";
    if (!item.question.trim()) {
      messages.push("Question vide : la ligne ne peut pas être testée.");
      level = "error";
    }
    if (!item.gold_answer.trim()) {
      messages.push("Aucune réponse visée : le juge n'a pas de repère de contenu.");
      level = "error";
    }
    if (!item.must_include.trim()) {
      messages.push("Aucun « Must include » : le juge ne peut pas vérifier les faits attendus.");
      level = "error";
    }
    if (!item.must_not.trim()) {
      messages.push("Aucun « Must not » : les interdits ne seront pas contrôlés.");
      if (level === "ok") level = "warn";
    }
    if (!item.tone) {
      messages.push("Ton non renseigné : le juge appliquera « retenu » par défaut.");
      if (level === "ok") level = "warn";
    }
    if (!item.category) {
      messages.push("Catégorie absente : impossible de savoir si le lore ou les pièges faiblissent.");
      if (level === "ok") level = "warn";
    }
    if (item.max_length == null) {
      messages.push("Longueur max absente : la note de longueur retombe sur 1-2 phrases.");
      if (level === "ok") level = "warn";
    }
    issues.push({ itemId: item.id, question: item.question || "(sans titre)", level, messages });
  }

  const usable = issues.filter((issue) => issue.level !== "error").length;

  const counts = new Map<string, number>();
  for (const item of active) {
    const key = item.category || "(sans catégorie)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const byCategory = [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
  const missingCategories = EVAL_CATEGORIES.filter((category) => !counts.get(category));

  const blockers: string[] = [];
  if (active.length === 0) {
    blockers.push("Aucune question active : remplis la base Notion puis synchronise.");
  } else if (usable < EVAL_MIN_ITEMS) {
    blockers.push(
      `Il faut au moins ${EVAL_MIN_ITEMS} questions complètes pour lancer un test (actuellement ${usable}).`,
    );
  }

  return {
    total: items.length,
    active: active.length,
    usable,
    issues,
    byCategory,
    missingCategories,
    blockers,
    readyToRun: blockers.length === 0,
  };
}

// ------------------------------------------------------------------- analysis

export interface RankedConfigScore {
  label: string;
  factor: EvalFactor;
  n: number;
  mean: number;
  stddev: number;
  delta: number;
  medianLatencyMs: number | null;
  costPerMillion: number | null;
  reliable: boolean;
}

export interface EvalRecommendation {
  level: "good" | "neutral" | "warn";
  text: string;
  where?: string;
}

export interface EvalAnalysis {
  ranked: RankedConfigScore[];
  byCriterion: Array<{ key: keyof EvalScoreWeights; label: string; mean: number; n: number }>;
  byCategory: Array<{ category: string; mean: number; n: number }>;
  recommendations: EvalRecommendation[];
}

const NOISE_THRESHOLD = 0.15;
const MEANINGFUL_DELTA = 0.3;
const UNSTABLE_STDDEV = 1.5;

function pageForFactor(factor: EvalFactor): string {
  if (factor === "rag") return "Technique → RAG Config";
  if (factor === "model" || factor === "sampling") return "Technique → LLM Config";
  return "Technique → LLM Config";
}

function modelCostPerMillion(modelId: string | undefined): number | null {
  if (!modelId) return null;
  const catalog = listLlmConfigModels().find((model) => model.id === modelId);
  if (!catalog) return null;
  return parseUsdPerMillion(catalog.costInput) + parseUsdPerMillion(catalog.costOutput);
}

export function analyseEvalResults(input: {
  results: EvalResult[];
  items: EvalItem[];
  configs: EvalTurnConfig[];
  weights: EvalScoreWeights;
}): EvalAnalysis {
  const { results, items, configs, weights } = input;
  const configByLabel = new Map(configs.map((config) => [config.label, config]));
  const itemById = new Map(items.map((item) => [item.id, item]));

  const groups = new Map<string, { factor: EvalFactor; scores: number[]; latencies: number[] }>();
  const criterionScores = new Map<keyof EvalScoreWeights, number[]>();
  const categoryScores = new Map<string, number[]>();

  for (const row of results) {
    const score = scoreOfResult(row, weights);
    if (score === null) continue;
    const group = groups.get(row.config_label) ?? {
      factor: (row.factor as EvalFactor) || "baseline",
      scores: [],
      latencies: [],
    };
    group.scores.push(score);
    const latencies = row.latencies as { total_ms?: number } | null;
    if (latencies && typeof latencies.total_ms === "number") group.latencies.push(latencies.total_ms);
    groups.set(row.config_label, group);

    const sub = readJudgeSubScores(row.judge_json);
    if (sub) {
      const pairs: Array<[keyof EvalScoreWeights, number]> = [
        ["gold_fidelity", sub.gold_fidelity],
        ["must_include", sub.must_include],
        ["must_not", sub.must_not],
        ["tone", sub.tone],
        ["length", sub.length_ok ? 5 : 0],
        ["character_voice", sub.character_voice],
      ];
      for (const [key, value] of pairs) {
        criterionScores.set(key, [...(criterionScores.get(key) ?? []), value]);
      }
    }

    const category = itemById.get(row.item_id)?.category || "(sans catégorie)";
    categoryScores.set(category, [...(categoryScores.get(category) ?? []), score]);
  }

  const baselineEntry = [...groups.entries()].find(([, group]) => group.factor === "baseline");
  const baselineMean = baselineEntry ? mean(baselineEntry[1].scores) : 0;
  const baselineCost = modelCostPerMillion(
    configs.find((config) => config.factor === "baseline")?.model,
  );

  const ranked: RankedConfigScore[] = [...groups.entries()]
    .map(([label, group]) => {
      const spread = stddev(group.scores);
      return {
        label,
        factor: group.factor,
        n: group.scores.length,
        mean: Number(mean(group.scores).toFixed(3)),
        stddev: Number(spread.toFixed(3)),
        delta: Number((mean(group.scores) - baselineMean).toFixed(3)),
        medianLatencyMs: median(group.latencies),
        costPerMillion: modelCostPerMillion(configByLabel.get(label)?.model),
        reliable: spread <= UNSTABLE_STDDEV,
      };
    })
    .sort((a, b) => b.mean - a.mean);

  const byCriterion = EVAL_SCORE_CRITERIA.map((criterion) => {
    const values = criterionScores.get(criterion.key) ?? [];
    return {
      key: criterion.key,
      label: criterion.label,
      mean: Number(mean(values).toFixed(2)),
      n: values.length,
    };
  }).filter((row) => row.n > 0);

  const byCategory = [...categoryScores.entries()]
    .map(([category, values]) => ({
      category,
      mean: Number(mean(values).toFixed(2)),
      n: values.length,
    }))
    .sort((a, b) => a.mean - b.mean);

  const recommendations: EvalRecommendation[] = [];

  for (const row of ranked) {
    if (row.factor === "baseline") continue;
    const where = pageForFactor(row.factor);
    if (!row.reliable) {
      recommendations.push({
        level: "warn",
        text: `« ${row.label} » varie trop entre les 3 passages (± ${row.stddev.toFixed(2)}) : résultat non concluant, à relancer avant toute décision.`,
        where,
      });
      continue;
    }
    if (Math.abs(row.delta) < NOISE_THRESHOLD) {
      recommendations.push({
        level: "neutral",
        text: `« ${row.label} » ne change rien (${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)}, dans le bruit) : garder la configuration actuelle.`,
        where,
      });
      continue;
    }
    if (row.delta <= -MEANINGFUL_DELTA) {
      recommendations.push({
        level: "warn",
        text: `« ${row.label} » fait perdre ${Math.abs(row.delta).toFixed(2)} point : à écarter.`,
        where,
      });
      continue;
    }
    if (row.delta >= MEANINGFUL_DELTA) {
      let costNote = "sans surcoût";
      if (row.costPerMillion != null && baselineCost != null && baselineCost > 0) {
        const ratio = row.costPerMillion / baselineCost;
        if (ratio >= 1.5) costNote = `mais coûte ${ratio.toFixed(1)}× plus cher`;
        else if (ratio <= 0.7) costNote = `et coûte ${(1 / ratio).toFixed(1)}× moins cher`;
      }
      const priority = costNote.startsWith("mais") ? "à arbitrer" : "recommandé";
      recommendations.push({
        level: costNote.startsWith("mais") ? "neutral" : "good",
        text: `« ${row.label} » gagne ${row.delta.toFixed(2)} point ${costNote} : ${priority}.`,
        where,
      });
      continue;
    }
    recommendations.push({
      level: "neutral",
      text: `« ${row.label} » gagne ${row.delta.toFixed(2)} point : gain trop faible pour changer quoi que ce soit.`,
      where,
    });
  }

  const weakestCriterion = [...byCriterion].sort((a, b) => a.mean - b.mean)[0];
  if (weakestCriterion && weakestCriterion.mean < 3.5) {
    recommendations.push({
      level: "warn",
      text: `Critère le plus faible : ${weakestCriterion.label} (${weakestCriterion.mean}/5). C'est là que le prompt de Max doit être renforcé.`,
      where: "Expérience → Réglages personnages",
    });
  }

  const weakestCategory = byCategory.find((row) => row.n >= 3 && row.mean < 6);
  if (weakestCategory) {
    recommendations.push({
      level: "warn",
      text: `Les questions « ${weakestCategory.category} » sont les moins bien traitées (${weakestCategory.mean}/10) : ajoute des consignes explicites pour ce type de relance.`,
      where: "Expérience → Réglages personnages",
    });
  }

  if (ranked.length > 0 && recommendations.length === 0) {
    recommendations.push({
      level: "good",
      text: "Aucune variante ne bat la configuration actuelle de manière fiable : garde les réglages en place.",
    });
  }

  return { ranked, byCriterion, byCategory, recommendations };
}
