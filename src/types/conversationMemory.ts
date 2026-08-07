export interface ConversationMemoryItem {
  id: string;
  text: string;
  sourceTurn: number;
  supersedes?: string | null;
}

export type RuntimeCharacter = "max" | "emma";

export interface CharacterMemoryItemV2 {
  id: string;
  text: string;
  sourceTurn: number;
  sourceCharacter: RuntimeCharacter;
  visibility: "private" | "shared";
  visibleTo: RuntimeCharacter[];
  provenance: "user" | "character" | "gm";
}

export type ConversationDepth = "surface" | "fissure" | "verite" | "bonus";

export interface ConversationMemoryV1 {
  /** Version 2 keeps every V1 field and adds character-scoped memory. */
  version: 1 | 2;
  lastTurn: number;
  interlocutor: {
    name: string | null;
    role: string | null;
    traits: ConversationMemoryItem[];
  };
  userFacts: ConversationMemoryItem[];
  maxDisclosures: ConversationMemoryItem[];
  commitments: ConversationMemoryItem[];
  openThreads: ConversationMemoryItem[];
  topics: ConversationMemoryItem[];
  relationship: {
    depth: ConversationDepth;
    trust: "fragile" | "neutre" | "ouverte";
    emotionalState: string | null;
    sourceTurn: number;
  };
  lastExchange: string | null;
  characterItems?: CharacterMemoryItemV2[];
}

export interface ConversationMemoryDelta {
  interlocutor?: {
    name?: string | null;
    role?: string | null;
    traits?: string[];
  };
  userFacts?: string[];
  maxDisclosures?: string[];
  commitments?: string[];
  openThreads?: string[];
  resolvedThreadIds?: string[];
  topics?: string[];
  relationship?: {
    depth?: ConversationDepth;
    trust?: "fragile" | "neutre" | "ouverte";
    emotionalState?: string | null;
  };
  lastExchange?: string | null;
  characterItems?: Array<{
    text: string;
    sourceCharacter?: RuntimeCharacter;
    visibility?: "private" | "shared";
    visibleTo?: RuntimeCharacter[];
    provenance?: "user" | "character" | "gm";
  }>;
}
