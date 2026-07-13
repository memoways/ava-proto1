import { disablePostHog, enablePostHog } from "@/services/posthogService";

export const PRIVACY_CONSENT_VERSION = "2026-07-13";
export const PRIVACY_CONSENT_STORAGE_KEY = "ava_privacy_consent";

/**
 * Internal tests need uninterrupted technical telemetry. The notice remains in
 * the bundle and can be restored for the final experience from Lovable with:
 * VITE_PRIVACY_NOTICE_ENABLED=true.
 */
export function isPrivacyNoticeEnabled(): boolean {
  return import.meta.env.VITE_PRIVACY_NOTICE_ENABLED === "true";
}

export function isInternalAnalyticsMode(): boolean {
  return !isPrivacyNoticeEnabled();
}

export interface PrivacyPreferences {
  version: typeof PRIVACY_CONSENT_VERSION;
  voiceAndStorageAcknowledged: boolean;
  analyticsAllowed: boolean;
  decidedAt: string;
}

let grainModulePromise: Promise<typeof import("@/services/grainAnalytics")> | null = null;
let analyticsPreferenceRevision = 0;

function loadGrainModule() {
  grainModulePromise ??= import("@/services/grainAnalytics");
  return grainModulePromise;
}

export function getPrivacyPreferences(): PrivacyPreferences | null {
  try {
    const raw = localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrivacyPreferences>;
    if (
      parsed.version !== PRIVACY_CONSENT_VERSION ||
      typeof parsed.voiceAndStorageAcknowledged !== "boolean" ||
      typeof parsed.analyticsAllowed !== "boolean" ||
      typeof parsed.decidedAt !== "string"
    ) {
      return null;
    }
    return parsed as PrivacyPreferences;
  } catch {
    return null;
  }
}

export function savePrivacyPreferences(
  choice: Pick<PrivacyPreferences, "voiceAndStorageAcknowledged" | "analyticsAllowed">,
): PrivacyPreferences {
  const preferences: PrivacyPreferences = {
    version: PRIVACY_CONSENT_VERSION,
    voiceAndStorageAcknowledged: choice.voiceAndStorageAcknowledged,
    analyticsAllowed: choice.analyticsAllowed,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  applyAnalyticsPreference(preferences.analyticsAllowed);
  return preferences;
}

export function applyAnalyticsPreference(allowed: boolean): void {
  const revision = ++analyticsPreferenceRevision;
  const effectiveAllowed = isInternalAnalyticsMode() || allowed;
  if (effectiveAllowed) {
    enablePostHog();
    void loadGrainModule().then((grain) => {
      if (revision !== analyticsPreferenceRevision) return;
      grain.enableGrainAnalytics();
    }).catch((error) => {
      console.warn("[Privacy] Optional analytics could not be enabled:", error);
    });
    return;
  }
  // Do not download third-party analytics merely to opt out. If a participant
  // revokes a previous opt-in, the already requested modules are disabled.
  disablePostHog();
  if (grainModulePromise) {
    void grainModulePromise.then((grain) => {
      if (revision !== analyticsPreferenceRevision) return;
      grain.disableGrainAnalytics();
    }).catch(() => { /* modules never initialized */ });
  }
}

export function initializeAnalyticsFromStoredConsent(): void {
  applyAnalyticsPreference(getPrivacyPreferences()?.analyticsAllowed === true);
}

export function clearPrivacyPreferences(): void {
  localStorage.removeItem(PRIVACY_CONSENT_STORAGE_KEY);
  applyAnalyticsPreference(false);
}
