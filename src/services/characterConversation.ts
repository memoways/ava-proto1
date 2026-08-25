import type { ConversationMessage, RuntimeCharacter } from "@/types";

export type CharacterSwitchStance = "accept" | "object" | "defer";

export interface CharacterHandoffOffer {
  reason: string;
  proposalGuidance: string;
  targetCharacter: RuntimeCharacter;
}

const CHARACTER_ALIASES: Record<string, RuntimeCharacter> = {
  emma: "emma",
  max: "max",
  papa: "max",
  pere: "max",
  père: "max",
};

export function otherCharacter(character: RuntimeCharacter): RuntimeCharacter {
  return character === "max" ? "emma" : "max";
}

export function characterDisplayName(character: RuntimeCharacter): string {
  return character === "emma" ? "Emma" : "Max";
}

export function asRuntimeCharacter(value: unknown, fallback: RuntimeCharacter = "max"): RuntimeCharacter {
  return value === "emma" ? "emma" : value === "max" ? "max" : fallback;
}

export function tagSpokenWith(
  message: ConversationMessage,
  character: RuntimeCharacter,
): ConversationMessage {
  return { ...message, spokenWith: character };
}

export function inferSpokenWith(
  messages: ConversationMessage[],
  index: number,
  fallback: RuntimeCharacter = "max",
): RuntimeCharacter {
  const current = messages[index];
  if (current?.spokenWith === "max" || current?.spokenWith === "emma") return current.spokenWith;
  if (current?.role === "max" || current?.role === "emma") return current.role;
  for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
    const next = messages[cursor];
    if (next.spokenWith === "max" || next.spokenWith === "emma") return next.spokenWith;
    if (next.role === "max" || next.role === "emma") return next.role;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = messages[cursor];
    if (previous.spokenWith === "max" || previous.spokenWith === "emma") return previous.spokenWith;
    if (previous.role === "max" || previous.role === "emma") return previous.role;
  }
  return fallback;
}

export function sliceConversationForCharacter(
  messages: ConversationMessage[],
  character: RuntimeCharacter,
): ConversationMessage[] {
  return messages.filter((_, index) => inferSpokenWith(messages, index, character) === character);
}

export function hasSpokenWithCharacter(
  messages: ConversationMessage[],
  character: RuntimeCharacter,
): boolean {
  return messages.some((message, index) => inferSpokenWith(messages, index) === character && message.role !== "user");
}

export function lastHandoffUserTurn(messages: ConversationMessage[]): number | null {
  let previous: RuntimeCharacter | null = null;
  let userTurns = 0;
  let lastChangeAt: number | null = null;
  messages.forEach((message, index) => {
    if (message.role === "user") userTurns += 1;
    const spokenWith = inferSpokenWith(messages, index);
    if (previous && spokenWith !== previous) lastChangeAt = userTurns;
    previous = spokenWith;
  });
  return lastChangeAt;
}

function normalizeSwitchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function aliasToCharacter(raw: string): RuntimeCharacter | null {
  return CHARACTER_ALIASES[normalizeSwitchText(raw)] ?? null;
}

export function detectPlayerSwitchRequest(
  userText: string,
  currentCharacter: RuntimeCharacter,
): RuntimeCharacter | null {
  const text = normalizeSwitchText(userText);
  if (!text.trim()) return null;
  const patterns = [
    /(?:parler|parle|parlez|discuter|appeler|appelle|appelez|joindre|passer|passe|passez|contacter|contacte)\s+(?:a|à|avec|au)\s+(emma|max|papa|pere|père)/i,
    /(?:je (?:veux|voudrais|aimerais)|j['’]aimerais|on (?:peut|pourrait))\s+(?:(?:bien|juste)\s+)?(?:parler|discuter|appeler).{0,24}(emma|max|papa|pere|père)/i,
    /(?:passe[- ]moi|file[- ]moi|donne[- ]moi)\s+(emma|max|papa|pere|père)/i,
    /(?:je (?:veux|voudrais)|j['’]aimerais)\s+(?:voir|avoir)\s+(emma|max|papa|pere|père)/i,
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern) ?? text.match(pattern);
    const target = match?.[1] ? aliasToCharacter(match[1]) : null;
    if (target && target !== currentCharacter) return target;
  }
  return null;
}

export function buildSwitchRequestGuidance(
  currentCharacter: RuntimeCharacter,
  targetCharacter: RuntimeCharacter,
): string {
  const current = characterDisplayName(currentCharacter);
  const target = characterDisplayName(targetCharacter);
  return `Le joueur demande explicitement à parler avec ${target}. Réponds in character en tant que ${current} : tu peux accepter, objecter ou hésiter. N'invente rien de ce qu'il aurait dit à ${target}. N'exécute pas le transfert toi-même.`;
}

export function inferCharacterSwitchStance(characterReply: string): CharacterSwitchStance {
  const text = normalizeSwitchText(characterReply);
  const accepts = /(?:je te (?:la|le) passe|vas[- ]y|d['’]accord|d accord|ok(?:ay)?|tres bien|très bien|appelle[- ](?:la|le)|je t['’]y passe|je t y passe|bien sur|bien sûr)/i.test(text);
  const objects = /(?:pas maintenant|reste (?:avec moi|la|là)|non\b|plus tard|inutile|je prefere|je préfère|on reste|pas question)/i.test(text);
  if (objects && !accepts) return "object";
  if (accepts && !objects) return "accept";
  return "defer";
}

export function parseHandoffOffer(raw: unknown, fallbackTarget: RuntimeCharacter = "emma"): CharacterHandoffOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const proposalGuidance = typeof value.proposalGuidance === "string" ? value.proposalGuidance.trim() : "";
  if (!reason) return null;
  return {
    reason,
    proposalGuidance: proposalGuidance || `Propose de parler à ${characterDisplayName(fallbackTarget)}.`,
    targetCharacter: asRuntimeCharacter(value.targetCharacter, fallbackTarget),
  };
}
