import { parseHeadlessEvalArgs, type HeadlessEvalOptions } from "@/services/evalJudgeHeadless";
import { EVAL_PROMPT_VARIANTS } from "@/services/evalJudgePipeline";

/** Pure options of `npm run eval:judge:sequences` (lot J3). */
/** v2 since lot K1: v1 corrected after Romed's calibration (v1 stays versioned to reread older runs). */
export const DEFAULT_SEQUENCE_CORPUS = "docs/eval/sequences_j3_v2.json";
export const DEFAULT_SEQUENCE_REPEATS = 2;

export interface HeadlessSequenceOptions extends Omit<HeadlessEvalOptions, "resumeRunId" | "candidatePresent"> {
  corpus: string;
  /** Sequence ids to play; empty = all of the corpus (after the character filter). */
  sequenceIds: string[];
  /** Lot F: "factuality" judges the facts alone (no style, no sequence judge, one configuration). */
  focus: "all" | "factuality";
}

export const HEADLESS_SEQUENCE_USAGE = `Usage : npm run eval:judge:sequences -- [options]
  --corpus FICHIER            corpus de séquences JSON (défaut ${DEFAULT_SEQUENCE_CORPUS})
  --sequences ID,ID           séquences à jouer (défaut : toutes)
  --focus all|factuality      factuality : note séparée sur les seuls faits (canon, interdits, invention, prémisse
                              fausse), style exclu, une seule configuration (--candidate facultatif)
  --reference VARIANTE        variante de référence (défaut : celle réglée dans l'environnement)
  --candidate VARIANTE        variante candidate (obligatoire) : ${EVAL_PROMPT_VARIANTS.join(", ")}
  --reference-json JSON       instantané appliqué à la référence (en mémoire) ; @fichier.json pour le lire
  --candidate-json JSON       instantané appliqué au candidat (en mémoire) ; @fichier.json pour le lire
  --character all|max|emma    filtre personnage (défaut all)
  --repeats N                 passages par séquence et configuration (défaut ${DEFAULT_SEQUENCE_REPEATS})
  --judge-model ID            modèle juge
  --max-cost-usd N            plafond de coût (défaut 3)
  --env ID                    environnement (sandbox ; prod refusé)
  --out DOSSIER               dossier du rapport (défaut output/eval-judge)
  --dry-run                   estimation seulement, rien n'est joué
Aucune session ni ligne eval_runs n'est écrite ; rapport Markdown et résultats JSON locaux.`;

export function parseHeadlessSequenceArgs(argv: string[]): { options: Partial<HeadlessSequenceOptions>; errors: string[] } {
  const rest: string[] = [];
  let corpus = DEFAULT_SEQUENCE_CORPUS;
  let sequenceIds: string[] = [];
  let focus: "all" | "factuality" = "all";
  const errors: string[] = [];
  let repeatsGiven = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    if (flag === "--focus") {
      const value = inline ?? argv[index + 1];
      if (inline === undefined) index += 1;
      if (value === "all" || value === "factuality") focus = value;
      else errors.push("--focus attend all ou factuality");
      continue;
    }
    if (flag === "--corpus" || flag === "--sequences") {
      const value = inline ?? argv[index + 1];
      if (inline === undefined) index += 1;
      if (!value || value.startsWith("--")) {
        errors.push(`${flag} attend une valeur`);
        continue;
      }
      if (flag === "--corpus") corpus = value.replace(/^@/, "");
      else sequenceIds = value.split(",").map((id) => id.trim()).filter(Boolean);
      continue;
    }
    if (flag === "--resume" || flag === "--candidate-present") {
      errors.push(`${flag} n'est pas disponible pour les séquences (J3)`);
      if (inline === undefined) index += 1;
      continue;
    }
    if (flag === "--repeats") repeatsGiven = true;
    rest.push(arg);
  }
  // Factuality focus plays the reference alone: the candidate the base parser requires is a placeholder.
  if (focus === "factuality" && !rest.some((arg) => arg === "--candidate" || arg.startsWith("--candidate="))) rest.push("--candidate", EVAL_PROMPT_VARIANTS[0]);
  const parsed = parseHeadlessEvalArgs(rest);
  const { resumeRunId: _resume, candidatePresent: _present, referenceGiven: _given, ...base } = parsed.options as Partial<HeadlessEvalOptions> & { referenceGiven?: boolean };
  return {
    options: { ...base, repeats: repeatsGiven ? base.repeats : DEFAULT_SEQUENCE_REPEATS, corpus, sequenceIds, focus },
    errors: [...errors, ...parsed.errors],
  };
}
