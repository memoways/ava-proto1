import { REPLY_BLOCK_MAX_CHARS } from "@/services/characterEmbodiment";
import type { MaxPromptAssemblyTrace } from "@/types";

type ReplyBlockStatus = NonNullable<NonNullable<MaxPromptAssemblyTrace["budget"]>["replyBlock"]>;

const REPLY_BLOCK_FIELD_LABELS: Record<string, string> = {
  ce_que_tu_ne_fais_jamais: "Ce que tu ne fais jamais",
  dynamique_conversation: "Dynamique de la conversation",
  ce_que_tu_sais_utilisateur: "Ce que tu sais sur l'utilisateur",
  qui_tu_es: "Qui tu es",
  identite_fondamentale: "Identité fondamentale",
};

/** Cadre de l'appel lot 2: one line saying whether « Comment tu réponds » reaches the character. */
export function describeReplyBlock(block: ReplyBlockStatus | undefined): { text: string; tooLong: boolean } {
  if (!block) return { text: `Bloc « Comment tu réponds » : absent de la fiche (paragraphe commençant par « Comment tu réponds », ${REPLY_BLOCK_MAX_CHARS} car. au plus).`, tooLong: false };
  const field = REPLY_BLOCK_FIELD_LABELS[block.field] ?? block.field;
  return block.sent
    ? { text: `Bloc « Comment tu réponds » (champ « ${field} ») : envoyé en entier, ${block.chars} car. sur ${block.maxChars}.`, tooLong: false }
    : { text: `Bloc « Comment tu réponds » (champ « ${field} ») : trop long, ${block.chars} car. sur ${block.maxChars}, non envoyé.`, tooLong: true };
}
