/**
 * Conversational end-of-experience questionnaire — data model (lot 1).
 *
 * Plan: docs/plan_questionnaire_conversationnel.md. Everything the session
 * already knows (film, characters called, handoffs, duration, latencies,
 * device, call mode…) is collected here as `session_context` and is never
 * turned into a question. A score is 1–5 confirmed by the participant or
 * `null` (not rated); there is no default score.
 */
import type {
  ConversationalDimensionKey,
  ConversationalScore,
  ConversationalSessionContext,
  ConversationMessage,
  DimensionAnswer,
  FilmAnswer,
  QuestionnaireConversationalData,
  UserPosture,
  UserRoleProfile,
} from "@/types";

export const CONVERSATIONAL_VERSION = "conversational-v1" as const;

export const CONVERSATIONAL_DIMENSIONS: readonly ConversationalDimensionKey[] = [
  "fluidity",
  "interest",
  "immersion",
  "character_credibility",
  "emotional_engagement",
];

const CHARACTER_NAMES: Record<"max" | "emma", string> = { max: "Max", emma: "Emma" };

type SpeakingCharacter = "max" | "emma";

export interface SessionContextInput {
  sessionId: string | null;
  film: FilmAnswer | null;
  teaserSeen: boolean;
  teaserSkipped: boolean;
  startingCharacter: SpeakingCharacter;
  /** Full conversation log (`conversationRef`), the reliable source of who spoke. */
  conversation: readonly ConversationMessage[];
  /** Cinematics actually shown (watched video memory). */
  watchedVideos: ReadonlyArray<{ id: string; partial: boolean }>;
  durationSeconds: number;
  turnLatenciesMs: readonly number[];
  micErrors: number;
  handsFree: boolean;
  endReason: string | null;
  deviceClass: ConversationalSessionContext["device_class"];
  callMode: ConversationalSessionContext["call_mode"];
  avatarFallback: boolean;
  roleProfile: UserRoleProfile | null;
  posture: UserPosture | null;
}

function speakerOf(message: ConversationMessage): SpeakingCharacter | null {
  if (message.role !== "max" && message.role !== "emma") return null;
  return message.content.trim() ? message.role : null;
}

/** Pure: builds the session facts from the experience state and conversation log. */
export function buildSessionContext(input: SessionContextInput): ConversationalSessionContext {
  const charactersCalled: SpeakingCharacter[] = [];
  const handoffs: ConversationalSessionContext["handoffs"] = [];
  let previous: SpeakingCharacter | null = null;
  for (const message of input.conversation) {
    const speaker = speakerOf(message);
    if (!speaker) continue;
    if (previous && speaker !== previous) {
      handoffs.push({ from: previous, to: speaker, returning: charactersCalled.includes(speaker) });
    }
    if (!charactersCalled.includes(speaker)) charactersCalled.push(speaker);
    previous = speaker;
  }

  const latencies = input.turnLatenciesMs.filter((value) => Number.isFinite(value) && value >= 0);
  const cinematics: ConversationalSessionContext["cinematics"] = [];
  for (const video of input.watchedVideos) {
    const existing = cinematics.find((entry) => entry.id === video.id);
    if (existing) existing.partial = existing.partial && video.partial;
    else cinematics.push({ id: video.id, partial: video.partial });
  }

  return {
    session_id: input.sessionId,
    film: input.film,
    teaser: { seen: input.teaserSeen, skipped: input.teaserSkipped },
    starting_character: input.startingCharacter,
    characters_called: charactersCalled,
    handoffs,
    cinematics,
    duration_seconds: Math.max(0, Math.round(input.durationSeconds)),
    turn_count: input.conversation.filter((message) => message.role === "user").length,
    avg_latency_ms: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
    max_latency_ms: latencies.length ? Math.max(...latencies) : null,
    mic_errors: Math.max(0, input.micErrors),
    hands_free: input.handsFree,
    end_reason: input.endReason,
    device_class: input.deviceClass,
    call_mode: input.callMode,
    avatar_fallback: input.avatarFallback,
    role_profile: input.roleProfile,
    posture: input.posture,
    transcript_available: input.conversation.length > 0,
  };
}

/** A score is an integer 1–5; anything else (0, 6, 2.5, "", undefined…) is "not rated". */
export function normalizeScore(value: unknown): ConversationalScore {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as ConversationalScore)
    : null;
}

function listNames(characters: readonly SpeakingCharacter[]): string {
  const names = characters.map((character) => CHARACTER_NAMES[character]);
  if (names.length <= 1) return names[0] ?? "les personnages";
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

/**
 * Base open question per dimension (plan table). The session context only fills
 * the names of the characters actually called; it never asks for a known fact.
 */
export function baseDimensionQuestions(
  context: Pick<ConversationalSessionContext, "characters_called">,
): Record<ConversationalDimensionKey, string> {
  const called = listNames(context.characters_called);
  return {
    fluidity: "Le déroulé : qu'est-ce qui a bien fonctionné, qu'est-ce qui a accroché, et pourquoi ?",
    interest: "À quel moment l'envie de continuer était la plus forte, et quand l'attention est-elle retombée ?",
    immersion: "À quel moment l'expérience a cessé d'être un test pour devenir une histoire, et qu'est-ce qui l'a cassée ?",
    character_credibility: `Qu'est-ce qui a rendu ${called} crédible${context.characters_called.length > 1 ? "s" : ""}, ou au contraire faux ?`,
    emotional_engagement: "Qu'est-ce que tu as ressenti, et à quel moment ?",
  };
}

export function emptyDimensionAnswer(question: string): DimensionAnswer {
  return { question, answer: "", follow_up: null, score: null, score_source: null, score_comment: null };
}

/** Returns the list of problems; an empty list means the payload can be stored. */
export function validateConversationalQuestionnaire(data: QuestionnaireConversationalData): string[] {
  const errors: string[] = [];
  if (data.version !== CONVERSATIONAL_VERSION) errors.push("version");
  for (const key of CONVERSATIONAL_DIMENSIONS) {
    const dimension = data.dimensions?.[key];
    if (!dimension) { errors.push(`dimensions.${key}: missing`); continue; }
    if (dimension.score !== null && normalizeScore(dimension.score) === null) errors.push(`dimensions.${key}.score`);
    if (dimension.score === null && dimension.score_source !== null) errors.push(`dimensions.${key}.score_source`);
    if (dimension.score !== null && dimension.score_source === null) errors.push(`dimensions.${key}.score_source`);
  }
  if (!data.summary?.validated_at) errors.push("summary.validated_at");
  if (data.consent?.transcript_storage !== true) errors.push("consent.transcript_storage");
  if (!data.session_context) errors.push("session_context");
  return errors;
}

/** Dimension scores for the radar: not-rated dimensions are kept apart, never 0. */
export function radarScores(data: QuestionnaireConversationalData): {
  rated: Partial<Record<ConversationalDimensionKey, 1 | 2 | 3 | 4 | 5>>;
  notRated: ConversationalDimensionKey[];
} {
  const rated: Partial<Record<ConversationalDimensionKey, 1 | 2 | 3 | 4 | 5>> = {};
  const notRated: ConversationalDimensionKey[] = [];
  for (const key of CONVERSATIONAL_DIMENSIONS) {
    const score = normalizeScore(data.dimensions[key]?.score);
    if (score === null) notRated.push(key);
    else rated[key] = score;
  }
  return { rated, notRated };
}

export function isConversationalQuestionnaire(value: unknown): value is QuestionnaireConversationalData {
  return !!value && typeof value === "object" && (value as { version?: unknown }).version === CONVERSATIONAL_VERSION;
}
