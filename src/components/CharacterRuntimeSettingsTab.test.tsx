import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const profile = (key: string, name: string, provider: string | null, voice: string | null) => ({
 id: `p-${key}`, character_key: key, display_name: name, enabled: true, notion_character_id: null, opening_line: null, portrait_url: null,
 tts_provider: provider, tts_voice_id: voice, prompt_validated: true, rag_validated: true, qualitative_tests_validated: false,
 knowledge_isolation_validated: false, rugosite: 0,
});
vi.mock('@/services/experienceOrchestration', () => ({
 listCharacterRuntimeProfiles: vi.fn(async () => [
  profile('max', 'Max', 'gradium', 'max-gradium'), profile('emma', 'Emma', 'gradium', 'emma-old'), profile('leo', 'Léo', 'fish', null),
 ]),
 fetchCharacterAutoReadiness: vi.fn(async () => ({})),
 // Read by the effective voice summary mounted in the tab; absent, it rejected after the test (flaky CI).
 getCharacterRuntimeReadiness: vi.fn(async () => null),
 updateCharacterRuntimeProfile: vi.fn(async () => undefined),
 uploadCharacterPortrait: vi.fn(),
}));
vi.mock('@/services/tts/characterVoices', async original => ({
 ...await original<typeof import('@/services/tts/characterVoices')>(),
 loadCharacterVoicesFromDB: vi.fn(async () => ({ emma: { gradium: 'emma-new' } })),
}));
vi.mock('@/services/characterSheetCompression', async original => ({
 ...await original<typeof import('@/services/characterSheetCompression')>(),
 loadSheetCompressionSettings: vi.fn(async () => ({ byCharacter: { emma: 'guidelines' } })),
 saveSheetCompressionLevel: vi.fn(async () => ({ byCharacter: {} })),
}));
import { updateCharacterRuntimeProfile } from '@/services/experienceOrchestration';
import { saveSheetCompressionLevel } from '@/services/characterSheetCompression';
import CharacterRuntimeSettingsTab from './CharacterRuntimeSettingsTab';

describe('AP4-bis — character settings read voice IDs from TTS configuration', () => {
 beforeEach(() => vi.clearAllMocks());
 it('shows the catalogue ID read-only, keeps the game voice as prefill, and warns when the ID is missing or differs', async () => {
  render(<CharacterRuntimeSettingsTab />);
  expect(await screen.findByLabelText('Voice ID Max')).toHaveTextContent('max-gradium');
  expect(screen.getByLabelText('Voice ID Emma')).toHaveTextContent('emma-new');
  expect(screen.getByText(/Le jeu utilise encore emma-old/)).toBeInTheDocument();
  expect(screen.getByLabelText('Voice ID Léo')).toHaveTextContent('Aucun Voice ID pour ce fournisseur');
  expect(screen.getByText(/Ajoutez l’ID de Léo pour ce fournisseur/)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Voice ID du personnage')).toBeNull();
 });
 it('saves the profile with the catalogue ID of the chosen provider', async () => {
  render(<CharacterRuntimeSettingsTab />);
  await screen.findByLabelText('Voice ID Emma');
  const saveButtons = screen.getAllByRole('button', { name: /Enregistrer/ });
  fireEvent.click(saveButtons[1]);
  await waitFor(() => expect(updateCharacterRuntimeProfile).toHaveBeenCalledWith('p-emma', expect.objectContaining({ tts_provider: 'gradium', tts_voice_id: 'emma-new' })));
 });
 it('folds Audio and Vidéo by default, with a one-line summary each', async () => {
  render(<CharacterRuntimeSettingsTab />);
  await screen.findByLabelText('Voice ID Max');
  const audio = screen.getByTestId('audio-max');
  const video = screen.getByTestId('video-max');
  expect(audio).not.toHaveAttribute('open');
  expect(video).not.toHaveAttribute('open');
  expect(screen.getByTestId('audio-max-summary')).toHaveTextContent('Gradium TTS · voix max-gradium');
  expect(screen.getByTestId('video-max-summary')).toHaveTextContent('Suit le réglage global');
  expect(screen.getByLabelText('Accueil de Max')).toBeInTheDocument();
 });
 it('shows the saved sheet level per character and saves only a changed one', async () => {
  render(<CharacterRuntimeSettingsTab />);
  await screen.findByLabelText('Voice ID Max');
  expect(screen.getByTestId('sheet-compression-max-summary')).toHaveTextContent('Actuel');
  await waitFor(() => expect(screen.getByTestId('sheet-compression-emma-summary')).toHaveTextContent('Consignes entières'));
  fireEvent.click(screen.getAllByRole('button', { name: /Enregistrer/ })[0]);
  await waitFor(() => expect(updateCharacterRuntimeProfile).toHaveBeenCalledWith('p-max', expect.anything()));
  expect(saveSheetCompressionLevel).not.toHaveBeenCalled();
 });
});
