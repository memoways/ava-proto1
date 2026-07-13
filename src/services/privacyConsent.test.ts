import { beforeEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({
  disableGrainAnalytics: vi.fn(),
  enableGrainAnalytics: vi.fn(),
  disablePostHog: vi.fn(),
  enablePostHog: vi.fn(),
}));

vi.mock("@/services/grainAnalytics", () => ({
  disableGrainAnalytics: analytics.disableGrainAnalytics,
  enableGrainAnalytics: analytics.enableGrainAnalytics,
}));

vi.mock("@/services/posthogService", () => ({
  disablePostHog: analytics.disablePostHog,
  enablePostHog: analytics.enablePostHog,
}));

import {
  PRIVACY_CONSENT_STORAGE_KEY,
  PRIVACY_CONSENT_VERSION,
  clearPrivacyPreferences,
  getPrivacyPreferences,
  initializeAnalyticsFromStoredConsent,
  savePrivacyPreferences,
} from "./privacyConsent";

describe("privacyConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists the required acknowledgement separately from optional analytics", () => {
    const saved = savePrivacyPreferences({
      voiceAndStorageAcknowledged: true,
      analyticsAllowed: false,
    });

    expect(saved).toMatchObject({
      version: PRIVACY_CONSENT_VERSION,
      voiceAndStorageAcknowledged: true,
      analyticsAllowed: false,
    });
    expect(getPrivacyPreferences()).toEqual(saved);
    expect(analytics.disablePostHog).toHaveBeenCalledOnce();
    expect(analytics.enablePostHog).not.toHaveBeenCalled();
    expect(analytics.enableGrainAnalytics).not.toHaveBeenCalled();
  });

  it("enables optional analytics only after opt-in", async () => {
    savePrivacyPreferences({
      voiceAndStorageAcknowledged: true,
      analyticsAllowed: true,
    });

    await vi.waitFor(() => {
      expect(analytics.enablePostHog).toHaveBeenCalledOnce();
      expect(analytics.enableGrainAnalytics).toHaveBeenCalledOnce();
    });
  });

  it("rejects stale consent when the information version changes", () => {
    localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify({
      version: "2025-01-01",
      voiceAndStorageAcknowledged: true,
      analyticsAllowed: true,
      decidedAt: new Date().toISOString(),
    }));

    expect(getPrivacyPreferences()).toBeNull();
    initializeAnalyticsFromStoredConsent();
    expect(analytics.enablePostHog).not.toHaveBeenCalled();
  });

  it("revokes optional analytics when preferences are cleared", async () => {
    savePrivacyPreferences({
      voiceAndStorageAcknowledged: true,
      analyticsAllowed: true,
    });
    await vi.waitFor(() => expect(analytics.enablePostHog).toHaveBeenCalledOnce());
    vi.clearAllMocks();

    clearPrivacyPreferences();

    expect(localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY)).toBeNull();
    await vi.waitFor(() => {
      expect(analytics.disablePostHog).toHaveBeenCalledOnce();
      expect(analytics.disableGrainAnalytics).toHaveBeenCalledOnce();
    });
  });
});
