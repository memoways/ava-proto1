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
  signal?: AbortSignal;
  onPlaybackStart?: () => void;
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
  error?: Error;
}

export interface ResponseOutputCallbacks {
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
  readonly externalSessionId: string | null;
  prepare(context: ResponseOutputPrepareContext): Promise<void>;
  renderText(text: string, context?: ResponseOutputTurnContext): Promise<ResponseOutputResult>;
  attachMedia(element: HTMLMediaElement): void;
  interrupt(): void;
  dispose(): Promise<void>;
}

export class AvatarRenderError extends Error {
  readonly started: boolean;

  constructor(message: string, started: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "AvatarRenderError";
    this.started = started;
  }
}
