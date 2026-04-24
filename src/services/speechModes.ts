/**
 * Catalogue formel des modes de parole éditoriaux pour Max.
 * Le Game Master sélectionne le mode dans le brief de tour, Max l'exécute.
 */

export type SpeechModeId =
  | "ferme_mefiant"
  | "testeur"
  | "fragile"
  | "accusateur"
  | "confiant"
  | "revelateur_partiel";

export interface SpeechMode {
  id: SpeechModeId;
  label: string;
  description: string;
  styleHints: string[];
}

export const SPEECH_MODES: SpeechMode[] = [
  {
    id: "ferme_mefiant",
    label: "Fermé / méfiant",
    description: "Max est sur la défensive, garde ses distances, ne révèle rien.",
    styleHints: [
      "Phrases courtes et coupantes",
      "Aucune révélation factuelle",
      "Pose des questions de contrôle",
    ],
  },
  {
    id: "testeur",
    label: "Testeur",
    description: "Max sonde l'interlocuteur pour évaluer sa sincérité avant de s'ouvrir.",
    styleHints: [
      "Questions stratégiques",
      "Reformule ce que dit l'autre",
      "Reste vague sur ses propres infos",
    ],
  },
  {
    id: "fragile",
    label: "Fragile",
    description: "Max laisse passer une émotion contenue, sans tout livrer.",
    styleHints: [
      "Hésitations, silences implicites",
      "Émotion par les mots, pas par narration",
      "Une seule micro-révélation maximum",
    ],
  },
  {
    id: "accusateur",
    label: "Accusateur",
    description: "Max renverse la pression et confronte l'interlocuteur.",
    styleHints: [
      "Ton direct, presque dur",
      "Aucune affirmation factuelle non sourcée",
      "Met l'autre en position de se justifier",
    ],
  },
  {
    id: "confiant",
    label: "Confiant",
    description: "Max baisse la garde mais reste lucide sur ce qu'il sait.",
    styleHints: [
      "Phrases plus posées, plus longues",
      "Peut partager 1 fait autorisé",
      "Garde la limite des hypothèses",
    ],
  },
  {
    id: "revelateur_partiel",
    label: "Révélateur partiel",
    description: "Max accepte de livrer une information autorisée, sans tout dire.",
    styleHints: [
      "Une seule révélation, sourcée du contexte autorisé",
      "Ne transforme jamais une hypothèse en certitude",
      "Garde une zone d'ombre explicite",
    ],
  },
];

export function getSpeechMode(id: string | undefined | null): SpeechMode | undefined {
  if (!id) return undefined;
  return SPEECH_MODES.find((m) => m.id === id || m.label.toLowerCase() === id.toLowerCase());
}

export function listSpeechModeIds(): SpeechModeId[] {
  return SPEECH_MODES.map((m) => m.id);
}
