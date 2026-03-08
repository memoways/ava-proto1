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
