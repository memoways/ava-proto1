import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rows: [] as Array<{ key: string; environment_id: string; value: unknown; updated_at: string | null }>,
  error: null as { message: string } | null,
  delayMs: 0,
  queries: [] as Array<{ keys: string[]; environments: string[] }>,
}));
const tracked = vi.hoisted(() => [] as Array<{ event: string; props: Record<string, unknown> }>);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query: { keys: string[]; environments: string[] } = { keys: [], environments: [] };
      const builder = {
        select: () => builder,
        in: (column: string, values: string[]) => {
          if (column === "key") query.keys = values;
          if (column === "environment_id") query.environments = values;
          if (query.keys.length && query.environments.length) {
            db.queries.push(query);
            return new Promise((resolve) => setTimeout(() => resolve({
              data: db.error ? null : db.rows.filter((row) => query.keys.includes(row.key) && query.environments.includes(row.environment_id)),
              error: db.error,
            }), db.delayMs));
          }
          return builder;
        },
      };
      return builder;
    },
  },
}));
vi.mock("@/services/posthogService", () => ({
  trackEvent: (event: string, props: Record<string, unknown>) => tracked.push({ event, props }),
}));

import {
  ensureExperienceSettings,
  EXPERIENCE_SETTING_KEYS,
  hydrateExperienceSettings,
  resetExperienceSettingsForTests,
  resolveExperienceSettingRows,
} from "./experienceSettings";
import { setActiveEnvironment, settingsStorageKey } from "./environmentContext";
import { getLLMSettings, getTTSSettings } from "./settingsService";
import { getDeviceServices, resetDeviceServicesCacheForTests } from "./deviceServices";
import { getActiveProviderId } from "./tts/providerSettings";

beforeEach(() => {
  localStorage.clear();
  db.rows = [];
  db.error = null;
  db.delayMs = 0;
  db.queries = [];
  tracked.length = 0;
  resetExperienceSettingsForTests();
  resetDeviceServicesCacheForTests();
  setActiveEnvironment("sandbox-ulrich");
});

describe("resolveExperienceSettingRows", () => {
  it("prefers the environment row, else production, and keeps the latest update as version", () => {
    const resolved = resolveExperienceSettingRows([
      { key: "ava_llm_settings", environment_id: "prod", value: { LLM_MODEL: "prod" }, updated_at: "2026-11-01T00:00:00Z" },
      { key: "ava_llm_settings", environment_id: "sandbox-ulrich", value: { LLM_MODEL: "sandbox" }, updated_at: "2026-11-02T00:00:00Z" },
      { key: "ava_tts_settings", environment_id: "prod", value: { modelId: "x" }, updated_at: "2026-11-05T00:00:00Z" },
    ], "sandbox-ulrich", ["ava_llm_settings", "ava_tts_settings", "ava_tts_active_provider"]);
    expect(resolved.values.get("ava_llm_settings")).toEqual({ LLM_MODEL: "sandbox" });
    expect(resolved.environmentKeys).toEqual(["ava_llm_settings"]);
    expect(resolved.inheritedFromProd).toEqual(["ava_tts_settings"]);
    expect(resolved.defaultKeys).toEqual(["ava_tts_active_provider"]);
    expect(resolved.settingsUpdatedAt).toBe("2026-11-05T00:00:00Z");
  });
});

describe("hydrateExperienceSettings", () => {
  it("a blank browser plays the database LLM and ElevenLabs values (one read-only request)", async () => {
    expect(getLLMSettings().LLM_MODEL).not.toBe("openai/gpt-5.6-luna");
    expect(getTTSSettings().modelId).toBe("eleven_multilingual_v2");
    db.rows = [
      { key: "ava_llm_settings", environment_id: "sandbox-ulrich", value: { LLM_MODEL: "openai/gpt-5.6-luna" }, updated_at: "2026-11-08T15:42:00Z" },
      { key: "ava_tts_settings", environment_id: "sandbox-ulrich", value: { modelId: "eleven_v4_turbo", stability: 0.38, style: 0.38 }, updated_at: "2026-11-08T15:40:00Z" },
      { key: "ava_tts_active_provider", environment_id: "prod", value: { provider: "gradium" }, updated_at: null },
      { key: "ava_device_services", environment_id: "sandbox-ulrich", value: { smartphone: { output: "settings" } }, updated_at: null },
    ];
    const state = await hydrateExperienceSettings();
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].keys).toEqual([...EXPERIENCE_SETTING_KEYS]);
    expect(db.queries[0].environments).toEqual(["sandbox-ulrich", "prod"]);
    expect(state).toMatchObject({ source: "database", settingsUpdatedAt: "2026-11-08T15:42:00Z", inheritedFromProd: ["ava_tts_active_provider"] });
    expect(getLLMSettings().LLM_MODEL).toBe("openai/gpt-5.6-luna");
    expect(getTTSSettings()).toMatchObject({ modelId: "eleven_v4_turbo", stability: 0.38, style: 0.38 });
    expect(getActiveProviderId()).toBe("gradium");
    // In-memory device services cache follows the database too.
    expect(getDeviceServices().smartphone.output).toBe("settings");
  });

  it("a key without any row drops a stale local copy (code defaults apply)", async () => {
    localStorage.setItem(settingsStorageKey("ava_tts_settings", "sandbox-ulrich"), JSON.stringify({ modelId: "eleven_flash_v2_5" }));
    await hydrateExperienceSettings();
    expect(getTTSSettings().modelId).toBe("eleven_multilingual_v2");
  });
});

describe("ensureExperienceSettings", () => {
  it("falls back explicitly on error, keeping the local copy, and reports it", async () => {
    localStorage.setItem(settingsStorageKey("ava_llm_settings", "sandbox-ulrich"), JSON.stringify({ LLM_MODEL: "openai/gpt-5.6-luna" }));
    db.error = { message: "network down" };
    const state = await ensureExperienceSettings({ sessionContext: "prepare_call" });
    expect(state).toMatchObject({ source: "fallback", reason: "error" });
    expect(getLLMSettings().LLM_MODEL).toBe("openai/gpt-5.6-luna");
    expect(tracked).toEqual([expect.objectContaining({
      event: "prd4_settings_fallback",
      props: expect.objectContaining({ reason: "error", context: "prepare_call", environment_id: "sandbox-ulrich" }),
    })]);
  });

  it("never waits past its bound", async () => {
    db.delayMs = 200;
    const state = await ensureExperienceSettings({ timeoutMs: 20 });
    expect(state).toMatchObject({ source: "fallback", reason: "timeout" });
    expect(tracked[0]?.event).toBe("prd4_settings_fallback");
  });

  it("shares the mount load and reloads after an environment change", async () => {
    await ensureExperienceSettings();
    await ensureExperienceSettings();
    expect(db.queries).toHaveLength(1);
    setActiveEnvironment("prod");
    await ensureExperienceSettings();
    expect(db.queries).toHaveLength(2);
    expect(db.queries[1].environments).toEqual(["prod"]);
    expect(tracked).toEqual([]);
  });
});
