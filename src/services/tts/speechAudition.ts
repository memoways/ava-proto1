import { getActiveEnvironment } from '../environmentContext';
import { playAudioBlobRobust } from '../audioPlayback';
import { derivePerformanceIntent } from './performanceIntent';
import { resolveGradiumSettings } from './providerSettings';
import { proposeSpeechMapping, validateSpeechAudition, type SpeechAuditionSnapshot, type SpeechPerformanceSettings } from './speechPerformanceSettings';
import type { TTSAuditionRequest, TTSGenerateContext, TTSProvider, TTSProviderId, TTSStreamGenerationStats } from './types';
export const AUDITION_PROVIDERS: TTSProviderId[] = ['gradium', 'fish', 'inworld', 'elevenlabs', 'cartesia'];
export const AUDITION_LEVELS = [1, 2, 3] as const;
export interface AuditionLine { id: string; context: string; state: string; text: string }
const CORPUS: Record<string, Array<[string, string, string]>> = {
 max: [
  ['M1', 'Premier contact, appel de la cellule attendu', "Allô ? Oui… c'est vous qui deviez… Oui."],
  ['M2', 'Les morts ont été évoqués explicitement', 'Ils sont morts. Voilà. Je peux le dire. Mais après…'],
  ['M3', 'Mona dans le camp et la séparation familiale sont déjà connus dans l’appel', "Qu'on soit tous… enfin, Mona est pas là. Je sais. Je sais bien."],
  ['M4', 'Une piste hypothétique vient d’être évoquée', 'Attends. Chez qui ? Ils ont pu… tu sais où ils sont, ces gens ?'],
 ],
 emma: [
  ['E1', 'Premier contact, appel de la cellule attendu', 'Allô ? Oui. Attendez… vous appelez pour nous ?'],
  ['E2', 'Sa transformation et celle d’Ava sont déjà le sujet autorisé', "Moi, ça va. Non. J'en sais rien. Mais elle…"],
  ['E3', 'L’appel porte sur la présence auprès d’Ava', 'Je la laisserai pas toute seule.'],
  ['E4', 'L’interlocuteur vient de proposer d’attendre demain', 'Vous dites demain. Mais demain, elle va… Attendez.'],
 ],
};
export function createAuditionCorpus(character: string, _states: string[]): AuditionLine[] {
 return (CORPUS[character] ?? []).map(([id, context, text]) => ({ id, context, text, state: '' }));
}
export function auditionVoice(voices: Record<string, string>, character: string, provider: TTSProviderId): string | null {
 return voices[`${character}:${provider}`]?.trim() || null;
}
export function createAuditionSnapshot(character: string, states: Array<{ name: string; description: string }>,
 draft: SpeechPerformanceSettings, pauses: boolean, preserveCurrent = false): SpeechAuditionSnapshot {
 const snapshot: SpeechAuditionSnapshot = {
  kind: 'speech_audition', environment: getActiveEnvironment(), character, validStates: states.map(s => s.name),
  settings: { ...structuredClone(draft), enabled: preserveCurrent ? draft.enabled : true, gradiumTagsEnabled: false, gradiumPausesEnabled: pauses,
   byCharacter: { [character]: Object.fromEntries(states.map(s => [s.name, structuredClone(draft.byCharacter[character]?.[s.name] ?? proposeSpeechMapping(s.name, s.description))])) } },
  gradium: structuredClone(resolveGradiumSettings(character)),
 };
 if (preserveCurrent) snapshot.settings.byCharacter = { [character]: structuredClone(draft.byCharacter[character] ?? {}) };
 validateSpeechAudition(snapshot, character);
 return snapshot;
}
export function auditionIntent(snapshot: SpeechAuditionSnapshot, text: string, state: string, level: number) {
 validateSpeechAudition(snapshot, snapshot.character);
 if (!snapshot.validStates.includes(state)) throw new Error('État absent de la fiche du personnage');
 const intent = derivePerformanceIntent({ text, characterKey: snapshot.character, speechState: state, rugosite: level,
  validSpeechStates: snapshot.validStates, speechSettings: snapshot.settings });
 return { ...intent, speechState: state };
}
/** Sorted content identity includes the entire draft, saved version and intended transport. */
export function auditionKey(value: unknown): string {
 return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
}
export type AuditionTransport = 'rest' | 'websocket';
export interface AuditionEvidence {
 requestedTransport?: AuditionTransport;
 requests: TTSAuditionRequest[]; transport: 'websocket' | 'rest_fallback' | 'rest';
 model?: string; firstByteMs?: number; totalMs?: number; firstSoundMs?: number; durationMs?: number;
 pauseRendering?: string; auditionCapture?: string; cached: boolean; providerCalls: number;
 stats?: Omit<TTSStreamGenerationStats, 'auditionAudio'>;
}
interface CachedAudio { blob: Blob; evidence: AuditionEvidence }
/** One owner for cancellation, stale callbacks and the bounded, in-memory exact-audio cache. */
export class SpeechAuditionRunner {
 private controller: AbortController | null = null;
 private cache = new Map<string, CachedAudio>();
 private bytes = 0;
 private calls = 0;
 constructor(private play = playAudioBlobRobust) {}
 get providerCalls() { return this.calls; }
 stop() { this.controller?.abort(); this.controller = null; }
 clear() { this.stop(); this.cache.clear(); this.bytes = 0; }
 private put(key: string, audio: CachedAudio) {
  if (audio.blob.size > 16 * 1024 * 1024) return;
  while (this.cache.size >= 16 || this.bytes + audio.blob.size > 16 * 1024 * 1024) {
   const oldest = this.cache.keys().next().value;
   if (oldest === undefined) break;
   this.bytes -= this.cache.get(oldest)!.blob.size; this.cache.delete(oldest);
  }
  this.cache.set(key, audio); this.bytes += audio.blob.size;
 }
 async listen(key: string, text: string, provider: TTSProvider, context: TTSGenerateContext, transport: AuditionTransport = 'websocket'): Promise<AuditionEvidence> {
  this.stop();
  const controller = new AbortController(); this.controller = controller;
  const signal = controller.signal;
  const start = performance.now();
  const evidence: AuditionEvidence = { requests: [], transport: 'rest', cached: false, providerCalls: 0 };
  // Transport remains part of identity even when a caller reuses its key.
  key = auditionKey({ key, transport });
  const cached = this.cache.get(key);
  evidence.requestedTransport = transport;
  const current = () => {
   if (signal.aborted || this.controller !== controller) throw new DOMException('Écoute périmée', 'AbortError');
   if (context.speechAudition) validateSpeechAudition(context.speechAudition, context.characterKey);
  };
  const firstSound = () => { if (!signal.aborted && this.controller === controller) evidence.firstSoundMs = Math.round(performance.now() - start); };
  let blob: Blob | undefined;
  try {
   current();
   if (cached) {
    Object.assign(evidence, structuredClone(cached.evidence), { cached: true, providerCalls: 0, firstSoundMs: undefined });
    blob = cached.blob;
   } else {
    const ctx = { ...context, signal, timeoutMs: 60000, onAuditionRequest: (request: TTSAuditionRequest) => {
     if (signal.aborted || this.controller !== controller) return;
     evidence.requests.push(structuredClone(request)); evidence.providerCalls++; this.calls++;
    } };
    const handle = provider.id === 'gradium' && transport === 'websocket' ? provider.createStreamingPlayback?.(text, ctx) : null;
    if (handle) {
     const cancel = () => handle.cancel(); signal.addEventListener('abort', cancel, { once: true });
     try {
      void handle.started.then(firstSound, () => {});
      handle.open();
      const [stats, finished] = await Promise.all([handle.generationDone, handle.finished]);
      current();
      const { auditionAudio, ...exportedStats } = stats;
      blob = auditionAudio;
      Object.assign(evidence, exportedStats, { stats: exportedStats, durationMs: finished.playbackTotalMs });
     } finally { signal.removeEventListener('abort', cancel); }
    } else {
     const result = await provider.generate(text, ctx); current();
     blob = result.blob; Object.assign(evidence, result.meta);
     if (provider.id === 'gradium') evidence.transport = transport === 'websocket' ? 'rest_fallback' : 'rest';
    }
   }
   current();
   // Streaming already played; cache replays and batch providers use the existing cancellable player.
   if (blob && (cached || !evidence.stats)) {
    const played = await this.play(blob, undefined, firstSound, signal); current();
    if (played.status !== 'played') throw played.error ?? new Error('Lecture audio impossible');
    evidence.durationMs = played.playbackTotalMs;
   }
   if (!cached && blob) this.put(key, { blob, evidence: structuredClone(evidence) });
   if (!blob) evidence.auditionCapture = 'limit_exceeded';
   return evidence;
  } finally { if (this.controller === controller) this.controller = null; }
 }
}
