import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles } from '@/services/experienceOrchestration';
import { loadCharacterPromptByName } from '@/services/characterPromptService';
import { readSavedSpeechPerformance, saveSpeechPerformanceSettings, EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping, type SpeechPerformanceSettings, type SpeechVoiceMapping } from '@/services/tts/speechPerformanceSettings';
import { AUDITION_PROVIDERS, createAuditionCorpus, auditionVoice, createAuditionSnapshot, auditionIntent, auditionKey, SpeechAuditionRunner, type AuditionLine, type AuditionEvidence } from '@/services/tts/speechAudition';
import { CANONICAL_EMOTIONS, resolveGradiumPauseSeconds } from '@/services/tts/performanceIntent';
import { getProviderById } from '@/services/tts/registry';
import { getTTSSettings } from '@/services/settingsService';
import { getHumeSettings, getInworldSettings, getCartesiaSettings } from '@/services/tts/providerSettings';
import { buildGradiumJsonConfig } from '@/services/tts/providers/gradium';
import { planGradiumSpeech, prepareTextForGradium } from '@/services/tts/gradiumSpeech';
import type { TTSProviderId } from '@/services/tts/types';
interface Character { key: string; name: string; states: Array<{ name: string; description: string }> }
const NOTE_FIELDS = ['words', 'rhythm', 'timbre', 'artifacts'] as const;
const NOTE_LABELS = ['Mots / pensée', 'Pauses / rythme', 'Affect / timbre', 'Clics / hoquets'];
interface Result extends AuditionEvidence {
 key: string; character: string; state: string; level: number; provider: TTSProviderId; voice: string;
 sourceText: string; context: string; snapshot: unknown; parameters: unknown; pauseMode: boolean;
 notes: Record<typeof NOTE_FIELDS[number], string>;
}
function exportResults(rows: Result[], providerCalls: number) {
 const url = URL.createObjectURL(new Blob([JSON.stringify({ providerCalls, cost: null, results: rows }, null, 2)], { type: 'application/json' }));
 const a = document.createElement('a'); a.href = url; a.download = 'auditions-a3.json'; a.click(); URL.revokeObjectURL(url);
}
export default function SpeechAuditionBench() {
 const environment = getActiveEnvironment();
 const sandbox = environment !== 'prod';
 const [characters, setCharacters] = useState<Character[]>([]);
 const [character, setCharacter] = useState('max');
 const [saved, setSaved] = useState<SpeechPerformanceSettings>(EMPTY_SPEECH_PERFORMANCE);
 const [draft, setDraft] = useState<SpeechPerformanceSettings>(EMPTY_SPEECH_PERFORMANCE);
 const [corpora, setCorpora] = useState<Record<string, AuditionLine[]>>({});
 const [voices, setVoices] = useState<Record<string, string>>({});
 const [provider, setProvider] = useState<TTSProviderId>('gradium');
 const [levels, setLevels] = useState<Record<string, number>>({ max: 3, emma: 2 });
 const [lineIndex, setLineIndex] = useState(0);
 const [pauseMode, setPauseMode] = useState(false);
 const [phase, setPhase] = useState<'initial' | 'finalists'>('initial');
 const [finalists, setFinalists] = useState<string[]>([]);
 const [busy, setBusy] = useState(false);
 const [saving, setSaving] = useState(false);
 const [ready, setReady] = useState(false);
 const [results, setResults] = useState<Result[]>([]);
 const [error, setError] = useState('');
 const runner = useRef(new SpeechAuditionRunner());
 const sequence = useRef(0);
 const stop = () => { sequence.current++; runner.current.stop(); setBusy(false); };
 useEffect(() => {
  if (!sandbox) return;
  let current = true;
  const auditionRunner = runner.current;
  const invalidate = () => { sequence.current++; };
  setReady(false); setError('');
  Promise.all([listCharacterRuntimeProfiles(), readSavedSpeechPerformance(environment)]).then(async ([profiles, settings]) => {
   const loaded = await Promise.all(profiles.filter(p => ['max', 'emma'].includes(p.character_key)).map(async p => ({
    key: p.character_key, name: p.display_name, states: (await loadCharacterPromptByName(p.display_name))?.speech_states ?? [],
   })));
   if (!current || getActiveEnvironment() !== environment) return;
   setCharacters(loaded); setSaved(settings); setDraft(structuredClone(settings));
   setCorpora(Object.fromEntries(loaded.map(c => [c.key, createAuditionCorpus(c.key, c.states.map(s => s.name))])));
   setVoices(Object.fromEntries(profiles.filter(p => p.tts_provider && p.tts_voice_id).map(p => [`${p.character_key}:${p.tts_provider}`, p.tts_voice_id ?? ''])));
   setReady(true);
  }).catch(e => { if (current) setError(String(e)); });
  return () => { current = false; invalidate(); auditionRunner.clear(); };
 }, [sandbox, environment]);
 const active = characters.find(c => c.key === character);
 const lines = corpora[character] ?? [];
 const line = lines[lineIndex];
 const text = line?.text ?? '';
 const voice = auditionVoice(voices, character, provider);
 const level = levels[character] ?? 2;
 const snapshot = sandbox && ready ? createAuditionSnapshot(character, active?.states ?? [], draft, pauseMode) : null;
 const intent = snapshot && line?.state ? auditionIntent(snapshot, text, line.state, level) : null;
 const parts = planGradiumSpeech(text, snapshot && intent ? resolveGradiumPauseSeconds(intent, character, snapshot.settings) : undefined);
 const parameters = provider === 'gradium' ? snapshot?.gradium : provider === 'elevenlabs' ? getTTSSettings()
  : provider === 'hume' ? getHumeSettings() : provider === 'inworld' ? getInworldSettings() : getCartesiaSettings();
 const eligible = phase === 'initial' ? lineIndex < 2 : finalists.includes(line?.id ?? '');
 const changed = auditionKey(saved) !== auditionKey(draft);
 const patchMapping = (state: string, patch: Partial<SpeechVoiceMapping>) => {
  stop();
  setDraft(old => ({ ...old, byCharacter: { ...old.byCharacter, [character]: { ...old.byCharacter[character], [state]: {
   ...(old.byCharacter[character]?.[state] ?? proposeSpeechMapping(state, active?.states.find(s => s.name === state)?.description ?? '')), ...patch,
  } } } }));
 };
 async function listen() {
  if (!voice || !text || !line || !snapshot || !intent || !eligible || getActiveEnvironment() !== environment) return;
  stop(); const requestId = ++sequence.current; setBusy(true); setError('');
  const key = auditionKey({ character, provider, level, text, voice, intent, snapshot, parameters, pauseMode,
   transport: provider === 'gradium' ? 'websocket_with_rest_fallback' : 'rest', model: provider === 'elevenlabs' ? 'eleven_v3' : null });
  try {
   const evidence = await runner.current.listen(key, text, getProviderById(provider), {
    characterKey: character, voiceId: voice, performance: intent,
    ...(provider === 'gradium' ? { speechAudition: structuredClone(snapshot) } : {}),
    ...(provider === 'elevenlabs' ? { auditionModelId: 'eleven_v3' as const } : {}),
   });
   if (requestId !== sequence.current || getActiveEnvironment() !== environment) return;
   setResults(old => [{ ...evidence, key, character, state: line.state, level, provider, voice, sourceText: text, context: line.context,
    snapshot, parameters, pauseMode, notes: old.find(r => r.key === key)?.notes ?? { words: '', rhythm: '', timbre: '', artifacts: '' } }, ...old.filter(r => r.key !== key)].slice(0, 32));
  } catch (e) {
   if (requestId === sequence.current && getActiveEnvironment() === environment) setError(e instanceof Error ? e.message : String(e));
  } finally { if (requestId === sequence.current) setBusy(false); }
 }
 async function save() {
  stop(); setSaving(true); setError('');
  try {
   const confirmed = await saveSpeechPerformanceSettings(draft, saved, environment);
   if (getActiveEnvironment() !== environment) return;
   setSaved(confirmed); setDraft(structuredClone(confirmed)); toast.success('Mapping sauvegardé et relu dans la même sandbox');
  } catch (e) { setError(String(e)); } finally { setSaving(false); }
 }
 if (!sandbox) return <section className="border-t pt-4"><h3 className="font-semibold">Lot B — Auditions</h3><p>Réservé aux environnements sandbox.</p></section>;
 return <section className="space-y-4 border-t pt-6" aria-label="Banc d'audition lot B">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">A3 — Réglages fidèles et auditions</h3><Button variant="outline" onClick={() => exportResults(results, runner.current.providerCalls)}>Exporter les écoutes</Button></div>
  <p className="text-sm">{environment} · mapping enregistré : {saved.version || 'absent'} · rendu {saved.enabled ? 'actif' : 'inactif'} · pauses live {saved.gradiumPausesEnabled === true ? 'actives' : 'désactivées'}.</p>
  <p className="text-sm">Brouillon {changed ? 'modifié' : 'identique au mapping enregistré'} · audition temporaire isolée. Aucune activation du jeu par les boutons d’écoute.</p>
  {error && <p role="alert" className="text-destructive">{error}</p>}
  <details><summary className="cursor-pointer">Réglages enregistrés et sauvegarde explicite</summary>
   <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(saved, null, 2)}</pre>
   <label className="flex gap-2"><input type="checkbox" checked={draft.enabled} onChange={e => { stop(); setDraft(old => ({ ...old, enabled: e.target.checked })); }}/>Rendu par état du jeu (brouillon)</label>
   <p className="text-xs">Le mode pauses A/B ci-dessous reste temporaire ; cette sauvegarde ne l’active pas. Tags émotionnels Gradium fermés.</p>
   <Button disabled={!ready || !changed || saving} onClick={() => void save()}>Sauvegarder le mapping sandbox et relire</Button>
  </details>
  <label className="block">Personnage du banc <select aria-label="Personnage du banc" value={character} onChange={e => { stop(); setCharacter(e.target.value); setLineIndex(0); }}>{characters.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
  {!active?.states.length && <p>États de parole indisponibles.</p>}
  <details><summary className="cursor-pointer">États de la fiche synchronisée et changements temporaires</summary>
   {active?.states.map(state => {
    const mapping = draft.byCharacter[character]?.[state.name] ?? proposeSpeechMapping(state.name, state.description);
    return <div className="border-b py-3 space-y-2" key={state.name}><strong>{state.name}</strong><p className="text-sm">{state.description}</p>
     {!draft.byCharacter[character]?.[state.name] && <p className="text-xs">Proposition temporaire, non enregistrée</p>}
     <div className="flex flex-wrap gap-2">
      <label>Débit relatif <Input aria-label={`Débit ${state.name}`} type="number" min="0.7" max="1.2" step="0.01" value={mapping.speed} onChange={e => patchMapping(state.name, { speed: Math.max(0.7, Math.min(1.2, Number(e.target.value) || 1)) })}/></label>
      <label>Pauses <select aria-label={`Pauses ${state.name}`} value={mapping.pauses} onChange={e => patchMapping(state.name, { pauses: e.target.value as SpeechVoiceMapping['pauses'] })}>{['short', 'normal', 'long'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Delivery <select aria-label={`Delivery ${state.name}`} value={mapping.delivery} onChange={e => patchMapping(state.name, { delivery: e.target.value as SpeechVoiceMapping['delivery'] })}>{['measured', 'whisper', 'rushed', 'cutting'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Émotion <select aria-label={`Émotion ${state.name}`} value={mapping.emotion} onChange={e => patchMapping(state.name, { emotion: e.target.value as SpeechVoiceMapping['emotion'] })}>{CANONICAL_EMOTIONS.map(v => <option key={v}>{v}</option>)}</select></label>
     </div>
     <Input aria-label={`Instruction ${state.name}`} value={mapping.instruction} maxLength={70} onChange={e => patchMapping(state.name, { instruction: e.target.value })}/>
     <p className="text-xs">Gradium : débit relatif non appliqué ; émotion, delivery et instruction non transmis comme acting. Le champ pauses pilote la modulation existante de padding_bonus et les breaks en mode B. Autres fournisseurs : paramètres effectifs dans les preuves de requête.</p>
    </div>;
   })}
  </details>
  <h4 className="font-semibold">Comparaison courte A/B — huit cas proposés, non canoniques</h4>
  <p className="text-sm">Première comparaison : M1, M2, E1, E2 (quatre textes au maximum). Même texte et voix, témoin Max 3 / Emma 2. Aucun lancement de série.</p>
  <label className="block">Étape <select aria-label="Étape audition" value={phase} onChange={e => { stop(); setPhase(e.target.value as typeof phase); }}><option value="initial">Première comparaison (4 textes)</option><option value="finalists">Finalistes sélectionnés seulement</option></select></label>
  {phase === 'finalists' && <div className="flex flex-wrap gap-3">{Object.values(corpora).flat().map(c => <label key={c.id}><input type="checkbox" aria-label={`Finaliste ${c.id}`} checked={finalists.includes(c.id)} onChange={e => { stop(); setFinalists(old => e.target.checked ? [...old, c.id] : old.filter(id => id !== c.id)); }}/>{c.id}</label>)}</div>}
  <div className="flex flex-wrap gap-4">
   <label>Fournisseur <select aria-label="Fournisseur du banc" value={provider} onChange={e => { stop(); setProvider(e.target.value as TTSProviderId); }}>{AUDITION_PROVIDERS.map(p => <option key={p} value={p}>{p === 'elevenlabs' ? 'ElevenLabs v3' : p}</option>)}</select></label>
   <label>Rugosité <select aria-label="Rugosité du banc" value={level} onChange={e => { stop(); setLevels(old => ({ ...old, [character]: Number(e.target.value) })); }}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>
   <label>Cas <select aria-label="Réplique du banc" value={lineIndex} onChange={e => { stop(); setLineIndex(Number(e.target.value)); }}>{lines.map((l, i) => <option key={l.id} value={i}>{l.id}</option>)}</select></label>
  </div>
  <p className="text-sm">Contexte proposé à autoriser : {line?.context}</p>
  <Input aria-label={`Voix ${character} ${provider}`} placeholder="Voix isolée du banc" value={voice ?? ''} onChange={e => { stop(); setVoices(old => ({ ...old, [`${character}:${provider}`]: e.target.value })); }}/>
  <label>État de la fiche <select aria-label="État de la réplique" value={line?.state ?? ''} onChange={e => { stop(); setCorpora(old => ({ ...old, [character]: lines.map((l, i) => i === lineIndex ? { ...l, state: e.target.value } : l) })); }}>{active?.states.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
  <Textarea aria-label="Texte source audition" value={text} onChange={e => { stop(); setCorpora(old => ({ ...old, [character]: lines.map((l, i) => i === lineIndex ? { ...l, text: e.target.value } : l) })); }}/>
  <label className="block">Mode A/B <select aria-label="Mode de pauses audition" disabled={provider !== 'gradium'} value={pauseMode ? 'pauses' : 'control'} onChange={e => { stop(); setPauseMode(e.target.value === 'pauses'); }}><option value="control">A — Témoin sans breaks</option><option value="pauses">B — Pauses expérimentales A2, WS demandé</option></select></label>
  {provider === 'gradium' && <div className="space-y-2 text-sm">
   <p>padding_bonus règle le rythme global. Les breaks explicites sont réservés à WS (0,25 / 0,6 / 1 s, huit maximum). REST conserve les mots nettoyés et ne valide pas les pauses WS. Une pause ne garantit ni souffle, ni sanglot, ni voix étranglée.</p>
   <p>Émotion / acting : non appliqués ; tags fermés. Rejeu WAV disponible après capture WS complète (30 s maximum) ; cache mémoire : 16 écoutes / 16 Mio. Un dépassement empêche le rejeu en cache.</p>
   <p>Mots préparés : {parts.filter(p => p.type === 'text').map(p => p.type === 'text' ? p.text : '').join(' ')}</p>
   <p>Repli REST : {prepareTextForGradium(text)}</p>
   <pre aria-label="Contrôles préparés" className="text-xs whitespace-pre-wrap">{JSON.stringify(parts.filter(p => p.type === 'pause'))}</pre>
   <pre aria-label="Paramètres Gradium préparés" className="text-xs whitespace-pre-wrap">{JSON.stringify(snapshot ? buildGradiumJsonConfig(snapshot.gradium, intent) : {}, null, 2)}</pre>
   {!saved.version && <p>Mapping enregistré absent : pauses WS fermées.</p>}
  </div>}
  <p className="text-xs">{runner.current.providerCalls} appels TTS réels (repli compris) · coût inconnu · aucun audio automatique.</p>
  <div className="flex flex-wrap gap-2"><Button onClick={() => void listen()} disabled={!ready || busy || saving || !voice || !text || !line?.state || !eligible}>Écouter / rejouer</Button><Button variant="outline" onClick={stop} disabled={!busy}>Arrêter</Button><Button variant="outline" onClick={() => { stop(); runner.current.clear(); setResults([]); }}>Vider résultats et cache</Button></div>
  {!eligible && <p>Sélectionner ce cas parmi les finalistes pour l’écouter.</p>}
  {results.map(r => <article key={r.key} className="border rounded p-3 space-y-2">
   <strong>{r.character} · {r.state} · {r.provider} · {r.pauseMode ? 'B pauses' : 'A témoin'} · {r.cached ? 'cached — sans appel' : `${r.providerCalls} appel(s)`}</strong>
   <p className="text-xs">{r.transport} · {r.model} · pauses : {r.pauseRendering ?? 'non attestées'} · capture : {r.auditionCapture ?? 'blob'} · premier octet {r.firstByteMs ?? '—'} ms · premier son {r.firstSoundMs ?? '—'} ms · génération {r.totalMs ?? '—'} ms · lecture {r.durationMs ?? '—'} ms</p>
   {r.transport === 'rest_fallback' && <p className="text-sm">Repli REST : cette écoute ne valide pas les pauses WS.</p>}
   <details><summary>Preuves : texte, snapshot et paramètres réellement envoyés</summary><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify({ sourceText: r.sourceText, context: r.context, voice: r.voice, level: r.level, snapshot: r.snapshot, requests: r.requests, stats: r.stats }, null, 2)}</pre></details>
   <div className="grid sm:grid-cols-4 gap-2">{NOTE_FIELDS.map((field, i) => <label key={field} className="text-xs">{NOTE_LABELS[i]}<Input aria-label={`${NOTE_LABELS[i]} ${r.character} ${r.pauseMode ? 'B' : 'A'}`} value={r.notes[field]} onChange={e => setResults(old => old.map(row => row.key === r.key ? { ...row, notes: { ...row.notes, [field]: e.target.value } } : row))}/></label>)}</div>
  </article>)}
 </section>;
}
