export const RAG_EMBEDDING_PROFILE_IDS = [
  "voyage-3-legacy",
  "voyage-4-realtime",
  "voyage-context-4-quality",
  "openai-legacy",
] as const;

export type RagEmbeddingProfileId = (typeof RAG_EMBEDDING_PROFILE_IDS)[number];
export type RagEmbeddingProvider = "voyage" | "openai";
export type RagEmbeddingEndpoint = "embeddings" | "contextualizedembeddings";

export interface RagEmbeddingProfile {
  id: RagEmbeddingProfileId;
  label: string;
  shortLabel: string;
  description: string;
  provider: RagEmbeddingProvider;
  documentModel: string;
  queryModel: string;
  endpoint: RagEmbeddingEndpoint;
  dimension: 1024 | 1536;
  dtype: "float";
  chunkingStrategy: "notion-structure-v1" | "notion-structure-v1-contextualized";
  chunkSizeChars: number;
  chunkOverlapChars: number;
  recommended: boolean;
  experimental: boolean;
}

export const RAG_EMBEDDING_PROFILES: Record<RagEmbeddingProfileId, RagEmbeddingProfile> = {
  "voyage-3-legacy": {
    id: "voyage-3-legacy",
    label: "Voyage 3 · rollback",
    shortLabel: "Legacy",
    description: "Profil historique conservé pour rollback. Voyage classe désormais ce modèle parmi les générations antérieures.",
    provider: "voyage",
    documentModel: "voyage-3",
    queryModel: "voyage-3",
    endpoint: "embeddings",
    dimension: 1024,
    dtype: "float",
    chunkingStrategy: "notion-structure-v1",
    chunkSizeChars: 1000,
    chunkOverlapChars: 150,
    recommended: false,
    experimental: false,
  },
  "voyage-4-realtime": {
    id: "voyage-4-realtime",
    label: "Voyage 4 · temps réel",
    shortLabel: "Temps réel",
    description: "Documents en voyage-4-large et questions en voyage-4-lite : qualité d’indexation élevée avec une requête rapide.",
    provider: "voyage",
    documentModel: "voyage-4-large",
    queryModel: "voyage-4-lite",
    endpoint: "embeddings",
    dimension: 1024,
    dtype: "float",
    chunkingStrategy: "notion-structure-v1",
    chunkSizeChars: 1000,
    chunkOverlapChars: 150,
    recommended: true,
    experimental: false,
  },
  "voyage-context-4-quality": {
    id: "voyage-context-4-quality",
    label: "Voyage Context 4 · qualité",
    shortLabel: "Contextualisé",
    description: "Chaque chunk est encodé avec le contexte de toute la page Notion. À valider en canary face à la contrainte voix.",
    provider: "voyage",
    documentModel: "voyage-context-4",
    queryModel: "voyage-context-4",
    endpoint: "contextualizedembeddings",
    dimension: 1024,
    dtype: "float",
    chunkingStrategy: "notion-structure-v1-contextualized",
    chunkSizeChars: 1000,
    chunkOverlapChars: 0,
    recommended: false,
    experimental: true,
  },
  "openai-legacy": {
    id: "openai-legacy",
    label: "OpenAI · legacy",
    shortLabel: "OpenAI",
    description: "Profil de compatibilité explicite pour text-embedding-3-small. Il ne constitue pas un fallback sans index dédié.",
    provider: "openai",
    documentModel: "text-embedding-3-small",
    queryModel: "text-embedding-3-small",
    endpoint: "embeddings",
    dimension: 1536,
    dtype: "float",
    chunkingStrategy: "notion-structure-v1",
    chunkSizeChars: 1000,
    chunkOverlapChars: 150,
    recommended: false,
    experimental: false,
  },
};

export const DEFAULT_RAG_EMBEDDING_PROFILE_ID: RagEmbeddingProfileId = "voyage-4-realtime";
export const LEGACY_VOYAGE_PROFILE_ID: RagEmbeddingProfileId = "voyage-3-legacy";
export const LEGACY_OPENAI_PROFILE_ID: RagEmbeddingProfileId = "openai-legacy";

export function isRagEmbeddingProfileId(value: unknown): value is RagEmbeddingProfileId {
  return typeof value === "string" && RAG_EMBEDDING_PROFILE_IDS.includes(value as RagEmbeddingProfileId);
}

export function getRagEmbeddingProfile(value: unknown, fallback: RagEmbeddingProfileId = LEGACY_VOYAGE_PROFILE_ID): RagEmbeddingProfile {
  return RAG_EMBEDDING_PROFILES[isRagEmbeddingProfileId(value) ? value : fallback];
}
