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
