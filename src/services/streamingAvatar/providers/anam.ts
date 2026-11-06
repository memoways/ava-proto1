import {
  AnamEvent,
  createClient,
  MessageRole,
  type AnamClient,
  type DirectorNoteCueTag,
  type MessageDeliveryFailure,
  type MessageStreamEvent,
} from "@anam-ai/js-sdk";
import { endAvatarSession, startAvatarSession } from "../api";
import { AvSyncController, DEFAULT_AV_SYNC, readAvSample, summarizeLine, type AvSyncOptions, type PlayoutTargets } from "../avSync";
import { readNetworkPath, type AvatarNetworkPath } from "../networkPath";
import { splitAvatarText } from "../textSegmentation";
import {
  resolveAnamSpeakingCue,
  stripAnamCueTags,
} from "../../../../supabase/functions/_shared/streamingAvatarRequest";
import type { AvatarCueObservation } from "../../voiceTurnTelemetryV2";
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
  /** A/V offsets measured while this line played. */
  avOffsets: number[];
  resolveStarted: () => void;
  rejectStarted: (error: Error) => void;
  resolveEnded: () => void;
  rejectEnded: (error: Error) => void;
  startedPromise: Promise<void>;
  endedPromise: Promise<void>;
}

export interface AnamWarmUpTiming {
  /** Longest wait for a ready session and a steady stream; past it Ava speaks anyway. */
  maxWaitMs: number;
  /** Pause once the stream is steady, before the opening line. */
  settleMs: number;
  /** Interval between two WebRTC stats samples. */
  pollMs: number;
  /** Consecutive steady samples required: video at full rate, no freeze, audio flowing. */
  steadySamples: number;
}

const DEFAULT_WARM_UP: AnamWarmUpTiming = { maxWaitMs: 10_000, settleMs: 500, pollMs: 250, steadySamples: 6 };
/** Below this decoded rate the stream is still ramping up (bandwidth estimation, keyframes). */
const STEADY_MIN_FPS = 20;
/** Silence kept after the playout buffer drained before a held A/V correction applies. */
const FLUSH_MARGIN_MS = 300;

interface InboundSample {
  at: number;
  framesDecoded: number;
  freezeCount: number;
  audioPackets: number;
}

/**
 * Anam in text mode: the persona says Ava's text through a talk stream (Anam LLM off,
 * `CUSTOMER_CLIENT_V1`). The SDK never opens the microphone (`disableInputAudio`), so no sound
 * reaches Anam. Persona transcript events mark the start and the end of each spoken line.
 * The speaking cue goes over the data channel (face only): an inline `[sad]` tag would also
 * drive an expressive voice, which shouts the first words then calms down. In "evolving" mode
 * the cue follows the turn's acting intent, so the face changes register with the session.
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
  private readonly warmUpTiming: AnamWarmUpTiming;
  private resolveSessionReady!: () => void;
  private readonly sessionReady = new Promise<void>((resolve) => { this.resolveSessionReady = resolve; });
  private warmUp: Promise<void> | null = null;
  private readonly avSync: AvSyncController;
  private readonly avSyncPollMs: number;
  private avSyncTimer: ReturnType<typeof setInterval> | null = null;
  private avSyncBusy = false;
  private avSyncStopReported = false;
  /** Correction computed during a line, applied once it ends. */
  private pendingTargets: PlayoutTargets | null = null;
  private lastAudioPackets = -1;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    settings: AnamAvatarSettings,
    callbacks: ResponseOutputCallbacks,
    connectionTimeoutMs: number,
    speechStartTimeoutMs: number,
    warmUpTiming: AnamWarmUpTiming = DEFAULT_WARM_UP,
    avSyncOptions: AvSyncOptions = DEFAULT_AV_SYNC,
  ) {
    this.avSync = new AvSyncController(avSyncOptions);
    this.avSyncPollMs = avSyncOptions.pollMs;
    this.warmUpTiming = warmUpTiming;
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
      // Client metrics stay on: connection telemetry only (milestones, ICE restarts, errors),
      // which feeds Anam's session performance page in Lab; no text and no audio.
      disableInputAudio: true,
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
    this.applyPlayoutTargets(this.avSync.targets);
    this.startAvSync();
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
    // The UI stays on the connection screen until the warm-up before the first line ends.
    this.callbacks.onConnectionStateChange?.("warming");
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
    // The opening line waits for a warmed-up stream: sent on the first tracks, it came out of sync.
    this.warmUp ??= this.waitForWarmUp(this.mediaElement);
    await this.warmUp;
    if (this.disposed || context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    const startedAt = performance.now();
    let firstStartedAt = 0;
    const chunks = splitAvatarText(text);
    const talk = this.client.createTalkMessageStream();
    const speech = createPendingSpeech(talk.getCorrelationId(), context?.turnId);
    this.currentSpeech = speech;
    const abort = () => this.interrupt();
    context?.signal?.addEventListener("abort", abort, { once: true });
    let cueObservation: AvatarCueObservation | null = null;
    try {
      cueObservation = this.sendSpeakingCue(context);
      // One talk stream per line, plain text: the voice keeps its own steady delivery.
      for (let index = 0; index < chunks.length; index++) {
        if (this.disposed || context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
        await talk.streamMessageChunk(chunks[index], index === chunks.length - 1);
      }
      await withDeadline(speech.startedPromise, this.speechStartTimeoutMs, "Anam did not start speaking");
      firstStartedAt = performance.now();
      context?.onPlaybackStart?.();
      await withDeadline(speech.endedPromise, 90_000, "Anam speech did not finish");
      this.reportLineSync(speech, cueObservation, context);
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
      this.scheduleFlush();
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
    this.stopAvSync();
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

  /**
   * Face-only cue for the whole next persona turn; it holds until the turn ends. A refused
   * send leaves the line spoken without a cue. Reported per line, labels only.
   */
  private sendSpeakingCue(context?: ResponseOutputTurnContext): AvatarCueObservation {
    const intent = context?.performance;
    const { cue, origin } = resolveAnamSpeakingCue(this.settings, intent, context?.characterKey);
    let sent = false;
    if (cue !== "none" && this.client) {
      try {
        this.client.sendDirectorNoteCue(cue as DirectorNoteCueTag, { atSeconds: 0 });
        sent = true;
      } catch (error) {
        console.warn("[Anam] speaking cue not sent", error);
      }
    }
    const observation: AvatarCueObservation = {
      provider: "anam",
      cue,
      sent,
      origin,
      emotion: intent?.emotion ?? null,
      intensity: intent?.intensity ?? null,
      source: intent?.source ?? null,
      speech_state: intent?.speechState ? intent.speechState.slice(0, 60) : null,
      tempered: intent?.tempered === "calmed",
    };
    try {
      context?.onAvatarCue?.(observation);
      this.callbacks.onMediaDiagnostics?.({
        event: "speaking_cue",
        cue,
        cueSent: sent,
        cueOrigin: origin,
        emotion: observation.emotion,
        intensity: observation.intensity,
        performanceSource: observation.source,
        speechState: observation.speech_state,
        tempered: observation.tempered,
      });
    } catch {
      // Diagnostics never block a line.
    }
    return observation;
  }

  /** Lip sync of the line just spoken, added to its turn telemetry (stored per turn). */
  private reportLineSync(speech: PendingSpeech, observation: AvatarCueObservation | null, context?: ResponseOutputTurnContext): void {
    if (!observation) return;
    const stats = summarizeLine(speech.avOffsets);
    const { audioMs, videoMs } = this.avSync.targets;
    try {
      context?.onAvatarCue?.({
        ...observation,
        av_samples: stats.samples,
        av_offset_median_ms: stats.medianMs,
        av_offset_max_abs_ms: stats.maxAbsMs,
        audio_playout_target_ms: audioMs,
        video_playout_target_ms: videoMs,
      });
    } catch {
      // Diagnostics never block a line.
    }
  }

  private async waitForWarmUp(element: HTMLMediaElement): Promise<void> {
    const startedAt = performance.now();
    const deadline = startedAt + this.warmUpTiming.maxWaitMs;
    const ready = await Promise.race([
      Promise.all([this.sessionReady, waitForFirstFrame(element)]).then(() => true),
      delay(this.warmUpTiming.maxWaitMs).then(() => false),
    ]);
    const steady = ready ? await this.waitForSteadyStream(deadline) : { steady: false, videoFps: null };
    const path = await this.selectedNetworkPath();
    this.callbacks.onMediaDiagnostics?.({
      event: "warm_up",
      warmUpMs: Math.round(performance.now() - startedAt),
      warmUpComplete: ready && steady.steady !== false,
      steadyStream: steady.steady,
      videoFps: steady.videoFps,
      avOffsetMs: this.avSync.lastOffsetMs,
      ...this.playoutDiagnostics(),
      ...path,
      requestedRegion: this.settings.sessionOptions.region,
    });
    await delay(this.warmUpTiming.settleMs);
    // Shown once, right before the first line: no back and forth with the portrait.
    if (!this.disposed && this.ready) this.callbacks.onConnectionStateChange?.("ready");
  }

  /**
   * Polls the receiving stats until video decodes at full rate without freezing while audio
   * flows. `steady: null` when the SDK hides its peer connection (fixed settle only).
   */
  private async waitForSteadyStream(deadline: number): Promise<{ steady: boolean | null; videoFps: number | null }> {
    const pc = this.peerConnection();
    if (!pc) return { steady: null, videoFps: null };
    let previous: InboundSample | null = null;
    let streak = 0;
    let videoFps: number | null = null;
    while (!this.disposed && performance.now() < deadline) {
      const sample = await readInbound(pc).catch(() => null);
      if (sample && previous && sample.at > previous.at) {
        videoFps = Math.round(((sample.framesDecoded - previous.framesDecoded) * 1000) / (sample.at - previous.at));
        // Steady also means lips in sync: the opening line waits for the A/V correction.
        const steady = videoFps >= STEADY_MIN_FPS
          && sample.freezeCount === previous.freezeCount
          && sample.audioPackets > previous.audioPackets
          && this.avSync.isSettled(performance.now());
        streak = steady ? streak + 1 : 0;
        if (streak >= this.warmUpTiming.steadySamples) return { steady: true, videoFps };
      }
      if (sample) previous = sample;
      await delay(this.warmUpTiming.pollMs);
    }
    return { steady: false, videoFps };
  }

  /** Route taken by the stream (direct or TURN fallback); null when the connection is private. */
  private async selectedNetworkPath(): Promise<AvatarNetworkPath | null> {
    const pc = this.peerConnection();
    if (!pc) return null;
    try {
      return await readNetworkPath(pc);
    } catch {
      return null;
    }
  }

  /**
   * Playout target per track. Both start on the same floor (without it the jitter buffers start
   * minimal, underrun and grow over the first lines); the A/V sync then delays the track ahead.
   */
  private applyPlayoutTargets(targets: PlayoutTargets): void {
    for (const receiver of this.peerConnection()?.getReceivers() ?? []) {
      const tunable = receiver as RTCRtpReceiver & { jitterBufferTarget?: number | null };
      if (!("jitterBufferTarget" in tunable)) continue; // Not supported by this browser.
      const kind = receiver.track?.kind;
      try {
        tunable.jitterBufferTarget = kind === "video" ? targets.videoMs : kind === "audio" ? targets.audioMs : DEFAULT_AV_SYNC.baseMs;
      } catch (error) {
        console.warn("[Anam] playout buffer not applied", error);
      }
    }
  }

  /** Measures the audio/video offset for the whole session and corrects it as it drifts. */
  private startAvSync(): void {
    if (this.avSyncTimer || !this.peerConnection()) return;
    this.avSyncTimer = setInterval(() => { void this.avSyncTick(); }, this.avSyncPollMs);
  }

  private stopAvSync(): void {
    if (this.avSyncTimer) clearInterval(this.avSyncTimer);
    this.avSyncTimer = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private async avSyncTick(): Promise<void> {
    const pc = this.peerConnection();
    if (this.disposed || !pc) return this.stopAvSync();
    if (this.avSyncBusy) return;
    this.avSyncBusy = true;
    try {
      const sample = await readAvSample(pc).catch(() => null);
      if (!sample || this.disposed) return;
      const flowing = sample.audioPackets > this.lastAudioPackets;
      this.lastAudioPackets = sample.audioPackets;
      const element = this.mediaElement;
      // Only what the viewer sees counts: no sample while the element is detached or paused
      // (cinematic, screen change) or while audio stalls; the window restarts afterwards.
      const playing = Boolean(element && element.isConnected && !element.paused);
      const offset = sample.offsetMs;
      if (offset === null || !flowing || !playing) {
        this.avSync.discard();
        return;
      }
      const speech = this.currentSpeech;
      if (speech?.started && !speech.ended) speech.avOffsets.push(offset);
      if (this.pendingTargets) return; // Waiting for the line to end.
      const targets = this.avSync.observe(offset, performance.now());
      if (targets) {
        if (this.currentSpeech) this.pendingTargets = targets; // Never move a buffer mid-line.
        else this.commitTargets(targets, offset);
      } else if (this.avSync.stopped && !this.avSyncStopReported) {
        this.avSyncStopReported = true;
        this.callbacks.onMediaDiagnostics?.({ event: "av_sync", avOffsetMs: offset, avSyncState: "ineffective", ...this.playoutDiagnostics() });
        this.stopAvSync();
      }
    } catch {
      // Diagnostics and sync never break a session.
    } finally {
      this.avSyncBusy = false;
    }
  }

  private commitTargets(targets: PlayoutTargets, offset: number | null): void {
    this.applyPlayoutTargets(targets);
    this.callbacks.onMediaDiagnostics?.({ event: "av_sync", avOffsetMs: offset, avSyncState: "corrected", ...this.playoutDiagnostics() });
  }

  /**
   * Anam reports the end of speech before the last words leave the playout buffer: the held
   * correction waits for that buffer to drain, so the tail of the line is never stretched.
   */
  private scheduleFlush(): void {
    if (!this.pendingTargets || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPendingTargets();
    }, this.avSync.targets.audioMs + FLUSH_MARGIN_MS);
  }

  /** Applies a correction held during the line, in the silence that follows it. */
  private flushPendingTargets(): void {
    const targets = this.pendingTargets;
    if (!targets || this.disposed || this.currentSpeech) return; // A new line: wait for its end.
    this.pendingTargets = null;
    this.commitTargets(targets, this.avSync.lastOffsetMs);
    this.avSync.restartCooldown(performance.now());
  }

  private playoutDiagnostics(): { audioPlayoutTargetMs: number; videoPlayoutTargetMs: number } {
    const { audioMs, videoMs } = this.avSync.targets;
    return { audioPlayoutTargetMs: audioMs, videoPlayoutTargetMs: videoMs };
  }

  /** The SDK keeps its peer connection private; read it defensively, absent on other versions. */
  private peerConnection(): RTCPeerConnection | null {
    const internals = this.client as unknown as {
      streamingClient?: { getPeerConnection?: () => RTCPeerConnection | null };
    } | null;
    try {
      return internals?.streamingClient?.getPeerConnection?.() ?? null;
    } catch {
      return null;
    }
  }

  private bindEvents(client: AnamClient): void {
    client.addListener(AnamEvent.SESSION_READY, () => this.resolveSessionReady());
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
    this.stopAvSync();
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
    avOffsets: [],
    resolveStarted,
    rejectStarted,
    resolveEnded,
    rejectEnded,
    startedPromise,
    endedPromise,
  };
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** Resolves once the element shows a decoded frame, so speech never starts on a black stream. */
function waitForFirstFrame(element: HTMLMediaElement): Promise<void> {
  const video = element as HTMLVideoElement;
  if (typeof video.requestVideoFrameCallback === "function") {
    return new Promise((resolve) => { video.requestVideoFrameCallback(() => resolve()); });
  }
  if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    element.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

async function readInbound(pc: RTCPeerConnection): Promise<InboundSample> {
  const sample: InboundSample = { at: performance.now(), framesDecoded: 0, freezeCount: 0, audioPackets: 0 };
  (await pc.getStats()).forEach((report: Record<string, unknown>) => {
    if (report.type !== "inbound-rtp") return;
    if (report.kind === "video") {
      sample.framesDecoded += Number(report.framesDecoded ?? 0);
      sample.freezeCount += Number(report.freezeCount ?? 0);
    } else if (report.kind === "audio") {
      sample.audioPackets += Number(report.packetsReceived ?? 0);
    }
  });
  return sample;
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
