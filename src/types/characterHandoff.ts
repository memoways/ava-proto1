import type { RuntimeCharacter } from "./conversationMemory";

/** Semantic assessment only. Director guards and the player's click remain mandatory. */
export interface CharacterHandoffAssessment {
  schemaVersion: 1;
  sourceCharacter: RuntimeCharacter;
  targetCharacter: RuntimeCharacter;
  turnId: string;
  turnIndex: number;
  orchestrationVersionId: string;
  origin: {
    type: "player_request" | "gm_proposal";
    turnId: string;
    turnIndex: number;
    evidence: string;
  };
  targetEvidence: { speaker: "user" | "character"; quote: string };
  consent: { stance: "accept" | "object" | "defer"; evidence: string; refusalEvidence: string | null };
}
