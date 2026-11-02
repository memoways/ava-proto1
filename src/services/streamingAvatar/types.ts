import type {
  AnamAvatarSettings,
  HeyGenEncoding,
  HeyGenQuality,
  HeyGenVoiceSettings,
  KnownStreamingAvatarProvider,
  LemonSliceAvatarSettings,
  SelectableStreamingAvatarProvider,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

export type {
  AnamAvatarSettings,
  AnamCueTag,
  AnamDirectorNotes,
  AnamSessionOptions,
  AnamVoiceGenerationOptions,
  HeyGenCartesiaVoice,
  HeyGenElevenLabsVoice,
  HeyGenFishVoice,
  HeyGenVoiceEngine,
  HeyGenVoiceSettings,
  LemonSliceAvatarSettings,
} from "../../../supabase/functions/_shared/streamingAvatarRequest";

export type OutputMode = "tts" | "streaming_avatar";
/** Providers that can be selected and started today (factory + secret). */
export type StreamingAvatarProviderId = SelectableStreamingAvatarProvider;
/** Every provider Ava knows; today all of them are selectable. */
export type KnownStreamingAvatarProviderId = KnownStreamingAvatarProvider;
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
  quality: HeyGenQuality;
  encoding: HeyGenEncoding;
  /** 0 = not sent, LiveAvatar applies the subscription limit. */
  maxSessionDurationSeconds: number;
  voiceSettings: HeyGenVoiceSettings;
  sandbox: boolean;
}

/** Facial emotions accepted by Tavus `conversation.set_emotion` (Phoenix-4+ faces). */
export const TAVUS_EMOTIONS = [
  "sadness",
  "fear",
  "anger",
  "disgust",
  "contempt",
  "surprise",
  "neutral",
  "happiness",
] as const;
export type TavusEmotion = (typeof TAVUS_EMOTIONS)[number];

export interface TavusAvatarSettings {
  replicaId: string;
  personaId: string;
  /** `properties.languages` codes; the first one opens the conversation. */
  languages: string[];
  maxDurationSeconds: number;
  participantAbsentTimeoutSeconds: number;
  participantLeftTimeoutSeconds: number;
  enableClosedCaptions: boolean;
  /** Ignored by Phoenix-4.5 faces. */
  applyGreenscreen: boolean;
  /** Tavus `policy: "eu"` (AI Act resolution of `auto` settings). */
  euPolicy: boolean;
  /** Face emotion while speaking (set_emotion + Echo tag); Ava's characters are in distress. */
  emotion: TavusEmotion;
  /** Face emotion held while listening; sadness reads as pitiful, so closed and neutral by default. */
  listeningEmotion: TavusEmotion;
}

export interface StreamingAvatarSettings {
  activeProvider: StreamingAvatarProviderId;
  connectionTimeoutMs: number;
  fallbackTimeoutMs: number;
  heygen: HeyGenAvatarSettings;
  tavus: TavusAvatarSettings;
  anam: AnamAvatarSettings;
  lemonslice: LemonSliceAvatarSettings;
}

export interface ResponseOutputPrepareContext {
  sessionId: string;
  signal?: AbortSignal;
}

export interface ResponseOutputTurnContext {
  /** Scripted greeting, eligible for completed REST audio caching. */
  cacheOpening?: boolean;
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
  event: "tracks" | "playback" | "network" | "cpu" | "warm_up";
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
  /** Wait before the opening line; `warmUpComplete` false when the bound was reached. */
  warmUpMs?: number;
  warmUpComplete?: boolean;
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

export type AvatarVideoFit = "cover" | "contain";

export interface ResponseOutput {
  readonly mode: OutputMode;
  readonly provider: string;
  /** Technical avatar/model identifier actually selected by this instance. */
  readonly model?: string;
  readonly externalSessionId: string | null;
  /**
   * How the live video fills the conversation screen. Absent means "cover" (HeyGen, Tavus,
   * Anam); LemonSlice only renders portrait/square frames, so it asks for the whole frame.
   */
  readonly videoFit?: AvatarVideoFit;
  prepare(context: ResponseOutputPrepareContext): Promise<void>;
  renderText(text: string, context?: ResponseOutputTurnContext): Promise<ResponseOutputResult>;
  attachMedia(element: HTMLMediaElement): void;
  interrupt(): void;
  /** Listening posture while the player speaks (HeyGen, LemonSlice); others ignore the call. */
  setListening?(listening: boolean): void;
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
