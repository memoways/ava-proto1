import type { CharacterPrompt } from "@/services/characterPromptService";

/**
 * Compression de la fiche, lot 1 (28 November): how much of the character sheet
 * the `optimized_v3` compiler sends at each turn. Three levels by nature of text,
 * chosen per character by Ulrich, never a percentage:
 * - `current`: today's assembly (protected sections, the rest sorted by shared words);
 * - `guidelines`: the call-wide guidelines are sent whole, the reference material
 *   (timeline, sensitive subjects, intellectual references) stays sorted;
 * - `full`: every field is sent whole, nothing is sorted.
 */
export const SHEET_COMPRESSION_LEVELS = ["current", "guidelines", "full"] as const;
export type SheetCompressionLevel = (typeof SHEET_COMPRESSION_LEVELS)[number];
export const DEFAULT_SHEET_COMPRESSION: SheetCompressionLevel = "current";

export type SheetField = keyof Pick<CharacterPrompt,
  "identite_fondamentale" | "qui_tu_es" | "dynamique_conversation" | "ce_que_tu_ne_fais_jamais" |
  "ce_que_tu_sais_utilisateur" | "timeline" | "sujets_sensibles" | "references_intellectuelles" |
  "maniere_de_parler" | "situation_summary" | "ce_que_tu_sais_aujourdhui">;

const GUIDELINE_FIELDS: SheetField[] = [
  "identite_fondamentale", "qui_tu_es", "dynamique_conversation", "ce_que_tu_ne_fais_jamais", "ce_que_tu_sais_utilisateur",
];

/** Fields sent whole at each level, on top of the sections every level protects. */
export const SHEET_COMPRESSION_WHOLE_FIELDS: Record<SheetCompressionLevel, readonly SheetField[]> = {
  current: [],
  guidelines: GUIDELINE_FIELDS,
  full: [...GUIDELINE_FIELDS, "timeline", "sujets_sensibles", "references_intellectuelles"],
};

export const SHEET_COMPRESSION_LABELS: Record<SheetCompressionLevel, { label: string; description: string }> = {
  current: {
    label: "Actuel",
    description: "Présent, faits établis, moteur, manière de parler et « Ce que tu cherches » en entier ; le reste trié selon la question (≈ 15 % de la fiche).",
  },
  guidelines: {
    label: "Consignes entières",
    description: "En plus : Identité fondamentale, Qui tu es, Dynamique, Ce que tu ne fais jamais et Qui t'appelle en entier ; Timeline, Sujets sensibles et Références triés (≈ 50 %).",
  },
  full: {
    label: "Fiche entière",
    description: "Tous les champs en entier, rien n'est trié (100 %). Prompt le plus long : délai et coût à mesurer.",
  },
};

export function normalizeSheetCompressionLevel(value: unknown): SheetCompressionLevel {
  return SHEET_COMPRESSION_LEVELS.includes(value as SheetCompressionLevel) ? value as SheetCompressionLevel : DEFAULT_SHEET_COMPRESSION;
}

/** Sheet fields measured for the « part de la fiche envoyée », in sheet order. */
export const SHEET_COVERAGE_FIELDS: Array<{ key: SheetField; label: string }> = [
  { key: "situation_summary", label: "Présent" },
  { key: "ce_que_tu_sais_aujourdhui", label: "Ce que tu sais aujourd'hui" },
  { key: "identite_fondamentale", label: "Identité fondamentale" },
  { key: "qui_tu_es", label: "Qui tu es" },
  { key: "maniere_de_parler", label: "Manière de parler" },
  { key: "dynamique_conversation", label: "Dynamique de la conversation" },
  { key: "ce_que_tu_ne_fais_jamais", label: "Ce que tu ne fais jamais" },
  { key: "ce_que_tu_sais_utilisateur", label: "Qui t'appelle" },
  { key: "timeline", label: "Timeline" },
  { key: "sujets_sensibles", label: "Sujets sensibles" },
  { key: "references_intellectuelles", label: "Références intellectuelles" },
];

export interface SheetCoverageRow { key: SheetField; label: string; chars: number; sentChars: number }
export interface SheetCoverage { fields: SheetCoverageRow[]; chars: number; sentChars: number; share: number }

const comparable = (value: string) => value
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Part of each field found in the prompt, sentence by sentence (a line or a
 * sentence counts when its words appear in the same order in the prompt).
 * Measurement only: used by the preview and the replay, never on a live turn.
 */
export function measureSheetCoverage(character: CharacterPrompt, prompt: string): SheetCoverage {
  const haystack = ` ${comparable(prompt)} `;
  const fields = SHEET_COVERAGE_FIELDS.map(({ key, label }) => {
    const text = (character[key] ?? "").toString().replace(/\r\n?/g, "\n").trim();
    let chars = 0;
    let sentChars = 0;
    for (const part of text.split(/\n+|(?<=[.!?…])\s+/)) {
      const needle = comparable(part);
      if (!needle) continue;
      chars += part.length;
      if (haystack.includes(` ${needle} `)) sentChars += part.length;
    }
    return { key, label, chars, sentChars };
  }).filter((row) => row.chars > 0);
  const chars = fields.reduce((sum, row) => sum + row.chars, 0);
  const sentChars = fields.reduce((sum, row) => sum + row.sentChars, 0);
  return { fields, chars, sentChars, share: chars ? sentChars / chars : 0 };
}
