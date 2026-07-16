import { DeepgramSTT } from "@/services/deepgramSTT";
import { debugLogger } from "@/services/debugLogger";
import { GamilabSTT, prefetchGamilabSDK } from "./providers/gamilabSTT";
import { GradiumSTT } from "./providers/gradiumSTT";
import { OpenAIWhisperSTT } from "./providers/openaiWhisperSTT";
import { AssemblyAISTT } from "./providers/assemblyaiSTT";
import { getSTTRuntimeConfig } from "./runtimeConfig";
import { loadSTTSettingsFromDB } from "./settings";
import type { STTCreateOptions, STTProviderId, STTSession, TranscriptCallback } from "./types";

export type { STTProviderId, STTProviderStatus, STTSession, STTSettings } from "./types";
export { STT_PROVIDER_LIST, getSTTProviderDefinition } from "./registry";
export {
  DEFAULT_STT_SETTINGS,
  getSTTProvider,
  getSTTSettings,
  loadSTTSettingsFromDB,
  normalizeSTTProviderId,
  resetSTTSettings,
  resetSTTSettingsCache,
  saveSTTSettingsLocal,
  saveSTTSettingsToDB,
} from "./settings";
export { getSTTProviderRuntimeStatuses, getSTTRuntimeConfig, resetSTTRuntimeConfigCache } from "./runtimeConfig";
export { prefetchGamilabSDK };

function createDeepgramSTT(onTranscript: TranscriptCallback, opts?: STTCreateOptions): STTSession {
  return new DeepgramSTT(onTranscript, opts);
}

export async function resolveRuntimeSTTProvider(providerId?: STTProviderId): Promise<STTProviderId> {
  const selectedProvider = providerId ?? (await loadSTTSettingsFromDB()).activeProvider;
  if (selectedProvider === "deepgram") return "deepgram";

  const config = await getSTTRuntimeConfig();
  if (config.configured[selectedProvider]) return selectedProvider;

  debugLogger.log({
    service: "stt",
    level: "warn",
    direction: "in",
    label: `STT provider ${selectedProvider} unavailable, falling back to Deepgram`,
  });
  return "deepgram";
}

export async function createConfiguredSTT(
  onTranscript: TranscriptCallback,
  opts?: STTCreateOptions,
): Promise<STTSession> {
  const provider = await resolveRuntimeSTTProvider();
  if (provider === "gamilab") {
    void Promise.resolve(opts?.initialStream).then((stream) => stream?.getTracks().forEach((track) => track.stop())).catch(() => {});
    return new GamilabSTT(onTranscript, opts);
  }
  if (provider === "gradium") return new GradiumSTT(onTranscript, opts);
  if (provider === "openai_whisper") return new OpenAIWhisperSTT(onTranscript, opts);
  if (provider === "assemblyai") return new AssemblyAISTT(onTranscript, opts);
  return createDeepgramSTT(onTranscript, opts);
}
