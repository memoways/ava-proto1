import type { Database } from "@/integrations/supabase/types";
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getGameplaySettings, getLLMSettings, listLlmConfigModels, normalizeMaxPromptVariant, type GameplaySettings } from "@/services/settingsService";
import { characterRagTopKForVariant } from "@/services/characterRagTopK";
import { loadCharacterPrompt } from "@/services/characterPromptService";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { toCharacterExecutionContext } from "@/services/characterIdentityGuard";
import type { RuntimeCharacter } from "@/types";
import { processPRD4Turn } from "@/services/prd4Orchestrator";

export const EVAL_FEATURE_KEY = "llm_as_judge";
export const EVAL_REPEATS = 3;
export const EVAL_NOTION_SETTING_KEY = "ava_eval_notion_database_id";
/** claude-sonnet-4 is no longer served by OpenRouter (checked 9 November 2026). */
export const EVAL_DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-5.5";
const EVAL_JUDGE_EXTRA_MODELS = [
  { id: EVAL_DEFAULT_JUDGE_MODEL, label: "Claude Sonnet 5.5 (juge conseillé)" },
];

export const EVAL_NOTION_COLUMNS = [
  { name: "Question", type: "Title", note: "Réplique joueur" },
  { name: "Reponse visee", type: "Rich text", note: "Exemple de réponse d'or" },
  { name: "Must include", type: "Rich text", note: "Faits / comportements exigés" },
  { name: "Must not", type: "Rich text", note: "Spoilers, dump, hors personnage" },
  { name: "Ton", type: "Select", note: "retenu / ouvert / defle / factuel" },
  { name: "Longueur max", type: "Number", note: "Nombre de phrases visé" },
  { name: "Categorie", type: "Select", note: "factuel / piege / emotion / lore" },
  { name: "Actif", type: "Checkbox", note: "Inclus dans les runs" },
  { name: "Personnage", type: "Select", note: "Max ou Emma, obligatoire" },
  { name: "Ordre", type: "Number", note: "Tri d'affichage" },
  { name: "Notes juge", type: "Rich text", note: "Consignes extra pour le juge" },
] as const;

export type EvalItem = Database["public"]["Tables"]["eval_items"]["Row"];
export type EvalRun = Database["public"]["Tables"]["eval_runs"]["Row"];
export type EvalResult = Database["public"]["Tables"]["eval_results"]["Row"];
export type EvalFactor = "baseline" | "model" | "sampling" | "rag" | "candidate";
export type EvalPromptVariant = GameplaySettings["MAX_PROMPT_VARIANT"];
export const EVAL_PROMPT_VARIANTS: EvalPromptVariant[] = ["optimized_v3", "rich_v2", "compact_v1", "legacy"];

export interface EvalLiveSnapshot {
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  ragTopK: number;
  ragRetrieveK: number;
  ragRerank: boolean;
  ragThreshold: number;
  ragRerankModel: "rerank-3" | "rerank-3-lite" | "rerank-2.5" | "rerank-2.5-lite";
  ragRerankTruncation: boolean;
  promptVariant: EvalPromptVariant;
}

export interface EvalTurnConfig extends EvalLiveSnapshot {
  label: string;
  factor: EvalFactor;
}

export interface OfatSelection {
  extraModels: string[];
  samplingTemps: number[];
  ragVariants: Array<{ key: "conservative" | "generous"; topK: number; rerank: boolean }>;
}

export const SPEECH_QUALITY_KEYS = ["sounds_spoken", "no_therapeutic_language", "non_caricatural", "facts_understandable", "hope_without_cure"] as const;
/** J1 play criteria, 0 to 5 each. Absent from results stored before J1. */
export const PLAY_CRITERIA_KEYS = ["not_meta", "lived_impact", "canon_timeline", "distinct_voice"] as const;
export type PlayCriterionKey = typeof PLAY_CRITERIA_KEYS[number];

export interface EvalJudgeScore {
  speech_quality?: { sounds_spoken: number; no_therapeutic_language: number; non_caricatural: number; facts_understandable: number; hope_without_cure: number };
  not_meta?: number;
  lived_impact?: number;
  canon_timeline?: number;
  distinct_voice?: number;
  gold_fidelity: number;
  must_include: number;
  must_not: number;
  tone: number;
  length_ok: boolean;
  character_voice: number;
  overall: number;
  rationale: string;
  raw: string;
}

export interface RankedConfig {
  label: string;
  factor: EvalFactor;
  n: number;
  mean: number;
  stddev: number;
  delta: number;
  medianLatencyMs: number | null;
}

export interface EvalCostEstimate {
  configs: number;
  items: number;
  repeats: number;
  turns: number;
  llmCalls: number;
  estimatedCostUsd: number;
}

const LLM_CALLS_PER_TURN = 3;

export function snapshotLiveSettings(): EvalLiveSnapshot {
  const llm = getLLMSettings();
  const gameplay = getGameplaySettings();
  return {
    model: llm.LLM_MODEL,
    temperature: llm.LLM_TEMPERATURE,
    topP: llm.LLM_TOP_P,
    maxTokens: llm.LLM_MAX_TOKENS,
    ragTopK: gameplay.RAG_TOP_K,
    ragRetrieveK: gameplay.RAG_RETRIEVE_K,
    ragRerank: gameplay.RAG_RERANK_ENABLED,
    ragThreshold: gameplay.RAG_MATCH_THRESHOLD,
    ragRerankModel: gameplay.RAG_RERANK_MODEL,
    ragRerankTruncation: gameplay.RAG_RERANK_TRUNCATION,
    promptVariant: normalizeMaxPromptVariant(gameplay.MAX_PROMPT_VARIANT, "legacy"),
  };
}

/** Fields a reference or candidate snapshot may override; anything else stays live. */
export type EvalSnapshotOverrides = Partial<Pick<EvalLiveSnapshot,
  "model" | "temperature" | "topP" | "maxTokens" | "ragTopK" | "ragRetrieveK" | "ragRerank" | "ragThreshold" | "promptVariant">>;

const SNAPSHOT_NUMBER_KEYS = ["temperature", "topP", "maxTokens", "ragTopK", "ragRetrieveK", "ragThreshold"] as const;

/**
 * Reads a pasted settings snapshot (JSON). Unknown keys are ignored; invalid
 * values are reported instead of silently replaced. Nothing is persisted.
 */
export function parseSnapshotOverrides(raw: string): { overrides: EvalSnapshotOverrides; errors: string[] } {
  const text = raw.trim();
  if (!text) return { overrides: {}, errors: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { overrides: {}, errors: ["JSON illisible"] };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { overrides: {}, errors: ["Un objet JSON est attendu"] };
  }
  const value = parsed as Record<string, unknown>;
  const overrides: EvalSnapshotOverrides = {};
  const errors: string[] = [];
  if ("model" in value) {
    if (typeof value.model === "string" && value.model.trim()) overrides.model = value.model.trim();
    else errors.push("model doit être un identifiant de modèle");
  }
  if ("promptVariant" in value) {
    const variant = normalizeMaxPromptVariant(value.promptVariant, "legacy");
    if (variant === value.promptVariant) overrides.promptVariant = variant;
    else errors.push(`promptVariant inconnu : ${String(value.promptVariant)}`);
  }
  if ("ragRerank" in value) {
    if (typeof value.ragRerank === "boolean") overrides.ragRerank = value.ragRerank;
    else errors.push("ragRerank doit être true ou false");
  }
  for (const key of SNAPSHOT_NUMBER_KEYS) {
    if (!(key in value)) continue;
    const n = value[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) overrides[key] = n;
    else errors.push(`${key} doit être un nombre positif`);
  }
  return { overrides, errors };
}

function describeOverrides(live: EvalLiveSnapshot, snapshot: EvalLiveSnapshot): string {
  const changed = (Object.keys(snapshot) as Array<keyof EvalLiveSnapshot>)
    .filter((key) => key !== "promptVariant" && snapshot[key] !== live[key])
    .map((key) => `${key}=${String(snapshot[key])}`);
  return changed.length ? ` + ${changed.join(", ")}` : "";
}

/**
 * Reference vs candidate: exactly two configurations built from the live
 * snapshot, each applied in memory for the evaluation turn only.
 */
export function buildReferenceCandidateConfigs(
  live: EvalLiveSnapshot,
  reference: EvalSnapshotOverrides,
  candidate: EvalSnapshotOverrides,
): EvalTurnConfig[] {
  const ref: EvalLiveSnapshot = { ...live, ...reference };
  const cand: EvalLiveSnapshot = { ...ref, ...candidate };
  ref.ragRetrieveK = Math.max(ref.ragRetrieveK, ref.ragTopK);
  cand.ragRetrieveK = Math.max(cand.ragRetrieveK, cand.ragTopK);
  const refLabel = `référence (${ref.promptVariant}${describeOverrides(live, ref)})`;
  let candLabel = `candidat (${cand.promptVariant}${describeOverrides(ref, cand)})`;
  if (candLabel.slice("candidat".length) === refLabel.slice("référence".length)) candLabel = `${candLabel} · témoin`;
  return [
    { ...ref, label: refLabel, factor: "baseline" },
    { ...cand, label: candLabel, factor: "candidate" },
  ];
}

/** Judge choices: the recommended judge first, then the LLM Config catalog. */
export function listEvalJudgeModels(): Array<{ id: string; label: string }> {
  const catalog = listLlmConfigModels().map((model) => ({ id: model.id, label: model.label }));
  return [...EVAL_JUDGE_EXTRA_MODELS, ...catalog.filter((model) => !EVAL_JUDGE_EXTRA_MODELS.some((extra) => extra.id === model.id))];
}

export function listEvalMaxModels(liveModel: string) {
  return listLlmConfigModels().filter((model) => model.id !== liveModel);
}

export function defaultOfatSelection(live: EvalLiveSnapshot): OfatSelection {
  const extraModels = listEvalMaxModels(live.model)
    .map((model) => model.id)
    .slice(0, 2);
  const samplingTemps = [0, 0.8].filter((temp) => Math.abs(temp - live.temperature) > 0.05);
  const conservativeK = Math.max(1, live.ragTopK - 2);
  const generousK = Math.max(live.ragTopK + 3, 8);
  const ragVariants: OfatSelection["ragVariants"] = [];
  if (conservativeK !== live.ragTopK) {
    ragVariants.push({ key: "conservative", topK: conservativeK, rerank: true });
  }
  if (generousK !== live.ragTopK) {
    ragVariants.push({ key: "generous", topK: generousK, rerank: true });
  }
  return { extraModels, samplingTemps, ragVariants };
}

export function buildOfatConfigs(live: EvalLiveSnapshot, selection: OfatSelection): EvalTurnConfig[] {
  const configs: EvalTurnConfig[] = [
    { ...live, label: "référence (live)", factor: "baseline" },
  ];

  for (const model of selection.extraModels) {
    if (!model || model === live.model) continue;
    configs.push({ ...live, model, label: `modèle: ${model}`, factor: "model" });
  }

  for (const temperature of selection.samplingTemps) {
    if (!Number.isFinite(temperature) || Math.abs(temperature - live.temperature) < 0.001) continue;
    configs.push({
      ...live,
      temperature,
      label: `sampling: temp ${temperature}`,
      factor: "sampling",
    });
  }

  for (const variant of selection.ragVariants) {
    if (variant.topK === live.ragTopK && variant.rerank === live.ragRerank) continue;
    const name = variant.key === "conservative" ? "conservateur" : "généreux";
    configs.push({
      ...live,
      ragTopK: variant.topK,
      ragRerank: variant.rerank,
      ragRetrieveK: Math.max(live.ragRetrieveK, variant.topK),
      label: `RAG: ${name} (k=${variant.topK})`,
      factor: "rag",
    });
  }

  return configs;
}

export function parseUsdPerMillion(raw: string): number {
  const match = raw.replace(",", ".").match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : 1;
}

/**
 * Cost model measured on the J1 sandbox run of 9 November 2026 (126 turns,
 * llm_usage): character ~4 200 / 110 tokens, GM post-turn ~8 000 / 580 tokens
 * (Gemini Flash), judge ~2 900 / 180 tokens. The recommended judge billed
 * $0.0136 per call, above its list price: use the measured value.
 */
const CHARACTER_TOKENS_IN = 4_200;
const CHARACTER_TOKENS_OUT = 110;
const GM_COST_PER_TURN_USD = 0.0026;
const JUDGE_TOKENS_IN = 2_900;
const JUDGE_TOKENS_OUT = 180;
const MEASURED_JUDGE_COST_PER_CALL_USD: Record<string, number> = {
  "anthropic/claude-sonnet-5.5": 0.0136,
};

function catalogCallCost(modelId: string, tokensIn: number, tokensOut: number, fallbackIn = "$1", fallbackOut = "$3"): number {
  const catalog = listLlmConfigModels().find((model) => model.id === modelId);
  const inUsd = parseUsdPerMillion(catalog?.costInput ?? fallbackIn);
  const outUsd = parseUsdPerMillion(catalog?.costOutput ?? fallbackOut);
  return (tokensIn * inUsd + tokensOut * outUsd) / 1_000_000;
}

export function estimateEvalRun(
  itemCount: number,
  configs: EvalTurnConfig[],
  repeats = EVAL_REPEATS,
  judgeModel = EVAL_DEFAULT_JUDGE_MODEL,
): EvalCostEstimate {
  const turns = itemCount * configs.length * repeats;
  const llmCalls = turns * LLM_CALLS_PER_TURN;
  const judgePerCall = MEASURED_JUDGE_COST_PER_CALL_USD[judgeModel]
    ?? catalogCallCost(judgeModel, JUDGE_TOKENS_IN, JUDGE_TOKENS_OUT, "$3", "$15");
  let estimatedCostUsd = 0;
  for (const config of configs) {
    const configTurns = itemCount * repeats;
    estimatedCostUsd += configTurns * catalogCallCost(config.model, CHARACTER_TOKENS_IN, CHARACTER_TOKENS_OUT);
    estimatedCostUsd += configTurns * (GM_COST_PER_TURN_USD + judgePerCall);
  }
  return {
    configs: configs.length,
    items: itemCount,
    repeats,
    turns,
    llmCalls,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
  };
}

export function clampScore(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function parseJudgeResponse(raw: string): EvalJudgeScore {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  const play: Partial<Record<PlayCriterionKey, number>> = {};
  for (const key of PLAY_CRITERIA_KEYS) {
    if (parsed[key] !== undefined && parsed[key] !== null) play[key] = clampScore(parsed[key], 0, 5);
  }
  return {
    gold_fidelity: clampScore(parsed.gold_fidelity, 0, 5),
    ...(parsed.speech_quality && typeof parsed.speech_quality === "object" ? {
      speech_quality: Object.fromEntries(SPEECH_QUALITY_KEYS.map(key => [key, clampScore((parsed.speech_quality as Record<string, unknown>)[key], 0, 5)])) as NonNullable<EvalJudgeScore["speech_quality"]>,
    } : {}),
    ...play,
    must_include: clampScore(parsed.must_include, 0, 5),
    must_not: clampScore(parsed.must_not, 0, 5),
    tone: clampScore(parsed.tone, 0, 5),
    length_ok: parsed.length_ok === true || parsed.length_ok === "true",
    character_voice: clampScore(parsed.character_voice, 0, 5),
    overall: clampScore(parsed.overall, 0, 10),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 800) : "JSON juge illisible",
    raw,
  };
}

/** Max or Emma from the item's Personnage field; null when unknown. */
export function evalCharacterKey(characterName: string | null | undefined): RuntimeCharacter | null {
  const name = characterName?.trim() ?? "";
  if (/^emma(?:\s|$)/i.test(name)) return "emma";
  if (/^max(?:\s|$)/i.test(name)) return "max";
  return null;
}

const CANON_FIELD_CHARS = 1_800;

function clip(text: string | undefined, limit: number): string {
  const value = (text ?? "").trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

const TIMELINE_TAIL_CHARS = 4_400;
const TIMELINE_EARLIER_CHARS = 1_200;

/**
 * The timeline runs from oldest to today; the carnage and the present sit at
 * its end. Keep the recent tail whole, plus earlier period headings and the
 * lines about Mona (camp regression), within a bounded budget.
 */
export function judgeTimelineExcerpt(timeline: string | undefined): string {
  const text = (timeline ?? "").trim();
  if (text.length <= TIMELINE_TAIL_CHARS + TIMELINE_EARLIER_CHARS) return text;
  const cut = text.indexOf("\n", text.length - TIMELINE_TAIL_CHARS);
  const tail = text.slice(cut < 0 ? text.length - TIMELINE_TAIL_CHARS : cut + 1);
  const earlier = text.slice(0, text.length - tail.length).split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(Il y a|Permanent|Hier|Aujourd)/i.test(line) || /\bMona\b/.test(line));
  let kept = "";
  for (const line of earlier) {
    if (kept.length + line.length + 1 > TIMELINE_EARLIER_CHARS) break;
    kept += `${line}\n`;
  }
  return `${kept}…\n${tail}`;
}

/** Read-only canon excerpt from the synced character sheet, for the judge only. */
export function buildJudgeCanonReference(fields: { situation_summary?: string; timeline?: string; maniere_de_parler?: string } | null): string {
  if (!fields) return "";
  const parts = [
    fields.situation_summary?.trim() ? `### Situation présente\n${clip(fields.situation_summary, CANON_FIELD_CHARS)}` : "",
    fields.timeline?.trim() ? `### Timeline (périodes, Mona, puis les derniers jours en entier)\n${judgeTimelineExcerpt(fields.timeline)}` : "",
    fields.maniere_de_parler?.trim() ? `### Manière de parler\n${clip(fields.maniere_de_parler, 900)}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

export function buildJudgePrompt(
  item: Pick<EvalItem, "question" | "gold_answer" | "must_include" | "must_not" | "tone" | "max_length" | "judge_notes" | "character_name">,
  response: string,
  canonReference = "",
): string {
  const characterName = item.character_name?.trim() || "le personnage attribué";
  const key = evalCharacterKey(characterName);
  const firstName = characterName.split(/\s+/)[0];
  const otherName = key === "max" ? "Emma" : key === "emma" ? "Max" : "l'autre personnage";
  return `Tu es un juge strict pour l'expérience narrative « Où est Ava ? ».
Évalue la réponse de ${characterName} au regard de la cible de ce personnage.
Ne récompense PAS le copier-coller du texte d'or : la grille prime.
Une retenue, une réponse partielle, un déplacement du sujet ou une question sur l'intention peuvent être une excellente réponse lorsque la relation ne permet pas encore une confidence. Ne pénalise pas un fait intime non livré si le ton, MUST NOT ou les notes demandent cette retenue. Une connaissance factuelle n'est jamais, à elle seule, une permission de confidence.

## QUESTION JOUEUR
${item.question}

## RÉPONSE VISÉE (exemple, pas un script à recopier)
${item.gold_answer || "(aucune)"}

## MUST INCLUDE
${item.must_include || "(aucun)"}

## MUST NOT
${item.must_not || "(aucun)"}

## TON ATTENDU
${item.tone || "retenu"}

## LONGUEUR MAX
${item.max_length != null ? `${item.max_length} phrase(s)` : "1-2 phrases orales"}

## NOTES
${item.judge_notes || "(aucune)"}

## REPÈRES CANON DE ${characterName.toLocaleUpperCase("fr")} (lecture seule)
${canonReference || "(fiche non fournie : juge canon_timeline avec MUST NOT et les notes)"}

## RÉPONSE DE ${characterName.toLocaleUpperCase("fr")}
${response}

## JEU DU PERSONNAGE — QUATRE CRITÈRES (0 à 5)
- not_meta : ${firstName} vit la situation de l'intérieur ; il n'explique pas l'histoire, le dispositif ni son propre rôle comme un narrateur. 0 = résumé de situation ou commentaire sur la fiction.
- lived_impact : les faits passent par ce qu'ils font à sa vie, à son corps, à sa famille ; une énumération de faits sans leur effet vécu vaut au plus 2.
- canon_timeline : rien ne contredit la fiche, la timeline ni le présent ; un souvenir (ex. J−2 à l'hôtel) n'est jamais raconté comme le présent (l'appartement). 0 = contradiction nette.
- distinct_voice : on reconnaît ${firstName}, pas ${otherName} ni un assistant ; vocabulaire, rythme et rapport aux autres lui sont propres.
Le défaut principal à détecter : un personnage trop méta qui énumère des faits sans leur impact.

## PAROLE INCARNÉE — CINQ CRITÈRES (0 à 5)
- sounds_spoken : sonne parlé, pas rédigé ; une suspension ou une réponse incomplète pertinente est recevable.
- no_therapeutic_language : pas de lucidité de psychologue ni d'analyse clinique artificielle.
- non_caricatural : ni tics mécaniques ni hésitations répétées sans nécessité émotionnelle.
- facts_understandable : les faits livrés restent compréhensibles et conformes à la cible, même si la parole est troublée.
- hope_without_cure : l'espoir reste possible et proportionné au contexte ; aucune guérison confirmée ou exclue. N'exige pas une demande de solution dès le contact ni un arc complet sur un seul tour.
Ces critères éclairent character_voice et overall, sans imposer des tics ni une rugosité à chaque réplique. Tu juges le texte, jamais la qualité audio.

Retourne UNIQUEMENT un JSON :
{
  "gold_fidelity": 0-5,
  "must_include": 0-5,
  "must_not": 0-5,
  "tone": 0-5,
  "length_ok": true/false,
  "character_voice": 0-5,
  "speech_quality": {"sounds_spoken": 0-5, "no_therapeutic_language": 0-5, "non_caricatural": 0-5, "facts_understandable": 0-5, "hope_without_cure": 0-5},
  "not_meta": 0-5,
  "lived_impact": 0-5,
  "canon_timeline": 0-5,
  "distinct_voice": 0-5,
  "overall": 0-10,
  "rationale": "2 phrases max"
}`;
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function rankConfigs(
  results: Array<{ config_label: string; factor: string; overall_score: number | null; latencies?: { total_ms?: number } | null }>,
): RankedConfig[] {
  const groups = new Map<string, { factor: EvalFactor; scores: number[]; latencies: number[] }>();
  for (const row of results) {
    const score = row.overall_score;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    const current = groups.get(row.config_label) ?? {
      factor: (row.factor as EvalFactor) || "baseline",
      scores: [],
      latencies: [],
    };
    current.scores.push(score);
    const latency = row.latencies?.total_ms;
    if (typeof latency === "number") current.latencies.push(latency);
    groups.set(row.config_label, current);
  }
  const baseline = [...groups.entries()].find(([, group]) => group.factor === "baseline");
  const baselineMean = baseline ? mean(baseline[1].scores) : 0;
  return [...groups.entries()]
    .map(([label, group]) => ({
      label,
      factor: group.factor,
      n: group.scores.length,
      mean: Number(mean(group.scores).toFixed(3)),
      stddev: Number(stddev(group.scores).toFixed(3)),
      delta: Number((mean(group.scores) - baselineMean).toFixed(3)),
      medianLatencyMs: median(group.latencies),
    }))
    .sort((a, b) => b.mean - a.mean);
}

export function strongestFactor(ranked: RankedConfig[]): { factor: EvalFactor; absDelta: number } | null {
  const byFactor = new Map<EvalFactor, number[]>();
  for (const row of ranked) {
    if (row.factor === "baseline") continue;
    const list = byFactor.get(row.factor) ?? [];
    list.push(Math.abs(row.delta));
    byFactor.set(row.factor, list);
  }
  let best: { factor: EvalFactor; absDelta: number } | null = null;
  for (const [factor, deltas] of byFactor) {
    const absDelta = mean(deltas);
    if (!best || absDelta > best.absDelta) best = { factor, absDelta: Number(absDelta.toFixed(3)) };
  }
  return best;
}

export function listEvalWorkItems(
  configs: EvalTurnConfig[],
  items: EvalItem[],
  repeats: number,
  doneKeys: Set<string>,
): Array<{ config: EvalTurnConfig; item: EvalItem; repeatIndex: number; key: string }> {
  const queue = [];
  for (const config of configs) {
    for (const item of items) {
      for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
        const key = `${config.label}::${item.id}::${repeatIndex}`;
        if (doneKeys.has(key)) continue;
        queue.push({ config, item, repeatIndex, key });
      }
    }
  }
  return queue;
}

export function resultWorkKey(row: Pick<EvalResult, "config_label" | "item_id" | "repeat_index">): string {
  return `${row.config_label}::${row.item_id}::${row.repeat_index}`;
}

export interface IsolatedEvalTurnTrace {
  maxResponse: string;
  ragMatches: unknown;
  gmBrief: unknown;
  validator: unknown;
  latencies: { rag_ms: number; gm_ms: number; max_ms: number; validator_ms: number; total_ms: number };
  tokens: { rag?: unknown; gm?: unknown; max?: unknown; validator?: unknown };
  error?: string;
  /** Read-only canon excerpt handed to the judge; not stored in eval_results. */
  canonReference?: string;
}

export async function runIsolatedEvalTurn(
  item: EvalItem,
  config: EvalTurnConfig,
  opts?: { signal?: AbortSignal },
): Promise<IsolatedEvalTurnTrace> {
  const characterName = item.character_name?.trim();
  if (!characterName) {
    throw new Error("No character is attributed to this evaluation item");
  }
  const characterKey = evalCharacterKey(characterName);
  const promptVariant = normalizeMaxPromptVariant(config.promptVariant, "legacy");
  // Mirror the live turn: optimized_v3 widens the RAG pool before deduplication.
  const ragTopK = characterRagTopKForVariant(promptVariant, config.ragTopK);
  const runtime = characterKey ? await getCharacterRuntimeReadiness(characterKey) : null;
  const characterContext = toCharacterExecutionContext(runtime);
  if (!runtime?.ready || !characterContext) {
    throw new Error(`No exact attributed character context for isolated evaluation: ${characterName}`);
  }
  const turn = await processPRD4Turn({
    sessionId: null,
    conversationHistory: [],
    userMessage: item.question,
    userRole: null,
    timeElapsedSeconds: 0,
    characterContext,
    signal: opts?.signal,
    turnIndex: 1,
    evaluationOverrides: {
      featureKey: EVAL_FEATURE_KEY,
      promptVariant,
      ragTopK,
      ragThreshold: config.ragThreshold,
      ragRetrieveK: Math.max(config.ragRetrieveK, ragTopK),
      ragRerank: config.ragRerank,
      ragRerankModel: config.ragRerankModel,
      ragRerankTruncation: config.ragRerankTruncation,
      llm: {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP,
      },
    },
  });
  const gm = await turn.postTurnPromise;
  const canonFields = await loadCharacterPrompt(characterContext.characterId).catch(() => null);

  return {
    maxResponse: turn.maxResponse,
    ragMatches: { count: turn.ragMatches },
    gmBrief: gm,
    validator: { status: "not_executed", reason: "disabled_in_prd4_public" },
    latencies: {
      rag_ms: turn.timings.rag_ms,
      gm_ms: gm.latency_ms ?? 0,
      max_ms: turn.timings.max_ms,
      validator_ms: 0,
      total_ms: turn.timings.total_ms,
    },
    tokens: {},
    error: gm.execution_status && gm.execution_status !== "executed"
      ? `GM ${gm.execution_status}`
      : undefined,
    canonReference: buildJudgeCanonReference(canonFields),
  };
}

export async function judgeIsolatedEvalTurn(
  item: EvalItem,
  maxResponse: string,
  judgeModel: string,
  opts?: { signal?: AbortSignal; canonReference?: string },
): Promise<EvalJudgeScore> {
  const result = await callLLMWithUsage(
    [{ role: "system", content: buildJudgePrompt(item, maxResponse, opts?.canonReference ?? "") }],
    {
      model: judgeModel,
      temperature: 0,
      max_tokens: 500,
      feature_key: EVAL_FEATURE_KEY,
      signal: opts?.signal,
      timeoutMs: 25_000,
    },
  );
  return parseJudgeResponse(result.content);
}
