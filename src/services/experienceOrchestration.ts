import { supabase } from "@/integrations/supabase/client";
import { ensureGameAuth } from "@/services/gameAuth";

export interface ExperienceDirectorConfig {
  schemaVersion: 1;
  minimumHandoffTurn: number;
  maximumHandoffsPerSession: 1;
  handoffTarget: "emma";
  directorTimeoutMs: number;
}

export interface ExperienceOrchestrationVersion {
  id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  name: string;
  prompt: string;
  config: ExperienceDirectorConfig;
  source_version_id: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CharacterRuntimeProfile {
  id: string;
  character_key: "max" | "emma";
  display_name: string;
  enabled: boolean;
  notion_character_id: string | null;
  opening_line: string | null;
  portrait_url: string | null;
  tts_provider: string | null;
  tts_voice_id: string | null;
  prompt_validated: boolean;
  rag_validated: boolean;
  qualitative_tests_validated: boolean;
  knowledge_isolation_validated: boolean;
  updated_at: string;
}

export interface PinnedDirectorRuntime {
  versionId: string | null;
  versionNumber: number | null;
  prompt: string | null;
  config: ExperienceDirectorConfig | null;
}

export const DEFAULT_DIRECTOR_CONFIG: ExperienceDirectorConfig = {
  schemaVersion: 1,
  minimumHandoffTurn: 4,
  maximumHandoffsPerSession: 1,
  handoffTarget: "emma",
  directorTimeoutMs: 12_000,
};

export async function listOrchestrationVersions(): Promise<ExperienceOrchestrationVersion[]> {
  const { data, error } = await supabase
    .from("experience_orchestration_versions" as never)
    .select("*")
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ExperienceOrchestrationVersion[];
}

export async function createOrchestrationDraft(input: {
  name: string;
  prompt: string;
  config?: ExperienceDirectorConfig;
  sourceVersionId?: string | null;
}): Promise<ExperienceOrchestrationVersion> {
  const { data, error } = await supabase
    .from("experience_orchestration_versions" as never)
    .insert({
      name: input.name.trim() || "Orchestration GM",
      prompt: input.prompt,
      config: input.config ?? DEFAULT_DIRECTOR_CONFIG,
      source_version_id: input.sourceVersionId ?? null,
      status: "draft",
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ExperienceOrchestrationVersion;
}

export async function updateOrchestrationDraft(
  id: string,
  patch: Pick<ExperienceOrchestrationVersion, "name" | "prompt" | "config">,
): Promise<void> {
  const { error } = await supabase
    .from("experience_orchestration_versions" as never)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw error;
}

export async function publishOrchestrationVersion(id: string): Promise<void> {
  const { error } = await supabase.rpc("publish_experience_orchestration_version" as never, {
    p_version_id: id,
  } as never);
  if (error) throw error;
}

export async function archiveOrchestrationVersion(id: string): Promise<void> {
  const { error } = await supabase
    .from("experience_orchestration_versions" as never)
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id)
    .neq("status", "published");
  if (error) throw error;
}

export async function listCharacterRuntimeProfiles(): Promise<CharacterRuntimeProfile[]> {
  const { data, error } = await supabase
    .from("character_runtime_profiles" as never)
    .select("*")
    .order("character_key");
  if (error) throw error;
  return (data ?? []) as unknown as CharacterRuntimeProfile[];
}

export async function updateCharacterRuntimeProfile(
  id: string,
  patch: Pick<
    CharacterRuntimeProfile,
    | "enabled"
    | "notion_character_id"
    | "opening_line"
    | "portrait_url"
    | "tts_provider"
    | "tts_voice_id"
    | "prompt_validated"
    | "rag_validated"
    | "qualitative_tests_validated"
    | "knowledge_isolation_validated"
  >,
): Promise<void> {
  const { error } = await supabase
    .from("character_runtime_profiles" as never)
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

const runtimeCache = new Map<string, PinnedDirectorRuntime>();

export async function fetchPinnedDirectorRuntime(sessionId: string | null): Promise<PinnedDirectorRuntime> {
  if (!sessionId) return { versionId: null, versionNumber: null, prompt: null, config: null };
  const cached = runtimeCache.get(sessionId);
  if (cached) return cached;
  await ensureGameAuth();
  const { data: pinned, error: pinError } = await supabase.rpc(
    "pin_current_orchestration_version" as never,
    { p_session_id: sessionId } as never,
  );
  if (pinError) throw pinError;
  if (!pinned) {
    const empty = { versionId: null, versionNumber: null, prompt: null, config: null };
    runtimeCache.set(sessionId, empty);
    return empty;
  }
  const { data, error } = await supabase.rpc(
    "get_pinned_orchestration_runtime" as never,
    { p_session_id: sessionId } as never,
  );
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  const runtime: PinnedDirectorRuntime = {
    versionId: typeof row?.version_id === "string" ? row.version_id : String(pinned),
    versionNumber: typeof row?.version_number === "number" ? row.version_number : null,
    prompt: typeof row?.prompt === "string" ? row.prompt : null,
    config: row?.config && typeof row.config === "object"
      ? row.config as unknown as ExperienceDirectorConfig
      : null,
  };
  runtimeCache.set(sessionId, runtime);
  return runtime;
}

export async function getCharacterRuntimeReadiness(character: "max" | "emma"): Promise<{
  characterKey: "max" | "emma";
  displayName: string;
  ready: boolean;
  openingLine: string | null;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
} | null> {
  const { data, error } = await supabase.rpc("get_character_runtime_readiness" as never, {
    p_character_key: character,
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) return null;
  return {
    characterKey: row.character_key === "emma" ? "emma" : "max",
    displayName: typeof row.display_name === "string" ? row.display_name : character,
    ready: row.ready === true,
    openingLine: typeof row.opening_line === "string" ? row.opening_line : null,
    ttsProvider: typeof row.tts_provider === "string" ? row.tts_provider : null,
    ttsVoiceId: typeof row.tts_voice_id === "string" ? row.tts_voice_id : null,
  };
}

export function clearDirectorRuntimeCache(sessionId?: string): void {
  if (sessionId) runtimeCache.delete(sessionId);
  else runtimeCache.clear();
}
