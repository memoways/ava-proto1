import type { Database } from "@/integrations/supabase/types";
import { planGameMasterTurnDetailed } from "@/agents/gameMasterAgent";
import { simulateMaxResponse, validateMaxResponseDetailed } from "@/agents/maxAgent";
import { resolveCharacterIdByName } from "@/services/characterPromptService";
import { callLLMWithUsage } from "@/services/openRouterLLM";
import {
  buildKnowledgeContextFromRAG,
  formatMaxRAGContext,
  queryRAGDetailed,
} from "@/services/ragService";
import { maxRagFormatOptionsForVariant } from "@/services/maxRagVariant";
import { getGameplaySettings, getLLMSettings, OPENROUTER_MODELS } from "@/services/settingsService";

export const EVAL_FEATURE_KEY = "llm_as_judge";
export const EVAL_REPEATS = 3;
export const EVAL_NOTION_SETTING_KEY = "ava_eval_notion_database_id";
export const EVAL_DEFAULT_JUDGE_MODEL = "anthropic/claude-sonnet-4";

export const EVAL_NOTION_COLUMNS = [
  { name: "Question", type: "Title", note: "Réplique joueur" },
  { name: "Reponse visee", type: "Rich text", note: "Exemple de réponse d'or" },
  { name: "Must include", type: "Rich text", note: "Faits / comportements exigés" },
  { name: "Must not", type: "Rich text", note: "Spoilers, dump, hors personnage" },
  { name: "Ton", type: "Select", note: "retenu / ouvert / defle / factuel" },
  { name: "Longueur max", type: "Number", note: "Nombre de phrases visé" },
  { name: "Categorie", type: "Select", note: "factuel / piege / emotion / lore" },
  { name: "Actif", type: "Checkbox", note: "Inclus dans les runs" },
  { name: "Personnage", type: "Select", note: "V1 = Max" },
  { name: "Ordre", type: "Number", note: "Tri d'affichage" },
  { name: "Notes juge", type: "Rich text", note: "Consignes extra pour le juge" },
] as const;

export type EvalItem = Database["public"]["Tables"]["eval_items"]["Row"];
export type EvalRun = Database["public"]["Tables"]["eval_runs"]["Row"];
export type EvalResult = Database["public"]["Tables"]["eval_results"]["Row"];
export type EvalFactor = "baseline" | "model" | "sampling" | "rag";

export interface EvalLiveSnapshot {
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  ragTopK: number;
  ragRetrieveK: number;
  ragRerank: boolean;
  ragThreshold: number;
  ragRerankModel: "rerank-2.5" | "rerank-2.5-lite";
  ragRerankTruncation: boolean;
  promptVariant: string;
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

export interface EvalJudgeScore {
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

const LLM_CALLS_PER_TURN = 4;
const TOKENS_IN_PER_CALL = 1_800;
const TOKENS_OUT_PER_CALL = 180;

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
    promptVariant: gameplay.MAX_PROMPT_VARIANT,
  };
}

export function defaultOfatSelection(live: EvalLiveSnapshot): OfatSelection {
  const extraModels = OPENROUTER_MODELS
    .map((model) => model.id)
    .filter((id) => id !== live.model)
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

export function estimateEvalRun(
  itemCount: number,
  configs: EvalTurnConfig[],
  repeats = EVAL_REPEATS,
): EvalCostEstimate {
  const turns = itemCount * configs.length * repeats;
  const llmCalls = turns * LLM_CALLS_PER_TURN;
  const byModel = new Map<string, number>();
  for (const config of configs) {
    byModel.set(config.model, (byModel.get(config.model) ?? 0) + itemCount * repeats * 2);
  }
  let estimatedCostUsd = 0;
  for (const [modelId, callCount] of byModel) {
    const catalog = OPENROUTER_MODELS.find((model) => model.id === modelId);
    const inUsd = parseUsdPerMillion(catalog?.costInput ?? "$1");
    const outUsd = parseUsdPerMillion(catalog?.costOutput ?? "$3");
    estimatedCostUsd += (callCount * TOKENS_IN_PER_CALL * inUsd) / 1_000_000;
    estimatedCostUsd += (callCount * TOKENS_OUT_PER_CALL * outUsd) / 1_000_000;
  }
  const remainingCalls = Math.max(0, llmCalls - [...byModel.values()].reduce((sum, n) => sum + n, 0));
  estimatedCostUsd += (remainingCalls * TOKENS_IN_PER_CALL * 0.3) / 1_000_000;
  estimatedCostUsd += (remainingCalls * TOKENS_OUT_PER_CALL * 2.5) / 1_000_000;
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
  return {
    gold_fidelity: clampScore(parsed.gold_fidelity, 0, 5),
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

export function buildJudgePrompt(item: Pick<EvalItem, "question" | "gold_answer" | "must_include" | "must_not" | "tone" | "max_length" | "judge_notes">, response: string): string {
  return `Tu es un juge strict pour l'expérience narrative « Où est Ava ? ».
Évalue la réponse de Max (père d'Ava, Lausanne) au regard de la cible.
Ne récompense PAS le copier-coller du texte d'or : la grille prime.

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

## RÉPONSE DE MAX
${response}

Retourne UNIQUEMENT un JSON :
{
  "gold_fidelity": 0-5,
  "must_include": 0-5,
  "must_not": 0-5,
  "tone": 0-5,
  "length_ok": true/false,
  "character_voice": 0-5,
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
}

export async function runIsolatedEvalTurn(
  item: EvalItem,
  config: EvalTurnConfig,
  opts?: { signal?: AbortSignal },
): Promise<IsolatedEvalTurnTrace> {
  const startedAt = performance.now();
  const characterName = item.character_name || "Max";
  const characterId = await resolveCharacterIdByName(characterName);
  const gameplay = getGameplaySettings();

  const ragStarted = performance.now();
  const rag = await queryRAGDetailed(item.question, undefined, config.ragTopK, config.ragThreshold, {
    characterId,
    rerank: config.ragRerank,
    retrieveK: Math.max(config.ragRetrieveK, config.ragTopK),
    rerankModel: config.ragRerankModel,
    rerankTruncation: config.ragRerankTruncation,
    signal: opts?.signal,
    timeoutMs: 20_000,
  });
  const rag_ms = Math.round(performance.now() - ragStarted);
  const knowledgeContext = buildKnowledgeContextFromRAG(rag.matches);
  const ragContext = formatMaxRAGContext(rag.matches, maxRagFormatOptionsForVariant(gameplay.MAX_PROMPT_VARIANT));

  const gmStarted = performance.now();
  const gm = await planGameMasterTurnDetailed(
    {
      conversationHistory: [],
      userMessage: item.question,
      currentTrustLevel: 0,
      triggeredIds: [],
      timeElapsedSeconds: 0,
      knowledgeContext,
      characterName,
    },
    { featureKey: EVAL_FEATURE_KEY },
  );
  const gm_ms = Math.round(performance.now() - gmStarted);

  const maxStarted = performance.now();
  const max = await simulateMaxResponse(
    {
      conversationHistory: [],
      userMessage: item.question,
      ragContext,
      knowledgeContext,
    },
    {
      characterName,
      featureKey: EVAL_FEATURE_KEY,
      timeoutMs: 25_000,
      signal: opts?.signal,
      llmOverrides: {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP,
      },
    },
  );
  const max_ms = Math.round(performance.now() - maxStarted);

  const validatorStarted = performance.now();
  const validator = await validateMaxResponseDetailed({
    userMessage: item.question,
    response: max.response,
    ragContext,
    knowledgeContext,
    featureKey: EVAL_FEATURE_KEY,
  });
  const validator_ms = Math.round(performance.now() - validatorStarted);

  return {
    maxResponse: max.response,
    ragMatches: rag.matches.map((match) => ({
      id: match.id,
      similarity: match.similarity,
      content: match.content.slice(0, 280),
    })),
    gmBrief: gm.brief,
    validator: validator.result,
    latencies: {
      rag_ms,
      gm_ms,
      max_ms,
      validator_ms,
      total_ms: Math.round(performance.now() - startedAt),
    },
    tokens: {
      gm: gm.usage ?? null,
      max: max.usage ?? null,
      validator: validator.usage ?? null,
    },
    error: rag.error || gm.error,
  };
}

export async function judgeIsolatedEvalTurn(
  item: EvalItem,
  maxResponse: string,
  judgeModel: string,
  opts?: { signal?: AbortSignal },
): Promise<EvalJudgeScore> {
  const result = await callLLMWithUsage(
    [{ role: "system", content: buildJudgePrompt(item, maxResponse) }],
    {
      model: judgeModel,
      temperature: 0,
      max_tokens: 400,
      feature_key: EVAL_FEATURE_KEY,
      signal: opts?.signal,
      timeoutMs: 25_000,
    },
  );
  return parseJudgeResponse(result.content);
}
