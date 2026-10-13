import { describe, expect, it, vi, afterEach } from 'vitest';
vi.mock('@/services/gameAuth',()=>({authenticatedFunctionFetch:vi.fn()}));
import {authenticatedFunctionFetch} from '@/services/gameAuth';
import {gradiumProvider} from './gradium';
afterEach(()=>vi.useRealTimers());
describe('Gradium REST body ownership',()=>{
 it('cancels a blocked audio reader after headers when the parent is aborted',async()=>{
  const parent=new AbortController(),cancel=vi.fn();
  vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({cancel}),{headers:{'Content-Type':'audio/wav'}}));
  const pending=gradiumProvider.generate('Bonjour.',{signal:parent.signal});await vi.waitFor(()=>expect(authenticatedFunctionFetch).toHaveBeenCalled());await Promise.resolve();parent.abort('barge-in');
  await expect(pending).rejects.toMatchObject({name:'AbortError'});expect(cancel).toHaveBeenCalled();expect(vi.mocked(authenticatedFunctionFetch).mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
 });
 it('cancels the reader at the existing body deadline and rejects empty audio',async()=>{
  vi.useFakeTimers();const cancel=vi.fn();vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({cancel})));
  const pending=gradiumProvider.generate('Bonjour.');const rejected=expect(pending).rejects.toThrow(/timed out|deadline/);await vi.advanceTimersByTimeAsync(12001);await rejected;expect(cancel).toHaveBeenCalled();
  vi.mocked(authenticatedFunctionFetch).mockResolvedValueOnce(new Response(new Uint8Array()));await expect(gradiumProvider.generate('Bonjour.')).rejects.toThrow('empty audio');
 });
});
