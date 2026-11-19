import { describe, expect, it, vi } from "vitest";
import type { VideoTriggerRow } from "@/services/videoTriggerService";
import {
  OVERLAY_MAX_CANDIDATES,
  OVERLAY_MIN_CONFIDENCE,
  OVERLAY_SELECTION_MAX_TIMEOUT_MS,
  OVERLAY_SELECTION_MIN_TIMEOUT_MS,
  OVERLAY_SELECTION_TIMEOUT_MS,
  buildOverlaySelectorMessages,
  checkOverlayLink,
  orderOverlayCandidates,
  overlaySelectionTimeoutMs,
  overlayShortId,
  parseOverlaySelection,
  recentOverlayExchanges,
  selectOverlayVideo,
} from "./overlayVideoSelector";
import {
  EMMA_FEU_ID,
  EMMA_TURN,
  FUSIL_TURN,
  MAX_VIDEOS_20261119,
  MORT_PETER_ID,
  RECENT_LOG_BEFORE_EMMA_TURN,
} from "./overlayVideoSelector.fixtures";
import { formatCompactVideoCandidateLine, formatVideoCandidateLine } from "./videoCandidateLine";

const video = (id: string, priority: number | null = null, extra: Partial<VideoTriggerRow> = {}) =>
  ({ id, title: `Vidéo ${id}`, type: "interlude", priority, themes: ["lac"], context: `Max revoit le lac gelé ${id}`, description: null,
    ai_description: `Le lac au crépuscule ${id}`, video_url: `https://gumlet.tv/watch/${id}`, ...extra }) as unknown as VideoTriggerRow;

const REPLY = "Je revois le lac, ce soir-là, gelé sous la lune.";
const input = (llmCandidates = [video("a", 2), video("b", 1)]) => ({
  replyText: REPLY,
  userMessage: "Où étais-tu ?",
  characterName: "Max",
  candidates: llmCandidates,
});
const answer = (videoId: string | null, confidence = 0.9, replyCue = "le lac", videoCue = "le lac gelé") =>
  JSON.stringify({ videoId, confidence, replyCue, videoCue });

describe("overlay video selector", () => {
  it("sends recent exchanges, the reply and compact candidate lines, by priority", () => {
    const messages = buildOverlaySelectorMessages({ ...input(), recentExchanges: [
      { speaker: "player", text: "Tu te souviens ?" }, { speaker: "character", text: "Oui, l'hiver." }] });
    expect(messages[0].content).toContain("PENDANT");
    expect(messages[0].content).toContain("Un prénom seul ne suffit pas");
    expect(messages[0].content).toContain("replyCue");
    expect(messages[1].content).toContain("ÉCHANGES PRÉCÉDENTS");
    expect(messages[1].content).toContain("MAX : « Oui, l'hiver. »");
    expect(messages[1].content).toContain("RÉPLIQUE DE MAX");
    expect(messages[1].content).toContain('id=v1 | titre="Vidéo b"');
    expect(messages[1].content).toContain('id=v2 | titre="Vidéo a"');
    expect(messages[1].content).not.toContain("type=");
    const many = Array.from({ length: OVERLAY_MAX_CANDIDATES + 5 }, (_, index) => video(`v${index}`, index));
    expect(orderOverlayCandidates(many)).toHaveLength(OVERLAY_MAX_CANDIDATES);
  });

  it("keeps the real candidate block short (fewer input tokens than lot 1)", () => {
    const top = orderOverlayCandidates(MAX_VIDEOS_20261119, FUSIL_TURN.replyText);
    const legacy = top.map(formatVideoCandidateLine).join("\n").length;
    const compact = top.map((row, index) => formatCompactVideoCandidateLine(row, overlayShortId(index))).join("\n").length;
    expect(compact).toBeLessThan(legacy * 0.75);
    const messages = buildOverlaySelectorMessages({ ...FUSIL_TURN, characterName: "Max", candidates: MAX_VIDEOS_20261119 });
    expect(messages[1].content).toContain('titre="mort Peter"');
    expect(messages[1].content).not.toContain(MORT_PETER_ID);
    // At equal priority the video sharing the reply's words comes first (never cut by the cap).
    expect(top[0].id).toBe(MORT_PETER_ID);
  });

  it("takes the two previous exchanges, without the current turn", () => {
    const lines = recentOverlayExchanges(RECENT_LOG_BEFORE_EMMA_TURN, EMMA_TURN);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ speaker: "player", text: "Tu choisis quoi" });
    expect(lines[lines.length - 1]).toMatchObject({ speaker: "character", text: FUSIL_TURN.replyText });
    expect(recentOverlayExchanges([], EMMA_TURN)).toEqual([]);
  });

  it("derives the deadline from the speech still to come", () => {
    expect(overlaySelectionTimeoutMs(null, 2_900)).toBe(OVERLAY_SELECTION_TIMEOUT_MS);
    expect(overlaySelectionTimeoutMs(20_000, 2_900)).toBe(OVERLAY_SELECTION_MAX_TIMEOUT_MS);
    expect(overlaySelectionTimeoutMs(6_000, 2_900)).toBe(3_100);
    expect(overlaySelectionTimeoutMs(3_000, 2_900)).toBe(OVERLAY_SELECTION_MIN_TIMEOUT_MS);
  });

  it("accepts only a known candidate, confident, with a concrete link from the reply", () => {
    const candidates = [video("a"), video("b")];
    expect(parseOverlaySelection(answer("a"), candidates, REPLY))
      .toMatchObject({ status: "selected", videoId: "a", confidence: 0.9, replyCue: "le lac", reason: "« le lac » ↔ le lac gelé" });
    expect(parseOverlaySelection(`Voici : ${answer("b", 1.4)}`, candidates, REPLY)).toMatchObject({ status: "selected", confidence: 1 });
    expect(parseOverlaySelection('{"videoId":null,"confidence":0}', candidates, REPLY)).toEqual({ status: "none" });
    expect(parseOverlaySelection(answer("a", OVERLAY_MIN_CONFIDENCE - 0.01), candidates, REPLY)).toMatchObject({ status: "low_confidence" });
    expect(parseOverlaySelection(answer("z"), candidates, REPLY)).toMatchObject({ status: "invalid", detail: "unknown_video" });
    // Short ids follow the prompt order.
    expect(parseOverlaySelection(answer("v2"), candidates, REPLY)).toMatchObject({ status: "selected", videoId: "b" });
    expect(parseOverlaySelection(answer("v9"), candidates, REPLY)).toMatchObject({ status: "invalid", detail: "unknown_video" });
    expect(parseOverlaySelection("pas de json", candidates, REPLY)).toMatchObject({ status: "invalid" });
    expect(parseOverlaySelection("{oops}", candidates, REPLY)).toMatchObject({ status: "invalid", detail: "bad_json" });
    // Lot 1 answers (free reason, no cues) are no longer enough.
    expect(parseOverlaySelection('{"videoId":"a","confidence":0.9,"reason":"le lac"}', candidates, REPLY))
      .toMatchObject({ status: "weak_link", detail: "no_reply_cue" });
    // A cue the reply never said is refused.
    expect(parseOverlaySelection(answer("a", 0.9, "la forêt brûlée"), candidates, REPLY)).toMatchObject({ status: "weak_link", detail: "cue_not_in_reply" });
  });

  it("real case « Emma »: a first name at the end of the reply is not a link", () => {
    expect(parseOverlaySelection(EMMA_TURN.recordedAnswer, MAX_VIDEOS_20261119, EMMA_TURN.replyText, ["Max"]))
      .toMatchObject({ status: "weak_link", detail: "name_only" });
    const emmaVideo = MAX_VIDEOS_20261119.find((row) => row.id === EMMA_FEU_ID)!;
    expect(checkOverlayLink({ replyCue: "Emma", videoCue: "Emma", confidence: 1 }, EMMA_TURN.replyText, emmaVideo, ["Max"]))
      .toEqual({ ok: false, detail: "name_only" });
    // A word of the reply that the video never shows does not make a link either, unless very confident.
    expect(checkOverlayLink({ replyCue: "vivre avec ce que j'ai fait", videoCue: "Emma et Max proches", confidence: 0.75 },
      EMMA_TURN.replyText, emmaVideo, ["Max"])).toEqual({ ok: false, detail: "no_shared_word" });
  });

  it("real case « fusil »: the shooting under the shelter links to « mort Peter »", () => {
    const raw = JSON.stringify({ videoId: MORT_PETER_ID, confidence: 0.8,
      replyCue: "l'homme que j'avais ligoté… mort dans l'abri", videoCue: "attacher Peter sous cet abri, un corps sous une tôle" });
    expect(parseOverlaySelection(raw, MAX_VIDEOS_20261119, FUSIL_TURN.replyText, ["Max"]))
      .toMatchObject({ status: "selected", videoId: MORT_PETER_ID, confidence: 0.8 });
  });

  it("returns the selection with its latency", async () => {
    let now = 0;
    const llm = vi.fn(async () => { now = 450; return answer("v1"); });
    await expect(selectOverlayVideo(input(), llm, () => now)).resolves.toMatchObject({
      status: "selected", videoId: "b", confidence: 0.9, latencyMs: 450,
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
      const llm = vi.fn((_messages, options: { signal?: AbortSignal; timeoutMs: number }) => new Promise<string>((_resolve, reject) => {
        expect(options.timeoutMs).toBe(4_000);
        options.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
      }));
      const pending = selectOverlayVideo({ ...input(), timeoutMs: 4_000 }, llm);
      await vi.advanceTimersByTimeAsync(4_000);
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
