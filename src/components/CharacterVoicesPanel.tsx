import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles, updateCharacterRuntimeVoice, type CharacterRuntimeProfile } from '@/services/experienceOrchestration';
import {
 VOICE_CHARACTERS, VOICE_PROVIDERS, loadCharacterVoicesFromDB, profilesToSync, saveCharacterVoices, seedFromProfiles, voiceIdError,
 type CharacterVoiceCatalogue,
} from '@/services/tts/characterVoices';
import { PROVIDER_LABELS } from '@/services/tts/speechIntentWorkshop';

/** Technique → Configuration TTS: the single place where character voice IDs are entered. */
export default function CharacterVoicesPanel() {
 const environment = getActiveEnvironment();
 const [catalogue, setCatalogue] = useState<CharacterVoiceCatalogue>({});
 const [saved, setSaved] = useState<CharacterVoiceCatalogue>({});
 const [profiles, setProfiles] = useState<CharacterRuntimeProfile[]>([]);
 const [ready, setReady] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const [status, setStatus] = useState('');
 useEffect(() => {
  let current = true;
  Promise.all([loadCharacterVoicesFromDB(), listCharacterRuntimeProfiles()]).then(([stored, list]) => {
   if (!current) return;
   setSaved(stored); setCatalogue(seedFromProfiles(stored, list)); setProfiles(list); setReady(true);
  }).catch(e => { if (current) setError(e instanceof Error ? e.message : String(e)); });
  return () => { current = false; };
 }, [environment]);
 const errors = VOICE_CHARACTERS.flatMap(({ key }) => VOICE_PROVIDERS.map(p => voiceIdError(catalogue[key]?.[p] ?? '')).filter(Boolean));
 const dirty = JSON.stringify(catalogue) !== JSON.stringify(saved);
 function patch(character: string, provider: (typeof VOICE_PROVIDERS)[number], value: string) {
  setStatus(''); setCatalogue(old => ({ ...old, [character]: { ...old[character], [provider]: value } }));
 }
 async function save() {
  setSaving(true); setError(''); setStatus('');
  try {
   const confirmed = await saveCharacterVoices(catalogue);
   const updates = profilesToSync(confirmed, profiles);
   for (const update of updates) await updateCharacterRuntimeVoice(update.id, update.voice);
   const list = await listCharacterRuntimeProfiles();
   setSaved(confirmed); setCatalogue(seedFromProfiles(confirmed, list)); setProfiles(list);
   const message = updates.length
    ? `Voix enregistrées et relues. Voix du jeu mise à jour pour : ${updates.map(u => VOICE_CHARACTERS.find(c => c.key === u.character)?.label ?? u.character).join(', ')}.`
    : 'Voix enregistrées et relues. Aucune voix du jeu à changer.';
   setStatus(message); toast.success(message);
  } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  finally { setSaving(false); }
 }
 return <section aria-label="Voix des personnages" className="space-y-3 rounded-lg border p-4">
  <div><h3 className="text-base font-semibold">🧑‍🎤 Voix des personnages par fournisseur</h3>
   <p className="text-xs text-muted-foreground">Seul endroit où saisir les Voice ID ({environment}). Réglages des personnages et atelier de parole les reprennent ; à la sauvegarde, la voix du jeu suit l’ID du fournisseur choisi pour chaque personnage.</p></div>
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  {status && <p role="status" className="text-sm">{status}</p>}
  {!ready && !error ? <p className="text-sm text-muted-foreground">Chargement des voix…</p> : <div className="max-w-full overflow-x-auto">
   <table className="w-full min-w-[640px] text-sm"><thead><tr><th className="p-1 text-left">Personnage</th>{VOICE_PROVIDERS.map(p => <th key={p} className="p-1 text-left">{PROVIDER_LABELS[p]}</th>)}</tr></thead>
    <tbody>{VOICE_CHARACTERS.map(({ key, label }) => { const profile = profiles.find(p => p.character_key === key); return <tr key={key}>
     <td className="p-1 align-top"><strong>{label}</strong>{profile?.tts_provider && <div className="text-xs text-muted-foreground">Jeu : {PROVIDER_LABELS[profile.tts_provider as keyof typeof PROVIDER_LABELS] ?? profile.tts_provider}</div>}</td>
     {VOICE_PROVIDERS.map(provider => { const value = catalogue[key]?.[provider] ?? ''; const problem = voiceIdError(value); return <td key={provider} className="p-1 align-top">
      <Input aria-label={`Voice ID ${label} ${PROVIDER_LABELS[provider]}`} aria-invalid={!!problem} className="h-8 text-xs" maxLength={220} value={value} placeholder="—" onChange={e => patch(key, provider, e.target.value)}/>
      {problem && <p className="text-xs text-destructive">{problem}</p>}</td>; })}
    </tr>; })}</tbody></table></div>}
  <Button size="sm" disabled={!ready || saving || !dirty || errors.length > 0} onClick={() => void save()}>Enregistrer les voix</Button>
 </section>;
}
