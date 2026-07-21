import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

const MAX_SESSIONS = 500;
const MAX_QUESTION_OCCURRENCES = 3_000;
const MAX_UNIQUE_QUESTION_GROUPS = 600;
const DEFAULT_CLUSTER_LIMIT = 20;
const CLUSTER_SIMILARITY_THRESHOLD = 0.58;

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "de", "des", "du", "elle", "en", "est", "et", "il", "ils",
  "je", "la", "le", "les", "leur", "lui", "ma", "me", "mes", "moi", "mon", "ne", "nos", "notre", "on", "par", "pas",
  "peux", "peut", "pour", "sa", "se", "ses", "son", "ta", "te", "tes", "toi", "ton", "tu", "un", "une", "vos", "votre",
  "vous", "y", "ca", "ça", "s", "t", "d", "l", "m", "n", "qu", "que", "quoi", "ce", "svp", "stp",
]);

const TOKEN_ALIASES: Record<string, string> = {
  habite: "habiter", habites: "habiter", habitez: "habiter", habitation: "habiter", domicile: "habiter",
  vis: "habiter", vit: "habiter", vivez: "habiter", vivre: "habiter",
  sais: "savoir", sait: "savoir", savez: "savoir", savais: "savoir", connaissance: "savoir", connais: "savoir", connaissez: "savoir",
  disparu: "disparition", disparue: "disparition", disparaitre: "disparition", disparition: "disparition",
  parti: "partir", partie: "partir", partiee: "partir", partir: "partir",
  travaille: "travail", travaillait: "travail", travailler: "travail", boulot: "travail", projet: "projet",
  parle: "parler", parles: "parler", parler: "parler", raconte: "parler", raconter: "parler",
  trouve: "trouver", trouver: "trouver", trouvee: "trouver", localisation: "lieu", adresse: "lieu", endroit: "lieu",
};

export interface ConversationQuestionOccurrence {
  sourceKey: string;
  sessionId: string;
  messageIndex: number;
  question: string;
  characterName: string | null;
  occurredAt: string | null;
  pinned: boolean;
}

export interface FrequentRAGQuestion {
  id: string;
  question: string;
  occurrences: number;
  variants: string[];
  characterNames: string[];
  latestAt: string | null;
  pinned: boolean;
  sourceKeys: string[];
}

export interface RAGQuestionCorpusResult {
  questions: FrequentRAGQuestion[];
  sourceQuestionCount: number;
  sessionCount: number;
  updatedAt: string;
  pinnedStorageAvailable: boolean;
  warning?: string;
}

interface SessionCorpusRow {
  id: string;
  started_at: string | null;
  personnage_appele: string | null;
  conversation_log: Json | null;
}

interface PinnedQuestionRow {
  session_id: string;
  message_index: number;
  question: string;
  character_name: string | null;
  created_at: string;
}

function cleanQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

export function isQuestionLike(value: string): boolean {
  const question = cleanQuestion(value);
  if (question.length < 4 || question.length > 600) return false;
  if (question.includes("?")) return true;
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(qui|quoi|ou|quand|comment|pourquoi|combien|quel|quelle|quels|quelles)\b/.test(normalized)
    || /^(est[- ]ce|as[- ]tu|avez[- ]vous|sais[- ]tu|savez[- ]vous|peux[- ]tu|pouvez[- ]vous)\b/.test(normalized);
}

export function normalizeQuestion(value: string): string {
  return cleanQuestion(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function questionTokens(value: string): string[] {
  const tokens = normalizeQuestion(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map((token) => TOKEN_ALIASES[token] || token);
  return [...new Set(tokens)].sort();
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < a.length - 1; index += 1) {
    const pair = a.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const pair = b.slice(index, index + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      pairs.set(pair, count - 1);
    }
  }
  return (2 * overlap) / (a.length + b.length - 2);
}

export function questionSimilarity(a: string, b: string): number {
  const normalizedA = normalizeQuestion(a);
  const normalizedB = normalizeQuestion(b);
  if (normalizedA === normalizedB) return 1;
  const tokensA = questionTokens(a);
  const tokensB = questionTokens(b);
  if (!tokensA.length || !tokensB.length) return diceCoefficient(normalizedA, normalizedB);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = tokensA.filter((token) => setB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union ? intersection / union : 0;
  const signatureA = tokensA.join(" ");
  const signatureB = tokensB.join(" ");
  const lexical = diceCoefficient(signatureA, signatureB);
  return (jaccard * 0.75) + (lexical * 0.25);
}

function stableId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `question-${hash.toString(16).padStart(8, "0")}`;
}

function latestDate(values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null;
}

function representativeQuestion(occurrences: ConversationQuestionOccurrence[]): string {
  const variants = [...new Set(occurrences.map((occurrence) => occurrence.question))];
  if (variants.length === 1) return variants[0];
  const frequency = new Map<string, number>();
  occurrences.forEach((occurrence) => frequency.set(occurrence.question, (frequency.get(occurrence.question) || 0) + 1));
  const totalOccurrences = occurrences.length;
  return variants
    .map((variant) => ({
      variant,
      centrality: variants.reduce(
        (sum, candidate) => sum + (questionSimilarity(variant, candidate) * (frequency.get(candidate) || 0)),
        0,
      ) / totalOccurrences,
      frequency: frequency.get(variant) || 0,
    }))
    .sort((a, b) => b.centrality - a.centrality || b.frequency - a.frequency || a.variant.length - b.variant.length)[0].variant;
}

function extractOccurrences(sessions: SessionCorpusRow[], pinnedRows: PinnedQuestionRow[]): ConversationQuestionOccurrence[] {
  const pinnedKeys = new Set(pinnedRows.map((row) => `${row.session_id}:${row.message_index}`));
  const occurrences: ConversationQuestionOccurrence[] = [];
  for (const session of sessions) {
    if (!Array.isArray(session.conversation_log)) continue;
    session.conversation_log.forEach((rawMessage, messageIndex) => {
      if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) return;
      const role = rawMessage.role;
      const content = rawMessage.content;
      if (role !== "user" || typeof content !== "string" || !isQuestionLike(content)) return;
      const sourceKey = `${session.id}:${messageIndex}`;
      occurrences.push({
        sourceKey,
        sessionId: session.id,
        messageIndex,
        question: cleanQuestion(content),
        characterName: session.personnage_appele,
        occurredAt: session.started_at,
        pinned: pinnedKeys.has(sourceKey),
      });
    });
  }

  const knownKeys = new Set(occurrences.map((occurrence) => occurrence.sourceKey));
  pinnedRows.forEach((row) => {
    const sourceKey = `${row.session_id}:${row.message_index}`;
    if (knownKeys.has(sourceKey)) return;
    occurrences.push({
      sourceKey,
      sessionId: row.session_id,
      messageIndex: row.message_index,
      question: cleanQuestion(row.question),
      characterName: row.character_name,
      occurredAt: row.created_at,
      pinned: true,
    });
  });
  return occurrences.slice(0, MAX_QUESTION_OCCURRENCES);
}

export function clusterConversationQuestions(
  occurrences: ConversationQuestionOccurrence[],
  limit = DEFAULT_CLUSTER_LIMIT,
): FrequentRAGQuestion[] {
  const exactGroups = new Map<string, ConversationQuestionOccurrence[]>();
  occurrences.forEach((occurrence) => {
    const signature = questionTokens(occurrence.question).join(" ") || normalizeQuestion(occurrence.question);
    const group = exactGroups.get(signature) || [];
    group.push(occurrence);
    exactGroups.set(signature, group);
  });

  const groups = [...exactGroups.values()].sort((a, b) => {
    const pinnedDelta = Number(b.some((item) => item.pinned)) - Number(a.some((item) => item.pinned));
    return pinnedDelta || b.length - a.length;
  }).slice(0, MAX_UNIQUE_QUESTION_GROUPS);
  const clusters: ConversationQuestionOccurrence[][] = [];
  groups.forEach((group) => {
    const candidate = representativeQuestion(group);
    let bestIndex = -1;
    let bestSimilarity = 0;
    clusters.forEach((cluster, index) => {
      const similarity = questionSimilarity(candidate, representativeQuestion(cluster));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestSimilarity >= CLUSTER_SIMILARITY_THRESHOLD) clusters[bestIndex].push(...group);
    else clusters.push([...group]);
  });

  return clusters
    .map((cluster) => {
      const question = representativeQuestion(cluster);
      const characterNames = [...new Set(cluster.map((item) => item.characterName).filter((value): value is string => Boolean(value)))];
      const variants = [...new Set(cluster.map((item) => item.question))]
        .sort((a, b) => cluster.filter((item) => item.question === b).length - cluster.filter((item) => item.question === a).length)
        .slice(0, 6);
      return {
        id: stableId(`${normalizeQuestion(question)}:${cluster.map((item) => item.sourceKey).sort()[0]}`),
        question,
        occurrences: cluster.length,
        variants,
        characterNames,
        latestAt: latestDate(cluster.map((item) => item.occurredAt)),
        pinned: cluster.some((item) => item.pinned),
        sourceKeys: cluster.map((item) => item.sourceKey),
      };
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.occurrences - a.occurrences || String(b.latestAt).localeCompare(String(a.latestAt)))
    .slice(0, Math.max(1, limit));
}

export async function fetchRAGQuestionCorpus(limit = DEFAULT_CLUSTER_LIMIT): Promise<RAGQuestionCorpusResult> {
  const sessionsRequest = supabase
    .from("sessions")
    .select("id, started_at, personnage_appele, conversation_log")
    .order("started_at", { ascending: false })
    .limit(MAX_SESSIONS);
  const pinnedRequest = supabase
    .from("rag_lab_pinned_questions")
    .select("session_id, message_index, question, character_name, created_at")
    .order("created_at", { ascending: false });
  const [sessionsResult, pinnedResult] = await Promise.all([sessionsRequest, pinnedRequest]);
  if (sessionsResult.error) throw new Error(sessionsResult.error.message);

  const pinnedStorageAvailable = !pinnedResult.error;
  const pinnedRows = pinnedStorageAvailable ? (pinnedResult.data || []) as PinnedQuestionRow[] : [];
  const sessions = (sessionsResult.data || []) as SessionCorpusRow[];
  const occurrences = extractOccurrences(sessions, pinnedRows);
  return {
    questions: clusterConversationQuestions(occurrences, limit),
    sourceQuestionCount: occurrences.length,
    sessionCount: sessions.length,
    updatedAt: new Date().toISOString(),
    pinnedStorageAvailable,
    warning: pinnedResult.error ? "Les questions automatiques sont disponibles, mais la migration des questions épinglées doit être appliquée dans Lovable Cloud." : undefined,
  };
}
