import {
  AgentEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  type AgentEvent,
} from "@heygen/liveavatar-web-sdk";
import { endAvatarSession, startAvatarSession } from "../api";
import { sendHeyGenSpeakText } from "../protocolCommands";
import { splitAvatarText } from "../textSegmentation";
import {
  AvatarRenderError,
  type HeyGenAvatarSettings,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
} from "../types";

interface PendingSpeech {
  commandId: string;
  turnId?: string;
  text: string;
  startedAt: number;
  started: boolean;
  resolveStarted: () => void;
  rejectStarted: (error: Error) => void;
  resolveEnded: () => void;
  rejectEnded: (error: Error) => void;
  startedPromise: Promise<void>;
  endedPromise: Promise<void>;
}

export class HeyGenStreamingAvatarOutput implements ResponseOutput {
  readonly mode = "streaming_avatar" as const;
  readonly provider = "heygen";
  private readonly settings: HeyGenAvatarSettings;
  private readonly callbacks: ResponseOutputCallbacks;
  private readonly connectionTimeoutMs: number;
  private readonly speechStartTimeoutMs: number;
  private session: LiveAvatarSession | null = null;
  private avaSessionId = "";
  private token = "";
  private _externalSessionId: string | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private streamReady = false;
  private disposed = false;
  private currentSpeech: PendingSpeech | null = null;

  constructor(
    settings: HeyGenAvatarSettings,
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
    if (this.session) return;
    this.avaSessionId = context.sessionId;
    this.callbacks.onConnectionStateChange?.("connecting");
    const started = await startAvatarSession({
      provider: "heygen",
      sessionId: context.sessionId,
      heygen: this.settings,
      signal: context.signal,
    });
    if (started.provider !== "heygen") throw new Error("Unexpected avatar provider response");
    this.token = started.sessionToken;
    this._externalSessionId = started.externalSessionId;

    // Explicitly disable the SDK voice-chat path: Ava's microphone belongs only
    // to its own STT pipeline and must never be published to LiveAvatar.
    const session = new LiveAvatarSession(this.token, { voiceChat: false });
    this.session = session;
    this.bindEvents(session);
    await withDeadline(session.start(), this.connectionTimeoutMs, "HeyGen connection timed out");
    await this.waitUntilStreamReady();
    if (context.signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");
    this.callbacks.onConnectionStateChange?.("ready");
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.session || !this.streamReady) {
      throw new AvatarRenderError("HeyGen video stream is not ready", false);
    }
    const startedAt = performance.now();
    let firstStartedAt = 0;
    let playedSegments = 0;
    let currentStarted = false;
    const chunks = splitAvatarText(text);
    try {
      for (const chunk of chunks) {
        if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
        const speech = this.createSpeech(
          sendHeyGenSpeakText(this.session, chunk),
          chunk,
          context?.turnId,
        );
        this.currentSpeech = speech;
        const abort = () => this.interrupt();
        context?.signal?.addEventListener("abort", abort, { once: true });
        try {
          await withDeadline(
            speech.startedPromise,
            this.speechStartTimeoutMs,
            "HeyGen did not start speaking",
          );
          currentStarted = true;
          firstStartedAt ||= performance.now();
          if (playedSegments === 0) context?.onPlaybackStart?.();
          await withDeadline(speech.endedPromise, 90_000, "HeyGen speech did not finish");
          playedSegments++;
        } finally {
          context?.signal?.removeEventListener("abort", abort);
          if (this.currentSpeech === speech) this.currentSpeech = null;
        }
      }
      return {
        status: "played",
        provider: "HeyGen LiveAvatar",
        model: this.settings.avatarId,
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
    if (this.streamReady) this.session?.attach(element);
  }

  interrupt(): void {
    try {
      this.session?.interrupt();
    } catch {
      // Interruption is best effort during disconnect/cleanup.
    }
    const error = new Error("HeyGen speech interrupted");
    this.currentSpeech?.rejectStarted(error);
    this.currentSpeech?.rejectEnded(error);
    this.currentSpeech = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.interrupt();
    const session = this.session;
    this.session = null;
    try {
      await session?.stop();
    } catch {
      // The server-side end call below remains the authoritative cleanup.
    }
    if (this._externalSessionId && this.avaSessionId) {
      await endAvatarSession({
        provider: "heygen",
        sessionId: this.avaSessionId,
        externalSessionId: this._externalSessionId,
        sessionToken: this.token,
      }).catch((error) => console.warn("[HeyGen] server cleanup failed", error));
    }
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private bindEvents(session: LiveAvatarSession): void {
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (this.disposed) return;
      this.streamReady = true;
      if (this.mediaElement) session.attach(this.mediaElement);
      this.callbacks.onStreamReady?.();
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, (reason) => {
      if (this.disposed) return;
      this.streamReady = false;
      this.callbacks.onConnectionStateChange?.("disconnected");
      this.callbacks.onDisconnected?.(String(reason));
      const error = new Error(`HeyGen disconnected: ${String(reason)}`);
      this.currentSpeech?.rejectStarted(error);
      this.currentSpeech?.rejectEnded(error);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, (event) => {
      if (this.disposed) return;
      if (!this.isCurrentEvent(event)) return;
      const speech = this.currentSpeech;
      if (!speech || speech.started) return;
      speech.started = true;
      speech.resolveStarted();
      this.callbacks.onConnectionStateChange?.("speaking");
      this.callbacks.onSpeakStart?.(speech.turnId);
    });
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, (event) => {
      if (this.disposed) return;
      if (!this.isCurrentEvent(event)) return;
      const speech = this.currentSpeech;
      if (!speech) return;
      speech.resolveEnded();
      this.callbacks.onConnectionStateChange?.("ready");
      this.callbacks.onSpeakEnd?.(speech.turnId);
    });
    session.on(AgentEventsEnum.AVATAR_TRANSCRIPTION, (event) => {
      if (this.disposed) return;
      const speech = this.currentSpeech;
      this.callbacks.onTranscript?.(event.text, speech?.turnId);
    });
  }

  private isCurrentEvent(event: AgentEvent): boolean {
    const speech = this.currentSpeech;
    if (!speech) return false;
    return !event.source_event_id || event.source_event_id === speech.commandId;
  }

  private createSpeech(commandId: string, text: string, turnId?: string): PendingSpeech {
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
    // `interrupt()` rejects both gates. Mark the second gate as observed even
    // when the first one rejects before renderText starts awaiting the second.
    void endedPromise.catch(() => {});
    return {
      commandId,
      turnId,
      text,
      startedAt: performance.now(),
      started: false,
      resolveStarted,
      rejectStarted,
      resolveEnded,
      rejectEnded,
      startedPromise,
      endedPromise,
    };
  }

  private async waitUntilStreamReady(): Promise<void> {
    if (this.streamReady) return;
    await new Promise<void>((resolve, reject) => {
      const startedAt = performance.now();
      const check = () => {
        if (this.streamReady) {
          resolve();
          return;
        }
        if (this.disposed) {
          reject(new Error("HeyGen session was disposed before the stream became ready"));
          return;
        }
        if (performance.now() - startedAt >= this.connectionTimeoutMs) {
          reject(new Error("HeyGen video stream timed out"));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }
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
