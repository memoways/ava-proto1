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
    description: "Transcription externe de référence qualité, préparée en mode minimal.",
    mode: "batch",
    expectedSecrets: ["OPENAI_API_KEY"],
    implemented: false,
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    description: "Alternative commerciale STT, préparée en mode minimal.",
    mode: "hybrid",
    expectedSecrets: ["ASSEMBLYAI_API_KEY"],
    implemented: false,
  },
];

export function getSTTProviderDefinition(providerId: STTProviderId): STTProviderDefinition;
export function getSTTProviderDefinition(providerId: string): STTProviderDefinition;
export function getSTTProviderDefinition(providerId: string): STTProviderDefinition {
  return STT_PROVIDER_LIST.find((provider) => provider.id === providerId) ?? STT_PROVIDER_LIST[0];
}
