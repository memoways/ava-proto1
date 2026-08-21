import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const ENVIRONMENT_IDS = [
  "prod",
  "sandbox-ulrich",
  "sandbox-romed",
  "sandbox-benoit",
] as const;

export type EnvironmentId = (typeof ENVIRONMENT_IDS)[number];
export type SessionContextType = "public" | "user_test" | "sandbox" | "internal";

export interface EnvironmentDefinition {
  id: EnvironmentId;
  label: string;
  type: "production" | "sandbox";
}

export const ENVIRONMENTS: readonly EnvironmentDefinition[] = [
  { id: "prod", label: "Production", type: "production" },
  { id: "sandbox-ulrich", label: "Ulrich", type: "sandbox" },
  { id: "sandbox-romed", label: "Romed", type: "sandbox" },
  { id: "sandbox-benoit", label: "Benoît", type: "sandbox" },
];

export interface AdminUserProfile {
  user_id: string;
  display_name: string;
  default_environment_id: EnvironmentId;
  email: string | null;
}

// Only this account may switch between settings environments.
export const ENVIRONMENT_SWITCH_EMAIL = "ulrich.fischer@memoways.com";

export function canSwitchEnvironments(profile: AdminUserProfile | null): boolean {
  return (profile?.email ?? "").trim().toLowerCase() === ENVIRONMENT_SWITCH_EMAIL;
}


export interface RuntimeContext {
  environmentId: EnvironmentId;
  contextType: SessionContextType;
  campaignId: string | null;
  testerLabel: string | null;
  startedByUserId: string | null;
  startedBy: string;
}

const ACTIVE_ENVIRONMENT_KEY = "ava:admin:active-environment";
const CAMPAIGN_KEY = "ava:runtime:campaign";
const TESTER_LABEL_KEY = "ava:runtime:tester-label";

let activeEnvironment: EnvironmentId = "prod";
let runtimeContext: RuntimeContext = {
  environmentId: "prod",
  contextType: "public",
  campaignId: null,
  testerLabel: null,
  startedByUserId: null,
  startedBy: "public",
};

export function isEnvironmentId(value: unknown): value is EnvironmentId {
  return typeof value === "string" && (ENVIRONMENT_IDS as readonly string[]).includes(value);
}

export function normalizeEnvironment(value: unknown): EnvironmentId {
  return isEnvironmentId(value) ? value : "prod";
}

export function getActiveEnvironment(): EnvironmentId {
  return activeEnvironment;
}

export function setActiveEnvironment(environmentId: unknown): EnvironmentId {
  activeEnvironment = normalizeEnvironment(environmentId);
  return activeEnvironment;
}

function activeEnvironmentStorageKey(userId?: string): string {
  return userId ? `${ACTIVE_ENVIRONMENT_KEY}:${userId}` : ACTIVE_ENVIRONMENT_KEY;
}

export function persistAdminEnvironment(environmentId: EnvironmentId, userId?: string): void {
  setActiveEnvironment(environmentId);
  try {
    sessionStorage.setItem(activeEnvironmentStorageKey(userId), environmentId);
  } catch {
    // sessionStorage can be unavailable in private/restricted browsers.
  }
}

export function getPersistedAdminEnvironment(fallback: EnvironmentId, userId?: string): EnvironmentId {
  try {
    return normalizeEnvironment(sessionStorage.getItem(activeEnvironmentStorageKey(userId)) ?? fallback);
  } catch {
    return fallback;
  }
}

export function settingsStorageKey(key: string, environmentId = activeEnvironment): string {
  return `ava:${normalizeEnvironment(environmentId)}:${key}`;
}

export function readEnvironmentStorage(key: string, environmentId = activeEnvironment): string | null {
  const normalized = normalizeEnvironment(environmentId);
  try {
    const namespaced = localStorage.getItem(settingsStorageKey(key, normalized));
    if (namespaced !== null) return namespaced;
    // One-time compatibility bridge: historic unscoped settings are production.
    if (normalized === "prod") {
      const legacy = localStorage.getItem(key);
      if (legacy !== null) {
        localStorage.setItem(settingsStorageKey(key, "prod"), legacy);
        return legacy;
      }
    }
  } catch {
    // Keep hardcoded defaults when storage is unavailable.
  }
  return null;
}

export function writeEnvironmentStorage(key: string, value: string, environmentId = activeEnvironment): void {
  localStorage.setItem(settingsStorageKey(key, normalizeEnvironment(environmentId)), value);
}

export function removeEnvironmentStorage(key: string, environmentId = activeEnvironment): void {
  localStorage.removeItem(settingsStorageKey(key, normalizeEnvironment(environmentId)));
}

function mergeSetting<T>(defaults: T, value: T): T {
  if (defaults && value && typeof defaults === "object" && typeof value === "object") {
    return { ...defaults, ...value };
  }
  return value ?? defaults;
}

export function resolveSettingRows<T>(
  rows: ReadonlyArray<{ environment_id: EnvironmentId; value: T }>,
  requestedEnvironment: unknown,
  defaults: T,
): T {
  const requested = normalizeEnvironment(requestedEnvironment);
  const selected = rows.find((row) => row.environment_id === requested)
    ?? rows.find((row) => row.environment_id === "prod");
  return selected ? mergeSetting(defaults, selected.value) : mergeSetting(defaults, defaults);
}

export async function loadEnvironmentSetting<T>(key: string, defaults: T): Promise<T> {
  const requested = activeEnvironment;
  try {
    const { data, error } = await supabase
      .from("admin_settings" as never)
      .select("environment_id,value")
      .eq("key", key)
      .in("environment_id", requested === "prod" ? ["prod"] : [requested, "prod"]);
    if (!error && Array.isArray(data)) {
      const rows = data as Array<{ environment_id: EnvironmentId; value: T }>;
      if (rows.length > 0) {
        const resolved = resolveSettingRows(rows, requested, defaults);
        writeEnvironmentStorage(key, JSON.stringify(resolved), requested);
        return resolved;
      }
    }
  } catch (error) {
    console.warn(`[Settings] DB load failed for ${key}:`, error);
  }

  try {
    const stored = readEnvironmentStorage(key, requested);
    if (stored) return mergeSetting(defaults, JSON.parse(stored) as T);
  } catch {
    // Ignore malformed browser values.
  }
  return mergeSetting(defaults, defaults);
}

export async function saveEnvironmentSetting<T>(key: string, value: T): Promise<void> {
  const environmentId = activeEnvironment;
  writeEnvironmentStorage(key, JSON.stringify(value), environmentId);
  const { error } = await supabase
    .from("admin_settings" as never)
    .upsert(
      { key, value, environment_id: environmentId, updated_at: new Date().toISOString() } as never,
      { onConflict: "key,environment_id" },
    );
  if (error) throw error;
}

export async function deleteEnvironmentSetting(key: string): Promise<void> {
  const environmentId = activeEnvironment;
  removeEnvironmentStorage(key, environmentId);
  const { error } = await supabase
    .from("admin_settings" as never)
    .delete()
    .eq("key", key)
    .eq("environment_id", environmentId);
  if (error) throw error;
}

export async function getAdminUserProfile(user: User | null): Promise<AdminUserProfile | null> {
  if (!user || user.is_anonymous === true) return null;
  const { data, error } = await supabase
    .from("admin_users" as never)
    .select("user_id,display_name,default_environment_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { user_id: string; display_name: string; default_environment_id: string };
  return {
    user_id: row.user_id,
    display_name: row.display_name,
    default_environment_id: normalizeEnvironment(row.default_environment_id),
  };
}

export function deriveContextType(input: {
  isMember: boolean;
  environmentId: EnvironmentId;
  campaignId?: string | null;
}): SessionContextType {
  if (input.isMember) return input.environmentId === "prod" ? "internal" : "sandbox";
  return input.campaignId ? "user_test" : "public";
}

export function configureRuntimeContext(input: {
  profile: AdminUserProfile | null;
  requestedEnvironment?: unknown;
  campaignId?: string | null;
  testerLabel?: string | null;
}): RuntimeContext {
  const isMember = input.profile !== null;
  const environmentId = isMember ? normalizeEnvironment(input.requestedEnvironment) : "prod";
  const campaignId = isMember ? null : normalizeOptionalSlug(input.campaignId);
  const testerLabel = normalizeTesterLabel(input.testerLabel);
  activeEnvironment = environmentId;
  runtimeContext = {
    environmentId,
    contextType: deriveContextType({ isMember, environmentId, campaignId }),
    campaignId,
    testerLabel,
    startedByUserId: input.profile?.user_id ?? null,
    startedBy: input.profile?.display_name ?? "public",
  };
  return { ...runtimeContext };
}

export function getRuntimeContext(): RuntimeContext {
  return { ...runtimeContext };
}

export function preserveCampaignFromUrl(search: string): { campaignId: string | null; testerLabel: string | null } {
  const params = new URLSearchParams(search);
  const campaignFromUrl = normalizeOptionalSlug(params.get("campaign"));
  const testerFromUrl = normalizeTesterLabel(params.get("tester"));
  try {
    if (campaignFromUrl) sessionStorage.setItem(CAMPAIGN_KEY, campaignFromUrl);
    if (testerFromUrl) sessionStorage.setItem(TESTER_LABEL_KEY, testerFromUrl);
    return {
      campaignId: campaignFromUrl ?? normalizeOptionalSlug(sessionStorage.getItem(CAMPAIGN_KEY)),
      testerLabel: testerFromUrl ?? normalizeTesterLabel(sessionStorage.getItem(TESTER_LABEL_KEY)),
    };
  } catch {
    return { campaignId: campaignFromUrl, testerLabel: testerFromUrl };
  }
}

function normalizeOptionalSlug(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/i.test(value) ? value : null;
}

function normalizeTesterLabel(value: unknown): string | null {
  return typeof value === "string" && /^T\d{2}$/i.test(value) ? value.toUpperCase() : null;
}
