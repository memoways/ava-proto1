import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tts", () => ({
  generateSpeech: vi.fn(),
  playAudioBlob: vi.fn(),
}));

import { generateSpeech, playAudioBlob } from "@/services/tts";
import { TTSQueue } from "@/services/tts/queue";

describe("TTSQueue drain status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports played segments when generation and playback succeed", async () => {
    vi.mocked(generateSpeech).mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
    vi.mocked(playAudioBlob).mockImplementation(async (_blob, onPlaybackStart) => {
      onPlaybackStart?.(0);
      return { status: "played", playbackStartMs: 0, playbackTotalMs: 0 };
    });
    const queue = new TTSQueue();

    queue.enqueue("Bonjour.");
    const result = await queue.drain();

    expect(result).toEqual({
      status: "played",
      playedSegments: 1,
      failedSegments: 0,
      generatedSegments: 1,
      playbackStartMs: 0,
      playbackTotalMs: 0,
      firstPlaybackStartMs: expect.any(Number),
      generationWallMs: expect.any(Number),
    });
  });

  it("reports failure instead of hiding playback errors", async () => {
    vi.mocked(generateSpeech).mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
    vi.mocked(playAudioBlob).mockRejectedValue(new Error("Audio playback failed"));
    const queue = new TTSQueue();

    queue.enqueue("Bonjour.");
    const result = await queue.drain();

    expect(result.status).toBe("failed");
    expect(result.failedSegments).toBe(1);
    expect(result.error?.message).toContain("Audio playback failed");
  });
});
