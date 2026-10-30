import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/experienceOrchestration', () => ({
 listCharacterRuntimeProfiles: vi.fn(async () => [
  { id: 'p-max', character_key: 'max', display_name: 'Max', tts_provider: 'gradium', tts_voice_id: 'max-gradium' },
  { id: 'p-emma', character_key: 'emma', display_name: 'Emma', tts_provider: 'fish', tts_voice_id: 'emma-old' },
 ]),
 updateCharacterRuntimeVoice: vi.fn(async () => undefined),
}));
vi.mock('@/services/tts/characterVoices', async original => ({
 ...await original<typeof import('@/services/tts/characterVoices')>(),
 loadCharacterVoicesFromDB: vi.fn(async () => ({})),
 saveCharacterVoices: vi.fn(async (value: unknown) => value),
}));
import { updateCharacterRuntimeVoice } from '@/services/experienceOrchestration';
import { saveCharacterVoices } from '@/services/tts/characterVoices';
import CharacterVoicesPanel from './CharacterVoicesPanel';

describe('AP4-bis — Voice IDs entered once in TTS configuration', () => {
 beforeEach(() => vi.clearAllMocks());
 it('shows four characters × five providers, prefilled with the game voices', async () => {
  render(<CharacterVoicesPanel />);
  expect(await screen.findByLabelText('Voice ID Max Gradium')).toHaveValue('max-gradium');
  expect(screen.getByLabelText('Voice ID Emma Fish Audio')).toHaveValue('emma-old');
  for (const character of ['Max', 'Emma', 'Ava', 'Léo']) for (const provider of ['Gradium', 'Fish Audio', 'ElevenLabs', 'Inworld', 'Cartesia'])
   expect(screen.getByLabelText(`Voice ID ${character} ${provider}`)).toBeInTheDocument();
 });
 it('blocks invalid IDs, saves the catalogue and moves the game voice only where the chosen provider changed', async () => {
  render(<CharacterVoicesPanel />);
  const emmaFish = await screen.findByLabelText('Voice ID Emma Fish Audio');
  fireEvent.change(emmaFish, { target: { value: 'emma new' } });
  expect(screen.getByText('Un identifiant de voix ne contient pas d’espace.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enregistrer les voix' })).toBeDisabled();
  fireEvent.change(emmaFish, { target: { value: 'emma-custom' } });
  fireEvent.change(screen.getByLabelText('Voice ID Max Fish Audio'), { target: { value: 'max-custom' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les voix' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Voix du jeu mise à jour pour : Emma.'));
  expect(saveCharacterVoices).toHaveBeenCalledWith({ max: { gradium: 'max-gradium', fish: 'max-custom' }, emma: { fish: 'emma-custom' } });
  expect(updateCharacterRuntimeVoice).toHaveBeenCalledTimes(1);
  expect(updateCharacterRuntimeVoice).toHaveBeenCalledWith('p-emma', 'emma-custom');
 });
});
