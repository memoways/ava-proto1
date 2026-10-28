import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/openRouterLLM", () => ({
  callLLM: vi.fn(),
  callLLMWithUsage: vi.fn(),
  streamLLM: vi.fn(),
  LLMProxyRequestError: class extends Error {},
}));
vi.mock("@/services/debugLogger", () => ({ debugLogger: { log: vi.fn() } }));
vi.mock("@/services/settingsService", () => ({
  getGameplaySettings: vi.fn(),
  getLLMSettings: vi.fn(),
  getAntiHallucinationValidatorSettings: vi.fn(),
  isReasoningEnabledForModel: vi.fn(() => false),
}));
vi.mock("@/services/characterPromptService", () => ({
  buildCharacterPromptSections: vi.fn((prompt) => [
    `## IDENTITÉ FONDAMENTALE\n${prompt.identite_fondamentale}`,
    `## QUI TU ES\n${prompt.qui_tu_es}`,
    `## CE QUE TU NE FAIS JAMAIS\n${prompt.ce_que_tu_ne_fais_jamais}`,
    `## DYNAMIQUE\n${prompt.dynamique_conversation}`,
  ].join("\n\n")),
  loadCharacterPrompt: vi.fn(),
  loadCharacterPromptByName: vi.fn(),
  clearCharacterPromptCache: vi.fn(),
}));

import { loadCharacterPrompt } from "@/services/characterPromptService";
import { getGameplaySettings, getLLMSettings } from "@/services/settingsService";
import { callLLMWithUsage, streamLLM } from "@/services/openRouterLLM";
import { ResponseIntentParser, SPEECH_BOUNDARY } from "@/services/responseIntentStream";
import { CHARACTER_CALL_TRANSFER_INSTRUCTIONS } from "@/services/characterConversation";
import type { CharacterExecutionContext } from "@/services/characterIdentityGuard";
import { buildMaxSystemPrompt, simulateMaxResponse } from "./maxAgent";
import { makeCanonicalPresentFixture } from './__fixtures__/canonicalPresentFixture';

const variants = ["legacy", "compact_v1", "rich_v2", "optimized_v3"] as const;

const contexts: Record<"max" | "emma", CharacterExecutionContext> = {
  max: {
    characterKey: "max",
    displayName: "Max Lorenzo",
    characterId: "11111111-1111-4111-8111-111111111111",
    notionPageId: "30362322e5958011ad7bffb1ed6772bc",
    environmentId: "prod",
    promptUpdatedAt: "2026-09-11T08:00:00.000Z",
  },
  emma: {
    characterKey: "emma",
    displayName: "Emma Munz",
    characterId: "22222222-2222-4222-8222-222222222222",
    notionPageId: "881122c973c943409daed13b3113b00e",
    environmentId: "prod",
    promptUpdatedAt: "2026-09-11T08:00:00.000Z",
  },
};

function sheet(character: "max" | "emma", volume = 1) {
  const context = contexts[character];
  const name = context.displayName;
  const expand = (sentence: string) => Array.from({ length: volume }, () => sentence).join(" ");
  return {
    character_id: context.characterId,
    name,
    updated_at: context.promptUpdatedAt,
    situation_summary: expand(`${name} est à Lausanne aujourd'hui.`),
    timeline: expand("Hier, la famille est rentrée de la montagne."),
    identite_fondamentale: expand(`${name} garde sa propre identité.`),
    qui_tu_es: expand("Une présence lucide et retenue."),
    ce_que_tu_ne_fais_jamais: expand("INTERDIT_IDENTITAIRE_TEMOIN : ne jamais prendre l'identité d'un autre personnage."),
    ce_que_tu_sais_utilisateur: expand("L'interlocuteur vient de se présenter."),
    dynamique_conversation: expand("Répondre précisément à ce qui vient d'être dit."),
    sujets_sensibles: expand("Ava, Mona et le retour du chalet."),
  };
}

const input = { conversationHistory: [], userMessage: "Qui êtes-vous ?" };

describe("identity lock across prompt variants", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(variants)("compile Emma from her exact attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("emma") as never);

    const trace = await buildMaxSystemPrompt(input, "Emma Munz", contexts.emma);

    expect(loadCharacterPrompt).toHaveBeenCalledWith(contexts.emma.characterId);
    expect(trace.finalSystemPrompt.startsWith("# IDENTITÉ ACTIVE")).toBe(true);
    expect(trace.finalSystemPrompt).toContain("Tu es Emma Munz");
    expect(trace.finalSystemPrompt).not.toMatch(/Tu es Max\b/);
    expect(trace.finalSystemPrompt).toContain(CHARACTER_CALL_TRANSFER_INSTRUCTIONS);
    expect(trace.baseSource.characterId).toBe(contexts.emma.characterId);
  });

  it.each(variants)("compile Max from his exact attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("max") as never);

    const trace = await buildMaxSystemPrompt(input, "Max Lorenzo", contexts.max);

    expect(trace.finalSystemPrompt).toContain("Tu es Max Lorenzo");
    expect(trace.finalSystemPrompt).not.toMatch(/Tu es Emma\b/);
    expect(trace.finalSystemPrompt).toContain(CHARACTER_CALL_TRANSFER_INSTRUCTIONS);
    expect(trace.baseSource.characterId).toBe(contexts.max.characterId);
  });

  it.each(variants)("refuses generation without the attributed sheet in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(null as never);

    await expect(buildMaxSystemPrompt(input, "Emma Munz", contexts.emma)).rejects.toThrow(/fiche personnage absente/i);
  });

  it.each(variants)("refuses an incoherent Max sheet attributed to Emma in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("max") as never);

    await expect(buildMaxSystemPrompt(input, "Emma Munz", contexts.emma)).rejects.toThrow(/fiche personnage incohérente/i);
  });

  it.each(variants)("keeps identity and Notion prohibitions ahead of oversized optional content in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    const oversized = sheet("emma", 350);
    // Only optional text is oversized; optimized_v3 now protects the entire scene.
    if (variant === 'optimized_v3') oversized.situation_summary = sheet('emma').situation_summary;
    vi.mocked(loadCharacterPrompt).mockResolvedValue(oversized as never);

    const trace = await buildMaxSystemPrompt(input, "Emma Munz", contexts.emma);

    expect(trace.finalSystemPrompt.startsWith("# IDENTITÉ ACTIVE")).toBe(true);
    expect(trace.finalSystemPrompt).toContain("Tu es Emma Munz");
    expect(trace.finalSystemPrompt).toContain("INTERDIT_IDENTITAIRE_TEMOIN");
    expect(trace.finalSystemPrompt).toContain(CHARACTER_CALL_TRANSFER_INSTRUCTIONS);
  });

  it.each(variants)("keeps the transfer procedure prior to contrary GM guidance in %s", async (variant) => {
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet("emma") as never);
    const guidance = "Reste près de Max pendant son échange avec le joueur.";
    const trace = await buildMaxSystemPrompt({ ...input, gmGuidance: { guidance } }, "Emma Munz", contexts.emma);

    expect(trace.finalSystemPrompt).toContain(CHARACTER_CALL_TRANSFER_INSTRUCTIONS);
    expect(trace.finalSystemPrompt).toContain("procédure prioritaire sur toute guidance contraire");
    expect(trace.finalSystemPrompt).toContain(guidance);
    expect(trace.finalSystemPrompt.indexOf(CHARACTER_CALL_TRANSFER_INSTRUCTIONS))
      .toBeLessThan(trace.finalSystemPrompt.indexOf(guidance));
  });
});

describe('présent canonique dans la requête effective', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: 'optimized_v3' } as never);
    vi.mocked(getLLMSettings).mockReturnValue({ LLM_MODEL: 'openai/gpt-5.6-luna', LLM_MAX_TOKENS: 220, LLM_TEMPERATURE: 0.7, LLM_TOP_P: 0.9 } as never);
    vi.mocked(loadCharacterPrompt).mockImplementation(async id => {
      const character = id === contexts.emma.characterId ? 'emma' : 'max';
      return { ...makeCanonicalPresentFixture(character), character_id: id, updated_at: contexts[character].promptUpdatedAt };
    });
  });

  it.each([false, true])('conserve chaque fiche lors d’un rappel Emma → Max → Emma, stream=%s', async streaming => {
    for (const character of ['emma', 'max', 'emma'] as const) {
      const context = contexts[character];
      const current = 'Non, vous êtes rentrés hier. Où êtes-vous maintenant ?';
      const history = [
        { role: 'user' as const, content: 'Qui est parti à l’hôtel ?', timestamp: 1 },
        { role: character, content: 'Ce matin, Max est parti avec Anne.', timestamp: 2 },
      ];
      if (streaming) vi.mocked(streamLLM).mockResolvedValueOnce('Je suis à la maison.');
      else vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: 'Je suis à la maison.', usage: null, generationId: null, model: 'openai/gpt-5.6-luna', latencyMs: 1, diagnosticTrace: null });
      const result = await simulateMaxResponse({ conversationHistory: history, userMessage: current,
        ragCandidates: [{ id: 'hotel', rank: 1, content: 'Il y a deux jours, Anne avait attendu dans un hall éclairé au néon.' }],
        experienceFrame: 'Cet appel reprend dans la même expérience.' },
      { characterContext: context, diagnosticTrace: true, ...(streaming ? { onSpeechToken: vi.fn() } : {}) });
      const requests = streaming ? vi.mocked(streamLLM).mock.calls : vi.mocked(callLLMWithUsage).mock.calls;
      const messages = requests.at(-1)![0];
      expect(messages[0].content).toContain(makeCanonicalPresentFixture(character).situation_summary);
      expect(messages[0].content).toContain(makeCanonicalPresentFixture(character).maniere_de_parler);
      expect(messages[0].content).toContain(`Tu es ${context.displayName}`);
      expect(messages[0].content).toContain('Cet appel reprend dans la même expérience.');
      expect(messages[1].content).toBe(history[0].content);
      expect(messages[2].content).toBe(history[1].content);
      expect(messages.at(-1)!.content).toBe(current);
      expect(result.promptTrace?.finalSystemPrompt).toBe(messages[0].content);
    }
  });

  it.each([false, true])('ne contacte aucun modèle si le présent ne tient pas, stream=%s', async streaming => {
    const context = contexts.emma;
    vi.mocked(loadCharacterPrompt).mockResolvedValueOnce({ ...makeCanonicalPresentFixture('emma'),
      character_id: context.characterId, updated_at: context.promptUpdatedAt,
      situation_summary: 'Un fait actuel indispensable. '.repeat(500) });
    await expect(simulateMaxResponse(input, { characterContext: context,
      ...(streaming ? { onSpeechToken: vi.fn() } : {}) })).rejects.toThrow(/génération interdite/);
    expect(callLLMWithUsage).not.toHaveBeenCalled();
    expect(streamLLM).not.toHaveBeenCalled();
  });
});

describe('P1 format within the selected output budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGameplaySettings).mockReturnValue({ MAX_PROMPT_VARIANT: 'optimized_v3' } as never);
    vi.mocked(getLLMSettings).mockReturnValue({ LLM_MODEL: 'openai/gpt-5.6-luna', LLM_MAX_TOKENS: 220, LLM_TEMPERATURE: 0.7, LLM_TOP_P: 0.9 } as never);
  });
  it.each(variants.flatMap(variant => ([['max', 220, 45], ['emma', 220, 45], ['max', 100, 22], ['emma', 100, 22]] as const)
    .map(([character, maxTokens, speechWords]) => ({ variant, character, maxTokens, speechWords }))))('uses one $character stream in $variant with $maxTokens tokens / $speechWords words', async ({ variant, character, maxTokens, speechWords }) => {
    vi.mocked(getGameplaySettings).mockReturnValueOnce({ MAX_PROMPT_VARIANT: variant } as never);
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet(character) as never);
    const speech = 'Je reste inquiet pour Ava.';
    const wire = JSON.stringify({goal:'Écouter',points:[]}) + SPEECH_BOUNDARY + speech;
    vi.mocked(streamLLM).mockImplementationOnce(async (_messages, onChunk) => { onChunk(wire, false); return wire; });
    const spoken: string[] = [];
    const parser = new ResponseIntentParser(contexts[character], () => {}, text => spoken.push(text));
    const result = await simulateMaxResponse(input, { characterContext: contexts[character], llmOverrides:{maxTokens}, diagnosticTrace:true, onSpeechToken:t=>parser.push(t), finishSpeech:()=>parser.finish() });
    expect(streamLLM).toHaveBeenCalledTimes(1);
    expect(callLLMWithUsage).not.toHaveBeenCalled();
    const [messages, , options] = vi.mocked(streamLLM).mock.calls[0];
    expect(options).toMatchObject({model:'openai/gpt-5.6-luna', max_tokens:maxTokens});
    expect(messages[0].content).toContain(`discours : ${speechWords} mots maximum`);
    expect(messages[0].content).toContain('en-tête privé');
    expect(messages[0].content).toContain('pensée peut rester ouverte');
    expect(messages[0].content).toContain('phrases ou fragments');
    expect(messages[0].content).not.toContain('achève ta réponse');
    expect(messages[0].content).toContain(`Tu es ${contexts[character].displayName}`);
    expect(result.promptTrace?.finalSystemPrompt).toBe(messages[0].content);
    expect(result.response).toBe(speech);
    expect(spoken).toEqual([speech]);
  });
  it('keeps the batch prompt and token budget unchanged', async () => {
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet('emma') as never);
    const baseline = await buildMaxSystemPrompt(input, contexts.emma.displayName, contexts.emma);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({content:'Je vous écoute.',usage:null,generationId:null,model:'openai/gpt-5.6-luna',latencyMs:10,diagnosticTrace:null});
    const result = await simulateMaxResponse(input,{characterContext:contexts.emma});
    expect(result.systemPrompt).toBe(baseline.finalSystemPrompt);
    expect(callLLMWithUsage).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({max_tokens:220}));
    expect(streamLLM).not.toHaveBeenCalled();
  });
  it.each(['max', 'emma'] as const)('passes normal transport proof to the %s parser in streaming and batch', async character => {
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet(character) as never);
    const wire = JSON.stringify({ goal: 'privé', points: [] }) + SPEECH_BOUNDARY + 'Je vous écoute.\n</speech';
    vi.mocked(streamLLM).mockImplementationOnce(async (_messages, onChunk, options) => {
      onChunk(wire, false); options?.onStreamComplete?.('stop'); return wire;
    });
    const spoken: string[] = [];
    const parser = new ResponseIntentParser(contexts[character], () => {}, text => spoken.push(text));
    const result = await simulateMaxResponse(input, { characterContext: contexts[character], onSpeechToken: t => parser.push(t),
      finishSpeech: normal => parser.finish(normal) });
    expect(result.response).toBe('Je vous écoute.');
    expect(spoken).toEqual(['Je vous écoute.']);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: wire, finishReason: 'stop', usage: null,
      generationId: null, model: 'existing-model', latencyMs: 1, diagnosticTrace: null });
    const batch = await simulateMaxResponse({ ...input, speechStateHistory: [] }, { characterContext: contexts[character] });
    expect(batch.response).toBe('Je vous écoute.');
  });
  it.each(['length', 'error', 'content_filter'])('rejects %s batch even with punctuated speech, also during recovery', async finishReason => {
    vi.mocked(loadCharacterPrompt).mockResolvedValue(sheet('max') as never);
    vi.mocked(callLLMWithUsage).mockResolvedValueOnce({ content: 'Je vous écoute.', finishReason, usage: null,
      generationId: null, model: 'existing-model', latencyMs: 1, diagnosticTrace: null });
    await expect(simulateMaxResponse(input, { characterContext: contexts.max, recoverySpeechOnly: true })).rejects.toThrow(`incomplete (${finishReason})`);
  });

});
