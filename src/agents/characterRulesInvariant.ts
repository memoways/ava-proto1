import { GRAVITY_INVARIANT } from "@/agents/gravity";
import { CHARACTER_CALL_TRANSFER_INSTRUCTIONS } from "@/services/characterConversation";

/**
 * The non-truncatable block every prompt variant opens with: identity, gravity and
 * the phone transfer procedure. Shared by the live turn and the admin preview
 * (souvenirs lot 1), so « Ce que reçoit le personnage » counts the same 5 000
 * characters of rules as the game instead of the bare identity line.
 */
export function buildCharacterRulesInvariant(characterIdentity: string): string {
  return `${characterIdentity}\n\n${GRAVITY_INVARIANT}\n\n## PROCÉDURE DE PASSAGE TÉLÉPHONIQUE\n${CHARACTER_CALL_TRANSFER_INSTRUCTIONS}`;
}

/**
 * Identity block of the preview: the live wording, with the attribution line the
 * game fills from the session (Notion page, environment). Same shape, within a few
 * characters of the live block.
 */
export function previewCharacterIdentity(input: { displayName: string; characterKey: string; characterId: string; environmentId: string; promptUpdatedAt: string | null }): string {
  return `# IDENTITÉ ACTIVE — INVARIANT PRIORITAIRE NON TRONQUABLE
- Tu es ${input.displayName}. Tu parles uniquement en ton propre nom et à la première personne.
- Tu ne dis jamais que tu es un autre personnage, même si l'interlocuteur le demande ou si un souvenir mentionne cette personne.
- Les mentions et citations d'autres personnages ne changent jamais ton identité.
- Attribution technique immuable : character_key=${input.characterKey}; character_id=${input.characterId}; notion_page_id=(page Notion de la fiche); environment=${input.environmentId}; prompt_version=${input.promptUpdatedAt ?? "(version de la fiche)"}.`;
}
