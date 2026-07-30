import DailyIframe, {
  type DailyCall,
  type DailyEventObjectAppMessage,
  type DailyEventObjectTrack,
} from "@daily-co/daily-js";
import { endAvatarSession, startAvatarSession } from "../api";
import { buildTavusEchoCommand } from "../protocolCommands";
import { splitAvatarText } from "../textSegmentation";
import {
  AvatarRenderError,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
  type TavusAvatarSettings,
} from "../types";

interface TavusMessage {
  event_type?: string;
  conversation_id?: string;
  properties?: { role?: string; text?: string };
}

interface PendingSpeech {
  turnId?: string;
  started: boolean;
  resolveStarted: () => void;
  rejectStarted: (error: Error) => void;
  resolveEnded: () => void;
  rejectEnded: (error: Error) => void;
  startedPromise: Promise<void>;
  endedPromise: Promise<void>;
}

export class TavusStreamingAvatarOutput implements ResponseOutput {
  readonly mode = "streaming_avatar" as const;
  readonly provider = "tavus";
  private readonly settings: TavusAvatarSettings;
  private readonly callbacks: ResponseOutputCallbacks;
  private readonly connectionTimeoutMs: number;
  private readonly speechStartTimeoutMs: number;
  private call: DailyCall | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private avaSessionId = "";
  private _externalSessionId: string | null = null;
  private disposed = false;
  private ready = false;
  private currentSpeech: PendingSpeech | null = null;

  constructor(
    settings: TavusAvatarSettings,
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
    if (this.call) return;
    this.avaSessionId = context.sessionId;
    this.callbacks.onConnectionStateChange?.("connecting");
    const started = await startAvatarSession({
      provider: "tavus",
      sessionId: context.sessionId,
      tavus: this.settings,
      signal: context.signal,
    });
    if (started.provider !== "tavus") throw new Error("Unexpected avatar provider response");
    this._externalSessionId = started.externalSessionId;
    const call = DailyIframe.createCallObject({
      startAudioOff: true,
      startVideoOff: true,
      audioSource: false,
      videoSource: false,
      subscribeToTracksAutomatically: true,
    });
    this.call = call;
    this.mediaStream = new MediaStream();
    this.bindEvents(call);
    await withDeadline(
      call.join({
        url: started.conversationUrl,
        token: started.meetingToken,
        startAudioOff: true,
        startVideoOff: true,
        audioSource: false,
        videoSource: false,
      }),
      this.connectionTimeoutMs,
      "Tavus connection timed out",
    );
    call.setLocalAudio(false, { forceDiscardTrack: true });
    call.setLocalVideo(false);
    await this.waitUntilReady();
    if (context.signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");
    this.callbacks.onConnectionStateChange?.("ready");
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.call || !this.ready || !this._externalSessionId) {
      throw new AvatarRenderError("Tavus video stream is not ready", false);
    }
    const startedAt = performance.now();
    let firstStartedAt = 0;
    let playedSegments = 0;
    let currentStarted = false;
    const chunks = splitAvatarText(text);
    try {
      for (const chunk of chunks) {
        const speech = createPendingSpeech(context?.turnId);
        this.currentSpeech = speech;
        this.call.sendAppMessage(
          buildTavusEchoCommand(this._externalSessionId, chunk),
          "*",
        );
        const abort = () => this.interrupt();
        context?.signal?.addEventListener("abort", abort, { once: true });
        try {
          await withDeadline(
            speech.startedPromise,
            this.speechStartTimeoutMs,
            "Tavus did not start speaking",
          );
          currentStarted = true;
          firstStartedAt ||= performance.now();
          if (playedSegments === 0) context?.onPlaybackStart?.();
          await withDeadline(speech.endedPromise, 90_000, "Tavus speech did not finish");
          playedSegments++;
        } finally {
          context?.signal?.removeEventListener("abort", abort);
          if (this.currentSpeech === speech) this.currentSpeech = null;
        }
      }
      return {
        status: "played",
        provider: "Tavus",
        model: this.settings.replicaId,
        firstPlaybackStartMs: Math.round((firstStartedAt || performance.now()) - startedAt),
        playbackTotalMs: Math.round(performance.now() - (firstStartedAt || startedAt)),
        generatedSegments: chunks.length,
        playedSegments,
        failedSegments: 0,
        started: currentStarted || playedSegments > 0,
      };
    } catch (cause) {
      throw new AvatarRenderError(
        cause instanceof Error ? cause.message : String(cause),
        currentStarted || playedSegments > 0,
        { cause },
      );
    }
  }

  attachMedia(element: HTMLMediaElement): void {
    this.mediaElement = element;
    if (this.mediaStream) {
      element.srcObject = this.mediaStream;
      void element.play().catch(() => {});
    }
  }

  interrupt(): void {
    if (this.call && this._externalSessionId) {
      this.call.sendAppMessage(
        {
          message_type: "conversation",
          event_type: "conversation.interrupt",
          conversation_id: this._externalSessionId,
        },
        "*",
      );
    }
    const error = new Error("Tavus speech interrupted");
    this.currentSpeech?.rejectStarted(error);
    this.currentSpeech?.rejectEnded(error);
    this.currentSpeech = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.interrupt();
    const call = this.call;
    this.call = null;
    try {
      await call?.leave();
    } catch {
      // Continue to destroy/end even if the room already disconnected.
    }
    await call?.destroy().catch(() => {});
    if (this._externalSessionId && this.avaSessionId) {
      await endAvatarSession({
        provider: "tavus",
        sessionId: this.avaSessionId,
        externalSessionId: this._externalSessionId,
      }).catch((error) => console.warn("[Tavus] server cleanup failed", error));
    }
    this.mediaStream = null;
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private bindEvents(call: DailyCall): void {
    call.on("track-started", (event: DailyEventObjectTrack | undefined) => {
      if (!event?.participant || event.participant.local || !this.mediaStream) return;
      if (event.type !== "video" && event.type !== "audio") return;
      if (!this.mediaStream.getTracks().some((track) => track.id === event.track.id)) {
        this.mediaStream.addTrack(event.track);
      }
      if (this.mediaElement) {
        this.mediaElement.srcObject = this.mediaStream;
        void this.mediaElement.play().catch(() => {});
      }
      if (event.type === "video" && !this.ready) {
        this.ready = true;
        this.callbacks.onStreamReady?.();
      }
    });
    call.on("app-message", (event: DailyEventObjectAppMessage<TavusMessage> | undefined) => {
      const message = event?.data;
      if (!message) return;
      const role = message.properties?.role;
      if (role && role !== "pal" && role !== "replica") return;
      if (message.event_type === "conversation.started_speaking") {
        const speech = this.currentSpeech;
        if (!speech || speech.started) return;
        speech.started = true;
        speech.resolveStarted();
        this.callbacks.onConnectionStateChange?.("speaking");
        this.callbacks.onSpeakStart?.(speech.turnId);
      } else if (message.event_type === "conversation.stopped_speaking") {
        const speech = this.currentSpeech;
        if (!speech) return;
        speech.resolveEnded();
        this.callbacks.onConnectionStateChange?.("ready");
        this.callbacks.onSpeakEnd?.(speech.turnId);
      } else if (
        message.event_type === "conversation.utterance" &&
        typeof message.properties?.text === "string"
      ) {
        this.callbacks.onTranscript?.(message.properties.text, this.currentSpeech?.turnId);
      }
    });
    call.on("left-meeting", () => this.handleDisconnected("left_meeting"));
    call.on("error", () => this.handleDisconnected("daily_error"));
  }

  private handleDisconnected(reason: string): void {
    if (this.disposed) return;
    this.ready = false;
    this.callbacks.onConnectionStateChange?.("disconnected");
    this.callbacks.onDisconnected?.(reason);
    const error = new Error(`Tavus disconnected: ${reason}`);
    this.currentSpeech?.rejectStarted(error);
    this.currentSpeech?.rejectEnded(error);
  }

  private async waitUntilReady(): Promise<void> {
    if (this.ready) return;
    await new Promise<void>((resolve, reject) => {
      const startedAt = performance.now();
      const check = () => {
        if (this.ready) {
          resolve();
          return;
        }
        if (this.disposed) {
          reject(new Error("Tavus session was disposed before the stream became ready"));
          return;
        }
        if (performance.now() - startedAt >= this.connectionTimeoutMs) {
          reject(new Error("Tavus video stream timed out"));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }
}

function createPendingSpeech(turnId?: string): PendingSpeech {
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
  void endedPromise.catch(() => {});
  return {
    turnId,
    started: false,
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
