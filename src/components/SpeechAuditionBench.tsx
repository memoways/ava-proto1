import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Link } from 'react-router-dom';
import { adminTabPath } from '@/services/adminNavigation';
import { loadSpeechWorkshopReferences, currentGradiumSnapshot, proposePaddingComparison, VOCAL_CONTROLS, type VocalControl, type WorkshopReferences } from '@/services/tts/speechWorkshop';
import type { SpeechAuditionSnapshot } from '@/services/tts/speechPerformanceSettings';
import type { AuditionTransport } from '@/services/tts/speechAudition';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles } from '@/services/experienceOrchestration';
import { loadCharacterPromptByName } from '@/services/characterPromptService';
import { readSavedSpeechPerformance, saveSpeechPerformanceSettings, EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping, type SpeechPerformanceSettings, type SpeechVoiceMapping } from '@/services/tts/speechPerformanceSettings';
import { AUDITION_PROVIDERS, createAuditionCorpus, auditionVoice, createAuditionSnapshot, auditionIntent, auditionKey, SpeechAuditionRunner, type AuditionLine, type AuditionEvidence } from '@/services/tts/speechAudition';
import { CANONICAL_EMOTIONS, resolveGradiumPauseSeconds } from '@/services/tts/performanceIntent';
import { getProviderById } from '@/services/tts/registry';
import { getTTSSettings } from '@/services/settingsService';
import { getFishSettings, getInworldSettings, getCartesiaSettings } from '@/services/tts/providerSettings';
import { buildGradiumJsonConfig } from '@/services/tts/providers/gradium';
import { planGradiumSpeech, prepareTextForGradium } from '@/services/tts/gradiumSpeech';
import type { TTSProviderId } from '@/services/tts/types';
interface Character { promptId?: string; key: string; name: string; states: Array<{ name: string; description: string }> }
const NOTE_FIELDS = ['words', 'rhythm', 'timbre', 'artifacts'] as const;
const NOTE_LABELS = ['Mots / pensée', 'Pauses / rythme', 'Affect / timbre', 'Clics / hoquets'];
interface Result extends AuditionEvidence {
 key: string; character: string; state: string; level: number; provider: TTSProviderId; voice: string;
 sourceText: string; caseId: string; context: string; snapshot: unknown; parameters: unknown; pauseMode: boolean; variant?: string;
 notes: Record<typeof NOTE_FIELDS[number], string>;
}
function exportResults(rows: Result[], providerCalls: number) {
 const url = URL.createObjectURL(new Blob([JSON.stringify({ providerCalls, cost: null, results: rows }, null, 2)], { type: 'application/json' }));
 const a = document.createElement('a'); a.href = url; a.download = 'auditions-parole.json'; a.click(); URL.revokeObjectURL(url);
}
export default function SpeechAuditionBench({ workshop = false }: { workshop?: boolean }) {
 const environment = getActiveEnvironment();
 const sandbox = environment !== 'prod';
 const [baseline, setBaseline] = useState<SpeechAuditionSnapshot | null>(null);
 const [references, setReferences] = useState<WorkshopReferences | null>(null);
 const [variant, setVariant] = useState<'A' | 'B'>('A');
 const [control, setControl] = useState<VocalControl>('paddingBonus');
 const [vocalValue, setVocalValue] = useState(0);
 const [transport, setTransport] = useState<AuditionTransport>(workshop ? 'rest' : 'websocket');
 const [comparison, setComparison] = useState<'vocal' | 'pauses'>('vocal');
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
    key: p.character_key, name: p.display_name, ...await loadCharacterPromptByName(p.display_name).then(prompt => ({ promptId: prompt?.character_id, states: prompt?.speech_states ?? [] })),
   })));
   if (!current || getActiveEnvironment() !== environment) return;
   setCharacters(loaded); setSaved(settings); setDraft(structuredClone(settings));
   setCorpora(Object.fromEntries(loaded.map(c => [c.key, createAuditionCorpus(c.key, c.states.map(s => s.name))])));
   setVoices(Object.fromEntries(profiles.filter(p => p.tts_provider && p.tts_voice_id).map(p => [`${p.character_key}:${p.tts_provider}`, p.tts_voice_id ?? ''])));
   if (workshop) {
    const max = loaded.find(c => c.key === 'max');
    const profile = profiles.find(p => p.character_key === 'max');
    if (!max || !profile) throw new Error('Profil Max indisponible');
    const refs = await loadSpeechWorkshopReferences(max.promptId);
    if (!current || getActiveEnvironment() !== environment) return;
    const base = createAuditionSnapshot('max', max.states, settings, settings.gradiumPausesEnabled === true, true);
    base.gradium = currentGradiumSnapshot('max');
    setBaseline(base); setReferences(refs);
    setVocalValue(proposePaddingComparison(base.gradium.paddingBonus));
    setTransport(base.gradium.streamingEnabled ? 'websocket' : 'rest');
    if (profile.tts_provider && AUDITION_PROVIDERS.includes(profile.tts_provider as TTSProviderId)) setProvider(profile.tts_provider as TTSProviderId);
    else throw new Error('Fournisseur actuel de Max non disponible dans le banc');
    if (!Number.isInteger(profile.rugosite) || profile.rugosite < 0 || profile.rugosite > 3) throw new Error('Rugosité actuelle de Max inconnue');
    setLevels(old => ({ ...old, max: profile.rugosite }));
   }
   setReady(true);
  }).catch(e => { if (current) setError(String(e)); });
  return () => { current = false; invalidate(); auditionRunner.clear(); };
 }, [sandbox, environment, workshop]);
 const active = characters.find(c => c.key === character);
 const lines = corpora[character] ?? [];
 const line = lines[lineIndex];
 const text = line?.text ?? '';
 const voice = auditionVoice(voices, character, provider);
 const level = levels[character] ?? 2;
 const snapshot = sandbox && ready ? workshop && baseline ? structuredClone(baseline)
  : createAuditionSnapshot(character, active?.states ?? [], draft, pauseMode) : null;
 if (snapshot && workshop) {
  if (comparison === 'pauses') snapshot.settings.gradiumPausesEnabled = variant === 'B';
  else if (variant === 'B') snapshot.gradium = { ...snapshot.gradium, [control]: vocalValue };
 }
 const effectivePauseMode = workshop ? snapshot?.settings.gradiumPausesEnabled === true : pauseMode;
 const requestedTransport = provider !== 'gradium' ? 'rest' : (workshop ? comparison === 'pauses' : pauseMode) ? 'websocket' : transport;
 const intent = snapshot && line?.state ? auditionIntent(snapshot, text, line.state, level) : null;
 const parts = planGradiumSpeech(text, snapshot && intent ? resolveGradiumPauseSeconds(intent, character, snapshot.settings) : undefined);
 const parameters = provider === 'gradium' ? snapshot?.gradium : provider === 'elevenlabs' ? getTTSSettings()
  : provider === 'fish' ? getFishSettings() : provider === 'inworld' ? getInworldSettings() : getCartesiaSettings();
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
   transport: requestedTransport, model: provider === 'elevenlabs' ? 'eleven_v3' : null });
  try {
   const evidence = await runner.current.listen(key, text, getProviderById(provider), {
    characterKey: character, voiceId: voice, performance: intent,
    ...(provider === 'gradium' ? { speechAudition: structuredClone(snapshot) } : {}),
    ...(provider === 'elevenlabs' ? { auditionModelId: 'eleven_v3' as const } : {}),
   }, requestedTransport);
   if (requestId !== sequence.current || getActiveEnvironment() !== environment) return;
   setResults(old => [{ ...evidence, key, character, state: line.state, level, provider, voice, sourceText: text, caseId: line.id, context: line.context,
    snapshot, parameters, pauseMode: effectivePauseMode, variant: workshop ? variant : undefined, notes: old.find(r => r.key === key)?.notes ?? { words: '', rhythm: '', timbre: '', artifacts: '' } }, ...old.filter(r => r.key !== key)].slice(0, 32));
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
 return <section className="min-w-0 space-y-4 border-t pt-6 break-words [&_select]:max-w-full [&_select]:min-w-0 [&_label]:min-w-0" aria-label="Banc d'audition lot B">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{workshop ? "Atelier de parole — Max" : "A3 — Réglages fidèles et auditions"}</h3><Button variant="outline" onClick={() => exportResults(results, runner.current.providerCalls)}>Exporter les écoutes</Button></div>
  <p className="text-sm">{environment} · mapping enregistré : {saved.version || 'absent'} · rendu {saved.enabled ? 'actif' : 'inactif'} · pauses live {saved.gradiumPausesEnabled === true ? 'actives' : 'désactivées'}.</p>
  {!workshop && <p className="text-sm">Brouillon {changed ? 'modifié' : 'identique au mapping enregistré'} · audition temporaire isolée. Aucune activation du jeu par les boutons d’écoute.</p>}
  {workshop && <>
   <h4 className="font-semibold">1. Objectif — comparer une hypothèse</h4>
   <p>Comprendre ce qui change dans la parole de Max, préparer deux variantes puis écouter et apprécier. A capture les réglages au chargement ; B est une copie temporaire. Aucun réglage de jeu n’est sauvegardé.</p>
   <p>Écoutes et appréciations disparaissent à la fermeture. Exporter avant de partir ; conservation dans le back-office prévue en AP2. Après fermeture, une nouvelle génération ne sera pas le son exact déjà entendu.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <div className="rounded border p-3"><strong>Fiche Notion — jeu et déclencheurs</strong><p>Les états propres de Max et leur évolution viennent de sa fiche. Aucun cycle imposé.</p><p>Copie disponible : {references?.copy ?? 'inconnue, chargement en cours'}. Version éditoriale Notion : inconnue.</p><Link className="underline" to={adminTabPath('character-editor')}>Lire la fiche synchronisée</Link> · <a className="underline" href="https://app.notion.com/p/ef4cfaa670e34e879b9e079815fd0cd9" target="_blank" rel="noreferrer">Max dans Notion</a></div>
    <div className="rounded border p-3"><strong>Rugosité — place des ruptures</strong><p>Niveau chargé : {ready ? level : 'inconnu'}. Référence en lecture seule, commune à A et B.</p><Link className="underline" to={adminTabPath('character-runtime')}>Réglages personnages</Link></div>
    <div className="rounded border p-3"><strong>GM — orientation du prochain tour</strong><p>Orchestration publiée : {references?.orchestration ?? 'inconnue'}. Le GM propose l’état suivant selon l’échange ; il ne produit pas ces auditions.</p><Link className="underline" to={adminTabPath('gamemaster')}>Orchestration</Link> · <Link className="underline" to={adminTabPath('gm-settings')}>Réglages GM</Link></div>
    <div className="rounded border p-3"><strong>LLM — production des mots</strong><p>Compilateur : {references?.compiler ?? 'inconnu'} · {references?.compilerSource}.</p><p>Personnage : {references?.llm.LLM_MODEL ?? 'inconnu'} · température {references?.llm.LLM_TEMPERATURE ?? 'inconnue'} · top P {references?.llm.LLM_TOP_P ?? 'inconnu'} · tokens {references?.llm.LLM_MAX_TOKENS ?? 'inconnus'}.</p><p>GM : {references?.llm.LLM_MODEL_GM ?? 'inconnu'} · température {references?.llm.LLM_TEMPERATURE_GM ?? 'inconnue'} · tokens {references?.llm.LLM_MAX_TOKENS_GM ?? 'inconnus'}. {references?.llmSource}.</p><p>Référence en lecture seule : aucun appel LLM, le texte ci-dessous est fixé pour la paire.</p><Link className="underline" to={adminTabPath('llm')}>Configuration LLM</Link> · <Link className="underline" to={adminTabPath('rag')}>Compilateur et RAG</Link></div>
    <div className="rounded border p-3 sm:col-span-2"><strong>Synthèse — restitution sonore</strong><p>{provider} · voix {voice ?? 'inconnue'} · {references?.ttsSource}. Mapping {saved.version || 'inconnu / absent'}. Les valeurs préparées ne prouvent pas une écoute : les requêtes effectives apparaissent après le clic.</p><Link className="underline" to={adminTabPath('voice')}>TTS Config — autres fournisseurs et Emma</Link></div>
   </div>
   <h4 className="font-semibold">2. Préparer A/B</h4>
   <label className="block">Comparaison <select aria-label="Type de comparaison" value={comparison} disabled={provider !== 'gradium'} onChange={e => { stop(); setComparison(e.target.value as typeof comparison); setVariant('A'); }}><option value="vocal">Paramètre vocal — transport actuel</option><option value="pauses">Pauses expérimentales A2 — comparaison séparée en WS</option></select></label>
   {provider === 'gradium' ? <>
    {comparison === 'vocal' && <div className="flex flex-wrap gap-3"><label>Une seule variation <select aria-label="Paramètre B" value={control} onChange={e => { stop(); const key = e.target.value as VocalControl; setControl(key); setVocalValue(baseline?.gradium[key] ?? 0); }}>{Object.entries(VOCAL_CONTROLS).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label><label>Valeur B<Input aria-label="Valeur B" type="number" min={VOCAL_CONTROLS[control].min} max={VOCAL_CONTROLS[control].max} step={VOCAL_CONTROLS[control].step} value={vocalValue} onChange={e => { stop(); const meta = VOCAL_CONTROLS[control]; const n = Number(e.target.value); setVocalValue(Math.min(meta.max, Math.max(meta.min, Number.isFinite(n) ? n : meta.min))); }}/></label></div>}
    <p aria-label="Diff A/B">{comparison === 'vocal' ? `${VOCAL_CONTROLS[control].label} : A = ${baseline?.gradium[control] ?? 'inconnu'} → B = ${vocalValue}. Tous les autres réglages restent identiques.` : 'A : pauses désactivées → B : pauses A2 activées, mêmes paramètres vocaux.'} Hypothèse à écouter ; aucune variante recommandée comme meilleure.</p>
    <p>padding_bonus règle le rythme global : négatif accélère, positif ralentit. La modulation par état peut décaler ou borner la valeur envoyée ; vérifier le paramètre effectif ci-dessous. Les pauses explicites demandent WS et les gardes A2. Émotion, delivery, instruction et débit relatif ne sont pas de l’acting Gradium appliqué. Tags fermés.</p>
   </> : <p>Le fournisseur actuel de Max est {provider}. Comparaison vocale Gradium indisponible ; utiliser TTS Config pour ses contrôles existants.</p>}
   <label>Variante à écouter <select aria-label="Variante à écouter" value={variant} onChange={e => { stop(); setVariant(e.target.value as 'A' | 'B'); }}><option>A</option><option disabled={provider !== 'gradium'}>B</option></select></label>
  </>}
  {error && <p role="alert" className="text-destructive">{error}</p>}
  {!workshop && <details><summary className="cursor-pointer">Réglages enregistrés et sauvegarde explicite</summary>
   <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(saved, null, 2)}</pre>
   <label className="flex gap-2"><input type="checkbox" checked={draft.enabled} onChange={e => { stop(); setDraft(old => ({ ...old, enabled: e.target.checked })); }}/>Rendu par état du jeu (brouillon)</label>
   <p className="text-xs">Le mode pauses A/B ci-dessous reste temporaire ; cette sauvegarde ne l’active pas. Tags émotionnels Gradium fermés.</p>
   <Button disabled={!ready || !changed || saving} onClick={() => void save()}>Sauvegarder le mapping sandbox et relire</Button>
  </details>}
  {!workshop && <label className="block">Personnage du banc <select aria-label="Personnage du banc" value={character} onChange={e => { stop(); setCharacter(e.target.value); setLineIndex(0); }}>{characters.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>}
  {!active?.states.length && <p>États de parole indisponibles.</p>}
  <details><summary className="cursor-pointer">États de la fiche synchronisée et changements temporaires</summary>
   {active?.states.map(state => {
    const mapping = draft.byCharacter[character]?.[state.name] ?? proposeSpeechMapping(state.name, state.description);
    return <div className="border-b py-3 space-y-2" key={state.name}><strong>{state.name}</strong><p className="text-sm">{state.description}</p>{workshop && <p className="text-sm">Mapping {draft.byCharacter[character]?.[state.name] ? `chargé : pauses ${mapping.pauses}, débit relatif ${mapping.speed}, émotion ${mapping.emotion}, delivery ${mapping.delivery}` : "absent : repli historique, aucune proposition appliquée"}.</p>}
     {!draft.byCharacter[character]?.[state.name] && <p className="text-xs">Proposition temporaire, non enregistrée</p>}
     {!workshop && <><div className="flex flex-wrap gap-2">
      <label>Débit relatif <Input aria-label={`Débit ${state.name}`} type="number" min="0.7" max="1.2" step="0.01" value={mapping.speed} onChange={e => patchMapping(state.name, { speed: Math.max(0.7, Math.min(1.2, Number(e.target.value) || 1)) })}/></label>
      <label>Pauses <select aria-label={`Pauses ${state.name}`} value={mapping.pauses} onChange={e => patchMapping(state.name, { pauses: e.target.value as SpeechVoiceMapping['pauses'] })}>{['short', 'normal', 'long'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Delivery <select aria-label={`Delivery ${state.name}`} value={mapping.delivery} onChange={e => patchMapping(state.name, { delivery: e.target.value as SpeechVoiceMapping['delivery'] })}>{['measured', 'whisper', 'rushed', 'cutting'].map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Émotion <select aria-label={`Émotion ${state.name}`} value={mapping.emotion} onChange={e => patchMapping(state.name, { emotion: e.target.value as SpeechVoiceMapping['emotion'] })}>{CANONICAL_EMOTIONS.map(v => <option key={v}>{v}</option>)}</select></label>
     </div>
     <Input aria-label={`Instruction ${state.name}`} value={mapping.instruction} maxLength={70} onChange={e => patchMapping(state.name, { instruction: e.target.value })}/>
     </>}
     <p className="text-xs">Gradium : débit relatif non appliqué ; émotion, delivery et instruction non transmis comme acting. Le champ pauses pilote la modulation existante de padding_bonus et les breaks en mode B. Autres fournisseurs : paramètres effectifs dans les preuves de requête.</p>
    </div>;
   })}
  </details>
  <h4 className="font-semibold">Comparaison courte A/B — huit cas proposés, non canoniques</h4>
  <p className="text-sm">{workshop ? 'Première comparaison : M1 et M2 de Max. Choisir explicitement un état de sa fiche pour chaque cas ; aucun état attribué automatiquement.' : 'Première comparaison : M1, M2, E1, E2 (quatre textes au maximum). Même texte et voix.'} Aucun lancement de série.</p>
  <label className="block">Étape <select aria-label="Étape audition" value={phase} onChange={e => { stop(); setPhase(e.target.value as typeof phase); }}><option value="initial">{workshop ? 'Première comparaison (M1 et M2)' : 'Première comparaison (4 textes)'}</option><option value="finalists">Finalistes sélectionnés seulement</option></select></label>
  {phase === 'finalists' && <div className="flex flex-wrap gap-3">{(workshop ? lines : Object.values(corpora).flat()).map(c => <label key={c.id}><input type="checkbox" aria-label={`Finaliste ${c.id}`} checked={finalists.includes(c.id)} onChange={e => { stop(); setFinalists(old => e.target.checked ? [...old, c.id] : old.filter(id => id !== c.id)); }}/>{c.id}</label>)}</div>}
  <div className="flex flex-wrap gap-4">
   {!workshop && <><label>Fournisseur <select aria-label="Fournisseur du banc" value={provider} onChange={e => { stop(); setProvider(e.target.value as TTSProviderId); }}>{AUDITION_PROVIDERS.map(p => <option key={p} value={p}>{p === 'elevenlabs' ? 'ElevenLabs v3' : p}</option>)}</select></label>
   <label>Rugosité <select aria-label="Rugosité du banc" value={level} onChange={e => { stop(); setLevels(old => ({ ...old, [character]: Number(e.target.value) })); }}>{[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>
   </>}
   <label>Cas <select aria-label="Réplique du banc" value={lineIndex} onChange={e => { stop(); setLineIndex(Number(e.target.value)); }}>{lines.map((l, i) => <option key={l.id} value={i}>{l.id}</option>)}</select></label>
  </div>
  <p className="text-sm">Contexte proposé à autoriser : {line?.context}</p>
  {!workshop && <Input aria-label={`Voix ${character} ${provider}`} placeholder="Voix isolée du banc" value={voice ?? ''} onChange={e => { stop(); setVoices(old => ({ ...old, [`${character}:${provider}`]: e.target.value })); }}/>}
  <label>État de la fiche <select aria-label="État de la réplique" value={line?.state ?? ''} onChange={e => { stop(); setCorpora(old => ({ ...old, [character]: lines.map((l, i) => i === lineIndex ? { ...l, state: e.target.value } : l) })); }}><option value="">Choisir explicitement un état</option>{active?.states.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
  <Textarea aria-label="Texte source audition" value={text} onChange={e => { stop(); setCorpora(old => ({ ...old, [character]: lines.map((l, i) => i === lineIndex ? { ...l, text: e.target.value } : l) })); }}/>
  {!workshop && <label className="block">Mode A/B <select aria-label="Mode de pauses audition" disabled={provider !== 'gradium'} value={pauseMode ? 'pauses' : 'control'} onChange={e => { stop(); setPauseMode(e.target.value === 'pauses'); }}><option value="control">A — Témoin sans breaks</option><option value="pauses">B — Pauses expérimentales A2, WS demandé</option></select></label>}
  <label className="block">Transport demandé <select aria-label="Transport audition" value={requestedTransport} disabled={provider !== 'gradium' || (workshop && comparison === 'pauses')} onChange={e => { stop(); setTransport(e.target.value as AuditionTransport); }}><option value="rest">REST — génération directe</option><option value="websocket">WebSocket expérimental — repli REST possible</option></select></label>
  {provider === 'gradium' && <div className="space-y-2 text-sm">
   <p>padding_bonus règle le rythme global. Les breaks explicites sont réservés à WS (0,25 / 0,6 / 1 s, huit maximum). REST conserve les mots nettoyés et ne valide pas les pauses WS. Une pause ne garantit ni souffle, ni sanglot, ni voix étranglée.</p>
   <p>Émotion / acting : non appliqués ; tags fermés. Rejeu WAV disponible après capture WS complète (30 s maximum) ; cache mémoire : 16 écoutes / 16 Mio. Un dépassement empêche le rejeu en cache.</p>
   <p>Mots préparés : {parts.filter(p => p.type === 'text').map(p => p.type === 'text' ? p.text : '').join(' ')}</p>
   <p>Repli REST : {prepareTextForGradium(text)}</p>
   <details><summary>Préparation technique — contrôles et JSON</summary><pre aria-label="Contrôles préparés" className="text-xs whitespace-pre-wrap">{JSON.stringify(parts.filter(p => p.type === 'pause'))}</pre>
   <pre aria-label="Paramètres Gradium préparés" className="text-xs whitespace-pre-wrap">{JSON.stringify(snapshot ? buildGradiumJsonConfig(snapshot.gradium, intent) : {}, null, 2)}</pre>
   </details>
   {!saved.version && <p>Mapping enregistré absent : pauses WS fermées.</p>}
  </div>}
  {workshop && <>{provider === 'gradium' && <p>Paramètres Gradium préparés : température {snapshot?.gradium.temp ?? 'inconnue'} · fidélité {snapshot?.gradium.cfgCoef ?? 'inconnue'} · padding de base {snapshot?.gradium.paddingBonus ?? 'inconnu'} · padding effectif prévu {snapshot ? String(buildGradiumJsonConfig(snapshot.gradium, intent).padding_bonus) : 'inconnu'} · langue {snapshot?.gradium.rewriteRules || 'non précisée'} · prononciation {snapshot?.gradium.pronunciationId || 'aucune'} · format {requestedTransport === 'rest' ? snapshot?.gradium.outputFormat : snapshot?.gradium.streamingFormat}.</p>}<h4 className="font-semibold">3. Écouter — même texte, état, voix, rugosité et transport</h4></>}
  <p className="text-xs">{runner.current.providerCalls} appels TTS réels (repli compris) · coût inconnu · aucun audio automatique.</p>
  <div className="flex flex-wrap gap-2"><Button onClick={() => void listen()} disabled={!ready || busy || saving || !voice || !text || !line?.state || !eligible}>Écouter / rejouer</Button><Button variant="outline" onClick={stop} disabled={!busy}>Arrêter</Button><Button variant="outline" onClick={() => { stop(); runner.current.clear(); setResults([]); }}>Vider résultats et cache</Button></div>
  {!eligible && <p>Sélectionner ce cas parmi les finalistes pour l’écouter.</p>}
  {workshop && <h4 className="font-semibold">4. Apprécier — notes temporaires puis export</h4>}
  {results.map(r => <article key={r.key} className="border rounded p-3 space-y-2">
   <strong>{r.character} · {r.state} · {r.provider} · {r.variant ?? (r.pauseMode ? 'B pauses' : 'A témoin')} · {r.cached ? 'cached — sans appel' : `${r.providerCalls} appel(s)`}</strong>
   <p className="text-sm">{r.caseId} · rugosité {r.level} · texte : {r.sourceText}</p>
   <p className="text-xs">demandé {r.requestedTransport ?? 'inconnu'} → effectif {r.transport} · {r.model} · pauses : {r.pauseRendering ?? 'non attestées'} · capture : {r.auditionCapture ?? 'blob'} · premier octet {r.firstByteMs ?? '—'} ms · premier son {r.firstSoundMs ?? '—'} ms · génération {r.totalMs ?? '—'} ms · lecture {r.durationMs ?? '—'} ms</p>
   {r.transport === 'rest_fallback' && <p className="text-sm">Repli REST : cette écoute ne valide pas les pauses WS.</p>}
   {r.provider === 'gradium' && r.requests.map((request, i) => {
    const config = (request.body.json_config ?? request.body.jsonConfig) as Record<string, unknown> | undefined;
    return <p key={i} className="text-sm">Requête attestée {i + 1} ({request.transport}) : température {String(config?.temp ?? 'inconnue')} · fidélité {String(config?.cfg_coef ?? 'inconnue')} · padding envoyé {String(config?.padding_bonus ?? 'inconnu')} · voix {String(request.body.voice_id ?? request.body.voiceId ?? 'inconnue')}.</p>;
   })}
   <details><summary>Preuves : texte, snapshot et paramètres réellement envoyés</summary><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify({ sourceText: r.sourceText, context: r.context, voice: r.voice, level: r.level, snapshot: r.snapshot, requests: r.requests, stats: r.stats }, null, 2)}</pre></details>
   <div className="grid sm:grid-cols-4 gap-2">{NOTE_FIELDS.map((field, i) => <label key={field} className="text-xs">{NOTE_LABELS[i]}<Input aria-label={`${NOTE_LABELS[i]} ${r.character} ${r.variant ?? (r.pauseMode ? 'B' : 'A')}`} value={r.notes[field]} onChange={e => setResults(old => old.map(row => row.key === r.key ? { ...row, notes: { ...row.notes, [field]: e.target.value } } : row))}/></label>)}</div>
  </article>)}
 </section>;
}
