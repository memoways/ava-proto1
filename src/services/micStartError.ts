/**
 * Why the microphone could not start, for the player (toast) and for the turn
 * telemetry (`capture_error`). iPad recette, 8 Nov 2026: hands-free failed with
 * a generic « Micro indisponible » and no error recorded, so the cause (refused
 * permission, mic busy, browser without capture…) could not be told apart.
 */
export type MicStartErrorKind = "permission" | "no_device" | "busy" | "unsupported" | "unknown";

export interface MicStartErrorInfo {
  kind: MicStartErrorKind;
  name: string;
  message: string;
  title: string;
  description: string;
}

export function describeMicStartError(err: unknown, hasMediaDevices = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)): MicStartErrorInfo {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "UnknownError";
  const message = (err instanceof Error || err instanceof DOMException ? err.message : String(err)).slice(0, 300);
  const base = { name, message };
  if (!hasMediaDevices) {
    return { ...base, kind: "unsupported", title: "Micro inaccessible dans ce navigateur",
      description: "Ouvre la page dans Safari (ou Chrome sur ordinateur), puis réessaie." };
  }
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return { ...base, kind: "permission", title: "Micro refusé",
      description: "Autorise le micro pour ce site dans les réglages du navigateur, recharge la page, puis réessaie." };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return { ...base, kind: "no_device", title: "Aucun micro trouvé", description: "Branche ou active un micro, puis réessaie." };
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return { ...base, kind: "busy", title: "Micro occupé",
      description: "Une autre app ou un autre onglet utilise le micro : ferme-le, puis réessaie." };
  }
  return { ...base, kind: "unknown", title: "Micro indisponible", description: "Réessaie dans un instant." };
}
