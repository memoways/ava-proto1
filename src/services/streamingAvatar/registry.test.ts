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

vi.mock("./providers/anam", () => ({
  AnamStreamingAvatarOutput: class {
    mode = "streaming_avatar";
    provider = "anam";
  },
}));

vi.mock("./providers/lemonslice", () => ({
  LemonSliceStreamingAvatarOutput: class {
    mode = "streaming_avatar";
    provider = "lemonslice";
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

  it.each(["heygen", "tavus", "anam", "lemonslice"] as const)("selects the %s provider", async (provider) => {
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
    expect(listStreamingAvatarProviders()).toEqual(["heygen", "tavus", "anam", "lemonslice"]);
  });
});

describe("withCanonicalCharacterNames", () => {
  it("never hands 'Eva' to a provider, whatever its type", async () => {
    const { withCanonicalCharacterNames } = await import("./registry");
    const seen: string[] = [];
    const inner = {
      mode: "streaming_avatar" as const,
      provider: "fake",
      externalSessionId: "s1",
      async prepare() {},
      async renderText(text: string) {
        seen.push(text);
        return { status: "played" as const, provider: "fake", firstPlaybackStartMs: 0, playbackTotalMs: 0, generatedSegments: 1, playedSegments: 1, failedSegments: 0, started: true };
      },
      attachMedia() {},
      interrupt() {},
      async dispose() {},
    };
    const wrapped = withCanonicalCharacterNames(inner);
    await wrapped.renderText("Eva, c'est Éva qui t'appelle.");
    expect(seen).toEqual(["Ava, c'est Ava qui t'appelle."]);
    expect(wrapped.provider).toBe("fake");
    expect(wrapped.externalSessionId).toBe("s1");
  });
});
