import type { CharacterPrompt } from './characterPromptService';

/** Atomic editorial units: scoring/deduplication cannot erase a state, its
 * trigger, or the character's inability to articulate the intimate motive. */
export function characterEmbodiment(prompt: CharacterPrompt) {
  const motive = (prompt.dynamique_conversation ?? '').replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/).filter(block => /^Ce que tu veux vraiment\b/i.test(block.trim())).join('\n\n').trim();
  return [
    { key: 'maniere_de_parler', title: 'MANIÈRE DE PARLER', content: prompt.maniere_de_parler?.trim() ?? '' },
    { key: 'moteur_intime', title: 'MOTEUR INTIME — SOURCE ÉDITORIALE', content: motive },
  ].filter(section => section.content);
}

/** Avoid paying twice for protected text; never rewrite the saved sheet. */
export function withoutCharacterEmbodiment(prompt: CharacterPrompt): CharacterPrompt {
  const motive = characterEmbodiment(prompt).find(section => section.key === 'moteur_intime')?.content;
  return { ...prompt, maniere_de_parler: '', dynamique_conversation: motive
    ? prompt.dynamique_conversation.replace(motive, '').trim() : prompt.dynamique_conversation };
}

/** Paragraph where the sheet says what the events do to the character now:
 * "Ce que tu cherches dans cet appel" (Dynamique, current sheets) or, for older
 * sheets, "Ce que tu vis aujourd'hui" (Qui tu es). Read as written in Notion. */
const LIVED_IMPACT_SOURCES = [
  { field: 'dynamique_conversation', heading: /^Ce que tu cherches dans cet appel\b/i },
  { field: 'qui_tu_es', heading: /^Ce que tu vis aujourd['’]hui\b/i },
] as const;

export function characterLivedImpact(prompt: CharacterPrompt): { field: 'dynamique_conversation' | 'qui_tu_es'; content: string } | null {
  for (const source of LIVED_IMPACT_SOURCES) {
    const block = (prompt[source.field] ?? '').replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/).find(item => source.heading.test(item.trim()))?.trim();
    if (block) return { field: source.field, content: block };
  }
  return null;
}

/** optimized_v3 only: the lived paragraph is protected, so it is not a
 * relevance candidate any more and is never paid twice. */
export function withoutCharacterLivedImpact(prompt: CharacterPrompt): CharacterPrompt {
  const lived = characterLivedImpact(prompt);
  if (!lived) return prompt;
  return { ...prompt, [lived.field]: (prompt[lived.field] ?? '').replace(/\r\n?/g, '\n').replace(lived.content, '').trim() };
}

/**
 * Cadre de l'appel lot 2 — « Comment tu réponds » : a short paragraph the sheet
 * may hold in one of its existing fields (no migration), recognised by its first
 * line and sent whole in the core like the speaking manner. It runs from its
 * heading line to the next blank line. Above `REPLY_BLOCK_MAX_CHARS` it is not
 * recognised: the field stays as it was and the trace says so.
 */
export const REPLY_BLOCK_TITLE = 'COMMENT TU RÉPONDS';
export const REPLY_BLOCK_MAX_CHARS = 900;
const REPLY_BLOCK_HEADING = /^Comment tu r[ée]ponds\b/i;
const REPLY_BLOCK_FIELDS = [
  'ce_que_tu_ne_fais_jamais', 'dynamique_conversation', 'ce_que_tu_sais_utilisateur', 'qui_tu_es', 'identite_fondamentale',
] as const;
type ReplyBlockField = typeof REPLY_BLOCK_FIELDS[number];

export interface CharacterReplyBlock {
  field: ReplyBlockField;
  /** The paragraph as written in the sheet, heading line included. */
  paragraph: string;
  /** What the character receives: the paragraph without its heading line. */
  content: string;
  tooLong: boolean;
}

export function characterReplyBlock(prompt: CharacterPrompt): CharacterReplyBlock | null {
  for (const field of REPLY_BLOCK_FIELDS) {
    const paragraph = (prompt[field] ?? '').replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/).map(item => item.trim()).find(item => REPLY_BLOCK_HEADING.test(item));
    if (!paragraph) continue;
    const content = paragraph.split('\n').slice(1).join('\n').trim();
    if (!content) continue;
    return { field, paragraph, content, tooLong: content.length > REPLY_BLOCK_MAX_CHARS };
  }
  return null;
}

/** The block is paid once: removed from its field when it is sent in the core. */
export function withoutCharacterReplyBlock(prompt: CharacterPrompt): CharacterPrompt {
  const block = characterReplyBlock(prompt);
  if (!block || block.tooLong) return prompt;
  return { ...prompt, [block.field]: (prompt[block.field] ?? '').replace(/\r\n?/g, '\n').replace(block.paragraph, '').replace(/\n{3,}/g, '\n\n').trim() };
}
