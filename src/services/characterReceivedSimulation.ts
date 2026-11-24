import type { OptimizedPromptInput, OptimizedRagCandidate } from "@/agents/maxOptimizedPromptCompiler";
import type { CharacterPrompt } from "@/services/characterPromptService";
import { mergeConversationMemory } from "@/services/conversationMemoryV1";
import { buildExperienceFrame } from "@/services/experienceFrame";
import {
  buildTurnRelationshipDirective,
  compileCharacterRelationshipPolicy,
  createInitialRelationshipState,
} from "@/services/relationshipEngine";
import type { RuntimeCharacter } from "@/types";

/**
 * Souvenirs lot 1 — « simuler un tour long » in « Ce que reçoit le personnage ».
 * The turn the 23 November sessions showed: deep in the call, back from a phone
 * transfer, ≈ 1 000 characters of recent history and a full conversation memory.
 * The question is the admin's, the souvenirs are the real `query-rag` matches.
 * Nothing is sent to any model and nothing is written.
 */
export const LONG_TURN_HISTORY_CHARS = 1_000;

export function buildLongTurnSimulation(input: {
  sheet: CharacterPrompt;
  characterKey: RuntimeCharacter;
  question: string;
  ragCandidates: OptimizedRagCandidate[];
}): Pick<OptimizedPromptInput, "userMessage" | "historyChars" | "conversationMemory" | "experienceFrame" | "relationshipDirective" | "ragCandidates" | "temporalContext"> {
  const other: RuntimeCharacter = input.characterKey === "max" ? "emma" : "max";
  const conversationMemory = mergeConversationMemory(null, {
    interlocutor: { name: "l'appelant", role: "bénévole" },
    topics: ["ce qui s'est passé au chalet", "la famille", "la police", "ce que l'autre parent a dit"],
    userFacts: ["L'appelant a déjà parlé à l'autre parent."],
    maxDisclosures: ["Le personnage a dit qu'il ne dort plus depuis le retour."],
    openThreads: ["Ce que l'appelant cherche à comprendre n'est pas encore éclairci."],
    lastExchange: "L'appelant revient d'un échange avec l'autre parent et insiste sur ce qui s'est passé au chalet ; le personnage a répondu en retenant ce qui fait mal.",
  }, 30, input.characterKey);
  const policy = compileCharacterRelationshipPolicy(input.sheet, input.characterKey);
  return {
    userMessage: input.question,
    historyChars: LONG_TURN_HISTORY_CHARS,
    conversationMemory,
    experienceFrame: buildExperienceFrame({ config: null, filmAnswer: "vu", callTransfer: { from: other, returning: true } }).prompt || undefined,
    relationshipDirective: buildTurnRelationshipDirective({
      policy,
      state: createInitialRelationshipState(input.characterKey, policy.version),
      userMessage: input.question,
    }).prompt,
    temporalContext: "Tour 30 : l'appel dure déjà depuis un bon moment.",
    ragCandidates: input.ragCandidates,
  };
}
