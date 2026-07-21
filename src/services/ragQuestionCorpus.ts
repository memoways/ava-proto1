import { supabase } from "@/integrations/supabase/client";

export interface FrequentRAGQuestion {
  id: string;
  question: string;
  occurrences: number;
  variants: string[];
  characterNames: string[];
  latestAt: string | null;
  pinned: boolean;
  sourceKeys: string[];
  theme?: string;
}

export interface RAGQuestionCorpusResult {
  questions: FrequentRAGQuestion[];
  sourceQuestionCount: number;
  excludedQuestionCount: number;
  userTurnCount: number;
  uniqueQuestionCount: number;
  sessionCount: number;
  sourceRevision: number;
  builtRevision: number;
  updatedAt: string;
  generationModel: string | null;
  processing: boolean;
  stale: boolean;
  error: string | null;
}

function cleanQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

/** Broad detector used by Sessions to decide whether the curation checkbox is relevant. */
export function isQuestionLike(value: string): boolean {
  const question = cleanQuestion(value);
  if (question.length < 4 || question.length > 600) return false;
  if (question.includes("?")) return true;
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(qui|quoi|ou|quand|comment|pourquoi|combien|quel|quelle|quels|quelles)\b/.test(normalized)
    || /^(est[- ]ce|as[- ]tu|avez[- ]vous|sais[- ]tu|savez[- ]vous|peux[- ]tu|pouvez[- ]vous)\b/.test(normalized);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseRAGQuestionCorpus(value: unknown): RAGQuestionCorpusResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse invalide du corpus de questions");
  const data = value as Record<string, unknown>;
  if (typeof data.error === "string" && !Array.isArray(data.questions)) throw new Error(data.error);
  const questions = Array.isArray(data.questions)
    ? data.questions.filter((item): item is FrequentRAGQuestion => Boolean(
      item && typeof item === "object" && !Array.isArray(item)
      && typeof (item as FrequentRAGQuestion).id === "string"
      && typeof (item as FrequentRAGQuestion).question === "string",
    ))
    : [];
  return {
    questions,
    sourceQuestionCount: numberValue(data.sourceQuestionCount),
    excludedQuestionCount: numberValue(data.excludedQuestionCount),
    userTurnCount: numberValue(data.userTurnCount),
    uniqueQuestionCount: numberValue(data.uniqueQuestionCount),
    sessionCount: numberValue(data.sessionCount),
    sourceRevision: numberValue(data.sourceRevision),
    builtRevision: numberValue(data.builtRevision),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    generationModel: typeof data.generationModel === "string" ? data.generationModel : null,
    processing: data.processing === true,
    stale: data.stale === true,
    error: typeof data.error === "string" ? data.error : null,
  };
}

/**
 * Reads the cached semantic corpus. A refresh is server-side/background and the
 * browser never downloads all conversation logs or performs clustering.
 */
export async function fetchRAGQuestionCorpus(forceRefresh = false): Promise<RAGQuestionCorpusResult> {
  const { data, error } = await supabase.functions.invoke("rag-question-corpus", {
    body: { action: forceRefresh ? "refresh" : "get" },
  });
  if (error) throw new Error(error.message);
  return parseRAGQuestionCorpus(data);
}
