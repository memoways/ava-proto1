import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), hydrate: vi.fn(async () => {}), gradium: vi.fn(async () => ({})) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('../settingsService', () => ({ hydrateAllSettings: mocks.hydrate, getGameplaySettings: () => ({ MAX_PROMPT_VARIANT: 'optimized_v3' }), getLLMSettings: () => ({ LLM_MODEL: 'loaded-model' }) }));
vi.mock('./providerSettings', () => ({ loadGradiumSettingsFromDB: mocks.gradium, resolveGradiumSettings: () => ({ paddingBonus: 0.2 }) }));
import { setActiveEnvironment } from '../environmentContext';
import { loadSpeechWorkshopReferences, proposePaddingComparison } from './speechWorkshop';
describe('AP1 — read-only references and provenance', () => {
 beforeEach(() => { vi.clearAllMocks(); setActiveEnvironment('sandbox-ulrich'); });
 function database(failed = false) {
  mocks.from.mockImplementation((table: string) => {
   const result = { data: table === 'character_prompts' ? [{ updated_at: 'copy-date', environment_id: 'prod' }]
    : table === 'experience_orchestration_versions' ? [{ version_number: 7, published_at: 'published-date' }]
    : [{ key: 'ava_llm_settings', environment_id: 'sandbox-ulrich' }, { key: 'ava_tts_settings_gradium', environment_id: 'prod' }], error: failed ? new Error('unavailable') : null };
   const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), then: Promise.resolve(result).then.bind(Promise.resolve(result)) };
   query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query);
   return query;
  });
 }
 it('hydrates voice settings before capture and distinguishes sandbox, fallback and missing references', async () => {
  database();
  const refs = await loadSpeechWorkshopReferences('max-id');
  expect(mocks.hydrate).toHaveBeenCalledOnce(); expect(mocks.gradium).toHaveBeenCalledOnce();
  expect(refs).toMatchObject({ copy: 'copy-date · repli production', orchestration: 'v7 · published-date', compiler: 'optimized_v3' });
  expect(refs.llmSource).toContain('sandbox'); expect(refs.ttsSource).toContain('production'); expect(refs.compilerSource).toContain('défaut');
  const published = mocks.from.mock.results[1].value;
  expect(published.select).toHaveBeenCalledWith('version_number,published_at');
  expect(published.eq).toHaveBeenCalledWith('environment_id', 'sandbox-ulrich');
 });
 it('shows unavailable reads as unknown rather than inventing versions', async () => {
  database(true); const refs = await loadSpeechWorkshopReferences('max-id');
  expect(refs.copy).toContain('inconnue'); expect(refs.orchestration).toContain('inconnue'); expect(refs.ttsSource).toContain('inconnue');
 });
 it('refuses production before reads and detects an environment changed during hydration', async () => {
  setActiveEnvironment('prod'); await expect(loadSpeechWorkshopReferences()).rejects.toThrow('sandbox'); expect(mocks.from).not.toHaveBeenCalled();
  setActiveEnvironment('sandbox-ulrich'); database();
  mocks.hydrate.mockImplementationOnce(async () => { setActiveEnvironment('sandbox-romed'); });
  await expect(loadSpeechWorkshopReferences()).rejects.toThrow('Environnement modifié');
 });
 it('proposes current padding against zero, or a bounded 0.2 step when current is zero', () => {
  expect(proposePaddingComparison(0.2)).toBe(0); expect(proposePaddingComparison(-4)).toBe(0); expect(proposePaddingComparison(0)).toBe(0.2);
 });
});
