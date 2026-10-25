import { beforeEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ configure: vi.fn(), create: vi.fn() }));
vi.mock('@/services/gameAuth', () => ({ authenticatedFunctionFetch: vi.fn() }));
vi.mock('@/services/tts/gradiumStreamPlayer', () => ({
  createGradiumTurnSession: transport.create, createGradiumStreamSession: vi.fn(), isStreamingSupported: () => true,
}));
vi.mock('@/services/tts/providerSettings', () => ({ resolveGradiumSettings: (key: string) => ({
  temp: key === 'max' ? 0.7 : 0.65, paddingBonus: key === 'max' ? 0.2 : 0,
  voiceId: `${key}-voice`, cfgCoef: 2, rewriteRules: 'fr', pronunciationId: '', outputFormat: 'wav',
}) }));
import { authenticatedFunctionFetch } from '@/services/gameAuth';
import { setActiveEnvironment } from '@/services/environmentContext';
import { derivePerformanceIntent, applyGradiumPerformance, resolveGradiumPauseSeconds } from '../performanceIntent';
import { writeEnvironmentStorage } from '@/services/environmentContext';
import { SPEECH_PERFORMANCE_KEY } from '../speechPerformanceSettings';
import type { SpeechPerformanceSettings } from '../speechPerformanceSettings';
import { createGradiumIncrementalTurn, gradiumProvider, prepareTextForGradium } from './gradium';
import mapping from '@/agents/__fixtures__/speechMappingSandbox20261025.json';
import sheets from '@/agents/__fixtures__/speechSandbox20261025.json';
import { ResponseIntentParser, SPEECH_BOUNDARY } from '@/services/responseIntentStream';
import { createGradiumSpeechPreparer } from '../gradiumSpeech';

describe('Gradium — mapping sandbox sur les deux transports effectifs', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); setActiveEnvironment('sandbox-ulrich');
    transport.create.mockReturnValue({ configure: transport.configure, appendText: vi.fn() });
    vi.mocked(authenticatedFunctionFetch).mockImplementation(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/wav' } }));
  });
  it('opens pauses only for an opted-in environment and an authorized matching state/version', () => {
    const settings = { ...mapping, gradiumPausesEnabled: true } as SpeechPerformanceSettings;
    const intent = derivePerformanceIntent({ text: 'Oui…', characterKey: 'max', speechState: 'Bloqué',
      validSpeechStates: ['Bloqué'], rugosite: 3, speechSettings: settings });
    expect(resolveGradiumPauseSeconds(intent, 'max', settings)).toBe(1);
    expect(resolveGradiumPauseSeconds(intent, 'max', mapping as SpeechPerformanceSettings)).toBeUndefined();
    expect(resolveGradiumPauseSeconds(intent, 'max', { ...settings, enabled: false })).toBeUndefined();
    expect(resolveGradiumPauseSeconds({ ...intent, source: 'lexicon' }, 'max', settings)).toBeUndefined();
    expect(resolveGradiumPauseSeconds({ ...intent, mappingVersion: 'stale' }, 'max', settings)).toBeUndefined();
    expect(resolveGradiumPauseSeconds(intent, 'other', settings)).toBeUndefined();
    const neutral = derivePerformanceIntent({ text: 'Oui…', characterKey: 'max', speechState: 'Bloqué',
      validSpeechStates: ['Bloqué'], rugosite: 0, speechSettings: settings });
    expect(resolveGradiumPauseSeconds(neutral, 'max', settings)).toBeUndefined();
    setActiveEnvironment('prod'); expect(resolveGradiumPauseSeconds(intent, 'max', { ...settings, gradiumPausesEnabled: false })).toBeUndefined();
  });
  it('compiles the validated raw speech after performance setup and keeps REST explicitly clean', async () => {
    const settings = { ...mapping, gradiumPausesEnabled: true } as SpeechPerformanceSettings;
    writeEnvironmentStorage(SPEECH_PERFORMANCE_KEY, JSON.stringify(settings));
    const intent = derivePerformanceIntent({ text: 'Oui… attends.', characterKey: 'max', speechState: 'Bloqué',
      validSpeechStates: ['Bloqué'], rugosite: 3, speechSettings: settings });
    const turn = createGradiumIncrementalTurn({ characterKey: 'max', resolveSpeechPerformance: () => intent });
    turn.setPerformance(intent);
    const options = transport.create.mock.calls.at(-1)![0];
    expect(options.prepareText('Oui… attends.')).toBe('Oui <break time="1s" /> attends.');
    turn.appendText('Oui… attends.');
    turn.setPerformance({ ...intent, pauses: 'short' });
    expect(transport.configure).toHaveBeenCalledOnce();
    const fallback = await turn.generateFallback('Oui… attends.', new AbortController().signal);
    expect(fallback.meta.pauseRendering).toBe('rest_unavailable');
    const body = JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls.at(-1)![1]?.body));
    expect(body.text).toBe('Oui, attends.'); expect(body).not.toHaveProperty('type');
    expect(body.text).not.toContain('<');
    setActiveEnvironment('sandbox-romed');
    const isolated = createGradiumIncrementalTurn({ characterKey: 'max', performance: intent });
    expect(transport.create.mock.calls.at(-1)![0].prepareText('Oui… attends.')).toBe('Oui, attends.');
    expect(isolated).toBeDefined();
  });
  it('ne convertit pas une suspension interne en point par une frontière SSE/TTS', () => {
    const sheet = sheets.find(sheet => sheet.name.startsWith('Max'))!;
    const context = { characterKey: 'max' as const, characterId: sheet.character_id, displayName: sheet.name,
      notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: sheet.updated_at };
    const wire = JSON.stringify({ goal: 'Écouter', points: [], parole: 'Bloqué' }) + SPEECH_BOUNDARY + 'Je… je sais pas. Emma, elle…';
    for (let split = 0; split <= wire.length; split++) {
      const segments: string[] = [];
      const parser = new ResponseIntentParser(context, () => {}, text => segments.push(prepareTextForGradium(text)));
      parser.push(wire.slice(0, split)); parser.push(wire.slice(split)); parser.finish();
      expect(segments.join(' ')).toBe(prepareTextForGradium('Je… je sais pas. Emma, elle…'));
    }
  });
  it('conserves pauses and words across every SSE split without splitting a resumption', () => {
    const sheet = sheets.find(sheet => sheet.name.startsWith('Max'))!;
    const context = { characterKey: 'max' as const, characterId: sheet.character_id, displayName: sheet.name,
      notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: sheet.updated_at };
    const text = 'Allô ? Oui… c’est vous qui deviez… Oui. Mais elle…';
    const wire = JSON.stringify({ goal: 'PRIVATE', points: [], parole: 'Bloqué' }) + SPEECH_BOUNDARY + text;
    const expected = createGradiumSpeechPreparer(() => 1)(text).replace(/\s+/g, ' ').trim();
    for (let split = 0; split <= wire.length; split++) {
      const chunks: string[] = [], prepare = createGradiumSpeechPreparer(() => 1);
      const parser = new ResponseIntentParser(context, () => {}, speech => chunks.push(prepare(speech)));
      parser.push(wire.slice(0, split)); parser.push(wire.slice(split)); parser.finish();
      expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(expected);
    }
  });
  it.each(['max', 'emma'] as const)('%s conserve ses cinq états, voix, version et mots en batch, setup et fallback', async key => {
    const sheet = sheets.find(sheet => sheet.name.toLowerCase().startsWith(key))!;
    expect(Object.keys(mapping.byCharacter[key])).toEqual(sheet.speech_states.map(state => state.name));
    const text = key === 'max' ? 'Je… je sais pas. Emma, elle…' : 'Max, il… bon. Ava — attends.';
    for (const state of sheet.speech_states) {
      const intent = derivePerformanceIntent({ text, characterKey: key, speechState: state.name,
        validSpeechStates: sheet.speech_states.map(state => state.name), rugosite: 3,
        speechSettings: mapping as SpeechPerformanceSettings });
      expect(intent).toMatchObject({ source: 'speech_state', speechState: state.name, mappingVersion: mapping.version });
      await gradiumProvider.generate(text, { characterKey: key, performance: intent });
      const body = JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls.at(-1)![1]?.body));
      const incremental = createGradiumIncrementalTurn({ characterKey: key, resolveSpeechPerformance: () => intent });
      incremental.setPerformance(intent);
      expect(transport.create.mock.calls.at(-1)![0]).toMatchObject({ voiceId: `${key}-voice`, deferSetup: true });
      expect(transport.configure.mock.calls.at(-1)![0]).toEqual(body.jsonConfig);
      const base = { temp: key === 'max' ? 0.7 : 0.65, paddingBonus: key === 'max' ? 0.2 : 0 };
      expect(body.jsonConfig).toMatchObject({ temp: base.temp, padding_bonus: applyGradiumPerformance(base, intent).paddingBonus });
      expect(body.text).toBe(prepareTextForGradium(text));
      expect(body.text).not.toMatch(/[<>[\]]/);
      await incremental.generateFallback(text, new AbortController().signal);
      expect(JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls.at(-1)![1]?.body))).toEqual(body);
    }
  });
});
