import { TTSQueue } from "@/services/tts/queue";
import { chunkTextForTTS } from "@/services/tts/textChunking";
import { getActiveProviderId } from "@/services/tts/providerSettings";
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

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    const providerId = context?.providerId ?? getActiveProviderId();
    const queue = new TTSQueue({
      onFirstPlaybackStart: context?.onPlaybackStart,
    });
    this.queue = queue;
    const cancel = () => queue.cancel();
    context?.signal?.addEventListener("abort", cancel, { once: true });
    for (const chunk of chunkTextForTTS(text, chunkOptions(providerId))) {
      queue.enqueue(chunk, {
        session_id: context?.sessionId,
        turn_id: context?.turnId,
        turn_index: context?.turnIndex,
        voiceId: context?.voiceId,
        providerId,
        characterOverride: context?.providerId != null,
        attempt_id: context?.attemptId,
        onVoiceObservation: context?.onVoiceObservation,
        onServiceObserved: context?.onServiceObserved,
        characterKey: context?.characterKey,
        performance: context?.performance,
      });
    }
    const result = await queue.drain().finally(() => {
      context?.signal?.removeEventListener("abort", cancel);
      if (this.queue === queue) this.queue = null;
    });
    return {
      ...result,
      provider: result.services?.[0]?.effective_provider ?? "unknown",
      model: result.services?.[0]?.effective_model ?? undefined,
      started: result.playedSegments > 0,
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
