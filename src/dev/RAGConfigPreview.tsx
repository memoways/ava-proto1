import RAGConfigTab from "@/components/RAGConfigTab";
import type { GameplaySettings } from "@/services/settingsService";
import type { RagIndexDashboardData } from "@/services/ragIndexService";

const GAMEPLAY: GameplaySettings = {
  MAX_PROMPT_VARIANT: "legacy",
  TRUST_THRESHOLD: 0.62,
  TIMEOUT_SECONDS: 300,
  SHOW_QUESTIONNAIRE: true,
  MAX_INSULT_TOLERANCE: 3,
  MIN_QUESTIONS_BEFORE_GATE: 3,
  RAG_TOP_K: 3,
  RAG_RETRIEVE_K: 10,
  RAG_RERANK_ENABLED: true,
  RAG_QUERY_REWRITE_ENABLED: false,
  RAG_EMBEDDING_PROVIDER: "voyage",
  RAG_MATCH_THRESHOLD: 0.3,
  RAG_RERANK_MODEL: "rerank-2.5-lite",
  RAG_RERANK_TRUNCATION: true,
  RAG_SUMMARY_EVERY_N_TURNS: 4,
  VIDEO_PLACEHOLDER_DURATION: 30,
};

const DASHBOARD: RagIndexDashboardData = {
  state: {
    id: true,
    active_profile: "voyage-4-realtime",
    previous_profile: "voyage-3-legacy",
    provider: "voyage",
    document_model: "voyage-4-large",
    query_model: "voyage-4-lite",
    endpoint: "embeddings",
    dimension: 1024,
    dtype: "float",
    chunking_strategy: "notion-blocks-v2",
    chunk_size_chars: 1_000,
    chunk_overlap_chars: 120,
    total_chunks: 428,
    status: "active",
    last_rebuild_at: "2026-08-08T15:42:00.000Z",
    updated_at: "2026-08-08T15:42:00.000Z",
  },
  profileCounts: {
    "voyage-4-realtime": 428,
    "voyage-context-4-quality": 428,
    "voyage-3-legacy": 391,
    "openai-legacy": 391,
  },
  metrics: {
    sampleSize: 184,
    p50Ms: 238,
    p95Ms: 1_420,
    missRate: 0.038,
    lastMeasuredAt: "2026-08-09T09:18:00.000Z",
    period: "30d",
    periodStart: "2026-07-10T09:18:00.000Z",
    source: "voice_turn_events",
  },
  migrationMissing: false,
};

export default function RAGConfigPreview() {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground lg:p-10">
      <div className="mx-auto max-w-5xl">
        <RAGConfigTab initialDashboard={DASHBOARD} initialGameplay={GAMEPLAY} previewMode />
      </div>
    </main>
  );
}
