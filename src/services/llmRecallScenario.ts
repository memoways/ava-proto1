/**
 * Conversational latency, lot 2 — long-conversation recall test.
 *
 * A scripted conversation of about 40 player turns gives facts about the
 * player early (first name, job, child…) and asks for them late, when the
 * 1 200-character verbatim history of `optimized_v3` no longer holds them:
 * only the structured memory rebuilt from the GM deltas can answer. The
 * replay itself reuses the J3 sequence chain (`runSequenceEvalTurn`,
 * `advanceSequenceState`); this module parses the scenario and grades the
 * recall turns lexically, so a model change is compared on the same facts
 * without a judge call. Pure module.
 */
import type { RuntimeCharacter } from "@/types";
import type { EvalSequence } from "@/services/evalJudgeSequence";

export const RECALL_MIN_TURNS = 20;
export const RECALL_MAX_TURNS = 60;
/** Post-turn GM cost per turn measured on the J1 run (evalJudgePipeline cost model). */
export const RECALL_GM_COST_PER_TURN_USD = 0.0026;
/** Character prompt of a long replayed turn (history + memory), estimate. */
export const RECALL_CHARACTER_TOKENS_IN = 5_000;
export const RECALL_CHARACTER_TOKENS_OUT = 110;

export interface RecallFact {
  id: string;
  label: string;
}

export interface RecallCheck {
  fact: string;
  /** Any of these (accent- and case-insensitive) in the answer = recalled. */
  accept: string[];
  /** Any of these = a wrong value stated (contradiction). */
  forbid: string[];
}

export interface RecallTurn {
  question: string;
  recall: RecallCheck | null;
}

export interface RecallConversation {
  id: string;
  character: string;
  characterKey: RuntimeCharacter;
  filmSeen: boolean | null;
  title: string;
  facts: RecallFact[];
  turns: RecallTurn[];
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

function characterKeyOf(name: string): RuntimeCharacter | null {
  if (/^emma(?:\s|$)/i.test(name)) return "emma";
  if (/^max(?:\s|$)/i.test(name)) return "max";
  return null;
}

/** Reads `docs/eval/rappel_long_*.json`; invalid conversations are reported and left out. */
export function parseRecallScenario(raw: string): { conversations: RecallConversation[]; errors: string[] } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { conversations: [], errors: ["JSON illisible"] }; }
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  if (!Array.isArray(root.conversations)) return { conversations: [], errors: ["« conversations » (liste) attendu"] };
  const conversations: RecallConversation[] = [];
  const errors: string[] = [];
  (root.conversations as unknown[]).forEach((entry, index) => {
    const value = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const id = text(value.id) || `#${index + 1}`;
    const character = text(value.character);
    const characterKey = characterKeyOf(character);
    const facts = (Array.isArray(value.facts) ? value.facts as unknown[] : []).map((fact) => {
      const f = fact && typeof fact === "object" ? fact as Record<string, unknown> : {};
      return { id: text(f.id), label: text(f.label) };
    });
    const known = new Set(facts.map((f) => f.id));
    const problems: string[] = [];
    if (!characterKey) problems.push(`personnage inconnu « ${character || "?"} »`);
    if (facts.some((f) => !f.id || !f.label)) problems.push("fait sans id ou sans libellé");
    const turnsRaw = Array.isArray(value.turns) ? value.turns as unknown[] : [];
    if (turnsRaw.length < RECALL_MIN_TURNS || turnsRaw.length > RECALL_MAX_TURNS) {
      problems.push(`${turnsRaw.length} tours (attendu ${RECALL_MIN_TURNS} à ${RECALL_MAX_TURNS})`);
    }
    const turns: RecallTurn[] = turnsRaw.map((turnRaw, turnIndex) => {
      const turn = turnRaw && typeof turnRaw === "object" ? turnRaw as Record<string, unknown> : {};
      const question = text(turn.question);
      if (!question) problems.push(`tour ${turnIndex + 1} sans question`);
      const recallRaw = turn.recall && typeof turn.recall === "object" ? turn.recall as Record<string, unknown> : null;
      if (!recallRaw) return { question, recall: null };
      const recall = { fact: text(recallRaw.fact), accept: list(recallRaw.accept), forbid: list(recallRaw.forbid) };
      if (!known.has(recall.fact)) problems.push(`tour ${turnIndex + 1} : fait inconnu « ${recall.fact} »`);
      if (!recall.accept.length) problems.push(`tour ${turnIndex + 1} : aucune réponse acceptée`);
      return { question, recall };
    });
    if (!turns.some((t) => t.recall)) problems.push("aucun tour de rappel");
    if (problems.length) { errors.push(`${id} : ${problems.join(" ; ")}`); return; }
    conversations.push({
      id, character, characterKey: characterKey!, title: text(value.title) || id,
      filmSeen: typeof value.filmSeen === "boolean" ? value.filmSeen : null, facts, turns,
    });
  });
  return { conversations, errors };
}

/** Minimal sequence the J3 replay needs (character, film answer); the turns are not judged. */
export function recallAsSequence(conversation: RecallConversation): EvalSequence {
  return {
    id: conversation.id,
    character: conversation.character,
    characterKey: conversation.characterKey,
    filmSeen: conversation.filmSeen,
    register: "",
    title: conversation.title,
    objective: "Rappel en conversation longue",
    conversationCriteria: [],
    gameMasterCriteria: "",
    turns: conversation.turns.map((turn) => ({
      question: turn.question, expectedResponse: "", requiredFacts: [], acceptedAlternatives: [], forbiddenClaims: [],
      continuityCriteria: "", tone: "retenu", maxLength: null,
    })),
  };
}

export function normalizeForRecall(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
}

function containsTerm(haystack: string, term: string): boolean {
  const needle = normalizeForRecall(term).trim();
  if (!needle) return false;
  // Whole word for short or numeric terms ("7", "Noé"), substring otherwise ("infirmi" covers infirmière).
  if (needle.length <= 4 || /^\d+$/.test(needle)) {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
  }
  return haystack.includes(needle);
}

export type RecallVerdict = "recalled" | "contradicted" | "missed" | "error";

export function gradeRecall(check: RecallCheck, answer: string, error: string | null = null): RecallVerdict {
  if (error || !answer.trim()) return "error";
  const normalized = normalizeForRecall(answer);
  if (check.forbid.some((term) => containsTerm(normalized, term))) return "contradicted";
  return check.accept.some((term) => containsTerm(normalized, term)) ? "recalled" : "missed";
}

export interface RecallTurnResult {
  turnIndex: number;
  question: string;
  response: string;
  latencyMs: number;
  error: string | null;
  memoryLastTurn: number;
  recall: { fact: string; verdict: RecallVerdict } | null;
}

export interface RecallRunSummary {
  model: string;
  conversationId: string;
  characterKey: RuntimeCharacter;
  turns: number;
  errors: number;
  checks: number;
  recalled: number;
  contradicted: number;
  /** Recalled / checks (a contradiction counts as a miss). */
  recallRate: number | null;
  medianTurnMs: number | null;
  /** Structured memory turn reached at the end (0 = the GM never merged a delta). */
  memoryLastTurn: number;
  byFact: Array<{ fact: string; verdict: RecallVerdict }>;
}

export function summarizeRecallRun(model: string, conversation: RecallConversation, turns: RecallTurnResult[]): RecallRunSummary {
  const checks = turns.filter((t) => t.recall);
  const recalled = checks.filter((t) => t.recall!.verdict === "recalled").length;
  const latencies = turns.filter((t) => !t.error).map((t) => t.latencyMs).sort((a, b) => a - b);
  const mid = latencies.length ? (latencies[Math.floor((latencies.length - 1) / 2)] + latencies[Math.ceil((latencies.length - 1) / 2)]) / 2 : null;
  return {
    model,
    conversationId: conversation.id,
    characterKey: conversation.characterKey,
    turns: turns.length,
    errors: turns.filter((t) => t.error).length,
    checks: checks.length,
    recalled,
    contradicted: checks.filter((t) => t.recall!.verdict === "contradicted").length,
    recallRate: checks.length ? Number((recalled / checks.length).toFixed(3)) : null,
    medianTurnMs: mid === null ? null : Math.round(mid),
    memoryLastTurn: turns.at(-1)?.memoryLastTurn ?? 0,
    byFact: checks.map((t) => ({ fact: t.recall!.fact, verdict: t.recall!.verdict })),
  };
}

export function estimateRecallRunUsd(turns: number, price: { input: number; output: number }): number {
  const character = (RECALL_CHARACTER_TOKENS_IN * price.input + RECALL_CHARACTER_TOKENS_OUT * price.output) / 1e6;
  return Number((turns * (character + RECALL_GM_COST_PER_TURN_USD)).toFixed(4));
}

export function formatRecallReport(date: string, environment: string, summaries: RecallRunSummary[]): string {
  const verdictMark: Record<RecallVerdict, string> = { recalled: "✓", contradicted: "✗", missed: "–", error: "!" };
  const lines = [
    `# Rappel en conversation longue — ${date}`,
    "",
    `Environnement ${environment} · chaîne réelle (\`processPRD4Turn\`, historique livré, mémoire structurée fusionnée depuis le GM). ✓ rappelé · – oublié · ✗ valeur fausse · ! tour en erreur.`,
    "",
    "| Modèle | conversation | tours | erreurs | rappel | contradictions | mémoire (dernier tour) | tour méd. | détail |",
    "|---|---|---|---|---|---|---|---|---|",
    ...summaries.map((s) => `| ${s.model} | ${s.conversationId} | ${s.turns} | ${s.errors} | ${s.recalled}/${s.checks}${s.recallRate === null ? "" : ` (${Math.round(s.recallRate * 100)} %)`} | ${s.contradicted} | ${s.memoryLastTurn} | ${s.medianTurnMs === null ? "–" : `${(s.medianTurnMs / 1000).toFixed(1)} s`} | ${s.byFact.map((f) => `${f.fact} ${verdictMark[f.verdict]}`).join(", ")} |`),
  ];
  return `${lines.join("\n")}\n`;
}
