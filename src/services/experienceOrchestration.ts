import { supabase } from "@/integrations/supabase/client";
import { ensureGameAuth } from "@/services/gameAuth";
import type { ExperienceDirectorConfig } from "@/types";
import { getActiveEnvironment } from "@/services/environmentContext";
import { normalizeExperienceFrameConfig } from "@/services/experienceFrame";
import { AVA_CHARACTER_REGISTRY } from "@/services/characterRegistry";

/** Personnages activables : ceux marqués actifs dans le registre central. */
export function registryActiveCharacterKeys(): string[] {
  return AVA_CHARACTER_REGISTRY.entries.filter((entry) => entry.availability === "active").map((entry) => entry.key);
}

export function normalizeActiveCharacters(raw: unknown): string[] {
  const allowed = registryActiveCharacterKeys();
  if (!Array.isArray(raw)) return allowed;
  const picked = allowed.filter((key) => raw.includes(key));
  return picked.length ? picked : allowed;
}

export type { ExperienceDirectorConfig } from "@/types";

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
  environment_id: string;
}

export interface CharacterRuntimeProfile {
  id: string;
  character_key: string;
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
  environment_id: string;
}

export interface PinnedDirectorRuntime {
  versionId: string | null;
  versionNumber: number | null;
  prompt: string | null;
  config: ExperienceDirectorConfig | null;
}

/** Repris de l'ancienne fiche Notion « Game Master » (archivée), réécrit pour le cadre actuel. */
export const DEFAULT_PROJECT_CONTEXT = `« Où est Ava ? » est une expérience narrative vocale : le joueur appelle, à distance, des proches d'Ava, disparue. Plusieurs personnages peuvent être joignables ; chacun ne sait que ce que sa fiche lui donne.
Le Game Master est invisible : il ne parle jamais au joueur, il oriente le personnage actif au tour suivant.
Le joueur habite une scène, pas une interface : tout reste diégétique, jamais de méta sur l'IA ou la technique.
Principes : une idée et une question à la fois ; ne pas expliquer le monde, le faire vivre ; « oui, et… » plutôt que bloquer ; révéler par petites marches, un mystère à la fois ; laisser des silences.
Le détail du monde narratif vient de la recherche documentaire ; ne pas l'inventer.`;

export const DEFAULT_OPEN_QUESTIONS: string[] = [
  "Le joueur parle du film qu'il a vu : le personnage le connaît-il, et comment y réagit-il ?",
  "Le joueur demande qui il est censé être ou pourquoi il appelle.",
];

export const DEFAULT_DIRECTOR_CONFIG: ExperienceDirectorConfig = {
  schemaVersion: 1,
  minimumHandoffTurn: 4,
  maximumHandoffsPerSession: 8,
  minimumTurnsBetweenHandoffs: 2,
  handoffTarget: "either",
  directorTimeoutMs: 12_000,
  editor: {
    tone: "balanced",
    guidanceLength: "balanced",
    priorities: ["narrative_continuity", "player_engagement", "safety", "pace"],
    allowHandoffs: true,
    allowCinematics: true,
    customInstructions: "",
    handoffRules: [],
    projectContext: DEFAULT_PROJECT_CONTEXT,
    openQuestions: DEFAULT_OPEN_QUESTIONS,
    guardrails: { falseStatusGuidance: true, derailTolerance: "medium", opennessPace: "balanced" },
  },
};

export const PROJECT_CONTEXT_MAX_CHARS = 1500;
export const OPEN_QUESTION_MAX_CHARS = 200;
export const OPEN_QUESTIONS_MAX = 8;

function normalizeGuardrails(raw: unknown): ExperienceDirectorConfig["editor"]["guardrails"] {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    falseStatusGuidance: value.falseStatusGuidance !== false,
    derailTolerance: value.derailTolerance === "low" || value.derailTolerance === "high" ? value.derailTolerance : "medium",
    opennessPace: value.opennessPace === "slow" || value.opennessPace === "fast" ? value.opennessPace : "balanced",
  };
}

function normalizeOpenQuestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_OPEN_QUESTIONS;
  // Lignes conservées telles quelles pendant la saisie ; les vides sont ignorées à la construction du prompt.
  return raw.map((item) => String(item).slice(0, OPEN_QUESTION_MAX_CHARS)).slice(0, OPEN_QUESTIONS_MAX);
}

function sanitizeHandoffRules(raw: unknown): ExperienceDirectorConfig["editor"]["handoffRules"] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const value = entry as { targetCharacter?: unknown; themes?: unknown; topics?: unknown };
    const targetCharacter: "max" | "emma" | null = value.targetCharacter === "max" || value.targetCharacter === "emma"
      ? value.targetCharacter
      : null;
    if (!targetCharacter) return [];
    const themes = Array.isArray(value.themes) ? value.themes.map((item) => String(item).trim().toLowerCase()).filter(Boolean).slice(0, 8) : [];
    const topics = Array.isArray(value.topics) ? value.topics.map((item) => String(item).trim().toLowerCase()).filter(Boolean).slice(0, 8) : [];
    if (!themes.length && !topics.length) return [];
    return [{ targetCharacter, themes, topics }];
  }).slice(0, 12);
}

export function normalizeDirectorConfig(value: Partial<ExperienceDirectorConfig> | null | undefined): ExperienceDirectorConfig {
  const editor = value?.editor;
  const priorities = editor?.priorities?.filter((priority) =>
    priority === "narrative_continuity"
    || priority === "player_engagement"
    || priority === "safety"
    || priority === "pace"
  );
  const rawMaxHandoffs = Number(value?.maximumHandoffsPerSession);
  return {
    ...DEFAULT_DIRECTOR_CONFIG,
    ...value,
    minimumHandoffTurn: Math.min(20, Math.max(1, Math.round(Number(value?.minimumHandoffTurn) || DEFAULT_DIRECTOR_CONFIG.minimumHandoffTurn))),
    maximumHandoffsPerSession: Number.isFinite(rawMaxHandoffs)
      ? Math.min(20, Math.max(0, Math.round(rawMaxHandoffs)))
      : DEFAULT_DIRECTOR_CONFIG.maximumHandoffsPerSession,
    minimumTurnsBetweenHandoffs: Math.min(10, Math.max(1, Math.round(Number(value?.minimumTurnsBetweenHandoffs) || DEFAULT_DIRECTOR_CONFIG.minimumTurnsBetweenHandoffs))),
    directorTimeoutMs: Math.min(30_000, Math.max(3_000, Math.round(Number(value?.directorTimeoutMs) || DEFAULT_DIRECTOR_CONFIG.directorTimeoutMs))),
    handoffTarget: "either",
    editor: {
      ...DEFAULT_DIRECTOR_CONFIG.editor,
      ...editor,
      priorities: priorities?.length ? priorities : DEFAULT_DIRECTOR_CONFIG.editor.priorities,
      customInstructions: editor?.customInstructions?.trim() ?? "",
      handoffRules: sanitizeHandoffRules(editor?.handoffRules ?? DEFAULT_DIRECTOR_CONFIG.editor.handoffRules),
      projectContext: typeof editor?.projectContext === "string"
        ? editor.projectContext.trim().slice(0, PROJECT_CONTEXT_MAX_CHARS)
        : DEFAULT_PROJECT_CONTEXT,
      openQuestions: editor?.openQuestions === undefined ? DEFAULT_OPEN_QUESTIONS : normalizeOpenQuestions(editor.openQuestions),
      guardrails: normalizeGuardrails(editor?.guardrails),
    },
    frame: normalizeExperienceFrameConfig(value?.frame),
    activeCharacters: normalizeActiveCharacters(value?.activeCharacters),
  };
}

export async function listOrchestrationVersions(): Promise<ExperienceOrchestrationVersion[]> {
  const { data, error } = await supabase
    .from("experience_orchestration_versions" as never)
    .select("*")
    .eq("environment_id", getActiveEnvironment())
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
      config: normalizeDirectorConfig(input.config),
      source_version_id: input.sourceVersionId ?? null,
      status: "draft",
      environment_id: getActiveEnvironment(),
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
    .update({ ...patch, config: normalizeDirectorConfig(patch.config), updated_at: new Date().toISOString() } as never)
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
    .eq("environment_id", getActiveEnvironment())
    .order("character_key");
  if (error) throw error;
  return (data ?? []) as unknown as CharacterRuntimeProfile[];
}

export async function updateCharacterRuntimeProfile(
  id: string,
  patch: Pick<
    CharacterRuntimeProfile,
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

export async function updateCharacterRuntimeActivation(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("character_runtime_profiles" as never)
    .update({ enabled, updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
}

export interface CharacterAutoReadiness {
  characterId: string | null;
  characterName: string | null;
  hasPrompt: boolean;
  ragChunks: number;
}

/**
 * Resolves, per runtime profile, the facts that already live in the database:
 * Notion character row, compiled prompt, and isolated RAG corpus size.
 */
export async function fetchCharacterAutoReadiness(
  displayNames: string[],
): Promise<Record<string, CharacterAutoReadiness>> {
  const result: Record<string, CharacterAutoReadiness> = {};
  for (const name of displayNames) {
    result[name] = { characterId: null, characterName: null, hasPrompt: false, ragChunks: 0 };
  }
  const { data: characters, error } = await supabase.from("characters").select("id, name");
  if (error) throw error;
  const rows = (characters ?? []) as Array<{ id: string; name: string }>;

  for (const name of displayNames) {
    const needle = name.trim().toLowerCase();
    const match = rows.find((row) => (row.name ?? "").toLowerCase().replace(/^[^a-z]*/, "").startsWith(needle));
    if (!match) continue;
    result[name].characterId = match.id;
    result[name].characterName = match.name;

    const [{ data: promptRow }, { count }] = await Promise.all([
      supabase.from("character_prompts")
        .select("character_id")
        .eq("character_id", match.id)
        .in("environment_id", getActiveEnvironment() === "prod" ? ["prod"] : [getActiveEnvironment(), "prod"])
        .limit(1)
        .maybeSingle(),
      supabase
        .from("embeddings")
        .select("id", { count: "exact", head: true })
        .eq("character_id", match.id),
    ]);
    result[name].hasPrompt = Boolean(promptRow);
    result[name].ragChunks = count ?? 0;
  }
  return result;
}

/** Uploads a portrait to the private admin bucket and returns a long-lived signed URL. */
export async function uploadCharacterPortrait(
  characterKey: string,
  file: File,
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${characterKey}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("character-portraits")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase.storage
    .from("character-portraits")
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Lien du portrait indisponible");
  return data.signedUrl;
}

const runtimeCache = new Map<string, PinnedDirectorRuntime>();
const runtimeInFlight = new Map<string, Promise<PinnedDirectorRuntime>>();
const runtimeCacheEpoch = new Map<string, number>();

export async function fetchPinnedDirectorRuntime(sessionId: string | null): Promise<PinnedDirectorRuntime> {
  if (!sessionId) return { versionId: null, versionNumber: null, prompt: null, config: null };
  const cached = runtimeCache.get(sessionId);
  if (cached) return cached;
  const pending = runtimeInFlight.get(sessionId);
  if (pending) return pending;
  const requestEpoch = runtimeCacheEpoch.get(sessionId) ?? 0;
  runtimeCacheEpoch.set(sessionId, requestEpoch);
  const request = (async () => {
    await ensureGameAuth();
    const { data: pinned, error: pinError } = await supabase.rpc(
      "pin_current_orchestration_version" as never,
      { p_session_id: sessionId } as never,
    );
    if (pinError) throw pinError;
    if (!pinned) {
      const empty = { versionId: null, versionNumber: null, prompt: null, config: null };
      if (runtimeCacheEpoch.get(sessionId) === requestEpoch) runtimeCache.set(sessionId, empty);
      return empty;
    }
    const { data, error } = await supabase.rpc(
      "get_pinned_orchestration_runtime" as never,
      { p_session_id: sessionId } as never,
    );
    if (error) throw error;
    const rows = (data ?? null) as unknown as Record<string, unknown>[] | null;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    const runtime: PinnedDirectorRuntime = {
      versionId: typeof row?.version_id === "string" ? row.version_id : String(pinned),
      versionNumber: typeof row?.version_number === "number" ? row.version_number : null,
      prompt: typeof row?.prompt === "string" ? row.prompt : null,
      config: row?.config && typeof row.config === "object"
        ? normalizeDirectorConfig(row.config as Partial<ExperienceDirectorConfig>)
        : null,
    };
    if (runtimeCacheEpoch.get(sessionId) === requestEpoch) runtimeCache.set(sessionId, runtime);
    return runtime;
  })();
  runtimeInFlight.set(sessionId, request);
  void request.finally(() => {
    if (runtimeInFlight.get(sessionId) === request) runtimeInFlight.delete(sessionId);
  }).catch(() => {});
  return request;
}

export interface CharacterRuntimeReadiness {
  characterKey: "max" | "emma";
  displayName: string;
  enabled: boolean;
  ready: boolean;
  characterId: string | null;
  notionPageId: string | null;
  environmentId: string | null;
  promptUpdatedAt: string | null;
  openingLine: string | null;
  portraitUrl: string | null;
  ttsProvider: string | null;
  ttsVoiceId: string | null;
  situationSummary: string | null;
}

export async function getCharacterRuntimeReadiness(character: "max" | "emma"): Promise<CharacterRuntimeReadiness | null> {
  const { data, error } = await supabase.rpc("get_character_runtime_readiness_for_environment" as never, {
    p_character_key: character,
    p_environment_id: getActiveEnvironment(),
  } as never);
  if (error) throw error;
  const rows = (data ?? null) as unknown as Record<string, unknown>[] | null;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return null;
  if (row.character_key !== character) throw new Error("Runtime character attribution mismatch");
  return {
    characterKey: character,
    displayName: typeof row.display_name === "string" ? row.display_name : character,
    // Older RPC rows omit `enabled`; treat that as on so Orchestration can
    // actually offer Emma before the full qualitative checklist is ticked.
    enabled: row.enabled !== false,
    ready: row.ready === true,
    characterId: typeof row.character_id === "string" ? row.character_id : null,
    notionPageId: typeof row.notion_page_id === "string" ? row.notion_page_id : null,
    environmentId: typeof row.environment_id === "string" ? row.environment_id : null,
    promptUpdatedAt: typeof row.prompt_updated_at === "string" ? row.prompt_updated_at : null,
    openingLine: typeof row.opening_line === "string" ? row.opening_line : null,
    portraitUrl: typeof row.portrait_url === "string" ? row.portrait_url : null,
    ttsProvider: typeof row.tts_provider === "string" ? row.tts_provider : null,
    ttsVoiceId: typeof row.tts_voice_id === "string" ? row.tts_voice_id : null,
    situationSummary: typeof row.situation_summary === "string" ? row.situation_summary : null,
  };
}

export function clearDirectorRuntimeCache(sessionId?: string): void {
  if (sessionId) {
    runtimeCache.delete(sessionId);
    runtimeInFlight.delete(sessionId);
    runtimeCacheEpoch.set(sessionId, (runtimeCacheEpoch.get(sessionId) ?? 0) + 1);
  } else {
    runtimeCache.clear();
    runtimeInFlight.clear();
    for (const sessionKey of runtimeCacheEpoch.keys()) {
      runtimeCacheEpoch.set(sessionKey, (runtimeCacheEpoch.get(sessionKey) ?? 0) + 1);
    }
  }
}
