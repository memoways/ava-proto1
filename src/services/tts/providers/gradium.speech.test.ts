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
import { derivePerformanceIntent, applyGradiumPerformance } from '../performanceIntent';
import type { SpeechPerformanceSettings } from '../speechPerformanceSettings';
import { createGradiumIncrementalTurn, gradiumProvider, prepareTextForGradium } from './gradium';
import mapping from '@/agents/__fixtures__/speechMappingSandbox20261025.json';
import sheets from '@/agents/__fixtures__/speechSandbox20261025.json';
import { ResponseIntentParser, SPEECH_BOUNDARY } from '@/services/responseIntentStream';

describe('Gradium — mapping sandbox sur les deux transports effectifs', () => {
  beforeEach(() => {
    vi.clearAllMocks(); setActiveEnvironment('sandbox-ulrich');
    transport.create.mockReturnValue({ configure: transport.configure });
    vi.mocked(authenticatedFunctionFetch).mockImplementation(async () => new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/wav' } }));
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
