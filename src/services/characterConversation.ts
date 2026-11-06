import type { ConversationMessage, RuntimeCharacter } from "@/types";
import { responseClaimsForeignIdentity } from "@/services/characterIdentityGuard";
import { displayNameForCharacter } from "@/services/characterRegistry";

export type CharacterSwitchStance = "accept" | "object" | "defer";

/** Procedure shared with the GM; editorial frame and character willingness stay separate. */
export const CHARACTER_CALL_TRANSFER_INSTRUCTIONS = "Règle de procédure prioritaire sur toute guidance contraire : chacun reste de son côté. Pour passer à l'autre personnage, propose de passer l'appel (transfert téléphonique) : ne lui propose pas de venir, ni déplacement ni conférence. L'appel est transmis sans rapprochement physique, sans rester à côté de l'autre et sans écouter la conversation après le transfert : règles internes silencieuses. Si tu acceptes, fais une seule annonce brève du passage en nommant la personne, tout de suite, sans aller d'abord lui demander son accord ; une mention de l'autre pièce suffit. Si le joueur a dit pourquoi il veut lui parler, ne le lui redemande pas. Ne répète pas que tu n'écouteras pas, seras absent ou raccrocheras. Tu peux aussi refuser ou hésiter. Le joueur déclenche le changement, sans transmission de confidences privées.";

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

/** Bound shared by every handoff proof source (open request, GM context, validation). */
export const PLAYER_UTTERANCE_MAX_CHARS = 2000;

/**
 * The player's whole utterance for the current turn: speech recognition splits one
 * request into fragments (« Est-ce que tu peux me la » / « passer »), each logged as
 * its own message. Handoff proofs read the consecutive player messages since the
 * character's last reply, never another call or the other character's words.
 */
export function playerUtteranceSinceLastReply(messages: ConversationMessage[], end = messages.length): string {
  const parts: string[] = [];
  for (let index = Math.min(end, messages.length) - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") break;
    const text = message.content.trim();
    if (text) parts.unshift(text);
  }
  const joined = parts.join(" ");
  return joined.length > PLAYER_UTTERANCE_MAX_CHARS ? joined.slice(-PLAYER_UTTERANCE_MAX_CHARS) : joined;
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
  includeCurrent = false,
): RuntimeCharacter | null {
  const text = normalizeSwitchText(userText);
  if (!text.trim()) return null;
  // Accent folding turns "parlé" into "parle". That isolated conjugated form
  // also describes a past conversation, so it cannot seed a transfer request.
  // Keep the infinitive and the explicit player requests/commands below.
  const patterns = [
    /(?:^|[.!?]\s*|\b(?:je|on|nous)\s+(?:peux|peut|pourrais|pourrait|pouvons|voudrais|veux|souhaite|aimerais)\s+)(?:parler|parlez|discuter|appeler|appelle|appelez|joindre|passer|passe|passez|contacter|contacte)\s+(?:a|à|avec|au)\s+(emma|max|papa|pere|père)/i,
    /(?:je (?:veux|voudrais|aimerais)|j['’]aimerais|on (?:peut|pourrait))\s+(?:(?:bien|juste)\s+)?(?:parler|discuter|appeler).{0,24}(emma|max|papa|pere|père)/i,
    /(?:passe[- ]moi|file[- ]moi|donne[- ]moi)\s+(emma|max|papa|pere|père)/i,
    /(?:je (?:veux|voudrais)|j['’]aimerais)\s+(?:voir|avoir)\s+(emma|max|papa|pere|père)/i,
    // Recette du 4 novembre : « si tu peux me passer Emma », « que vous me passiez Emma ».
    /\b(?:me|nous)\s+pass(?:er|ez|iez|es?)\s+(emma|max|papa|pere|père)\b/i,
    // « je serais très curieux de pouvoir échanger avec Emma », « je pourrais lui parler à Emma ».
    /(?:\bje\s+(?:pourrais|peux|voudrais|veux|souhaite|souhaiterais|aimerais)|\bj['’]aimerais|\bj['’]ai envie de|\bje serais\s+(?:\S+\s+){0,2}?(?:curieux|curieuse|content|contente|heureux|heureuse)\s+de)\b(?:(?!\b(?:tu|vous|il|elle|on|pas|plus|jamais)\b)[^.?!]){0,40}?\b(?:parler|discuter|echanger|échanger|appeler|joindre|contacter)\b[^.?!]{0,12}?\b(?:a|à|avec|au)\s+(emma|max|papa|pere|père)\b/i,
  ];
  for (const pattern of patterns) {
    const match = userText.match(pattern) ?? text.match(pattern);
    const target = match?.[1] ? aliasToCharacter(match[1]) : null;
    if (target && (includeCurrent || target !== currentCharacter)) return target;
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

export function withdrawsHandoff(text: string): boolean {
  const s = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").toLowerCase();
  const negativeRequest = /\b(?:ne veux|veux plus|veux pas|ne souhaite|souhaite pas|ne voudrais|voudrais pas)\b/.test(s)
    && (/(?:parler|discuter)\s+(?:a|avec)\s+(?:max|emma|elle|lui)\b/.test(s)
      || /(?:appeler|passer|joindre)\s+(?:max|emma)\b/.test(s)
      || /(?:l'|(?:le|la)\s+)(?:appeler|passer|joindre)\b/.test(s));
  return negativeRequest
    || /\b(?:finalement|plutot|je prefere|je veux|je voudrais|on va)\b.{0,45}\b(?:reste\w*|continu\w*)\b/.test(s)
    || /\b(?:ne\s+)?(?:(?:me|le|la)\s+)*(?:l'appelle|l'appelez|appelle|appelez|passe|passez)\s+(?:surtout\s+)?(?:pas|plus)\b/.test(s)
    || /\b(?:annul\w*|laisse tomber|je reste avec toi|restons|reste avec moi)\b/.test(s);
}
