import { describe, expect, it, vi, beforeEach } from 'vitest';
const fake = vi.hoisted(()=>({create:vi.fn()}));
vi.mock('./tts/providers/gradium',()=>({createGradiumIncrementalTurn:fake.create,prepareTextForGradium:(s:string)=>s}));
import { ResponseIntentParser, SPEECH_BOUNDARY } from './responseIntentStream';
import { consumeLLMSse } from './llmSse';
import {prepareStreamedVoiceTurn} from './streamedVoiceTurn';
function deferred<T>(){let resolve!:(v:T)=>void, reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const ctx={characterKey:'max' as const,turn_id:'t1',turn_index:1};
const played={status:'played' as const,provider:'gradium',started:true,firstPlaybackStartMs:10,playbackTotalMs:100,generatedSegments:1,playedSegments:1,failedSegments:0};
function setup(){const start=deferred<void>(),gen=deferred<{firstByteMs:number;totalGenMs:number;bytes:number}>(),end=deferred<{playbackTotalMs:number}>();
 const session={setPerformance:vi.fn(),started:start.promise,generationDone:gen.promise,finished:end.promise,appendText:vi.fn(),finish:vi.fn(),open:vi.fn(),cancel:vi.fn(),hasAudibleOutput:false,progress:vi.fn(()=>({scheduledSamples:0,playedSamples:0,sampleRate:24000,confirmedText:''}))};fake.create.mockReturnValue(session);return {session,start,gen,end};}
describe('P1 streamed voice delivery',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it.each(["Moi, ça va. Non. J'en sais rien. Mais elle…", 'Je la laisserai pas toute seule.'])('finalise le reçu exact sans compléter la pensée : %s', async speech => {
  const { session, start, gen, end } = setup(), onReceipt = vi.fn(), fallback = vi.fn();
  const voice = prepareStreamedVoiceTurn(ctx, { onReceipt, fallback, onPlaybackStart: vi.fn() });
  const context = { characterKey: 'max' as const, displayName: 'Max Lorenzo', characterId: '11111111-1111-4111-8111-111111111111',
    notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: '2026-10-25T00:00:00Z' };
  const parser = new ResponseIntentParser(context, intent => voice.onEvent({ type: 'intent', intent }),
    text => voice.onEvent({ type: 'segment', text }));
  parser.push(JSON.stringify({ goal: 'PRIVATE', points: [] }) + SPEECH_BOUNDARY + speech);
  voice.onEvent({ type: 'complete', response: parser.finish(true) });
  start.resolve(); gen.resolve({ firstByteMs: 1, totalGenMs: 2, bytes: 100 }); end.resolve({ playbackTotalMs: 10 });
  expect((await voice.finish()).status).toBe('played');
  expect(await voice.delivery).toBe(speech);
  expect(session.appendText.mock.calls.flat().join(' ')).toBe(speech);
  expect(onReceipt).toHaveBeenCalledOnce();
  expect(onReceipt.mock.calls[0][0]).toMatchObject({ generated: speech, delivered: speech, uncertain: '', privateContinuation: '', intent: { goal: 'PRIVATE' } });
  expect(fallback).not.toHaveBeenCalled();
 });
 it('configures state prosody before the first segment without marking it delivered',()=>{
  const {session}=setup(),receipt=vi.fn();
  const intent={emotion:'urgent' as const,intensity:2 as const,source:'speech_state' as const,actingNl:'fast'};
  const resolve=vi.fn(()=>intent);
  const t=prepareStreamedVoiceTurn({...ctx,resolveSpeechPerformance:resolve},{onReceipt:receipt,onPlaybackStart:vi.fn()});
  t.onEvent({type:'intent',intent:{goal:'secret',points:[],parole:'La digue cède'}});
  t.onEvent({type:'segment',text:'Je… je sais.'});t.onEvent({type:'segment',text:'Oui.'});
  expect(resolve).toHaveBeenCalledWith('La digue cède','Je… je sais.');
  expect(session.setPerformance).toHaveBeenCalledOnce();
  expect(session.setPerformance.mock.invocationCallOrder[0]).toBeLessThan(session.appendText.mock.invocationCallOrder[0]);
  expect(receipt).not.toHaveBeenCalled();t.cancel();
 });
 it('preserves words and receipts when interrupted inside a suspension before its continuation', async () => {
  const { session, start } = setup(), controller = new AbortController(), onReceipt = vi.fn(), fallback = vi.fn();
  session.hasAudibleOutput = true;
  const voice = prepareStreamedVoiceTurn({ ...ctx, signal: controller.signal }, { onReceipt, fallback, onPlaybackStart: vi.fn() });
  voice.onEvent({ type: 'segment', text: 'Oui… attends.' });
  voice.onEvent({ type: 'segment', text: 'La suite.' });
  expect(session.appendText).toHaveBeenNthCalledWith(1, 'Oui… attends.');
  start.resolve(); await Promise.resolve();
  // The clock has crossed silence, but no timestamp for "attends" has passed.
  session.progress.mockReturnValue({ scheduledSamples: 48000, playedSamples: 24000, sampleRate: 24000, confirmedText: 'Oui' });
  controller.abort('player-barge-in');
  expect(onReceipt.mock.calls[0][0]).toMatchObject({ delivered: '', uncertain: 'Oui… attends. La suite.', status: 'interrupted' });
  await expect(voice.delivery).rejects.toThrow('No confirmed');
  expect(fallback).not.toHaveBeenCalled();
 });
 it('keeps intention out of TTS and finalizes only when the samples finished',async()=>{
  const {session,start,gen,end}=setup(),receipt=vi.fn(),fallback=vi.fn(),onPlaybackStart=vi.fn();const t=prepareStreamedVoiceTurn(ctx,{onReceipt:receipt,fallback,onPlaybackStart});
  t.onEvent({type:'intent',intent:{goal:'secret',points:[]}});expect(session.appendText).not.toHaveBeenCalled();
  t.onEvent({type:'segment',text:'Bonjour.'});start.resolve();await Promise.resolve();expect(onPlaybackStart).toHaveBeenCalled();expect(receipt).not.toHaveBeenCalled();
  t.onEvent({type:'complete',response:'Bonjour.'});const result=t.finish();gen.resolve({firstByteMs:10,totalGenMs:80,bytes:100});await Promise.resolve();expect(receipt).not.toHaveBeenCalled();end.resolve({playbackTotalMs:100});
  expect((await result).status).toBe('played');expect(await t.delivery).toBe('Bonjour.');expect(session.appendText).toHaveBeenCalledWith('Bonjour.');expect(fallback).not.toHaveBeenCalled();
 });
 it('preserves partial receipt and unfinished generated continuation on confirmed interruption',async()=>{
  const {session}=setup(),receipt=vi.fn(),controller=new AbortController();session.progress.mockReturnValue({scheduledSamples:1000,playedSamples:500,sampleRate:24000,confirmedText:'Bonjour.'});
  const t=prepareStreamedVoiceTurn({...ctx,signal:controller.signal},{onReceipt:receipt,fallback:vi.fn(),onPlaybackStart:vi.fn()});
  t.onEvent({type:'intent',intent:{goal:'Garder un point à reprendre',points:[]}});t.onEvent({type:'segment',text:'Bonjour.'});t.onEvent({type:'segment',text:'Mon secret.'});controller.abort('player-barge-in');
  t.onEvent({type:'interrupted',intent:{goal:'Garder un point à reprendre',points:[]},generated:'Bonjour. Mon secret. Une autre idée',error:new Error('abort')});
  expect(receipt.mock.calls.at(-1)?.[0]).toMatchObject({delivered:'Bonjour.',status:'interrupted',privateContinuation:' Une autre idée'});expect(await t.delivery).toBe('Bonjour.');
  t.onEvent({type:'segment',text:'Callback périmée.'});expect(session.appendText).toHaveBeenCalledTimes(2);
 });
 it('rebases delivered offsets on original paragraphs after interruption',async()=>{
  const {session}=setup(),receipt=vi.fn(),controller=new AbortController();session.progress.mockReturnValue({scheduledSamples:1000,playedSamples:500,sampleRate:24000,confirmedText:'Bonjour. Oui.'});
  const t=prepareStreamedVoiceTurn({...ctx,signal:controller.signal},{onReceipt:receipt,fallback:vi.fn(),onPlaybackStart:vi.fn()});
  t.onEvent({type:'segment',text:'Bonjour.'});t.onEvent({type:'segment',text:'Oui.'});controller.abort('player-barge-in');
  t.onEvent({type:'interrupted',intent:null,generated:'Bonjour.\n\nOui. La suite',error:new Error('abort')});
  expect(receipt.mock.calls.at(-1)?.[0]).toMatchObject({generated:'Bonjour.\n\nOui. La suite',delivered:'Bonjour.\n\nOui.',privateContinuation:' La suite'});
 });
 it('output cancellation stops pending transport and fallback through their own signal',async()=>{
  const {end,start,gen}=setup(),receipt=vi.fn(),fallback=vi.fn((_text:string,signal:AbortSignal)=>new Promise<typeof played>(resolve=>signal.addEventListener('abort',()=>resolve({...played,status:'played'}),{once:true})));
  const t=prepareStreamedVoiceTurn(ctx,{onReceipt:receipt,fallback,onPlaybackStart:vi.fn()});t.onEvent({type:'segment',text:'Bonjour.'});start.reject(new Error('ws'));gen.reject(new Error('ws'));end.reject(new Error('ws'));await Promise.resolve();const pending=t.finish();await Promise.resolve();
  t.cancel('tts-first-audio-deadline');await pending;expect(fallback.mock.calls[0][1].aborted).toBe(true);await expect(t.delivery).rejects.toThrow();expect(receipt).toHaveBeenCalledTimes(1);
 });
 it('falls back once before sound and never replays after scheduled output',async()=>{
  const a=setup(),fallback=vi.fn(async()=>played),receipt=vi.fn();const t=prepareStreamedVoiceTurn(ctx,{onReceipt:receipt,fallback,onPlaybackStart:vi.fn()});
  a.start.reject(new Error('ws'));a.gen.reject(new Error('ws'));a.end.reject(new Error('ws'));await Promise.resolve();t.onEvent({type:'segment',text:'Bonjour.'});t.onEvent({type:'complete',response:'Bonjour.'});expect((await t.finish()).status).toBe('played');expect(fallback).toHaveBeenCalledTimes(1);
  const b=setup();b.session.hasAudibleOutput=true;const fallback2=vi.fn(),other=prepareStreamedVoiceTurn(ctx,{onReceipt:vi.fn(),fallback:fallback2,onPlaybackStart:vi.fn()});other.onEvent({type:'segment',text:'Bonjour.'});b.start.resolve();await Promise.resolve();b.end.reject(new Error('drop'));b.gen.reject(new Error('drop'));await Promise.resolve();expect((await other.finish()).status).toBe('failed');expect(fallback2).not.toHaveBeenCalled();
 });
 it('preserves a failed REST playback as failure when nothing was cancelled',async()=>{
  const a=setup(),onReceipt=vi.fn();const t=prepareStreamedVoiceTurn(ctx,{onReceipt,fallback:vi.fn(async()=>({...played,status:'failed' as const,error:new Error('playback')})),onPlaybackStart:vi.fn()});
  a.start.reject(new Error('ws'));a.gen.reject(new Error('ws'));a.end.reject(new Error('ws'));await Promise.resolve();t.onEvent({type:'segment',text:'Bonjour.'});t.onEvent({type:'complete',response:'Bonjour.'});const result=await t.finish();expect(result.status).toBe('failed');expect(result.error?.message).toBe('playback');expect(onReceipt.mock.calls[0][0].status).toBe('failed');
 });
 it('does not invent a delivered prefix before timestamp confirmation',async()=>{
  const {session,start,gen,end}=setup(),receipt=vi.fn();
  Object.defineProperty(session,'hasAudibleOutput',{value:true});
  session.progress.mockReturnValue({scheduledSamples:1000,playedSamples:100,sampleRate:24000,confirmedText:''});
  const t=prepareStreamedVoiceTurn(ctx,{onReceipt:receipt,fallback:vi.fn(),onPlaybackStart:vi.fn()});
  t.onEvent({type:'segment',text:'Bonjour.'});t.onEvent({type:'segment',text:'La suite reste privée.'});
  start.resolve();gen.reject(new Error('drop'));end.reject(new Error('drop'));await Promise.resolve();
  const result=await t.finish();
  expect(result.status).toBe('failed');
  expect(receipt.mock.calls[0][0]).toMatchObject({status:'failed',delivered:'',uncertain:'Bonjour. La suite reste privée.'});
 });
 it('cancellation before sound rejects delivery and late promises do not reanimate output',async()=>{
  const {start,gen,end}=setup(),controller=new AbortController(),receipt=vi.fn(),play=vi.fn(),fallback=vi.fn();const t=prepareStreamedVoiceTurn({...ctx,signal:controller.signal},{onReceipt:receipt,fallback,onPlaybackStart:play});controller.abort('session-end');start.resolve();gen.resolve({firstByteMs:1,totalGenMs:2,bytes:1});end.resolve({playbackTotalMs:5});await expect(t.delivery).rejects.toThrow();await t.finish();expect(play).not.toHaveBeenCalled();expect(fallback).not.toHaveBeenCalled();expect(receipt).toHaveBeenCalledTimes(1);
 });
});


describe('lot 3 — unsafe terminal after audible output', () => {
 it.each(['length', 'eof', 'aborted'] as const)('preserves exact receipt without fallback or replay on %s', async failure => {
  const { session, start, gen, end } = setup();
  session.cancel.mockImplementation(() => { gen.reject(new Error('cancelled')); end.reject(new Error('cancelled')); });
  session.hasAudibleOutput = true;
  session.progress.mockReturnValue({ scheduledSamples: 1000, playedSamples: 500, sampleRate: 24000, confirmedText: 'Bonjour.' });
  const onReceipt = vi.fn(), fallback = vi.fn(), onPlaybackStart = vi.fn();
  const voice = prepareStreamedVoiceTurn(ctx, { onReceipt, fallback, onPlaybackStart });
  const context = { characterKey: 'max' as const, displayName: 'Max Lorenzo', characterId: '11111111-1111-4111-8111-111111111111',
    notionPageId: '30362322e5958011ad7bffb1ed6772bc', environmentId: 'sandbox-ulrich', promptUpdatedAt: '2026-10-25T00:00:00Z' };
  const parser = new ResponseIntentParser(context, intent => voice.onEvent({ type: 'intent', intent }),
    text => voice.onEvent({ type: 'segment', text }));
  const wire = JSON.stringify({ goal: 'PRIVATE', points: [] }) + SPEECH_BOUNDARY + 'Bonjour. Je te la passe maintenant.\n</speech';
  const controller = new AbortController();
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: wire } }] })}\n\n`
    + (failure === 'length' ? 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n' : ''));
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } });
  start.resolve(); await Promise.resolve();
  try {
    await consumeLLMSse(body, text => { parser.push(text); if (failure === 'aborted') controller.abort(); },
      { timeoutMs: 1000, signal: controller.signal });
    throw new Error('unexpected transport success');
  } catch (error) {
    voice.onEvent({ type: 'failed', intent: parser.intent, generated: parser.generated.trim(), error });
  }
  await voice.finish();
  expect(session.appendText.mock.calls).toEqual([['Bonjour. Je te la passe maintenant.']]);
  // One parser segment was submitted as a whole; without full alignment its
  // whole audio remains uncertain, never a fabricated delivered proportion.
  expect(onReceipt.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'failed', delivered: '',
    uncertain: 'Bonjour. Je te la passe maintenant.', privateContinuation: '\n</speech', intent: { goal: 'PRIVATE' } });
  expect(fallback).not.toHaveBeenCalled();
  expect(session.open).toHaveBeenCalledOnce();
 });
});
