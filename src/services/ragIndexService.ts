import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import {
  RAG_EMBEDDING_PROFILES,
  RAG_EMBEDDING_PROFILE_IDS,
  getRagEmbeddingProfile,
  type RagEmbeddingProfileId,
} from "../../supabase/functions/_shared/ragProfiles";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export { RAG_EMBEDDING_PROFILES, getRagEmbeddingProfile };
export type { RagEmbeddingProfileId };

export interface RagIndexState {
  id: boolean;
  active_profile: RagEmbeddingProfileId;
  previous_profile: RagEmbeddingProfileId | null;
  provider: "voyage" | "openai";
  document_model: string;
  query_model: string;
  endpoint: "embeddings" | "contextualizedembeddings";
  dimension: number;
  dtype: string;
  chunking_strategy: string;
  chunk_size_chars: number;
  chunk_overlap_chars: number;
  total_chunks: number;
  status: "active" | "building" | "failed";
  last_rebuild_at: string | null;
  updated_at: string;
}

export interface RagRuntimeMetrics {
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
  missRate: number | null;
  lastMeasuredAt: string | null;
}

export interface RagIndexDashboardData {
  state: RagIndexState | null;
  profileCounts: Partial<Record<RagEmbeddingProfileId, number>>;
  metrics: RagRuntimeMetrics;
  migrationMissing: boolean;
}

interface VoiceTurnMetricRow {
  t_rag_total_ms: number | null;
  rag_matches_count: number | null;
  created_at: string;
}

function percentile(sortedValues: number[], ratio: number): number | null {
  if (!sortedValues.length) return null;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[index];
}

export function summarizeRagRuntimeMetrics(rows: VoiceTurnMetricRow[]): RagRuntimeMetrics {
  const measured = rows.filter((row) => typeof row.t_rag_total_ms === "number");
  const timings = measured.map((row) => row.t_rag_total_ms as number).sort((a, b) => a - b);
  const withMatchCount = rows.filter((row) => typeof row.rag_matches_count === "number");
  const misses = withMatchCount.filter((row) => row.rag_matches_count === 0).length;
  return {
    sampleSize: measured.length,
    p50Ms: percentile(timings, 0.5),
    p95Ms: percentile(timings, 0.95),
    missRate: withMatchCount.length ? misses / withMatchCount.length : null,
    lastMeasuredAt: rows[0]?.created_at ?? null,
  };
}

export async function loadRagIndexDashboardData(): Promise<RagIndexDashboardData> {
  // The local generated Database type is refreshed by Lovable after applying the migration.
  // A generic client keeps this migration-compatible code typed in the meantime.
  const client = supabase as unknown as SupabaseClient;
  const [stateResult, telemetryResult, profileCountResults] = await Promise.all([
    client.from("rag_index_state").select("*").eq("id", true).maybeSingle(),
    client
      .from("voice_turn_events")
      .select("t_rag_total_ms, rag_matches_count, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    Promise.all(RAG_EMBEDDING_PROFILE_IDS.map(async (profileId) => {
      const result = await client
        .from("embeddings")
        .select("id", { count: "exact", head: true })
        .eq("embedding_profile", profileId);
      return { profileId, ...result };
    })),
  ]);

  const profileCounts: Partial<Record<RagEmbeddingProfileId, number>> = {};
  for (const result of profileCountResults) {
    if (!result.error) profileCounts[result.profileId] = result.count || 0;
  }

  return {
    state: stateResult.data as RagIndexState | null,
    profileCounts,
    metrics: summarizeRagRuntimeMetrics((telemetryResult.data || []) as VoiceTurnMetricRow[]),
    migrationMissing: Boolean(stateResult.error),
  };
}

export interface RagProfileBuildResult {
  success: boolean;
  rag_profile: RagEmbeddingProfileId;
  activated_profile: RagEmbeddingProfileId | null;
  profile_embeddings_in_db: number;
  characters_synced: number;
  latency_ms: number;
  error?: string;
}

export async function buildAndActivateRagProfile(profileId: RagEmbeddingProfileId): Promise<RagProfileBuildResult> {
  return callRagProfileAdminAction({
    databases: { characters: AVA_NOTION_DATABASES.characters },
    mode: "rag_only",
    rag_profile: profileId,
    activate_profile: true,
    wipe_all: true,
  });
}

export async function activateExistingRagProfile(profileId: RagEmbeddingProfileId): Promise<RagProfileBuildResult> {
  return callRagProfileAdminAction({
    rag_profile: profileId,
    activate_existing_profile: true,
  });
}

async function callRagProfileAdminAction(body: Record<string, unknown>): Promise<RagProfileBuildResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Rebuild RAG impossible (${response.status})`);
  }
  return payload as RagProfileBuildResult;
}
