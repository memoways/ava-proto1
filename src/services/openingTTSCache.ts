/**
 * Cache de l'audio TTS de la phrase d'ouverture de Max.
 *
 * Pré-génère le blob audio dès que possible (ex. au montage de l'écran d'accueil
 * ou au clic sur « Commencer ») pour que la lecture puisse démarrer
 * instantanément lors de l'entrée en conversation.
 */
import { generateSpeech, playAudioBlob } from "@/services/tts";

export const OPENING_LINE = "Hallo... à qui ai-je affaire ?";

let cachedBlob: Blob | null = null;
let inflight: Promise<Blob> | null = null;

/** Pré-charge (idempotent) le blob audio de la phrase d'ouverture. */
export function prefetchOpeningTTS(): Promise<Blob> {
  if (cachedBlob) return Promise.resolve(cachedBlob);
  if (inflight) return inflight;
  inflight = generateSpeech(OPENING_LINE)
    .then((blob) => {
      cachedBlob = blob;
      return blob;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/** Récupère le blob en cache si disponible, sinon attend la génération. */
export async function getOpeningTTSBlob(): Promise<Blob> {
  if (cachedBlob) return cachedBlob;
  return prefetchOpeningTTS();
}

/** Joue la phrase d'ouverture (utilise le cache si dispo, sinon génère). */
export async function playOpeningTTS(): Promise<void> {
  const blob = await getOpeningTTSBlob();
  await playAudioBlob(blob);
}

/** Réinitialise le cache (utile en dev/tests). */
export function resetOpeningTTSCache(): void {
  cachedBlob = null;
  inflight = null;
}
