import type { ConversationMessage, RuntimeCharacter } from "@/types";
import { responseClaimsForeignIdentity } from "@/services/characterIdentityGuard";
import { displayNameForCharacter } from "@/services/characterRegistry";

export type CharacterSwitchStance = "accept" | "object" | "defer";

/** Procedure shared with the GM; editorial frame and character willingness stay separate. */
export const CHARACTER_CALL_TRANSFER_INSTRUCTIONS = "Règle de procédure prioritaire sur toute guidance contraire : chacun reste de son côté. Pour passer à l'autre personnage, propose de passer l'appel : il s'agit d'un transfert téléphonique, ne lui propose pas de venir et ne promets ni déplacement ni conférence. L'appel est transmis sans rapprochement physique, sans rester à côté de l'autre et sans écouter la conversation après le transfert. Si tu acceptes, propose naturellement au joueur de lui passer l'autre personnage au téléphone ; tu peux aussi refuser ou hésiter. Le joueur déclenche le changement, sans transmission de confidences privées.";

export interface CharacterHandoffOffer {
  reason: string;
  proposalGuidance: string;
  targetCharacter: RuntimeCharacter;
  gmApproval?: { turnId: string; orchestrationVersionId: string };
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
  return displayNameForCharacter(character);
}

export function asRuntimeCharacter(value: unknown): RuntimeCharacter | null {
  return value === "emma" || value === "max" ? value : null;
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
  fallback?: RuntimeCharacter,
): RuntimeCharacter | null {
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
  return fallback ?? null;
}

export function sliceConversationForCharacter(
  messages: ConversationMessage[],
  character: RuntimeCharacter,
): ConversationMessage[] {
  return messages.filter((message, index) => {
    if (inferSpokenWith(messages, index) !== character) return false;
    if (message.role !== "user" && responseClaimsForeignIdentity(message.content, character)) return false;
    return true;
  });
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
    if (!spokenWith) return;
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
  return `Le joueur demande explicitement à parler avec ${target}. Réponds in character en tant que ${current} : tu peux accepter, objecter ou hésiter. ${CHARACTER_CALL_TRANSFER_INSTRUCTIONS} N'invente rien de ce qu'il aurait dit à ${target}. N'exécute pas le transfert toi-même.`;
}

export function inferCharacterSwitchStance(characterReply: string): CharacterSwitchStance {
  const text = normalizeSwitchText(characterReply);
  const accepts = /(?:je te (?:la|le) passe|vas[- ]y|d['’]accord|d accord|ok(?:ay)?|tres bien|très bien|appelle[- ](?:la|le)|je t['’]y passe|je t y passe|bien sur|bien sûr)/i.test(text);
  const objects = /(?:pas maintenant|reste (?:avec moi|la|là)|non\b|plus tard|inutile|je prefere|je préfère|on reste|pas question)/i.test(text);
  if (objects && !accepts) return "object";
  if (accepts && !objects) return "accept";
  return "defer";
}

/** A GM recommendation is not consent: require an actual transfer agreement. */
export function hasCharacterHandoffConsent(
  characterReply: string,
  target: RuntimeCharacter,
  gmStance?: CharacterSwitchStance | null,
): boolean {
  if (gmStance === "object" || gmStance === "defer") return false;
  const text = normalizeSwitchText(characterReply);
  const negativeTransfer = /\b(?:(?:ne|n['’])\s*)?(?:(?:vais|peux|veux|voudrais|compte|souhaite)\s+)?(?:pas|jamais|plus)\s+(?:(?:te|le|la|lui|vous|me)\s+){0,3}(?:pass\w*|appel\w*|mett\w*|contact\w*|parl\w*)/i.test(text)
    || /\bne\s+(?:(?:te|le|la|lui|vous|me)\s+){0,3}(?:pass\w*|appel\w*|mett\w*|contact\w*|parl\w*)\s+(?:pas|jamais)/i.test(text)
    || /\b(?:pass\w*|appel\w*)(?:[- ](?:le|la|moi|nous))?\s+(?:pas|jamais|plus)\b/i.test(text)
    || /(?:^non\b|\bmais non\b|pas maintenant|pas question|pas le bon moment|plus tard|rest(?:e|es|er|ez) avec moi|je refuse|peut[- ]etre|pas encore|on verra|pas sur(?:e)?\b|je hesite\b|je (?:ne )?sais pas(?: trop)?(?:[,.!?]|$| si\b))/i.test(text);
  if (negativeTransfer) return false;
  // A short yes can confirm the direct request classified by the GM. Longer
  // replies still need an explicit transfer agreement, not a broad text span.
  if (gmStance === "accept" && /^(?:oui|d['’]accord|d accord|ok(?:ay)?|bien sur)[ .!]*$/i.test(text.trim())) return true;
  return /(?:je te (?:la|le) passe\b|je t['’]y passe\b|je t y passe\b|appelle[- ](?:la|le)\b)/i.test(text)
    || new RegExp(`\\b(?:tu peux|on (?:peut|va)|je (?:vais|peux|veux bien))\\s+(?:(?:bien sur|bien|donc|maintenant|directement|simplement|aller|aussi|te|vous)\\s+){0,4}(?:parler|appeler|passer|joindre|contacter)\\s+(?:(?:a|avec|le|la)\\s+){0,2}${target}\\b`, "i").test(text)
    || new RegExp(`\\bje (?:te|vous) passe ${target}\\b`, "i").test(text);
}

export function parseHandoffOffer(raw: unknown, fallbackTarget: RuntimeCharacter = "emma"): CharacterHandoffOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const proposalGuidance = typeof value.proposalGuidance === "string" ? value.proposalGuidance.trim() : "";
  const approval = value.gmApproval && typeof value.gmApproval === "object"
    ? value.gmApproval as Record<string, unknown> : null;
  const gmApproval = approval && typeof approval.turnId === "string" && approval.turnId.trim()
    && typeof approval.orchestrationVersionId === "string" && approval.orchestrationVersionId.trim()
    && asRuntimeCharacter(value.targetCharacter)
    ? { turnId: approval.turnId, orchestrationVersionId: approval.orchestrationVersionId } : null;
  if (!reason) return null;
  return {
    reason,
    proposalGuidance: proposalGuidance || `Propose de parler à ${characterDisplayName(fallbackTarget)}.`,
    targetCharacter: asRuntimeCharacter(value.targetCharacter) ?? fallbackTarget,
    ...(gmApproval ? { gmApproval } : {}),
  };
}

/** Old recommendations without recorded GM approval cannot unlock a resumed call. */
export function parseGmApprovedHandoffOffer(
  raw: unknown,
  fallbackTarget: RuntimeCharacter,
  orchestrationVersionId: string | null | undefined,
): CharacterHandoffOffer | null {
  const offer = parseHandoffOffer(raw, fallbackTarget);
  if (!offer?.gmApproval || !orchestrationVersionId
    || offer.gmApproval.orchestrationVersionId !== orchestrationVersionId) return null;
  return offer;
}
