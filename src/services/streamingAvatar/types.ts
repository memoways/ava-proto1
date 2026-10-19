export type OutputMode = "tts" | "streaming_avatar";
export type StreamingAvatarProviderId = "heygen" | "tavus";
export type StreamingAvatarConnectionState =
  | "inactive"
  | "connecting"
  | "ready"
  | "speaking"
  | "disconnected"
  | "failed";

export interface OutputSettings {
  mode: OutputMode;
}

export interface HeyGenAvatarSettings {
  avatarId: string;
  voiceId: string;
  contextId: string;
  language: string;
  quality: "low" | "medium" | "high";
  sandbox: boolean;
}

export interface TavusAvatarSettings {
  replicaId: string;
  personaId: string;
  language: string;
  maxDurationSeconds: number;
}

export interface StreamingAvatarSettings {
  activeProvider: StreamingAvatarProviderId;
  connectionTimeoutMs: number;
  fallbackTimeoutMs: number;
  heygen: HeyGenAvatarSettings;
  tavus: TavusAvatarSettings;
}

export interface ResponseOutputPrepareContext {
  sessionId: string;
  signal?: AbortSignal;
}

export interface ResponseOutputTurnContext {
  sessionId?: string;
  turnId?: string;
  turnIndex?: number;
  attemptId?: string;
  onVoiceObservation?: import("../voiceTurnTelemetryV2").VoiceObserver;
  onServiceObserved?: (value: import("../voiceTurnTelemetryV2").ServiceObservation) => void;
  signal?: AbortSignal;
  onPlaybackStart?: () => void;
  /** Per-character TTS voice override; used by the Max→Emma V1 handoff. */
  voiceId?: string;
  /** Per-character TTS provider override. */
  providerId?: import("@/services/tts/types").TTSProviderId;
  /** Active character key so Gradium (and later providers) can apply per-character tuning. */
  characterKey?: string;
  /** Per-turn acting intent forwarded to the TTS queue. */
  performance?: import("@/services/tts/performanceIntent").PerformanceIntent;
}

export interface ResponseOutputResult {
  status: "played" | "failed" | "cancelled" | "skipped";
  provider: string;
  model?: string;
  firstPlaybackStartMs: number;
  playbackTotalMs: number;
  generatedSegments: number;
  playedSegments: number;
  failedSegments: number;
  started: boolean;
  services?: import("../voiceTurnTelemetryV2").ServiceObservation[];
  generationWallMs?: number;
  error?: Error;
  videoLatency?: VideoLatencyObservation;
}

export interface VideoLatencyObservation {
  provider: string;
  model?: string;
  waitMs: number;
  status: "started" | "failed" | "cancelled" | "not_measured";
  precision: "provider_speech_event";
  fallbackUsed?: boolean;
}

/** Technical-only fields; never include room URLs, tokens or spoken text. */
export interface AvatarMediaDiagnostics {
  event: "tracks" | "playback" | "network" | "cpu";
  audioTracks?: number;
  videoTracks?: number;
  playback?: "playing" | "blocked" | "failed";
  errorName?: string;
  networkState?: string;
  audioBitrate?: number | null;
  videoBitrate?: number | null;
  audioPacketLoss?: number | null;
  videoPacketLoss?: number | null;
  audioJitter?: number | null;
  videoJitter?: number | null;
  roundTripTime?: number | null;
  cpuState?: "low" | "high";
  cpuReason?: string;
}

export interface ResponseOutputCallbacks {
  onMediaDiagnostics?: (diagnostics: AvatarMediaDiagnostics) => void;
  onConnectionStateChange?: (state: StreamingAvatarConnectionState) => void;
  onStreamReady?: () => void;
  onDisconnected?: (reason?: string) => void;
  onSpeakStart?: (turnId?: string) => void;
  onSpeakEnd?: (turnId?: string) => void;
  onTranscript?: (text: string, turnId?: string) => void;
}

export interface ResponseOutput {
  readonly mode: OutputMode;
  readonly provider: string;
  /** Technical avatar/model identifier actually selected by this instance. */
  readonly model?: string;
  readonly externalSessionId: string | null;
  prepare(context: ResponseOutputPrepareContext): Promise<void>;
  renderText(text: string, context?: ResponseOutputTurnContext): Promise<ResponseOutputResult>;
  attachMedia(element: HTMLMediaElement): void;
  interrupt(): void;
  dispose(): Promise<void>;
}

export class AvatarRenderError extends Error {
  readonly started: boolean;

  constructor(message: string, started: boolean, options?: { cause?: unknown }) {
    super(message);
    this.name = "AvatarRenderError";
    this.started = started;
    if (options && "cause" in options) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
