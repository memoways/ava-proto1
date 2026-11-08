/**
 * Pure Notion property mapping for `sync-questionnaire` (legacy PRD1–3, PRD4,
 * conversational-v1). Kept free of Deno/network code so Vitest covers it.
 * Base « Questionnaire AVA » 31d62322e595804795cbca5bf679d053.
 */

// ============================================================================
// Legacy (PRD1/2/3) mapping
// ============================================================================
const SELECT_MAPS: Record<string, Record<string, string>> = {
  mechanic_latency: { pas_du_tout: "Pas du tout", un_peu: "Un peu", beaucoup: "Beaucoup" },
  narration_understood: { oui: "Oui", non: "Non", partiellement: "Partiellement" },
  gm_role_understood: { oui: "Oui", non: "Non", partiellement: "Partiellement" },
  value_pay: { oui: "Oui", non: "Non", peut_etre: "Peut-être" },
  value_price: { "0-5": "0-5€", "5-15": "5-15€", "15-30": "15-30€", "30+": "30€+" },
  value_format: { web: "Web", mobile: "Mobile", vr: "VR", autre: "Autre" },
  latency_perceived: { fluide: "Fluide", acceptable: "Acceptable", genante: "Gênante" },
  ptt_release_issues: { aucun: "Aucun", parfois: "Parfois", souvent: "Souvent" },
};

function selectProp(field: string, value: string | undefined) {
  if (!value) return null;
  const map = SELECT_MAPS[field];
  const name = map?.[value] || value;
  return { select: { name } };
}
function numProp(value: number | undefined | null) {
  return value != null ? { number: value } : null;
}
function textProp(value: string | undefined | null) {
  return value ? { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] } : null;
}

interface LegacyQuestionnairePayload {
  experience_rating?: number;
  experience_word?: string;
  nps?: number;
  gm_clarity?: number;
  gm_role_understood?: string;
  gm_immersion_intro?: number;
  a_cocreation_engaged?: number;
  a_cocreation_natural?: number;
  a_cocreation_freeform?: string;
  b_narrator_immersive?: number;
  b_narrator_freeform?: string;
  voice_naturalness?: number;
  voice_gm_naturalness?: number;
  voice_modality_comfort?: number;
  ptt_button_clear?: number;
  ptt_release_issues?: string;
  latency_perceived?: string;
  latency_moments?: string;
  mechanic_latency?: string;
  immersion_story?: number;
  immersion_natural?: number;
  mechanic_listening?: number;
  narration_understood?: string;
  narration_continue?: number;
  open_feedback?: string;
  value_pay?: string;
  value_price?: string;
  value_format?: string;
  contact_name?: string;
  contact_email?: string;
  opt_in_feedback?: boolean;
  opt_in_updates?: boolean;
}

interface PRD4AnswersPayload {
  q1_film_seen?: string;
  q2_teaser_helpful?: number | null;
  q3_role_clarity?: number;
  q4_role_summary_accuracy?: number;
  q5_ptt_clarity?: number;
  q5b_ptt_frustration?: number;
  q6_max_used_role?: number;
  q7_max_credible?: number;
  q8_want_other_characters?: number;
  q8b_next_character_wanted?: string;
  q9_duration_feeling?: string;
  q10_open_feedback?: string;
  contact_email?: string;
  opt_in_updates?: boolean;
  opt_in_feedback?: boolean;
  latency_perceived?: string;
  latency_moments?: string;
  moment_marquant?: string;
  feedback_libre?: string;
  ptt_comment?: string;
}

interface PRD4TechnicalPayload {
  submitted_at?: string;
  teaser_seen?: boolean;
  teaser_skipped?: boolean;
  role_profile?: unknown;
  active_character?: string;
  duration_seconds?: number;
  turn_count?: number;
  avg_latency_ms?: number | null;
  max_latency_ms?: number | null;
  ptt_errors?: number;
  user_speech_seconds?: number;
  max_speech_seconds?: number;
  transcript_available?: boolean;
}

interface ConversationalDimensionPayload {
  question?: string;
  answer?: string;
  follow_up?: { question?: string; answer?: string } | null;
  score?: unknown;
  score_source?: string | null;
  score_comment?: string | null;
}

interface ConversationalContextPayload {
  film?: string | null;
  teaser?: { seen?: boolean; skipped?: boolean };
  starting_character?: string;
  characters_called?: string[];
  handoffs?: unknown[];
  duration_seconds?: number;
  turn_count?: number;
  avg_latency_ms?: number | null;
  max_latency_ms?: number | null;
  mic_errors?: number;
  end_reason?: string | null;
  device_class?: string;
  call_mode?: string;
  avatar_fallback?: boolean;
  role_profile?: unknown;
  transcript_available?: boolean;
}

interface QuestionnairePayload extends LegacyQuestionnairePayload {
  version?: string;
  answers?: PRD4AnswersPayload;
  technical?: PRD4TechnicalPayload;
  submitted_at?: string;
  dimensions?: Record<string, ConversationalDimensionPayload | undefined>;
  summary?: { text?: string; edited_by_user?: boolean; validated_at?: string };
  consent?: { contact_email?: string; opt_in_updates?: boolean; opt_in_feedback?: boolean };
  session_context?: ConversationalContextPayload;
}

export interface SyncQuestionnairePayload {
  sessionId?: string;
  questionnaire?: QuestionnairePayload;
  trustLevel?: number;
  durationSeconds?: number;
  gameOverReason?: string | null;
  variant?: string | null;
  voiceModality?: string | null;
}

export type NotionProperties = Record<string, unknown>;

export function buildLegacyProps(payload: SyncQuestionnairePayload): NotionProperties {
  const { sessionId, questionnaire: q = {}, trustLevel, durationSeconds, gameOverReason, variant, voiceModality } = payload;
  const props: NotionProperties = {};
  const set = (key: string, value: unknown) => { if (value != null) props[key] = value; };

  props["Nom"] = { title: [{ text: { content: `Session ${sessionId?.slice(0, 8) || "unknown"}` } }] };
  set("Session ID", textProp(sessionId));
  set("Variante onboarding", variant ? { select: { name: variant } } : null);
  set("Modalite voix", voiceModality ? { select: { name: voiceModality } } : null);
  set("Trust final", numProp(trustLevel));
  set("Duree secondes", numProp(durationSeconds));
  set("Raison fin", textProp(gameOverReason));
  set("Date soumission", { date: { start: new Date().toISOString() } });

  set("Note experience", numProp(q.experience_rating));
  set("Mot experience", textProp(q.experience_word));
  set("NPS", numProp(q.nps));
  set("GM clarte", numProp(q.gm_clarity));
  set("GM role compris", selectProp("gm_role_understood", q.gm_role_understood));
  set("GM immersion intro", numProp(q.gm_immersion_intro));
  set("A cocreation engage", numProp(q.a_cocreation_engaged));
  set("A cocreation naturel", numProp(q.a_cocreation_natural));
  set("A cocreation libre", textProp(q.a_cocreation_freeform));
  set("B narrateur immersif", numProp(q.b_narrator_immersive));
  set("B narrateur libre", textProp(q.b_narrator_freeform));
  set("Voix Max naturel", numProp(q.voice_naturalness));
  set("Voix GM naturel", numProp(q.voice_gm_naturalness));
  set("Modalite confort", numProp(q.voice_modality_comfort));
  set("PTT bouton clair", numProp(q.ptt_button_clear));
  set("PTT relachement", selectProp("ptt_release_issues", q.ptt_release_issues));
  set("Latence percue", selectProp("latency_perceived", q.latency_perceived));
  set("Latence moments", textProp(q.latency_moments));
  set("Latence genante", selectProp("mechanic_latency", q.mechanic_latency));
  set("Immersion histoire", numProp(q.immersion_story));
  set("Immersion naturel", numProp(q.immersion_natural));
  set("Ecoute Max", numProp(q.mechanic_listening));
  set("Compris objectif", selectProp("narration_understood", q.narration_understood));
  set("Envie continuer", numProp(q.narration_continue));
  set("Feedback ouvert", textProp(q.open_feedback));
  set("Pret a payer", selectProp("value_pay", q.value_pay));
  set("Fourchette prix", selectProp("value_price", q.value_price));
  set("Format prefere", selectProp("value_format", q.value_format));

  if (q.contact_name) props["Nom contact"] = { rich_text: [{ text: { content: q.contact_name } }] };
  if (q.contact_email) props["Email contact"] = { email: q.contact_email };
  if (q.opt_in_feedback) props["Opt-in feedback"] = { checkbox: true };
  if (q.opt_in_updates) props["Opt-in updates"] = { checkbox: true };

  return props;
}

// ============================================================================
// PRD4 §14.4 mapping
// ============================================================================
const PRD4_DURATION_MAP: Record<string, string> = {
  trop_court: "Trop court",
  juste: "Juste",
  trop_long: "Trop long",
};
const PRD4_CHARACTER_MAP: Record<string, string> = {
  emma: "Emma",
  ava: "Ava",
  leo: "Léo",
  max: "Max encore",
  aucun: "Aucun",
};

export function buildPRD4Props(payload: SyncQuestionnairePayload): NotionProperties {
  const { sessionId, questionnaire } = payload;
  const a = questionnaire?.answers || {};
  const t = questionnaire?.technical || {};
  const props: NotionProperties = {};
  const set = (key: string, value: unknown) => { if (value != null) props[key] = value; };

  // Méta
  props["Nom"] = { title: [{ text: { content: `PRD4 ${sessionId?.slice(0, 8) || "session"}` } }] };
  set("Session ID", textProp(sessionId));
  set("Date soumission", { date: { start: t.submitted_at || new Date().toISOString() } });

  // Questionnaire utilisateur — noms Notion exacts (avec accents)
  set("PRD4 A vu le film", a.q1_film_seen ? { select: { name: a.q1_film_seen === "oui" ? "Oui" : "Non" } } : null);
  set("PRD4 Teaser vu", { checkbox: !!t.teaser_seen });
  set("PRD4 Teaser skippé", { checkbox: !!t.teaser_skipped });
  set("PRD4 Teaser utile score", numProp(a.q2_teaser_helpful));
  set("PRD4 Rôle création clarté", numProp(a.q3_role_clarity));
  set("PRD4 Résumé personnage justesse", numProp(a.q4_role_summary_accuracy));
  set("PRD4 PTT clarté", numProp(a.q5_ptt_clarity));
  set("PRD4 PTT frustration", numProp(a.q5b_ptt_frustration));
  set("PRD4 Max reconnaît rôle", numProp(a.q6_max_used_role));
  set("PRD4 Max crédible personnage", numProp(a.q7_max_credible));
  set("PRD4 Envie autres personnages", numProp(a.q8_want_other_characters));
  set(
    "PRD4 Personnage souhaité prochain",
    a.q8b_next_character_wanted
      ? { select: { name: PRD4_CHARACTER_MAP[a.q8b_next_character_wanted] || a.q8b_next_character_wanted } }
      : null,
  );
  set(
    "PRD4 Durée ressentie",
    a.q9_duration_feeling
      ? { select: { name: PRD4_DURATION_MAP[a.q9_duration_feeling] || a.q9_duration_feeling } }
      : null,
  );
  set("PRD4 Rupture immersion", textProp(a.q10_open_feedback));

  // Email + opt-ins (canaux PRD4 uniquement, plus d'anciens champs A/B)
  if (a.contact_email) props["PRD4 Email contact"] = { email: a.contact_email };
  props["PRD4 Être tenu au courant"] = { checkbox: !!a.opt_in_updates };
  props["PRD4 Contact feedback détaillé"] = { checkbox: !!a.opt_in_feedback };

  // Données techniques automatiques
  if (t.role_profile) set("PRD4 Rôle JSON", textProp(JSON.stringify(t.role_profile)));
  if (t.active_character) {
    const charName = PRD4_CHARACTER_MAP[t.active_character] || t.active_character;
    // Personnage actif n'utilise pas "Max encore" — c'est Max
    const cleanName = t.active_character === "max" ? "Max" : charName;
    set("PRD4 Personnage actif", { select: { name: cleanName } });
  }
  set("PRD4 Durée réelle secondes", numProp(t.duration_seconds));
  set("PRD4 Nb tours", numProp(t.turn_count));
  set("PRD4 Latence moyenne ms", numProp(t.avg_latency_ms));
  set("PRD4 Latence max ms", numProp(t.max_latency_ms));
  set("PRD4 Erreurs PTT", numProp(t.ptt_errors));
  set("PRD4 Durée parole utilisateur s", numProp(t.user_speech_seconds));
  set("PRD4 Durée parole Max s", numProp(t.max_speech_seconds));
  set("PRD4 Transcript disponible", { checkbox: !!t.transcript_available });

  // Champs optionnels (latence perçue / moments / fin / etc.) si jamais ajoutés côté app
  if (a.latency_perceived) {
    const lp = SELECT_MAPS.latency_perceived[a.latency_perceived] || a.latency_perceived;
    set("PRD4 Latence perçue", { select: { name: lp } });
  }
  set("PRD4 Latence moments", textProp(a.latency_moments));
  set("PRD4 Raison fin", textProp(payload.gameOverReason));
  set("PRD4 Moment marquant", textProp(a.moment_marquant));
  set("PRD4 Feedback libre", textProp(a.feedback_libre));
  set("PRD4 Commentaire PTT", textProp(a.ptt_comment));

  return props;
}

// ============================================================================
// conversational-v1 mapping (plan_questionnaire_conversationnel.md)
// ============================================================================
export const CONVERSATIONAL_SCORE_COLUMNS: Record<string, string> = {
  fluidity: "Conv Fluidité",
  interest: "Conv Intérêt",
  immersion: "Conv Immersion",
  character_credibility: "Conv Crédibilité",
  emotional_engagement: "Conv Engagement",
};
export const CONVERSATIONAL_VERBATIM_COLUMNS: Record<string, string> = {
  fluidity: "Conv Fluidité verbatim",
  interest: "Conv Intérêt verbatim",
  immersion: "Conv Immersion verbatim",
  character_credibility: "Conv Crédibilité verbatim",
  emotional_engagement: "Conv Engagement verbatim",
};
const DEVICE_LABELS: Record<string, string> = { smartphone: "Smartphone", tablet: "Tablette", desktop: "Desktop" };
const CHARACTER_LABELS: Record<string, string> = { max: "Max", emma: "Emma" };

/** Only an integer 1–5 is a score; null, 0 or anything else leaves the cell empty. */
export function conversationalScore(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

/** Notion caps one rich_text item at 2000 characters: split long verbatims. */
function longTextProp(value: string | undefined | null) {
  const text = value?.trim();
  if (!text) return null;
  const chunks: { text: { content: string } }[] = [];
  for (let i = 0; i < text.length && chunks.length < 50; i += 1900) chunks.push({ text: { content: text.slice(i, i + 1900) } });
  return { rich_text: chunks };
}

function dimensionVerbatim(d: ConversationalDimensionPayload | undefined): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.answer?.trim()) parts.push(d.answer.trim());
  if (d.follow_up?.answer?.trim()) parts.push(`Relance — ${d.follow_up.question?.trim() ?? ""}\n${d.follow_up.answer.trim()}`);
  if (d.score_comment?.trim()) parts.push(`Note — ${d.score_comment.trim()}`);
  return parts.length ? parts.join("\n\n") : null;
}

function callModeLabel(c: ConversationalContextPayload): string | null {
  if (c.call_mode === "streaming_avatar") return c.avatar_fallback ? "Avatar puis voix (repli)" : "Avatar vidéo";
  if (c.call_mode === "tts") return "Voix seule";
  return null;
}

export function buildConversationalProps(payload: SyncQuestionnairePayload): NotionProperties {
  const { sessionId, questionnaire } = payload;
  const c = questionnaire?.session_context || {};
  const dims = questionnaire?.dimensions || {};
  const consent = questionnaire?.consent || {};
  const props: NotionProperties = {};
  const set = (key: string, value: unknown) => { if (value != null) props[key] = value; };

  props["Nom"] = { title: [{ text: { content: `Conv ${sessionId?.slice(0, 8) || "session"}` } }] };
  set("Session ID", textProp(sessionId));
  set("Date soumission", { date: { start: questionnaire?.submitted_at || new Date().toISOString() } });

  // Session context → existing PRD4 technical columns (never asked as questions).
  if (c.film === "vu" || c.film === "rappel") set("PRD4 A vu le film", { select: { name: "Oui" } });
  else if (c.film === "pas_vu") set("PRD4 A vu le film", { select: { name: "Non" } });
  set("PRD4 Teaser vu", { checkbox: !!c.teaser?.seen });
  set("PRD4 Teaser skippé", { checkbox: !!c.teaser?.skipped });
  if (c.starting_character && CHARACTER_LABELS[c.starting_character]) {
    set("PRD4 Personnage actif", { select: { name: CHARACTER_LABELS[c.starting_character] } });
  }
  if (c.role_profile) set("PRD4 Rôle JSON", textProp(JSON.stringify(c.role_profile)));
  set("PRD4 Durée réelle secondes", numProp(c.duration_seconds));
  set("PRD4 Nb tours", numProp(c.turn_count));
  set("PRD4 Latence moyenne ms", numProp(c.avg_latency_ms));
  set("PRD4 Latence max ms", numProp(c.max_latency_ms));
  set("PRD4 Erreurs PTT", numProp(c.mic_errors));
  set("PRD4 Transcript disponible", { checkbox: !!c.transcript_available });
  set("PRD4 Raison fin", textProp(c.end_reason ?? payload.gameOverReason));

  // Contact channels shared with PRD4.
  if (consent.contact_email) props["PRD4 Email contact"] = { email: consent.contact_email };
  props["PRD4 Être tenu au courant"] = { checkbox: !!consent.opt_in_updates };
  props["PRD4 Contact feedback détaillé"] = { checkbox: !!consent.opt_in_feedback };

  // Conversational answers → « Conv » columns. A null score writes nothing.
  for (const [key, column] of Object.entries(CONVERSATIONAL_SCORE_COLUMNS)) {
    set(column, numProp(conversationalScore(dims[key]?.score)));
    set(CONVERSATIONAL_VERBATIM_COLUMNS[key], longTextProp(dimensionVerbatim(dims[key])));
  }
  set("Conv Synthèse", longTextProp(questionnaire?.summary?.text));
  set("Conv Version", questionnaire?.version ? { select: { name: questionnaire.version } } : null);
  set("Conv Appareil", c.device_class && DEVICE_LABELS[c.device_class] ? { select: { name: DEVICE_LABELS[c.device_class] } } : null);
  const mode = callModeLabel(c);
  set("Conv Mode appel", mode ? { select: { name: mode } } : null);
  const called = (c.characters_called || []).map((id) => CHARACTER_LABELS[id]).filter(Boolean);
  if (called.length) set("Conv Personnages appelés", { multi_select: called.map((name) => ({ name })) });
  if (Array.isArray(c.handoffs)) set("Conv Passages", numProp(c.handoffs.length));

  return props;
}

/** Version routing: legacy (no version), `prd4`, `conversational-v1`. */
export function buildQuestionnaireProps(payload: SyncQuestionnairePayload): NotionProperties {
  const version = payload?.questionnaire?.version;
  if (version === "conversational-v1") return buildConversationalProps(payload);
  if (version === "prd4") return buildPRD4Props(payload);
  return buildLegacyProps(payload);
}
