export interface AdminTabGroup {
  id: string;
  label: string;
  path: string;
  tabs: Array<{ id: string; label: string; path: string }>;
}

export const TAB_GROUPS: AdminTabGroup[] = [
  { id: "data", path: "donnees", label: "📊 Données", tabs: [{ id: "sessions", path: "sessions", label: "Sessions" }, { id: "questionnaires", path: "questionnaires", label: "Questionnaires" }] },
  { id: "content", path: "contenu", label: "📚 Contenu Notion", tabs: [{ id: "sync", path: "synchronisation-notion", label: "Sync Notion" }, { id: "videos", path: "videos", label: "Vidéos" }, { id: "embeddings", path: "embeddings", label: "Embeddings" }] },
  { id: "characters", path: "personnages", label: "🎭 Personnages", tabs: [{ id: "character-editor", path: "editeur", label: "Éditeur personnage" }] },
  { id: "experience", path: "experience", label: "🧭 Expérience", tabs: [{ id: "gamemaster", path: "orchestration", label: "Orchestration" }, { id: "gm-settings", path: "reglages-game-master", label: "Réglages GM" }, { id: "character-runtime", path: "reglages-personnages", label: "Réglages personnages" }, { id: "video-triggers", path: "cinematiques", label: "Cinématiques" }, { id: "architecture", path: "fonctionnement", label: "Comment ça marche" }] },
  { id: "quality", path: "qualite", label: "📈 Qualité", tabs: [{ id: "alerts", path: "alertes", label: "Alertes" }, { id: "latency", path: "latence-et-blocages", label: "Latence & blocage" }, { id: "latency-telemetry", path: "latences-posthog", label: "Latences PostHog" }, { id: "max-test", path: "laboratoire-rag", label: "Laboratoire RAG" }, { id: "eval-judge", path: "llm-as-judge", label: "LLM as judge" }, { id: "pipeline", path: "traces-max", label: "Traces Max" }] },
  { id: "tech", path: "technique", label: "🔧 Technique avancée", tabs: [{ id: "stt", path: "configuration-stt", label: "STT Config" }, { id: "rag", path: "configuration-rag", label: "RAG Config" }, { id: "llm", path: "configuration-llm", label: "LLM Config" }, { id: "voice", path: "configuration-tts", label: "TTS Config" }, { id: "streaming-avatar", path: "configuration-avatar", label: "Streaming Avatar Config" }, { id: "usage", path: "consommation-llm", label: "Consommation LLM" }, { id: "voice-usage", path: "consommation-voix", label: "Consommation Voix" }, { id: "avatar-usage", path: "consommation-avatar", label: "Consommation Streaming Avatar" }] },
];

export const LEGACY_GROUP: AdminTabGroup = {
  id: "legacy",
  path: "legacy",
  label: "🗄️ Legacy",
  tabs: [{ id: "validator", path: "validateur", label: "Validateur" }, { id: "metrics", path: "metriques-hallucinations", label: "Métriques hallu." }],
};

export interface AdminLocation {
  group: string;
  tab: string;
  sessionId: string | null;
}

export const DEFAULT_ADMIN_TAB = "sessions";

export function findAdminTab(tabId: string) {
  for (const group of [...TAB_GROUPS, LEGACY_GROUP]) {
    const tab = group.tabs.find((candidate) => candidate.id === tabId);
    if (tab) return { group, tab };
  }
  return null;
}

export function adminTabPath(tabId: string): string {
  const location = findAdminTab(tabId);
  if (!location) return "/admin/donnees/sessions";
  return `/admin/${location.group.path}/${location.tab.path}`;
}

export function adminSessionPath(sessionId: string): string {
  return `${adminTabPath("sessions")}/${encodeURIComponent(sessionId)}`;
}

export function resolveAdminPath(pathname: string): AdminLocation | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "admin" || segments.length < 3) return null;
  const group = [...TAB_GROUPS, LEGACY_GROUP].find((candidate) => candidate.path === segments[1]);
  const tab = group?.tabs.find((candidate) => candidate.path === segments[2]);
  if (!group || !tab) return null;

  let sessionId: string | null = null;
  if (tab.id === "sessions" && segments[3]) {
    try {
      sessionId = decodeURIComponent(segments[3]);
    } catch {
      return null;
    }
  }
  if (segments.length > (sessionId ? 4 : 3)) return null;
  return { group: group.id, tab: tab.id, sessionId };
}
