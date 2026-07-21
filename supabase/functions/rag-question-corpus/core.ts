export interface CorpusOccurrence {
  sourceKey: string;
  question: string;
  characterName: string | null;
  occurredAt: string | null;
  pinned: boolean;
}

export interface ExactQuestionGroup {
  id: string;
  question: string;
  occurrences: CorpusOccurrence[];
}

const SMALL_TALK_PATTERNS = [
  /^(bonjour|bonsoir|salut|hello|coucou|allo)(\s+(max|ava))?[.!?]*$/i,
  /^(merci|merci beaucoup|ok|okay|d['’]?accord|super|parfait|au revoir|bonne journée)[.!?]*$/i,
  /^(ça va|comment ça va|tu vas bien|vous allez bien|tout va bien)[.!?]*$/i,
  /^(tu m['’]?entends|vous m['’]?entendez|est[- ]ce que tu m['’]?entends|tu es là|vous êtes là)[.!?]*$/i,
  /^(qui es[- ]tu|comment tu t['’]?appelles|quel est ton nom)[.!?]*$/i,
  /^(tu peux répéter|peux[- ]tu répéter|vous pouvez répéter|pardon|hein)[.!?]*$/i,
];

const VAGUE_ONLY = new Set([
  "alors", "ca", "ça", "ce", "cela", "elle", "elles", "en", "et", "il", "ils", "la", "le", "les", "lui",
  "maintenant", "mais", "on", "pourquoi", "comment", "quoi", "qui", "ou", "où", "quand", "donc", "toi", "vous",
]);

const INTERROGATIVE = /\b(qui|quoi|où|ou|quand|comment|pourquoi|combien|quel|quelle|quels|quelles|est[- ]ce|as[- ]tu|avez[- ]vous|sais[- ]tu|savez[- ]vous|peux[- ]tu|pouvez[- ]vous)\b/i;

export function cleanCorpusQuestion(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 400);
}

export function normalizeCorpusQuestion(value: string): string {
  return cleanCorpusQuestion(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function questionQuality(value: string): { keep: boolean; reason?: string } {
  const question = cleanCorpusQuestion(value);
  const normalized = normalizeCorpusQuestion(question);
  const words = normalized.split(" ").filter(Boolean);
  const compactPunctuation = question.replace(/\s+([?!.])/g, "$1");

  if (SMALL_TALK_PATTERNS.some((pattern) => pattern.test(compactPunctuation))) return { keep: false, reason: "small_talk" };
  if (/^(et|mais|donc|alors)?\s*(pourquoi|comment|quoi|qui|où|ou|quand)\s*[?!.]*$/i.test(normalized)) {
    return { keep: false, reason: "question_sans_contexte" };
  }
  if (question.length < 10 || words.length < 3) return { keep: false, reason: "fragment_trop_court" };
  if (question.length > 400 || words.length > 60) return { keep: false, reason: "tour_trop_long" };
  if (!question.includes("?") && !INTERROGATIVE.test(question)) return { keep: false, reason: "pas_une_question" };
  if (/\b(et|ou|de|du|des|à|a|avec|pour|sur|dans)\s*[?!.]*$/i.test(question)) {
    return { keep: false, reason: "phrase_incomplète" };
  }

  const informativeWords = words.filter((word) => word.length > 2 && !VAGUE_ONLY.has(word));
  if (informativeWords.length < 2) return { keep: false, reason: "question_trop_vague" };
  return { keep: true };
}

function stableId(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `q-${hash.toString(16).padStart(8, "0")}`;
}

export function groupExactQuestions(occurrences: CorpusOccurrence[]): ExactQuestionGroup[] {
  const groups = new Map<string, CorpusOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = normalizeCorpusQuestion(occurrence.question);
    const current = groups.get(key) || [];
    current.push(occurrence);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, items]) => ({
      id: stableId(key),
      question: items
        .map((item) => item.question)
        .sort((a, b) => a.length - b.length || a.localeCompare(b, "fr"))[0],
      occurrences: items,
    }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.id.localeCompare(b.id));
}

export function ensureCanonicalQuestion(value: string): string | null {
  const question = cleanCorpusQuestion(value)
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .replace(/[.!]+$/g, "")
    .trim();
  if (!questionQuality(`${question}?`).keep) return null;
  return `${question} ?`.replace(/\s+\?/g, " ?");
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const stripped = text.trim().replace(/^```json\s*|```$/g, "").trim();
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse de synthèse non JSON");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}
