import { describe, expect, it, vi } from "vitest";
import { chooseOutputStreamMode, createStreamedOutputSink } from "./streamedOutputSink";
import type { AvatarLineFeed } from "./streamingAvatar/avatarAudioBridge";
import type { ResponseOutputResult } from "./streamingAvatar/types";

const played: ResponseOutputResult = { status: "played", provider: "tts", firstPlaybackStartMs: 0, playbackTotalMs: 0,
  generatedSegments: 1, playedSegments: 1, failedSegments: 0, started: true };

/** Records what a streamed output receives: the first phrase, then every segment of the feed. */
function recordingOutput() {
  const received: string[] = [];
  let feed: AvatarLineFeed | null = null;
  const start = vi.fn((first: string, given: AvatarLineFeed, _intent: unknown) => {
    feed = given;
    return (async () => {
      for (let index = 0; ; index++) {
        const segment = await given.segmentAt(index);
        if (segment === null) return played;
        received.push(segment);
      }
    })();
  });
  return { start, received, feed: () => feed };
}

describe("output stream mode (latency lot 4)", () => {
  it("keeps the batch path when the output's switch is off or absent", () => {
    expect(chooseOutputStreamMode({ gradiumIncremental: false, streamable: false, held: false })).toBe("batch");
  });
  it("keeps the reply held, in batch, while a passage request is open", () => {
    expect(chooseOutputStreamMode({ gradiumIncremental: false, streamable: true, held: true })).toBe("held_batch");
  });
  it("streams an enabled output, and leaves Gradium's progressive voice first", () => {
    expect(chooseOutputStreamMode({ gradiumIncremental: false, streamable: true, held: false })).toBe("feed");
    expect(chooseOutputStreamMode({ gradiumIncremental: true, streamable: true, held: false })).toBe("gradium_incremental");
  });
});

describe("streamed output sink (lot T7, every output since latency lot 4)", () => {
  it("starts the render on the first segment and passes every segment in order", async () => {
    const output = recordingOutput();
    const onComplete = vi.fn();
    const sink = createStreamedOutputSink(output.start, onComplete);
    sink.onEvent({ type: "intent", intent: { goal: "g", points: [], parole: "calme" } });
    expect(sink.render).toBeNull();
    sink.onEvent({ type: "segment", text: "Une." });
    sink.onEvent({ type: "segment", text: "Deux." });
    sink.onEvent({ type: "segment", text: "Trois." });
    sink.onEvent({ type: "complete", response: "Une. Deux. Trois." });
    await expect(sink.render).resolves.toBe(played);
    expect(output.start).toHaveBeenCalledOnce();
    expect(output.start).toHaveBeenCalledWith("Une.", expect.anything(), { goal: "g", points: [], parole: "calme" });
    expect(output.received).toEqual(["Une.", "Deux.", "Trois."]);
    await expect(sink.delivery).resolves.toBe("Une. Deux. Trois.");
    expect(onComplete).toHaveBeenCalledWith("Une. Deux. Trois.");
  });

  it("never replaces a phrase already spoken: a replacement after a reset is dropped", async () => {
    const output = recordingOutput();
    const sink = createStreamedOutputSink(output.start);
    sink.onEvent({ type: "segment", text: "Déjà dite." });
    sink.onEvent({ type: "reset" });
    sink.onEvent({ type: "segment", text: "Remplacement." });
    sink.onEvent({ type: "complete", response: "Remplacement." });
    await sink.render;
    expect(output.received).toEqual(["Déjà dite."]);
  });

  it("a reset before any phrase keeps the replacement", async () => {
    const output = recordingOutput();
    const sink = createStreamedOutputSink(output.start);
    sink.onEvent({ type: "reset" });
    sink.onEvent({ type: "segment", text: "Seule phrase." });
    sink.onEvent({ type: "complete", response: "Seule phrase." });
    await sink.render;
    expect(output.received).toEqual(["Seule phrase."]);
  });

  it("T8 salvage: a header salvaged at the end emits no segment, so the reply is left to the batch render", async () => {
    const output = recordingOutput();
    const sink = createStreamedOutputSink(output.start);
    sink.onEvent({ type: "complete", response: "Réponse récupérée." });
    expect(sink.render).toBeNull();
    expect(output.start).not.toHaveBeenCalled();
    await expect(sink.delivery).resolves.toBe("Réponse récupérée.");
  });

  it("fails the feed and the delivery when the generation fails", async () => {
    const output = recordingOutput();
    const sink = createStreamedOutputSink(output.start);
    sink.onEvent({ type: "segment", text: "Début." });
    const error = new Error("llm stream failed");
    sink.onEvent({ type: "failed", intent: null, generated: "Début.", error });
    await expect(sink.render).rejects.toBe(error);
    await expect(sink.delivery).rejects.toBe(error);
    expect(output.feed()?.failure()).toBe(error);
  });
});
