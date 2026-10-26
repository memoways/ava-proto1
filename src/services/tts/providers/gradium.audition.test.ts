import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ create: vi.fn(), supported: true, play: vi.fn(async () => ({ status: 'played', playbackTotalMs: 50 })) }));
vi.mock('@/services/tts/gradiumStreamPlayer', () => ({ createGradiumStreamSession: mock.create, createGradiumTurnSession: vi.fn(), isStreamingSupported: () => mock.supported }));
vi.mock('@/services/audioPlayback', () => ({ playAudioBlobRobust: mock.play }));
vi.mock('@/services/gameAuth', () => ({ authenticatedFunctionFetch: vi.fn(async () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'audio/wav' } })) }));
import { authenticatedFunctionFetch } from '@/services/gameAuth';
import { setActiveEnvironment, writeEnvironmentStorage } from '@/services/environmentContext';
import { createAuditionSnapshot, auditionIntent } from '../speechAudition';
import { EMPTY_SPEECH_PERFORMANCE, SPEECH_PERFORMANCE_KEY, proposeSpeechMapping } from '../speechPerformanceSettings';
import { buildGradiumJsonConfig, gradiumProvider } from './gradium';
import { serializeGradiumSpeech } from '../gradiumSpeech';
import type { GradiumStreamOptions } from '../gradiumStreamPlayer';
const settings = { ...EMPTY_SPEECH_PERFORMANCE, enabled: true, version: '2026-10-25T11:39:32.000Z', byCharacter: { max: { Retenu: proposeSpeechMapping('Retenu', 'silence') }, emma: { Action: proposeSpeechMapping('Action', 'rapide') } } };
function context(character = 'max', pauses = true) {
 const state = character === 'max' ? 'Retenu' : 'Action';
 const snapshot = createAuditionSnapshot(character, [{ name: state, description: state }], settings, pauses);
 return { characterKey: character, voiceId: `${character}-audition`, speechAudition: snapshot,
  performance: auditionIntent(snapshot, 'Oui… attends.', state, character === 'max' ? 3 : 2), onAuditionRequest: vi.fn() };
}
function session(options: GradiumStreamOptions) {
 options.validateContext?.(); options.onSetupSent?.();
 return { started: Promise.resolve(), finished: Promise.resolve({ playbackTotalMs: 50 }),
  generationDone: Promise.resolve({ firstByteMs: 10, totalGenMs: 20, auditionAudio: new Blob(['ws-audio']), auditionCapture: 'complete', bufferPreset: 'current' }),
  open: vi.fn(), cancel: vi.fn(), hasAudibleOutput: true };
}
describe('A3 — actual Gradium provider boundary', () => {
 beforeEach(() => {
  localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); mock.supported = true;
  mock.create.mockImplementation((_text: string, options: GradiumStreamOptions) => session(options));
  writeEnvironmentStorage(SPEECH_PERFORMANCE_KEY, JSON.stringify({ ...settings, gradiumPausesEnabled: false }));
 });
 it('uses only the temporary authorized mapping for WS, with identical A/B base parameters and no live write', async () => {
  const control = context('max', false), experimental = context('max', true);
  const a = gradiumProvider.createStreamingPlayback!('Oui… attends.', control)!; a.open(); await a.finished;
  const aOptions = mock.create.mock.calls[0][1] as GradiumStreamOptions;
  const b = gradiumProvider.createStreamingPlayback!('Oui… attends.', experimental)!; b.open(); await b.finished;
  const bOptions = mock.create.mock.calls[1][1] as GradiumStreamOptions;
  expect(aOptions.jsonConfig).toEqual(bOptions.jsonConfig); expect(aOptions.voiceId).toBe(bOptions.voiceId);
  expect(bOptions.jsonConfig).toEqual(buildGradiumJsonConfig(experimental.speechAudition.gradium, experimental.performance));
  expect(aOptions.prepareText!('Oui… attends.')).toBe('Oui, attends.'); expect(bOptions.prepareText!('Oui… attends.')).toBe('Oui <break time="1s" /> attends.');
  const request = experimental.onAuditionRequest.mock.calls[0][0];
  expect(serializeGradiumSpeech(request.controls)).toBe('Oui <break time="1s" /> attends.');
  expect(request.body).toMatchObject({ voice_id: 'max-audition', json_config: bOptions.jsonConfig });
  expect(request.body).not.toHaveProperty('instruction'); expect(request.body).not.toHaveProperty('emotion');
  expect(await b.generationDone).toMatchObject({ transport: 'websocket', pauseRendering: 'websocket', auditionCapture: 'complete' });
  expect(authenticatedFunctionFetch).not.toHaveBeenCalled();
 });
 it('keeps Emma own state/voice and closes mismatched character, state, production and environment', () => {
  const emma = context('emma'); const handle = gradiumProvider.createStreamingPlayback!('Oui…', emma)!; handle.cancel();
  expect(mock.create.mock.calls[0][1]).toMatchObject({ voiceId: 'emma-audition' });
  expect(() => gradiumProvider.createStreamingPlayback!('Oui', { ...emma, characterKey: 'max' })).toThrow('personnage');
  expect(() => gradiumProvider.createStreamingPlayback!('Oui', { ...emma, performance: { ...emma.performance, speechState: 'Retenu' } })).toThrow('État');
  setActiveEnvironment('sandbox-romed'); expect(() => gradiumProvider.createStreamingPlayback!('Oui', emma)).toThrow('sandbox');
  setActiveEnvironment('prod'); expect(() => gradiumProvider.createStreamingPlayback!('Oui', emma)).toThrow('sandbox');
 });
 it('falls back only before sound with the frozen displayed config, clean words and explicit REST limitation', async () => {
  const ctx = context();
  mock.create.mockImplementation((_text, options) => {
   options.onSetupSent?.();
   return { started: Promise.reject(new Error('WS failure')), generationDone: Promise.reject(new Error('WS failure')), finished: Promise.reject(new Error('WS failure')), open: vi.fn(), cancel: vi.fn(), hasAudibleOutput: false };
  });
  const handle = gradiumProvider.createStreamingPlayback!('Oui… attends.', ctx)!; handle.open();
  const stats = await handle.generationDone; await handle.finished;
  expect(stats).toMatchObject({ transport: 'rest_fallback', pauseRendering: 'rest_unavailable' }); expect(stats.auditionAudio).toBeInstanceOf(Blob);
  const body = JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls[0][1]?.body));
  expect(body).toMatchObject({ text: 'Oui, attends.', voiceId: 'max-audition', jsonConfig: buildGradiumJsonConfig(ctx.speechAudition.gradium, ctx.performance) });
  expect(ctx.onAuditionRequest.mock.calls.map(call => call[0].transport)).toEqual(['websocket', 'rest']);
 });
 it('never replays with REST after audible sound or after cancellation', async () => {
  mock.create.mockImplementation(() => ({ started: Promise.resolve(), generationDone: Promise.reject(new Error('after sound')), finished: Promise.reject(new Error('after sound')), open: vi.fn(), cancel: vi.fn(), hasAudibleOutput: true }));
  const handle = gradiumProvider.createStreamingPlayback!('Oui…', context())!; handle.open();
  await expect(handle.finished).rejects.toThrow('after sound'); expect(authenticatedFunctionFetch).not.toHaveBeenCalled();
  const ctx = context(); const controller = new AbortController(); controller.abort();
  await expect(gradiumProvider.generate('Oui', { ...ctx, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(authenticatedFunctionFetch).not.toHaveBeenCalled();
 });
});
