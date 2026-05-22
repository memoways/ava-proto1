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
  return {
    userAgent: globalThis.navigator?.userAgent || "unknown",
    mediaRecorderSupported: typeof globalThis.MediaRecorder !== "undefined",
    selectedMimeType,
    audioContextSupported: typeof AudioCtx !== "undefined",
  };
}
