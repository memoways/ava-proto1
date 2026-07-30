import { describe, expect, it, vi } from "vitest";

vi.mock("./providers/heygen", () => ({
  HeyGenStreamingAvatarOutput: class {
    mode = "streaming_avatar";
    provider = "heygen";
  },
}));

vi.mock("./providers/tavus", () => ({
  TavusStreamingAvatarOutput: class {
    mode = "streaming_avatar";
    provider = "tavus";
  },
}));

import { createResponseOutput, listStreamingAvatarProviders } from "./registry";
import { streamingAvatarDefaults } from "./settings";

describe("ResponseOutput registry", () => {
  it("selects local TTS without constructing an avatar provider", async () => {
    const output = await createResponseOutput({
      mode: "tts",
      avatarSettings: streamingAvatarDefaults,
    });

    expect(output.mode).toBe("tts");
    expect(output.provider).toBe("tts");
  });

  it.each(["heygen", "tavus"] as const)("selects the %s provider", async (provider) => {
    const output = await createResponseOutput({
      mode: "streaming_avatar",
      avatarSettings: {
        ...streamingAvatarDefaults,
        activeProvider: provider,
      },
    });

    expect(output.mode).toBe("streaming_avatar");
    expect(output.provider).toBe(provider);
  });

  it("exposes providers through the extensible registry", () => {
    expect(listStreamingAvatarProviders()).toEqual(["heygen", "tavus"]);
  });
});
