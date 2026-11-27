import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useUnsavedChanges } from '@/components/admin/unsaved/context';
import { getActiveEnvironment } from '@/services/environmentContext';
import type { PerformanceIntensity } from '@/services/tts/performanceIntent';
import { heatedStateName, previewHeatedSequence } from '@/services/tts/speechPacingPreview';
import { readSavedSpeechPerformance, resolveCharacterPacing, saveSpeechPerformanceSettings, type CharacterPacing, type SpeechFlareMode, type SpeechPerformanceSettings } from '@/services/tts/speechPerformanceSettings';

const CHARACTERS = [{ key: 'max', name: 'Max' }, { key: 'emma', name: 'Emma' }];
const INTENSITIES = ['0 — douce', '1 — normale', '2 — forte'];
const FLARES: Record<SpeechFlareMode, { label: string; detail: string }> = {
  never: { label: 'Jamais', detail: 'Les états chauds sont toujours joués retenus, sans balise [urgent] ou [angry].' },
  contained: { label: 'Contenus', detail: 'Un moment chaud de temps en temps, avec sa balise, sans dépasser l’intensité maximale.' },
  full: { label: 'Éclats forts', detail: 'Un moment chaud de temps en temps, qui peut monter à l’intensité 2.' },
};

/** Per-character voice temper of the game: ceiling, flare-ups, frequency and ramp. */
export default function SpeechPacingPanel() {
  const environment = getActiveEnvironment();
  const [saved, setSaved] = useState<SpeechPerformanceSettings | null>(null);
  const [draft, setDraft] = useState<SpeechPerformanceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  const currentEnvironment = useRef(environment); currentEnvironment.current = environment;

  useEffect(() => {
    if (environment === 'prod') return;
    let current = true;
    setSaved(null); setDraft(null); setError(''); setStatus('');
    readSavedSpeechPerformance(environment)
      .then(value => { if (current) { setSaved(value); setDraft(structuredClone(value)); } })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : String(e)); });
    return () => { current = false; };
  }, [environment, attempt]);

  const dirty = !!saved && !!draft && JSON.stringify(saved.pacing ?? {}) !== JSON.stringify(draft.pacing ?? {});

  async function save() {
    if (!saved || !draft) return false;
    setSaving(true); setError(''); setStatus('');
    try {
      const confirmed = await saveSpeechPerformanceSettings(draft, saved, environment);
      if (currentEnvironment.current !== environment) return false;
      setSaved(confirmed); setDraft(structuredClone(confirmed));
      setStatus('Enregistré et relu. Appliqué au prochain appel.');
      return true;
    } catch (e) {
      if (currentEnvironment.current === environment) setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally { setSaving(false); }
  }

  useUnsavedChanges({ dirty, label: 'Tempérament vocal des personnages', saving, save });

  function patch(key: string, change: Partial<CharacterPacing>) {
    setStatus('');
    setDraft(old => old && { ...old, pacing: { ...old.pacing, [key]: { ...resolveCharacterPacing(old, key), ...change } } });
  }

  if (environment === 'prod') return null;
  return <section aria-label="Tempérament vocal en jeu" className="mb-6 min-w-0 max-w-3xl space-y-4 rounded border p-4 [&_select]:block [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:bg-background [&_select]:p-2">
    <h3 className="text-xl font-semibold">Tempérament vocal en jeu</h3>
    <p className="text-sm">Jusqu’où la voix peut chauffer, et à quel rythme. Ne change ni le texte, ni la fiche, ni les essais de l’atelier. <span className="text-muted-foreground">{environment}</span></p>
    {error && <p role="alert" className="text-destructive">{error} <Button variant="outline" size="sm" onClick={() => setAttempt(n => n + 1)}>Recharger</Button></p>}
    {!draft && !error && <p role="status">Chargement…</p>}
    {draft && <>
      <div className="grid gap-4 sm:grid-cols-2">{CHARACTERS.map(({ key, name }) => {
        const rules = resolveCharacterPacing(draft, key);
        const state = heatedStateName(draft, key);
        return <fieldset key={key} disabled={saving} className="min-w-0 space-y-3 rounded border p-3">
          <legend className="px-1 font-semibold">{name}</legend>
          <label className="block text-sm">Moments chauds
            <select aria-label={`Moments chauds ${name}`} value={rules.flares} onChange={e => patch(key, { flares: e.target.value as SpeechFlareMode })}>
              {Object.entries(FLARES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{FLARES[rules.flares].detail}</p>
          <label className="block text-sm">Intensité maximale (hors éclat fort)
            <select aria-label={`Intensité maximale ${name}`} value={rules.ceiling} onChange={e => patch(key, { ceiling: Number(e.target.value) as PerformanceIntensity })}>
              {INTENSITIES.map((label, value) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm">Au plus un moment chaud toutes les … répliques
            <Input aria-label={`Fréquence ${name}`} type="number" min="1" max="20" step="1" disabled={rules.flares === 'never'} value={rules.window}
              onChange={e => patch(key, { window: Math.max(1, Math.min(20, Math.round(Number(e.target.value)) || 1)) })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" aria-label={`Montée progressive ${name}`} checked={rules.ramp} onChange={e => patch(key, { ramp: e.target.checked })} />
            Montée progressive (un cran par réplique au plus)
          </label>
          {state && <div className="text-sm"><p>Si {name} choisit « {state} » à chaque réplique :</p>
            <ol aria-label={`Aperçu ${name}`} className="list-inside list-decimal">{previewHeatedSequence(draft, key, state).map(step =>
              <li key={step.reply}>{step.kind}, intensité {step.intensity}</li>)}</ol></div>}
        </fieldset>;
      })}</div>
      <p className="text-sm text-muted-foreground">La façon de s’emporter (émotion, débit, instruction de chaque état) se règle plus bas : Options avancées → Configuration persistante du jeu.</p>
      <Button disabled={!dirty || saving} onClick={() => void save()}>Enregistrer le tempérament vocal</Button>
      {status && <p role="status">{status}</p>}
    </>}
  </section>;
}
