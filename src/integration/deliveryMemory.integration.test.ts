// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyConversationMemory, mergeConversationMemory } from '@/services/conversationMemoryV1';
import type { ResponseDeliveryReceipt } from '@/services/responseDelivery';
const harness=vi.hoisted(()=>({query: null as unknown as (sql:string,args?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>,beforeUpdate:null as null|(()=>Promise<void>)}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc:(_name:string,args:Record<string,unknown>)=>({async maybeSingle(){
 if(harness.beforeUpdate){const hook=harness.beforeUpdate;harness.beforeUpdate=null;await hook();}
 const r=await harness.query('select * from public.persist_conversation_memory_v4($1::uuid,$2::jsonb,$3::jsonb,$4::integer,$5::integer,$6::jsonb)',[args.p_session_id,JSON.stringify(args.p_expected_memory),JSON.stringify(args.p_next_memory),args.p_expected_last_turn??null,args.p_next_last_turn??null,args.p_post_turn_log?JSON.stringify(args.p_post_turn_log):null]);
 return {data:r.rows[0]??null,error:null};
}}),from:()=>{
 const filters:Record<string,unknown>={};let values:Record<string,unknown>|null=null;
 const q={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},is:(k:string,v:unknown)=>{filters[k]=v;return q;},update:(v:Record<string,unknown>)=>{values=v;return q;},
 async maybeSingle(){
  if(!values){const r=await harness.query('select * from sessions where id=$1',[filters.id]);return {data:r.rows[0]??null,error:null};}
  if(harness.beforeUpdate){const hook=harness.beforeUpdate;harness.beforeUpdate=null;await hook();}
  const args:unknown[]=[];const sets=Object.entries(values).map(([k,v])=>{args.push(typeof v==='object'?JSON.stringify(v):v);return `${k}=$${args.length}${k==='memory_last_turn'?'':'::jsonb'}`;});
  const where=Object.entries(filters).map(([k,v])=>{if(v===null)return `${k} is null`;args.push(v);return `${k}=$${args.length}${k==='conversation_memory'?'::jsonb':''}`;});
  const r=await harness.query(`update sessions set ${sets.join(',')} where ${where.join(' and ')} returning *`,args);return {data:r.rows[0]??null,error:null};
 }};return q;
}}}));
import { fetchConversationMemory, persistDeliveryReceipt, persistPostTurnMemory, clearConversationMemoryCache } from '@/services/sessionConversationMemory';
const receipt:ResponseDeliveryReceipt={turnId:'t1',turnIndex:1,character:'max',intent:{goal:'Écouter',points:[]},generated:'Bonjour. Secret.',delivered:'Bonjour.',uncertain:' Secret.',privateContinuation:'',status:'interrupted',scheduledSamples:100,playedSamples:50,sampleRate:24000};
const entry={engagement_delta:0,confusion_detected:false,role_usage_quality:'unknown' as const,topics_covered:[],transition_recommended:false,cinematic_hint:null,next_turn_guidance:'',end_recommended:false,moderation_flag:false,notes:''};
describe('V4 receipt persistence and optimistic JSONB concurrency',()=>{
 let db:PGlite;let id:string;
 beforeEach(async()=>{db=new PGlite();id=crypto.randomUUID();harness.query=(sql,args)=>db.query(sql,args);harness.beforeUpdate=null;clearConversationMemoryCache();await db.exec('create role authenticated; create role anon; create table sessions(id uuid primary key,conversation_memory jsonb,memory_last_turn integer default 0,gm_post_turn_log jsonb default \'[]\'::jsonb)');await db.exec(await readFile(new URL('../../supabase/migrations/20261013171500_persist_memory_v4_cas.sql',import.meta.url),'utf8'));await db.query('insert into sessions(id,conversation_memory) values($1,$2::jsonb)',[id,JSON.stringify(createEmptyConversationMemory())]);});
 afterEach(async()=>db.close());
 it('retains receipt locally immediately and persists without advancing factual cursor',async()=>{
  const write=persistDeliveryReceipt(id,receipt);expect((await fetchConversationMemory(id)).deliveryByCharacter?.max?.[0]).toEqual(receipt);await write;
  const row=(await db.query<{memory_last_turn:number;conversation_memory:Record<string,unknown>}>('select * from sessions')).rows[0];expect(row.memory_last_turn).toBe(0);expect(row.conversation_memory.deliveryByCharacter).toEqual({max:[receipt]});
 });
 it('retries receipt CAS after an independent GM write and preserves both characters and facts',async()=>{
  harness.beforeUpdate=async()=>{const memory=mergeConversationMemory(createEmptyConversationMemory(),{userFacts:['Alice appelle.']},2,'emma');await db.query('update sessions set conversation_memory=$1::jsonb,memory_last_turn=2',[JSON.stringify(memory)]);};
  await persistDeliveryReceipt(id,receipt);const memory=await fetchConversationMemory(id,{force:true});expect(memory.characterStates?.emma?.userFacts[0].text).toBe('Alice appelle.');expect(memory.deliveryByCharacter?.max?.[0]).toEqual(receipt);expect(memory.lastTurn).toBe(2);
 });
 it('GM CAS preserves a receipt that arrives between read and update',async()=>{
  harness.beforeUpdate=async()=>{await db.query("update sessions set conversation_memory=jsonb_set(conversation_memory,'{deliveryByCharacter}', $1::jsonb)",[JSON.stringify({emma:[{...receipt,turnId:'emma-1',character:'emma'}]})]);};
  const memory=await persistPostTurnMemory(id,entry,{userFacts:['Alice appelle.']},3,'max');expect(memory.deliveryByCharacter?.emma?.[0].turnId).toBe('emma-1');expect(memory.characterStates?.max?.userFacts[0].text).toBe('Alice appelle.');
 });
});
