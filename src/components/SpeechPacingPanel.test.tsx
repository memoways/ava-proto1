import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SpeechPacingPanel from './SpeechPacingPanel';
import { setActiveEnvironment } from '@/services/environmentContext';

const store = vi.hoisted(() => ({ value: null as unknown, saved: [] as unknown[] }));
vi.mock('@/services/tts/speechPerformanceSettings', async importOriginal => ({
  ...await importOriginal<typeof import('@/services/tts/speechPerformanceSettings')>(),
  readSavedSpeechPerformance: async () => structuredClone(store.value),
  saveSpeechPerformanceSettings: async (next: unknown) => { store.saved.push(next); return structuredClone(next); },
}));

describe('SpeechPacingPanel', () => {
  beforeEach(() => {
    localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); store.saved = [];
    store.value = { enabled: true, version: 'v', gradiumTagsEnabled: false, byCharacter: { max: {
      'La digue cède': { delivery: 'rushed', emotion: 'urgent', instruction: 'x', pauses: 'short', speed: 1.12 } } } };
  });

  it('shows Max calm by default, previews a change and saves only on click', async () => {
    render(<SpeechPacingPanel />);
    const flares = await screen.findByLabelText('Moments chauds Max');
    expect(flares).toHaveValue('never');
    expect(screen.getByLabelText('Intensité maximale Max')).toHaveValue('1');
    expect(screen.getByLabelText('Moments chauds Emma')).toHaveValue('full');
    expect(screen.getByLabelText('Aperçu Max').textContent).not.toContain('éclat');

    fireEvent.change(flares, { target: { value: 'full' } });
    expect(screen.getByLabelText('Aperçu Max').textContent).toContain('éclat, intensité 2');
    expect(store.saved).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le tempérament vocal' }));
    await waitFor(() => expect(store.saved).toHaveLength(1));
    expect(store.saved[0]).toMatchObject({ pacing: { max: { flares: 'full', ceiling: 1, window: 6, ramp: true } } });
    expect((store.saved[0] as { pacing: object }).pacing).not.toHaveProperty('emma');
  });

  it('stays hidden in production', () => {
    setActiveEnvironment('prod');
    const { container } = render(<SpeechPacingPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
