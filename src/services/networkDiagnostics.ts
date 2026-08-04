import type { BrowserDiagnostics } from "@/services/browserCapabilities";
import { classifyTraceUpload } from "@/services/conversationTraceOutbox";

export interface PassiveNetworkVerdict {
  voice: "compatible" | "degraded" | "incompatible";
  traceSync: "unknown" | "ok" | "degraded" | "critical";
  label: string;
}

export interface PassiveVoiceNetworkObservation {
  sttConnected: boolean | null;
  lastSttConnectedAt: number | null;
  firstAudioMs: number | null;
  firstAudioTimeouts: number;
}

const VOICE_NETWORK_STORAGE_KEY = "ava_passive_voice_network";

export function getPassiveVoiceNetworkObservation(): PassiveVoiceNetworkObservation {
  const fallback: PassiveVoiceNetworkObservation = {
    sttConnected: null,
    lastSttConnectedAt: null,
    firstAudioMs: null,
    firstAudioTimeouts: 0,
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(VOICE_NETWORK_STORAGE_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

export function recordPassiveVoiceNetworkObservation(
  update: Partial<PassiveVoiceNetworkObservation>,
): void {
  if (typeof localStorage === "undefined") return;
  const current = getPassiveVoiceNetworkObservation();
  localStorage.setItem(VOICE_NETWORK_STORAGE_KEY, JSON.stringify({ ...current, ...update }));
}

export function getPassiveNetworkVerdict(
  browser: Pick<BrowserDiagnostics, "online" | "network">,
  upload?: { bps?: number | null; durationMs?: number | null },
  observedVoice: PassiveVoiceNetworkObservation = getPassiveVoiceNetworkObservation(),
): PassiveNetworkVerdict {
  const effectiveType = browser.network?.effectiveType;
  const rttMs = browser.network?.rttMs;
  const voice = !browser.online
    ? "incompatible"
    : observedVoice.firstAudioTimeouts > 0 || observedVoice.sttConnected === false
      ? "degraded"
      : effectiveType === "slow-2g" || (typeof rttMs === "number" && rttMs >= 800) ||
          (typeof observedVoice.firstAudioMs === "number" && observedVoice.firstAudioMs > 8_000)
      ? "degraded"
      : "compatible";
  const traceSync = typeof upload?.bps === "number" && typeof upload.durationMs === "number"
    ? classifyTraceUpload(upload.bps, upload.durationMs)
    : "unknown";
  const voiceLabel = voice === "compatible" ? "Voix compatible" : voice === "degraded" ? "Voix réseau dégradée" : "Voix hors ligne";
  const syncLabel = traceSync === "unknown"
    ? "synchronisation des traces non mesurée"
    : traceSync === "ok"
      ? "synchronisation des traces correcte"
      : traceSync === "degraded"
        ? "synchronisation des traces lente"
        : "synchronisation des traces très lente";
  return { voice, traceSync, label: `${voiceLabel} — ${syncLabel}` };
}
