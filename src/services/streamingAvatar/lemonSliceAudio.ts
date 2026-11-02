/**
 * Audio bridge for LemonSlice: Ava's own TTS audio (ElevenLabs, Gradium… with the character's
 * voice) becomes mono PCM16 at the session rate, cut into ~100 ms base64 chunks for the
 * LemonSlice WebSocket. Pure functions; no browser API besides `btoa`.
 * Protocol read on 2 November 2026 (lemonslice.com/docs/websocket): `audio` (sampleRate
 * required, encoding PCM16), `audio_end` commits the turn, `interrupt`, `heartbeat`, `terminate`;
 * the server answers `playback_finished` and `heartbeat_ack`.
 */

/** LemonSlice recommends 80–100 ms chunks; pacing is not required. */
export const LEMONSLICE_CHUNK_MS = 100;
export const LEMONSLICE_HEARTBEAT_MS = 10_000;

export type LemonSliceClientCommand =
  | { command: "audio"; audio: string; sampleRate: number; encoding: "PCM16" }
  | { command: "audio_end" }
  | { command: "interrupt" }
  | { command: "heartbeat"; timestamp: number }
  | { command: "terminate" };

export interface LemonSlicePlaybackFinished {
  command: "playback_finished";
  playbackPosition: number;
  interrupted: boolean;
}

export function buildLemonSliceAudioCommand(
  pcm: Int16Array,
  sampleRate: number,
): LemonSliceClientCommand {
  return { command: "audio", audio: pcm16ToBase64(pcm), sampleRate, encoding: "PCM16" };
}

/** Server message → typed event; anything else (acks, unknown) is ignored. */
export function parseLemonSliceServerMessage(raw: unknown): LemonSlicePlaybackFinished | null {
  if (typeof raw !== "string") return null;
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  if (record.command !== "playback_finished") return null;
  return {
    command: "playback_finished",
    playbackPosition: typeof record.playback_position === "number" ? record.playback_position : 0,
    interrupted: record.interrupted === true,
  };
}

/** Average of the channels; LemonSlice reads mono only. */
export function downmixToMono(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length;
  }
  return mono;
}

/** Linear interpolation; enough for speech, no native DSP dependency. */
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= 0 || toRate <= 0) throw new Error("Sample rates must be positive");
  if (fromRate === toRate || samples.length < 2) return samples;
  const targetLength = Math.max(1, Math.round((samples.length * toRate) / fromRate));
  const step = targetLength > 1 ? (samples.length - 1) / (targetLength - 1) : 0;
  const output = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const position = i * step;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    output[i] = samples[left] + (samples[right] - samples[left]) * (position - left);
  }
  return output;
}

export function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff);
  }
  return pcm;
}

/** Headerless little-endian PCM16 (ElevenLabs/Gradium `pcm_*` formats) → float samples. */
export function pcm16BytesToFloat(bytes: ArrayBuffer): Float32Array {
  const view = new DataView(bytes);
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 0x8000;
  return samples;
}

/** `pcm_24000` → 24000; containers (mp3, opus, wav) are decoded by the browser instead. */
export function rawPcmRate(format: string | undefined | null): number | null {
  const match = /^pcm_(\d{4,6})$/.exec(format ?? "");
  return match ? Number(match[1]) : null;
}

export function chunkPcm16(
  pcm: Int16Array,
  sampleRate: number,
  chunkMs = LEMONSLICE_CHUNK_MS,
): Int16Array[] {
  const size = Math.max(1, Math.round((sampleRate * chunkMs) / 1000));
  const chunks: Int16Array[] = [];
  for (let start = 0; start < pcm.length; start += size) {
    chunks.push(pcm.subarray(start, Math.min(pcm.length, start + size)));
  }
  return chunks;
}

/** Little-endian bytes whatever the platform, then base64. */
export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, pcm[i], true);
  let binary = "";
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return btoa(binary);
}

/** Decoded speech → the chunks of one line, ready to send. */
export function speechToLemonSliceChunks(
  channels: readonly Float32Array[],
  sourceRate: number,
  targetRate: number,
  chunkMs = LEMONSLICE_CHUNK_MS,
): Int16Array[] {
  const mono = downmixToMono(channels);
  return chunkPcm16(floatToPcm16(resampleLinear(mono, sourceRate, targetRate)), targetRate, chunkMs);
}
