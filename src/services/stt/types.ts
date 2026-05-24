export type STTProviderId = "deepgram" | "gamilab" | "openai_whisper" | "assemblyai";

export type STTProviderStatus = "ready" | "missing_config" | "error" | "disabled";

export type STTMode = "streaming" | "batch" | "hybrid";

export type TranscriptCallback = (text: string, isFinal: boolean) => void;

export type STTErrorCallback = (
  error: Error,
  context?: Record<string, unknown>,
) => void;

export type STTTelemetryContext = {
  session_id?: string | null;
  turn_id?: string | null;
  turn_index?: number | null;
};

export interface STTProviderDefinition {
  id: STTProviderId;
  label: string;
  description: string;
  mode: STTMode;
  expectedSecrets: string[];
  implemented: boolean;
}

export interface STTSettings {
  activeProvider: STTProviderId;
}

export interface STTSession {
  readonly isActive: boolean;
  start(): Promise<void>;
  stop(): void | Promise<void>;
  pause(): void;
  resume(): void;
  flush(): void;
  setManualMode(manual: boolean): void;
  getStream?(): MediaStream | null;
  getLastFinalTelemetry?(): import("@/services/deepgramSTT").STTFinalTelemetry | null | unknown;
}

export interface STTCreateOptions {
  onError?: STTErrorCallback;
  getTelemetryContext?: () => STTTelemetryContext;
}

export interface STTProviderRuntimeStatus {
  provider: STTProviderId;
  status: STTProviderStatus;
  message?: string;
}
