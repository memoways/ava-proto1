/**
 * LLM judge lot J3 — replay of a 3 to 5 turn sequence, reference vs candidate.
 *
 * The player's turns are fixed by the corpus; the character's replies are
 * generated through the live chain (`processPRD4Turn`), and the state a real
 * session carries from one turn to the next is rebuilt in memory exactly as
 * `IndexPRD4` does: delivered history, structured memory merged from the GM
 * `memory_delta`, and the GM loop (`next_turn_guidance`, `next_speech_state`,
 * cumulated `topics_covered`). Nothing is persisted: no session, no
 * `admin_settings`, no `character_prompts`, no `eval_runs` row.
 *
 * Two separate grades, never merged (corpus v0, Romed and Ulrich):
 * - per turn: the J1 grid, unchanged, with the previous exchanges as context;
 * - per sequence: five continuity criteria judged on the whole transcript.
 *
 * Pure module: the network calls are injected (`SequenceRunDeps`).
 */
import type { ConversationMessage, PRD4PostTurnEvaluation, RuntimeCharacter } from "@/types";
import type { ConversationMemoryV1 } from "@/types/conversationMemory";
import { createEmptyConversationMemory, mergeConversationMemory } from "@/services/conversationMemoryV1";
import {
  clampScore,
  mean,
  stddev,
  type EvalItem,
  type EvalJudgeScore,
  type EvalTurnConfig,
  type EvalFactor,
} from "@/services/evalJudgePipeline";
import {
  criterionValues,
  readJudgeSubScores,
  weightedScore,
  EVAL_SCORE_CRITERIA,
  type EvalScoreWeights,
} from "@/services/evalJudgeScoring";

// ------------------------------------------------------------------ corpus

export const SEQUENCE_MIN_TURNS = 3;
export const SEQUENCE_MAX_TURNS = 5;
/** Seconds of play assumed per turn for the temporal context of the replay. */
export const SEQUENCE_SECONDS_PER_TURN = 45;

export interface EvalSequenceTurn {
  question: string;
  expectedResponse: string;
  requiredFacts: string[];
  acceptedAlternatives: string[];
  forbiddenClaims: string[];
  continuityCriteria: string;
  tone: string;
  maxLength: number | null;
}

export interface EvalSequence {
  id: string;
  character: string;
  characterKey: RuntimeCharacter;
  /** true = « vu le film », false = « pas vu », null = not asked. */
  filmSeen: boolean | null;
  register: string;
  title: string;
  objective: string;
  conversationCriteria: string[];
  gameMasterCriteria: string;
  turns: EvalSequenceTurn[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? [single] : [];
}

function characterKeyOf(name: string): RuntimeCharacter | null {
  if (/^emma(?:\s|$)/i.test(name)) return "emma";
  if (/^max(?:\s|$)/i.test(name)) return "max";
  return null;
}

/**
 * Reads a sequence corpus (`docs/eval/sequences_*.json`, shape close to the
 * Core v2 contract: `conversations[].turns[]` with the v1 turn fields).
 * Invalid sequences are reported and left out; nothing is guessed.
 */
export function parseSequenceCorpus(raw: string): { sequences: EvalSequence[]; errors: string[]; status: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { sequences: [], errors: ["JSON illisible"], status: null };
  }
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  const conversations = Array.isArray(root?.conversations) ? root!.conversations as unknown[] : null;
  if (!conversations) return { sequences: [], errors: ["« conversations » (liste) attendu"], status: null };
  const errors: string[] = [];
  const sequences: EvalSequence[] = [];
  const seen = new Set<string>();
  conversations.forEach((entry, index) => {
    const value = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const id = text(value.id) || `#${index + 1}`;
    const character = text(value.character);
    const characterKey = characterKeyOf(character);
    const turnsRaw = Array.isArray(value.turns) ? value.turns as unknown[] : [];
    const problems: string[] = [];
    if (seen.has(id)) problems.push("identifiant en double");
    if (!characterKey) problems.push(`personnage inconnu « ${character || "?"} » (Max ou Emma)`);
    if (turnsRaw.length < SEQUENCE_MIN_TURNS || turnsRaw.length > SEQUENCE_MAX_TURNS) {
      problems.push(`${turnsRaw.length} tours (attendu ${SEQUENCE_MIN_TURNS} à ${SEQUENCE_MAX_TURNS})`);
    }
    const turns: EvalSequenceTurn[] = turnsRaw.map((turnRaw, turnIndex) => {
      const turn = turnRaw && typeof turnRaw === "object" ? turnRaw as Record<string, unknown> : {};
      const question = text(turn.question);
      if (!question) problems.push(`tour ${turnIndex + 1} sans question`);
      const maxLength = typeof turn.maxLength === "number" && Number.isFinite(turn.maxLength) && turn.maxLength > 0
        ? Math.round(turn.maxLength) : null;
      return {
        question,
        expectedResponse: text(turn.expectedResponse),
        requiredFacts: list(turn.requiredFacts),
        acceptedAlternatives: list(turn.acceptedAlternatives),
        forbiddenClaims: list(turn.forbiddenClaims),
        continuityCriteria: text(turn.continuityCriteria),
        tone: text(turn.tone) || "retenu",
        maxLength,
      };
    });
    if (problems.length) {
      errors.push(`${id} : ${problems.join(" ; ")}`);
      return;
    }
    seen.add(id);
    sequences.push({
      id,
      character,
      characterKey: characterKey!,
      filmSeen: typeof value.filmSeen === "boolean" ? value.filmSeen : null,
      register: text(value.register),
      title: text(value.title) || id,
      objective: text(value.objective),
      conversationCriteria: list(value.conversationCriteria),
      gameMasterCriteria: text(value.gameMasterCriteria),
      turns,
    });
  });
  return { sequences, errors, status: text(root?.status) || null };
}

/** Film answer the game would carry for this sequence (`IndexPRD4` hasSeenFilm). */
export function sequenceFilmAnswer(sequence: Pick<EvalSequence, "filmSeen">): "vu" | "pas_vu" | null {
  if (sequence.filmSeen === true) return "vu";
  if (sequence.filmSeen === false) return "pas_vu";
  return null;
}

/**
 * One corpus turn in the shape the J1 judge reads. The J1 grid is unchanged:
 * alternatives and the expected continuity go to the judge notes.
 */
export function sequenceTurnAsEvalItem(sequence: EvalSequence, turnIndex: number): EvalItem {
  const turn = sequence.turns[turnIndex];
  const notes = [
    turn.acceptedAlternatives.length ? `Alternatives acceptées : ${turn.acceptedAlternatives.join(" ; ")}.` : "",
    turn.continuityCriteria ? `Continuité attendue : ${turn.continuityCriteria}` : "",
    sequence.register ? `Registre de la séquence : ${sequence.register}.` : "",
  ].filter(Boolean).join("\n");
  return {
    id: `${sequence.id}#${turnIndex + 1}`,
    question: turn.question,
    gold_answer: turn.expectedResponse,
    must_include: turn.requiredFacts.join(" ; "),
    must_not: turn.forbiddenClaims.join(" ; "),
    tone: turn.tone,
    max_length: turn.maxLength,
    judge_notes: notes,
    character_name: sequence.character,
    category: "sequence",
    active: true,
    sort_order: turnIndex + 1,
    notion_page_id: "",
    created_at: "",
    updated_at: "",
    synced_at: "",
  };
}

// ------------------------------------------------------------ replay state

export interface SequenceReplayState {
  /** Delivered history, user and character turns, as `IndexPRD4` keeps it. */
  history: ConversationMessage[];
  /** Structured memory rebuilt from the GM deltas (persisted in a real session). */
  memory: ConversationMemoryV1 | null;
  /** `next_turn_guidance` of the previous executed post-turn, consumed by the next turn. */
  gmGuidance: string | null;
  gmSpeechState: string | null;
  topicsCovered: string[];
}

export function initialSequenceState(): SequenceReplayState {
  return { history: [], memory: null, gmGuidance: null, gmSpeechState: null, topicsCovered: [] };
}

const MAX_TOPICS_COVERED = 24;

/**
 * State after one turn. Mirrors `IndexPRD4`: the guidance and speech state
 * are kept only when the post-turn executed; topics are deduplicated and
 * capped at 24; the memory delta is merged as `persistPostTurnMemory` would.
 */
export function advanceSequenceState(
  state: SequenceReplayState,
  input: {
    characterKey: RuntimeCharacter;
    userMessage: string;
    response: string;
    turnIndex: number;
    gm: PRD4PostTurnEvaluation | null;
    timestamp: number;
  },
): SequenceReplayState {
  const history: ConversationMessage[] = [
    ...state.history,
    { role: "user", content: input.userMessage, timestamp: input.timestamp, spokenWith: input.characterKey },
    { role: input.characterKey, content: input.response, timestamp: input.timestamp + 1, spokenWith: input.characterKey },
  ];
  const executed = input.gm?.execution_status === "executed";
  if (!executed || !input.gm) {
    return { ...state, history, gmGuidance: null, gmSpeechState: null };
  }
  const topics = [...state.topicsCovered];
  const known = new Set(topics.map((topic) => topic.toLowerCase()));
  for (const topic of input.gm.topics_covered ?? []) {
    const clean = topic?.trim();
    if (clean && !known.has(clean.toLowerCase())) {
      known.add(clean.toLowerCase());
      topics.push(clean);
    }
  }
  const memory = input.gm.memory_delta
    ? mergeConversationMemory(state.memory ?? createEmptyConversationMemory(), input.gm.memory_delta, input.turnIndex, input.characterKey)
    : state.memory;
  return {
    history,
    memory,
    gmGuidance: input.gm.next_turn_guidance?.trim() || null,
    gmSpeechState: input.gm.next_speech_state ?? null,
    topicsCovered: topics.slice(-MAX_TOPICS_COVERED),
  };
}

// ---------------------------------------------------------------- judging

export const SEQUENCE_CRITERIA = [
  { key: "continuity", label: "Continuité des faits", description: "aucun fait ne change d'un tour à l'autre ; prénom, registre et détails déjà dits sont tenus" },
  { key: "thread_resumption", label: "Reprise d'un fil sans répétition", description: "un sujet ouvert est repris quand il revient, sans redire ni reformuler ce qui a déjà été dit" },
  { key: "rumination", label: "Rumination crédible", description: "ce qui pèse (culpabilité, peur, absence) revient de lui-même par moments, sans boucle mécanique ni absence totale" },
  { key: "timeline_consistency", label: "Timeline sur la durée", description: "les repères relatifs (hier, il y a deux jours…) et le présent restent les mêmes sur toute la séquence" },
  { key: "relational_trajectory", label: "Trajectoire relationnelle", description: "l'ouverture ou la fermeture suit ce que l'interlocuteur fait, sans saut ni confiance acquise d'un coup" },
] as const;

export type SequenceCriterionKey = typeof SEQUENCE_CRITERIA[number]["key"];
export type SequenceWeights = Record<SequenceCriterionKey, number>;

/** Continuity and timeline weigh as much as the J1 canon criterion (3). */
export const DEFAULT_SEQUENCE_WEIGHTS: SequenceWeights = {
  continuity: 3,
  timeline_consistency: 3,
  thread_resumption: 2,
  rumination: 2,
  relational_trajectory: 2,
};

export interface SequenceJudgeScore {
  criteria: Partial<Record<SequenceCriterionKey, number>>;
  overall: number;
  rationale: string;
  raw: string;
}

export interface TranscriptTurn {
  question: string;
  response: string;
}

function characterLabel(sequence: EvalSequence): string {
  return sequence.character.split(/\s+/)[0] || sequence.character;
}

/** Previous exchanges, as context for the per-turn judge. */
export function formatPriorExchanges(sequence: EvalSequence, prior: TranscriptTurn[]): string {
  const name = characterLabel(sequence);
  return prior.map((turn, index) => `Tour ${index + 1}\nJoueur : ${turn.question}\n${name} : ${turn.response}`).join("\n\n");
}

export function buildSequenceJudgePrompt(sequence: EvalSequence, transcript: TranscriptTurn[], canonReference = ""): string {
  const name = characterLabel(sequence);
  const continuity = sequence.turns
    .map((turn, index) => turn.continuityCriteria ? `- Tour ${index + 1} : ${turn.continuityCriteria}` : "")
    .filter(Boolean)
    .join("\n");
  const exchanges = transcript
    .map((turn, index) => `### Tour ${index + 1}\nJoueur : ${turn.question}\n${name} : ${turn.response || "(pas de réponse)"}`)
    .join("\n\n");
  const criteria = SEQUENCE_CRITERIA.map((criterion) => `- ${criterion.key} : ${criterion.description}.`).join("\n");
  return `Tu es un juge strict pour l'expérience narrative « Où est Ava ? ».
Tu évalues une conversation entière de ${transcript.length} tours entre un joueur et ${sequence.character}, pas chaque réplique isolée (elles sont notées à part).
Parcours : ${sequence.filmSeen === true ? "le joueur a vu le film" : sequence.filmSeen === false ? "le joueur n'a pas vu le film" : "non précisé"} · registre attendu : ${sequence.register || "libre"}.

## OBJECTIF DE LA SÉQUENCE
${sequence.objective || "(aucun)"}

## CRITÈRES DE COHÉRENCE GLOBALE
${sequence.conversationCriteria.map((line) => `- ${line}`).join("\n") || "(aucun)"}

## CONTINUITÉ ATTENDUE ENTRE LES TOURS
${continuity || "(aucune)"}

## ATTENTE GAME MASTER (information)
${sequence.gameMasterCriteria || "(aucune)"}

## REPÈRES CANON DE ${sequence.character.toLocaleUpperCase("fr")} (lecture seule)
${canonReference || "(fiche non fournie)"}

## CONVERSATION
${exchanges}

## CINQ CRITÈRES DE SÉQUENCE (0 à 5)
${criteria}
Une réponse brève ou une retenue n'est pas un défaut de continuité. Une même phrase redite d'un tour à l'autre est un défaut de reprise. Un fait qui change de date ou de version est un défaut de continuité ou de timeline, même si chaque réplique isolée paraît juste.

Retourne UNIQUEMENT un JSON :
{
  "continuity": 0-5,
  "thread_resumption": 0-5,
  "rumination": 0-5,
  "timeline_consistency": 0-5,
  "relational_trajectory": 0-5,
  "overall": 0-10,
  "rationale": "2 phrases, 400 caractères au plus : la rupture la plus nette, avec son tour"
}`;
}

export function parseSequenceJudgeResponse(raw: string): SequenceJudgeScore {
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};
  if (match) {
    try {
      parsed = JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (!Object.keys(parsed).length) {
    // Truncated answer (rationale cut by the token budget): keep the grades already written.
    for (const key of [...SEQUENCE_CRITERIA.map((criterion) => criterion.key), "overall"]) {
      const value = raw.match(new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
      if (value) parsed[key] = Number(value[1]);
    }
    const rationale = raw.match(/"rationale"\s*:\s*"([^"]*)/);
    if (rationale && Object.keys(parsed).length) parsed.rationale = `${rationale[1]}… (réponse tronquée)`;
  }
  const criteria: Partial<Record<SequenceCriterionKey, number>> = {};
  for (const { key } of SEQUENCE_CRITERIA) {
    if (parsed[key] !== undefined && parsed[key] !== null) criteria[key] = clampScore(parsed[key], 0, 5);
  }
  return {
    criteria,
    overall: clampScore(parsed.overall, 0, 10),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 800) : "JSON juge illisible",
    raw,
  };
}

/** Weighted sequence grade /10; absent criteria leave the denominator. Null when none. */
export function sequenceScore(score: Pick<SequenceJudgeScore, "criteria">, weights: SequenceWeights = DEFAULT_SEQUENCE_WEIGHTS): number | null {
  let weighted = 0;
  let total = 0;
  for (const { key } of SEQUENCE_CRITERIA) {
    const value = score.criteria[key];
    if (typeof value !== "number") continue;
    const weight = weights[key] ?? 0;
    weighted += weight * (value / 5);
    total += weight;
  }
  return total > 0 ? Number(((weighted / total) * 10).toFixed(3)) : null;
}

// ----------------------------------------------------------------- replay

export interface SequenceTurnRequest {
  sequence: EvalSequence;
  /** 1-based turn index within the sequence (the session's user-turn index). */
  turnIndex: number;
  userMessage: string;
  history: ConversationMessage[];
  memory: ConversationMemoryV1 | null;
  gmGuidance: string | null;
  gmTopicsCovered: string[];
  gmSpeechState: string | null;
  timeElapsedSeconds: number;
  hasSeenFilm: "vu" | "pas_vu" | null;
}

export interface SequenceTurnTrace {
  response: string;
  gm: PRD4PostTurnEvaluation | null;
  latencyMs: number;
  error?: string;
  canonReference?: string;
}

export interface SequenceRunDeps {
  runTurn: (config: EvalTurnConfig, request: SequenceTurnRequest, signal?: AbortSignal) => Promise<SequenceTurnTrace>;
  judgeTurn: (item: EvalItem, response: string, context: { priorExchanges: string; canonReference: string }, signal?: AbortSignal) => Promise<EvalJudgeScore>;
  judgeSequence: (sequence: EvalSequence, transcript: TranscriptTurn[], canonReference: string, signal?: AbortSignal) => Promise<SequenceJudgeScore>;
}

export interface SequenceTurnResult {
  turnIndex: number;
  question: string;
  response: string;
  error: string | null;
  latencyMs: number;
  /** Guidance injected into this turn (produced by the previous post-turn). */
  gmGuidanceIn: string | null;
  gmStatus: string;
  /** Why a post-turn did not execute (`execution_reason` and validation codes); empty when executed. */
  gmIssue: string | null;
  gmGuidanceOut: string | null;
  memoryLastTurnBefore: number;
  memoryLastTurnAfter: number;
  judge: EvalJudgeScore | null;
  /** J1 weighted grade /10 (null when the judge failed). */
  score: number | null;
}

export interface SequenceRunResult {
  sequenceId: string;
  title: string;
  characterKey: RuntimeCharacter;
  configLabel: string;
  factor: EvalFactor;
  repeatIndex: number;
  turns: SequenceTurnResult[];
  sequenceJudge: SequenceJudgeScore | null;
  sequenceScore: number | null;
  /** Mean of the turn grades /10. */
  turnMean: number | null;
  /** Turns that received a non-empty guidance from the previous post-turn. */
  guidanceTransmitted: number;
  errors: number;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
}

/** Bounded technical reason of a post-turn that did not execute (no raw output). */
export function describeGmIssue(gm: PRD4PostTurnEvaluation | null): string | null {
  if (!gm) return "sans état terminal";
  if (gm.execution_status === "executed" || !gm.execution_status) return null;
  const codes = (gm.validation_issues ?? []).map((issue) => issue.missing_fields?.length
    ? `${issue.code}(${issue.missing_fields.join(",")})` : issue.code);
  return [gm.execution_reason ?? gm.execution_status, ...codes].join(" · ");
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Plays one sequence for one configuration: each turn waits for the post-turn
 * (GM + memory) before the next one, as the Core v2 harness requires, but the
 * GM never blocks a real session (this path is evaluation only).
 */
export async function runEvalSequence(input: {
  sequence: EvalSequence;
  config: EvalTurnConfig;
  repeatIndex: number;
  deps: SequenceRunDeps;
  turnWeights: EvalScoreWeights;
  sequenceWeights?: SequenceWeights;
  signal?: AbortSignal;
  now?: () => number;
  onTurn?: (turn: SequenceTurnResult) => void;
}): Promise<SequenceRunResult> {
  const { sequence, config, deps } = input;
  const now = input.now ?? Date.now;
  let state = initialSequenceState();
  const turns: SequenceTurnResult[] = [];
  const transcript: TranscriptTurn[] = [];
  let canonReference = "";
  for (let index = 0; index < sequence.turns.length; index += 1) {
    input.signal?.throwIfAborted();
    const turnIndex = index + 1;
    const corpusTurn = sequence.turns[index];
    const memoryBefore = state.memory?.lastTurn ?? 0;
    let trace: SequenceTurnTrace;
    try {
      trace = await deps.runTurn(config, {
        sequence,
        turnIndex,
        userMessage: corpusTurn.question,
        history: state.history,
        memory: state.memory,
        gmGuidance: state.gmGuidance,
        gmTopicsCovered: state.topicsCovered,
        gmSpeechState: state.gmSpeechState,
        timeElapsedSeconds: index * SEQUENCE_SECONDS_PER_TURN,
        hasSeenFilm: sequenceFilmAnswer(sequence),
      }, input.signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      trace = { response: "", gm: null, latencyMs: 0, error: errorText(error) };
    }
    if (trace.canonReference) canonReference = trace.canonReference;
    let judge: EvalJudgeScore | null = null;
    let judgeError: string | null = null;
    if (trace.response.trim()) {
      try {
        judge = await deps.judgeTurn(sequenceTurnAsEvalItem(sequence, index), trace.response, {
          priorExchanges: formatPriorExchanges(sequence, transcript),
          canonReference,
        }, input.signal);
      } catch (error) {
        if (isAbortError(error)) throw error;
        judgeError = `juge : ${errorText(error)}`;
      }
    }
    const sub = judge ? readJudgeSubScores(judge) : null;
    const next = advanceSequenceState(state, {
      characterKey: sequence.characterKey,
      userMessage: corpusTurn.question,
      response: trace.response,
      turnIndex,
      gm: trace.gm,
      timestamp: now(),
    });
    const result: SequenceTurnResult = {
      turnIndex,
      question: corpusTurn.question,
      response: trace.response,
      error: trace.error ?? judgeError,
      latencyMs: trace.latencyMs,
      gmGuidanceIn: state.gmGuidance,
      gmStatus: trace.gm?.execution_status ?? "absent",
      gmIssue: describeGmIssue(trace.gm),
      gmGuidanceOut: next.gmGuidance,
      memoryLastTurnBefore: memoryBefore,
      memoryLastTurnAfter: next.memory?.lastTurn ?? 0,
      judge,
      score: sub ? weightedScore(sub, input.turnWeights) : null,
    };
    turns.push(result);
    input.onTurn?.(result);
    transcript.push({ question: corpusTurn.question, response: trace.response });
    state = next;
  }

  let sequenceJudge: SequenceJudgeScore | null = null;
  try {
    sequenceJudge = await deps.judgeSequence(sequence, transcript, canonReference, input.signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    sequenceJudge = null;
  }
  const scored = turns.map((turn) => turn.score).filter((score): score is number => typeof score === "number");
  return {
    sequenceId: sequence.id,
    title: sequence.title,
    characterKey: sequence.characterKey,
    configLabel: config.label,
    factor: config.factor,
    repeatIndex: input.repeatIndex,
    turns,
    sequenceJudge,
    sequenceScore: sequenceJudge ? sequenceScore(sequenceJudge, input.sequenceWeights) : null,
    turnMean: scored.length ? Number(mean(scored).toFixed(3)) : null,
    guidanceTransmitted: turns.filter((turn) => turn.gmGuidanceIn).length,
    errors: turns.filter((turn) => turn.error).length + (sequenceJudge ? 0 : 1),
  };
}

// ------------------------------------------------------------------- cost

/**
 * Cost model. A replayed turn costs more than an isolated one (history in the
 * character prompt, longer judge prompt): the J1 per-turn measure is raised
 * by 25 % until J3 runs recalibrate it. The sequence judge reads the whole
 * transcript (~7 000 tokens in, ~250 out with the recommended judge).
 */
export const SEQUENCE_TURN_COST_FACTOR = 1.25;
export const SEQUENCE_JUDGE_COST_USD = 0.03;

export interface SequenceCostEstimate {
  sequences: number;
  configs: number;
  repeats: number;
  turns: number;
  sequenceJudgeCalls: number;
  perTurnUsd: number;
  /** Cost of the longest sequence for one configuration (cost-guard unit). */
  maxSequenceUsd: number;
  estimatedCostUsd: number;
}

export function estimateSequenceRun(input: {
  sequences: Array<Pick<EvalSequence, "turns">>;
  configs: number;
  repeats: number;
  isolatedPerTurnUsd: number;
}): SequenceCostEstimate {
  const perTurnUsd = input.isolatedPerTurnUsd * SEQUENCE_TURN_COST_FACTOR;
  const turnsPerPass = input.sequences.reduce((sum, sequence) => sum + sequence.turns.length, 0);
  const passes = input.configs * input.repeats;
  const turns = turnsPerPass * passes;
  const sequenceJudgeCalls = input.sequences.length * passes;
  const longest = Math.max(0, ...input.sequences.map((sequence) => sequence.turns.length));
  return {
    sequences: input.sequences.length,
    configs: input.configs,
    repeats: input.repeats,
    turns,
    sequenceJudgeCalls,
    perTurnUsd: Number(perTurnUsd.toFixed(4)),
    maxSequenceUsd: Number((longest * perTurnUsd + SEQUENCE_JUDGE_COST_USD).toFixed(4)),
    estimatedCostUsd: Number((turns * perTurnUsd + sequenceJudgeCalls * SEQUENCE_JUDGE_COST_USD).toFixed(4)),
  };
}

// ------------------------------------------------------------- comparison

const MEANINGFUL_DELTA = 0.3;

export interface SequenceDeltaRow {
  reference: number | null;
  candidate: number | null;
  delta: number | null;
}

export interface SequenceComparison {
  overall: {
    turn: SequenceDeltaRow;
    sequence: SequenceDeltaRow;
    /** Mean stddev between repeats of the same sequence and configuration. */
    turnNoise: number;
    sequenceNoise: number;
    referencePasses: number;
    candidatePasses: number;
  };
  bySequence: Array<{ sequenceId: string; title: string; characterKey: RuntimeCharacter; turn: SequenceDeltaRow; sequence: SequenceDeltaRow; turnSpread: number; sequenceSpread: number }>;
  byTurn: Array<{ sequenceId: string; turnIndex: number; question: string; turn: SequenceDeltaRow; spread: number }>;
  bySequenceCriterion: Array<{ key: SequenceCriterionKey; label: string } & SequenceDeltaRow>;
  byTurnCriterion: Array<{ key: keyof EvalScoreWeights; label: string } & SequenceDeltaRow>;
  gmLoop: Array<{ sequenceId: string; configLabel: string; turns: number; guidanceTransmitted: number; gmExecuted: number; memoryLastTurn: number }>;
  errors: number;
  verdict: string;
}

function row(reference: number[], candidate: number[]): SequenceDeltaRow {
  const ref = reference.length ? Number(mean(reference).toFixed(3)) : null;
  const cand = candidate.length ? Number(mean(candidate).toFixed(3)) : null;
  return { reference: ref, candidate: cand, delta: ref !== null && cand !== null ? Number((cand - ref).toFixed(3)) : null };
}

function numbers(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function spreadOf(groups: Map<string, number[]>): number {
  const spreads = [...groups.values()].filter((values) => values.length > 1).map((values) => stddev(values));
  return spreads.length ? Number(mean(spreads).toFixed(3)) : 0;
}

function push(map: Map<string, number[]>, key: string, value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

/**
 * Reference vs candidate over sequence runs. Noise is read on the reference
 * and the candidate separately (spread between repeats of the same sequence),
 * then averaged: with `optimized_v3` against itself, the global Δ is the noise.
 */
export function compareSequenceRuns(results: SequenceRunResult[], sequences: EvalSequence[]): SequenceComparison {
  const isRef = (result: SequenceRunResult) => result.factor === "baseline";
  const ref = results.filter(isRef);
  const cand = results.filter((result) => !isRef(result));

  const turnSpreadGroups = new Map<string, number[]>();
  const seqSpreadGroups = new Map<string, number[]>();
  for (const result of results) {
    push(turnSpreadGroups, `${result.configLabel}::${result.sequenceId}`, result.turnMean);
    push(seqSpreadGroups, `${result.configLabel}::${result.sequenceId}`, result.sequenceScore);
  }

  const bySequence = sequences.map((sequence) => {
    const r = ref.filter((result) => result.sequenceId === sequence.id);
    const c = cand.filter((result) => result.sequenceId === sequence.id);
    const turnGroups = new Map<string, number[]>();
    const seqGroups = new Map<string, number[]>();
    for (const result of [...r, ...c]) {
      push(turnGroups, result.configLabel, result.turnMean);
      push(seqGroups, result.configLabel, result.sequenceScore);
    }
    return {
      sequenceId: sequence.id,
      title: sequence.title,
      characterKey: sequence.characterKey,
      turn: row(numbers(r.map((result) => result.turnMean)), numbers(c.map((result) => result.turnMean))),
      sequence: row(numbers(r.map((result) => result.sequenceScore)), numbers(c.map((result) => result.sequenceScore))),
      turnSpread: spreadOf(turnGroups),
      sequenceSpread: spreadOf(seqGroups),
    };
  }).filter((entry) => entry.turn.reference !== null || entry.turn.candidate !== null);

  const byTurn = sequences.flatMap((sequence) => sequence.turns.map((turn, index) => {
    const pick = (list: SequenceRunResult[]) => numbers(list
      .filter((result) => result.sequenceId === sequence.id)
      .map((result) => result.turns[index]?.score));
    const groups = new Map<string, number[]>();
    for (const result of results.filter((entry) => entry.sequenceId === sequence.id)) push(groups, result.configLabel, result.turns[index]?.score);
    return { sequenceId: sequence.id, turnIndex: index + 1, question: turn.question, turn: row(pick(ref), pick(cand)), spread: spreadOf(groups) };
  })).filter((entry) => entry.turn.reference !== null || entry.turn.candidate !== null)
    .sort((a, b) => (a.turn.delta ?? 0) - (b.turn.delta ?? 0));

  const bySequenceCriterion = SEQUENCE_CRITERIA.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    ...row(
      numbers(ref.map((result) => result.sequenceJudge?.criteria[criterion.key])),
      numbers(cand.map((result) => result.sequenceJudge?.criteria[criterion.key])),
    ),
  }));

  const turnCriterion = (list: SequenceRunResult[], key: keyof EvalScoreWeights) => numbers(list.flatMap((result) => result.turns.map((turn) => {
    const sub = turn.judge ? readJudgeSubScores(turn.judge) : null;
    return sub ? criterionValues(sub).find(([criterionKey]) => criterionKey === key)?.[1] : null;
  })));
  const byTurnCriterion = EVAL_SCORE_CRITERIA.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    ...row(turnCriterion(ref, criterion.key), turnCriterion(cand, criterion.key)),
  })).filter((entry) => entry.reference !== null || entry.candidate !== null);

  const gmLoop = results.map((result) => ({
    sequenceId: result.sequenceId,
    configLabel: result.configLabel,
    turns: result.turns.length,
    guidanceTransmitted: result.guidanceTransmitted,
    gmExecuted: result.turns.filter((turn) => turn.gmStatus === "executed").length,
    memoryLastTurn: result.turns.at(-1)?.memoryLastTurnAfter ?? 0,
  }));

  const overallTurn = row(numbers(ref.map((result) => result.turnMean)), numbers(cand.map((result) => result.turnMean)));
  const overallSeq = row(numbers(ref.map((result) => result.sequenceScore)), numbers(cand.map((result) => result.sequenceScore)));
  const turnNoise = spreadOf(turnSpreadGroups);
  const sequenceNoise = spreadOf(seqSpreadGroups);
  const sameConfig = new Set(results.map((result) => result.configLabel.replace(/^(référence|candidat)\s*/, "").replace(/\s*·\s*témoin$/, ""))).size === 1;

  const read = (label: string, delta: number | null, noise: number) => {
    if (delta === null) return `${label} : pas de comparaison`;
    const threshold = Math.max(MEANINGFUL_DELTA, noise);
    if (Math.abs(delta) < threshold) return `${label} : Δ ${delta > 0 ? "+" : ""}${delta.toFixed(2)}, dans le bruit (seuil ${threshold.toFixed(2)})`;
    return `${label} : Δ ${delta > 0 ? "+" : ""}${delta.toFixed(2)}, ${delta > 0 ? "le candidat fait mieux" : "le candidat fait moins bien"} (au-delà du seuil ${threshold.toFixed(2)})`;
  };
  const verdictParts = [read("Note par tour", overallTurn.delta, turnNoise), read("Note de séquence", overallSeq.delta, sequenceNoise)];
  const witness = (label: string, delta: number | null, noise: number) => delta === null
    ? `${label} : pas de comparaison`
    : `${label} : écart ${delta > 0 ? "+" : ""}${delta.toFixed(2)} entre deux configurations identiques (bruit entre passages ± ${noise.toFixed(2)})`;
  const verdict = sameConfig
    ? `Témoin (même configuration des deux côtés) : ces écarts sont du bruit et fixent le seuil à dépasser par un candidat. ${[witness("Note par tour", overallTurn.delta, turnNoise), witness("Note de séquence", overallSeq.delta, sequenceNoise)].join(" · ")}.`
    : `${verdictParts.join(" · ")}.`;

  return {
    overall: {
      turn: overallTurn,
      sequence: overallSeq,
      turnNoise,
      sequenceNoise,
      referencePasses: ref.length,
      candidatePasses: cand.length,
    },
    bySequence,
    byTurn,
    bySequenceCriterion,
    byTurnCriterion,
    gmLoop,
    errors: results.reduce((sum, result) => sum + result.errors, 0),
    verdict,
  };
}
