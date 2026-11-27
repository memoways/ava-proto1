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
  /** Resolves with the whole reply once generated; rejects when the generation fails. */
  readonly delivery: Promise<string>;
  /** The render started by the first segment, or null when no segment was spoken (T8 salvage, held output). */
  readonly render: Promise<ResponseOutputResult> | null;
  onEvent(event: PRD4StreamEvent): void;
}

/**
 * Lot T7, shared by every streamed output since latency lot 4. The first segment starts the render
 * with the feed; later segments are pushed in order. A phrase already spoken is never replaced: after
 * a `reset` that follows a spoken phrase, every replacement segment is dropped. A reply with no
 * segment (header salvaged at the end, T8) leaves `render` null so the caller speaks it in batch.
 */
export function createStreamedOutputSink(
  start: (firstText: string, feed: AvatarLineFeed, intent: ResponseIntent | null) => Promise<ResponseOutputResult>,
  onComplete?: (response: string) => void,
): StreamedOutputSink {
  const feed = createAvatarLineFeed();
  let intent: ResponseIntent | null = null;
  let dropping = false;
  let render: Promise<ResponseOutputResult> | null = null;
  let resolveDelivery!: (text: string) => void, rejectDelivery!: (error: unknown) => void;
  const delivery = new Promise<string>((resolve, reject) => { resolveDelivery = resolve; rejectDelivery = reject; });
  delivery.catch(() => {});
  return {
    delivery,
    get render() { return render; },
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
        feed.end(); resolveDelivery(event.response);
      } else { feed.fail(event.error); rejectDelivery(event.error); }
    },
  };
}
