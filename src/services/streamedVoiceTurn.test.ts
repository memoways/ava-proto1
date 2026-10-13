import { describe, expect, it, vi, beforeEach } from 'vitest';
const fake = vi.hoisted(()=>({create:vi.fn()}));
vi.mock('./tts/providers/gradium',()=>({createGradiumIncrementalTurn:fake.create,prepareTextForGradium:(s:string)=>s}));
import {prepareStreamedVoiceTurn} from './streamedVoiceTurn';
function deferred<T>(){let resolve!:(v:T)=>void, reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const ctx={characterKey:'max' as const,turn_id:'t1',turn_index:1};
const played={status:'played' as const,provider:'gradium',started:true,firstPlaybackStartMs:10,playbackTotalMs:100,generatedSegments:1,playedSegments:1,failedSegments:0};
function setup(){const start=deferred<void>(),gen=deferred<{firstByteMs:number;totalGenMs:number;bytes:number}>(),end=deferred<{playbackTotalMs:number}>();
 const session={started:start.promise,generationDone:gen.promise,finished:end.promise,appendText:vi.fn(),finish:vi.fn(),open:vi.fn(),cancel:vi.fn(),hasAudibleOutput:false,progress:vi.fn(()=>({scheduledSamples:0,playedSamples:0,sampleRate:24000,confirmedText:''}))};fake.create.mockReturnValue(session);return {session,start,gen,end};}
describe('P1 streamed voice delivery',()=>{
 beforeEach(()=>vi.clearAllMocks());
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
 it('cancellation before sound rejects delivery and late promises do not reanimate output',async()=>{
  const {start,gen,end}=setup(),controller=new AbortController(),receipt=vi.fn(),play=vi.fn(),fallback=vi.fn();const t=prepareStreamedVoiceTurn({...ctx,signal:controller.signal},{onReceipt:receipt,fallback,onPlaybackStart:play});controller.abort('session-end');start.resolve();gen.resolve({firstByteMs:1,totalGenMs:2,bytes:1});end.resolve({playbackTotalMs:5});await expect(t.delivery).rejects.toThrow();await t.finish();expect(play).not.toHaveBeenCalled();expect(fallback).not.toHaveBeenCalled();expect(receipt).toHaveBeenCalledTimes(1);
 });
});
