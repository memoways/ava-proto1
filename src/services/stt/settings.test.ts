import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_STT_SETTINGS,
  getSTTProvider,
  getSTTSettings,
  normalizeSTTProviderId,
  resetSTTSettingsCache,
  saveSTTSettingsLocal,
} from "./settings";

describe("STT settings", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSTTSettingsCache();
  });

  it("defaults to Deepgram when no provider has been configured", () => {
    expect(getSTTSettings()).toEqual(DEFAULT_STT_SETTINGS);
    expect(getSTTProvider()).toBe("deepgram");
  });

  it("falls back to Deepgram for unsupported stored providers", () => {
    localStorage.setItem("ava_stt_settings", JSON.stringify({ activeProvider: "unknown" }));

    expect(getSTTSettings().activeProvider).toBe("deepgram");
    expect(normalizeSTTProviderId("unknown")).toBe("deepgram");
  });

  it("stores supported providers locally for fast runtime reads", () => {
    const saved = saveSTTSettingsLocal({ activeProvider: "gamilab" });

    expect(saved.activeProvider).toBe("gamilab");
    expect(getSTTProvider()).toBe("gamilab");
  });
});
