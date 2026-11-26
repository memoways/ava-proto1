import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ mse: true, blocked: false, context: true, format: "mp3_44100_128", managedOnly: false, mseFailed: false }));
vi.mock("@/services/settingsService", () => ({
  getTTSSettings: () => ({ modelId: "eleven_v4_turbo", style: 0.3, stability: 0.4, speed: 1, outputFormat: state.format }),
}));
vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock("@/services/audioPlayback", () => ({
  getSharedAudioContext: () => (state.context ? ({}) : null),
  isMediaElementAutoplayBlocked: () => state.blocked,
  noteMediaElementAutoplayBlocked: vi.fn(),
  playAudioBlobRobust: vi.fn(),
}));
const mp3 = vi.hoisted(() => vi.fn(() => ({ kind: "mse" })));
const pcm = vi.hoisted(() => vi.fn(() => ({ kind: "pcm" })));
vi.mock("@/services/tts/elevenLabsStreamPlayer", () => ({
  createElevenLabsStreamingPlayback: mp3,
  resolveMp3MediaSource: () => (state.mse ? MediaSource : null),
  isManagedMediaSourceOnly: () => state.managedOnly,
  hasMp3StreamPlaybackFailed: () => state.mseFailed,
}));
vi.mock("@/services/tts/elevenLabsPcmPlayer", () => ({ createElevenLabsPcmPlayback: pcm }));

import { elevenLabsProvider } from "./elevenlabs";

class MediaSource {}

describe("ElevenLabs streaming route (latency lot 1)", () => {
  beforeEach(() => {
    Object.assign(state, { mse: true, blocked: false, context: true, format: "mp3_44100_128", managedOnly: false, mseFailed: false });
    mp3.mockClear();
    pcm.mockClear();
  });

  it("keeps the MP3 MediaSource stream where it plays", () => {
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toEqual({ kind: "mse" });
    expect(pcm).not.toHaveBeenCalled();
  });

  it("streams PCM through Web Audio on an engine without MediaSource MP3", () => {
    state.mse = false;
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toEqual({ kind: "pcm" });
    expect(mp3).not.toHaveBeenCalled();
  });

  it("streams PCM once <audio> was refused outside a gesture (iPhone hands-free)", () => {
    state.blocked = true;
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toEqual({ kind: "pcm" });
  });

  it("routes the next lines to PCM once an MP3 stream failed before any sound (lot 1 bis)", () => {
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toEqual({ kind: "mse" });
    state.mseFailed = true;
    expect(elevenLabsProvider.createStreamingPlayback!("Suite.", {})).toEqual({ kind: "pcm" });
    expect(mp3).toHaveBeenCalledTimes(1);
  });

  it("prefers PCM where only ManagedMediaSource streams MP3 (iPhone)", () => {
    state.managedOnly = true;
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toEqual({ kind: "pcm" });
    expect(mp3).not.toHaveBeenCalled();
  });

  it("keeps the blob path without any AudioContext, for auditions, the opening cache and non-MP3 formats", () => {
    state.mse = false;
    state.context = false;
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toBeNull();
    state.context = true;
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", { speechAudition: true } as never)).toBeNull();
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", { cacheOpening: true } as never)).toBeNull();
    state.format = "pcm_44100";
    expect(elevenLabsProvider.createStreamingPlayback!("Bonjour.", {})).toBeNull();
  });
});
