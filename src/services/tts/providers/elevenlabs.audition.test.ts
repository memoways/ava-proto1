import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/settingsService',()=>({getTTSSettings:()=>({modelId:'eleven_multilingual_v2',style:0.2,stability:0.5,speed:1})}));
vi.mock('@/services/gameAuth',()=>({authenticatedFunctionFetch:vi.fn(async()=>new Response(new Uint8Array([1]),{headers:{'Content-Type':'audio/mpeg'}}))}));
import { authenticatedFunctionFetch } from '@/services/gameAuth';
import { elevenLabsProvider } from './elevenlabs';
describe('ElevenLabs isolated v3 audition',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('forces v3 for the audition and leaves the following runtime request on the saved model',async()=>{
  await elevenLabsProvider.generate('Je… je sais.',{voiceId:'voice-test',auditionModelId:'eleven_v3'});
  await elevenLabsProvider.generate('Oui.');
  const first=JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls[0][1]?.body));
  const next=JSON.parse(String(vi.mocked(authenticatedFunctionFetch).mock.calls[1][1]?.body));
  expect(first.modelId).toBe('eleven_v3');expect(first.voiceId).toBe('voice-test');expect(next.modelId).toBe('eleven_multilingual_v2');
 });
});

describe("« Ava » pronunciation (G1)", () => {
  it("spells Ava phonetically for expressive models only", async () => {
    const { prepareElevenLabsText, ELEVENLABS_AVA_SPELLING } = await import("./elevenlabs");
    expect(prepareElevenLabsText("J’ai pris Ava dans mes bras. La chambre d’Ava.", "eleven_v4_turbo"))
      .toBe(`J’ai pris ${ELEVENLABS_AVA_SPELLING} dans mes bras. La chambre d’${ELEVENLABS_AVA_SPELLING}.`);
    expect(prepareElevenLabsText("Ava reste Ava. Avant, Avalon.", "eleven_v4")).toBe(`${ELEVENLABS_AVA_SPELLING} reste ${ELEVENLABS_AVA_SPELLING}. Avant, Avalon.`);
    expect(prepareElevenLabsText("J’ai pris Ava.", "eleven_multilingual_v2")).toBe("J’ai pris Ava.");
  });
});
