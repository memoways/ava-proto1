import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import SpeechAuditionBench from './SpeechAuditionBench';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles } from '@/services/experienceOrchestration';
import { getTTSSettings } from '@/services/settingsService';
import { getProviderById } from '@/services/tts/registry';
import { getCartesiaSettings, getFishSettings, getInworldSettings, loadCartesiaSettingsFromDB, loadFishSettingsFromDB, loadInworldSettingsFromDB, resolveGradiumSettings } from '@/services/tts/providerSettings';
import { auditionKey, SpeechAuditionRunner, type AuditionEvidence } from '@/services/tts/speechAudition';
import {
 ELEVENLABS_WORKSHOP_MODEL, INTENT_PASSAGES, INTENT_PROVIDERS, PROVIDER_LABELS, WORKSHOP_INTENTS, exportIntentResults, intentPerformance, intentResults,
 providerPlan, recipeWords, resolveCardVoice, workshopIntent, type ProviderBaseSettings,
} from '@/services/tts/speechIntentWorkshop';
import { cardEvidence, readWorkshop, saveIntentTrial, type IntentTrial, type WorkshopDocument } from '@/services/tts/speechWorkshopStore';
import type { TTSProviderId } from '@/services/tts/types';

type PassageId = IntentTrial['passage']['id'];
interface Generated { key: string; evidence: AuditionEvidence }
interface Rating { key: string; rating: number | null; off: string }
const STEPS = ['Texte à jouer', 'Émotion du personnage', 'Fournisseurs à comparer', 'Écouter et noter'];
const RATING_LABELS = ['1 — pas du tout', '2', '3', '4', '5 — totalement'];
function save(content: string, name: string, type: string) {
 const url = URL.createObjectURL(new Blob([content], { type }));
 const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function baseSettings(): ProviderBaseSettings {
 const gradium = resolveGradiumSettings('max'), fish = getFishSettings(), eleven = getTTSSettings(), inworld = getInworldSettings(), cartesia = getCartesiaSettings();
 return { gradium: { temp: gradium.temp, paddingBonus: gradium.paddingBonus, cfgCoef: gradium.cfgCoef }, fish: { speed: fish.speed, emotionTags: fish.emotionTags, defaultEmotion: fish.defaultEmotion, model: fish.model },
  elevenlabs: { style: eleven.style, stability: eleven.stability, speed: eleven.speed }, inworld: { deliveryMode: inworld.deliveryMode, speakingRate: inworld.speakingRate, modelId: inworld.modelId }, cartesia: { language: cartesia.language, modelId: cartesia.modelId } };
}
function providerDefaultVoice(provider: TTSProviderId): string | null {
 if (provider === 'gradium') return resolveGradiumSettings('max').voiceId;
 if (provider === 'fish') return getFishSettings().referenceId;
 if (provider === 'inworld') return getInworldSettings().voiceId;
 if (provider === 'cartesia') return getCartesiaSettings().voiceId;
 return null;
}

/** AP4: one text, one acting intent, one card per provider, rated by ear. The AP2 bench stays under advanced options. */
export default function SpeechIntentWorkshop() {
 const environment = getActiveEnvironment();
 const [ready, setReady] = useState(false);
 const [error, setError] = useState('');
 const [status, setStatus] = useState('');
 const [storeError, setStoreError] = useState('');
 const [storeReady, setStoreReady] = useState(false);
 const [document, setDocument] = useState<WorkshopDocument | null>(null);
 const [game, setGame] = useState<{ provider: TTSProviderId | null; voice: string | null }>({ provider: null, voice: null });
 const [base, setBase] = useState<ProviderBaseSettings | null>(null);
 const [step, setStep] = useState(1);
 const [passageId, setPassageId] = useState<PassageId>('P1');
 const [text, setText] = useState(INTENT_PASSAGES[0].text);
 const [intentId, setIntentId] = useState('');
 const [selected, setSelected] = useState<TTSProviderId[]>([]);
 const [workshopVoices, setWorkshopVoices] = useState<Partial<Record<TTSProviderId, string>>>({});
 const [generated, setGenerated] = useState<Partial<Record<TTSProviderId, Generated>>>({});
 const [failures, setFailures] = useState<Partial<Record<TTSProviderId, string>>>({});
 const [ratings, setRatings] = useState<Partial<Record<TTSProviderId, Rating>>>({});
 const [busy, setBusy] = useState<TTSProviderId | null>(null);
 const [saving, setSaving] = useState(false);
 const [trialId, setTrialId] = useState(() => crypto.randomUUID());
 const [advanced, setAdvanced] = useState(false);
 const runner = useRef(new SpeechAuditionRunner());
 const sequence = useRef(0);
 const mounted = useRef(true);
 const heading = useRef<HTMLParagraphElement>(null);
 const stillHere = () => mounted.current && getActiveEnvironment() === environment;
 useEffect(() => { heading.current?.focus(); }, [step]);
 useEffect(() => {
  mounted.current = true;
  if (environment === 'prod') return;
  const owner = runner.current, counter = sequence;
  void readWorkshop(environment).then(value => { if (stillHere()) { setDocument(value); setStoreReady(true); prefillVoices(value); } }).catch(e => { if (stillHere()) setStoreError(e instanceof Error ? e.message : String(e)); });
  Promise.all([listCharacterRuntimeProfiles(), loadFishSettingsFromDB(), loadInworldSettingsFromDB(), loadCartesiaSettingsFromDB()]).then(([profiles]) => {
   if (!stillHere()) return;
   const max = profiles.find(p => p.character_key === 'max');
   setGame({ provider: (max?.tts_provider as TTSProviderId | null) ?? null, voice: max?.tts_voice_id ?? null }); setBase(baseSettings()); setReady(true);
  }).catch(e => { if (stillHere()) setError(e instanceof Error ? e.message : String(e)); });
  return () => { mounted.current = false; counter.current++; owner.clear(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [environment]);
 function prefillVoices(value: WorkshopDocument | null) {
  const voices: Partial<Record<TTSProviderId, string>> = {};
  for (const trial of [...(value?.intentTrials ?? [])].reverse()) for (const card of trial.cards) if (card.voiceSource === 'workshop' && card.voice) voices[card.provider] = card.voice;
  setWorkshopVoices(old => ({ ...voices, ...old }));
 }
 const intent = intentId ? workshopIntent(intentId) : null;
 const passage = INTENT_PASSAGES.find(p => p.id === passageId);
 const situation = passage?.situation ?? 'Texte libre écrit dans l’atelier.';
 const cards = useMemo(() => !intent || !base ? [] : INTENT_PROVIDERS.map(provider => {
  const voice = resolveCardVoice(provider, game, workshopVoices[provider], providerDefaultVoice(provider));
  const plan = providerPlan(provider, intent, base);
  const key = auditionKey({ text: text.trim(), intent: intent.recipe, provider, voice: voice.voice, plan });
  return { provider, voice, plan, key, available: voice.source !== null };
 }), [intent, base, game, workshopVoices, text]);
 const chosen = cards.filter(card => selected.includes(card.provider));
 const ratedCards = chosen.filter(card => ratings[card.provider]?.key === card.key && ratings[card.provider]?.rating);
 const canSave = storeReady && ratedCards.length > 0 && ratedCards.every(card => ratings[card.provider]!.rating === 5 || ratings[card.provider]!.off.trim()) && !busy && !saving;
 const table = intentResults(document?.intentTrials ?? []);
 function stop() { sequence.current++; runner.current.stop(); setBusy(null); }
 function choosePassage(id: PassageId) { stop(); setPassageId(id); setText(INTENT_PASSAGES.find(p => p.id === id)?.text ?? ''); setStatus(''); }
 function toggle(provider: TTSProviderId, on: boolean) { stop(); setSelected(old => on ? INTENT_PROVIDERS.filter(p => p === provider || old.includes(p)) : old.filter(p => p !== provider)); }
 function goTo(next: number) {
  stop(); if (next === 3 && !selected.length) setSelected(cards.filter(card => card.available).map(card => card.provider));
  setStep(next); setStatus('');
 }
 async function generate(card: (typeof cards)[number]) {
  if (!intent || !card.available || !stillHere()) return;
  stop(); const request = ++sequence.current; setBusy(card.provider); setFailures(old => ({ ...old, [card.provider]: '' }));
  try {
   const evidence = await runner.current.listen(card.key, text.trim(), getProviderById(card.provider), {
    characterKey: 'max', ...(card.voice.voice ? { voiceId: card.voice.voice } : {}), performance: intentPerformance(intent),
    ...(card.provider === 'elevenlabs' ? { auditionModelId: ELEVENLABS_WORKSHOP_MODEL } : {}),
   }, 'rest');
   if (request !== sequence.current || !stillHere()) return;
   setGenerated(old => ({ ...old, [card.provider]: { key: card.key, evidence } }));
  } catch (e) {
   if (request === sequence.current && stillHere() && !(e instanceof DOMException && e.name === 'AbortError')) setFailures(old => ({ ...old, [card.provider]: e instanceof Error ? e.message : String(e) }));
  } finally { if (request === sequence.current && stillHere()) setBusy(null); }
 }
 function rate(card: (typeof cards)[number], patch: Partial<Omit<Rating, 'key'>>) {
  setStatus('Notes modifiées : essai non enregistré.');
  setRatings(old => { const current = old[card.provider]?.key === card.key ? old[card.provider]! : { key: card.key, rating: null, off: '' }; return { ...old, [card.provider]: { ...current, ...patch } }; });
 }
 async function saveTrial() {
  if (!intent || !canSave) return;
  stop(); setSaving(true); setStoreError(''); setStatus('');
  const trial: IntentTrial = {
   id: trialId, environment, createdAt: new Date().toISOString(), character: 'max',
   passage: { id: passageId, situation, text: text.trim(), edited: passage ? text.trim() !== passage.text : false },
   intent: { id: intent.id, label: intent.label, recipe: structuredClone(intent.recipe) },
   cards: chosen.map(card => {
    const done = generated[card.provider]?.key === card.key ? generated[card.provider]! : null;
    const rating = done && ratings[card.provider]?.key === card.key ? ratings[card.provider]! : null;
    return { provider: card.provider, voice: card.voice.voice, voiceSource: card.voice.source ?? 'provider_default', ...(card.plan.model ? { model: card.plan.model } : {}),
     planned: Object.fromEntries(card.plan.parameters.map(p => [p.label, p.value])), ignored: card.plan.ignored,
     evidence: done ? cardEvidence(done.evidence) : null, rating: rating?.rating ?? null, off: rating && rating.rating !== 5 ? rating.off.trim() : '' };
   }),
  };
  try {
   const confirmed = await saveIntentTrial(trial, document, environment);
   if (!stillHere()) return;
   setDocument(confirmed); setTrialId(crypto.randomUUID()); setRatings({});
   setStatus('Essai enregistré et relu dans cette sandbox. Les notes sont des avis : aucun réglage du jeu modifié.');
  } catch (e) { if (stillHere()) setStoreError(e instanceof Error ? e.message : String(e)); }
  finally { if (stillHere()) setSaving(false); }
 }
 async function reload() {
  setStoreError(''); setStoreReady(false);
  try { const value = await readWorkshop(environment); if (stillHere()) { setDocument(value); setStoreReady(true); prefillVoices(value); setStatus('Essais rechargés ; votre brouillon est conservé.'); } }
  catch (e) { if (stillHere()) setStoreError(e instanceof Error ? e.message : String(e)); }
 }
 function resume(trial: IntentTrial) {
  stop(); setPassageId(trial.passage.id); setText(trial.passage.text); setIntentId(trial.intent.id); setSelected(trial.cards.map(c => c.provider)); setRatings({}); setTrialId(crypto.randomUUID()); setStep(4);
  setStatus('Texte, intention et fournisseurs repris sans audio : chaque génération est un nouvel appel.');
 }
 if (environment === 'prod') return <section><h3>Atelier de parole</h3><p>Réservé aux environnements sandbox.</p></section>;
 return <section aria-label="Atelier de parole" className="min-w-0 max-w-5xl space-y-4 break-words">
  <fieldset disabled={saving} className="min-w-0 space-y-4">
  <h3 className="text-xl font-semibold">Atelier de parole — Max</h3>
  <p>Un texte, une émotion, plusieurs fournisseurs côte à côte. Vous notez à l’oreille ; rien ne change dans le jeu. <span className="text-sm text-muted-foreground">{environment}</span></p>
  {error && <p role="alert" className="text-destructive">{error}</p>}
  {status && <p role="status">{status}</p>}
  {!ready && !error && <p>Chargement des fournisseurs…</p>}
  <p ref={heading} tabIndex={-1} aria-label="Étape courante" className="font-medium outline-none">Étape {step} sur 4 — {STEPS[step - 1]}</p>
  {step === 1 && <div className="space-y-3 rounded border p-4">
   <label className="block">Passage de Max<select className="block w-full max-w-full rounded border bg-background p-2" aria-label="Passage" value={passageId} onChange={e => choosePassage(e.target.value as PassageId)}>
    {INTENT_PASSAGES.map(p => <option key={p.id} value={p.id}>{p.id} — {p.title}</option>)}<option value="libre">Texte libre</option></select></label>
   <p className="text-sm"><strong>Situation :</strong> {situation}</p>
   <label className="block">Texte à jouer (modifiable)<Textarea aria-label="Texte à jouer" rows={6} maxLength={1200} value={text} onChange={e => { stop(); setText(e.target.value); }}/></label>
   <p className="text-sm text-muted-foreground">Ce texte sert seulement à l’atelier : il n’est pas injecté dans le jeu et la fiche Notion n’est pas modifiée.</p>
   <Button disabled={!text.trim() || !ready} onClick={() => goTo(2)}>Continuer vers l’émotion</Button>
  </div>}
  {step === 2 && <fieldset className="space-y-2 rounded border p-4"><legend className="px-1 font-medium">Quelle émotion Max doit-il jouer ?</legend>
   {WORKSHOP_INTENTS.map(item => <label key={item.id} className="flex gap-2 rounded border p-2"><input type="radio" name="intent" value={item.id} checked={intentId === item.id} onChange={() => { stop(); setIntentId(item.id); }}/><span><strong>{item.label}</strong> — {item.explanation}<br/><span className="text-sm text-muted-foreground">Recette : {recipeWords(item.recipe)}</span></span></label>)}
   <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => goTo(1)}>Revenir au texte</Button><Button disabled={!intent} onClick={() => goTo(3)}>Continuer vers les fournisseurs</Button></div>
  </fieldset>}
  {step >= 3 && intent && <div className="space-y-1 rounded border p-3 text-sm"><p><strong>{intent.label}</strong> — recette identique sur toutes les cartes : {recipeWords(intent.recipe)}.</p><blockquote className="border-l-2 pl-2">{text.trim()}</blockquote></div>}
  {step === 3 && <fieldset className="space-y-2 rounded border p-4"><legend className="px-1 font-medium">Fournisseurs à comparer</legend>
   <p className="text-sm">Même texte, même intention, même recette neutre. Les réglages natifs et la voix diffèrent par nature : chaque carte les montre.</p>
   {cards.map(card => <div key={card.provider} className="rounded border p-2"><label className="flex gap-2"><input type="checkbox" aria-label={`Comparer ${PROVIDER_LABELS[card.provider]}`} checked={selected.includes(card.provider)} disabled={!card.available} onChange={e => toggle(card.provider, e.target.checked)}/><span><strong>{PROVIDER_LABELS[card.provider]}</strong> — {card.voice.label}</span></label>
    <label className="block text-sm">Voix d’atelier pour Max (identifiant chez {PROVIDER_LABELS[card.provider]}, facultatif)<Input aria-label={`Voix d’atelier ${PROVIDER_LABELS[card.provider]}`} maxLength={500} value={workshopVoices[card.provider] ?? ''} onChange={e => { stop(); setWorkshopVoices(old => ({ ...old, [card.provider]: e.target.value })); }}/></label></div>)}
   <p className="text-sm text-muted-foreground">Une clé absente ou refusée apparaît sur la carte au premier essai ; aucun son n’est simulé. La voix d’atelier ne modifie pas la voix du jeu.</p>
   <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => goTo(2)}>Revenir à l’émotion</Button><Button disabled={!chosen.some(card => card.available)} onClick={() => goTo(4)}>Afficher les cartes côte à côte</Button></div>
  </fieldset>}
  {step === 4 && intent && <div className="space-y-3">
   <p className="text-sm">Un clic = une génération auprès du fournisseur (coût inconnu). Un son déjà généré pendant la séance est rejoué sans nouvel appel. Tous en REST : on compare la voix, pas la latence.</p>
   <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{chosen.map(card => {
    const done = generated[card.provider]?.key === card.key ? generated[card.provider] : undefined;
    const rating = ratings[card.provider]?.key === card.key ? ratings[card.provider] : undefined;
    const label = PROVIDER_LABELS[card.provider];
    return <article key={card.provider} aria-label={`Carte ${label}`} className="min-w-0 space-y-2 rounded border p-3">
     <h4 className="font-semibold">{label}{card.plan.model ? ` · ${card.plan.model}` : ''}</h4>
     <p className="text-sm">{card.voice.label}</p>
     <p className="text-sm"><strong>Recette :</strong> {recipeWords(intent.recipe)}</p>
     <div className="text-sm"><strong>Paramètres appliqués</strong><ul className="list-disc pl-5">{card.plan.parameters.map(p => <li key={p.label}>{p.label} : {String(p.value)}</li>)}</ul></div>
     <div className="text-sm"><strong>Ignoré par ce fournisseur</strong><ul className="list-disc pl-5">{card.plan.ignored.map(item => <li key={item}>{item}</li>)}</ul></div>
     {!card.available ? <p role="note">Indisponible : aucune voix configurée. Ajoutez une voix d’atelier à l’étape 3.</p>
      : <Button disabled={!!busy || saving || !text.trim()} onClick={() => void generate(card)}>{done ? `Réécouter ${label} (sans nouvel appel)` : `Générer et écouter ${label}`}</Button>}
     {busy === card.provider && <Button variant="outline" onClick={stop}>Arrêter</Button>}
     {failures[card.provider] && <p role="alert" className="text-destructive">{label} indisponible ou en échec : {failures[card.provider]}</p>}
     {done && <p className="text-sm">{done.evidence.cached ? 'Rejeu du son de cette séance' : `${done.evidence.providerCalls} requête(s) fournisseur attestée(s)`}{done.evidence.model ? ` · modèle ${done.evidence.model}` : ''}</p>}
     <fieldset disabled={!done} className="space-y-1"><legend className="text-sm font-medium">Est-ce que ça correspond à l’intention ?</legend>
      <div className="flex flex-wrap gap-2">{RATING_LABELS.map((choice, i) => <label key={choice} className="flex items-center gap-1 text-sm"><input type="radio" name={`note-${card.provider}`} aria-label={`Note ${i + 1} ${label}`} checked={rating?.rating === i + 1} onChange={() => rate(card, { rating: i + 1 })}/>{choice}</label>)}</div>
      {!done && <p className="text-xs text-muted-foreground">Générez d’abord le son pour noter.</p>}
      {rating?.rating && rating.rating < 5 && <label className="block text-sm">Qu’est-ce qui est off ? (obligatoire sous 5)<Textarea aria-label={`Ce qui est off ${label}`} maxLength={500} value={rating.off} onChange={e => rate(card, { off: e.target.value })}/></label>}
     </fieldset>
    </article>;
   })}</div>
   <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => goTo(3)}>Revenir aux fournisseurs</Button><Button disabled={!canSave} onClick={() => void saveTrial()}>Enregistrer l’essai et mes notes</Button></div>
   <p className="text-sm text-muted-foreground">Seules les cartes écoutées peuvent être notées. Une note de 5 n’active rien et ne change pas le fournisseur du jeu.</p>
  </div>}
  <section aria-label="Résultats par intention" className="space-y-2 rounded border p-4">
   <h4 className="font-semibold">Résultats : intention × fournisseur</h4>
   <p className="text-sm">Moyenne des notes humaines (nombre d’essais). Aucun juge automatique. Audio non conservé.</p>
   {storeError && <p role="alert">{storeError}</p>}
   {!storeReady ? <p>Lecture non confirmée ; aucune sauvegarde autorisée.</p> : !document?.intentTrials?.length && <p>Aucun essai noté dans cette sandbox.</p>}
   {!!document?.intentTrials?.length && <div className="max-w-full overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Intention</th>{INTENT_PROVIDERS.map(p => <th key={p} className="text-left">{PROVIDER_LABELS[p]}</th>)}</tr></thead>
    <tbody>{WORKSHOP_INTENTS.filter(item => table[item.id]).map(item => <tr key={item.id}><td>{item.label}</td>{INTENT_PROVIDERS.map(p => <td key={p}>{table[item.id][p] ? `${table[item.id][p]!.mean} (${table[item.id][p]!.count})` : '—'}</td>)}</tr>)}</tbody></table></div>}
   <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => void reload()}>Recharger les essais</Button>
    <Button variant="outline" disabled={!document?.intentTrials?.length} onClick={() => save(exportIntentResults(document?.intentTrials ?? [], 'csv'), 'atelier-intentions.csv', 'text/csv;charset=utf-8')}>Exporter le tableau (CSV)</Button>
    <Button variant="outline" disabled={!document?.intentTrials?.length} onClick={() => save(exportIntentResults(document?.intentTrials ?? [], 'json'), 'atelier-intentions.json', 'application/json')}>Exporter le tableau (JSON)</Button></div>
   {document?.intentTrials?.slice(0, 20).map(trial => <details key={trial.id}><summary className="cursor-pointer">{trial.intent.label} · {trial.passage.id} · {trial.cards.filter(c => c.rating !== null).map(c => `${PROVIDER_LABELS[c.provider]} ${c.rating}/5`).join(', ')}</summary><div className="space-y-1 py-2 text-sm"><p>{trial.passage.text}</p>
    {trial.cards.map(c => <p key={c.provider}>{PROVIDER_LABELS[c.provider]} : {c.rating === null ? 'non noté' : `${c.rating}/5`}{c.off ? ` — off : ${c.off}` : ''}</p>)}
    <Button variant="outline" disabled={saving} onClick={() => resume(trial)}>Reprendre ce texte et cette intention</Button></div></details>)}
  </section>
  </fieldset>
  <details onToggle={e => setAdvanced((e.currentTarget as HTMLDetailsElement).open)}><summary className="cursor-pointer">Options avancées — réglages bruts et A/B (AP2), Emma, transports, mapping du jeu et preuves</summary>
   <div className="py-3">{advanced && <SpeechAuditionBench />}</div></details>
 </section>;
}
