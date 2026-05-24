import type { STTProviderDefinition, STTProviderId } from "./types";

export const STT_PROVIDER_LIST: STTProviderDefinition[] = [
  {
    id: "deepgram",
    label: "Deepgram",
    description: "Provider actuel — streaming WebSocket basse latence.",
    mode: "streaming",
    expectedSecrets: ["DEEPGRAM_API_KEY"],
    implemented: true,
  },
  {
    id: "gamilab",
    label: "Gamilab",
    description: "ASR/STT live via SDK Gamilab. Provider prioritaire pour production.",
    mode: "streaming",
    expectedSecrets: ["GAMILAB_PORTAL_ID", "GAMILAB_API_KEY"],
    implemented: true,
  },
  {
    id: "openai_whisper",
    label: "OpenAI Whisper",
    description: "Transcription batch via /v1/audio/transcriptions (whisper-1). Pas de partiels, qualité de référence.",
    mode: "batch",
    expectedSecrets: ["OPENAI_API_KEY"],
    implemented: true,
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    description: "Universal Streaming v3 — WebSocket realtime PCM 16kHz avec turn detection.",
    mode: "streaming",
    expectedSecrets: ["ASSEMBLYAI_API_KEY"],
    implemented: true,
  },
];

export function getSTTProviderDefinition(providerId: STTProviderId): STTProviderDefinition;
export function getSTTProviderDefinition(providerId: string): STTProviderDefinition;
export function getSTTProviderDefinition(providerId: string): STTProviderDefinition {
  return STT_PROVIDER_LIST.find((provider) => provider.id === providerId) ?? STT_PROVIDER_LIST[0];
}
