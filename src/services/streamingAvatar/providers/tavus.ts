import DailyIframe, {
  type DailyCall,
  type DailyEventObjectAppMessage,
  type DailyEventObjectTrack,
  type DailyNetworkStats,
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
  ended: boolean;
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
  get model() { return this.settings.replicaId; }
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
  private mediaPlayback: Promise<void> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

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
    if (this.mediaElement) this.mediaElement.srcObject = this.mediaStream;
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
    this.statsTimer = setInterval(() => {
      void call.getNetworkStats().then(stats => {
        if (!this.disposed) this.reportNetwork(stats);
      }).catch(() => {});
    }, 5000);
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.call || !this.ready || !this._externalSessionId) {
      throw new AvatarRenderError("Tavus video stream is not ready", false);
    }
    if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    // Do not send speech until the browser accepts audible media playback.
    // Provider speaking events alone are not proof of local audio output.
    if (!this.mediaElement || !this.mediaPlayback) {
      throw new AvatarRenderError("Tavus media player is not attached", false);
    }
    try {
      await withDeadline(this.mediaPlayback, this.speechStartTimeoutMs, "Tavus media playback timed out");
    } catch (cause) {
      throw new AvatarRenderError("Tavus audio/video playback failed", false, { cause });
    }
    const startedAt = performance.now();
    let firstStartedAt = 0;
    let playedSegments = 0;
    let currentStarted = false;
    const chunks = splitAvatarText(text);
    try {
      for (const chunk of chunks) {
        if (this.disposed || context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
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
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
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
    if (this.mediaElement) this.mediaElement.srcObject = null;
    this.mediaElement = null;
    this.mediaPlayback = null;
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private bindEvents(call: DailyCall): void {
    call.on("track-started", (event: DailyEventObjectTrack | undefined) => {
      if (this.disposed || !event?.participant || event.participant.local || !this.mediaStream) return;
      if (event.type !== "video" && event.type !== "audio") return;
      if (!this.mediaStream.getTracks().some((track) => track.id === event.track.id)) {
        // Keep one track of each kind; reconnects must not retain stale audio.
        for (const old of this.mediaStream.getTracks()) {
          if (old.kind === event.track.kind) this.mediaStream.removeTrack(old);
        }
        this.mediaStream.addTrack(event.track);
      }
      if (this.mediaElement) {
        // Adding a track to the existing stream does not require srcObject reset.
        this.playMedia();
      }
      this.reportTracks();
      if (this.mediaStream.getVideoTracks().length && this.mediaStream.getAudioTracks().length && !this.ready) {
        this.ready = true;
        this.callbacks.onStreamReady?.();
      }
    });
    call.on("app-message", (event: DailyEventObjectAppMessage<TavusMessage> | undefined) => {
      const message = event?.data;
      if (this.disposed || !message) return;
      if (message.conversation_id && message.conversation_id !== this._externalSessionId) return;
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
        if (!speech || !speech.started || speech.ended) return;
        speech.ended = true;
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
    call.on("network-quality-change", event => { if (event) this.reportNetwork(event); });
    call.on("cpu-load-change", event => {
      if (event) this.callbacks.onMediaDiagnostics?.({ event: "cpu", cpuState: event.cpuLoadState, cpuReason: event.cpuLoadStateReason });
    });
    call.on("track-stopped", event => {
      if (!event || event.participant?.local || !this.mediaStream) return;
      const track = this.mediaStream.getTracks().find(track => track.id === event.track.id);
      // Transient network interruptions keep the persistent track attached.
      if (track?.readyState === "ended") {
        this.mediaStream.removeTrack(track);
        this.reportTracks();
        this.handleDisconnected(`${event.type}_track_ended`);
      }
    });
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

  private reportNetwork(value: DailyNetworkStats): void {
    const latest = "latest" in value.stats ? value.stats.latest : undefined;
    this.callbacks.onMediaDiagnostics?.({ event: "network", networkState: value.networkState,
      audioBitrate: latest?.audioRecvBitsPerSecond, videoBitrate: latest?.videoRecvBitsPerSecond,
      audioPacketLoss: latest?.audioRecvPacketLoss, videoPacketLoss: latest?.videoRecvPacketLoss,
      audioJitter: latest?.audioRecvJitter, videoJitter: latest?.videoRecvJitter,
      roundTripTime: latest?.networkRoundTripTime });
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
          reject(new Error(`Tavus audio/video tracks timed out (audio=${this.mediaStream?.getAudioTracks().length ?? 0}, video=${this.mediaStream?.getVideoTracks().length ?? 0})`));
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
    ended: false,
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
