import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveEnvironment } from '../environmentContext';
import { auditionIntent, auditionKey, createAuditionSnapshot, SpeechAuditionRunner } from './speechAudition';
import { EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping } from './speechPerformanceSettings';
import { getSpeechPerformanceSettings } from './speechPerformanceSettings';
import { resolveGradiumPauseSeconds } from './performanceIntent';
import type { TTSProvider, TTSGenerateContext } from './types';
const settings = { ...EMPTY_SPEECH_PERFORMANCE, version: 'saved-v1', byCharacter: {
 max: { Retenu: proposeSpeechMapping('Retenu', 'silence') }, emma: { Action: proposeSpeechMapping('Action', 'rapide') },
} };
const states = [{ name: 'Retenu', description: 'silence' }];
const blob = new Blob(['audio']);
const play = vi.fn(async (_blob: Blob) => ({ status: 'played' as const, playbackTotalMs: 250 }));
const provider: TTSProvider = { id: 'fish', label: '', description: '', generate: vi.fn(async (_text, ctx) => {
 ctx?.onAuditionRequest?.({ transport: 'rest', body: { voiceId: ctx.voiceId } });
 return { blob, meta: { provider: 'fish' as const, model: 'octave', firstByteMs: 12 } };
}) };
describe('A3 — audition isolated snapshots and exact-audio cache', () => {
 beforeEach(() => { localStorage.clear(); setActiveEnvironment('sandbox-ulrich'); vi.clearAllMocks(); });
 it('keeps the saved version and live mapping untouched, validates own states and closes prod/other environments', () => {
  const a = createAuditionSnapshot('max', states, settings, false), b = createAuditionSnapshot('max', states, settings, true);
  const intentA = auditionIntent(a, 'Oui…', 'Retenu', 3), intentB = auditionIntent(b, 'Oui…', 'Retenu', 3);
  expect(intentA).toEqual(intentB); expect(intentB.mappingVersion).toBe('saved-v1');
  expect(resolveGradiumPauseSeconds(intentA, 'max', a.settings)).toBeUndefined();
  expect(resolveGradiumPauseSeconds(intentB, 'max', b.settings)).toBe(1);
  expect(settings).not.toHaveProperty('gradiumPausesEnabled'); expect(getSpeechPerformanceSettings().enabled).toBe(false);
  expect(b.settings.byCharacter.emma).toBeUndefined();
  expect(() => auditionIntent(b, 'Oui', 'Action', 3)).toThrow('fiche');
  setActiveEnvironment('sandbox-romed'); expect(() => auditionIntent(b, 'Oui', 'Retenu', 3)).toThrow('sandbox');
  setActiveEnvironment('prod'); expect(() => createAuditionSnapshot('max', states, settings, true)).toThrow('sandbox');
 });
 it('copies mutable drafts and gives keys to all effective inputs and the requested pause/transport mode', () => {
  const draft = structuredClone(settings), snapshot = createAuditionSnapshot('max', states, draft, true);
  draft.byCharacter.max.Retenu.pauses = 'short'; expect(snapshot.settings.byCharacter.max.Retenu.pauses).toBe('long');
  const base = { text: 'Oui', character: 'max', state: 'Retenu', level: 3, voice: 'max-voice', provider: 'gradium', model: 'default', snapshot, parameters: { temp: 0.7 }, pauseMode: true, transport: 'websocket' };
  const key = auditionKey(base);
  for (const field of Object.keys(base)) expect(auditionKey({ ...base, [field]: null })).not.toBe(key);
  expect(auditionKey({ b: 1, a: { c: 2, b: 1 } })).toBe(auditionKey({ a: { b: 1, c: 2 }, b: 1 }));
 });
 it('replays the exact cached blob and its original evidence without any provider call, invalidates on key changes', async () => {
  const runner = new SpeechAuditionRunner(play);
  const first = await runner.listen('key', 'Oui', provider, { voiceId: 'voice' });
  const replay = await runner.listen('key', 'Oui', provider, { voiceId: 'voice' });
  expect(first).toMatchObject({ cached: false, providerCalls: 1, model: 'octave' });
  expect(replay).toMatchObject({ cached: true, providerCalls: 0, requests: first.requests, model: 'octave' });
  expect(provider.generate).toHaveBeenCalledOnce(); expect(play.mock.calls[0][0]).toBe(play.mock.calls[1][0]);
  await runner.listen('changed-voice', 'Oui', provider, { voiceId: 'other' }); expect(provider.generate).toHaveBeenCalledTimes(2);
  expect(runner.providerCalls).toBe(2);
 });
 it('uses a WS handle, retains audio and fallback evidence, and replays without creating a second handle', async () => {
  const stream = { open: vi.fn(), cancel: vi.fn(), started: Promise.resolve(), finished: Promise.resolve({ playbackTotalMs: 400 }),
   generationDone: Promise.resolve({ provider: 'gradium' as const, transport: 'websocket' as const, model: 'gradium-tts', auditionAudio: blob, auditionCapture: 'complete' as const, pauseRendering: 'websocket' as const }) };
  const createStreamingPlayback = vi.fn((_text: string, ctx?: TTSGenerateContext) => { ctx?.onAuditionRequest?.({ transport: 'websocket', body: { voice_id: ctx.voiceId } }); return stream; });
  const wsProvider: TTSProvider = { ...provider, id: 'gradium', createStreamingPlayback };
  const runner = new SpeechAuditionRunner(play);
  const context = { characterKey: 'max', voiceId: 'max-voice', speechAudition: createAuditionSnapshot('max', states, settings, true) };
  const first = await runner.listen('ws', 'Oui…', wsProvider, context);
  expect(first.transport).toBe('websocket'); expect(first.stats).not.toHaveProperty('auditionAudio'); expect(play).not.toHaveBeenCalled();
  const replay = await runner.listen('ws', 'Oui…', wsProvider, context);
  expect(replay.cached).toBe(true); expect(createStreamingPlayback).toHaveBeenCalledOnce(); expect(play).toHaveBeenCalledOnce(); expect(stream.open).toHaveBeenCalledOnce();
  stream.generationDone = Promise.resolve({ ...await stream.generationDone, transport: 'rest_fallback', pauseRendering: 'rest_unavailable' } as never);
  expect(await runner.listen('fallback', 'Oui…', wsProvider, context)).toMatchObject({ transport: 'rest_fallback', pauseRendering: 'rest_unavailable' });
 });
 it('bounds the cache to 16 recordings', async () => {
  const runner = new SpeechAuditionRunner(play);
  for (let i = 0; i < 17; i++) await runner.listen(String(i), 'Oui', provider, {});
  await runner.listen('0', 'Oui', provider, {}); expect(provider.generate).toHaveBeenCalledTimes(18);
  runner.clear(); await runner.listen('0', 'Oui', provider, {}); expect(provider.generate).toHaveBeenCalledTimes(19);
 });
 it('does not cache incomplete captures and cancels the active streaming handle', async () => {
  const createStreamingPlayback = vi.fn(() => ({ open: vi.fn(), cancel: vi.fn(), started: Promise.resolve(), finished: Promise.resolve({ playbackTotalMs: 10 }),
   generationDone: Promise.resolve({ provider: 'gradium' as const, transport: 'websocket' as const, auditionCapture: 'limit_exceeded' as const }) }));
  const runner = new SpeechAuditionRunner(play), streaming = { ...provider, id: 'gradium' as const, createStreamingPlayback };
  expect(await runner.listen('uncached', 'Oui', streaming, {})).toMatchObject({ cached: false, auditionCapture: 'limit_exceeded' });
  await runner.listen('uncached', 'Oui', streaming, {}); expect(createStreamingPlayback).toHaveBeenCalledTimes(2); expect(play).not.toHaveBeenCalled();
  let reject!: (reason: unknown) => void;
  const pending = new Promise<never>((_resolve, rej) => { reject = rej; });
  const cancel = vi.fn(() => reject(new DOMException('Annulé', 'AbortError')));
  const active = { ...streaming, createStreamingPlayback: () => ({ open: vi.fn(), cancel, started: pending, finished: pending, generationDone: pending }) };
  const listening = runner.listen('pending', 'Oui', active, {}); const assertion = expect(listening).rejects.toMatchObject({ name: 'AbortError' });
  runner.stop(); await assertion; expect(cancel).toHaveBeenCalledOnce();
 });
 it('evicts by bytes as well as count without retaining an oversized blob', async () => {
  const runner = new SpeechAuditionRunner(play);
  const large = new Blob([new Uint8Array(9 * 1024 * 1024)]);
  const batch = { ...provider, generate: vi.fn(async () => ({ blob: large, meta: { provider: 'fish' as const } })) };
  await runner.listen('a', 'Oui', batch, {}); await runner.listen('b', 'Oui', batch, {}); await runner.listen('a', 'Oui', batch, {});
  expect(batch.generate).toHaveBeenCalledTimes(3);
 });
 it('rejects stale completion/callbacks after stop or replacement, without playing or caching the old audio', async () => {
  let resolve!: (value: Awaited<ReturnType<TTSProvider['generate']>>) => void;
  let oldContext: TTSGenerateContext | undefined;
  const slow: TTSProvider = { ...provider, generate: vi.fn((_text, ctx) => { oldContext = ctx; return new Promise<Awaited<ReturnType<TTSProvider['generate']>>>(r => { resolve = r; }); }) };
  const runner = new SpeechAuditionRunner(play);
  const old = runner.listen('old', 'Old', slow, {}); const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
  await runner.listen('new', 'New', provider, {});
  oldContext?.onAuditionRequest?.({ transport: 'rest', body: { text: 'stale' } });
  resolve({ blob, meta: { provider: 'fish' } }); await rejected;
  expect(play).toHaveBeenCalledOnce(); expect(runner.providerCalls).toBe(1);
  const stopPending = runner.listen('stopped', 'Old', slow, {}); const stopRejected = expect(stopPending).rejects.toMatchObject({ name: 'AbortError' });
  runner.stop(); resolve({ blob, meta: { provider: 'fish' } }); await stopRejected; expect(play).toHaveBeenCalledOnce();
 });
});
