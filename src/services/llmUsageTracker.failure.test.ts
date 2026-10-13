import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({update:vi.fn(),insert:vi.fn(),fetch:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>({insert:mocks.insert,update:mocks.update})}}));
vi.mock('./gameAuth',()=>({authenticatedFunctionFetch:mocks.fetch}));
import {trackLLMCall,retryCostForRow} from './llmUsageTracker';
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.clearAllMocks();});
describe('failed generation cost evidence',()=>{
 it.each(['available','unavailable'])('keeps failure status when cost is %s',async availability=>{
  vi.useFakeTimers();
  mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'usage-failed'}})})});
  mocks.update.mockReturnValue({eq:async()=>({error:null})});
  mocks.fetch.mockImplementation(async()=>new Response(JSON.stringify({cost_usd:availability==='available'?0.003:0,prompt_tokens:1800,completion_tokens:220,total_tokens:2020})));
  await trackLLMCall({generation_id:'gen-failed',feature_key:'prd4_chat',model:'model',status:'error'});
  await vi.advanceTimersByTimeAsync(110000);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'error'}));
  expect(mocks.update.mock.calls.every(([v])=>v.status==='error')).toBe(true);
 });
 it('keeps failure status during an explicit admin cost retry',async()=>{
  mocks.update.mockReturnValue({eq:async()=>({error:null})});
  mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({cost_usd:0.003})));
  expect(await retryCostForRow({id:'usage-failed',generation_id:'gen-failed',status:'error',prompt_tokens:0,completion_tokens:0,total_tokens:0})).toBe(true);
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:'error',cost_usd:0.003}));
 });
});
