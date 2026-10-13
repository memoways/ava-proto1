import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ clock: { currentTime: 0, outputLatency: 0.1, state: 'running' }, sources: [] as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (()=>void)|null }[] }));
vi.mock('@/services/audioPlayback', () => ({getSharedAudioContext: () => ({ ...mock.clock,
  createGain: () => ({connect:vi.fn(),disconnect:vi.fn()}),
  createBuffer: (_:number,n:number,rate:number) => ({getChannelData:()=>new Float32Array(n),duration:n/rate}),
  createBufferSource: () => { const s={start:vi.fn(),stop:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),onended:null}; mock.sources.push(s); return s; },
})}));
vi.mock('@/services/gameAuth', () => ({authenticatedFunctionFetch: vi.fn(async()=>new Response(JSON.stringify({token:'test'})))}));
import {createGradiumTurnSession, createGradiumStreamSession} from './gradiumStreamPlayer';
import {authenticatedFunctionFetch} from '../gameAuth';
class Socket {
  static all: Socket[]=[];
  sent: {type:string;text?:string;voice_id?:string}[]=[];
  onopen: null | (()=>void)=null; onmessage: null | ((e:MessageEvent)=>void)=null;
  onerror: null | (()=>void)=null; onclose: null | ((e:{code:number;reason:string})=>void)=null;
  close=vi.fn(); send(raw:string){this.sent.push(JSON.parse(raw));}
  constructor(){Socket.all.push(this);}
  message(value:unknown){this.onmessage?.({data:JSON.stringify(value)} as MessageEvent);}
}
const audio=(seconds:number)=>({type:'audio',audio:btoa('\0'.repeat(2*Math.round(24000*seconds)))});
const opts={voiceId:'max-voice',format:'pcm_24000' as const,jsonConfig:{temp:0.5}};
async function socket(){await vi.waitFor(()=>expect(Socket.all).toHaveLength(1));const ws=Socket.all[0]; ws.onopen?.();return ws;}
describe('Gradium incremental turn',()=>{
  beforeEach(()=>{Socket.all=[]; mock.sources=[];mock.clock.currentTime=0;vi.stubGlobal('WebSocket',Socket);vi.mocked(authenticatedFunctionFetch).mockClear();});
  afterEach(()=>{vi.unstubAllGlobals();});
  it('prepares one setup, appends in the same voice context and sends EOS only on finish',async()=>{
    const session=createGradiumTurnSession(opts),ws=await socket(); expect(ws.sent.map(x=>x.type)).toEqual(['setup']);
    session.appendText('Bonjour.');session.appendText('Je vous écoute.');expect(ws.sent.map(x=>x.type)).toEqual(['setup','text','text']);
    expect(ws.sent[0].voice_id).toBe('max-voice');expect(authenticatedFunctionFetch).toHaveBeenCalledTimes(1);
    session.finish();session.finish();expect(ws.sent.filter(x=>x.type==='end_of_stream')).toHaveLength(1);session.cancel();
  });
  it('starts audio before generationDone, counts read samples conservatively and freezes on cancellation',async()=>{
    const session=createGradiumTurnSession(opts),ws=await socket();session.appendText('Bonjour.');session.open();
    let generationDone=false;void session.generationDone.then(()=>{generationDone=true;}).catch(()=>{});
    ws.message(audio(0.4));await session.started; expect(generationDone).toBe(false);
    ws.message({type:'text',text:'Bonjour.',start_s:0,stop_s:0.3});
    mock.clock.currentTime=0.3;expect(session.progress().confirmedText).toBe('');expect(session.progress().playedSamples).toBeGreaterThan(0);
    mock.clock.currentTime=0.44;expect(session.progress().confirmedText).toBe('Bonjour.');
    const stale=ws.onmessage;session.cancel();const progress=session.progress();mock.clock.currentTime=10;
    stale?.({data:JSON.stringify(audio(0.4))} as MessageEvent);expect(session.progress()).toEqual(progress);
    expect(mock.sources).toHaveLength(1);expect(mock.sources[0].stop).toHaveBeenCalled();expect(mock.sources[0].onended).toBeNull();
    await expect(session.finished).rejects.toMatchObject({name:'AbortError'});
  });
  it('waits for played samples after EOS instead of equating generated with delivered',async()=>{
    const session=createGradiumTurnSession(opts),ws=await socket();session.appendText('Oui.');session.open();session.finish();ws.message(audio(0.4));ws.message({type:'end_of_stream'});
    await session.generationDone;let finished=false;void session.finished.then(()=>{finished=true;});
    mock.clock.currentTime=0.43;mock.sources[0].onended?.();expect(finished).toBe(false);
    mock.clock.currentTime=0.6;await session.finished;expect(session.progress().playedSamples).toBe(9600);
  });
  it('rejects overflow and a socket closed in mid-generation without replay',async()=>{
    const session=createGradiumTurnSession(opts),ws=await socket();session.appendText('Bonjour.');session.open();ws.message(audio(31));await expect(session.finished).rejects.toThrow('buffer');expect(mock.sources).toHaveLength(0);
    Socket.all=[];const second=createGradiumTurnSession(opts),ws2=await socket();second.appendText('Bonjour.');second.open();ws2.message(audio(0.4));ws2.onclose?.({code:1000,reason:''});await expect(second.finished).rejects.toThrow('during turn');
  });
  it('keeps whole-segment compatibility and rejects append after finish',async()=>{
    const session=createGradiumStreamSession('Oui.',opts),ws=await socket();expect(ws.sent.map(x=>x.type)).toEqual(['setup','text','end_of_stream']);expect(()=>session.appendText('Non.')).toThrow('after finish');session.cancel();
  });
});
