import {
  AnamEvent,
  createClient,
  MessageRole,
  type AnamClient,
  type MessageDeliveryFailure,
  type MessageStreamEvent,
} from "@anam-ai/js-sdk";
import { endAvatarSession, startAvatarSession } from "../api";
import { splitAvatarText } from "../textSegmentation";
import {
  stripAnamCueTags,
  withAnamCue,
} from "../../../../supabase/functions/_shared/streamingAvatarRequest";
import {
  AvatarRenderError,
  type AnamAvatarSettings,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
} from "../types";

interface PendingSpeech {
  turnId?: string;
  correlationId: string;
  started: boolean;
  ended: boolean;
  transcript: string;
  resolveStarted: () => void;
  rejectStarted: (error: Error) => void;
  resolveEnded: () => void;
  rejectEnded: (error: Error) => void;
  startedPromise: Promise<void>;
  endedPromise: Promise<void>;
}

/**
 * Anam in text mode: the persona says Ava's text through a talk stream (Anam LLM off,
 * `CUSTOMER_CLIENT_V1`). The SDK never opens the microphone (`disableInputAudio`), so no sound
 * reaches Anam. Persona transcript events mark the start and the end of each spoken line.
 */
export class AnamStreamingAvatarOutput implements ResponseOutput {
  readonly mode = "streaming_avatar" as const;
  readonly provider = "anam";
  get model() { return this.settings.avatarModel; }
  private readonly settings: AnamAvatarSettings;
  private readonly callbacks: ResponseOutputCallbacks;
  private readonly connectionTimeoutMs: number;
  private readonly speechStartTimeoutMs: number;
  private client: AnamClient | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private avaSessionId = "";
  private _externalSessionId: string | null = null;
  private disposed = false;
  private ready = false;
  private currentSpeech: PendingSpeech | null = null;
  private mediaPlayback: Promise<void> | null = null;

  constructor(
    settings: AnamAvatarSettings,
    callbacks: ResponseOutputCallbacks,
    connectionTimeoutMs: number,
    speechStartTimeoutMs: number,
  ) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.connectionTimeoutMs = connectionTimeoutMs;
    this.speechStartTimeoutMs = speechStartTimeoutMs;
  }

  get externalSessionId(): string | null {
    return this._externalSessionId;
  }

  async prepare(context: ResponseOutputPrepareContext): Promise<void> {
    if (this.client) return;
    this.avaSessionId = context.sessionId;
    this.callbacks.onConnectionStateChange?.("connecting");
    const started = await startAvatarSession({
      provider: "anam",
      sessionId: context.sessionId,
      anam: this.settings,
      signal: context.signal,
    });
    if (started.provider !== "anam") throw new Error("Unexpected avatar provider response");
    this._externalSessionId = started.externalSessionId;
    const client = createClient(started.sessionToken, {
      // Ava keeps its microphone and STT: the SDK never asks for nor publishes input audio.
      disableInputAudio: true,
      metrics: { disableClientMetrics: true },
    });
    this.client = client;
    this.bindEvents(client);
    const streams = await withDeadline(
      client.stream(),
      this.connectionTimeoutMs,
      "Anam connection timed out",
    );
    if (this.disposed) throw new Error("Anam session was disposed before the stream became ready");
    const mediaStream = new MediaStream();
    for (const stream of streams) {
      for (const track of stream.getTracks()) mediaStream.addTrack(track);
    }
    this.mediaStream = mediaStream;
    this.reportTracks();
    if (!mediaStream.getVideoTracks().length || !mediaStream.getAudioTracks().length) {
      throw new Error(
        `Anam audio/video tracks missing (audio=${mediaStream.getAudioTracks().length}, video=${mediaStream.getVideoTracks().length})`,
      );
    }
    if (context.signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");
    if (this.mediaElement) {
      this.mediaElement.srcObject = mediaStream;
      this.playMedia();
    }
    this.ready = true;
    this.callbacks.onStreamReady?.();
    this.callbacks.onConnectionStateChange?.("ready");
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.client || !this.ready || !this._externalSessionId) {
      throw new AvatarRenderError("Anam video stream is not ready", false);
    }
    if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    // Do not send speech until the browser accepts audible media playback.
    if (!this.mediaElement || !this.mediaPlayback) {
      throw new AvatarRenderError("Anam media player is not attached", false);
    }
    try {
      await withDeadline(this.mediaPlayback, this.speechStartTimeoutMs, "Anam media playback timed out");
    } catch (cause) {
      throw new AvatarRenderError("Anam audio/video playback failed", false, { cause });
    }
    const startedAt = performance.now();
    let firstStartedAt = 0;
    const chunks = splitAvatarText(text);
    const talk = this.client.createTalkMessageStream();
    const speech = createPendingSpeech(talk.getCorrelationId(), context?.turnId);
    this.currentSpeech = speech;
    const abort = () => this.interrupt();
    context?.signal?.addEventListener("abort", abort, { once: true });
    try {
      // One talk stream per line; the cue tag leads the line and Anam strips it from transcripts.
      for (let index = 0; index < chunks.length; index++) {
        if (this.disposed || context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
        const chunk = index === 0 ? withAnamCue(chunks[index], this.settings.speakingCue) : chunks[index];
        await talk.streamMessageChunk(chunk, index === chunks.length - 1);
      }
      await withDeadline(speech.startedPromise, this.speechStartTimeoutMs, "Anam did not start speaking");
      firstStartedAt = performance.now();
      context?.onPlaybackStart?.();
      await withDeadline(speech.endedPromise, 90_000, "Anam speech did not finish");
      return {
        status: "played",
        provider: "Anam",
        model: this.settings.avatarModel,
        firstPlaybackStartMs: Math.round(firstStartedAt - startedAt),
        playbackTotalMs: Math.round(performance.now() - firstStartedAt),
        generatedSegments: chunks.length,
        playedSegments: chunks.length,
        failedSegments: 0,
        started: true,
      };
    } catch (cause) {
      throw new AvatarRenderError(
        cause instanceof Error ? cause.message : String(cause),
        speech.started,
        { cause },
      );
    } finally {
      context?.signal?.removeEventListener("abort", abort);
      if (this.currentSpeech === speech) this.currentSpeech = null;
    }
  }

  attachMedia(element: HTMLMediaElement): void {
    if (this.disposed) return;
    if (this.mediaElement === element && element.srcObject === this.mediaStream) return;
    if (this.mediaElement && this.mediaElement !== element) this.mediaElement.srcObject = null;
    this.mediaElement = element;
    if (this.mediaStream) {
      element.srcObject = this.mediaStream;
      this.playMedia();
    }
  }

  interrupt(): void {
    try {
      if (this.client?.isStreaming()) this.client.interruptPersona();
    } catch {
      // Not streaming any more: nothing to interrupt on Anam's side.
    }
    this.failCurrentSpeech(new Error("Anam speech interrupted"));
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.interrupt();
    const client = this.client;
    this.client = null;
    await client?.stopStreaming().catch(() => {});
    if (this._externalSessionId && this.avaSessionId) {
      await endAvatarSession({
        provider: "anam",
        sessionId: this.avaSessionId,
        externalSessionId: this._externalSessionId,
      }).catch((error) => console.warn("[Anam] server cleanup failed", error));
    }
    this.mediaStream = null;
    if (this.mediaElement) this.mediaElement.srcObject = null;
    this.mediaElement = null;
    this.mediaPlayback = null;
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private bindEvents(client: AnamClient): void {
    client.addListener(AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED, (event: MessageStreamEvent) => {
      const speech = this.currentSpeech;
      if (this.disposed || !speech || event.role !== MessageRole.PERSONA) return;
      if (!speech.started) {
        speech.started = true;
        speech.resolveStarted();
        this.callbacks.onConnectionStateChange?.("speaking");
        this.callbacks.onSpeakStart?.(speech.turnId);
      }
      speech.transcript += event.content;
      if (event.interrupted) {
        this.failCurrentSpeech(new Error("Anam speech interrupted"));
        return;
      }
      if (event.endOfSpeech && !speech.ended) {
        speech.ended = true;
        speech.resolveEnded();
        this.callbacks.onTranscript?.(stripAnamCueTags(speech.transcript).trim(), speech.turnId);
        this.callbacks.onConnectionStateChange?.("ready");
        this.callbacks.onSpeakEnd?.(speech.turnId);
      }
    });
    client.addListener(AnamEvent.TALK_STREAM_INTERRUPTED, (correlationId: string) => {
      if (this.currentSpeech?.correlationId === correlationId) {
        this.failCurrentSpeech(new Error("Anam speech interrupted"));
      }
    });
    client.addListener(AnamEvent.MESSAGE_DELIVERY_FAILED, (failure: MessageDeliveryFailure) => {
      if (this.currentSpeech?.correlationId === failure.correlationId) {
        this.failCurrentSpeech(new Error("Anam did not confirm the spoken text"));
      }
    });
    client.addListener(AnamEvent.CONNECTION_CLOSED, (reason: string) => {
      this.handleDisconnected(String(reason).toLowerCase().slice(0, 80));
    });
  }

  private failCurrentSpeech(error: Error): void {
    const speech = this.currentSpeech;
    if (!speech) return;
    this.currentSpeech = null;
    speech.rejectStarted(error);
    speech.rejectEnded(error);
  }

  private playMedia(): void {
    const element = this.mediaElement;
    if (!element) return;
    element.muted = false;
    element.volume = 1;
    const playback = Promise.resolve().then(() => element.play()).then(() => {
      if (!this.disposed && this.mediaElement === element) this.callbacks.onMediaDiagnostics?.({ event: "playback", playback: "playing" });
    }).catch((error: unknown) => {
      const name = error instanceof Error ? error.name : "Error";
      if (!this.disposed && this.mediaElement === element) this.callbacks.onMediaDiagnostics?.({ event: "playback", playback: name === "NotAllowedError" ? "blocked" : "failed", errorName: name });
      throw error;
    });
    this.mediaPlayback = playback;
    void playback.catch(() => {}); // renderText observes the rejection before speech.
  }

  private reportTracks(): void {
    this.callbacks.onMediaDiagnostics?.({ event: "tracks", audioTracks: this.mediaStream?.getAudioTracks().length ?? 0, videoTracks: this.mediaStream?.getVideoTracks().length ?? 0 });
  }

  private handleDisconnected(reason: string): void {
    if (this.disposed) return;
    this.ready = false;
    this.callbacks.onConnectionStateChange?.("disconnected");
    this.callbacks.onDisconnected?.(reason);
    this.failCurrentSpeech(new Error(`Anam disconnected: ${reason}`));
  }
}

function createPendingSpeech(correlationId: string, turnId?: string): PendingSpeech {
  let resolveStarted!: () => void;
  let rejectStarted!: (error: Error) => void;
  let resolveEnded!: () => void;
  let rejectEnded!: (error: Error) => void;
  const startedPromise = new Promise<void>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  const endedPromise = new Promise<void>((resolve, reject) => {
    resolveEnded = resolve;
    rejectEnded = reject;
  });
  void startedPromise.catch(() => {});
  void endedPromise.catch(() => {});
  return {
    turnId,
    correlationId,
    started: false,
    ended: false,
    transcript: "",
    resolveStarted,
    rejectStarted,
    resolveEnded,
    rejectEnded,
    startedPromise,
    endedPromise,
  };
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
