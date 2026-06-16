export type GamePhase =
  | "welcome"
  | "ab_choice"
  | "onboarding_a"
  | "onboarding_b"
  | "intro_video"
  | "character_select"
  | "ringing"
  | "conversation"
  | "video_trigger"
  | "gate"
  | "game_over"
  | "questionnaire"
  | "thanks";

// ============================================================================
// PRD4 — Nouveau parcours (mai 2026)
// La machine à états ExperiencePhase coexiste avec GamePhase le temps de la
// migration. Voir docs/plan_prd4_implementation.md
// ============================================================================

export type ExperiencePhase =
  | "welcome"
  | "film_question"
  | "teaser"
  | "role_capture"
  | "role_summary"
  | "character_select"
  | "calling_max"
  | "posture_capture"
  | "transition_max"
  | "conversation_max"
  | "end_session"
  | "questionnaire"
  | "thanks";

export type ProximityLevel =
  | "proche"
  | "connu"
  | "institutionnel"
  | "inconnu"
  | "menaçant";

export interface UserRoleProfile {
  raw_input: string;
  summary_for_user: string;
  summary_for_max: string;
  relationship_to_family: string;
  age: string;
  gender: string;
  proximity_level: string;
  intent: string;
  created_by_system: boolean;
  created_at: string;
}

export type FilmAnswer = "vu" | "pas_vu" | "rappel";

export type UserPostureMode = "voice" | "surprise";

export interface UserPosture {
  raw: string;
  mode: UserPostureMode;
}

export interface ExperienceState {
  phase: ExperiencePhase;
  hasSeenFilm: FilmAnswer | null;
  teaserSeen: boolean;
  teaserSkipped: boolean;
  userRoleProfile: UserRoleProfile | null;
  userPosture: UserPosture | null;
  selectedCharacter: "max" | "emma" | "ava" | "leo";
  conversationLog: ConversationMessage[];
  turnCount: number;
  pttErrors: number;
  audioState: AudioState;
  endReason: string | null;
}

export type OnboardingVariant = "A" | "B";
export type VoiceModality = "micro_ouvert" | "push_to_talk";

export type AudioState = "idle" | "mic_starting" | "user_speaking" | "max_thinking" | "max_speaking";

export interface VideoTrigger {
  id: string;
  title: string;
  type: "intro" | "interlude" | "mid_conversation";
  themes: string[];
  /** Texte d'attente joué pendant la transition (legacy, optionnel). */
  placeholder_text?: string;
  priority: number;
  transition_style: string;
  /** Contexte injecté dans Max après la vidéo pour qu'il puisse y faire référence. */
  post_video_context: string | null;
  /** Synonyme `Contexte` (Notion). Identique à `post_video_context`. */
  context?: string | null;
  /** Description objective de ce qui se passe dans la vidéo (utile au GM pour décider). */
  description?: string | null;
  duration_seconds?: number;
  video_url?: string | null;
  /** ID Notion source (présent si la vidéo provient de la base Vidéos AVA). */
  notion_id?: string | null;
}

export interface GameState {
  phase: GamePhase;
  trustLevel: number;
  triggeredIds: string[];
  questionCount: number;
  audioState: AudioState;
  conversationLog: ConversationMessage[];
  gameOverReason: string | null;
  currentTrigger: VideoTrigger | null;
  variant: OnboardingVariant | null;
  voiceModality: VoiceModality | null;
  character: string;
}

export interface ConversationMessage {
  role: "user" | "max";
  content: string;
  timestamp: number;
  /** Anti-hallucination validation trace, only present on Max messages that went through the validator. */
  validation?: ConversationValidationTrace;
  /** Per-step latency timings (ms) and last blocker, only on Max messages. */
  pipeline?: ConversationPipelineTimings;
  /** Si le Game Master pre-turn est tombé en fallback, on garde la raison pour debug. */
  gmFallback?: GameMasterFallbackInfo | null;
}

export interface ConversationPipelineTimings {
  stt_ms?: number;
  /** Explicit STT service finalization latency. Old Gamilab `stt_ms` values may include user speaking time. */
  stt_service_ms?: number;
  rag_ms?: number;
  gm_pre_ms?: number;
  max_ms?: number;
  validator_ms?: number;
  /** TTS latency until audio playback starts. Playback duration is tracked separately in voice telemetry. */
  tts_ms?: number;
  /** Explicit TTS service latency for new sessions. Old `tts_ms` values may include full audio playback. */
  tts_first_playback_ms?: number;
  gm_post_ms?: number;
  total_ms?: number;
  /** Step name flagged as the bottleneck/blocker for this turn, or null if all steps OK. */
  blocker?: string | null;
  /** Optional non-sensitive service metadata per latency segment. */
  segmentServices?: Record<string, {
    serviceProvider?: string;
    serviceName?: string;
    model?: string;
    mode?: string;
    endpointType?: string;
  }>;
}

export interface MaxTurnKnowledgeContext {
  allowedFacts?: string[];
  activeMemories?: string[];
  hypotheses?: string[];
  forbiddenTopics?: string[];
  blockedAssertions?: string[];
}

export interface MaxConstraintCheckResult {
  compliant: boolean;
  summary: string;
  violations: string[];
  safe_points: string[];
}

export type GameMasterFallbackKind =
  | "timeout"
  | "no_json"
  | "llm_error"
  | "orchestrator_error";

export interface GameMasterFallbackInfo {
  kind: GameMasterFallbackKind;
  reason: string;
  /** ms écoulés avant fallback (utile pour timeout) */
  elapsed_ms?: number;
  /** Seuil de timeout configuré au moment du fallback (ms) */
  timeout_ms?: number;
  /** Modèle LLM utilisé pour le pre-turn quand le fallback s'est déclenché */
  model?: string;
  /** Extrait du message d'erreur brut (200 premiers caractères) — utile pour llm_error / orchestrator_error */
  error_excerpt?: string;
}

export interface GameMasterTurnBrief {
  response_mode: string;
  openness_level: number;
  emotional_state: string;
  conversation_goal: string;
  reveal_budget: number;
  allowed_knowledge: string[];
  forbidden_topics: string[];
  blocked_assertions: string[];
  style_instructions: string[];
  trigger_hint: string | null;
  notes: string;
  /** Présent uniquement si le brief vient d'un fail-soft (timeout, parsing JSON, erreur LLM…) */
  fallback?: GameMasterFallbackInfo | null;
}

export interface GameMasterResponse {
  trust_delta: number;
  trigger_video_id: string | null;
  game_over: boolean;
  game_over_reason: string | null;
  gate_reached: boolean;
  moderation_flag: boolean;
  notes: string;
}

export interface ConversationValidationTrace {
  attempts: number;
  regenerated: boolean;
  finalStatus: "passed" | "fallback";
  reports: Array<{
    attempt: number;
    response: string;
    compliant: boolean;
    summary: string;
    violations: string[];
    safe_points: string[];
  }>;
}

export interface ConversationPipelineTrace {
  updatedAt?: string;
  userMessage?: string;
  ragContext?: string;
  preTurnBrief?: GameMasterTurnBrief;
  finalResponse?: string;
  validation?: ConversationValidationTrace;
}

export interface QuestionnaireData {
  // 1 — Global
  experience_rating: number;
  experience_word: string;
  nps: number;
  // 2 — Game Master (onboarding & cadrage)
  gm_clarity: number;             // 1-5 — clarté du cadrage
  gm_role_understood: "oui" | "non" | "partiellement";
  gm_immersion_intro: number;     // 1-5
  // 3A — Variante A (co-création)
  a_cocreation_engaged?: number;  // 1-5
  a_cocreation_natural?: number;  // 1-5
  a_cocreation_freeform?: string;
  // 3B — Variante B (narrateur omniscient)
  b_narrator_immersive?: number;  // 1-5
  b_narrator_freeform?: string;
  // 4 — Voix & modalité
  voice_naturalness: number;      // 1-5 voix Max
  voice_gm_naturalness: number;   // 1-5 voix GM
  voice_modality_comfort: number; // 1-5 confort modalité reçue
  // sous-bloc PTT (uniquement si push_to_talk)
  ptt_button_clear?: number;      // 1-5
  ptt_release_issues?: "aucun" | "parfois" | "souvent";
  // 5 — Latence détail
  latency_perceived: "fluide" | "acceptable" | "genante";
  latency_moments?: string;
  // 6 — Immersion / mécanique (legacy)
  immersion_story: number;
  immersion_natural: number;
  mechanic_listening: number;
  mechanic_latency: "pas_du_tout" | "un_peu" | "beaucoup";
  narration_understood: "oui" | "non" | "partiellement";
  narration_continue: number;
  value_pay: "oui" | "non" | "peut_etre";
  value_price: string;
  value_format: string;
  open_feedback: string;
  // 7 — Contact
  contact_name: string;
  contact_email: string;
  opt_in_feedback: boolean;
  opt_in_updates: boolean;
}

export interface Settings {
  TRUST_THRESHOLD: number;
  TIMEOUT_SECONDS: number;
  MAX_INSULT_TOLERANCE: number;
  MIN_QUESTIONS_BEFORE_GATE: number;
  LLM_MODEL: string;
  TTS_VOICE_ID: string;
  RAG_TOP_K: number;
  VIDEO_PLACEHOLDER_DURATION: number;
  DEEPGRAM_LANGUAGE: string;
}

/** PRD4 — évaluation post-tour produite par le Game Master après chaque réponse de Max. */
export interface PRD4PostTurnEvaluation {
  engagement_delta: number;
  confusion_detected: boolean;
  role_usage_quality: "low" | "medium" | "high" | "unknown";
  topics_covered: string[];
  transition_recommended: boolean;
  cinematic_hint: string | null;
  next_turn_guidance: string;
  end_recommended: boolean;
  moderation_flag: boolean;
  notes: string;
  /** ID du trigger vidéo à jouer après la réponse de Max (null si aucun). */
  trigger_video_id?: string | null;
  /** Renseignés côté client après l'appel LLM. */
  turn_index?: number;
  latency_ms?: number;
  model?: string;
  created_at?: string;
}

// ============================================================================
// PRD4 §14 — Nouveau questionnaire (mai 2026)
// ============================================================================

export interface QuestionnairePRD4Answers {
  q1_film_seen: "oui" | "non";
  q2_teaser_helpful: number | null; // 1-5, null si teaser non vu
  q3_role_clarity: number;
  q4_role_summary_accuracy: number;
  q5_ptt_clarity: number;
  q6_max_used_role: number;
  q7_max_credible: number;
  q8_want_other_characters: number;
  q8b_next_character_wanted: "emma" | "ava" | "leo" | "max" | "aucun";
  q9_duration_feeling: "trop_court" | "juste" | "trop_long";
  q10_open_feedback: string;
  contact_email: string;
  opt_in_updates: boolean;
  opt_in_feedback: boolean;
}

export interface QuestionnairePRD4Technical {
  session_id: string | null;
  submitted_at: string;
  duration_seconds: number;
  teaser_seen: boolean;
  teaser_skipped: boolean;
  role_profile: UserRoleProfile | null;
  active_character: string;
  turn_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  ptt_errors: number;
  transcript_available: boolean;
  ava_start_variant?: string | null;
  has_seen_film?: string | null;
  user_posture_raw?: string | null;
  user_posture_mode?: string | null;
  onboarding_duration_ms?: number | null;
}

export interface QuestionnairePRD4Data {
  version: "prd4";
  answers: QuestionnairePRD4Answers;
  technical: QuestionnairePRD4Technical;
}
