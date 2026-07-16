import { beforeEach, describe, expect, it } from "vitest";
import { getConfiguredSTTServiceInfo } from "./latencyServiceMetadata";
import { resetSTTSettingsCache, saveSTTSettingsLocal } from "./stt";

describe("STT latency metadata contract", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSTTSettingsCache();
  });

  it("reports the shared Deepgram nova-3 baseline", () => {
    saveSTTSettingsLocal({ activeProvider: "deepgram" });

    expect(getConfiguredSTTServiceInfo()).toMatchObject({
      serviceProvider: "Deepgram",
      serviceName: "deepgram",
      model: "nova-3",
      mode: "streaming",
    });
  });

  it("does not apply the Deepgram model to Gamilab", () => {
    saveSTTSettingsLocal({ activeProvider: "gamilab" });

    expect(getConfiguredSTTServiceInfo()).toMatchObject({
      serviceProvider: "Gamilab",
      serviceName: "gamilab",
      model: "gamilab",
      mode: "streaming",
    });
  });
});
