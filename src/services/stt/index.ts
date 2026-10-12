import { observeVoice, observeService } from "../voiceTurnTelemetryV2";
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
  const requested = (await loadSTTSettingsFromDB()).activeProvider;
  const provider = await resolveRuntimeSTTProvider(requested);
  let session: STTSession;
  const transcript: TranscriptCallback = (text, final) => {
    if (final) {
      observeVoice(opts?.onVoiceObservation, "transcript_final");
      const meta = session?.getLastFinalTelemetry?.();
      observeService(opts?.onServiceObserved, {
        service: "stt", requested_provider: requested, requested_model: null,
        resolved_provider: provider, resolved_model: null,
        effective_provider: meta?.provider ?? provider, effective_model: meta?.model ?? null,
        transport: provider === "openai_whisper" ? "http_batch" : "websocket",
        fallback: requested !== provider,
      });
    }
    onTranscript(text, final);
  };
  if (provider === "gamilab") {
    void Promise.resolve(opts?.initialStream).then((stream) => stream?.getTracks().forEach((track) => track.stop())).catch(() => {});
    session = new GamilabSTT(transcript, opts);
  } else if (provider === "gradium") session = new GradiumSTT(transcript, opts);
  else if (provider === "openai_whisper") session = new OpenAIWhisperSTT(transcript, opts);
  else if (provider === "assemblyai") session = new AssemblyAISTT(transcript, opts);
  else session = createDeepgramSTT(transcript, opts);
  return session;
}
