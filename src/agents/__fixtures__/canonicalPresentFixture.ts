import { makeNotionMaxPrompt } from './maxNotionFixture';

/** Synthetic sheet with the observed speech/motive volume, no copied prompt. */
export function makeCanonicalPresentFixture(character: 'max' | 'emma') {
  const name = character === 'emma' ? 'Emma Munz' : 'Max Lorenzo';
  const speaking = 'Je parle par fragments.  Je laisse un silence avant de préciser.\n';
  const motive = 'Ce que tu veux vraiment : être entendu sans devoir tout expliquer. ';
  return makeNotionMaxPrompt({
    character_id: character,
    name,
    situation_summary: `${name} répond depuis son appartement. ${character === 'emma' ? 'Emma est dans la cuisine ; Max est dans le salon.' : 'Max est dans le salon ; Emma est dans la cuisine.'}\n\nLa famille est rentrée hier de la montagne. Le départ vers l'hôtel appartient à il y a deux jours.\n\nAujourd'hui, chacun attend un appel ; personne ne part à l'hôtel ce matin.`,
    maniere_de_parler: speaking.repeat(45).slice(0, 2_768).trim(),
    dynamique_conversation: motive.repeat(20).slice(0, 1_048).trim(),
    identite_fondamentale: `${name} garde sa propre identité.`,
    qui_tu_es: 'Une présence retenue.',
    timeline: 'Il y a deux jours, Max est parti avec Anne vers un hôtel. Hier, la famille est rentrée de la montagne. Aujourd’hui, chacun attend un appel dans l’appartement.',
    ce_que_tu_ne_fais_jamais: 'Tu ne prends jamais l’identité de l’autre personnage.',
  });
}
