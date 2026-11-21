/**
 * Lot F — round 1 of the judge: factuality alone.
 *
 * One note that measures only whether the character says the true facts,
 * invents nothing and corrects a false premise of the player. The style
 * criteria (not_meta, lived_impact, distinct_voice, speech quality, tone,
 * length, character voice) are deliberately absent from the prompt and from
 * the note: they are rounds 2 and 3 (docs/plan_juge_direction_rounds.md).
 *
 * Pure module: the network call is injected by `evalJudgeSequenceLive.ts`.
 */
import { clampScore, evalCharacterKey, type EvalItem } from "@/services/evalJudgePipeline";
import { canonCap } from "@/services/evalJudgeScoring";

export const JUDGE_FOCUS_VALUES = ["all", "factuality"] as const;
export type JudgeFocus = typeof JUDGE_FOCUS_VALUES[number];

export const FACT_STATUSES = ["correct", "contradicted", "invented", "uncertain_ok", "not_addressed"] as const;
export type FactStatus = typeof FACT_STATUSES[number];

/** Weights of the factuality note. The same canon cap as the general note applies. */
export const FACTUALITY_WEIGHTS = {
  canon_timeline: 3,
  must_include: 2,
  must_not: 3,
  invention: 2.5,
  false_premise: 3,
} as const;
export type FactualityCriterionKey = keyof typeof FACTUALITY_WEIGHTS;

export interface FactualityTurnInput {
  question: string;
  requiredFacts: string[];
  forbiddenClaims: string[];
  /** The false premise carried by the player's question; null/empty when the question has none. */
  falsePremise?: string | null;
  expectedResponse?: string;
}

export interface FactualityVerdict {
  canon_timeline: number;
  must_include: number;
  must_not: number;
  /** 5 = nothing invented. */
  invention: number;
  /** null when the question carries no false premise. 5 = corrected, 0 = taken as true. */
  false_premise: number | null;
  /** One status per required fact, in the order of the corpus. */
  facts: Array<{ fact: string; status: FactStatus; note: string }>;
  /** Forbidden claims the answer makes, as written in the corpus. */
  forbiddenHit: string[];
  rationale: string;
  raw: string;
}

export function buildFactualityJudgePrompt(
  turn: FactualityTurnInput,
  characterName: string,
  response: string,
  canonReference = "",
  priorExchanges = "",
): string {
  const name = characterName.trim() || "le personnage attribué";
  const firstName = name.split(/\s+/)[0];
  const key = evalCharacterKey(name);
  const hasPremise = Boolean(turn.falsePremise?.trim());
  const facts = turn.requiredFacts.map((fact, index) => `F${index + 1}. ${fact}`).join("\n") || "(aucun)";
  const forbidden = turn.forbiddenClaims.map((claim, index) => `I${index + 1}. ${claim}`).join("\n") || "(aucun)";
  return `Tu es un juge de FACTUALITÉ pour l'expérience narrative « Où est Ava ? ». Tu ne juges QUE les faits : ce que ${name} affirme est-il vrai selon les repères canon ? Tu ne juges ni le style, ni le ton, ni la longueur, ni la voix, ni l'émotion, ni le caractère méta : ces critères sont hors de cette note.

## QUESTION DU JOUEUR
${turn.question}

## PRÉMISSE FAUSSE DE LA QUESTION
${hasPremise ? turn.falsePremise!.trim() : "(aucune : la question ne contient pas de prémisse fausse)"}

## FAITS ATTENDUS (corpus)
${facts}

## AFFIRMATIONS INTERDITES (corpus)
${forbidden}
${turn.expectedResponse?.trim() ? `\n## EXEMPLE DE RÉPONSE JUSTE (repère de contenu, pas un script)\n${turn.expectedResponse.trim()}\n` : ""}
## REPÈRES CANON DE ${name.toLocaleUpperCase("fr")} (lecture seule, font foi)
${canonReference || "(fiche non fournie : juge avec les faits attendus et les affirmations interdites)"}

${priorExchanges.trim() ? `## ÉCHANGES PRÉCÉDENTS (contexte, ne pas noter)\n${priorExchanges.trim()}\n\nUne contradiction avec un fait déjà énoncé par ${firstName} dans ces échanges compte contre canon_timeline.\n\n` : ""}## RÉPONSE DE ${name.toLocaleUpperCase("fr")}
${response}

## RÈGLES
- Vérifie chaque fait affirmé contre les repères canon : qui a fait quoi, qui est qui, ce qui est déjà arrivé et ce qui est à venir, le sens d'une contamination, ce que ${firstName} sait aujourd'hui et depuis quand. Le canon prime sur l'exemple et sur la question.
- L'appel a lieu : ${firstName} parle avec la personne qui devait appeler. Dire qu'il attend encore cet appel contredit le présent.
- Incertitude crédible : « je ne sais plus », « je crois », « je ne sais pas » sur ce qu'un humain pourrait ne pas savoir ou ne pas se rappeler n'est PAS une faute ; elle n'abaisse ni canon_timeline ni invention. Une certitude fausse est une faute. Une incertitude sur un fait que ${firstName} connaît selon les repères et que la réponse rend faux par omission reste « not_addressed », jamais « contradicted ».
- Une retenue ou un détour qui n'affirme rien de faux ne contredit rien : ce sont « not_addressed » pour les faits attendus qui manquent.
- Invention : un détail, une cause, un événement, une motivation ou un lien que ni les repères ni la question n'étayent est une invention (invention ≤ 2). Un détail purement sensoriel ou de ton (une pause, un geste) n'en est pas une.
- canon_timeline : 5 = tout est conforme ; 3 = un détail secondaire flou ; 1 = un fait établi contredit ou une prémisse fausse reprise ; 0 = contradiction nette d'un fait central.
- must_include : part des FAITS ATTENDUS correctement livrés (5 = tous ; un fait absent ou « not_addressed » baisse la note, un fait contredit la ramène à 0-1).
- must_not : 5 = aucune AFFIRMATION INTERDITE faite ; chacune faite baisse nettement la note.
- false_premise : ${hasPremise ? `${firstName} corrige-t-il la prémisse fausse ? 5 = corrige clairement avec le bon fait ; 3 = corrige à moitié ou la contourne sans l'accepter ; 1 = l'accepte implicitement ; 0 = l'affirme.` : "null (aucune prémisse fausse dans cette question)."}
- ${key ? `La personne qui répond est ${firstName}, pas ${key === "max" ? "Emma" : "Max"} : un fait attribué au mauvais personnage est une contradiction.` : "Attribue chaque fait au bon personnage."}

Retourne UNIQUEMENT un JSON :
{
  "facts": {${turn.requiredFacts.map((_, index) => `"F${index + 1}": "correct|contradicted|invented|uncertain_ok|not_addressed"`).join(", ")}},
  "forbidden_hit": [${turn.forbiddenClaims.length ? '"I1" pour chaque affirmation interdite faite' : ""}],
  "canon_timeline": 0-5,
  "must_include": 0-5,
  "must_not": 0-5,
  "invention": 0-5,
  "false_premise": ${hasPremise ? "0-5" : "null"},
  "rationale": "2 phrases max, cite le fait en cause"
}`;
}

/** Unreadable (no JSON, no numeric canon_timeline) → null: left out of every mean, never scored 0. */
export function parseFactualityJudgeResponse(raw: string, turn: FactualityTurnInput): FactualityVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> | null = null;
  if (match) {
    try { parsed = JSON.parse(match[0]) as Record<string, unknown>; } catch { parsed = null; }
  }
  if (!parsed || typeof parsed !== "object" || !Number.isFinite(Number(parsed.canon_timeline ?? NaN))) return null;
  const hasPremise = Boolean(turn.falsePremise?.trim());
  const factMap = parsed.facts && typeof parsed.facts === "object" && !Array.isArray(parsed.facts) ? parsed.facts as Record<string, unknown> : {};
  const facts = turn.requiredFacts.map((fact, index) => {
    const entry = factMap[`F${index + 1}`];
    const status = typeof entry === "string" ? entry : entry && typeof entry === "object" ? String((entry as Record<string, unknown>).status ?? "") : "";
    const note = entry && typeof entry === "object" ? String((entry as Record<string, unknown>).note ?? "").slice(0, 200) : "";
    return { fact, status: (FACT_STATUSES as readonly string[]).includes(status) ? status as FactStatus : "not_addressed", note };
  });
  const hits = Array.isArray(parsed.forbidden_hit) ? parsed.forbidden_hit : [];
  const forbiddenHit = hits
    .map((hit) => Number(String(hit).replace(/^\D*/, "")))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= turn.forbiddenClaims.length)
    .map((n) => turn.forbiddenClaims[n - 1]);
  const premise = parsed.false_premise;
  return {
    canon_timeline: clampScore(parsed.canon_timeline, 0, 5),
    must_include: clampScore(parsed.must_include, 0, 5),
    must_not: clampScore(parsed.must_not, 0, 5),
    invention: clampScore(parsed.invention, 0, 5),
    false_premise: hasPremise && premise !== null && premise !== undefined && Number.isFinite(Number(premise)) ? clampScore(premise, 0, 5) : null,
    facts,
    forbiddenHit: [...new Set(forbiddenHit)],
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 600) : "",
    raw,
  };
}

/**
 * Factuality note /10: weighted mean of the five factual criteria (the false
 * premise only when the question carries one), capped like the general note
 * when the canon is contradicted. No style criterion enters.
 */
export function factualityScore(verdict: Pick<FactualityVerdict, FactualityCriterionKey>): number {
  const parts: Array<[FactualityCriterionKey, number | null]> = [
    ["canon_timeline", verdict.canon_timeline],
    ["must_include", verdict.must_include],
    ["must_not", verdict.must_not],
    ["invention", verdict.invention],
    ["false_premise", verdict.false_premise],
  ];
  let weighted = 0;
  let total = 0;
  for (const [key, value] of parts) {
    if (value === null || value === undefined) continue;
    weighted += FACTUALITY_WEIGHTS[key] * (value / 5);
    total += FACTUALITY_WEIGHTS[key];
  }
  if (total <= 0) return 0;
  return Number(Math.min((weighted / total) * 10, canonCap(verdict.canon_timeline)).toFixed(3));
}

/** Turn input of a corpus item judged in the sequence replay (factuality focus). */
export function factualityInputOf(item: Pick<EvalItem, "question" | "gold_answer">, turn: { requiredFacts: string[]; forbiddenClaims: string[]; falsePremise?: string }): FactualityTurnInput {
  return { question: item.question, requiredFacts: turn.requiredFacts, forbiddenClaims: turn.forbiddenClaims, falsePremise: turn.falsePremise ?? null, expectedResponse: item.gold_answer };
}

export function describeFactualityWeights(): string {
  return Object.entries(FACTUALITY_WEIGHTS).map(([key, weight]) => `${key} ×${weight}`).join(", ");
}
