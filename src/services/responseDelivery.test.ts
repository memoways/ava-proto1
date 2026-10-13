import { describe, expect, it } from 'vitest';
import { normalizeDeliveries, projectDeliveredConversation, formatPrivateDeliveryContext, type ResponseDeliveryReceipt } from './responseDelivery';
import { createEmptyConversationMemory, normalizeConversationMemory, mergeConversationMemory, filterConversationMemoryForCharacter } from './conversationMemoryV1';
const receipt: ResponseDeliveryReceipt = {turnId:'turn-1',turnIndex:1,character:'max',intent:{goal:'Répondre prudemment',points:[]},generated:'Bonjour. Mon secret.',delivered:'Bonjour.',uncertain:' Mon',privateContinuation:' secret.',status:'interrupted',scheduledSamples:100,playedSamples:50,sampleRate:24000};
describe('P1 V4 delivery memory',()=>{
  it.each([1,2,3] as const)('normalizes V%s without rewriting old facts or inventing delivery', version=>{
    const old={...createEmptyConversationMemory(),version,maxDisclosures:[{id:'old',text:'Fait historique.',sourceTurn:1}],deliveryByCharacter:undefined};
    const memory=normalizeConversationMemory(old);expect(memory.version).toBe(4);expect(memory.maxDisclosures).toEqual(old.maxDisclosures);expect(memory.deliveryByCharacter).toEqual({});
    const history=[{role:'max' as const,content:'Historique sans reçu.',timestamp:1}]; expect(projectDeliveredConversation(history)).toEqual(history);
  });
  it('only projects heard prefix, not uncertain words or private continuation',()=>{
    const projected=projectDeliveredConversation([{role:'max',content:receipt.generated,timestamp:1,delivery:receipt}]);expect(projected[0].content).toBe('Bonjour.');
    expect(projectDeliveredConversation([{role:'max',content:receipt.generated,timestamp:1,delivery:{...receipt,delivered:''}}])).toEqual([]);
    expect(formatPrivateDeliveryContext([receipt])).toContain('ne pas affirmer entendue');
  });
  it('keeps receipts and intentions isolated even after factual GM merge',()=>{
    const memory=normalizeConversationMemory({...createEmptyConversationMemory(),deliveryByCharacter:{max:[receipt],emma:[{...receipt,character:'emma',turnId:'emma-1'}]}});
    const merged=mergeConversationMemory(memory,{userFacts:['Alice appelle.']},2,'max');
    expect(merged.deliveryByCharacter?.max).toEqual([receipt]);
    const emma=filterConversationMemoryForCharacter(merged,'emma');expect(emma.deliveryByCharacter?.max).toBeUndefined();expect(emma.characterStates?.max).toBeUndefined();expect(emma.maxDisclosures).toEqual([]);
    expect(emma.deliveryByCharacter?.emma?.[0].character).toBe('emma');
  });
  it('rejects foreign receipts and invented prefix while bounding storage',()=>{
    const normalized=normalizeDeliveries({max:[{...receipt,character:'emma'}, {...receipt,delivered:'Ava est ici.',uncertain:'faux'}]});expect(normalized.max).toHaveLength(1);expect(normalized.max?.[0].delivered).toBe('');expect(normalized.max?.[0].privateContinuation).toBe(receipt.generated);
    expect(normalizeDeliveries({max:Array.from({length:50},(_,i)=>({...receipt,turnId:`t${i}`}))}).max).toHaveLength(16);
  });
});
