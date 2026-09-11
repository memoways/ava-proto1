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

export interface ConversationRelationshipState {
  /** Legacy disclosure depth retained for compatibility and factual recall. */
  depth: ConversationDepth;
  /** Legacy trust label retained for existing sessions and admin views. */
  trust: "fragile" | "neutre" | "ouverte";
  emotionalState: string | null;
  sourceTurn: number;
  /** Reversible relational disposition used by the live conversation engine. */
  tier: RelationshipTier;
  topicOpenness: Record<string, TopicOpenness>;
  justification: string;
  evidence: RelationshipEvidence[];
  characterKey: string;
  policyVersion: string;
}

export interface ConversationMemoryV1 {
  /** Version 3 keeps V1/V2 compatibility and adds a validated relationship state. */
  version: 1 | 2 | 3;
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
  relationship: ConversationRelationshipState;
  lastExchange: string | null;
  characterItems?: CharacterMemoryItemV2[];
  /** Conversation facts private to one character. Interlocutor identity stays global. */
  characterStates?: Partial<Record<RuntimeCharacter, CharacterScopedMemory>>;
}

export interface CharacterScopedMemory {
  userFacts: ConversationMemoryItem[];
  characterDisclosures: ConversationMemoryItem[];
  commitments: ConversationMemoryItem[];
  openThreads: ConversationMemoryItem[];
  topics: ConversationMemoryItem[];
  relationship: ConversationMemoryV1["relationship"];
  lastExchange: string | null;
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
    tier?: RelationshipTier;
    topicOpenness?: Record<string, TopicOpenness>;
    justification?: string;
    evidence?: RelationshipEvidence[];
    characterKey?: string;
    policyVersion?: string;
    sourceTurn?: number;
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
import type {
  RelationshipEvidence,
  RelationshipTier,
  TopicOpenness,
} from "./relationship";
