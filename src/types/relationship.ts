export type RelationshipTier = "contact" | "link" | "trust";

export type TopicOpenness = "closed" | "partial" | "open";

export type RelationshipEvidence =
  | "precise_listening"
  | "honesty"
  | "boundary_respected"
  | "relevant_confrontation"
  | "repair"
  | "reciprocal_disclosure"
  | "boundary_pressure"
  | "contradiction"
  | "hostility"
  | "politeness"
  | "character_disclosure";

export interface RelationshipTopicRule {
  id: string;
  label: string;
  keywords: string[];
  minimumTier: RelationshipTier;
  condition: string;
}

export interface CharacterRelationshipPolicy {
  schemaVersion: 1;
  characterKey: string;
  version: string;
  callDrive: string;
  openingSignals: string[];
  closingSignals: string[];
  sensitiveTopics: RelationshipTopicRule[];
  resistanceStyle: string;
  initiativeStyle: string;
  source: "notion" | "legacy_compiled";
}

export interface RelationshipState {
  tier: RelationshipTier;
  topicOpenness: Record<string, TopicOpenness>;
  justification: string;
  evidence: RelationshipEvidence[];
  sourceTurn: number;
  characterKey: string;
  policyVersion: string;
}

export interface RelationshipStateProposal {
  tier?: RelationshipTier;
  topicOpenness?: Record<string, TopicOpenness>;
  justification?: string;
  evidence?: RelationshipEvidence[];
  sourceTurn?: number;
  characterKey?: string;
  policyVersion?: string;
}

export interface TurnRelationshipDirective {
  schemaVersion: 1;
  characterKey: string;
  policyVersion: string;
  sourceTurn: number;
  tier: RelationshipTier;
  matchedTopicIds: string[];
  mode: "engage" | "resist";
  prompt: string;
}

export interface RelationshipTransitionAudit {
  accepted: boolean;
  reasons: string[];
  previous: RelationshipState;
  next: RelationshipState;
}
