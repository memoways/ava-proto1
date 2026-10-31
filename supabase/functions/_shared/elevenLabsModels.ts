// ElevenLabs model capabilities, shared by the proxy-tts Edge Function and the client.
// Pure TypeScript (no Deno or browser import) so both sides can load it.
// Source: ElevenLabs "Models" documentation, read 30 October 2026. Account availability is
// not part of this table: an unavailable model still answers 400 and the error stays readable.

export interface ElevenLabsModelCapabilities {
  id: string;
  label: string;
  description: string;
  /** Hard input limit in characters; longer text is cut by the proxy. */
  maxChars: number;
  /** `optimize_streaming_latency` is deprecated and refused (400 unsupported_model) by v3/v4. */
  streamingLatency: boolean;
  /** `previous_text` / `next_text` request stitching. */
  stitching: boolean;
  /** Inline audio tags such as [angry] or [whispers]. */
  audioTags: boolean;
}

/** Chosen by ear on 31 Oct 2026 (lot L1): v4 expressiveness, first byte ~0.4 s instead of ~1.1 s. */
export const ELEVENLABS_EXPRESSIVE_MODEL = "eleven_v4_turbo";
export const ELEVENLABS_FALLBACK_MODEL = "eleven_multilingual_v2";

export const ELEVENLABS_MODEL_CAPABILITIES: ElevenLabsModelCapabilities[] = [
  { id: "eleven_v4", label: "Eleven v4", description: "Le plus émotif, balises audio, mais lent (1er octet ~1,1 s)", maxChars: 10000, streamingLatency: false, stitching: false, audioTags: true },
  { id: "eleven_v4_turbo", label: "Eleven v4 Turbo", description: "Expressif et rapide (1er octet ~0,4 s), balises audio — défaut expressif du jeu et de l'atelier", maxChars: 10000, streamingLatency: false, stitching: false, audioTags: true },
  { id: "eleven_v3", label: "Eleven v3", description: "Jeu dramatique, balises audio", maxChars: 5000, streamingLatency: false, stitching: false, audioTags: true },
  { id: "eleven_v3_conversational", label: "Eleven v3 Conversational", description: "Dialogue temps réel (~165 ms), balises audio", maxChars: 5000, streamingLatency: false, stitching: false, audioTags: true },
  { id: "eleven_multilingual_v2", label: "Multilingual v2", description: "Meilleure diction et continuité — défaut du jeu pour Max", maxChars: 10000, streamingLatency: true, stitching: true, audioTags: false },
  { id: "eleven_flash_v2_5", label: "Flash v2.5", description: "Ultra rapide, latence minimale", maxChars: 40000, streamingLatency: true, stitching: true, audioTags: false },
];

/** Deprecated model ids and the model that replaces them. */
export const ELEVENLABS_DEPRECATED_MODELS: Record<string, string> = {
  eleven_turbo_v2_5: "eleven_flash_v2_5",
  eleven_turbo_v2: "eleven_flash_v2_5",
};

export function normalizeElevenLabsModelId(modelId: string | undefined | null): string {
  const id = (modelId ?? "").trim();
  if (!id) return ELEVENLABS_FALLBACK_MODEL;
  return ELEVENLABS_DEPRECATED_MODELS[id] ?? id;
}

/** Unknown ids keep the pre-AP4-ter behaviour (everything sent) so a new model is not silently stripped. */
export function elevenLabsCapabilities(modelId: string): ElevenLabsModelCapabilities {
  return ELEVENLABS_MODEL_CAPABILITIES.find((m) => m.id === modelId)
    ?? { id: modelId, label: modelId, description: "", maxChars: 5000, streamingLatency: true, stitching: true, audioTags: false };
}

export function supportsElevenLabsAudioTags(modelId: string): boolean {
  return elevenLabsCapabilities(normalizeElevenLabsModelId(modelId)).audioTags;
}

export interface ElevenLabsRequestInput {
  text: string;
  modelId?: string;
  optimizeStreamingLatency?: number;
  previousText?: string;
  nextText?: string;
}

/** Query-string and body fragments that depend on the model. */
export function buildElevenLabsModelParts(input: ElevenLabsRequestInput) {
  const modelId = normalizeElevenLabsModelId(input.modelId);
  const caps = elevenLabsCapabilities(modelId);
  const text = input.text.length > caps.maxChars ? input.text.slice(0, caps.maxChars) : input.text;
  const query: Record<string, string> = caps.streamingLatency
    ? { optimize_streaming_latency: String(input.optimizeStreamingLatency ?? 0) }
    : {};
  const stitching: Record<string, string> = {};
  if (caps.stitching) {
    if (input.previousText?.trim()) stitching.previous_text = input.previousText.slice(-500);
    if (input.nextText?.trim()) stitching.next_text = input.nextText.slice(0, 500);
  }
  return { modelId, text, query, stitching, truncated: text.length !== input.text.length };
}
