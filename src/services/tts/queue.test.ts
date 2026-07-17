import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tts", () => ({
  generateSpeech: vi.fn(),
  playAudioBlob: vi.fn(),
  // null = provider without streaming → the queue takes the classic blob path.
  tryCreateStreamingPlayback: vi.fn(() => null),
}));

import { generateSpeech, playAudioBlob, tryCreateStreamingPlayback } from "@/services/tts";
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

  it("aborts in-flight generation when the owning turn is cancelled", async () => {
    vi.mocked(generateSpeech).mockImplementation((_text, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const queue = new TTSQueue();

    queue.enqueue("Bonjour.");
    await Promise.resolve();
    queue.cancel();
    const result = await queue.drain();

    expect(result.status).toBe("cancelled");
    expect(vi.mocked(generateSpeech).mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("limits parallel generation to two segments while keeping playback ordered", async () => {
    const resolvers: Array<(blob: Blob) => void> = [];
    let active = 0;
    let maxActive = 0;
    vi.mocked(generateSpeech).mockImplementation(() => new Promise<Blob>((resolve) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      resolvers.push((blob) => {
        active -= 1;
        resolve(blob);
      });
    }));
    vi.mocked(playAudioBlob).mockResolvedValue({ status: "played", playbackStartMs: 0, playbackTotalMs: 0 });
    const queue = new TTSQueue({ maxConcurrentGenerations: 2 });

    for (const text of ["Première phrase.", "Deuxième phrase.", "Troisième phrase.", "Quatrième phrase."]) {
      queue.enqueue(text);
    }
    const drained = queue.drain();

    await vi.waitFor(() => expect(vi.mocked(generateSpeech)).toHaveBeenCalledTimes(2));
    resolvers[0](new Blob(["one"]));
    await vi.waitFor(() => expect(vi.mocked(generateSpeech)).toHaveBeenCalledTimes(3));
    resolvers[1](new Blob(["two"]));
    await vi.waitFor(() => expect(vi.mocked(generateSpeech)).toHaveBeenCalledTimes(4));
    resolvers[2](new Blob(["three"]));
    resolvers[3](new Blob(["four"]));

    await expect(drained).resolves.toMatchObject({ status: "played", playedSegments: 4 });
    expect(maxActive).toBe(2);
  });

  it("plays streaming handles sequentially, opening each gate in turn", async () => {
    const openOrder: string[] = [];
    const makeHandle = (label: string) => {
      let resolveFinished!: (v: { playbackTotalMs: number }) => void;
      const finished = new Promise<{ playbackTotalMs: number }>((res) => { resolveFinished = res; });
      return {
        handle: {
          open: vi.fn(() => openOrder.push(label)),
          started: Promise.resolve(),
          finished,
          generationDone: Promise.resolve({ provider: "gradium", transport: "websocket" }),
          cancel: vi.fn(),
        },
        endPlayback: () => resolveFinished({ playbackTotalMs: 100 }),
      };
    };
    const first = makeHandle("first");
    const second = makeHandle("second");
    const handles = [first, second];
    vi.mocked(tryCreateStreamingPlayback).mockImplementation(() => handles.shift()!.handle as never);

    const queue = new TTSQueue();
    queue.enqueue("Première phrase.");
    queue.enqueue("Deuxième phrase.");
    const drained = queue.drain();

    await vi.waitFor(() => expect(openOrder).toEqual(["first"]));
    expect(second.handle.open).not.toHaveBeenCalled();
    first.endPlayback();
    await vi.waitFor(() => expect(openOrder).toEqual(["first", "second"]));
    second.endPlayback();

    await expect(drained).resolves.toMatchObject({ status: "played", playedSegments: 2, generatedSegments: 2 });
    expect(vi.mocked(generateSpeech)).not.toHaveBeenCalled();
  });
});
