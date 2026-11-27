import type { PRD4StreamEvent } from "./prd4Orchestrator";
import type { ResponseIntent } from "./responseIntentStream";
import { createAvatarLineFeed, type AvatarLineFeed } from "./streamingAvatar/avatarAudioBridge";
import type { ResponseOutputResult } from "./streamingAvatar/types";

/**
 * Latency lot 4: how a turn's reply reaches its output.
 * - `gradium_incremental`: Gradium's progressive voice (`streamedVoiceTurn`), chosen first.
 * - `feed`: the output's switch is on; it speaks each safe phrase while the LLM still streams.
 * - `held_batch`: the output could stream but a passage request is open, so the reply stays held.
 * - `batch`: the whole reply, validated, then spoken (switch off or output without streaming).
 */
export type OutputStreamMode = "feed" | "batch" | "held_batch" | "gradium_incremental";

export function chooseOutputStreamMode(input: { gradiumIncremental: boolean; streamable: boolean; held: boolean }): OutputStreamMode {
  if (input.gradiumIncremental) return "gradium_incremental";
  if (!input.streamable) return "batch";
  return input.held ? "held_batch" : "feed";
}

export interface StreamedOutputSink {
  /**
   * The text confirmed as heard, the only one the GM and the session summary may be credited with. Settled by
   * `confirmHeard`; rejects when the generation fails or the turn is aborted first.
   */
  readonly delivery: Promise<string>;
  /** The render started by the first segment, or null when no segment was spoken (T8 salvage, held output). */
  readonly render: Promise<ResponseOutputResult> | null;
  onEvent(event: PRD4StreamEvent): void;
  /** Called with the output receipt's heard text, empty when nothing is confirmed. A generated reply is not a heard one. */
  confirmHeard(text: string): void;
}

/**
 * Lot T7, shared by every streamed output since latency lot 4. The first segment starts the render
 * with the feed; later segments are pushed in order. A phrase already spoken is never replaced: after
 * a `reset` that follows a spoken phrase, every replacement segment is dropped. A reply with no
 * segment (header salvaged at the end, T8) leaves `render` null so the caller speaks it in batch.
 * No heard prefix is known for a cut reply (latency lot 1 ter): aborting `signal` before the
 * confirmation credits nothing, even when the generation already ended.
 */
export function createStreamedOutputSink(
  start: (firstText: string, feed: AvatarLineFeed, intent: ResponseIntent | null) => Promise<ResponseOutputResult>,
  onComplete?: (response: string) => void,
  signal?: AbortSignal,
): StreamedOutputSink {
  const feed = createAvatarLineFeed();
  let intent: ResponseIntent | null = null;
  let dropping = false;
  let render: Promise<ResponseOutputResult> | null = null;
  let resolveDelivery!: (text: string) => void, rejectDelivery!: (error: unknown) => void;
  const delivery = new Promise<string>((resolve, reject) => { resolveDelivery = resolve; rejectDelivery = reject; });
  delivery.catch(() => {});
  const unheard = () => rejectDelivery(new Error("No confirmed audio delivery"));
  if (signal?.aborted) unheard();
  else signal?.addEventListener("abort", unheard, { once: true });
  return {
    delivery,
    get render() { return render; },
    confirmHeard(text) { if (text.trim()) resolveDelivery(text); else unheard(); },
    onEvent(event) {
      if (event.type === "intent") intent = event.intent;
      else if (event.type === "reset") { if (feed.pushed > 0) dropping = true; }
      else if (event.type === "segment") {
        if (dropping) return;
        if (!render) {
          render = start(event.text, feed, intent);
          render.catch(() => {});
        }
        feed.push(event.text);
      } else if (event.type === "complete") {
        onComplete?.(event.response);
        feed.end();
      } else { feed.fail(event.error); rejectDelivery(event.error); }
    },
  };
}
