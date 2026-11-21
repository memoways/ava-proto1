import type { MaxPromptAssemblyTrace } from "@/types";

/**
 * Lot H — provenance of every layer the character receives (the counterpart of
 * « Voir ce que reçoit le GM »). Pure: reads the sections of a prompt assembly
 * trace; nothing is added to the prompt. Rank follows the written hierarchy
 * (INSTRUCTION_HIERARCHY): 1 sheet facts, 2 call frame, 3 app state, 4 turn
 * speech; 0 = code contract, 5 = context that informs without overriding.
 */
export interface LayerProvenance {
  label: string;
  /** Where the text comes from and where it is edited. */
  source: string;
  /** Position in the written hierarchy (0 contract, 1–4 levels, 5 context). */
  rank: 0 | 1 | 2 | 3 | 4 | 5;
}

export const CHARACTER_LAYER_PROVENANCE: Record<string, LayerProvenance> = {
  technical_rules: { label: "Identité, hiérarchie des consignes, contrat de conversation", source: "Code (maxOptimizedPromptCompiler)", rank: 0 },
  character_core: { label: "Noyau du personnage (présent, identité, voix, interdits, faits établis)", source: "Fiche Notion (lecture seule dans l'app)", rank: 1 },
  character_canon: { label: "Canon pertinent à la question", source: "Fiche Notion", rank: 1 },
  experience_frame: { label: "Cadre de l'appel", source: "Admin › Expérience › Orchestration (config épinglée à la session)", rank: 2 },
  relationship_directive: { label: "Directive relationnelle du tour", source: "GM (politique relationnelle), filtrée par le mode GM", rank: 3 },
  character_state: { label: "État du personnage à ce tour (radar)", source: "Réglages personnages › radar ; évolution décidée par le GM, bornée par le code", rank: 3 },
  runtime_context: { label: "État du tour (interlocuteur, repères de temps, orientation de jeu, garde-fous)", source: "Application et GM", rank: 3 },
  speech_state: { label: "Parole du tour (état de parole, rugosité)", source: "États de parole de la fiche, choisis par le GM ; rugosité : réglage personnage", rank: 4 },
  conversation_memory: { label: "Historique de la conversation", source: "Mémoire de session (GM)", rank: 5 },
  post_video: { label: "Contexte post-vidéo", source: "Session (vidéo qui vient de passer)", rank: 5 },
  watched_videos: { label: "Vidéos déjà vues", source: "Session", rank: 5 },
  rag_context: { label: "Souvenirs complémentaires", source: "RAG du personnage (corpus Notion indexé)", rank: 5 },
};

export interface CharacterLayerRow {
  key: string;
  title: string;
  label: string;
  source: string;
  rank: LayerProvenance["rank"];
  included: boolean;
  chars: number;
  originalChars: number;
  truncated: boolean;
  omissionReason?: string;
}

export function describeCharacterPromptLayers(trace: { budget?: MaxPromptAssemblyTrace["budget"] }): CharacterLayerRow[] {
  const sections = trace.budget?.sections ?? [];
  return sections.map((section) => {
    const known = CHARACTER_LAYER_PROVENANCE[section.key];
    return {
      key: section.key,
      title: section.title,
      label: known?.label ?? section.title,
      source: known?.source ?? "Source non référencée",
      rank: known?.rank ?? 5,
      included: section.included,
      chars: section.chars,
      originalChars: section.originalChars,
      truncated: section.truncated,
      ...(section.omissionReason ? { omissionReason: section.omissionReason } : {}),
    };
  });
}
