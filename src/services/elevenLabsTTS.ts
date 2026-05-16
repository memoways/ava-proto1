import { getTTSSettings } from "@/services/settingsService";
import { debugLogger } from "@/services/debugLogger";
import { recordAudioLatency } from "@/services/latencyTelemetry";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
  outputFormat?: string;
  optimizeStreamingLatency?: number;
  languageCode?: string;
  applyTextNormalization?: "auto" | "on" | "off";
  seed?: number;
  /** Texte de la phrase précédente (request stitching → prosodie continue) */
  previousText?: string;
  /** Texte de la phrase suivante (request stitching → prosodie continue) */
  nextText?: string;
}

/**
 * Generate speech — merges runtime TTS settings with per-call overrides.
 * Supports request stitching (previousText/nextText) for natural prosody between sentences.
 */
export async function generateSpeech(text: string, options?: TTSOptions): Promise<Blob> {
  const tts = getTTSSettings();
  const preparedText = prepareTextForTTS(text);
  const merged = {
    text: preparedText,
    modelId: options?.modelId ?? tts.modelId,
    stability: options?.stability ?? tts.stability,
    similarityBoost: options?.similarityBoost ?? tts.similarityBoost,
    style: options?.style ?? tts.style,
    speed: options?.speed ?? tts.speed,
    useSpeakerBoost: options?.useSpeakerBoost ?? tts.useSpeakerBoost,
    outputFormat: options?.outputFormat ?? tts.outputFormat,
    optimizeStreamingLatency: options?.optimizeStreamingLatency ?? tts.optimizeStreamingLatency,
    languageCode: options?.languageCode ?? tts.languageCode,
    applyTextNormalization: options?.applyTextNormalization ?? tts.applyTextNormalization,
    seed: options?.seed ?? tts.seed,
    ...(options?.voiceId ? { voiceId: options.voiceId } : {}),
    ...(options?.previousText ? { previousText: prepareTextForTTS(options.previousText) } : {}),
    ...(options?.nextText ? { nextText: prepareTextForTTS(options.nextText) } : {}),
  };

  const startTime = Date.now();
  const debugId = debugLogger.logFetch("tts", `TTS "${preparedText.slice(0, 60)}…"`, `${SUPABASE_URL}/functions/v1/proxy-tts`, merged);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  });

  if (!response.ok) {
    const err = await response.text();
    debugLogger.logResponse(debugId, "tts", "TTS", response.status, startTime, err);
    throw new Error(`TTS error: ${response.status} - ${err}`);
  }

  const blob = await response.blob();
  debugLogger.logResponse(debugId, "tts", `TTS (${(blob.size / 1024).toFixed(0)}KB)`, response.status, startTime);
  return blob;
}

/**
 * Play audio blob through the browser
 */
export function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };

    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error(`Audio playback failed: ${e}`));
    };

    audio.play().catch(reject);
  });
}

/**
 * Generate and immediately play speech
 */
export async function speakText(text: string, options?: TTSOptions): Promise<void> {
  const blob = await generateSpeech(text, options);
  await playAudioBlob(blob);
}

/**
 * Normalise le texte pour ElevenLabs sans ajouter d'instructions qui seraient lues à voix haute.
 * Le but est d'éviter les artefacts fréquents: markdown, ellipses multiples, symboles UI,
 * parenthèses de narration et fragments trop abrupts pour la prosodie française.
 */
export function prepareTextForTTS(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/[_`#>]/g, "")
    .replace(/\[(?:il|elle|max)\s+[^\]]+\]/gi, "")
    .replace(/\((?:il|elle|max)\s+[^)]+\)/gi, "")
    .replace(/\bA\.V\.A\.\b/g, "Ava")
    .replace(/\bIA\b/g, "I A")
    .replace(/\bRAG\b/g, "rague")
    .replace(/\bSTT\b/g, "S T T")
    .replace(/\bTTS\b/g, "T T S")
    .replace(/\bGM\b/g, "game master")
    .replace(/…/g, "...")
    .replace(/\.{4,}/g, "...")
    .replace(/[◆•]/g, ",")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/([,;:.!?])(?=\S)/g, "$1 ")
    .replace(/\. \. \./g, "...")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// ---- Sentence-level TTS Pipeline ----

/**
 * Découpe le texte en phrases pour le TTS progressif.
 *
 * Améliorations vs version précédente :
 * - Ignore les abréviations courantes (M., Mme., Dr., etc., cf., M., …) qui faisaient des coupures parasites
 * - Ignore les nombres décimaux (3.14, 1.5)
 * - Ne coupe pas sur "..." ou "…" interne (suspension), seulement en fin
 * - Seuil minimum relevé à ~25 chars : les fragments plus courts sont gardés en buffer
 *   pour être fusionnés avec la suite (meilleure prosodie ElevenLabs).
 */
const MIN_SENTENCE_LEN = 25;
const ABBREVIATIONS = new Set([
  "m", "mme", "mlle", "dr", "pr", "me", "st", "ste",
  "etc", "cf", "p", "pp", "vs", "ex", "no", "n°",
]);

function isAbbreviationBreak(text: string, dotIndex: number): boolean {
  // remonte jusqu'au dernier espace/début pour récupérer le mot
  let start = dotIndex - 1;
  while (start >= 0 && /[A-Za-zÀ-ÿ]/.test(text[start])) start--;
  const word = text.slice(start + 1, dotIndex).toLowerCase();
  if (!word) return false;
  if (ABBREVIATIONS.has(word)) return true;
  // initiale isolée: "J. Dupont"
  if (word.length === 1 && /[A-Za-zÀ-ÿ]/.test(word)) return true;
  return false;
}

function isNumericDot(text: string, dotIndex: number): boolean {
  const prev = text[dotIndex - 1];
  const next = text[dotIndex + 1];
  return /\d/.test(prev || "") && /\d/.test(next || "");
}

/**
 * Splits text into sentences for progressive TTS.
 * Returns [completeSentences[], remainingFragment].
 *
 * Stratégie de buffering : si une phrase complète fait moins de MIN_SENTENCE_LEN chars,
 * elle est gardée et fusionnée avec la suivante avant d'être renvoyée.
 */
export function extractSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  let buffer = "";
  let cursor = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isEnd = ch === "." || ch === "!" || ch === "?";
    if (!isEnd) continue;

    // gérer "...", "…" comme une seule fin
    let endIdx = i;
    while (endIdx + 1 < text.length && (text[endIdx + 1] === "." || text[endIdx + 1] === "…")) endIdx++;

    // exclure abréviations / décimaux (uniquement pour le point simple)
    if (ch === "." && endIdx === i) {
      if (isAbbreviationBreak(text, i)) continue;
      if (isNumericDot(text, i)) continue;
    }

    // exiger un espace/fin après pour confirmer la frontière
    const after = text[endIdx + 1];
    if (after && !/\s/.test(after)) continue;

    const segment = text.slice(cursor, endIdx + 1).trim();
    cursor = endIdx + 1;
    if (!segment) continue;

    buffer = buffer ? `${buffer} ${segment}` : segment;
    if (buffer.length >= MIN_SENTENCE_LEN) {
      sentences.push(buffer);
      buffer = "";
    }
    // sinon: on garde en buffer, on fusionnera avec la phrase suivante
  }

  const remaining = (buffer ? `${buffer} ${text.slice(cursor)}` : text.slice(cursor)).trim();
  return [sentences, remaining];
}

const SINGLE_REQUEST_MAX_CHARS = 700;
const CHUNK_TARGET_CHARS = 420;

/**
 * Prépare des segments TTS assez longs pour conserver la diction et la continuité.
 * Pour les réponses courtes de Max (cas normal), on garde tout en une seule génération.
 */
export function chunkTextForTTS(text: string): string[] {
  const prepared = prepareTextForTTS(text);
  if (!prepared) return [];
  if (prepared.length <= SINGLE_REQUEST_MAX_CHARS) return [prepared];

  const [sentences, leftover] = extractSentences(prepared);
  const parts = leftover && leftover.length > 3 ? [...sentences, leftover] : sentences;
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if (!current) {
      current = part;
      continue;
    }

    if ((current + " " + part).length <= CHUNK_TARGET_CHARS) {
      current += " " + part;
    } else {
      chunks.push(current);
      current = part;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

interface PendingEntry {
  text: string;
  options?: TTSOptions;
  resolveBlob: (b: Blob) => void;
  rejectBlob: (e: unknown) => void;
}

/**
 * TTS Audio Queue — generates and plays sentences sequentially,
 * allowing new sentences to be enqueued while earlier ones play.
 *
 * Tient à jour un contexte de stitching (phrase précédente + phrase suivante)
 * pour donner à ElevenLabs la prosodie continue entre les segments.
 */
export class TTSQueue {
  private queue: Promise<void> = Promise.resolve();
  private _cancelled = false;
  private generationCount = 0;
  private playbackCount = 0;
  /** Dernière phrase envoyée — passée comme `previous_text` au prochain appel */
  private lastSentText = "";
  /** Phrases en attente, pour calculer `next_text` du segment courant */
  private pending: PendingEntry[] = [];
  private flushScheduled = false;

  /** Enqueue a sentence for TTS generation + playback */
  enqueue(text: string, options?: TTSOptions): void {
    if (this._cancelled || !text.trim()) return;

    let resolveBlob!: (b: Blob) => void;
    let rejectBlob!: (e: unknown) => void;
    const blobPromise = new Promise<Blob>((resolve, reject) => {
      resolveBlob = resolve;
      rejectBlob = reject;
    });

    this.pending.push({ text: prepareTextForTTS(text), options, resolveBlob, rejectBlob });
    this.scheduleFlush();

    // Chain playback sequentially
    this.queue = this.queue.then(async () => {
      if (this._cancelled) return;
      try {
        const blob = await blobPromise;
        if (this._cancelled) return;
        const playStart = performance.now();
        await playAudioBlob(blob);
        this.playbackCount++;
        console.log(`[TTS-Queue] Played sentence #${this.playbackCount} in ${(performance.now() - playStart).toFixed(0)}ms`);
      } catch (err) {
        console.error("[TTS-Queue] Error:", err);
      }
    });
  }

  /**
   * Attend une micro-tâche avant de flusher: les enqueues synchrones du même tour
   * ont ainsi le temps d'arriver, ce qui rend `next_text` réellement disponible.
   */
  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flushPending();
    });
  }

  private flushPending(): void {
    while (this.pending.length > 0) {
      const head = this.pending[0];
      const next = this.pending[1];
      // On lance head dès maintenant, en utilisant next.text comme next_text si dispo
      const nextText = next?.text;
      this.pending.shift();
      this.startGeneration(head, nextText);
    }
  }

  private startGeneration(
    entry: PendingEntry,
    nextText?: string,
  ): void {
    const previousText = this.lastSentText || undefined;
    this.lastSentText = entry.text;

    const genStart = performance.now();
    generateSpeech(entry.text, {
      ...entry.options,
      previousText,
      nextText,
    })
      .then((blob) => {
        const genTime = performance.now() - genStart;
        this.generationCount++;
        const stitchTag = `${previousText ? "P" : "-"}${nextText ? "N" : "-"}`;
        console.log(`[TTS-Queue] Generated #${this.generationCount} in ${genTime.toFixed(0)}ms stitch=${stitchTag} (${entry.text.slice(0, 40)}...)`);
        entry.resolveBlob(blob);
      })
      .catch(entry.rejectBlob);
  }

  /** Wait for all queued audio to finish playing */
  async drain(): Promise<void> {
    await this.queue;
  }

  /** Cancel all pending playback */
  cancel(): void {
    this._cancelled = true;
  }

  get cancelled(): boolean {
    return this._cancelled;
  }
}
