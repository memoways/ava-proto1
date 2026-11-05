import DailyIframe, {
  type DailyCall,
  type DailyEventObjectAppMessage,
  type DailyEventObjectTrack,
  type DailyNetworkStats,
} from "@daily-co/daily-js";
import { endAvatarSession, startAvatarSession } from "../api";
import {
  buildTavusEchoCommand,
  buildTavusInterruptCommand,
  buildTavusSetEmotionCommand,
  stripTavusEmotionTags,
} from "../protocolCommands";
import { resolveTavusCharacterSettings } from "../settings";
import { splitAvatarText } from "../textSegmentation";
import {
  AvatarRenderError,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
  type ResolvedTavusCharacterSettings,
  type TavusAvatarSettings,
  type TavusEmotion,
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
  get model() { return this.active.faceId; }
  private readonly settings: TavusAvatarSettings;
  /** Character whose Face and emotions are in use (undefined = global settings). */
  private characterKey: string | undefined;
  private active: ResolvedTavusCharacterSettings;
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
    this.active = resolveTavusCharacterSettings(settings);
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
    this.characterKey = context.characterKey;
    this.active = resolveTavusCharacterSettings(this.settings, context.characterKey);
    await this.connect(context.signal);
  }

  /**
   * Opens a Tavus conversation with the active character's Face. The Face is fixed when the
   * conversation is created, so a character with another Face needs a new conversation.
   */
  private async connect(signal?: AbortSignal): Promise<void> {
    this.callbacks.onConnectionStateChange?.("connecting");
    const started = await startAvatarSession({
      provider: "tavus",
      sessionId: this.avaSessionId,
      tavus: conversationSettings(this.settings, this.active),
      signal,
    });
    if (started.provider !== "tavus") throw new Error("Unexpected avatar provider response");
    if (this.disposed) {
      await endAvatarSession({
        provider: "tavus",
        sessionId: this.avaSessionId,
        externalSessionId: started.externalSessionId,
      }).catch(() => {});
      throw new Error("Tavus session was disposed during connection");
    }
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
    // As early as possible so the face never greets with its default smile.
    this.applyEmotion(this.active.listeningEmotion);
    await this.waitUntilReady();
    if (signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");
    this.applyEmotion(this.active.listeningEmotion);
    this.callbacks.onConnectionStateChange?.("ready");
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = setInterval(() => {
      if (this.call !== call) return;
      void call.getNetworkStats().then(stats => {
        if (!this.disposed && this.call === call) this.reportNetwork(stats);
      }).catch(() => {});
      // While listening the face drifts back to a friendly assistant look; keep it held.
      if (!this.currentSpeech) this.applyEmotion(this.active.listeningEmotion);
    }, 5000);
  }

  /**
   * Applies a character change before its line: same Face keeps the conversation and only
   * switches emotions; another Face closes the conversation and opens a new one.
   */
  private async switchCharacter(characterKey: string, signal?: AbortSignal): Promise<void> {
    const next = resolveTavusCharacterSettings(this.settings, characterKey);
    const sameFace = next.faceId === this.active.faceId;
    this.characterKey = characterKey;
    this.active = next;
    if (sameFace) {
      this.applyEmotion(next.listeningEmotion);
      return;
    }
    await this.closeConversation();
    try {
      await this.connect(signal);
    } catch (cause) {
      throw new AvatarRenderError("Tavus could not open the character's Face", false, { cause });
    }
  }

  /** Leaves the room and ends the Tavus conversation; the output stays usable. */
  private async closeConversation(): Promise<void> {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    this.interrupt();
    const call = this.call;
    const externalSessionId = this._externalSessionId;
    // Cleared first: events of the old room are ignored, not read as a disconnection.
    this.call = null;
    this._externalSessionId = null;
    this.ready = false;
    this.mediaPlayback = null;
    try {
      await call?.leave();
    } catch {
      // Continue to destroy/end even if the room already disconnected.
    }
    await call?.destroy().catch(() => {});
    if (externalSessionId && this.avaSessionId) {
      await endAvatarSession({
        provider: "tavus",
        sessionId: this.avaSessionId,
        externalSessionId,
      }).catch((error) => console.warn("[Tavus] server cleanup failed", error));
    }
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.call || !this.ready || !this._externalSessionId) {
      throw new AvatarRenderError("Tavus video stream is not ready", false);
    }
    if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    if (context?.characterKey && context.characterKey !== this.characterKey) {
      await this.switchCharacter(context.characterKey, context?.signal);
      if (!this.call || !this.ready || !this._externalSessionId) {
        throw new AvatarRenderError("Tavus video stream is not ready", false);
      }
    }
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
    // Re-assert the speaking emotion each turn: cheap, and survives a provider reconnect.
    this.applyEmotion(this.active.emotion);
    try {
      for (const chunk of chunks) {
        if (this.disposed || context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
        const speech = createPendingSpeech(context?.turnId);
        this.currentSpeech = speech;
        const call = this.call;
        const conversationId = this._externalSessionId;
        if (!call || !conversationId) throw new Error("Tavus conversation closed");
        call.sendAppMessage(
          buildTavusEchoCommand(conversationId, chunk, this.active.echoEmotion),
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
        model: this.active.faceId,
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

  private applyEmotion(emotion: TavusEmotion): void {
    if (!this.call || !this._externalSessionId || !emotion) return;
    this.call.sendAppMessage(buildTavusSetEmotionCommand(this._externalSessionId, emotion), "*");
  }

  interrupt(): void {
    if (this.call && this._externalSessionId) {
      this.call.sendAppMessage(buildTavusInterruptCommand(this._externalSessionId), "*");
    }
    const error = new Error("Tavus speech interrupted");
    this.currentSpeech?.rejectStarted(error);
    this.currentSpeech?.rejectEnded(error);
    this.currentSpeech = null;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.closeConversation();
    this.mediaStream = null;
    if (this.mediaElement) this.mediaElement.srcObject = null;
    this.mediaElement = null;
    this.mediaPlayback = null;
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private bindEvents(call: DailyCall): void {
    call.on("track-started", (event: DailyEventObjectTrack | undefined) => {
      if (this.call !== call) return;
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
      if (this.call !== call || this.disposed || !message) return;
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
        // The per-line echo tag ends with the line; switch to the listening emotion.
        this.applyEmotion(this.active.listeningEmotion);
        this.callbacks.onConnectionStateChange?.("ready");
        this.callbacks.onSpeakEnd?.(speech.turnId);
      } else if (
        message.event_type === "conversation.utterance" &&
        typeof message.properties?.text === "string"
      ) {
        this.callbacks.onTranscript?.(
          stripTavusEmotionTags(message.properties.text),
          this.currentSpeech?.turnId,
        );
      }
    });
    call.on("left-meeting", () => { if (this.call === call) this.handleDisconnected("left_meeting"); });
    call.on("error", () => { if (this.call === call) this.handleDisconnected("daily_error"); });
    call.on("network-quality-change", event => { if (event && this.call === call) this.reportNetwork(event); });
    call.on("cpu-load-change", event => {
      if (event && this.call === call) this.callbacks.onMediaDiagnostics?.({ event: "cpu", cpuState: event.cpuLoadState, cpuReason: event.cpuLoadStateReason });
    });
    call.on("track-stopped", event => {
      if (this.call !== call) return;
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

/** Settings sent to the Edge Function: the resolved Face, without the per-character table. */
function conversationSettings(
  settings: TavusAvatarSettings,
  active: ResolvedTavusCharacterSettings,
): TavusAvatarSettings {
  return { ...settings, replicaId: active.faceId, characters: {} };
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
