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
