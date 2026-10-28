import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/experienceOrchestration', () => ({ listCharacterRuntimeProfiles: vi.fn(async () => [
 { character_key: 'max', display_name: 'Max', rugosite: 3, tts_provider: 'gradium', tts_voice_id: 'voice-max' },
 { character_key: 'emma', display_name: 'Emma', tts_provider: 'gradium', tts_voice_id: 'voice-emma' },
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
const evidence = { requests: [{ transport: 'websocket' as const, body: { json_config: { temp: 0.7, padding_bonus: 0.5 } } }], transport: 'websocket' as const, cached: false, providerCalls: 1, pauseRendering: 'websocket' };
async function ready() { render(<SpeechAuditionBench/>); await waitFor(() => expect(screen.getByLabelText('État de la réplique').querySelector('option[value=""]')?.nextElementSibling).toBeTruthy()); fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Retenu' } }); }
describe('A3 — existing audition bench', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); });
 it('loads proposed cases without calls or saves, limits initial audition and keeps Max/Emma levels and voices distinct', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready(); expect(listen).not.toHaveBeenCalled(); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Rugosité du banc')).toHaveValue('3');
  fireEvent.change(screen.getByLabelText('Réplique du banc'), { target: { value: '2' } }); expect(screen.getByRole('button', { name: 'Écouter / rejouer' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Étape audition'), { target: { value: 'finalists' } }); fireEvent.click(screen.getByLabelText('Finaliste M3'));
  fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Retenu' } }); expect(screen.getByRole('button', { name: 'Écouter / rejouer' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Personnage du banc'), { target: { value: 'emma' } });
  expect(screen.getByLabelText('Rugosité du banc')).toHaveValue('2'); expect(screen.getByLabelText('Voix emma gradium')).toHaveValue('voice-emma');
  expect(screen.getByLabelText('État de la réplique')).toHaveValue(''); expect(screen.getByText('Cherche à agir')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Voix emma gradium'), { target: { value: 'emma-audition' } });
  fireEvent.change(screen.getByLabelText('Personnage du banc'), { target: { value: 'max' } }); expect(screen.getByLabelText('Voix max gradium')).toHaveValue('voice-max');
 });
 it('uses identical words, voice and base parameters for A/B, and exposes actual fallback evidence', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await ready(); const button = screen.getByRole('button', { name: 'Écouter / rejouer' });
  fireEvent.click(button); await waitFor(() => expect(listen).toHaveBeenCalledTimes(1)); await waitFor(() => expect(button).toBeEnabled());
  const a = listen.mock.calls[0]; expect(a[3]).toMatchObject({ characterKey: 'max', voiceId: 'voice-max', speechAudition: { settings: { gradiumPausesEnabled: false, version: 'saved-v1' } } });
  fireEvent.change(screen.getByLabelText('Mode de pauses audition'), { target: { value: 'pauses' } });
  expect(screen.getByLabelText('Contrôles préparés')).toHaveTextContent('1');
  listen.mockResolvedValue({ ...evidence, transport: 'rest_fallback', pauseRendering: 'rest_unavailable' });
  fireEvent.click(button); await waitFor(() => expect(listen).toHaveBeenCalledTimes(2));
  const b = listen.mock.calls[1]; expect(b[1]).toBe(a[1]); expect(b[3].voiceId).toBe(a[3].voiceId); expect(b[3].performance).toEqual(a[3].performance);
  expect(b[3].speechAudition?.gradium).toEqual(a[3].speechAudition?.gradium);
  expect(screen.getByText(/Repli REST : cette écoute/)).toBeInTheDocument();
  expect(screen.getAllByText(/Mots \/ pensée/).length).toBeGreaterThan(0); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
 });
 it('stops on changes and ignores a late result instead of replacing a newer audition', async () => {
  let resolve!: (value: typeof evidence) => void;
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue(evidence);
  const stop = vi.spyOn(SpeechAuditionRunner.prototype, 'stop');
  await ready(); fireEvent.click(screen.getByRole('button', { name: 'Écouter / rejouer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
  fireEvent.change(screen.getByLabelText('Personnage du banc'), { target: { value: 'emma' } });
  fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Action' } });
  fireEvent.click(screen.getByRole('button', { name: 'Écouter / rejouer' })); await waitFor(() => expect(listen).toHaveBeenCalledTimes(2));
  await act(async () => { resolve(evidence); });
  expect(screen.getByText(/emma · Action · gradium/)).toBeInTheDocument(); expect(screen.queryByText(/max · Retenu · gradium/)).not.toBeInTheDocument(); expect(stop).toHaveBeenCalled();
 });
 it('shows save failures and never treats a draft as saved', async () => {
  vi.mocked(saveSpeechPerformanceSettings).mockRejectedValue(new Error('Relecture impossible'));
  await ready(); fireEvent.change(screen.getByLabelText('Pauses Retenu'), { target: { value: 'short' } });
  expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder le mapping sandbox et relire', hidden: true }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Relecture impossible'));
  expect(saveSpeechPerformanceSettings).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ version: 'saved-v1' }), 'sandbox-ulrich');
 });
});


describe('AP1 — Atelier de parole Max', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); });
 async function workshopReady() {
  render(<MemoryRouter><SpeechAuditionBench workshop /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/copy-v1/)).toBeInTheDocument());
 }
 it('explains five families, requires a state and never calls audio or saves while preparing', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue(evidence);
  await workshopReady();
  for (const title of ['Fiche Notion — jeu et déclencheurs', 'Rugosité — place des ruptures', 'GM — orientation du prochain tour', 'LLM — production des mots', 'Synthèse — restitution sonore']) expect(screen.getByText(title)).toBeInTheDocument();
  expect(screen.getByLabelText('État de la réplique')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Écouter / rejouer' })).toBeDisabled();
  expect(screen.queryByText('Sauvegarder le mapping sandbox et relire')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Personnage du banc')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Valeur B'), { target: { value: '-0.4' } });
  expect(listen).not.toHaveBeenCalled(); expect(saveSpeechPerformanceSettings).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: /TTS Config/ })).toHaveAttribute('href', '/admin/technique/configuration-tts');
 });
 it('freezes A, varies only one bounded vocal value in B and keeps words, voice, state and transport identical', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue({ ...evidence, transport: 'rest' });
  await workshopReady();
  fireEvent.change(screen.getByLabelText('Transport audition'), { target: { value: 'rest' } });
  fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Retenu' } });
  const button = screen.getByRole('button', { name: 'Écouter / rejouer' });
  fireEvent.click(button); await waitFor(() => expect(listen).toHaveBeenCalledTimes(1)); await waitFor(() => expect(button).toBeEnabled());
  const a = listen.mock.calls[0];
  fireEvent.change(screen.getByLabelText('Variante à écouter'), { target: { value: 'B' } });
  fireEvent.change(screen.getByLabelText('Valeur B'), { target: { value: '-0.4' } });
  fireEvent.click(button); await waitFor(() => expect(listen).toHaveBeenCalledTimes(2));
  const b = listen.mock.calls[1];
  expect(b[1]).toEqual(a[1]); expect(b[3].voiceId).toEqual(a[3].voiceId); expect(b[3].performance).toEqual(a[3].performance);
  expect(b[3].speechAudition).toEqual({ ...a[3].speechAudition, gradium: { ...a[3].speechAudition!.gradium, paddingBonus: -0.4 } });
  expect(a[4]).toBe('rest'); expect(b[4]).toBe('rest');
  expect(a[3].speechAudition?.gradium.paddingBonus).not.toBe(-0.4);
  fireEvent.change(screen.getByLabelText('Paramètre B'), { target: { value: 'temp' } });
  fireEvent.change(screen.getByLabelText('Valeur B'), { target: { value: '90' } });
  expect(screen.getByLabelText('Valeur B')).toHaveValue(1.4);
  fireEvent.change(screen.getByLabelText('Réplique du banc'), { target: { value: '1' } });
  expect(button).toBeDisabled(); expect(screen.getByLabelText('État de la réplique')).toHaveValue('');
 });
 it('separates A2 pauses into WS with the same vocal parameters and displays fallback limits', async () => {
  const listen = vi.spyOn(SpeechAuditionRunner.prototype, 'listen').mockResolvedValue({ ...evidence, transport: 'rest_fallback' });
  await workshopReady();
  fireEvent.change(screen.getByLabelText('État de la réplique'), { target: { value: 'Retenu' } });
  fireEvent.change(screen.getByLabelText('Type de comparaison'), { target: { value: 'pauses' } });
  expect(screen.getByLabelText('Transport audition')).toHaveValue('websocket'); expect(screen.getByLabelText('Transport audition')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Variante à écouter'), { target: { value: 'B' } });
  fireEvent.click(screen.getByRole('button', { name: 'Écouter / rejouer' }));
  await waitFor(() => expect(listen).toHaveBeenCalledOnce());
  expect(listen.mock.calls[0][3].speechAudition?.settings.gradiumPausesEnabled).toBe(true);
  expect(screen.getByText(/Repli REST : cette écoute/)).toBeInTheDocument();
 });
 it('closes production and clears the existing owner when unmounted', async () => {
  const clear = vi.spyOn(SpeechAuditionRunner.prototype, 'clear');
  const mounted = render(<MemoryRouter><SpeechAuditionBench workshop /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/copy-v1/)).toBeInTheDocument());
  mounted.unmount(); expect(clear).toHaveBeenCalled();
  setActiveEnvironment('prod'); render(<MemoryRouter><SpeechAuditionBench workshop /></MemoryRouter>);
  expect(screen.getByText('Réservé aux environnements sandbox.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Écouter / rejouer' })).not.toBeInTheDocument();
 });
});
