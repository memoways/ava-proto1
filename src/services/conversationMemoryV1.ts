import type {
  ConversationDepth,
  ConversationMemoryDelta,
  ConversationMemoryItem,
  ConversationMemoryV1,
  CharacterMemoryItemV2,
  RuntimeCharacter,
} from "@/types";

const LIMITS = {
  traits: 8,
  userFacts: 12,
  maxDisclosures: 16,
  commitments: 10,
  openThreads: 8,
  topics: 12,
  itemChars: 180,
  lastExchangeChars: 260,
  characterItems: 32,
};

export function createEmptyConversationMemory(): ConversationMemoryV1 {
  return {
    version: 2,
    lastTurn: 0,
    interlocutor: { name: null, role: null, traits: [] },
    userFacts: [],
    maxDisclosures: [],
    commitments: [],
    openThreads: [],
    topics: [],
    relationship: {
      depth: "surface",
      trust: "neutre",
      emotionalState: null,
      sourceTurn: 0,
    },
    lastExchange: null,
    characterItems: [],
  };
}

function sanitizeCharacterItems(raw: unknown, fallbackTurn: number): CharacterMemoryItemV2[] {
  if (!Array.isArray(raw)) return [];
  const items: CharacterMemoryItemV2[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<CharacterMemoryItemV2>;
    const text = normalizeMemoryText(candidate.text);
    if (!text) continue;
    const sourceCharacter: RuntimeCharacter = candidate.sourceCharacter === "emma" ? "emma" : "max";
    const visibility = candidate.visibility === "shared" ? "shared" : "private";
    const requestedVisibleTo = Array.isArray(candidate.visibleTo)
      ? candidate.visibleTo.filter((value): value is RuntimeCharacter => value === "max" || value === "emma")
      : [];
    const visibleTo = visibility === "shared"
      ? (["max", "emma"] as RuntimeCharacter[])
      : requestedVisibleTo.includes(sourceCharacter) ? [sourceCharacter] : [sourceCharacter];
    const sourceTurn = Number.isFinite(Number(candidate.sourceTurn))
      ? Math.max(0, Math.floor(Number(candidate.sourceTurn)))
      : fallbackTurn;
    items.push({
      id: normalizeMemoryText(candidate.id, 80) || stableId(`character_${sourceCharacter}`, text),
      text,
      sourceTurn,
      sourceCharacter,
      visibility,
      visibleTo,
      provenance: candidate.provenance === "character" || candidate.provenance === "gm" ? candidate.provenance : "user",
    });
  }
  return items.slice(-LIMITS.characterItems);
}

export function normalizeMemoryText(value: unknown, maxChars = LIMITS.itemChars): string {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxChars) return clean;
  const candidate = clean.slice(0, Math.max(1, maxChars - 1)).trimEnd();
  const wordBoundary = candidate.lastIndexOf(" ");
  return `${(wordBoundary > Math.floor(maxChars * 0.5) ? candidate.slice(0, wordBoundary) : candidate).trim()}…`;
}

function comparisonKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stableId(kind: string, text: string): string {
  const value = `${kind}:${comparisonKey(text)}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${kind}_${(hash >>> 0).toString(36)}`;
}

function sanitizeItem(raw: unknown, kind: string, fallbackTurn: number): ConversationMemoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ConversationMemoryItem>;
  const text = normalizeMemoryText(candidate.text);
  if (!text) return null;
  const sourceTurn = Number.isFinite(Number(candidate.sourceTurn))
    ? Math.max(0, Math.floor(Number(candidate.sourceTurn)))
    : fallbackTurn;
  return {
    id: normalizeMemoryText(candidate.id, 80) || stableId(kind, text),
    text,
    sourceTurn,
    ...(candidate.supersedes ? { supersedes: normalizeMemoryText(candidate.supersedes, 80) } : {}),
  };
}

function sanitizeItems(raw: unknown, kind: string, limit: number, fallbackTurn: number): ConversationMemoryItem[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, ConversationMemoryItem>();
  for (const entry of raw) {
    const item = sanitizeItem(entry, kind, fallbackTurn);
    if (!item) continue;
    const key = comparisonKey(item.text);
    const previous = byKey.get(key);
    if (!previous || previous.sourceTurn <= item.sourceTurn) byKey.set(key, item);
  }
  return [...byKey.values()]
    .sort((a, b) => a.sourceTurn - b.sourceTurn)
    .slice(-limit);
}

function isDepth(value: unknown): value is ConversationDepth {
  return value === "surface" || value === "fissure" || value === "verite" || value === "bonus";
}

const DEPTH_RANK: Record<ConversationDepth, number> = {
  surface: 0,
  fissure: 1,
  verite: 2,
  bonus: 3,
};

function persistentDepth(previous: ConversationDepth, candidate: unknown): ConversationDepth {
  if (!isDepth(candidate)) return previous;
  return DEPTH_RANK[candidate] >= DEPTH_RANK[previous] ? candidate : previous;
}

export function normalizeConversationMemory(raw: unknown): ConversationMemoryV1 {
  if (!raw || typeof raw !== "object") return createEmptyConversationMemory();
  const candidate = raw as Partial<ConversationMemoryV1>;
  const lastTurn = Number.isFinite(Number(candidate.lastTurn))
    ? Math.max(0, Math.floor(Number(candidate.lastTurn)))
    : 0;
  const interlocutor = candidate.interlocutor && typeof candidate.interlocutor === "object"
    ? candidate.interlocutor
    : { name: null, role: null, traits: [] };
  const relationship = candidate.relationship && typeof candidate.relationship === "object"
    ? candidate.relationship
    : createEmptyConversationMemory().relationship;

  return {
    version: 2,
    lastTurn,
    interlocutor: {
      name: normalizeMemoryText(interlocutor.name, 80) || null,
      role: normalizeMemoryText(interlocutor.role, 160) || null,
      traits: sanitizeItems(interlocutor.traits, "trait", LIMITS.traits, lastTurn),
    },
    userFacts: sanitizeItems(candidate.userFacts, "user", LIMITS.userFacts, lastTurn),
    maxDisclosures: sanitizeItems(candidate.maxDisclosures, "max", LIMITS.maxDisclosures, lastTurn),
    commitments: sanitizeItems(candidate.commitments, "commitment", LIMITS.commitments, lastTurn),
    openThreads: sanitizeItems(candidate.openThreads, "thread", LIMITS.openThreads, lastTurn),
    topics: sanitizeItems(candidate.topics, "topic", LIMITS.topics, lastTurn),
    relationship: {
      depth: isDepth(relationship.depth) ? relationship.depth : "surface",
      trust: relationship.trust === "fragile" || relationship.trust === "ouverte" ? relationship.trust : "neutre",
      emotionalState: normalizeMemoryText(relationship.emotionalState, 160) || null,
      sourceTurn: Number.isFinite(Number(relationship.sourceTurn))
        ? Math.max(0, Math.floor(Number(relationship.sourceTurn)))
        : lastTurn,
    },
    lastExchange: normalizeMemoryText(candidate.lastExchange, LIMITS.lastExchangeChars) || null,
    characterItems: sanitizeCharacterItems(candidate.characterItems, lastTurn),
  };
}

function appendStrings(
  current: ConversationMemoryItem[],
  raw: string[] | undefined,
  kind: string,
  turnIndex: number,
  limit: number,
): ConversationMemoryItem[] {
  const byKey = new Map(current.map((item) => [comparisonKey(item.text), item]));
  for (const value of raw ?? []) {
    const text = normalizeMemoryText(value);
    if (!text) continue;
    const key = comparisonKey(text);
    const previous = byKey.get(key);
    if (!previous || previous.sourceTurn <= turnIndex) {
      byKey.set(key, { id: previous?.id || stableId(kind, text), text, sourceTurn: turnIndex });
    }
  }
  return [...byKey.values()].sort((a, b) => a.sourceTurn - b.sourceTurn).slice(-limit);
}

export function mergeConversationMemory(
  previousRaw: unknown,
  delta: ConversationMemoryDelta | null | undefined,
  turnIndex: number,
  activeCharacter: RuntimeCharacter = "max",
): ConversationMemoryV1 {
  const previous = normalizeConversationMemory(previousRaw);
  if (!delta || turnIndex <= previous.lastTurn) return previous;
  const resolved = new Set((delta.resolvedThreadIds ?? []).map((value) => normalizeMemoryText(value, 80)).filter(Boolean));
  const interlocutorName = normalizeMemoryText(delta.interlocutor?.name, 80);
  const interlocutorRole = normalizeMemoryText(delta.interlocutor?.role, 160);
  const emotionalState = normalizeMemoryText(delta.relationship?.emotionalState, 160);
  const explicitCharacterItems = (delta.characterItems ?? []).map((item) => ({
    id: stableId(`character_${item.sourceCharacter ?? activeCharacter}`, item.text),
    text: item.text,
    sourceTurn: turnIndex,
    sourceCharacter: item.sourceCharacter ?? activeCharacter,
    visibility: item.visibility ?? "private",
    visibleTo: item.visibility === "shared" ? ["max", "emma"] : item.visibleTo ?? [item.sourceCharacter ?? activeCharacter],
    provenance: item.provenance ?? "gm",
  }));
  const privateUserFacts = (delta.userFacts ?? []).map((text) => ({
    id: stableId(`character_${activeCharacter}`, text),
    text,
    sourceTurn: turnIndex,
    sourceCharacter: activeCharacter,
    visibility: "private" as const,
    visibleTo: [activeCharacter],
    provenance: "user" as const,
  }));

  return normalizeConversationMemory({
    ...previous,
    lastTurn: turnIndex,
    interlocutor: {
      name: interlocutorName || previous.interlocutor.name,
      role: interlocutorRole || previous.interlocutor.role,
      traits: appendStrings(previous.interlocutor.traits, delta.interlocutor?.traits, "trait", turnIndex, LIMITS.traits),
    },
    userFacts: appendStrings(previous.userFacts, delta.userFacts, "user", turnIndex, LIMITS.userFacts),
    maxDisclosures: appendStrings(previous.maxDisclosures, delta.maxDisclosures, "max", turnIndex, LIMITS.maxDisclosures),
    commitments: appendStrings(previous.commitments, delta.commitments, "commitment", turnIndex, LIMITS.commitments),
    openThreads: appendStrings(
      previous.openThreads.filter((item) => !resolved.has(item.id)),
      delta.openThreads,
      "thread",
      turnIndex,
      LIMITS.openThreads,
    ),
    topics: appendStrings(previous.topics, delta.topics, "topic", turnIndex, LIMITS.topics),
    relationship: {
      depth: persistentDepth(previous.relationship.depth, delta.relationship?.depth),
      trust: delta.relationship?.trust === "fragile" || delta.relationship?.trust === "neutre" || delta.relationship?.trust === "ouverte"
        ? delta.relationship.trust
        : previous.relationship.trust,
      emotionalState: emotionalState || previous.relationship.emotionalState,
      sourceTurn: turnIndex,
    },
    lastExchange: normalizeMemoryText(delta.lastExchange, LIMITS.lastExchangeChars) || previous.lastExchange,
    characterItems: [
      ...(previous.characterItems ?? []),
      ...privateUserFacts,
      ...explicitCharacterItems,
    ],
  });
}

/**
 * Produces the bounded memory visible to one character. V1 facts are treated as
 * Max-private during migration; only identity/role and explicitly shared V2
 * items cross the handoff boundary.
 */
export function filterConversationMemoryForCharacter(
  memoryRaw: unknown,
  character: RuntimeCharacter,
): ConversationMemoryV1 {
  const memory = normalizeConversationMemory(memoryRaw);
  const visible = (memory.characterItems ?? []).filter((item) => item.visibleTo.includes(character));
  if (character === "max") return { ...memory, characterItems: visible };
  const asItems = (provenance: CharacterMemoryItemV2["provenance"]) => visible
    .filter((item) => item.provenance === provenance || item.visibility === "shared")
    .map((item) => ({ id: item.id, text: item.text, sourceTurn: item.sourceTurn }));
  return {
    ...memory,
    userFacts: asItems("user"),
    maxDisclosures: [],
    commitments: asItems("gm"),
    openThreads: asItems("gm"),
    topics: memory.topics.filter((topic) => visible.some((item) => item.text === topic.text && item.visibility === "shared")),
    characterItems: visible,
    lastExchange: null,
  };
}

export function formatConversationMemory(memoryRaw: unknown, maxChars = 1_200): string {
  const memory = normalizeConversationMemory(memoryRaw);
  if (memory.lastTurn === 0 && !memory.interlocutor.name && !memory.interlocutor.role) return "";
  const lines: string[] = [];
  const tryLine = (line: string) => {
    const candidate = lines.length ? `${lines.join("\n")}\n${line}` : line;
    if (candidate.length > maxChars) return false;
    lines.push(line);
    return true;
  };
  const tryItems = (label: string, items: ConversationMemoryItem[], separator = " ; ") => {
    let line = `${label} :`;
    let count = 0;
    for (const item of items) {
      const next = `${line}${count ? separator : " "}${item.text}`;
      const withPeriod = `${next}.`;
      const candidate = lines.length ? `${lines.join("\n")}\n${withPeriod}` : withPeriod;
      if (candidate.length > maxChars) break;
      line = next;
      count += 1;
    }
    if (count) lines.push(`${line}.`);
  };
  const identity = [memory.interlocutor.name, memory.interlocutor.role].filter(Boolean).join(" — ");
  if (identity) tryLine(`Interlocuteur : ${identity}.`);
  const relation = [`profondeur ${memory.relationship.depth}`, `confiance ${memory.relationship.trust}`, memory.relationship.emotionalState]
    .filter(Boolean)
    .join(", ");
  tryLine(`Relation : ${relation}.`);
  if (memory.lastExchange) tryLine(`Dernier échange : ${memory.lastExchange}`);
  tryItems("Fils ouverts", memory.openThreads);
  tryItems("Ce qu'il a montré", memory.interlocutor.traits);
  tryItems("Faits confiés", memory.userFacts);
  tryItems("Déjà révélé par Max", memory.maxDisclosures);
  tryItems("Décisions ou promesses", memory.commitments);
  tryItems("Déjà abordé", memory.topics, ", ");
  return lines.join("\n");
}

export function memorySearchTerms(memoryRaw: unknown): string[] {
  const memory = normalizeConversationMemory(memoryRaw);
  return [
    ...memory.topics.map((item) => item.text),
    ...memory.openThreads.map((item) => item.text),
    memory.relationship.emotionalState || "",
  ].filter(Boolean).slice(-12);
}
