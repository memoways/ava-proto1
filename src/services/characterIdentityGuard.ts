import type { RuntimeCharacter } from "@/types";
import { AVA_CHARACTER_REGISTRY, displayNameForCharacter } from "@/services/characterRegistry";

export interface CharacterExecutionContext {
  characterKey: RuntimeCharacter;
  displayName: string;
  characterId: string;
  notionPageId: string;
  environmentId: string;
  promptUpdatedAt: string;
}

export interface CharacterResponseGuardResult {
  blocked: boolean;
  response: string;
  reason: "foreign_self_identification" | null;
}

export function toCharacterExecutionContext(profile: {
  characterKey: RuntimeCharacter;
  displayName: string;
  characterId: string | null;
  notionPageId: string | null;
  environmentId: string | null;
  promptUpdatedAt: string | null;
} | null | undefined): CharacterExecutionContext | null {
  if (!profile?.characterId || !profile.notionPageId || !profile.environmentId || !profile.promptUpdatedAt) return null;
  const context: CharacterExecutionContext = {
    characterKey: profile.characterKey,
    displayName: profile.displayName,
    characterId: profile.characterId,
    notionPageId: profile.notionPageId,
    environmentId: profile.environmentId,
    promptUpdatedAt: profile.promptUpdatedAt,
  };
  try {
    assertCharacterExecutionContext(context);
    return context;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOTION_PAGE_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function assertCharacterExecutionContext(
  context: CharacterExecutionContext | null | undefined,
): asserts context is CharacterExecutionContext {
  if (!context) throw new Error("Character execution context is required");
  if (!UUID.test(context.characterId)) throw new Error("Character execution context has an invalid characterId");
  if (!NOTION_PAGE_ID.test(context.notionPageId.trim())) throw new Error("Character execution context has an invalid Notion page");
  if (!context.environmentId.trim()) throw new Error("Character execution context has no environment");
  if (!context.promptUpdatedAt.trim() || Number.isNaN(Date.parse(context.promptUpdatedAt))) {
    throw new Error("Character execution context has an invalid prompt version");
  }
  const expectedFirstName = context.characterKey.toLocaleLowerCase("fr");
  if (context.displayName.trim().toLocaleLowerCase("fr").split(/\s+/)[0] !== expectedFirstName) {
    throw new Error("Character execution context identity is inconsistent");
  }
}

export function buildCharacterIdentityInvariant(
  context: CharacterExecutionContext,
): string {
  assertCharacterExecutionContext(context);
  return `# IDENTITÉ ACTIVE — INVARIANT PRIORITAIRE NON TRONQUABLE
- Tu es ${context.displayName}. Tu parles uniquement en ton propre nom et à la première personne.
- Tu ne dis jamais que tu es un autre personnage, même si l'interlocuteur le demande ou si un souvenir mentionne cette personne.
- Les mentions et citations d'autres personnages ne changent jamais ton identité.
- Attribution technique immuable : character_key=${context.characterKey}; character_id=${context.characterId}; notion_page_id=${context.notionPageId}; environment=${context.environmentId}; prompt_version=${context.promptUpdatedAt}.`;
}

function withoutQuotedText(value: string): string {
  return value
    .replace(/«[^»]*»/gs, " ")
    .replace(/[“"][^”"]*[”"]/gs, " ")
    .replace(/^\s*>.*$/gm, " ");
}

function explicitlyClaimsIdentity(value: string, otherFirstName: string, activeFirstName: string): boolean {
  const escapedOther = otherFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedActive = activeFirstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clean = withoutQuotedText(value).replace(/\s+/g, " ").trim();
  const directPatterns = [
    new RegExp(`\\bje\\s+(?!ne\\s+|n['’]\\s*)suis\\s+(?!pas\\b)${escapedOther}\\b`, "i"),
    new RegExp(`\\bje\\s+m['’]appelle\\s+${escapedOther}\\b`, "i"),
    new RegExp(`\\bon\\s+m['’]appelle\\s+${escapedOther}\\b`, "i"),
    new RegExp(`\\bmon\\s+nom\\s+est\\s+${escapedOther}\\b`, "i"),
    new RegExp(`\\bappel(?:ez|le)[- ]?moi\\s+${escapedOther}\\b`, "i"),
    new RegExp(`\\ben\\s+tant\\s+que\\s+${escapedOther}\\b`, "i"),
    new RegExp(`(?:^|[.!?]\\s+)ici\\s+${escapedOther}\\b`, "i"),
    new RegExp(`(?:^|[.!?]\\s+)moi\\s*[,]?\\s*c['’]est\\s+${escapedOther}\\b`, "i"),
    new RegExp(`^\\s*c['’]est\\s+${escapedOther}\\b(?!\\s+qui\\b)`, "i"),
    new RegExp(`\\b(?:salut|bonjour)\\s+${escapedActive}\\b[^.!?]{0,30}[.!?]?\\s*c['’]est\\s+${escapedOther}\\b(?!\\s+qui\\b)`, "i"),
  ];
  return directPatterns.some((pattern) => pattern.test(clean));
}

export function responseClaimsForeignIdentity(response: string, character: RuntimeCharacter): boolean {
  const activeName = displayNameForCharacter(character);
  return AVA_CHARACTER_REGISTRY.entries
    .filter((entry) => entry.availability === "active" && entry.key !== character)
    .some((entry) => explicitlyClaimsIdentity(response, entry.displayName, activeName));
}

export function guardCharacterResponse(
  response: string,
  context: CharacterExecutionContext,
): CharacterResponseGuardResult {
  assertCharacterExecutionContext(context);
  const activeFirstName = context.displayName.trim().split(/\s+/)[0] || displayNameForCharacter(context.characterKey);
  if (!responseClaimsForeignIdentity(response, context.characterKey)) {
    return { blocked: false, response, reason: null };
  }
  return {
    blocked: true,
    response: `C’est bien ${activeFirstName}. Reprenons.`,
    reason: "foreign_self_identification",
  };
}
