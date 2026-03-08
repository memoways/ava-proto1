const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

/**
 * Generate speech from text using ElevenLabs via proxy-tts Edge Function
 * Returns an audio blob that can be played
 */
export async function generateSpeech(text: string, options?: TTSOptions): Promise<Blob> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/proxy-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      ...options,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS error: ${response.status} - ${err}`);
  }

  return response.blob();
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

// ---- Sentence-level TTS Pipeline ----

const SENTENCE_REGEX = /[.!?…]+[\s]+|[.!?…]+$/;

/**
 * Splits text into sentences for progressive TTS.
 * Returns [completeSentences[], remainingFragment]
 */
export function extractSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  let remaining = text;

  let match: RegExpExecArray | null;
  while ((match = SENTENCE_REGEX.exec(remaining)) !== null) {
    const sentence = remaining.slice(0, match.index + match[0].length).trim();
    if (sentence.length > 5) { // Skip tiny fragments
      sentences.push(sentence);
    }
    remaining = remaining.slice(match.index + match[0].length);
    SENTENCE_REGEX.lastIndex = 0; // Reset for non-global regex
  }

  return [sentences, remaining.trim()];
}

/**
 * TTS Audio Queue — generates and plays sentences sequentially,
 * allowing new sentences to be enqueued while earlier ones play.
 */
export class TTSQueue {
  private queue: Promise<void> = Promise.resolve();
  private _cancelled = false;
  private generationCount = 0;
  private playbackCount = 0;

  /** Enqueue a sentence for TTS generation + playback */
  enqueue(text: string, options?: TTSOptions): void {
    if (this._cancelled || !text.trim()) return;
    
    // Start generating immediately (don't wait for queue)
    const genStart = performance.now();
    const blobPromise = generateSpeech(text, options).then(blob => {
      const genTime = performance.now() - genStart;
      this.generationCount++;
      console.log(`[TTS-Queue] Generated sentence #${this.generationCount} in ${genTime.toFixed(0)}ms (${text.slice(0, 40)}...)`);
      return blob;
    });

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
