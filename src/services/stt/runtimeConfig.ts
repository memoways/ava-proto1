import type { STTProviderId, STTProviderRuntimeStatus } from "./types";
import { authenticatedFunctionFetch } from "@/services/gameAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  || (import.meta.env.VITE_SUPABASE_PROJECT_ID ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co` : "");

export interface STTRuntimeConfig {
  gamilabPortalId: string | null;
  gamilabPortalToken: string | null;
  configured: Record<STTProviderId, boolean>;
}

const DEFAULT_RUNTIME_CONFIG: STTRuntimeConfig = {
  gamilabPortalId: import.meta.env.VITE_GAMILAB_PORTAL_ID || null,
  gamilabPortalToken: null,
  configured: {
    deepgram: true,
    gamilab: false,
    openai_whisper: false,
    assemblyai: false,
    gradium: false,
  },
};

let cachedConfig: STTRuntimeConfig | null = null;
let inFlight: Promise<STTRuntimeConfig> | null = null;
let lastFailureAt = 0;
const FAILURE_BACKOFF_MS = 30_000;

async function fetchRuntimeConfig(): Promise<STTRuntimeConfig> {
  try {
    const res = await authenticatedFunctionFetch(`${SUPABASE_URL}/functions/v1/proxy-stt-config`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`proxy-stt-config ${res.status}`);
    const data = await res.json();
    cachedConfig = {
      gamilabPortalId: data.gamilabPortalId || DEFAULT_RUNTIME_CONFIG.gamilabPortalId,
      gamilabPortalToken: data.gamilabPortalToken || null,
      configured: {
        deepgram: Boolean(data.configured?.deepgram ?? DEFAULT_RUNTIME_CONFIG.configured.deepgram),
        gamilab: Boolean(data.configured?.gamilab ?? DEFAULT_RUNTIME_CONFIG.configured.gamilab),
        openai_whisper: Boolean(data.configured?.openai_whisper ?? DEFAULT_RUNTIME_CONFIG.configured.openai_whisper),
        assemblyai: Boolean(data.configured?.assemblyai ?? DEFAULT_RUNTIME_CONFIG.configured.assemblyai),
        gradium: Boolean(data.configured?.gradium ?? DEFAULT_RUNTIME_CONFIG.configured.gradium),
      },
    };
    lastFailureAt = 0;
    return cachedConfig;
  } catch (err) {
    console.warn("[STT] Runtime config unavailable, using local defaults:", err);
    lastFailureAt = Date.now();
    return DEFAULT_RUNTIME_CONFIG;
  }
}

export async function getSTTRuntimeConfig(): Promise<STTRuntimeConfig> {
  if (cachedConfig) return cachedConfig;
  if (!SUPABASE_URL) return DEFAULT_RUNTIME_CONFIG;
  // Une seule requête en vol partagée par tous les appelants (évite les 429)
  if (inFlight) return inFlight;
  // Après un échec (ex: 429), on attend avant de retenter
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return DEFAULT_RUNTIME_CONFIG;

  inFlight = fetchRuntimeConfig().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function resetSTTRuntimeConfigCache() {
  cachedConfig = null;
  inFlight = null;
  lastFailureAt = 0;
}


export async function getSTTProviderRuntimeStatuses(): Promise<Record<STTProviderId, STTProviderRuntimeStatus>> {
  const config = await getSTTRuntimeConfig();
  return {
    deepgram: {
      provider: "deepgram",
      status: config.configured.deepgram ? "ready" : "missing_config",
      message: config.configured.deepgram ? "Prêt via proxy-stt" : "Secret DEEPGRAM_API_KEY manquant",
    },
    gamilab: {
      provider: "gamilab",
      status: config.configured.gamilab ? "ready" : "missing_config",
      message: config.configured.gamilab ? "Portal configuré côté runtime" : "Secrets GAMILAB_PORTAL_ID / GAMILAB_API_KEY requis",
    },
    openai_whisper: {
      provider: "openai_whisper",
      status: config.configured.openai_whisper ? "ready" : "missing_config",
      message: config.configured.openai_whisper ? "Prêt via proxy-stt-whisper (batch, whisper-1)" : "Secret OPENAI_API_KEY requis",
    },
    assemblyai: {
      provider: "assemblyai",
      status: config.configured.assemblyai ? "ready" : "missing_config",
      message: config.configured.assemblyai ? "Prêt via proxy-stt-assemblyai (Universal Streaming v3)" : "Secret ASSEMBLYAI_API_KEY requis",
    },
    gradium: {
      provider: "gradium",
      status: config.configured.gradium ? "ready" : "missing_config",
      message: config.configured.gradium ? "Prêt via proxy-stt-gradium (REST batch)" : "Secret GRADIUM_API_KEY requis",
    },
  };
}
