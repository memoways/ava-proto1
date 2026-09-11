import { describe, expect, it } from "vitest";
import type { PRD4PostTurnEvaluation } from "@/types";
import { latestPostTurnForCharacter } from "./sessionConversationMemory";

function entry(
  turn: number,
  guidance: string,
  characterKey?: "max" | "emma",
): PRD4PostTurnEvaluation {
  return {
    engagement_delta: 0,
    confusion_detected: false,
    role_usage_quality: "unknown",
    topics_covered: [],
    transition_recommended: false,
    cinematic_hint: null,
    next_turn_guidance: guidance,
    end_recommended: false,
    moderation_flag: false,
    notes: "",
    turn_index: turn,
    character_key: characterKey,
  };
}

describe("latestPostTurnForCharacter", () => {
  it("reprend uniquement la dernière guidance du personnage actif", () => {
    const entries = [
      entry(8, "Ancienne guidance globale"),
      entry(7, "Guidance Emma", "emma"),
      entry(6, "Guidance Max", "max"),
    ];

    expect(latestPostTurnForCharacter(entries, "emma")?.next_turn_guidance).toBe("Guidance Emma");
    expect(latestPostTurnForCharacter(entries, "max")?.next_turn_guidance).toBe("Guidance Max");
  });

  it("exclut les anciens résultats globaux du contexte vivant", () => {
    expect(latestPostTurnForCharacter([entry(9, "Global")], "emma")).toBeNull();
  });
});
