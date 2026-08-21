import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import {
  configureRuntimeContext,
  deriveContextType,
  getPersistedAdminEnvironment,
  normalizeEnvironment,
  persistAdminEnvironment,
  readEnvironmentStorage,
  resolveSettingRows,
  settingsStorageKey,
  writeEnvironmentStorage,
} from "./environmentContext";

describe("environment settings context", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("normalizes unknown environment slugs to prod", () => {
    expect(normalizeEnvironment("sandbox-romed")).toBe("sandbox-romed");
    expect(normalizeEnvironment("attacker-env")).toBe("prod");
  });

  it("isolates browser settings for every environment", () => {
    expect(settingsStorageKey("ava_tts_settings", "sandbox-ulrich"))
      .toBe("ava:sandbox-ulrich:ava_tts_settings");
    writeEnvironmentStorage("ava_tts_settings", "ulrich", "sandbox-ulrich");
    writeEnvironmentStorage("ava_tts_settings", "prod", "prod");
    expect(readEnvironmentStorage("ava_tts_settings", "sandbox-ulrich")).toBe("ulrich");
    expect(readEnvironmentStorage("ava_tts_settings", "prod")).toBe("prod");
  });

  it("isolates the persisted admin selection between named accounts", () => {
    persistAdminEnvironment("sandbox-ulrich", "user-ulrich");
    persistAdminEnvironment("sandbox-benoit", "user-benoit");
    expect(getPersistedAdminEnvironment("prod", "user-ulrich")).toBe("sandbox-ulrich");
    expect(getPersistedAdminEnvironment("prod", "user-benoit")).toBe("sandbox-benoit");
  });

  it("derives the four supported session context types", () => {
    expect(deriveContextType({ isMember: false, environmentId: "prod" })).toBe("public");
    expect(deriveContextType({ isMember: false, environmentId: "prod", campaignId: "sept" })).toBe("user_test");
    expect(deriveContextType({ isMember: true, environmentId: "sandbox-benoit" })).toBe("sandbox");
    expect(deriveContextType({ isMember: true, environmentId: "prod" })).toBe("internal");
  });

  it("locks non-members to prod even when a sandbox is requested", () => {
    expect(configureRuntimeContext({ profile: null, requestedEnvironment: "sandbox-benoit" }))
      .toMatchObject({ environmentId: "prod", contextType: "public" });
  });

  it("resolves requested environment, then prod, then hardcoded defaults", () => {
    const rows = [{ environment_id: "prod" as const, value: { provider: "elevenlabs" } }];
    expect(resolveSettingRows(rows, "sandbox-romed", { provider: "default" })).toEqual({ provider: "elevenlabs" });
    expect(resolveSettingRows([
      ...rows,
      { environment_id: "sandbox-romed" as const, value: { provider: "gradium" } },
    ], "sandbox-romed", { provider: "default" })).toEqual({ provider: "gradium" });
    expect(resolveSettingRows([], "unknown", { provider: "default" })).toEqual({ provider: "default" });
  });
});
