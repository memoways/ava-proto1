export type GamePhase =
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

export type OnboardingVariant = "A" | "B";
export type VoiceModality = "micro_ouvert" | "push_to_talk";

export type AudioState = "idle" | "user_speaking" | "max_thinking" | "max_speaking";

export interface VideoTrigger {
  id: string;
  title: string;
  type: "intro" | "interlude" | "mid_conversation";
  themes: string[];
  placeholder_text: string;
  priority: number;
  transition_style: string;
  post_video_context: string | null;
  duration_seconds: number;
  video_url?: string | null;
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
