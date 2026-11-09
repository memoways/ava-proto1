import { EVAL_DEFAULT_JUDGE_MODEL, EVAL_PROMPT_VARIANTS, EVAL_REPEATS, type EvalCostEstimate, type EvalPromptVariant } from "@/services/evalJudgePipeline";
import type { EvalCharacterFilter } from "@/services/evalJudgeRunner";
import { ENVIRONMENT_IDS, canSwitchEnvironments, type AdminUserProfile, type EnvironmentId } from "@/services/environmentContext";

/**
 * Pure helpers of the headless judge (`npm run eval:judge`). The entry script
 * only wires them to the real Lovable Cloud session; everything decidable
 * without the network lives here and is unit-tested.
 */

export const DEFAULT_EVAL_COST_CAP_USD = 3;
export const MAX_EVAL_REPEATS = 5;
/** Feature keys billed by an isolated eval turn (character + judge, GM post-turn). */
export const EVAL_COST_FEATURE_KEYS = ["llm_as_judge", "prd4_gm_post_turn"] as const;

export interface HeadlessEvalOptions {
  environment: EnvironmentId;
  reference: EvalPromptVariant;
  candidate: EvalPromptVariant;
  referenceJson: string;
  candidateJson: string;
  character: EvalCharacterFilter;
  repeats: number;
  judgeModel: string;
  maxCostUsd: number;
  resumeRunId: string | null;
  outDir: string;
  dryRun: boolean;
}

export const HEADLESS_EVAL_USAGE = `Usage : npm run eval:judge -- [options]
  --reference VARIANTE        variante de prompt de référence (défaut : celle réglée dans l'environnement)
  --candidate VARIANTE        variante candidate (obligatoire sauf --resume) : ${EVAL_PROMPT_VARIANTS.join(", ")}
  --reference-json JSON       instantané JSON appliqué à la référence (en mémoire)
  --candidate-json JSON       instantané JSON appliqué au candidat (en mémoire)
  --character all|max|emma    filtre personnage (défaut all)
  --repeats N                 passages par question et configuration (1-${MAX_EVAL_REPEATS}, défaut ${EVAL_REPEATS})
  --judge-model ID            modèle juge (défaut ${EVAL_DEFAULT_JUDGE_MODEL})
  --max-cost-usd N            plafond de coût, arrêt propre au dépassement (défaut ${DEFAULT_EVAL_COST_CAP_USD})
  --env ID                    environnement de réglages, jamais prod (défaut sandbox-ulrich)
  --resume RUN_ID             reprendre un run en pause (mêmes configurations)
  --out DOSSIER               dossier du rapport Markdown (défaut output/eval-judge)
  --dry-run                   s'arrêter après l'estimation, sans créer de run
Identifiants : AVA_EVAL_EMAIL et AVA_EVAL_PASSWORD dans l'environnement (ou .env.eval.local).`;

function isVariant(value: string): value is EvalPromptVariant {
  return (EVAL_PROMPT_VARIANTS as string[]).includes(value);
}

/**
 * Parses CLI flags (`--key value` or `--key=value`). Workflow inputs arrive as
 * empty strings when left blank: an empty value means "default".
 */
export function parseHeadlessEvalArgs(argv: string[]): { options: Partial<HeadlessEvalOptions> & { referenceGiven: boolean }; errors: string[] } {
  const raw = new Map<string, string>();
  const flags = new Set<string>();
  const errors: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (!arg.startsWith("--")) {
      errors.push(`argument inattendu : ${arg}`);
      continue;
    }
    const eq = arg.indexOf("=");
    const key = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
    if (key === "dry-run" || key === "help") {
      flags.add(key);
      continue;
    }
    const value = eq > 0 ? arg.slice(eq + 1) : argv[index + 1];
    if (eq < 0) index += 1;
    if (value === undefined || (eq < 0 && value.startsWith("--"))) {
      if (eq < 0 && value !== undefined) index -= 1;
      errors.push(`--${key} attend une valeur`);
      continue;
    }
    raw.set(key, value.trim());
  }

  const known = new Set(["reference", "candidate", "reference-json", "candidate-json", "character", "repeats", "judge-model", "max-cost-usd", "env", "resume", "out"]);
  for (const key of raw.keys()) if (!known.has(key)) errors.push(`option inconnue : --${key}`);

  const options: Partial<HeadlessEvalOptions> & { referenceGiven: boolean } = { referenceGiven: false, dryRun: flags.has("dry-run") };
  const get = (key: string) => {
    const value = raw.get(key);
    return value ? value : undefined;
  };

  const reference = get("reference");
  if (reference !== undefined) {
    if (isVariant(reference)) {
      options.reference = reference;
      options.referenceGiven = true;
    } else errors.push(`variante de référence inconnue : ${reference}`);
  }
  const candidate = get("candidate");
  if (candidate !== undefined) {
    if (isVariant(candidate)) options.candidate = candidate;
    else errors.push(`variante candidate inconnue : ${candidate}`);
  }
  options.referenceJson = get("reference-json") ?? "";
  options.candidateJson = get("candidate-json") ?? "";

  const character = get("character") ?? "all";
  if (character === "all" || character === "max" || character === "emma") options.character = character;
  else errors.push(`--character doit valoir all, max ou emma (reçu ${character})`);

  const repeats = Number(get("repeats") ?? EVAL_REPEATS);
  if (Number.isInteger(repeats) && repeats >= 1 && repeats <= MAX_EVAL_REPEATS) options.repeats = repeats;
  else errors.push(`--repeats doit être un entier de 1 à ${MAX_EVAL_REPEATS}`);

  options.judgeModel = get("judge-model") ?? EVAL_DEFAULT_JUDGE_MODEL;

  const cap = Number((get("max-cost-usd") ?? String(DEFAULT_EVAL_COST_CAP_USD)).replace(",", "."));
  if (Number.isFinite(cap) && cap > 0) options.maxCostUsd = cap;
  else errors.push("--max-cost-usd doit être un montant positif");

  const env = get("env") ?? "sandbox-ulrich";
  if (env === "prod") errors.push("le juge sans navigateur ne tourne jamais sur prod");
  else if ((ENVIRONMENT_IDS as readonly string[]).includes(env)) options.environment = env as EnvironmentId;
  else errors.push(`environnement inconnu : ${env}`);

  const resume = get("resume");
  if (resume !== undefined) {
    if (/^[0-9a-f-]{36}$/i.test(resume)) options.resumeRunId = resume;
    else errors.push("--resume attend l'identifiant UUID d'un run");
  } else {
    options.resumeRunId = null;
  }
  if (!options.resumeRunId && !flags.has("help") && options.candidate === undefined && !errors.some((error) => error.startsWith("variante candidate"))) {
    errors.push("--candidate est obligatoire (ou --resume RUN_ID)");
  }
  options.outDir = get("out") ?? "output/eval-judge";
  return { options, errors };
}

/**
 * Same rule as the admin: only the switch account chooses its environment;
 * any other admin stays on its default one. Production is always refused.
 */
export function resolveHeadlessEnvironment(profile: AdminUserProfile, requested: EnvironmentId): { environment: EnvironmentId | null; note: string | null; error: string | null } {
  const environment = canSwitchEnvironments(profile) ? requested : profile.default_environment_id;
  if (environment === "prod") {
    return { environment: null, note: null, error: "Ce compte admin est rattaché à prod : le juge sans navigateur exige une sandbox." };
  }
  const note = environment !== requested
    ? `Environnement ${requested} demandé, mais ce compte ne peut pas changer d'environnement : ${environment} utilisé.`
    : null;
  return { environment, note, error: null };
}

export function perTurnCostUsd(estimate: EvalCostEstimate): number {
  return estimate.turns > 0 ? estimate.estimatedCostUsd / estimate.turns : 0;
}

/** Pre-flight check: never start a run whose estimate already crosses the cap. */
export function checkCostCap(estimate: EvalCostEstimate, capUsd: number, alreadySpentUsd = 0): string | null {
  const remaining = estimate.estimatedCostUsd + alreadySpentUsd;
  if (remaining <= capUsd + 1e-9) return null;
  return `Estimation ${remaining.toFixed(2)} $ au-delà du plafond ${capUsd.toFixed(2)} $ : réduire --repeats, filtrer --character ou relever --max-cost-usd.`;
}

/**
 * Sum of measured costs. A row is inserted with `cost_usd = 0` and priced
 * later (OpenRouter generation lookup at 15, 30 and 60 s): zero means
 * "pending" until its status says the lookup gave up.
 */
export function sumUsageCost(rows: Array<{ cost_usd: number | string | null; status?: string | null }>): {
  usd: number;
  pricedCalls: number;
  pendingCalls: number;
  failedCalls: number;
} {
  let usd = 0;
  let pricedCalls = 0;
  let pendingCalls = 0;
  let failedCalls = 0;
  for (const row of rows) {
    const cost = typeof row.cost_usd === "string" ? Number(row.cost_usd) : row.cost_usd;
    if (typeof cost === "number" && Number.isFinite(cost) && cost > 0) {
      usd += cost;
      pricedCalls += 1;
    } else if (row.status === "cost_fetch_failed" || row.status === "error") {
      failedCalls += 1;
    } else {
      pendingCalls += 1;
    }
  }
  return { usd: Number(usd.toFixed(4)), pricedCalls, pendingCalls, failedCalls };
}
