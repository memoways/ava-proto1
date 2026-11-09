import type { EvalItem, EvalResult, EvalTurnConfig, EvalJudgeScore, EvalFactor } from "@/services/evalJudgePipeline";
import { evalCharacterKey, mean, median, stddev, parseUsdPerMillion, PLAY_CRITERIA_KEYS, SPEECH_QUALITY_KEYS } from "@/services/evalJudgePipeline";
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
  speech_quality: number;
  not_meta: number;
  lived_impact: number;
  canon_timeline: number;
  distinct_voice: number;
}

/**
 * J1 weights: the play criteria (meta, lived impact, canon) weigh as much as
 * the editorial interdicts, because they carry the defect Ulrich hears.
 */
export const DEFAULT_SCORE_WEIGHTS: EvalScoreWeights = {
  gold_fidelity: 1,
  must_include: 2,
  must_not: 3,
  tone: 1.5,
  length: 1,
  character_voice: 2,
  speech_quality: 1.5,
  not_meta: 2.5,
  lived_impact: 2.5,
  canon_timeline: 3,
  distinct_voice: 1.5,
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
    description: "On entend {personnage}, pas un assistant : hésitations, pudeur, façon de parler.",
  },
  {
    key: "speech_quality",
    label: "Parole incarnée",
    description: "Moyenne des cinq sous-critères : parlé, sans jargon thérapeutique, sans caricature, faits compréhensibles, espoir sans guérison.",
  },
  {
    key: "not_meta",
    label: "Pas méta",
    description: "{personnage} vit la situation ; il n'explique pas l'histoire comme un narrateur.",
  },
  {
    key: "lived_impact",
    label: "Impact vécu",
    description: "Les faits passent par ce qu'ils font à sa vie et à sa famille, pas par une énumération.",
  },
  {
    key: "canon_timeline",
    label: "Canon et timeline",
    description: "Rien ne contredit la fiche, la timeline ou le présent (souvenir J−2 de l'hôtel ≠ appartement).",
  },
  {
    key: "distinct_voice",
    label: "Voix distincte",
    description: "On reconnaît {personnage}, pas {autre}.",
  },
];

/** Fills {personnage} / {autre} with the item's character (Max or Emma). */
export function describeCriterion(description: string, characterName?: string | null): string {
  const name = characterName?.trim().split(/\s+/)[0] || "";
  const lower = name.toLocaleLowerCase("fr");
  const other = lower === "max" ? "Emma" : lower === "emma" ? "Max" : "l'autre personnage";
  const filled = description
    .replace(/\{personnage\}/g, name || "le personnage de la question")
    .replace(/\{autre\}/g, other);
  return filled.charAt(0).toLocaleUpperCase("fr") + filled.slice(1);
}

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

/**
 * Sub-scores read back from judge_json. Criteria added after a result was
 * stored are null and excluded from its weighted score (no silent zero).
 */
export type JudgeSubScores = Pick<
  EvalJudgeScore,
  "gold_fidelity" | "must_include" | "must_not" | "tone" | "character_voice" | "length_ok"
> & {
  speech_quality?: number | null;
  not_meta?: number | null;
  lived_impact?: number | null;
  canon_timeline?: number | null;
  distinct_voice?: number | null;
};

export function readJudgeSubScores(raw: unknown): JudgeSubScores | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const num = (key: string) => {
    const parsed = Number(value[key]);
    return Number.isFinite(parsed) ? Math.min(5, Math.max(0, parsed)) : null;
  };
  const gold = num("gold_fidelity");
  if (gold === null) return null;
  const speech = value.speech_quality && typeof value.speech_quality === "object"
    ? SPEECH_QUALITY_KEYS
      .map((key) => Number((value.speech_quality as Record<string, unknown>)[key]))
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.min(5, Math.max(0, n)))
    : [];
  const play = Object.fromEntries(PLAY_CRITERIA_KEYS.map((key) => [key, value[key] == null ? null : num(key)]));
  return {
    ...play,
    speech_quality: speech.length ? Number(mean(speech).toFixed(3)) : null,
    gold_fidelity: gold,
    must_include: num("must_include") ?? 0,
    must_not: num("must_not") ?? 0,
    tone: num("tone") ?? 0,
    character_voice: num("character_voice") ?? 0,
    length_ok: value.length_ok === true || value.length_ok === "true",
  };
}

/** Criterion → 0-5 value, null when the judge did not provide it. */
export function criterionValues(judge: JudgeSubScores): Array<[keyof EvalScoreWeights, number | null]> {
  return [
    ["gold_fidelity", judge.gold_fidelity],
    ["must_include", judge.must_include],
    ["must_not", judge.must_not],
    ["tone", judge.tone],
    ["length", judge.length_ok ? 5 : 0],
    ["character_voice", judge.character_voice],
    ["speech_quality", judge.speech_quality ?? null],
    ["not_meta", judge.not_meta ?? null],
    ["lived_impact", judge.lived_impact ?? null],
    ["canon_timeline", judge.canon_timeline ?? null],
    ["distinct_voice", judge.distinct_voice ?? null],
  ];
}

/**
 * Note pondérée sur 10. Les critères absents (résultats antérieurs à J1)
 * sortent du dénominateur : un ancien run garde sa note sur six critères.
 */
export function weightedScore(judge: JudgeSubScores, weights: EvalScoreWeights): number {
  const parts = criterionValues(judge).filter((part): part is [keyof EvalScoreWeights, number] => part[1] !== null);
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
    if (!evalCharacterKey(item.character_name)) {
      messages.push(`Personnage « ${item.character_name || "vide"} » inconnu : choisir Max ou Emma dans Notion.`);
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

/**
 * Noise of a configuration: mean spread between the repeats of the same
 * question. The spread across different questions is the corpus, not noise.
 */
export function repeatSpread(byItem: Map<string, number[]>): number {
  const spreads = [...byItem.values()].filter((values) => values.length > 1).map((values) => stddev(values));
  return spreads.length ? mean(spreads) : 0;
}

const NOISE_THRESHOLD = 0.15;
const MEANINGFUL_DELTA = 0.3;
const UNSTABLE_STDDEV = 1.5;

function pageForFactor(factor: EvalFactor): string {
  if (factor === "rag") return "Technique → RAG Config";
  if (factor === "candidate") return "Technique → RAG Config (variante de prompt) ou fiche Notion";
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

  const groups = new Map<string, { factor: EvalFactor; scores: number[]; latencies: number[]; byItem: Map<string, number[]> }>();
  const criterionScores = new Map<keyof EvalScoreWeights, number[]>();
  const categoryScores = new Map<string, number[]>();

  for (const row of results) {
    const score = scoreOfResult(row, weights);
    if (score === null) continue;
    const group = groups.get(row.config_label) ?? {
      factor: (row.factor as EvalFactor) || "baseline",
      scores: [],
      latencies: [],
      byItem: new Map<string, number[]>(),
    };
    group.scores.push(score);
    group.byItem.set(row.item_id, [...(group.byItem.get(row.item_id) ?? []), score]);
    const latencies = row.latencies as { total_ms?: number } | null;
    if (latencies && typeof latencies.total_ms === "number") group.latencies.push(latencies.total_ms);
    groups.set(row.config_label, group);

    const sub = readJudgeSubScores(row.judge_json);
    if (sub) {
      for (const [key, value] of criterionValues(sub)) {
        if (value === null) continue;
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
      const spread = repeatSpread(group.byItem);
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
      text: `Critère le plus faible : ${weakestCriterion.label} (${weakestCriterion.mean}/5). C'est là que le prompt du personnage doit être renforcé.`,
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

// ------------------------------------------------------- reference vs candidate

export interface ComparisonDelta {
  reference: number | null;
  candidate: number | null;
  /** candidate − reference; null when one side has no score. */
  delta: number | null;
}

export interface ComparisonCriterionRow extends ComparisonDelta {
  key: keyof EvalScoreWeights;
  label: string;
}

export interface ComparisonItemRow extends ComparisonDelta {
  itemId: string;
  question: string;
  character: string;
  /** Per-criterion Δ for this item (0-5 scale), only criteria both sides scored. */
  criteria: Array<{ key: keyof EvalScoreWeights; delta: number }>;
}

export interface ReferenceCandidateComparison {
  referenceLabel: string;
  candidateLabel: string;
  overall: ComparisonDelta & {
    referenceN: number;
    candidateN: number;
    /** Mean spread between the repeats of one question (noise), not between questions. */
    repeatSpread: number;
    itemsBetter: number;
    itemsWorse: number;
  };
  byCriterion: ComparisonCriterionRow[];
  byItem: ComparisonItemRow[];
  byCharacter: Array<ComparisonDelta & { character: string }>;
  verdict: EvalRecommendation;
}

function deltaOf(reference: number[], candidate: number[], digits = 3): ComparisonDelta {
  const ref = reference.length ? Number(mean(reference).toFixed(digits)) : null;
  const cand = candidate.length ? Number(mean(candidate).toFixed(digits)) : null;
  return {
    reference: ref,
    candidate: cand,
    delta: ref === null || cand === null ? null : Number((mean(candidate) - mean(reference)).toFixed(digits)),
  };
}

/**
 * Δ candidate − reference on the weighted /10 score, per criterion (/5),
 * per item and per character. Returns null when the run is not a
 * reference/candidate run (no "candidate" factor).
 */
export function compareReferenceCandidate(input: {
  results: EvalResult[];
  items: EvalItem[];
  weights: EvalScoreWeights;
}): ReferenceCandidateComparison | null {
  const { results, items, weights } = input;
  const reference = results.filter((row) => row.factor === "baseline");
  const candidate = results.filter((row) => row.factor === "candidate");
  if (!candidate.length) return null;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const scores = (rows: EvalResult[]) => rows
    .map((row) => scoreOfResult(row, weights))
    .filter((score): score is number => score !== null);
  const criterionLists = (rows: EvalResult[]) => {
    const lists = new Map<keyof EvalScoreWeights, number[]>();
    for (const row of rows) {
      const sub = readJudgeSubScores(row.judge_json);
      if (!sub) continue;
      for (const [key, value] of criterionValues(sub)) {
        if (value === null) continue;
        lists.set(key, [...(lists.get(key) ?? []), value]);
      }
    }
    return lists;
  };

  const refScores = scores(reference);
  const candScores = scores(candidate);

  const refCriteria = criterionLists(reference);
  const candCriteria = criterionLists(candidate);
  const byCriterion = EVAL_SCORE_CRITERIA
    .map((criterion) => ({
      key: criterion.key,
      label: criterion.label,
      ...deltaOf(refCriteria.get(criterion.key) ?? [], candCriteria.get(criterion.key) ?? [], 2),
    }))
    .filter((row) => row.reference !== null || row.candidate !== null);

  const itemIds = [...new Set([...reference, ...candidate].map((row) => row.item_id))];
  const byItem: ComparisonItemRow[] = itemIds.map((itemId) => {
    const ref = reference.filter((row) => row.item_id === itemId);
    const cand = candidate.filter((row) => row.item_id === itemId);
    const refLists = criterionLists(ref);
    const candLists = criterionLists(cand);
    const criteria = EVAL_SCORE_CRITERIA.flatMap((criterion) => {
      const a = refLists.get(criterion.key) ?? [];
      const b = candLists.get(criterion.key) ?? [];
      return a.length && b.length ? [{ key: criterion.key, delta: Number((mean(b) - mean(a)).toFixed(2)) }] : [];
    });
    const item = itemById.get(itemId);
    return {
      itemId,
      question: item?.question ?? itemId,
      character: item?.character_name?.trim() || "?",
      criteria,
      ...deltaOf(scores(ref), scores(cand)),
    };
  }).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  const spreads = itemIds.flatMap((itemId) => [reference, candidate].map((rows) => {
    const values = scores(rows.filter((row) => row.item_id === itemId));
    return values.length > 1 ? stddev(values) : null;
  })).filter((value): value is number => value !== null);
  const overall = {
    ...deltaOf(refScores, candScores),
    referenceN: refScores.length,
    candidateN: candScores.length,
    repeatSpread: Number(mean(spreads).toFixed(3)),
    itemsBetter: byItem.filter((row) => (row.delta ?? 0) >= MEANINGFUL_DELTA).length,
    itemsWorse: byItem.filter((row) => (row.delta ?? 0) <= -MEANINGFUL_DELTA).length,
  };

  const characters = [...new Set(byItem.map((row) => row.character))];
  const byCharacter = characters.map((character) => {
    const ids = new Set(byItem.filter((row) => row.character === character).map((row) => row.itemId));
    return {
      character,
      ...deltaOf(scores(reference.filter((row) => ids.has(row.item_id))), scores(candidate.filter((row) => ids.has(row.item_id)))),
    };
  });

  const spread = overall.repeatSpread;
  const delta = overall.delta;
  const split = `${overall.itemsBetter} question(s) en hausse, ${overall.itemsWorse} en baisse`;
  let verdict: EvalRecommendation;
  if (delta === null) {
    verdict = { level: "neutral", text: "Pas encore assez de résultats des deux côtés pour comparer." };
  } else if (spread > UNSTABLE_STDDEV) {
    verdict = { level: "warn", text: `Les passages d'une même question varient trop (± ${spread.toFixed(2)}) : relancer avant de conclure.` };
  } else if (Math.abs(delta) < NOISE_THRESHOLD) {
    verdict = { level: "neutral", text: `Le candidat ne change rien (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}, dans le bruit).` };
  } else if (delta >= MEANINGFUL_DELTA) {
    verdict = { level: "good", text: `Le candidat joue mieux : +${delta.toFixed(2)} point sur 10. À confirmer à l'oreille.` };
  } else if (delta <= -MEANINGFUL_DELTA) {
    verdict = { level: "warn", text: `Le candidat joue moins bien : ${delta.toFixed(2)} point sur 10. À écarter.` };
  } else {
    verdict = { level: "neutral", text: `Écart faible (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}) : pas de quoi changer de prompt.` };
  }

  if (delta !== null) verdict = { ...verdict, text: `${verdict.text} ${split}.` };

  return {
    referenceLabel: reference[0]?.config_label ?? "référence",
    candidateLabel: candidate[0]?.config_label ?? "candidat",
    overall,
    byCriterion,
    byItem,
    byCharacter,
    verdict,
  };
}
