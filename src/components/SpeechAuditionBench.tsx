import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { adminTabPath } from '@/services/adminNavigation';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles } from '@/services/experienceOrchestration';
import { loadCharacterPromptByName } from '@/services/characterPromptService';
import { getTTSSettings } from '@/services/settingsService';
import { getProviderById } from '@/services/tts/registry';
import { getFishSettings, getInworldSettings, getCartesiaSettings, loadFishSettingsFromDB, loadInworldSettingsFromDB, loadCartesiaSettingsFromDB } from '@/services/tts/providerSettings';
import { buildGradiumJsonConfig } from '@/services/tts/providers/gradium';
import { GRADIUM_BUFFER_PRESETS, type GradiumBufferPreset } from '@/services/tts/gradiumStreamPlayer';
import { CANONICAL_EMOTIONS, PROVIDER_ACTING_SUPPORT } from '@/services/tts/performanceIntent';
import { loadSpeechWorkshopReferences, currentGradiumSnapshot, proposePaddingComparison, VOCAL_CONTROLS, type VocalControl, type WorkshopReferences } from '@/services/tts/speechWorkshop';
import { readSavedSpeechPerformance, saveSpeechPerformanceSettings, EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping, type SpeechPerformanceSettings, type SpeechVoiceMapping, type SpeechAuditionSnapshot } from '@/services/tts/speechPerformanceSettings';
import { AUDITION_PROVIDERS, createAuditionCorpus, auditionVoice, createAuditionSnapshot, auditionIntent, auditionKey, SpeechAuditionRunner, type AuditionLine, type AuditionEvidence, type AuditionTransport } from '@/services/tts/speechAudition';
import { readWorkshop, saveWorkshopComparison, exportWorkshop, workshopEvidence, type WorkshopComparison, type WorkshopDocument } from '@/services/tts/speechWorkshopStore';
import type { TTSProviderId } from '@/services/tts/types';
interface Character { promptId?: string; key: string; name: string; level: number; provider: TTSProviderId; states: Array<{ name: string; description: string }> }
const NOTE_FIELDS = ['words', 'rhythm', 'timbre', 'artifacts'] as const;
const NOTE_LABELS = ['Mots / pensée', 'Pauses / rythme', 'Affect / timbre', 'Clics / hoquets'];
const emptyNotes = () => ({ words: '', rhythm: '', timbre: '', artifacts: '' });
type Result = { key: string; variant: 'A' | 'B'; evidence: AuditionEvidence };
function referenceSummary(refs?: WorkshopReferences): Record<string, string> {
 return { copy: refs?.copy ?? 'inconnue', orchestration: refs?.orchestration ?? 'inconnue', compiler: refs?.compiler ?? 'inconnu', compilerSource: refs?.compilerSource ?? 'inconnue', llm: refs ? JSON.stringify(Object.fromEntries(['LLM_MODEL', 'LLM_MODEL_GM', 'LLM_TEMPERATURE', 'LLM_MAX_TOKENS', 'LLM_TOP_P', 'LLM_TEMPERATURE_GM', 'LLM_MAX_TOKENS_GM'].map(key => [key, refs.llm[key as keyof typeof refs.llm] ?? 'inconnu']))) : 'inconnu', llmSource: refs?.llmSource ?? 'inconnue', ttsSource: refs?.ttsSource ?? 'inconnue', editorialVersion: 'inconnue' };
}
function parameterReference(parameters: unknown): string {
 const allowed = ['temp', 'cfgCoef', 'paddingBonus', 'rewriteRules', 'pronunciationId', 'streamingFormat', 'streamingEnabled', 'outputFormat', 'modelId', 'model', 'referenceId', 'voiceId', 'speed', 'volume', 'temperature', 'topP', 'format', 'latency', 'stability', 'similarityBoost', 'style', 'speakerBoost', 'normalize', 'mp3Bitrate', 'chunkLength'];
 return auditionKey(Object.fromEntries(Object.entries(parameters ?? {}).filter(([key]) => allowed.includes(key))));
}
function download(comparison: WorkshopComparison, format: 'json' | 'text') {
 const url = URL.createObjectURL(new Blob([exportWorkshop(comparison, format)], { type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8' }));
 const a = document.createElement('a'); a.href = url; a.download = `comparaison-parole.${format === 'json' ? 'json' : 'txt'}`; a.click(); URL.revokeObjectURL(url);
}
/** The only audition UI; shares the existing bounded audio owner across all advanced options. */
export default function SpeechAuditionBench() {
 const environment = getActiveEnvironment();
 const [characters, setCharacters] = useState<Character[]>([]);
 const [character, setCharacter] = useState('max');
 const [references, setReferences] = useState<Record<string, WorkshopReferences>>({});
 const [baseline, setBaseline] = useState<SpeechAuditionSnapshot | null>(null);
 const [saved, setSaved] = useState<SpeechPerformanceSettings>(EMPTY_SPEECH_PERFORMANCE);
 const [mappingDraft, setMappingDraft] = useState<SpeechPerformanceSettings>(EMPTY_SPEECH_PERFORMANCE);
 const [corpora, setCorpora] = useState<Record<string, AuditionLine[]>>({});
 const [voices, setVoices] = useState<Record<string, string>>({});
 const [provider, setProvider] = useState<TTSProviderId>('gradium');
 const [level, setLevel] = useState(3);
 const [lineIndex, setLineIndex] = useState(0);
 const [control, setControl] = useState<VocalControl>('paddingBonus');
 const [vocalValue, setVocalValue] = useState(0);
 const [speed, setSpeed] = useState(1);
 const [mappingControl, setMappingControl] = useState<'speed' | 'emotion' | 'delivery' | 'instruction'>('speed');
 const [mappingValue, setMappingValue] = useState('neutral');
 const [comparison, setComparison] = useState<'vocal' | 'pauses'>('vocal');
 const [transport, setTransport] = useState<AuditionTransport>('rest');
 const [bufferPreset, setBufferPreset] = useState<GradiumBufferPreset>('current');
 const [step, setStep] = useState(1);
 const [phase, setPhase] = useState<'initial' | 'finalists'>('initial');
 const [finalists, setFinalists] = useState<string[]>([]);
 const [results, setResults] = useState<Result[]>([]);
 const [document, setDocument] = useState<WorkshopDocument | null>(null);
 const [storeReady, setStoreReady] = useState(false);
 const [name, setName] = useState('');
 const [hypothesis, setHypothesis] = useState('Un rythme global différent rend-il cette réplique plus naturelle ?');
 const [notes, setNotes] = useState(emptyNotes);
 const [decision, setDecision] = useState<WorkshopComparison['decision']>('relisten');
 const [editing, setEditing] = useState<WorkshopComparison | null>(null);
 const [loadedReferences, setLoadedReferences] = useState<Record<string, string> | null>(null);
 const [loadedCurrentIdentity, setLoadedCurrentIdentity] = useState<string | null>(null);
 const [ready, setReady] = useState(false);
 const [busy, setBusy] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [storeError, setStoreError] = useState('');
 const [status, setStatus] = useState('');
 const runner = useRef(new SpeechAuditionRunner());
 const sequence = useRef(0);
 const primary = useRef<HTMLButtonElement>(null);
 const nameField = useRef<HTMLInputElement>(null);
 useEffect(() => { if (step === 4) nameField.current?.focus(); else if (step > 1) primary.current?.focus(); }, [step]);
 const mounted = useRef(true);
 const currentEnvironment = useRef(environment); currentEnvironment.current = environment;
 const stop = () => { sequence.current++; runner.current.stop(); setBusy(false); };
 const resetPair = () => { stop(); setStep(1); setStatus(''); };
 const stillHere = () => mounted.current && currentEnvironment.current === environment && getActiveEnvironment() === environment;
 useEffect(() => {
  mounted.current = true;
  if (environment === 'prod') return;
  let current = true;
  const owner = runner.current;
  const invalidate = () => { sequence.current++; };
  setReady(false); setBusy(false); setSaving(false); setStoreReady(false); setDocument(null); setResults([]); setEditing(null); setNotes(emptyNotes()); setName(''); setDecision('relisten'); setLoadedReferences(null); setLoadedCurrentIdentity(null); setBaseline(null); setReferences({}); setCharacters([]); setPhase('initial'); setFinalists([]); setLineIndex(0); setControl('paddingBonus'); setComparison('vocal'); setBufferPreset('current'); setStatus(''); setStep(1); setError(''); setStoreError('');
  void readWorkshop(environment).then(value => { if (current && getActiveEnvironment() === environment) { setDocument(value); setStoreReady(true); } }).catch(e => { if (current) setStoreError(String(e)); });
  Promise.all([listCharacterRuntimeProfiles(), readSavedSpeechPerformance(environment), loadFishSettingsFromDB(), loadInworldSettingsFromDB(), loadCartesiaSettingsFromDB()]).then(async ([profiles, settings]) => {
   const loaded = await Promise.all(profiles.filter(p => ['max', 'emma'].includes(p.character_key)).map(async p => {
    const prompt = await loadCharacterPromptByName(p.display_name);
    return { key: p.character_key, name: p.display_name, promptId: prompt?.character_id, states: prompt?.speech_states ?? [], level: p.rugosite, provider: p.tts_provider as TTSProviderId };
   }));
   const refs = Object.fromEntries(await Promise.all(loaded.map(async c => [c.key, await loadSpeechWorkshopReferences(c.promptId)] as const)));
   if (!current || getActiveEnvironment() !== environment) return;
   const max = loaded.find(c => c.key === 'max');
   if (!max || !AUDITION_PROVIDERS.includes(max.provider) || !Number.isInteger(max.level)) throw new Error('Profil Max indisponible ou incomplet.');
   setCharacters(loaded); setSaved(settings); setMappingDraft(structuredClone(settings)); setReferences(refs);
   setCorpora(Object.fromEntries(loaded.map(c => [c.key, createAuditionCorpus(c.key, c.states.map(s => s.name))])));
   setVoices(Object.fromEntries(profiles.filter(p => p.tts_provider && p.tts_voice_id).map(p => [`${p.character_key}:${p.tts_provider}`, p.tts_voice_id ?? ''])));
   const base = createAuditionSnapshot('max', max.states, settings, settings.gradiumPausesEnabled === true, true);
   base.gradium = currentGradiumSnapshot('max'); setBaseline(base); setCharacter('max'); setProvider(max.provider); setLevel(max.level);
   setVocalValue(proposePaddingComparison(base.gradium.paddingBonus)); setTransport(base.gradium.streamingEnabled ? 'websocket' : 'rest'); setReady(true);
  }).catch(e => { if (current) setError(String(e)); });
  return () => { current = false; mounted.current = false; invalidate(); owner.clear(); };
 }, [environment]);
 const active = characters.find(c => c.key === character);
 const line = corpora[character]?.[lineIndex];
 const voice = auditionVoice(voices, character, provider);
 const requestedTransport = provider !== 'gradium' ? 'rest' : comparison === 'pauses' ? 'websocket' : transport;
 const a = baseline ? structuredClone(baseline) : null;
 if (a && comparison === 'pauses') a.settings.gradiumPausesEnabled = false;
 const b = a ? structuredClone(a) : null;
 if (b) {
  if (comparison === 'pauses') b.settings.gradiumPausesEnabled = true;
  else if (provider === 'gradium') b.gradium[control] = vocalValue;
  else if (line?.state && b.settings.byCharacter[character]?.[line.state]) Object.assign(b.settings.byCharacter[character][line.state], { [mappingControl]: mappingControl === 'speed' ? speed : mappingValue });
 }
 const parameters = provider === 'gradium' ? a?.gradium : provider === 'elevenlabs' ? getTTSSettings() : provider === 'fish' ? getFishSettings() : provider === 'inworld' ? getInworldSettings() : getCartesiaSettings();
 const diff = comparison === 'pauses' && provider === 'gradium' ? 'Pauses explicites : désactivées → activées (WS expérimental)'
  : provider === 'gradium' ? `${VOCAL_CONTROLS[control].label} : version actuelle = ${a?.gradium[control] ?? 'inconnue'} → essai = ${vocalValue}`
  : `${{ speed: 'Débit relatif', emotion: 'Émotion', delivery: 'Delivery', instruction: 'Instruction' }[mappingControl]} : version actuelle = ${a?.settings.byCharacter[character]?.[line?.state ?? '']?.[mappingControl] ?? 'mapping absent'} → essai = ${mappingControl === 'speed' ? speed : mappingValue}`;
 const keyFor = (snapshot: SpeechAuditionSnapshot | null) => auditionKey({ character, provider, level, line, voice, snapshot, parameters, requestedTransport, bufferPreset });
 const aResult = results.find(r => r.variant === 'A' && r.key === keyFor(a));
 const bResult = results.find(r => r.variant === 'B' && r.key === keyFor(b));
 const eligible = phase === 'initial' ? lineIndex < 2 : finalists.includes(line?.id ?? '');
 const providerParametersChanged = provider !== 'gradium' && loadedReferences?.requestedParameters && loadedReferences.requestedParameters !== parameterReference(parameters);
 const contextReady = ready && baseline?.environment === environment && baseline?.character === character;
 const valid = contextReady && !providerParametersChanged && a && b && voice && line?.text.trim() && line.state && active?.states.some(s => s.name === line.state) && a.validStates.includes(line.state) && b.validStates.includes(line.state) && eligible;
 const differs = auditionKey(a) !== auditionKey(b) && (provider === 'gradium' || a?.settings.enabled === true);
 const refs: Record<string, string> = { ...referenceSummary(references[character]), requestedParameters: parameterReference(parameters) };
 const currentIdentity = auditionKey({ settings: saved, gradium: ready ? currentGradiumSnapshot(character) : null, voice: auditionVoice(voices, character, provider) });
 const referencesChanged = !!loadedReferences && (auditionKey(loadedReferences) !== auditionKey(refs) || loadedCurrentIdentity !== currentIdentity);
 function selectCharacter(key: string) {
  resetPair(); const c = characters.find(c => c.key === key); if (!c) return;
  const base = createAuditionSnapshot(key, c.states, saved, saved.gradiumPausesEnabled === true, true); base.gradium = currentGradiumSnapshot(key);
  setCharacter(key); setLineIndex(0); setBaseline(base); setLevel(c.level); setProvider(c.provider); setComparison('vocal'); setVocalValue(proposePaddingComparison(base.gradium.paddingBonus)); setTransport(base.gradium.streamingEnabled ? 'websocket' : 'rest'); setEditing(null); setLoadedReferences(null); setLoadedCurrentIdentity(null); setNotes(emptyNotes()); setName(''); setDecision('relisten');
 }
 function patchLine(patch: Partial<AuditionLine>) { resetPair(); setCorpora(old => ({ ...old, [character]: (old[character] ?? []).map((l, i) => i === lineIndex ? { ...l, ...patch } : l) })); }
 async function listen(variant: 'A' | 'B') {
  const snapshot = variant === 'A' ? a : b;
  if (!valid || !snapshot || !line || !voice || !stillHere()) return;
  stop(); const requestId = ++sequence.current; setBusy(true); setError('');
  const key = keyFor(snapshot);
  try {
   const evidence = await runner.current.listen(key, line.text, getProviderById(provider), {
    characterKey: character, voiceId: voice, performance: auditionIntent(snapshot, line.text, line.state, level),
    ...(provider === 'gradium' ? { speechAudition: structuredClone(snapshot), bufferPreset } : {}),
    ...(provider === 'elevenlabs' ? { auditionModelId: 'eleven_v3' as const } : {}),
   }, requestedTransport);
   if (requestId !== sequence.current || !stillHere()) return;
   setResults(old => [{ key, variant, evidence }, ...old.filter(r => !(r.key === key && r.variant === variant))].slice(0, 32)); setStep(variant === 'A' ? 3 : 4);
  } catch (e) { if (requestId === sequence.current && stillHere()) setError(e instanceof Error ? e.message : String(e)); }
  finally { if (requestId === sequence.current && stillHere()) setBusy(false); }
 }
 function draftComparison(): WorkshopComparison {
  if (!valid || !a || !b || !line || !voice) throw new Error('Choisir une réplique, son état et une voix avant d’enregistrer.');
  const samePair = editing && auditionKey({ a: editing.a, b: editing.b, line: editing.line, voice: editing.voice, provider: editing.provider, level: editing.level, transport: editing.transport, buffer: editing.bufferPreset ?? 'current' }) === auditionKey({ a, b, line, voice, provider, level, transport: requestedTransport, buffer: bufferPreset });
  return { id: editing?.id ?? crypto.randomUUID(), name, hypothesis, environment, createdAt: editing?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), character, provider, voice, level, line: structuredClone(line), a, b, control: comparison === 'pauses' ? 'pauses' : provider === 'gradium' ? control : mappingControl, diff, transport: requestedTransport, bufferPreset,
   references: loadedReferences ?? refs, evidence: (['A', 'B'] as const).flatMap(variant => { const result = variant === 'A' ? aResult : bResult; return result ? [workshopEvidence(result.evidence, variant)] : samePair ? editing.evidence.filter(e => e.variant === variant) : []; }), notes, decision, cost: null };
 }
 async function saveComparison() {
  stop(); setSaving(true); setStoreError(''); setStatus('');
  try {
   if (!storeReady) throw new Error('Recharger les variantes avant toute sauvegarde.');
   const value = draftComparison(); const confirmed = await saveWorkshopComparison(value, document, environment);
   if (!stillHere()) return;
   setDocument(confirmed); setEditing(confirmed.comparisons.find(c => c.id === value.id)!); setStatus('Comparaison enregistrée et relue dans cette sandbox. Aucun réglage du jeu modifié.');
  } catch (e) { if (stillHere()) setStoreError(e instanceof Error ? e.message : String(e)); }
  finally { if (stillHere()) setSaving(false); }
 }
 async function reloadDocuments() {
  setStoreError(''); setStoreReady(false);
  try { const value = await readWorkshop(environment); if (stillHere()) { setDocument(value); setStoreReady(true); setStatus('Variantes rechargées ; votre brouillon est conservé.'); } }
  catch (e) { if (stillHere()) setStoreError(String(e)); }
 }
 function restore(c: WorkshopComparison) {
  resetPair(); runner.current.clear(); setResults([]);
  const target = characters.find(item => item.key === c.character);
  if (c.environment !== environment || !target?.states.some(s => s.name === c.line.state)) { setError('Personnage ou état absent de la fiche actuelle. Le document reste consultable et exportable.'); return; }
  setLoadedCurrentIdentity(auditionKey({ settings: saved, gradium: currentGradiumSnapshot(c.character), voice: auditionVoice(voices, c.character, c.provider) }));
  setCharacter(c.character); setProvider(c.provider); setLevel(c.level); setBaseline(structuredClone(c.a));
  setCorpora(old => ({ ...old, [c.character]: [structuredClone(c.line), ...(old[c.character] ?? []).filter(l => l.id !== c.line.id)] })); setLineIndex(0);
  setVoices(old => ({ ...old, [`${c.character}:${c.provider}`]: c.voice })); setControl(c.control in VOCAL_CONTROLS ? c.control as VocalControl : 'paddingBonus'); setComparison(c.control === 'pauses' ? 'pauses' : 'vocal');
  if (['speed', 'emotion', 'delivery', 'instruction'].includes(c.control)) { setMappingControl(c.control as typeof mappingControl); setMappingValue(String(c.b.settings.byCharacter[c.character]?.[c.line.state]?.[c.control as keyof SpeechVoiceMapping] ?? 'neutral')); }
  setVocalValue(c.control in VOCAL_CONTROLS ? c.b.gradium[c.control as VocalControl] : c.b.gradium.paddingBonus); setSpeed(c.b.settings.byCharacter[c.character]?.[c.line.state]?.speed ?? 1); setTransport(c.transport); setBufferPreset(c.bufferPreset ?? 'current'); setLoadedReferences(c.references);
  setName(c.name); setHypothesis(c.hypothesis); setNotes(c.notes); setDecision(c.decision); setEditing(c); setStatus('Brouillon chargé sans audio ni sauvegarde. Une nouvelle écoute régénère : l’ancien son exact n’est pas conservé.');
 }
 async function saveMapping() {
  if (!contextReady) return;
  stop(); setSaving(true); setError('');
  try { const confirmed = await saveSpeechPerformanceSettings(mappingDraft, saved, environment); if (stillHere()) { setSaved(confirmed); setMappingDraft(structuredClone(confirmed)); toast.success('Mapping du jeu sauvegardé et relu ; essais existants conservés.'); } }
  catch (e) { if (stillHere()) setError(String(e)); } finally { if (stillHere()) setSaving(false); }
 }
 function patchMapping(state: string, patch: Partial<SpeechVoiceMapping>) {
  stop(); setMappingDraft(old => ({ ...old, byCharacter: { ...old.byCharacter, [character]: { ...old.byCharacter[character], [state]: { ...(old.byCharacter[character]?.[state] ?? proposeSpeechMapping(state, active?.states.find(s => s.name === state)?.description ?? '')), ...patch } } } }));
 }
 if (environment === 'prod') return <section><h3>Atelier de parole</h3><p>Réservé aux environnements sandbox.</p></section>;
 return <section aria-label="Atelier de parole" className="min-w-0 max-w-3xl space-y-4 break-words [&_select]:max-w-full [&_select]:min-w-0 [&_select]:rounded [&_select]:border [&_select]:bg-background [&_select]:p-2 [&_label]:min-w-0">
  <fieldset disabled={saving} className="min-w-0 space-y-4"><h3 className="text-xl font-semibold">Atelier de parole — {active?.name ?? 'Max'}</h3>
  <p>Une réplique, deux versions, une seule différence. Aucun essai ne modifie le jeu. <span className="text-sm text-muted-foreground">{environment}</span></p>
  {error && <p role="alert" className="text-destructive">{error}</p>}
  {status && <p role="status">{status}</p>}
  {providerParametersChanged && <div role="status"><p>Les paramètres de ce fournisseur ont changé. Le document est conservé ; préparez explicitement une nouvelle comparaison avec les valeurs actuelles avant de régénérer.</p><Button variant="outline" onClick={() => selectCharacter(character)}>Préparer avec les références actuelles</Button></div>}
  {referencesChanged && <p role="status">Les références actuelles diffèrent du document chargé. Le brouillon conserve ses anciennes valeurs ; voir « Références et différences » avant une nouvelle comparaison.</p>}
  {!ready && !error && <p role="status">Chargement des références…</p>}
  <p aria-label="Étape courante" className="font-medium">Étape {step} sur 4 — {['Choisir la réplique et son état', 'Écouter la version actuelle', 'Écouter un essai', 'Donner son avis et enregistrer'][step - 1]}</p>
  {step === 1 && <div className="space-y-3 rounded border p-4">
   <p>Choisissez la réplique et l’état de {active?.name ?? 'Max'}. Au clic sur Continuer, vous préparerez l’écoute ; aucun son ne démarre.</p>
   <label className="block">Réplique <select className="block w-full" aria-label="Réplique du banc" value={lineIndex} onChange={e => { resetPair(); setLineIndex(Number(e.target.value)); }}>{(corpora[character] ?? []).map((l, i) => <option key={l.id} value={i}>{l.id} — {l.text.slice(0, 65)}</option>)}</select></label>
   <p className="text-sm">Contexte proposé : {line?.context}</p>
   <label className="block">État de la fiche <select className="block w-full" aria-label="État de la réplique" value={line?.state ?? ''} onChange={e => patchLine({ state: e.target.value })}><option value="">Choisir explicitement un état</option>{active?.states.map(s => <option key={s.name}>{s.name}</option>)}</select></label>
   <p className="text-sm">{active?.states.find(s => s.name === line?.state)?.description}</p>
   <label className="block">Texte court à comparer<Textarea aria-label="Texte source audition" maxLength={500} value={line?.text ?? ''} onChange={e => patchLine({ text: e.target.value })}/></label>
   {!eligible && <p>Ce cas doit être sélectionné dans les options avancées avant de continuer.</p>}
   <Button disabled={!valid || busy || saving} onClick={() => setStep(2)}>Continuer vers la version actuelle</Button>
  </div>}
  {step >= 2 && <div className="space-y-3 rounded border p-4">
   <p>{line?.id} · {line?.state} · {provider} · même voix et même texte pour les deux écoutes.</p><blockquote>{line?.text}</blockquote>
   {step === 2 && <><p>Écoutez d’abord la version actuelle. Ce bouton génère du son auprès du fournisseur ; pendant cette séance, un son déjà en cache est rejoué sans nouvel appel.</p><Button ref={primary} disabled={!valid || busy || saving} onClick={() => void listen('A')}>Écouter la version actuelle</Button></>}
   {step === 3 && <>
    <p>Changez un seul réglage, puis écoutez l’essai sur la même réplique.</p>
    {provider === 'gradium' && comparison === 'vocal' && <div className="grid gap-3 sm:grid-cols-2"><label>Réglage testé<select className="block w-full" aria-label="Réglage testé" value={control} onChange={e => { stop(); const key = e.target.value as VocalControl; setControl(key); setVocalValue(a?.gradium[key] ?? 0); }}>{Object.entries(VOCAL_CONTROLS).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label><label>Valeur de l’essai<Input aria-label="Valeur de l’essai" type="number" min={VOCAL_CONTROLS[control].min} max={VOCAL_CONTROLS[control].max} step={VOCAL_CONTROLS[control].step} value={vocalValue} onChange={e => { stop(); const meta = VOCAL_CONTROLS[control]; setVocalValue(Math.max(meta.min, Math.min(meta.max, Number(e.target.value) || 0))); }}/></label></div>}
    {provider !== 'gradium' && <div className="space-y-2"><label>Réglage testé<select aria-label="Réglage de l’intention" value={mappingControl} onChange={e => { stop(); const key = e.target.value as typeof mappingControl; setMappingControl(key); setMappingValue(String(a?.settings.byCharacter[character]?.[line?.state ?? '']?.[key] ?? 'neutral')); }}><option value="speed">Débit relatif</option><option value="emotion">Émotion</option><option value="delivery">Delivery</option><option value="instruction">Instruction</option></select></label>{mappingControl === 'speed' ? <label>Débit relatif de l’essai<Input aria-label="Débit de l’essai" type="number" min="0.7" max="1.2" step="0.01" value={speed} onChange={e => { stop(); setSpeed(Math.max(0.7, Math.min(1.2, Number(e.target.value) || 1))); }}/></label> : mappingControl === 'instruction' ? <label>Instruction de l’essai<Input aria-label="Instruction de l’essai" maxLength={70} value={mappingValue} onChange={e => { stop(); setMappingValue(e.target.value); }}/></label> : <label>Valeur de l’intention<select aria-label="Intention de l’essai" value={mappingValue} onChange={e => { stop(); setMappingValue(e.target.value); }}>{(mappingControl === 'emotion' ? CANONICAL_EMOTIONS : ['measured', 'whisper', 'rushed', 'cutting']).map(value => <option key={value}>{value}</option>)}</select></label>}</div>}
    <p aria-label="Différence comparée">{diff}</p>
    {provider === 'gradium' ? <p className="text-sm">Le rythme global accélère si la valeur baisse, ralentit si elle monte. La modulation par état peut borner la valeur envoyée. Les pauses exactes nécessitent WS ; les tags d’émotion restent fermés.</p> : <p className="text-sm">{PROVIDER_ACTING_SUPPORT[provider].detailFr} Le changement de débit nécessite un mapping actif pour cet état.</p>}
    <Button ref={primary} disabled={!valid || !differs || !aResult || busy || saving} onClick={() => void listen('B')}>Écouter l’essai</Button>
   </>}
   {step === 4 && <><p aria-label="Différence comparée">{diff}</p><p>Comparez ce que vous avez entendu, puis nommez et enregistrez votre comparaison.</p>
    <label className="block">Nom de la comparaison<Input ref={nameField} aria-label="Nom de la comparaison" maxLength={100} value={name} onChange={e => { setName(e.target.value); setStatus(''); }}/></label>
    <label className="block">Hypothèse<Textarea aria-label="Hypothèse" maxLength={500} value={hypothesis} onChange={e => { setHypothesis(e.target.value); setStatus('Brouillon modifié : changements non enregistrés.'); }}/></label>
    <div className="grid gap-3 sm:grid-cols-2">{NOTE_FIELDS.map((field, i) => <label key={field}>{NOTE_LABELS[i]}<Input aria-label={NOTE_LABELS[i]} maxLength={500} value={notes[field]} onChange={e => { setNotes(old => ({ ...old, [field]: e.target.value })); setStatus('Avis modifié : changements non enregistrés.'); }}/></label>)}</div>
    <label className="block">Avis humain<select className="block w-full" aria-label="Décision humaine" value={decision} onChange={e => { setDecision(e.target.value as WorkshopComparison['decision']); setStatus('Avis modifié : changements non enregistrés.'); }}><option value="relisten">À réécouter</option><option value="preferred">Essai préféré</option><option value="rejected">Essai rejeté</option></select></label>
    <Button disabled={!storeReady || !name.trim() || !hypothesis.trim() || !aResult || !bResult || busy || saving} onClick={() => void saveComparison()}>Enregistrer la comparaison et mon avis</Button>
    <p className="text-sm">Avis humain uniquement. Aucune application au jeu. Coût inconnu.</p>
   </>}
   <div className="flex flex-wrap gap-2">{busy && <Button variant="outline" onClick={stop}>Arrêter</Button>}{!busy && <Button variant="outline" onClick={resetPair}>Revenir au choix de la réplique</Button>}{step > 2 && <Button variant="outline" disabled={busy} onClick={() => setStep(2)}>Réécouter la version actuelle</Button>}{step === 4 && <Button variant="outline" disabled={busy} onClick={() => setStep(3)}>Réécouter ou modifier l’essai</Button>}</div>
   {[aResult, bResult].filter((r): r is Result => !!r).map(r => <p key={r.variant} className="text-sm">{r.variant === 'A' ? 'Version actuelle' : 'Essai'} : {r.evidence.cached ? 'rejeu exact du cache de cette séance' : `${r.evidence.providerCalls} requête(s) fournisseur attestée(s)`} · {r.evidence.transport}{r.evidence.transport === 'rest_fallback' ? ' — Repli REST : cette écoute ne valide pas les pauses WS.' : ''}</p>)}
  </div>}
  <section aria-label="Comparaisons enregistrées" className="space-y-2 rounded border p-4">
   <h4 className="font-semibold">Retrouver mes comparaisons</h4>
   <p className="text-sm">Noms, réglages et avis sont conservés dans cette sandbox. L’audio reste en mémoire seulement : après fermeture, réécouter régénère un son différent.</p>
   {storeError && <p role="alert">{storeError}</p>}
   {!storeReady ? <p>Lecture non confirmée ; aucune sauvegarde autorisée.</p> : !document?.comparisons.length && <p>Aucune comparaison enregistrée dans cette sandbox.</p>}
   <Button variant="outline" disabled={saving} onClick={() => void reloadDocuments()}>Recharger les variantes</Button>
   {storeReady && document?.comparisons.map(c => <details key={c.id}><summary className="cursor-pointer">{c.name} · {c.character} · {c.decision === 'preferred' ? 'essai préféré' : c.decision === 'rejected' ? 'essai rejeté' : 'à réécouter'}</summary><div className="space-y-2 py-2"><p>{c.hypothesis}</p><p>{c.diff}</p><p>{c.line.text} · {c.line.state}</p>{NOTE_FIELDS.map((field, i) => <p key={field}>{NOTE_LABELS[i]} : {c.notes[field] || 'non renseigné'}</p>)}<p>{c.evidence.length ? c.evidence.map(e => `${e.variant === 'A' ? 'Version actuelle' : 'Essai'} : ${e.kind} · ${e.transport}`).join(' ; ') : 'Brouillon sans preuve d’écoute'}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!ready || busy || saving} onClick={() => restore(c)}>Charger comme brouillon</Button><Button variant="outline" onClick={() => download(c, 'text')}>Exporter le texte lisible</Button><Button variant="outline" onClick={() => download(c, 'json')}>Exporter le JSON</Button></div></div></details>)}
  </section>
  <details><summary className="cursor-pointer">Options avancées — Emma, fournisseurs et autres répliques</summary><div className="space-y-3 py-3">
   <label className="block">Personnage<select className="block w-full" aria-label="Personnage du banc" value={character} disabled={!ready} onChange={e => selectCharacter(e.target.value)}>{characters.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
   <label className="block">Fournisseur de l’essai<select className="block w-full" aria-label="Fournisseur du banc" value={provider} onChange={e => { resetPair(); setProvider(e.target.value as TTSProviderId); setComparison('vocal'); }}>{AUDITION_PROVIDERS.map(p => <option key={p}>{p}</option>)}</select></label>
   <p>Un autre fournisseur utilise ses réglages chargés ; ElevenLabs utilise v3 dans l’atelier. Aucune préférence artistique prédéfinie.</p>
   <label className="block">Voix isolée<Input aria-label={`Voix ${character} ${provider}`} value={voice ?? ''} maxLength={500} onChange={e => { resetPair(); setVoices(old => ({ ...old, [`${character}:${provider}`]: e.target.value })); }}/></label>
   <label className="block">Rugosité de la paire<select aria-label="Rugosité du banc" value={level} onChange={e => { resetPair(); setLevel(Number(e.target.value)); }}>{[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>
   <label className="block">Corpus<select aria-label="Étape audition" value={phase} onChange={e => { resetPair(); setPhase(e.target.value as typeof phase); }}><option value="initial">Deux premières répliques</option><option value="finalists">Répliques sélectionnées</option></select></label>
   {phase === 'finalists' && <div className="flex flex-wrap gap-3">{(corpora[character] ?? []).map(l => <label key={l.id}><input type="checkbox" aria-label={`Finaliste ${l.id}`} checked={finalists.includes(l.id)} onChange={e => { resetPair(); setFinalists(old => e.target.checked ? [...old, l.id] : old.filter(id => id !== l.id)); }}/>{l.id}</label>)}</div>}
   <label className="block">Comparaison<select aria-label="Type de comparaison" value={comparison} disabled={provider !== 'gradium'} onChange={e => { resetPair(); setComparison(e.target.value as typeof comparison); }}><option value="vocal">Un réglage vocal</option><option value="pauses">Pauses expérimentales A2, en WS</option></select></label>
   <label className="block">Transport demandé<select aria-label="Transport audition" value={requestedTransport} disabled={provider !== 'gradium' || comparison === 'pauses'} onChange={e => { resetPair(); setTransport(e.target.value as AuditionTransport); }}><option value="rest">REST — génération directe</option><option value="websocket">WebSocket — repli REST possible</option></select></label>
   <label className="block">Buffer streaming de la paire<select aria-label="Buffer de la paire" value={bufferPreset} disabled={provider !== 'gradium' || requestedTransport !== 'websocket'} onChange={e => { resetPair(); setBufferPreset(e.target.value as GradiumBufferPreset); }}>{Object.entries(GRADIUM_BUFFER_PRESETS).map(([id, preset]) => <option key={id} value={id}>{id} · {preset.prebufferMs}/{preset.rebufferMs} ms</option>)}</select></label>
   <p>{PROVIDER_ACTING_SUPPORT[provider].detailFr}</p><p>Les pauses A2 restent soumises aux gardes du mapping. Un repli REST ne les valide pas. Tags Gradium fermés ; aucune pause ne garantit un souffle ni un sanglot.</p>
   <details><summary>Enregistrer un brouillon sans écoute</summary><p>Conserve les réglages et l’hypothèse sans prétendre qu’ils ont été écoutés. Une seule différence requise.</p><label>Nom du brouillon<Input aria-label="Nom du brouillon" value={name} maxLength={100} onChange={e => setName(e.target.value)}/></label><label>Hypothèse du brouillon<Input aria-label="Hypothèse du brouillon" value={hypothesis} maxLength={500} onChange={e => { setHypothesis(e.target.value); setStatus('Brouillon modifié : changements non enregistrés.'); }}/></label><Button variant="outline" disabled={!valid || !differs || !name.trim() || !hypothesis.trim() || !storeReady || busy || saving} onClick={() => void saveComparison()}>Enregistrer ce brouillon sans écoute</Button></details>
  </div></details>
  <details><summary className="cursor-pointer">Références et différences — fiche, rugosité, GM, LLM, synthèse</summary><div className="space-y-2 py-3">
   <p>Fiche synchronisée : {refs.copy} · version éditoriale Notion inconnue. Rugosité de la paire : {level}.</p><p>Orchestration publiée : {refs.orchestration} ; elle ne génère pas ces répliques fixes.</p><p>Compilateur : {refs.compiler} · {refs.compilerSource}. LLM : {refs.llm} · {refs.llmSource}.</p><p>Synthèse : {provider} · voix {voice ?? 'inconnue'} · {refs.ttsSource}. Mapping : {a?.settings.version || 'inconnu / absent'}.</p>
   {loadedReferences && <><p>Références enregistrées : {JSON.stringify(loadedReferences)}</p><p>Référence actuelle du rendu : {JSON.stringify({ settings: saved, gradium: ready ? currentGradiumSnapshot(character) : null })}</p><p>Snapshot du brouillon chargé : {JSON.stringify(a)}</p></>}
   <Link className="underline" to={adminTabPath('character-editor')}>Fiche synchronisée</Link> · <Link className="underline" to={adminTabPath('gamemaster')}>Orchestration</Link> · <Link className="underline" to={adminTabPath('llm')}>Configuration LLM</Link> · <Link className="underline" to={adminTabPath('voice')}>Configuration technique TTS</Link>
  </div></details>
  <details><summary className="cursor-pointer">Preuves et JSON — préparation et requêtes effectives</summary><div className="space-y-2 py-3"><p>{runner.current.providerCalls} appels TTS réels attestés, repli compris · coût inconnu. Cache mémoire : 16 écoutes / 16 Mio ; capture WS bornée à 30 s. Les paramètres préparés ne prouvent pas une écoute.</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({ versionActuelle: a, essai: b, transport: requestedTransport, bufferPreset, gradiumPrepared: valid ? buildGradiumJsonConfig(a.gradium, auditionIntent(a, line.text, line.state, level)) : null, evidence: [aResult, bResult].filter((r): r is Result => !!r).map(r => workshopEvidence(r.evidence, r.variant)) }, null, 2)}</pre><Button variant="outline" onClick={() => { resetPair(); runner.current.clear(); setResults([]); }}>Vider le cache audio de la séance</Button></div></details>
  <details><summary className="cursor-pointer">Configuration persistante du jeu — mapping des états (avancé)</summary><div className="space-y-3 py-3"><p>Ce panneau modifie le mapping du jeu dans {environment} uniquement au clic explicite de sauvegarde. Il est distinct des variantes temporaires ci-dessus. Déplacer ce panneau n’a changé aucune valeur enregistrée.</p><label><input type="checkbox" checked={mappingDraft.enabled} onChange={e => { stop(); setMappingDraft(old => ({ ...old, enabled: e.target.checked })); }}/> Rendu par état du jeu (brouillon)</label>
   {active?.states.map(state => { const mapping = mappingDraft.byCharacter[character]?.[state.name] ?? proposeSpeechMapping(state.name, state.description); return <div key={state.name} className="space-y-2 border-b py-2"><strong>{state.name}</strong><p>{state.description}</p>{!mappingDraft.byCharacter[character]?.[state.name] && <p>Proposition non enregistrée.</p>}<div className="grid gap-2 sm:grid-cols-2"><label>Débit relatif<Input aria-label={`Débit ${state.name}`} type="number" min="0.7" max="1.2" step="0.01" value={mapping.speed} onChange={e => patchMapping(state.name, { speed: Math.max(0.7, Math.min(1.2, Number(e.target.value) || 1)) })}/></label><label>Pauses<select aria-label={`Pauses ${state.name}`} value={mapping.pauses} onChange={e => patchMapping(state.name, { pauses: e.target.value as SpeechVoiceMapping['pauses'] })}>{['short', 'normal', 'long'].map(v => <option key={v}>{v}</option>)}</select></label><label>Delivery<select aria-label={`Delivery ${state.name}`} value={mapping.delivery} onChange={e => patchMapping(state.name, { delivery: e.target.value as SpeechVoiceMapping['delivery'] })}>{['measured', 'whisper', 'rushed', 'cutting'].map(v => <option key={v}>{v}</option>)}</select></label><label>Émotion<select aria-label={`Émotion ${state.name}`} value={mapping.emotion} onChange={e => patchMapping(state.name, { emotion: e.target.value as SpeechVoiceMapping['emotion'] })}>{CANONICAL_EMOTIONS.map(v => <option key={v}>{v}</option>)}</select></label></div><Input aria-label={`Instruction ${state.name}`} maxLength={70} value={mapping.instruction} onChange={e => patchMapping(state.name, { instruction: e.target.value })}/></div>; })}
   <p>Gradium : débit relatif, émotion, delivery et instruction d’acting non transmis ; pauses module le padding. Tags toujours fermés. Les snapshots d’essai déjà chargés restent inchangés après cette sauvegarde.</p>
   <Button variant="outline" disabled={!contextReady || saving || busy || auditionKey(saved) === auditionKey(mappingDraft)} onClick={() => void saveMapping()}>Sauvegarder le mapping du jeu sandbox et relire</Button>
  </div></details>
 </fieldset></section>;
}
