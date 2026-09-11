import type { Database } from "@/integrations/supabase/types";
import { callLLMWithUsage } from "@/services/openRouterLLM";
import { getGameplaySettings, getLLMSettings, listLlmConfigModels } from "@/services/settingsService";
import { getCharacterRuntimeReadiness } from "@/services/experienceOrchestration";
import { toCharacterExecutionContext } from "@/services/characterIdentityGuard";
import type { RuntimeCharacter } from "@/types";
import { processPRD4Turn } from "@/services/prd4Orchestrator";

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
  { name: "Personnage", type: "Select", note: "Max ou Emma, obligatoire" },
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

const LLM_CALLS_PER_TURN = 3;
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
    const catalog = listLlmConfigModels().find((model) => model.id === modelId);
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

export function buildJudgePrompt(item: Pick<EvalItem, "question" | "gold_answer" | "must_include" | "must_not" | "tone" | "max_length" | "judge_notes" | "character_name">, response: string): string {
  const characterName = item.character_name?.trim() || "le personnage attribué";
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

## RÉPONSE DE ${characterName.toLocaleUpperCase("fr")}
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
  const characterName = item.character_name?.trim();
  if (!characterName) {
    throw new Error("No character is attributed to this evaluation item");
  }
  const characterKey: RuntimeCharacter | null = /^emma(?:\s|$)/i.test(characterName)
    ? "emma"
    : /^max(?:\s|$)/i.test(characterName)
      ? "max"
      : null;
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
      ragTopK: config.ragTopK,
      ragThreshold: config.ragThreshold,
      ragRetrieveK: Math.max(config.ragRetrieveK, config.ragTopK),
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
