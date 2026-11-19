import { describe, expect, it, vi } from "vitest";
import type { VideoTriggerRow } from "@/services/videoTriggerService";
import {
  OVERLAY_MAX_CANDIDATES,
  OVERLAY_MIN_CONFIDENCE,
  buildOverlaySelectorMessages,
  orderOverlayCandidates,
  parseOverlaySelection,
  selectOverlayVideo,
} from "./overlayVideoSelector";

const video = (id: string, priority: number | null = null, extra: Partial<VideoTriggerRow> = {}) =>
  ({ id, title: `Vidéo ${id}`, type: "interlude", priority, themes: ["lac"], context: `Contexte ${id}`, description: null,
    ai_description: `Le lac au crépuscule ${id}`, video_url: `https://gumlet.tv/watch/${id}`, ...extra }) as unknown as VideoTriggerRow;

const input = (llmCandidates = [video("a", 2), video("b", 1)]) => ({
  replyText: "Je revois le lac, ce soir-là.",
  userMessage: "Où étais-tu ?",
  characterName: "Max",
  candidates: llmCandidates,
});

describe("overlay video selector", () => {
  it("sends the reply, the player line and the shared candidate lines, by priority", () => {
    const messages = buildOverlaySelectorMessages(input());
    expect(messages[0].content).toContain("PENDANT");
    expect(messages[0].content).toContain("retourne null");
    expect(messages[1].content).toContain("RÉPLIQUE DE MAX");
    expect(messages[1].content).toContain("Je revois le lac");
    expect(messages[1].content.indexOf("id=b")).toBeLessThan(messages[1].content.indexOf("id=a"));
    expect(messages[1].content).toContain('contexte="Contexte a"');
    const many = Array.from({ length: OVERLAY_MAX_CANDIDATES + 5 }, (_, index) => video(`v${index}`, index));
    expect(orderOverlayCandidates(many)).toHaveLength(OVERLAY_MAX_CANDIDATES);
  });

  it("accepts only a known candidate with enough confidence", () => {
    const ids = ["a", "b"];
    expect(parseOverlaySelection('{"videoId":"a","confidence":0.8,"reason":"le lac"}', ids))
      .toEqual({ status: "selected", videoId: "a", confidence: 0.8, reason: "le lac" });
    expect(parseOverlaySelection('Voici : {"videoId":"b","confidence":1.4}', ids)).toMatchObject({ status: "selected", confidence: 1 });
    expect(parseOverlaySelection('{"videoId":null,"confidence":0}', ids)).toEqual({ status: "none" });
    expect(parseOverlaySelection(`{"videoId":"a","confidence":${OVERLAY_MIN_CONFIDENCE - 0.01}}`, ids)).toMatchObject({ status: "low_confidence" });
    expect(parseOverlaySelection('{"videoId":"z","confidence":0.9}', ids)).toMatchObject({ status: "invalid", detail: "unknown_video" });
    expect(parseOverlaySelection("pas de json", ids)).toMatchObject({ status: "invalid" });
    expect(parseOverlaySelection("{oops}", ids)).toMatchObject({ status: "invalid", detail: "bad_json" });
  });

  it("returns the selection with its latency", async () => {
    let now = 0;
    const llm = vi.fn(async () => { now = 450; return '{"videoId":"b","confidence":0.9,"reason":"lac"}'; });
    await expect(selectOverlayVideo(input(), llm, () => now)).resolves.toEqual({
      status: "selected", videoId: "b", confidence: 0.9, reason: "lac", latencyMs: 450,
    });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("never calls the model without candidates or reply", async () => {
    const llm = vi.fn(async () => "{}");
    await expect(selectOverlayVideo(input([]), llm)).resolves.toMatchObject({ status: "no_candidates" });
    await expect(selectOverlayVideo({ ...input(), replyText: "  " }, llm)).resolves.toMatchObject({ status: "no_candidates" });
    expect(llm).not.toHaveBeenCalled();
  });

  it("gives up at the deadline and aborts the request", async () => {
    vi.useFakeTimers();
    try {
      let aborted = false;
      const llm = vi.fn((_messages, options: { signal?: AbortSignal }) => new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
      }));
      const pending = selectOverlayVideo({ ...input(), timeoutMs: 2_000 }, llm);
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(pending).resolves.toMatchObject({ status: "timeout" });
      expect(aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failure or a cancelled turn as no video", async () => {
    await expect(selectOverlayVideo(input(), async () => { throw new Error("503"); })).resolves.toMatchObject({ status: "error", detail: "503" });
    const controller = new AbortController();
    controller.abort("turn-ended");
    const llm = vi.fn(async () => "{}");
    await expect(selectOverlayVideo({ ...input(), signal: controller.signal }, llm)).resolves.toMatchObject({ status: "error", detail: "aborted" });
    expect(llm).not.toHaveBeenCalled();
  });
});
