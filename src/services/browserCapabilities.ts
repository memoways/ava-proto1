export const MEDIA_RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export interface BrowserDiagnostics {
  userAgent: string;
  mediaRecorderSupported: boolean;
  selectedMimeType: string;
  audioContextSupported: boolean;
  online: boolean;
  network?: {
    effectiveType?: string;
    rttMs?: number;
    downlinkMbps?: number;
    saveData?: boolean;
  };
}

interface NetworkInformationLike {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

export function selectMediaRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean = (mimeType) => {
    const Recorder = globalThis.MediaRecorder;
    return typeof Recorder?.isTypeSupported === "function" && Recorder.isTypeSupported(mimeType);
  },
): string {
  for (const mimeType of MEDIA_RECORDER_MIME_CANDIDATES) {
    if (isTypeSupported(mimeType)) return mimeType;
  }
  return "";
}

export function getBrowserDiagnostics(selectedMimeType = ""): BrowserDiagnostics {
  const AudioCtx = globalThis.AudioContext || (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const connection = (globalThis.navigator as Navigator & { connection?: NetworkInformationLike } | undefined)?.connection;
  return {
    userAgent: globalThis.navigator?.userAgent || "unknown",
    mediaRecorderSupported: typeof globalThis.MediaRecorder !== "undefined",
    selectedMimeType,
    audioContextSupported: typeof AudioCtx !== "undefined",
    online: globalThis.navigator?.onLine ?? true,
    network: connection ? {
      effectiveType: connection.effectiveType,
      rttMs: connection.rtt,
      downlinkMbps: connection.downlink,
      saveData: connection.saveData,
    } : undefined,
  };
}
