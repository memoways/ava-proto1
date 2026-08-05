export interface ResumeTimerWindow {
  configuredDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
}

/**
 * Retire la marge technique de reprise du temps réellement jouable. La marge
 * garde la ligne retrouvable pendant les dernières écritures, sans prolonger
 * la conversation.
 */
export function resolveResumeTimerWindow(
  startedAt: string,
  resumeExpiresAt: string,
  nowMs = Date.now(),
  marginSeconds = 300,
): ResumeTimerWindow | null {
  const startedAtMs = new Date(startedAt).getTime();
  const expiresAtMs = new Date(resumeExpiresAt).getTime();
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= startedAtMs) return null;
  const resumeWindowSeconds = Math.max(1, Math.ceil((expiresAtMs - startedAtMs) / 1_000));
  const configuredDurationSeconds = Math.max(1, resumeWindowSeconds - Math.max(0, marginSeconds));
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1_000));
  return {
    configuredDurationSeconds,
    elapsedSeconds: Math.min(configuredDurationSeconds, elapsedSeconds),
    remainingSeconds: Math.max(1, configuredDurationSeconds - elapsedSeconds),
  };
}
