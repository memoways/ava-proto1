import DailyIframe, {
  type DailyCall,
  type DailyEventObjectTrack,
  type DailyNetworkStats,
} from "@daily-co/daily-js";
import { getTTSSettings } from "@/services/settingsService";
import { generateSpeech } from "@/services/tts";
import { getActiveProviderId, resolveGradiumSettings } from "@/services/tts/providerSettings";
import { chunkTextForTTS } from "@/services/tts/textChunking";
import type { TTSProviderId } from "@/services/tts/types";
import { controlLemonSliceSession, endAvatarSession, startAvatarSession } from "../api";
import {
  buildLemonSliceAudioCommand,
  LEMONSLICE_HEARTBEAT_MS,
  parseLemonSliceServerMessage,
  pcm16BytesToFloat,
  rawPcmRate,
  speechToLemonSliceChunks,
  type LemonSliceClientCommand,
} from "../lemonSliceAudio";
import { lemonSliceActionsAllowed } from "../../../../supabase/functions/_shared/streamingAvatarRequest";
import {
  AvatarRenderError,
  type LemonSliceAvatarSettings,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
} from "../types";

interface PendingPlayback {
  turnId?: string;
  /** `audio_end` sent: an earlier `playback_finished` (pause between segments) is not the end. */
  committed: boolean;
  resolve: (interrupted: boolean) => void;
  reject: (error: Error) => void;
  promise: Promise<boolean>;
}

/** The idle timer is reset while the player speaks, at most this often. */
const IDLE_RESET_INTERVAL_MS = 20_000;
const LISTEN_ACTION_INTERVAL_MS = 4_000;

/**
 * LemonSlice in audio mode: Ava keeps its microphone, STT, LLM and the voice of its characters.
 * Each line is synthesized by Ava's TTS, converted to PCM16 at the session rate and streamed to
 * the LemonSlice WebSocket; the animated face and that same audio come back through a private
 * Daily room the browser joins receive-only (`canSend: false`), so nothing local plays twice and
 * the player's microphone is never published. `playback_finished` ends each line.
 */
export class LemonSliceStreamingAvatarOutput implements ResponseOutput {
  readonly mode = "streaming_avatar" as const;
  readonly provider = "lemonslice";
  // LemonSlice has no landscape output (2x3, 9x16, 1x1): cropping it to a wide screen zooms on the eyes.
  readonly videoFit = "contain" as const;
  get model() { return this.settings.model; }
  private readonly settings: LemonSliceAvatarSettings;
  private readonly callbacks: ResponseOutputCallbacks;
  private readonly connectionTimeoutMs: number;
  private readonly speechStartTimeoutMs: number;
  private call: DailyCall | null = null;
  private socket: WebSocket | null = null;
  private sampleRate = 16_000;
  private mediaStream: MediaStream | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private avaSessionId = "";
  private _externalSessionId: string | null = null;
  private disposed = false;
  private ready = false;
  private playback: PendingPlayback | null = null;
  private turnAbort: AbortController | null = null;
  private mediaPlayback: Promise<void> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastIdleResetAt = 0;
  private lastListenActionAt = 0;

  constructor(
    settings: LemonSliceAvatarSettings,
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
      provider: "lemonslice",
      sessionId: context.sessionId,
      lemonslice: this.settings,
      signal: context.signal,
    });
    if (started.provider !== "lemonslice") throw new Error("Unexpected avatar provider response");
    this._externalSessionId = started.externalSessionId;
    this.sampleRate = started.audioSampleRate === 24_000 ? 24_000 : 16_000;

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
    this.bindCallEvents(call);
    await withDeadline(
      call.join({
        url: started.roomUrl,
        token: started.meetingToken,
        startAudioOff: true,
        startVideoOff: true,
        audioSource: false,
        videoSource: false,
      }),
      this.connectionTimeoutMs,
      "LemonSlice room connection timed out",
    );
    call.setLocalAudio(false, { forceDiscardTrack: true });
    call.setLocalVideo(false);
    await withDeadline(
      this.openSocket(started.websocketAddress),
      this.connectionTimeoutMs,
      "LemonSlice audio bridge timed out",
    );
    await this.waitUntilTracks();
    if (context.signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");
    this.ready = true;
    this.callbacks.onStreamReady?.();
    this.callbacks.onConnectionStateChange?.("ready");
    this.heartbeatTimer = setInterval(() => {
      this.send({ command: "heartbeat", timestamp: Date.now() });
    }, LEMONSLICE_HEARTBEAT_MS);
    this.statsTimer = setInterval(() => {
      void call.getNetworkStats().then((stats) => {
        if (!this.disposed) this.reportNetwork(stats);
      }).catch(() => {});
    }, 5000);
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.call || !this.ready || !this.socket || !this._externalSessionId) {
      throw new AvatarRenderError("LemonSlice video stream is not ready", false);
    }
    if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    // The voice comes back through the room: no speech before audible playback is accepted.
    if (!this.mediaElement || !this.mediaPlayback) {
      throw new AvatarRenderError("LemonSlice media player is not attached", false);
    }
    try {
      await withDeadline(this.mediaPlayback, this.speechStartTimeoutMs, "LemonSlice media playback timed out");
    } catch (cause) {
      throw new AvatarRenderError("LemonSlice audio/video playback failed", false, { cause });
    }

    const turnAbort = new AbortController();
    this.turnAbort = turnAbort;
    const abort = () => this.interrupt();
    context?.signal?.addEventListener("abort", abort, { once: true });
    const startedAt = performance.now();
    let firstSentAt = 0;
    let sentChunks = 0;
    const providerId = context?.providerId ?? getActiveProviderId();
    const lines = chunkTextForTTS(text, providerId === "gradium" ? { maxSingleChars: 320, targetChars: 320 } : undefined);
    const playback = createPendingPlayback(context?.turnId);
    this.playback = playback;
    try {
      // One line ahead: the next segment is synthesized while the current one is streamed.
      let next = this.prefetch(lines, 0, providerId, context, turnAbort.signal);
      for (let index = 0; index < lines.length; index++) {
        const pcmChunks = await withDeadline(
          abortable(next, turnAbort.signal),
          this.ttsDeadline(index),
          "Ava TTS did not answer for LemonSlice",
        );
        if (index + 1 < lines.length) next = this.prefetch(lines, index + 1, providerId, context, turnAbort.signal);
        this.assertTurnAlive(turnAbort.signal);
        for (const pcm of pcmChunks) {
          if (!this.send(buildLemonSliceAudioCommand(pcm, this.sampleRate))) {
            throw new Error("LemonSlice audio bridge is closed");
          }
          sentChunks++;
          if (sentChunks === 1) {
            firstSentAt = performance.now();
            context?.onPlaybackStart?.();
            this.callbacks.onConnectionStateChange?.("speaking");
            this.callbacks.onSpeakStart?.(context?.turnId);
          }
        }
      }
      if (sentChunks === 0) throw new Error("Ava TTS produced no audio for LemonSlice");
      // Commits the turn: without it the trailing audio may drop and the face may freeze.
      this.send({ command: "audio_end" });
      playback.committed = true;
      const interrupted = await withDeadline(playback.promise, 120_000, "LemonSlice playback did not finish");
      this.callbacks.onConnectionStateChange?.("ready");
      this.callbacks.onSpeakEnd?.(context?.turnId);
      return {
        status: interrupted ? "cancelled" : "played",
        provider: "LemonSlice",
        model: this.settings.model,
        firstPlaybackStartMs: Math.round((firstSentAt || performance.now()) - startedAt),
        playbackTotalMs: Math.round(performance.now() - (firstSentAt || startedAt)),
        generatedSegments: lines.length,
        playedSegments: interrupted ? 0 : lines.length,
        failedSegments: 0,
        started: true,
      };
    } catch (cause) {
      if (sentChunks > 0 && this.playback === playback) this.send({ command: "interrupt" });
      throw new AvatarRenderError(
        cause instanceof Error ? cause.message : String(cause),
        sentChunks > 0,
        { cause },
      );
    } finally {
      context?.signal?.removeEventListener("abort", abort);
      if (this.playback === playback) this.playback = null;
      if (this.turnAbort === turnAbort) this.turnAbort = null;
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
    this.turnAbort?.abort();
    const playback = this.playback;
    this.playback = null;
    if (playback) {
      // Stops the current response and drops the queued audio on LemonSlice's side.
      this.send({ command: "interrupt" });
      playback.reject(new Error("LemonSlice speech interrupted"));
    }
  }

  /** Player speaking: keep the session alive and, on CWM-1, nod. The microphone stays with Ava. */
  setListening(listening: boolean): void {
    if (!listening || !this.ready || this.disposed || !this._externalSessionId) return;
    const now = Date.now();
    if (now - this.lastIdleResetAt >= IDLE_RESET_INTERVAL_MS) {
      this.lastIdleResetAt = now;
      this.control({ event: "reset-idle-timeout" });
    }
    if (
      this.settings.listenAction &&
      lemonSliceActionsAllowed(this.settings) &&
      !this.playback &&
      now - this.lastListenActionAt >= LISTEN_ACTION_INTERVAL_MS
    ) {
      this.lastListenActionAt = now;
      this.control({ event: "action", value: "listen" });
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.heartbeatTimer = null;
    this.statsTimer = null;
    this.interrupt();
    this.send({ command: "terminate" });
    const socket = this.socket;
    this.socket = null;
    try {
      socket?.close();
    } catch {
      // Already closed.
    }
    const call = this.call;
    this.call = null;
    try {
      await call?.leave();
    } catch {
      // Continue to destroy/end even if the room already disconnected.
    }
    await call?.destroy().catch(() => {});
    if (this._externalSessionId && this.avaSessionId) {
      // Server side: LemonSlice terminate + private Daily room deleted.
      await endAvatarSession({
        provider: "lemonslice",
        sessionId: this.avaSessionId,
        externalSessionId: this._externalSessionId,
      }).catch((error) => console.warn("[LemonSlice] server cleanup failed", error));
    }
    this.mediaStream = null;
    if (this.mediaElement) this.mediaElement.srcObject = null;
    this.mediaElement = null;
    this.mediaPlayback = null;
    this.callbacks.onConnectionStateChange?.("inactive");
  }

  private ttsDeadline(index: number): number {
    // The first line gates the speech start (fallback deadline); later lines were prefetched.
    return index === 0 ? Math.max(this.speechStartTimeoutMs, 8_000) : 30_000;
  }

  private assertTurnAlive(signal: AbortSignal): void {
    if (this.disposed || signal.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
  }

  private prefetch(
    lines: string[],
    index: number,
    providerId: TTSProviderId,
    context: ResponseOutputTurnContext | undefined,
    signal: AbortSignal,
  ): Promise<Int16Array[]> {
    const pending = this.synthesize(lines, index, providerId, context, signal);
    void pending.catch(() => {}); // Observed by the loop, or dropped after an interruption.
    return pending;
  }

  private async synthesize(
    lines: string[],
    index: number,
    providerId: TTSProviderId,
    context: ResponseOutputTurnContext | undefined,
    signal: AbortSignal,
  ): Promise<Int16Array[]> {
    const blob = await generateSpeech(lines[index], {
      previousText: lines[index - 1],
      nextText: lines[index + 1],
      session_id: context?.sessionId,
      turn_id: context?.turnId,
      turn_index: context?.turnIndex,
      attempt_id: context?.attemptId,
      voiceId: context?.voiceId,
      providerId,
      characterOverride: context?.providerId != null,
      characterKey: context?.characterKey,
      performance: context?.performance,
      cacheOpening: context?.cacheOpening,
      onVoiceObservation: context?.onVoiceObservation,
      onServiceObserved: context?.onServiceObserved,
      signal,
    });
    return decodeSpeech(blob, speechFormat(providerId, context?.characterKey), this.sampleRate);
  }

  private control(control: Parameters<typeof controlLemonSliceSession>[0]["control"]): void {
    if (!this._externalSessionId) return;
    void controlLemonSliceSession({
      sessionId: this.avaSessionId,
      externalSessionId: this._externalSessionId,
      lemonslice: this.settings,
      control,
    }).catch(() => {
      // Cosmetic: the session still works without the nod or an idle reset.
    });
  }

  private send(command: LemonSliceClientCommand): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(command));
    return true;
  }

  private openSocket(address: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // The address carries the capability: it is never logged nor reported.
      const socket = new WebSocket(address);
      this.socket = socket;
      let opened = false;
      socket.onopen = () => {
        opened = true;
        resolve();
      };
      socket.onmessage = (event: MessageEvent) => {
        const message = parseLemonSliceServerMessage(event.data);
        if (!message || this.disposed) return;
        const playback = this.playback;
        if (!playback?.committed) return;
        this.playback = null;
        playback.resolve(message.interrupted);
      };
      socket.onerror = () => {
        if (!opened) reject(new Error("LemonSlice audio bridge failed to open"));
      };
      socket.onclose = (event: CloseEvent) => {
        if (this.socket === socket) this.socket = null;
        if (!opened) reject(new Error(`LemonSlice audio bridge closed (${event.code})`));
        else this.handleDisconnected("bridge_closed");
      };
    });
  }

  private bindCallEvents(call: DailyCall): void {
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
      if (this.mediaElement) this.playMedia();
      this.reportTracks();
    });
    call.on("left-meeting", () => this.handleDisconnected("left_meeting"));
    call.on("error", () => this.handleDisconnected("daily_error"));
    call.on("network-quality-change", (event) => { if (event) this.reportNetwork(event); });
    call.on("cpu-load-change", (event) => {
      if (event) this.callbacks.onMediaDiagnostics?.({ event: "cpu", cpuState: event.cpuLoadState, cpuReason: event.cpuLoadStateReason });
    });
    call.on("track-stopped", (event) => {
      if (!event || event.participant?.local || !this.mediaStream) return;
      const track = this.mediaStream.getTracks().find((candidate) => candidate.id === event.track.id);
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
    const playback = this.playback;
    this.playback = null;
    this.turnAbort?.abort();
    playback?.reject(new Error(`LemonSlice disconnected: ${reason}`));
  }

  private async waitUntilTracks(): Promise<void> {
    const startedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const check = () => {
        const stream = this.mediaStream;
        if (stream?.getVideoTracks().length && stream.getAudioTracks().length) {
          resolve();
          return;
        }
        if (this.disposed) {
          reject(new Error("LemonSlice session was disposed before the stream became ready"));
          return;
        }
        if (performance.now() - startedAt >= this.connectionTimeoutMs) {
          reject(new Error(`LemonSlice audio/video tracks timed out (audio=${stream?.getAudioTracks().length ?? 0}, video=${stream?.getVideoTracks().length ?? 0})`));
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }
}

/** Raw `pcm_*` output of the active TTS settings, if any (containers are decoded instead). */
function speechFormat(providerId: TTSProviderId, characterKey?: string): string | null {
  try {
    if (providerId === "elevenlabs") return getTTSSettings().outputFormat;
    if (providerId === "gradium") return resolveGradiumSettings(characterKey).outputFormat;
  } catch {
    // Settings unavailable: let the browser decode the container.
  }
  return null;
}

async function decodeSpeech(blob: Blob, format: string | null, targetRate: number): Promise<Int16Array[]> {
  const bytes = await blob.arrayBuffer();
  const pcmRate = rawPcmRate(format);
  if (pcmRate) return speechToLemonSliceChunks([pcm16BytesToFloat(bytes)], pcmRate, targetRate);
  let context: OfflineAudioContext;
  try {
    // Decoding into a context at the session rate lets the browser resample.
    context = new OfflineAudioContext(1, 1, targetRate);
  } catch {
    context = new OfflineAudioContext(1, 1, 48_000);
  }
  const buffer = await context.decodeAudioData(bytes);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return speechToLemonSliceChunks(channels, buffer.sampleRate, targetRate);
}

/** An interruption must not wait for the TTS request in flight. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException("Avatar turn aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException("Avatar turn aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function createPendingPlayback(turnId?: string): PendingPlayback {
  let resolve!: (interrupted: boolean) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<boolean>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  void promise.catch(() => {});
  return { turnId, committed: false, resolve, reject, promise };
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
