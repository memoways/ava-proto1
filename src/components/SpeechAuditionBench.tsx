import { useEffect, useRef, useState } from 'react';
import { Play, Square, Save, Download, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { getActiveEnvironment } from '@/services/environmentContext';
import { listCharacterRuntimeProfiles } from '@/services/experienceOrchestration';
import { loadCharacterPromptByName } from '@/services/characterPromptService';
import { loadSpeechPerformanceSettings, saveSpeechPerformanceSettings, EMPTY_SPEECH_PERFORMANCE, proposeSpeechMapping, type SpeechPerformanceSettings } from '@/services/tts/speechPerformanceSettings';
import { AUDITION_PROVIDERS, createAuditionCorpus, auditionCount, auditionVoice, type AuditionLine } from '@/services/tts/speechAudition';
import { CANONICAL_EMOTIONS, derivePerformanceIntent, applyElevenLabsPerformance } from '@/services/tts/performanceIntent';
import { getProviderById } from '@/services/tts/registry';
import { getTTSSettings } from '@/services/settingsService';
import { getGradiumSettings, getHumeSettings, getInworldSettings, getCartesiaSettings } from '@/services/tts/providerSettings';
import { prepareTextForTTS } from '@/services/tts/textPrep';
import { prepareTextForGradium } from '@/services/tts/providers/gradium';
import type { TTSProviderId } from '@/services/tts/types';
interface Character { key: string; name: string; states: Array<{name:string;description:string}> }
interface Result { key:string; cached?:boolean; character:string; state:string; level:number; provider:string; model?:string; voice:string; sourceText:string; synthText:string; firstByteMs?:number; firstSoundMs?:number; totalMs?:number; durationMs?:number; error?:string; diction:string; artifacts:string; natural:string }
function exportResults(rows: Result[]) { const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='auditions-lot-b.json';a.click();URL.revokeObjectURL(url); }
export default function SpeechAuditionBench() {
 const sandbox=getActiveEnvironment()!=='prod';
 const [characters,setCharacters]=useState<Character[]>([]),[character,setCharacter]=useState('max');
 const [settings,setSettings]=useState<SpeechPerformanceSettings>(EMPTY_SPEECH_PERFORMANCE);
 const [corpora,setCorpora]=useState<Record<string,AuditionLine[]>>({});
 const [voices,setVoices]=useState<Record<string,string>>({});
 const [provider,setProvider]=useState<TTSProviderId>('gradium'),[level,setLevel]=useState(1),[lineIndex,setLineIndex]=useState(0);
 const [busy,setBusy]=useState(false),[results,setResults]=useState<Result[]>([]),[loadError,setLoadError]=useState('');
 const cache=useRef(new Map<string,Blob>()),controller=useRef<AbortController|null>(null),audio=useRef<HTMLAudioElement|null>(null),audioUrl=useRef<string|null>(null);
 const stop=()=>{controller.current?.abort();audio.current?.pause();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;};
 useEffect(()=>{if(!sandbox)return; let current=true;
  Promise.all([listCharacterRuntimeProfiles(),loadSpeechPerformanceSettings()]).then(async([profiles,saved])=>{
   const loaded=await Promise.all(profiles.filter(p=>['max','emma'].includes(p.character_key)).map(async p=>({key:p.character_key,name:p.display_name,states:(await loadCharacterPromptByName(p.display_name))?.speech_states??[]})));
   if(!current)return;setCharacters(loaded);setSettings(saved);
   setCorpora(Object.fromEntries(loaded.map(c=>[c.key,createAuditionCorpus(c.key,c.states.map(s=>s.name))])));
   setVoices(Object.fromEntries(profiles.filter(p=>p.tts_provider&&p.tts_voice_id).map(p=>[`${p.character_key}:${p.tts_provider}`,p.tts_voice_id??''])));
  }).catch(e=>{if(current)setLoadError(String(e));}); return()=>{current=false;stop();};
 },[sandbox]);
 if(!sandbox)return <section className="border-t pt-4"><h3 className="font-semibold">Lot B — Auditions</h3><p className="text-sm text-muted-foreground">Réservé aux environnements sandbox.</p></section>;
 const active=characters.find(c=>c.key===character),lines=corpora[character]??[];
 const line=lines[lineIndex],text=line?.variants[level-1]??'',voice=auditionVoice(voices,character,provider);
 const auditionSettings={...settings,enabled:true,byCharacter:{...settings.byCharacter,[character]:Object.fromEntries((active?.states??[]).map(s=>[s.name,settings.byCharacter[character]?.[s.name]??proposeSpeechMapping(s.name,s.description)]))}};
 const intent=derivePerformanceIntent({text,characterKey:character,speechState:line?.state,rugosite:level,validSpeechStates:active?.states.map(s=>s.name),speechSettings:auditionSettings});
 const prepared=provider==='gradium'?prepareTextForGradium(text):prepareTextForTTS(text);
 const synthText=provider==='elevenlabs'?applyElevenLabsPerformance({...getTTSSettings(),modelId:'eleven_v3'},prepared,intent).text:prepared;
 async function listen() {
  if(!voice||!text||!line?.state)return;
  stop();const abort=new AbortController();controller.current=abort;setBusy(true);
  const providerSettings={elevenlabs:getTTSSettings(),gradium:getGradiumSettings(),hume:getHumeSettings(),inworld:getInworldSettings(),cartesia:getCartesiaSettings()}[provider];
  const key=JSON.stringify({character,provider,level,text,voice,intent,providerSettings,model:provider==='elevenlabs'?'eleven_v3':null});
  const row:Result={key,character,state:line.state,level,provider,voice,sourceText:text,synthText,diction:'',artifacts:'',natural:''};
  const start=performance.now();
  try {
   let blob=cache.current.get(key);
   row.cached=Boolean(blob);
   if(blob)row.model=results.find(r=>r.key===key)?.model;
   if(!blob){const result=await getProviderById(provider).generate(text,{characterKey:character,voiceId:voice,performance:intent,signal:abort.signal,...(provider==='elevenlabs'?{auditionModelId:'eleven_v3' as const}:{})});blob=result.blob;Object.assign(row,result.meta);cache.current.set(key,blob);}
   abort.signal.throwIfAborted();audioUrl.current=URL.createObjectURL(blob);const player=new Audio(audioUrl.current);audio.current=player;
   await new Promise<void>((resolve,reject)=>{const cancel=()=>{player.pause();reject(new DOMException('Annulé','AbortError'));};abort.signal.addEventListener('abort',cancel,{once:true});player.onplaying=()=>{row.firstSoundMs=Math.round(performance.now()-start);};player.onended=()=>{row.durationMs=Math.round(player.duration*1000);abort.signal.removeEventListener('abort',cancel);resolve();};player.onerror=()=>{abort.signal.removeEventListener('abort',cancel);reject(new Error('Lecture audio impossible'));};player.play().catch(reject);});
   setResults(old=>[row,...old.filter(r=>r.key!==key)]);
  }catch(e){if(!abort.signal.aborted){row.error=e instanceof Error?e.message:String(e);setResults(old=>[row,...old.filter(r=>r.key!==key)]);toast.error(row.error);}}
  finally{setBusy(false);if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;}
 }
 const patchMapping=(state:string,patch:Partial<ReturnType<typeof proposeSpeechMapping>>)=>setSettings(old=>({...old,byCharacter:{...old.byCharacter,[character]:{...old.byCharacter[character],[state]:{...(old.byCharacter[character]?.[state]??proposeSpeechMapping(state,active?.states.find(s=>s.name===state)?.description??'')),...patch}}}}));
 return <section className="space-y-4 border-t pt-6" aria-label="Banc d'audition lot B">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">Lot B — Rendu par état et auditions</h3><Button variant="outline" size="sm" onClick={()=>exportResults(results)} title="Exporter les résultats"><Download className="mr-2 h-4 w-4"/>Exporter</Button></div>
  {loadError&&<p role="alert" className="text-destructive">{loadError}</p>}
  <div className="flex flex-wrap gap-4 items-center"><label className="flex items-center gap-2 text-sm"><Switch checked={settings.enabled} onCheckedChange={enabled=>setSettings(old=>({...old,enabled}))}/>Rendu par état en sandbox</label><Button size="sm" onClick={async()=>{try{setSettings(await saveSpeechPerformanceSettings(settings));toast.success('Rendu sandbox sauvegardé');}catch(e){toast.error(String(e));}}}><Save className="mr-2 h-4 w-4"/>Sauvegarder le rendu</Button></div>
  <Select value={character} onValueChange={value=>{stop();setCharacter(value);setLineIndex(0);}}><SelectTrigger aria-label="Personnage du banc"><SelectValue/></SelectTrigger><SelectContent>{characters.map(c=><SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}</SelectContent></Select>
  {!active?.states.length&&<p className="text-sm text-muted-foreground">États de parole indisponibles.</p>}
  <div className="space-y-4">{active?.states.map(state=>{const m=settings.byCharacter[character]?.[state.name]??proposeSpeechMapping(state.name,state.description);return <div className="border-b pb-3 space-y-2" key={state.name}><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{state.name}</strong>{!settings.byCharacter[character]?.[state.name]&&<Button size="sm" variant="outline" onClick={()=>patchMapping(state.name,{})}>Adopter la proposition</Button>}</div><p className="text-xs text-muted-foreground">{state.description}</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2"><Input aria-label={`Débit ${state.name}`} type="number" min="0.7" max="1.2" step="0.01" value={m.speed} onChange={e=>patchMapping(state.name,{speed:Math.max(0.7,Math.min(1.2,Number(e.target.value)||1))})}/><Select value={m.pauses} onValueChange={v=>patchMapping(state.name,{pauses:v as typeof m.pauses})}><SelectTrigger aria-label={`Pauses ${state.name}`}><SelectValue/></SelectTrigger><SelectContent>{['short','normal','long'].map(v=><SelectItem key={v} value={v}>{v==='short'?'Pauses courtes':v==='long'?'Pauses longues':'Pauses normales'}</SelectItem>)}</SelectContent></Select><Select value={m.delivery} onValueChange={v=>patchMapping(state.name,{delivery:v as typeof m.delivery})}><SelectTrigger aria-label={`Delivery ${state.name}`}><SelectValue/></SelectTrigger><SelectContent>{['measured','whisper','rushed','cutting'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Select value={m.emotion} onValueChange={v=>patchMapping(state.name,{emotion:v as typeof m.emotion})}><SelectTrigger aria-label={`Émotion ${state.name}`}><SelectValue/></SelectTrigger><SelectContent>{CANONICAL_EMOTIONS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><Input aria-label={`Instruction ${state.name}`} value={m.instruction} maxLength={70} onChange={e=>patchMapping(state.name,{instruction:e.target.value})}/></div>;})}</div>
  <h4 className="font-semibold">Auditions — {auditionCount(lines)} combinaisons / personnage</h4>
  <p className="text-xs text-muted-foreground">Corpus proposé, non canon Notion · 1 appel à la demande, rejeu en cache · coût fournisseur non mesuré · tags Gradium désactivés</p>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"><Select value={provider} onValueChange={v=>setProvider(v as TTSProviderId)}><SelectTrigger aria-label="Fournisseur du banc"><SelectValue/></SelectTrigger><SelectContent>{AUDITION_PROVIDERS.map(p=><SelectItem key={p} value={p}>{p==='elevenlabs'?'ElevenLabs v3':p}</SelectItem>)}</SelectContent></Select><Select value={String(level)} onValueChange={v=>setLevel(Number(v))}><SelectTrigger aria-label="Rugosité du banc"><SelectValue/></SelectTrigger><SelectContent>{[1,2,3].map(n=><SelectItem key={n} value={String(n)}>Rugosité {n}</SelectItem>)}</SelectContent></Select><Select value={String(lineIndex)} onValueChange={v=>setLineIndex(Number(v))}><SelectTrigger aria-label="Réplique du banc"><SelectValue/></SelectTrigger><SelectContent>{lines.map((_,i)=><SelectItem key={i} value={String(i)}>Réplique {i+1}</SelectItem>)}</SelectContent></Select></div>
  <Input aria-label={`Voix ${character} ${provider}`} placeholder="Voix à renseigner pour ce personnage et ce fournisseur" value={voice??''} onChange={e=>setVoices(old=>({...old,[`${character}:${provider}`]:e.target.value}))}/>
  <Select value={line?.state??''} onValueChange={state=>setCorpora(old=>({...old,[character]:lines.map((l,i)=>i===lineIndex?{...l,state}:l)}))}><SelectTrigger aria-label="État de la réplique"><SelectValue placeholder="État"/></SelectTrigger><SelectContent>{active?.states.map(s=><SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select>
  <Textarea aria-label="Texte source audition" value={text} onChange={e=>setCorpora(old=>({...old,[character]:lines.map((l,i)=>{if(i!==lineIndex)return l;const variants:[string,string,string]=[...l.variants];variants[level-1]=e.target.value;return {...l,variants};})}))}/>
  <p className="text-xs text-muted-foreground">Synthèse : {synthText}</p><p className="text-xs text-muted-foreground">{intent.source} · {intent.delivery} · débit {intent.speedHint} · {intent.actingNl}</p>
  <div className="flex flex-wrap gap-2"><Button onClick={()=>void listen()} disabled={busy||!voice||!text||!line?.state}><Play className="mr-2 h-4 w-4"/>Écouter</Button><Button variant="outline" onClick={stop} disabled={!busy} title="Arrêter"><Square className="h-4 w-4"/></Button><Button variant="outline" onClick={()=>{stop();cache.current.clear();setResults([]);}} title="Vider les résultats et le cache"><RotateCcw className="h-4 w-4"/></Button></div>
  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Écoute','Premier octet','Premier son','Durée','Diction','Artefacts','Naturel'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{results.map(r=><tr key={r.key} className="border-t"><td className="p-2">{r.character} · {r.provider} · {r.model??''} · {r.level}<br/>{r.state}{r.error&&<span className="text-destructive">{r.error}</span>}</td><td>{r.firstByteMs??'—'}</td><td>{r.firstSoundMs??'—'}</td><td>{r.durationMs??'—'}</td>{(['diction','artifacts','natural'] as const).map(field=><td key={field}><Input aria-label={`${field} ${r.character} ${r.provider}`} value={r[field]} onChange={e=>setResults(old=>old.map(row=>row.key===r.key?{...row,[field]:e.target.value}:row))}/></td>)}</tr>)}</tbody></table></div>
 </section>;
}
