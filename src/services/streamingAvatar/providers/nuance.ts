import type { Conversation } from "@nuancelabs/js-sdk";
import { endAvatarSession, startAvatarSession } from "../api";
import { withDeadline } from "../avatarAudioBridge";
import { buildNuanceSpeakInstruction } from "../../../../supabase/functions/_shared/streamingAvatarRequest";
import {
  AvatarRenderError,
  type NuanceAvatarSettings,
  type ResponseOutput,
  type ResponseOutputCallbacks,
  type ResponseOutputPrepareContext,
  type ResponseOutputResult,
  type ResponseOutputTurnContext,
} from "../types";

/** Nuance can spend about half a minute getting a persona ready. */
const CONNECT_FLOOR_MS = 35_000;
/** A line that never starts is a failed send, not a hung call. */
const SPEECH_START_FLOOR_MS = 12_000;
const LINE_CAP_MS = 45_000;

/**
 * Nuance Live. The persona has its own English voice (Sam, Sonia or Mira).
 * Ava cannot send audio: `session.input_audio.append` is refused.
 *
 * `verbatim` mutes what the persona hears, then sends Ava's line as a one-time
 * instruction. Nuance may rephrase it or refuse it (`instructions_refused`),
 * in which case the call falls back to Ava's own voice.
 * `native` leaves the microphone open and does not send Ava's line: the persona
 * answers by itself.
 */
export class NuanceStreamingAvatarOutput implements ResponseOutput {
  readonly mode = "streaming_avatar" as const;
  readonly provider = "nuance";
  readonly videoFit = "contain" as const;
  get model() { return this.settings.personaId; }

  private readonly settings: NuanceAvatarSettings;
  private readonly callbacks: ResponseOutputCallbacks;
  private readonly connectionTimeoutMs: number;
  private readonly speechStartTimeoutMs: number;
  private conversation: Conversation | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaElement: HTMLMediaElement | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private avaSessionId = "";
  private _externalSessionId: string | null = null;
  private disposed = false;
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private readonly readyPromise: Promise<void>;
  private lineFirstAt = 0;
  private line: {
    eventId: string;
    started: boolean;
    firstStartMs: number;
    finish: (error: Error | null) => void;
  } | null = null;

  constructor(
    settings: NuanceAvatarSettings,
    callbacks: ResponseOutputCallbacks,
    connectionTimeoutMs: number,
    speechStartTimeoutMs: number,
  ) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.connectionTimeoutMs = connectionTimeoutMs;
    this.speechStartTimeoutMs = speechStartTimeoutMs;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  get externalSessionId(): string | null {
    return this._externalSessionId;
  }

  async prepare(context: ResponseOutputPrepareContext): Promise<void> {
    if (this.conversation) return;
    this.avaSessionId = context.sessionId;
    this.callbacks.onConnectionStateChange?.("connecting");
    const started = await startAvatarSession({
      provider: "nuance",
      sessionId: context.sessionId,
      nuance: this.settings,
      signal: context.signal,
    });
    if (started.provider !== "nuance") throw new Error("Unexpected avatar provider response");
    this._externalSessionId = started.externalSessionId;
    if (context.signal?.aborted) throw new DOMException("Avatar preparation aborted", "AbortError");

    const { createNuanceConversation } = await import("@nuancelabs/js-sdk");
    const conversation = createNuanceConversation({
      token: async () => started.sessionToken,
      mediaDevices: { cameraEnabled: false },
    });
    this.conversation = conversation;
    conversation.onChange((event) => {
      if (this.disposed) return;
      if (event.type === "tracks-changed") this.publishTracks();
      if (event.type === "speaking-changed" && event.participant === "avatar" && event.isSpeaking) {
        this.noteSpeechStarted();
      }
      if (event.type === "session-ended") {
        this.callbacks.onDisconnected?.(event.reason);
        this.callbacks.onConnectionStateChange?.("disconnected");
      }
    });
    conversation.onInterfaceEvent((event) => this.onInterfaceEvent(event));

    try {
      await withDeadline(
        conversation.connect().then(() => this.readyPromise),
        Math.max(this.connectionTimeoutMs, CONNECT_FLOOR_MS),
        "Nuance connection timed out",
      );
    } catch (cause) {
      await this.dispose();
      throw cause;
    }
    if (context.signal?.aborted || this.disposed) {
      throw new DOMException("Avatar preparation aborted", "AbortError");
    }
    this.ready = true;
    this.callbacks.onStreamReady?.();
    this.callbacks.onConnectionStateChange?.("ready");
  }

  async renderText(
    text: string,
    context?: ResponseOutputTurnContext,
  ): Promise<ResponseOutputResult> {
    if (!this.conversation || !this.ready) {
      throw new AvatarRenderError("Nuance video stream is not ready", false);
    }
    if (context?.signal?.aborted) throw new DOMException("Avatar turn aborted", "AbortError");
    if (this.settings.drive === "native") {
      return emptyResult("skipped");
    }
    const line = text.replace(/\s+/g, " ").trim();
    if (!line) return emptyResult("skipped");

    const eventId = `line_${crypto.randomUUID()}`;
    const startedAt = performance.now();
    const playback = this.waitForLine(eventId, startedAt, context?.signal);
    const settled: Promise<
      | { ok: true; value: { firstStartMs: number } }
      | { ok: false; error: unknown }
    > = playback.then(
      (value) => ({ ok: true, value }),
      (error: unknown) => ({ ok: false, error }),
    );
    this.callbacks.onConnectionStateChange?.("speaking");
    try {
      await this.send({
        type: "response.create",
        event_id: eventId,
        response: {
          instructions: buildNuanceSpeakInstruction(line),
          tool_choice: "none",
        },
      });
      const outcome = await settled;
      if (outcome.ok === false) throw outcome.error;
      const playbackTotalMs = Math.round(performance.now() - startedAt);
      this.callbacks.onSpeakEnd?.(context?.turnId);
      this.callbacks.onConnectionStateChange?.("ready");
      return {
        status: "played",
        provider: this.provider,
        model: this.model,
        firstPlaybackStartMs: outcome.value.firstStartMs,
        playbackTotalMs,
        generatedSegments: 1,
        playedSegments: 1,
        failedSegments: 0,
        started: true,
      };
    } catch (cause) {
      const error = cause instanceof AvatarRenderError
        ? cause
        : new AvatarRenderError(
          cause instanceof Error ? cause.message : String(cause),
          this.line?.started === true,
          { cause },
        );
      this.line?.finish(error);
      if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
      throw error;
    }
  }

  attachMedia(element: HTMLMediaElement): void {
    if (this.disposed) return;
    if (this.mediaElement && this.mediaElement !== element) this.mediaElement.srcObject = null;
    this.mediaElement = element;
    this.publishTracks();
  }

  interrupt(): void {
    void this.send({ type: "session.output_audio.interrupt" }).catch(() => {});
    this.line?.finish(new DOMException("Avatar turn aborted", "AbortError"));
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.line?.finish(new DOMException("Avatar turn aborted", "AbortError"));
    const conversation = this.conversation;
    this.conversation = null;
    try {
      await conversation?.disconnect();
    } catch {
      // Already gone.
    }
    if (this.mediaElement) this.mediaElement.srcObject = null;
    this.mediaElement = null;
    this.audioElement?.remove();
    this.audioElement = null;
    if (this._externalSessionId && this.avaSessionId) {
      await endAvatarSession({
        provider: "nuance",
        sessionId: this.avaSessionId,
        externalSessionId: this._externalSessionId,
      }).catch(() => {});
    }
  }

  private onInterfaceEvent(event: Record<string, unknown>): void {
    if (this.disposed) return;
    if (event.type === "session.started") {
      void this.silenceThenReady();
    }
    if (event.type === "session.output_transcript.delta" && typeof event.delta === "string") {
      this.noteSpeechStarted();
      this.callbacks.onTranscript?.(event.delta);
    }
    if (event.type === "session.output_audio.done") {
      this.line?.finish(null);
    }
    if (event.type === "error") {
      const code = nuanceErrorCode(event);
      const matches = this.line && event.client_event_id === this.line.eventId;
      if (matches || code === "instructions_refused") {
        const message = code === "instructions_refused"
          ? "Nuance a refusé la réplique (instructions_refused)"
          : `Nuance a refusé l'envoi (${code})`;
        this.line?.finish(new AvatarRenderError(message, this.line?.started === true));
      }
    }
    if (event.type === "session.closed") {
      this.callbacks.onDisconnected?.(typeof event.reason === "string" ? event.reason : undefined);
    }
  }

  private async silenceThenReady(): Promise<void> {
    if (this.settings.drive === "verbatim") {
      await this.send({ type: "session.input_audio.mute" }).catch(() => {});
    }
    this.readyResolve?.();
    this.readyResolve = null;
  }

  private noteSpeechStarted(): void {
    if (!this.line || this.line.started) return;
    this.line.started = true;
    this.line.firstStartMs = Math.round(performance.now() - this.lineFirstAt);
    this.callbacks.onSpeakStart?.();
  }

  private waitForLine(
    eventId: string,
    startedAt: number,
    signal?: AbortSignal,
  ): Promise<{ firstStartMs: number }> {
    this.lineFirstAt = startedAt;
    return new Promise((resolve, reject) => {
      let settled = false;
      const entry = {
        eventId,
        started: false,
        firstStartMs: 0,
        finish: (error: Error | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(startTimer);
          clearTimeout(lineTimer);
          signal?.removeEventListener("abort", onAbort);
          if (this.line === entry) this.line = null;
          if (error) reject(error);
          else resolve({ firstStartMs: entry.firstStartMs });
        },
      };
      this.line = entry;
      const startTimer = setTimeout(() => {
        if (!entry.started) {
          entry.finish(new AvatarRenderError("Nuance n'a pas commencé à parler", false));
        }
      }, Math.max(this.speechStartTimeoutMs, SPEECH_START_FLOOR_MS));
      const lineTimer = setTimeout(() => {
        entry.finish(new AvatarRenderError("Nuance n'a pas terminé la réplique", entry.started));
      }, LINE_CAP_MS);
      const onAbort = () => entry.finish(new DOMException("Avatar turn aborted", "AbortError"));
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private async send(event: Record<string, unknown>): Promise<void> {
    if (!this.conversation || this.disposed) return;
    await this.conversation.sendInterfaceEvent(event);
  }

  private publishTracks(): void {
    const conversation = this.conversation;
    if (!conversation) return;
    let avatar: Conversation["avatar"] | null = null;
    try {
      avatar = conversation.avatar;
    } catch {
      return;
    }
    const stream = this.ensureStream();
    const audioTrack = avatar.audioTrack?.mediaStreamTrack;
    if (stream && audioTrack) addTrack(stream, audioTrack);
    if (avatar.videoTrack && this.mediaElement instanceof HTMLVideoElement) {
      avatar.videoTrack.attach(this.mediaElement);
    }
    if (this.mediaElement && stream && audioTrack && stream.getTracks().length > 0 && !(this.mediaElement instanceof HTMLVideoElement)) {
      if (this.mediaElement.srcObject !== stream) this.mediaElement.srcObject = stream;
      void this.mediaElement.play?.().catch(() => {});
    }
    if (avatar.audioTrack) {
      this.audioElement ??= document.createElement("audio");
      this.audioElement.autoplay = true;
      if (!this.audioElement.isConnected) document.body.appendChild(this.audioElement);
      avatar.audioTrack.attach(this.audioElement);
      void this.audioElement.play().catch(() => {});
    }
    if (this.mediaElement instanceof HTMLVideoElement) {
      void this.mediaElement.play().catch(() => {});
    }
  }

  private ensureStream(): MediaStream | null {
    if (typeof MediaStream !== "function") return null;
    this.mediaStream ??= new MediaStream();
    return this.mediaStream;
  }
}

function addTrack(stream: MediaStream, track: MediaStreamTrack): void {
  if (stream.getTracks().includes(track)) return;
  try {
    stream.addTrack(track);
  } catch {
    // A test double is not a real track. The element attach path still runs.
  }
}

function nuanceErrorCode(event: Record<string, unknown>): string {
  const error = event.error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return typeof event.code === "string" ? event.code : "error";
}

function emptyResult(status: "skipped"): ResponseOutputResult {
  return {
    status,
    provider: "nuance",
    firstPlaybackStartMs: 0,
    playbackTotalMs: 0,
    generatedSegments: 0,
    playedSegments: 0,
    failedSegments: 0,
    started: false,
  };
}
