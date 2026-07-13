import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyPlaybackError, playAudioBlobRobust } from "@/services/audioPlayback";

class FakeAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
}

const originalAudio = globalThis.Audio;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: originalAudio });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
});

function installFakeAudio(audio: FakeAudio) {
  Object.defineProperty(globalThis, "Audio", {
    configurable: true,
    value: vi.fn(() => audio),
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:e2e-audio") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
}

describe("classifyPlaybackError", () => {
  it("classifies autoplay policy failures as locked audio", () => {
    const err = new DOMException("The request is not allowed", "NotAllowedError");

    expect(classifyPlaybackError(err)).toEqual({
      type: "not_allowed",
      name: "NotAllowedError",
      message: "The request is not allowed",
    });
  });

  it("classifies unsupported media decode failures", () => {
    const err = new DOMException("Could not decode", "NotSupportedError");

    expect(classifyPlaybackError(err).type).toBe("not_supported");
  });

  it("lets a long response play to its ended event while playback keeps progressing", async () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    installFakeAudio(audio);
    audio.play.mockImplementation(async () => {
      audio.onplaying?.();
      return undefined;
    });

    const playback = playAudioBlobRobust(new Blob(["long audio"]), 5_000);
    await Promise.resolve();

    for (let second = 0; second < 25; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      audio.ontimeupdate?.();
    }
    audio.onended?.();

    await expect(playback).resolves.toMatchObject({ status: "played" });
    expect(audio.pause).not.toHaveBeenCalled();
  });

  it("still stops a genuinely stalled playback", async () => {
    vi.useFakeTimers();
    const audio = new FakeAudio();
    installFakeAudio(audio);
    audio.play.mockImplementation(async () => {
      audio.onplaying?.();
      return undefined;
    });

    const playback = playAudioBlobRobust(new Blob(["stalled audio"]), 5_000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5_001);

    await expect(playback).resolves.toMatchObject({
      status: "failed",
      errorInfo: { type: "stalled" },
    });
    expect(audio.pause).toHaveBeenCalledOnce();
  });
});
