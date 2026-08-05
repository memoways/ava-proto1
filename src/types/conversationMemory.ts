export interface ConversationMemoryItem {
  id: string;
  text: string;
  sourceTurn: number;
  supersedes?: string | null;
}

export type ConversationDepth = "surface" | "fissure" | "verite" | "bonus";

export interface ConversationMemoryV1 {
  version: 1;
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
}
