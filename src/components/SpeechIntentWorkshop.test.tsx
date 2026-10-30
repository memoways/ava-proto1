import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/experienceOrchestration', () => ({ listCharacterRuntimeProfiles: vi.fn(async () => [
 { character_key: 'max', display_name: 'Max', rugosite: 3, tts_provider: 'gradium', tts_voice_id: 'voice-max' },
]) }));
vi.mock('@/services/tts/registry', () => ({ getProviderById: vi.fn((id: string) => ({ id })) }));
vi.mock('@/services/tts/providerSettings', async original => {
 const actual = await original<typeof import('@/services/tts/providerSettings')>();
 return { ...actual, loadFishSettingsFromDB: vi.fn(async () => ({})), loadInworldSettingsFromDB: vi.fn(async () => ({})), loadCartesiaSettingsFromDB: vi.fn(async () => ({})) };
});
vi.mock('@/services/tts/speechWorkshopStore', async original => ({ ...await original<typeof import('@/services/tts/speechWorkshopStore')>(), readWorkshop: vi.fn(async () => null), saveIntentTrial: vi.fn() }));
vi.mock('./SpeechAuditionBench', () => ({ default: () => <p>Banc A/B AP2 monté</p> }));
vi.mock('@/services/tts/characterVoices', async original => ({ ...await original<typeof import('@/services/tts/characterVoices')>(), loadCharacterVoicesFromDB: vi.fn(async () => ({})) }));
import { setActiveEnvironment } from '@/services/environmentContext';
import { SpeechAuditionRunner } from '@/services/tts/speechAudition';
import { INTENT_PASSAGES } from '@/services/tts/speechIntentWorkshop';
import { readWorkshop, saveIntentTrial, type WorkshopDocument } from '@/services/tts/speechWorkshopStore';
import { loadCharacterVoicesFromDB } from '@/services/tts/characterVoices';
import SpeechIntentWorkshop from './SpeechIntentWorkshop';

const heard = { requests: [{ transport: 'rest' as const, body: { voice_id: 'x' } }], transport: 'rest' as const, cached: false, providerCalls: 1 };
async function toCards(providers: string[]) {
 render(<MemoryRouter><SpeechIntentWorkshop /></MemoryRouter>);
 const next = await screen.findByRole('button', { name: 'Continuer vers l’émotion' });
 await waitFor(() => expect(next).toBeEnabled());
 fireEvent.click(next);
 fireEvent.click(screen.getByRole('radio', { name: /Peur — La peur accélère/ }));
 fireEvent.click(screen.getByRole('button', { name: 'Continuer vers les fournisseurs' }));
 for (const box of screen.getAllByRole('checkbox')) if ((box as HTMLInputElement).checked) fireEvent.click(box);
 for (const name of providers) fireEvent.click(screen.getByRole('checkbox', { name: `Comparer ${name}` }));
 fireEvent.click(screen.getByRole('button', { name: 'Afficher les cartes côte à côte' }));
}
describe('AP4 — intent workshop', () => {
 beforeEach(() => {
  localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); vi.restoreAllMocks();
  vi.mocked(readWorkshop).mockResolvedValue(null);
  vi.mocked(saveIntentTrial).mockImplementation(async (trial, _baseline, environment) => ({ schemaVersion: 1, version: 'v1', environment, comparisons: [], intentTrials: [trial] }) as WorkshopDocument);
 });
 it('opens on the text step with the situation, no audio, and the AP2 bench folded and unmounted', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen');
  render(<MemoryRouter><SpeechIntentWorkshop /></MemoryRouter>);
  expect(await screen.findByLabelText('Étape courante')).toHaveTextContent('Étape 1 sur 4 — Texte à jouer');
  expect(screen.getByLabelText('Texte à jouer')).toHaveValue(INTENT_PASSAGES[0].text);
  expect(screen.getByText(/Le bénévole de la cellule vient de se présenter/)).toBeInTheDocument();
  expect(screen.queryByText('Banc A/B AP2 monté')).not.toBeInTheDocument();
  expect(screen.getByText(/Options avancées — réglages bruts/).closest('details')).not.toHaveAttribute('open');
  fireEvent.change(screen.getByLabelText('Passage'), { target: { value: 'libre' } });
  expect(screen.getByLabelText('Texte à jouer')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Continuer vers l’émotion' })).toBeDisabled();
  expect(listen).not.toHaveBeenCalled();
 });
 it('flags a provider without voice as unavailable instead of simulating it', async () => {
  render(<MemoryRouter><SpeechIntentWorkshop /></MemoryRouter>);
  const next = await screen.findByRole('button', { name: 'Continuer vers l’émotion' }); await waitFor(() => expect(next).toBeEnabled()); fireEvent.click(next);
  fireEvent.click(screen.getByRole('radio', { name: /Posé/ })); fireEvent.click(screen.getByRole('button', { name: 'Continuer vers les fournisseurs' }));
  expect(screen.getByRole('checkbox', { name: 'Comparer Fish Audio' })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: 'Comparer Fish Audio' }).closest('div')).toHaveTextContent('Indisponible : aucune voix configurée');
  expect(screen.getByRole('checkbox', { name: 'Comparer Gradium' })).toBeChecked();
  expect(screen.getByRole('link', { name: 'Technique → Configuration TTS' })).toBeInTheDocument();
 });
 it('uses Max’s voices from the TTS configuration for every provider', async () => {
  vi.mocked(loadCharacterVoicesFromDB).mockResolvedValueOnce({ max: { fish: 'max-fish', gradium: 'max-gradium-v2' } });
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(heard);
  await toCards(['Gradium', 'Fish Audio']);
  expect(screen.getByRole('article', { name: 'Carte Fish Audio' })).toHaveTextContent('Voix de Max (configuration TTS)');
  expect(screen.getByRole('article', { name: 'Carte Gradium' })).toHaveTextContent('Gradium ne joue pas d’émotion par réglage');
  fireEvent.click(screen.getByRole('button', { name: 'Générer et écouter Fish Audio' }));
  await screen.findByRole('button', { name: 'Réécouter Fish Audio (sans nouvel appel)' });
  expect(listen.mock.calls[0][3]).toMatchObject({ voiceId: 'max-fish' });
 });
 it('sends the same text and intent to every card, one provider call per click, and replays without a new call', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(heard);
  await toCards(['Gradium', 'Inworld', 'Cartesia']);
  expect(screen.getAllByRole('article')).toHaveLength(3);
  const inworld = screen.getByRole('article', { name: 'Carte Inworld' });
  expect(inworld).toHaveTextContent('Instruction de jeu : very frightened, anxious, shaky voice');
  expect(screen.getByRole('article', { name: 'Carte Cartesia' })).toHaveTextContent(/Émotion \(appliquée seulement en anglais/);
  expect(screen.getByRole('article', { name: 'Carte Gradium' })).toHaveTextContent('Voix de Max (jeu)');
  for (const name of ['Gradium', 'Inworld', 'Cartesia']) {
   fireEvent.click(screen.getByRole('button', { name: `Générer et écouter ${name}` }));
   await screen.findByRole('button', { name: `Réécouter ${name} (sans nouvel appel)` });
  }
  expect(listen).toHaveBeenCalledTimes(3);
  const texts = new Set(listen.mock.calls.map(call => call[1]));
  const intents = new Set(listen.mock.calls.map(call => JSON.stringify(call[3].performance)));
  expect(texts).toEqual(new Set([INTENT_PASSAGES[0].text])); expect(intents.size).toBe(1);
  expect(listen.mock.calls.map(call => call[2].id)).toEqual(['gradium', 'inworld', 'cartesia']);
  expect(listen.mock.calls[0][3]).toMatchObject({ voiceId: 'voice-max', characterKey: 'max', performance: { emotion: 'scared', intensity: 2, source: 'manual' } });
  expect(listen.mock.calls.every(call => call[4] === 'rest')).toBe(true);
 });
 it('requires “ce qui est off” below 5 only, saves human ratings and shows the reloaded table', async () => {
  vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(heard);
  await toCards(['Gradium', 'Inworld']);
  const save = screen.getByRole('button', { name: 'Enregistrer l’essai et mes notes' });
  expect(screen.getByRole('radio', { name: 'Note 3 Gradium' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Générer et écouter Gradium' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Note 3 Gradium' })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: 'Note 3 Gradium' }));
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Ce qui est off Gradium'), { target: { value: 'la peur ne s’entend pas' } });
  expect(save).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Générer et écouter Inworld' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Note 5 Inworld' })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: 'Note 5 Inworld' }));
  expect(screen.queryByLabelText('Ce qui est off Inworld')).not.toBeInTheDocument(); expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(await screen.findByRole('status')).toHaveTextContent('Essai enregistré et relu');
  const trial = vi.mocked(saveIntentTrial).mock.calls[0][0];
  expect(trial).toMatchObject({ character: 'max', passage: { id: 'P1', edited: false }, intent: { id: 'peur' } });
  expect(trial.cards).toEqual([
   expect.objectContaining({ provider: 'gradium', rating: 3, off: 'la peur ne s’entend pas', voiceSource: 'game', evidence: expect.objectContaining({ kind: 'provider_request' }) }),
   expect.objectContaining({ provider: 'inworld', rating: 5, off: '' }),
  ]);
  const results = screen.getByRole('region', { name: 'Résultats par intention' });
  expect(within(results).getByRole('row', { name: /Peur/ })).toHaveTextContent('3 (1)');
  expect(within(results).getByRole('row', { name: /Peur/ })).toHaveTextContent('5 (1)');
  fireEvent.click(screen.getByRole('button', { name: 'Même texte, autre émotion' }));
  expect(screen.getByLabelText('Étape courante')).toHaveTextContent('Étape 2 sur 4');
  expect(screen.getByRole('button', { name: 'Continuer vers les fournisseurs' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /Colère contenue/ })); fireEvent.click(screen.getByRole('button', { name: 'Continuer vers les fournisseurs' }));
  expect(screen.getByRole('checkbox', { name: 'Comparer Inworld' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Recommencer un test' }));
  expect(screen.getByLabelText('Étape courante')).toHaveTextContent('Étape 1 sur 4');
 });
 it('mounts the AP2 bench only when advanced options are opened, and stays out of production', async () => {
  const view = render(<MemoryRouter><SpeechIntentWorkshop /></MemoryRouter>);
  const details = screen.getByText(/Options avancées — réglages bruts/).closest('details')!;
  details.open = true; fireEvent(details, new Event('toggle'));
  expect(await screen.findByText('Banc A/B AP2 monté')).toBeInTheDocument();
  view.unmount(); setActiveEnvironment('prod');
  render(<MemoryRouter><SpeechIntentWorkshop /></MemoryRouter>);
  expect(screen.getByText('Réservé aux environnements sandbox.')).toBeInTheDocument();
 });
});
