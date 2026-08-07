export interface AdminTabGroup {
  id: string;
  label: string;
  tabs: Array<{ id: string; label: string }>;
}

export const TAB_GROUPS: AdminTabGroup[] = [
  { id: "data", label: "📊 Données", tabs: [{ id: "sessions", label: "Sessions" }, { id: "questionnaires", label: "Questionnaires" }] },
  { id: "content", label: "📚 Contenu Notion", tabs: [{ id: "sync", label: "Sync Notion" }, { id: "videos", label: "Vidéos" }, { id: "embeddings", label: "Embeddings" }] },
  { id: "characters", label: "🎭 Personnages", tabs: [{ id: "character-editor", label: "Éditeur personnage" }] },
  { id: "experience", label: "🧭 Expérience", tabs: [{ id: "gamemaster", label: "Orchestration" }, { id: "gm-settings", label: "Réglages GM" }, { id: "character-runtime", label: "Réglages personnages" }, { id: "video-triggers", label: "Cinématiques" }, { id: "architecture", label: "Comment ça marche" }] },
  { id: "quality", label: "📈 Qualité", tabs: [{ id: "latency", label: "Latence & blocage" }, { id: "latency-telemetry", label: "Latences PostHog" }, { id: "max-test", label: "Laboratoire RAG" }, { id: "pipeline", label: "Traces Max" }] },
  { id: "tech", label: "🔧 Technique avancée", tabs: [{ id: "stt", label: "STT Config" }, { id: "rag", label: "RAG Config" }, { id: "llm", label: "LLM Config" }, { id: "voice", label: "TTS Config" }, { id: "streaming-avatar", label: "Streaming Avatar Config" }, { id: "usage", label: "Consommation LLM" }, { id: "voice-usage", label: "Consommation Voix" }, { id: "avatar-usage", label: "Consommation Streaming Avatar" }] },
];

export const LEGACY_GROUP: AdminTabGroup = {
  id: "legacy",
  label: "🗄️ Legacy",
  tabs: [{ id: "validator", label: "Validateur" }, { id: "metrics", label: "Métriques hallu." }],
};
