import type { LatencySegmentKey, LatencyServiceInfo } from "@/services/latencySegments";
import { getGameplaySettings, getLLMSettings, getTTSSettings } from "@/services/settingsService";
import { getSTTProvider, getSTTProviderDefinition } from "@/services/stt";
import { getActiveProviderId, getHumeSettings, getInworldSettings } from "@/services/tts/providerSettings";

export function getConfiguredTTSServiceInfo(): LatencyServiceInfo {
  try {
    const provider = getActiveProviderId();
    if (provider === "inworld") {
      const settings = getInworldSettings();
      return {
        serviceProvider: "Inworld",
        serviceName: "inworld",
        model: settings.modelId,
        mode: settings.deliveryMode,
      };
    }
    if (provider === "hume") {
      const settings = getHumeSettings();
      return {
        serviceProvider: "Hume",
        serviceName: "hume",
        model: "octave",
        mode: settings.format,
      };
    }
    return {
      serviceProvider: "ElevenLabs",
      serviceName: "elevenlabs",
      model: getTTSSettings().modelId,
      mode: "streaming",
    };
  } catch {
    return { serviceProvider: "Unknown", serviceName: "Unknown", model: "Unknown", mode: "realtime" };
  }
}

export function getConfiguredSTTServiceInfo(): LatencyServiceInfo {
  try {
    const providerId = getSTTProvider();
    const provider = getSTTProviderDefinition(providerId);
    return {
      serviceProvider: provider.label,
      serviceName: provider.id,
      model: provider.id === "deepgram" ? "nova-2" : provider.id,
      mode: provider.mode,
    };
  } catch {
    return { serviceProvider: "Deepgram", serviceName: "deepgram", model: "nova-2", mode: "streaming" };
  }
}

export function getConfiguredLLMServiceInfo(model?: string): LatencyServiceInfo {
  return {
    serviceProvider: "OpenRouter",
    serviceName: "openrouter",
    model: model || "Unknown",
    endpointType: "llm",
  };
}

export function getConfiguredRAGServiceInfo(): LatencyServiceInfo {
  try {
    const provider = getGameplaySettings().RAG_EMBEDDING_PROVIDER || "Unknown";
    return {
      serviceProvider: provider === "voyage" ? "Voyage" : provider === "openai" ? "OpenAI" : "Unknown",
      serviceName: provider,
      model: "Unknown",
      endpointType: "rag",
    };
  } catch {
    return { serviceProvider: "Unknown", serviceName: "Unknown", model: "Unknown", endpointType: "rag" };
  }
}

export function getConfiguredLatencyServices(): Partial<Record<LatencySegmentKey, LatencyServiceInfo>> {
  const llmSettings = (() => {
    try {
      return getLLMSettings();
    } catch {
      return null;
    }
  })();

  return {
    rag_ms: getConfiguredRAGServiceInfo(),
    gm_pre_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL_GM),
    max_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL),
    validator_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL_GM),
    tts_ms: getConfiguredTTSServiceInfo(),
    gm_post_ms: getConfiguredLLMServiceInfo(llmSettings?.LLM_MODEL_GM),
  };
}

export function latencyServiceLabel(service: LatencyServiceInfo) {
  return [service.serviceProvider || service.serviceName, service.model && service.model !== "Unknown" ? service.model : null]
    .filter(Boolean)
    .join(" · ") || "Unknown";
}
