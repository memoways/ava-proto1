import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/experienceOrchestration', () => ({ listCharacterRuntimeProfiles: vi.fn(async () => [
 { character_key: 'max', display_name: 'Max', rugosite: 3, tts_provider: 'gradium', tts_voice_id: 'voice-max' },
 { character_key: 'emma', display_name: 'Emma', rugosite: 2, tts_provider: 'gradium', tts_voice_id: 'voice-emma' },
]) }));
vi.mock('@/services/tts/speechWorkshop', async importOriginal => ({
 ...await importOriginal<typeof import('@/services/tts/speechWorkshop')>(),
 loadSpeechWorkshopReferences: vi.fn(async () => ({ copy: 'copy-v1 · copie sandbox', orchestration: 'v7', compiler: 'optimized_v3', llm: { LLM_MODEL: 'model-character', LLM_MODEL_GM: 'model-gm', LLM_TEMPERATURE: 0.7 }, compilerSource: 'sandbox', llmSource: 'sandbox', ttsSource: 'sandbox' })),
}));
vi.mock('@/services/characterPromptService', () => ({ loadCharacterPromptByName: vi.fn(async (name: string) => ({ speech_states: [
 { name: name === 'Max' ? 'Retenu' : 'Action', description: name === 'Max' ? 'Retient les mots' : 'Cherche à agir' },
] })) }));
vi.mock('@/services/tts/speechPerformanceSettings', async importOriginal => {
 const actual = await importOriginal<typeof import('@/services/tts/speechPerformanceSettings')>();
 return { ...actual, readSavedSpeechPerformance: vi.fn(async () => ({ ...actual.EMPTY_SPEECH_PERFORMANCE, enabled: true, version: 'saved-v1', byCharacter: {
 max: { Retenu: actual.proposeSpeechMapping('Retenu', 'silence') }, emma: { Action: actual.proposeSpeechMapping('Action', 'rapide') },
 } })), saveSpeechPerformanceSettings: vi.fn() };
});
vi.mock('@/services/tts/registry', () => ({ getProviderById: vi.fn(() => ({ id: 'gradium' })) }));
import { setActiveEnvironment } from '@/services/environmentContext';
import { SpeechAuditionRunner } from '@/services/tts/speechAudition';
import { saveSpeechPerformanceSettings } from '@/services/tts/speechPerformanceSettings';
import SpeechAuditionBench from './SpeechAuditionBench';
import { readWorkshop, saveWorkshopComparison } from '@/services/tts/speechWorkshopStore';
vi.mock('@/services/tts/providerSettings', async original => {
 const actual = await original<typeof import('@/services/tts/providerSettings')>();
 return { ...actual, loadFishSettingsFromDB: vi.fn(async () => ({})), loadInworldSettingsFromDB: vi.fn(async () => ({})), loadCartesiaSettingsFromDB: vi.fn(async () => ({})) };
});
vi.mock('@/services/tts/speechWorkshopStore', async original => ({ ...await original<typeof import('@/services/tts/speechWorkshopStore')>(), readWorkshop: vi.fn(async () => null), saveWorkshopComparison: vi.fn() }));

const evidence = { requests: [{ transport: 'rest' as const, body: { json_config: { temp: 0.7, padding_bonus: 0.5 } } }], transport: 'rest' as const, cached: false, providerCalls: 1, pauseRendering: 'disabled' };
async function ready() {
 const mounted = render(<MemoryRouter><SpeechAuditionBench /></MemoryRouter>);
 await waitFor(() => expect(screen.getByText(/copy-v1/)).toBeInTheDocument());
 return mounted;
}
function choose() { fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Retenu' } }); fireEvent.click(screen.getByRole('button', { name: 'Continuer vers la version actuelle' })); }
async function current() { fireEvent.click(screen.getByRole('button', { name: 'Écouter la version actuelle' })); await screen.findByRole('button', { name: 'Écouter l’essai' }); }
async function trial() { fireEvent.click(screen.getByRole('button', { name: 'Écouter l’essai' })); await screen.findByRole('button', { name: 'Enregistrer la comparaison et mon avis' }); }
describe('AP2 — one guided workshop and saved comparisons', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); vi.mocked(readWorkshop).mockResolvedValue(null); vi.mocked(saveWorkshopComparison).mockImplementation(async (value, _baseline, environment) => ({ schemaVersion: 1, version: 'saved-1', environment, comparisons: [value] })); });
 it('opens with one main action, explicit state, closed details and no audio or writes', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready();
  expect(screen.getByRole('button', { name: 'Continuer vers la version actuelle' })).toBeDisabled();
  expect(screen.getByLabelText('État de la réplique')).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Écouter la version actuelle' })).not.toBeInTheDocument();
  for (const summary of screen.getAllByText(/Options avancées|Références et différences|Preuves et JSON|Configuration persistante du jeu/)) expect(summary.closest('details')).not.toHaveAttribute('open');
  choose(); expect(screen.getByRole('button', { name: 'Écouter la version actuelle' })).toBeEnabled();
  expect(listen).not.toHaveBeenCalled(); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled(); expect(saveWorkshopComparison).not.toHaveBeenCalled();
 });
 it('compares identical words, state, voice and transport with only one bounded change', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready(); fireEvent.change(screen.getByLabelText('Transport audition'), { target: { value: 'rest' } }); choose(); await current();
  expect(screen.getByLabelText('Différence comparée')).toHaveTextContent('version actuelle');
  fireEvent.change(screen.getByLabelText('Valeur de l’essai'), { target: { value: '-0.4' } });
  await trial(); expect(listen).toHaveBeenCalledTimes(2);
  const [a, b] = listen.mock.calls;
  expect(b[1]).toEqual(a[1]); expect(b[3].voiceId).toEqual(a[3].voiceId); expect(b[3].performance).toEqual(a[3].performance);
  expect(b[3].speechAudition).toEqual({ ...a[3].speechAudition, gradium: { ...a[3].speechAudition!.gradium, paddingBonus: -0.4 } });
  expect(a[4]).toBe('rest'); expect(b[4]).toBe('rest');
  fireEvent.click(screen.getByRole('button', { name: 'Réécouter ou modifier l’essai' }));
  fireEvent.change(screen.getByLabelText('Réglage testé'), { target: { value: 'temp' } });
  fireEvent.change(screen.getByLabelText('Valeur de l’essai'), { target: { value: '90' } }); expect(screen.getByLabelText('Valeur de l’essai')).toHaveValue(1.4);
 });
 it('saves notes explicitly, reloads after closing and restores only a draft with changed references warning', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  const mounted = await ready(); choose(); await current(); await trial();
  fireEvent.change(screen.getByLabelText('Nom de la comparaison'), { target: { value: 'Max moins lent' } });
  fireEvent.change(screen.getByLabelText('Pauses / rythme'), { target: { value: 'plus naturel' } });
  fireEvent.change(screen.getByLabelText('Décision humaine'), { target: { value: 'preferred' } });
  expect(saveWorkshopComparison).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la comparaison et mon avis' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('enregistrée et relue'));
  expect(saveWorkshopComparison).toHaveBeenCalledWith(expect.objectContaining({ name: 'Max moins lent', notes: expect.objectContaining({ rhythm: 'plus naturel' }), decision: 'preferred', cost: null }), null, 'sandbox-ulrich');
  const value = vi.mocked(saveWorkshopComparison).mock.calls[0][0];
  const stored = { schemaVersion: 1 as const, environment: 'sandbox-ulrich', version: 'saved-1', comparisons: [{ ...value, references: { ...value.references, copy: 'ancienne copie' } }] };
  mounted.unmount(); vi.mocked(readWorkshop).mockResolvedValue(stored); await ready();
  fireEvent.click(screen.getByText(/Max moins lent · max/));
  fireEvent.click(screen.getByRole('button', { name: 'Charger comme brouillon' }));
  expect(listen).toHaveBeenCalledTimes(2); expect(saveWorkshopComparison).toHaveBeenCalledOnce();
  expect(screen.getByText(/Les références actuelles diffèrent/)).toBeInTheDocument();
  expect(screen.getByText(/Brouillon chargé sans audio/)).toBeInTheDocument(); expect(screen.getByLabelText('État de la réplique')).toHaveValue('Retenu');
  expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
 });
 it('keeps failed persistence unconfirmed and reloads the baseline while preserving the draft', async () => {
  vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  vi.mocked(saveWorkshopComparison).mockRejectedValue(new Error('Modification concurrente : écriture refusée.'));
  await ready(); choose(); await current(); await trial();
  fireEvent.change(screen.getByLabelText('Nom de la comparaison'), { target: { value: 'Brouillon intact' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la comparaison et mon avis' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('concurrente'));
  expect(screen.queryByText(/Comparaison enregistrée et relue/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Recharger les variantes' }));
  await waitFor(() => expect(readWorkshop).toHaveBeenCalledTimes(2)); expect(screen.getByLabelText('Nom de la comparaison')).toHaveValue('Brouillon intact');
 });
 it('keeps Emma, other providers, isolated voices, finalists and explicit live mapping in the same advanced workshop', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready(); fireEvent.change(screen.getByLabelText('Personnage du banc'), { target: { value: 'emma' } });
  expect(screen.getByLabelText('Rugosité du banc')).toHaveValue('2'); expect(screen.getByLabelText('Voix emma gradium')).toHaveValue('voice-emma');
  expect(screen.getByLabelText('État de la réplique')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Fournisseur du banc'), { target: { value: 'fish' } });
  fireEvent.change(screen.getByLabelText('Voix emma fish'), { target: { value: 'isolated-fish' } });
  fireEvent.change(screen.getByLabelText('Réplique du banc'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Action' } });
  expect(screen.getByRole('button', { name: 'Continuer vers la version actuelle' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Étape audition'), { target: { value: 'finalists' } }); fireEvent.click(screen.getByLabelText('Finaliste E3'));
  expect(screen.getByRole('button', { name: 'Continuer vers la version actuelle' })).toBeEnabled();
  expect(listen).not.toHaveBeenCalled(); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
  vi.mocked(saveSpeechPerformanceSettings).mockRejectedValue(new Error('Relecture impossible'));
  fireEvent.change(screen.getByLabelText('Pauses Action'), { target: { value: 'long' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder le mapping du jeu sandbox et relire', hidden: true }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Relecture impossible'));
  expect(saveWorkshopComparison).not.toHaveBeenCalled();
 });
 it('separates A2 pauses, preserves WS fallback evidence and stops late callbacks on edits', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue({ ...evidence, transport: 'rest_fallback' });
  await ready(); fireEvent.change(screen.getByLabelText('Type de comparaison'), { target: { value: 'pauses' } });
  expect(screen.getByLabelText('Transport audition')).toHaveValue('websocket'); expect(screen.getByLabelText('Transport audition')).toBeDisabled();
  choose(); await current(); await trial();
  expect(listen.mock.calls[0][3].speechAudition?.settings.gradiumPausesEnabled).toBe(false);
  expect(listen.mock.calls[1][3].speechAudition?.settings.gradiumPausesEnabled).toBe(true);
  expect(screen.getAllByText(/Repli REST : cette écoute/)).toHaveLength(2);
  let resolve!: (value: typeof evidence) => void;
  listen.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  fireEvent.click(screen.getByRole('button', { name: 'Réécouter la version actuelle' })); fireEvent.click(screen.getByRole('button', { name: 'Écouter la version actuelle' }));
  fireEvent.change(screen.getByLabelText('Personnage du banc'), { target: { value: 'emma' } });
  await act(async () => resolve(evidence)); expect(screen.getByLabelText('Étape courante')).toHaveTextContent('Étape 1');
  expect(screen.queryByRole('button', { name: 'Enregistrer la comparaison et mon avis' })).not.toBeInTheDocument();
 });
 it('auditions another provider with an isolated voice and only an emotion change in the trial', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready(); fireEvent.change(screen.getByLabelText('Fournisseur du banc'), { target: { value: 'fish' } });
  fireEvent.change(screen.getByLabelText('Voix max fish'), { target: { value: 'isolated-fish' } });
  choose(); await current();
  fireEvent.change(screen.getByLabelText('Réglage de l’intention'), { target: { value: 'emotion' } });
  fireEvent.change(screen.getByLabelText('Intention de l’essai'), { target: { value: 'angry' } });
  await trial();
  expect(listen).toHaveBeenCalledTimes(2);
  expect(listen.mock.calls[0][3].voiceId).toBe('isolated-fish');
  expect(listen.mock.calls[1][3].performance).toMatchObject({ emotion: 'angry', speechState: 'Retenu' });
  fireEvent.change(screen.getByLabelText('Nom de la comparaison'), { target: { value: 'Émotion isolée' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la comparaison et mon avis' }));
  await waitFor(() => expect(saveWorkshopComparison).toHaveBeenCalledOnce());
  const c = vi.mocked(saveWorkshopComparison).mock.calls[0][0];
  expect(c.b).toEqual({ ...c.a, settings: { ...c.a.settings, byCharacter: { max: { Retenu: { ...c.a.settings.byCharacter.max.Retenu, emotion: 'angry' } } } } });
  expect(c.references.requestedParameters).not.toContain('secret'); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
 });
 it('blocks production and clears the shared audio owner on unmount', async () => {
  const clear = vi.spyOn(SpeechAuditionRunner.prototype, 'clear');
  const mounted = await ready(); mounted.unmount(); expect(clear).toHaveBeenCalled();
  setActiveEnvironment('prod'); render(<MemoryRouter><SpeechAuditionBench /></MemoryRouter>);
  expect(screen.getByText('Réservé aux environnements sandbox.')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
 });
 it('keeps read failures distinct from an empty library and never saves in that state', async () => {
  vi.mocked(readWorkshop).mockRejectedValue(new Error('Lecture de l’atelier indisponible'));
  await ready(); expect(screen.getByRole('alert')).toHaveTextContent('indisponible');
  expect(screen.queryByText('Aucune comparaison enregistrée dans cette sandbox.')).not.toBeInTheDocument(); expect(saveWorkshopComparison).not.toHaveBeenCalled();
 });
});
