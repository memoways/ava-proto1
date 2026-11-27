import { TTSQueue } from "@/services/tts/queue";
import { chunkTextForTTS } from "@/services/tts/textChunking";
import { getActiveProviderId } from "@/services/tts/providerSettings";
import type { TTSOptions } from "@/services/tts";
import { getGameplaySettings } from "@/services/settingsService";
import { abortable, type AvatarLineFeed } from "./avatarAudioBridge";
import type {
  ResponseOutput,
  ResponseOutputPrepareContext,
  ResponseOutputResult,
  ResponseOutputTurnContext,
} from "./types";

function chunkOptions(providerId: string) {
  return providerId === "gradium"
    ? { maxSingleChars: 320, targetChars: 320 }
    : undefined;
}

export class LocalTTSOutput implements ResponseOutput {
  readonly mode = "tts" as const;
  readonly provider = "tts";
  readonly externalSessionId = null;
  private queue: TTSQueue | null = null;

  async prepare(_context: ResponseOutputPrepareContext): Promise<void> {
    // TTS providers are already lazily prepared by their existing façade.
  }

  /**
   * Latency lot 4: voice-only output may speak a reply still being generated when the admin switch
   * `VOICE_STREAMED_LLM` is on. Read at the start of each turn; Gradium's progressive output keeps
   * its own path (`streamedVoiceTurn`) and is chosen before this one.
   */
  canStreamText(): boolean {
    return getGameplaySettings().VOICE_STREAMED_LLM === true;
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    const providerId = context?.providerId ?? getActiveProviderId();
    const { queue, release } = this.openQueue(context);
    for (const chunk of chunkTextForTTS(text, chunkOptions(providerId))) queue.enqueue(chunk, enqueueOptions(providerId, context));
    return finishQueue(queue, release);
  }

  /**
   * Latency lot 4: each segment of `feed` is chunked and enqueued as soon as it arrives, with the
   * same transport as `renderText` (streamed MP3 or PCM for ElevenLabs, lots 1 and 1 bis). The queue
   * is drained once the feed ended. A failed feed cancels what was not played and rethrows.
   */
  async renderTextStream(
    feed: AvatarLineFeed,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    const providerId = context?.providerId ?? getActiveProviderId();
    const { queue, release } = this.openQueue(context);
    try {
      for (let index = 0; !queue.cancelled; index++) {
        const next = feed.segmentAt(index);
        const segment = await (context?.signal ? abortable(next, context.signal) : next);
        if (segment === null) break;
        for (const chunk of chunkTextForTTS(segment, chunkOptions(providerId))) queue.enqueue(chunk, enqueueOptions(providerId, context));
      }
    } catch (error) {
      queue.cancel();
      const result = await finishQueue(queue, release);
      if (context?.signal?.aborted) return result;
      throw error;
    }
    return finishQueue(queue, release);
  }

  private openQueue(context?: ResponseOutputTurnContext): { queue: TTSQueue; release: () => void } {
    const queue = new TTSQueue({
      onFirstPlaybackStart: context?.onPlaybackStart,
    });
    this.queue = queue;
    const cancel = () => queue.cancel();
    if (context?.signal?.aborted) cancel();
    else context?.signal?.addEventListener("abort", cancel, { once: true });
    return {
      queue,
      release: () => {
        context?.signal?.removeEventListener("abort", cancel);
        if (this.queue === queue) this.queue = null;
      },
    };
  }

  attachMedia(_element: HTMLMediaElement): void {
    // Local TTS uses Web Audio / HTMLAudioElement through the existing façade.
  }

  interrupt(): void {
    this.queue?.cancel();
  }

  async dispose(): Promise<void> {
    this.interrupt();
    this.queue = null;
  }
}

function enqueueOptions(providerId: string, context?: ResponseOutputTurnContext): TTSOptions {
  return {
    session_id: context?.sessionId,
    turn_id: context?.turnId,
    turn_index: context?.turnIndex,
    voiceId: context?.voiceId,
    providerId: providerId as TTSOptions["providerId"],
    characterOverride: context?.providerId != null,
    attempt_id: context?.attemptId,
    onVoiceObservation: context?.onVoiceObservation,
    onServiceObserved: context?.onServiceObserved,
    characterKey: context?.characterKey,
    performance: context?.performance,
    cacheOpening: context?.cacheOpening,
  };
}

async function finishQueue(queue: TTSQueue, release: () => void): Promise<ResponseOutputResult> {
  const result = await queue.drain().finally(release);
  return {
    ...result,
    provider: result.services?.[0]?.effective_provider ?? "unknown",
    model: result.services?.[0]?.effective_model ?? undefined,
    started: result.playedSegments > 0,
  };
}
