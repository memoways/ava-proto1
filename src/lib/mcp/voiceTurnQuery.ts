import type { SupabaseClient } from "@supabase/supabase-js";
import { projectVoiceEvents, type VoiceEventRow } from "./voiceTurnProjection";

export interface VoiceTurnFilters {
  from: string;
  to: string;
  environment?: string;
  character?: string;
  provider?: string;
  model?: string;
  service?: "stt" | "llm" | "tts" | "gm";
  transport?: string;
  code_version?: string;
  prompt_version?: string;
  config_version?: string;
  turn_id?: string;
  attempt_id?: string;
  offset?: number;
  limit?: number;
}
export async function readVoiceTurnPage(client: SupabaseClient, filters: VoiceTurnFilters) {
  const limit = Math.min(300, Math.max(1, filters.limit ?? 100));
  const offset = Math.min(3000, Math.max(0, filters.offset ?? 0));
  const remaining = Math.min(limit, 3000 - offset);
  if (!remaining) return { ...projectVoiceEvents([]), page: { offset, limit, nextOffset: null, cappedAt: 3000, capped: true }, window: { from: filters.from, to: filters.to }, summaryScope: "returned_page_not_full_cohort", percentileMethod: "linear_interpolation_(n-1)*p_rounded_ms", source: "voice_turn_events", schemaVersion: 2 };
  let query = client.from("voice_turn_events").select("id,created_at,event_name,metadata_json")
    .gte("created_at", filters.from).lt("created_at", filters.to)
    .in("event_name", ["voice_turn_started", "voice_turn_finished", "voice_turn_gm"])
    .eq("metadata_json->>schema_version", "2")
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.environment) query = query.eq("environment_id", filters.environment);
  for (const name of ["character", "code_version", "prompt_version", "config_version", "turn_id", "attempt_id"] as const) {
    if (filters[name]) query = query.eq(`metadata_json->>${name}`, filters[name]);
  }
  if (filters.provider || filters.model || filters.transport) {
    const service: Record<string, string> = { service: filters.service ?? "tts" };
    if (filters.provider) service.effective_provider = filters.provider;
    if (filters.model) service.effective_model = filters.model;
    if (filters.transport) service.transport = filters.transport;
    // All selected dimensions must exist on the same executed service.
    query = query.contains("metadata_json", { services: [service] });
  }
  const { data, error } = await query.range(offset, offset + remaining);
  if (error) throw new Error("Voice V2 diagnostics could not be read");
  const rows = (data ?? []) as VoiceEventRow[];
  const hasMore = rows.length > remaining;
  return {
    ...projectVoiceEvents(rows.slice(0, remaining)),
    page: { offset, limit: remaining, nextOffset: hasMore && offset + remaining < 3000 ? offset + remaining : null, cappedAt: 3000, capped: hasMore && offset + remaining >= 3000 },
    window: { from: filters.from, to: filters.to },
    summaryScope: "returned_page_not_full_cohort", percentileMethod: "linear_interpolation_(n-1)*p_rounded_ms", source: "voice_turn_events", schemaVersion: 2,
  };
}
