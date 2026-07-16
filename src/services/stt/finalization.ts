const normalizeTranscript = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Deepgram returns finalized segments separately from the current interim
 * segment. Preserve both while avoiding duplication when a provider returns a
 * running, full-turn transcript instead.
 */
export function combineTranscriptParts(finalized: string, interim: string): string {
  const stable = normalizeTranscript(finalized);
  const live = normalizeTranscript(interim);
  if (!stable) return live;
  if (!live) return stable;

  const stableLower = stable.toLocaleLowerCase();
  const liveLower = live.toLocaleLowerCase();
  if (stableLower === liveLower || stableLower.endsWith(liveLower)) return stable;
  if (liveLower.startsWith(stableLower)) return live;
  if (stableLower.startsWith(liveLower)) return stable;
  return `${stable} ${live}`;
}

/** Prefer the richest running/final candidate when both represent a full turn. */
export function pickMostCompleteTranscript(...candidates: string[]): string {
  return candidates
    .map(normalizeTranscript)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 25,
): Promise<boolean> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return predicate();
}

/** Ensure the recorder's tail has reached `ondataavailable` before upload/finalize. */
export async function requestLatestRecorderData(
  recorder: MediaRecorder | null,
  timeoutMs = 350,
): Promise<void> {
  if (!recorder || recorder.state === "inactive") return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    recorder.addEventListener("dataavailable", finish, { once: true });
    try {
      recorder.requestData();
    } catch {
      finish();
    }
    setTimeout(finish, timeoutMs);
  });
}
