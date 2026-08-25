import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { authenticatedFunctionFetch, getCachedSession } from "@/services/gameAuth";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import {
  loadEnvironmentSetting,
  saveEnvironmentSetting,
} from "@/services/environmentContext";
import type { EvalItem, EvalLiveSnapshot, EvalResult, EvalRun, EvalTurnConfig, IsolatedEvalTurnTrace, EvalJudgeScore } from "@/services/evalJudgePipeline";
import { EVAL_NOTION_SETTING_KEY } from "@/services/evalJudgePipeline";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export async function loadEvalNotionDatabaseId(): Promise<string> {
  const stored = await loadEnvironmentSetting<{ id?: string }>(EVAL_NOTION_SETTING_KEY, { id: AVA_NOTION_DATABASES.eval_items });
  return (stored.id || AVA_NOTION_DATABASES.eval_items || "").replace(/-/g, "");
}

export async function saveEvalNotionDatabaseId(id: string): Promise<void> {
  await saveEnvironmentSetting(EVAL_NOTION_SETTING_KEY, { id: id.replace(/-/g, "") });
}

export async function fetchEvalItems(): Promise<EvalItem[]> {
  const { data, error } = await supabase
    .from("eval_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function syncEvalItemsFromNotion(databaseId: string): Promise<{ items_upserted: number; pages_seen: number; skipped_empty_title: number }> {
  const response = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/sync-eval-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database_id: databaseId }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; items_upserted?: number; pages_seen?: number; skipped_empty_title?: number };
  if (!response.ok) throw new Error(payload.error || `Sync Notion ${response.status}`);
  return {
    items_upserted: payload.items_upserted ?? 0,
    pages_seen: payload.pages_seen ?? 0,
    skipped_empty_title: payload.skipped_empty_title ?? 0,
  };
}

export async function fetchEvalRuns(limit = 20): Promise<EvalRun[]> {
  const { data, error } = await supabase
    .from("eval_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchEvalResults(runId: string): Promise<EvalResult[]> {
  const { data, error } = await supabase
    .from("eval_results")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createEvalRun(input: {
  baseline: EvalLiveSnapshot;
  configs: EvalTurnConfig[];
  judgeModel: string;
  repeats: number;
  estimatedTurns: number;
  estimatedCostUsd: number;
}): Promise<EvalRun> {
  const session = await getCachedSession();
  const { data, error } = await supabase
    .from("eval_runs")
    .insert({
      status: "queued",
      created_by: session?.user?.id ?? null,
      baseline: input.baseline as unknown as Json,
      ofat_config: { configs: input.configs } as unknown as Json,
      judge_model: input.judgeModel,
      repeats: input.repeats,
      estimated_turns: input.estimatedTurns,
      estimated_cost_usd: input.estimatedCostUsd,
      total_turns: input.estimatedTurns,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Impossible de créer le run");
  return data;
}

export async function patchEvalRun(id: string, patch: Partial<EvalRun>): Promise<void> {
  const { error } = await supabase
    .from("eval_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertEvalResult(input: {
  runId: string;
  item: EvalItem;
  config: EvalTurnConfig;
  repeatIndex: number;
  turn: IsolatedEvalTurnTrace;
  judge: EvalJudgeScore | null;
}): Promise<EvalResult> {
  const { data, error } = await supabase
    .from("eval_results")
    .upsert({
      run_id: input.runId,
      item_id: input.item.id,
      config_label: input.config.label,
      factor: input.config.factor,
      repeat_index: input.repeatIndex,
      max_response: input.turn.maxResponse,
      judge_json: input.judge as unknown as Json,
      overall_score: input.judge?.overall ?? null,
      rag_matches: input.turn.ragMatches as unknown as Json,
      gm_brief: input.turn.gmBrief as unknown as Json,
      validator: input.turn.validator as unknown as Json,
      latencies: input.turn.latencies as unknown as Json,
      tokens: input.turn.tokens as unknown as Json,
      error_message: input.turn.error ?? null,
    }, { onConflict: "run_id,item_id,config_label,repeat_index" })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Impossible d'enregistrer le résultat");
  return data;
}
