import { supabase } from '@/integrations/supabase/client';
import { getActiveEnvironment } from '../environmentContext';
import { getGameplaySettings, getLLMSettings, hydrateAllSettings } from '../settingsService';
import { loadGradiumSettingsFromDB, resolveGradiumSettings, type GradiumSettings } from './providerSettings';

/** Read-only reference panel. Never loads or exports full editorial / GM prompts. */
export async function loadSpeechWorkshopReferences(characterId?: string) {
 const environment = getActiveEnvironment();
 if (environment === 'prod') throw new Error('Atelier réservé à la sandbox');
 await Promise.all([hydrateAllSettings({ readOnly: true }), loadGradiumSettingsFromDB()]);
 const [copy, published, settings] = await Promise.all([
  characterId ? supabase.from('character_prompts').select('updated_at,environment_id').eq('character_id', characterId)
   .in('environment_id', [environment, 'prod']) : Promise.resolve({ data: null, error: null }),
  supabase.from('experience_orchestration_versions' as never).select('version_number,published_at').eq('environment_id', environment).eq('status', 'published')
   .then(({ data, error }) => ({ data: data as Array<{ version_number: number; published_at: string | null }> | null, error })),
  supabase.from('admin_settings').select('key,environment_id').in('key', ['ava_llm_settings', 'ava_gameplay_settings', 'ava_tts_settings_gradium'])
   .in('environment_id', [environment, 'prod']),
 ]);
 if (getActiveEnvironment() !== environment) throw new Error('Environnement modifié pendant le chargement');
 const copied = copy.data?.find(row => row.environment_id === environment) ?? copy.data?.[0];
 const source = (key: string) => settings.error ? 'source inconnue (lecture indisponible)' : settings.data?.some(row => row.key === key && row.environment_id === environment)
  ? 'source sandbox disponible ; valeurs client chargées, défauts/repli possibles' : settings.data?.some(row => row.key === key && row.environment_id === 'prod')
  ? 'source production disponible ; repli client, défauts complétés' : 'repli local / valeurs par défaut';
 return {
  copy: copy.error ? 'inconnue (lecture indisponible)' : copied ? `${copied.updated_at ?? 'date inconnue'} · ${copied.environment_id === environment ? 'copie sandbox' : 'repli production'}` : 'copie inconnue',
  orchestration: published.error ? 'inconnue (lecture indisponible)' : published.data?.length === 1 ? `v${published.data[0].version_number} · ${published.data[0].published_at ?? 'date inconnue'}` : 'aucune version publiée unique disponible',
  compiler: getGameplaySettings().MAX_PROMPT_VARIANT,
  llm: getLLMSettings(), compilerSource: source('ava_gameplay_settings'), llmSource: source('ava_llm_settings'), ttsSource: source('ava_tts_settings_gradium'),
 };
}
export type WorkshopReferences = Awaited<ReturnType<typeof loadSpeechWorkshopReferences>>;
export const VOCAL_CONTROLS = {
 paddingBonus: { label: 'Rythme global (padding_bonus)', min: -4, max: 4, step: 0.2 },
 temp: { label: 'Variabilité (température)', min: 0, max: 1.4, step: 0.1 },
 cfgCoef: { label: 'Fidélité à la voix (cfg_coef)', min: 1, max: 4, step: 0.1 },
} as const;
export type VocalControl = keyof typeof VOCAL_CONTROLS;
export function proposePaddingComparison(value: number): number { return value !== 0 ? 0 : 0.2; }
export function currentGradiumSnapshot(character: string): GradiumSettings { return structuredClone(resolveGradiumSettings(character)); }
