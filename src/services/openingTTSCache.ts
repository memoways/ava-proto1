import type { ServiceObservation } from './voiceTurnTelemetryV2';

/** Completed REST audio only. WS keeps its live sample cursor and bypasses this cache. */
export interface OpeningAudio {
  blob: Blob;
  service?: ServiceObservation;
}

const audio = new Map<string, OpeningAudio>();
const MAX_ENTRIES = 16;
const MAX_BYTES = 8 * 1024 * 1024;
let epoch = 0;

export function openingTTSCacheKey(context: {
  environmentId: string;
  text: string;
  providerId: string;
  voiceId?: string;
  characterKey?: string;
  settings: unknown;
  performance?: unknown;
  previousText?: string;
  nextText?: string;
}): string {
  return JSON.stringify(context);
}

function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Opening cancelled', 'AbortError');
}

export async function getOpeningTTSBlob(key: string, generate: () => Promise<OpeningAudio>, signal?: AbortSignal): Promise<OpeningAudio & { cached: boolean }> {
  check(signal);
  const found = audio.get(key);
  if (found) {
    audio.delete(key);
    audio.set(key, found);
    return { ...found, cached: true };
  }
  const generation = epoch;
  // An in-flight request belongs to its own signal; never share cancellation between calls.
  const result = await generate();
  check(signal);
  if (generation === epoch && result.blob.size > 0 && result.blob.size <= MAX_BYTES) {
    audio.delete(key);
    audio.set(key, result);
    let bytes = [...audio.values()].reduce((sum, entry) => sum + entry.blob.size, 0);
    while (audio.size > MAX_ENTRIES || bytes > MAX_BYTES) {
      const oldest = audio.keys().next().value!;
      bytes -= audio.get(oldest)!.blob.size;
      audio.delete(oldest);
    }
  }
  return { ...result, cached: false };
}

export function resetOpeningTTSCache(): void {
  epoch++;
  audio.clear();
}
