import { describe, expect, it } from "vitest";
import { applyTopicHandoffFallback, validateDirectorDecision, type DirectorGuardContext } from "./experienceDirector";

const context: DirectorGuardContext = {
  configPublished: true,
  currentCharacter: "max",
  userTurn: 4,
  handoffCount: 0,
  handoffPending: false,
  lastHandoffTurn: null,
  handoffsEnabled: true,
  minimumHandoffTurn: 4,
  maximumHandoffsPerSession: 8,
  minimumTurnsBetweenHandoffs: 2,
  targetReady: true,
  playedVideoIds: [],
  availableVideoIds: ["video-1"],
  lastVideoTurn: null,
  minimumVideoTurn: 3,
  minimumTurnsBetweenVideos: 2,
  maximumVideosPerSession: 2,
  cinematicsEnabled: true,
  resultIsCurrent: true,
};

describe("validateDirectorDecision", () => {
  it("blocks a GM handoff before the fourth user turn", () => {
    const result = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "emma", reason: "pertinent", proposalGuidance: "Propose Emma." },
    }, { ...context, userTurn: 3 });
    expect(result.action).toEqual({ type: "none" });
    expect(result.blockedReason).toBe("handoff_before_minimum_turn");
  });

  it("accepts Max→Emma and Emma→Max when the target is ready", () => {
    const toEmma = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "emma", reason: "pertinent", proposalGuidance: "Propose Emma." },
    }, context);
    expect(toEmma.accepted).toBe(true);
    expect(toEmma.action.type).toBe("handoff");

    const toMax = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "max", reason: "retour", proposalGuidance: "Propose Max." },
    }, { ...context, currentCharacter: "emma", userTurn: 8, lastHandoffTurn: 4 });
    expect(toMax.accepted).toBe(true);
  });

  it("blocks a handoff toward the current character or during cooldown", () => {
    const same = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "max", reason: "noop", proposalGuidance: "Reste." },
    }, context);
    expect(same.blockedReason).toBe("handoff_same_character");

    const cooldown = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "max", reason: "retour", proposalGuidance: "Propose Max." },
    }, { ...context, currentCharacter: "emma", userTurn: 5, lastHandoffTurn: 4 });
    expect(cooldown.blockedReason).toBe("handoff_cooldown");
  });

  it("blocks a cinematic already played", () => {
    const result = validateDirectorDecision({
      labels: { themes: ["famille"], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "cinematic", videoId: "video-1", reason: "famille", confidence: 0.9 },
    }, { ...context, playedVideoIds: ["video-1"] });
    expect(result.blockedReason).toBe("cinematic_already_played");
  });

  it("turns a late result into none", () => {
    const result = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "end", reason: "clôture" },
    }, { ...context, resultIsCurrent: false });
    expect(result.action.type).toBe("none");
    expect(result.blockedReason).toBe("late_result");
  });

  it("blocks actions disabled by the published configuration", () => {
    const handoff = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "emma", reason: "pertinent", proposalGuidance: "Propose Emma." },
    }, { ...context, handoffsEnabled: false });
    expect(handoff.blockedReason).toBe("handoff_disabled");

    const cinematic = validateDirectorDecision({
      labels: { themes: ["famille"], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "cinematic", videoId: "video-1", reason: "famille", confidence: 0.9 },
    }, { ...context, cinematicsEnabled: false });
    expect(cinematic.blockedReason).toBe("cinematic_disabled");
  });

  it("promotes a topic rule into a bidirectional handoff suggestion", () => {
    const decision = applyTopicHandoffFallback({
      labels: { themes: ["police"], topics: ["enquete"], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "none" },
    }, {
      schemaVersion: 1,
      minimumHandoffTurn: 4,
      maximumHandoffsPerSession: 8,
      minimumTurnsBetweenHandoffs: 2,
      handoffTarget: "either",
      directorTimeoutMs: 12_000,
      editor: {
        tone: "balanced",
        guidanceLength: "balanced",
        priorities: ["narrative_continuity"],
        allowHandoffs: true,
        allowCinematics: true,
        customInstructions: "",
        handoffRules: [{ targetCharacter: "emma", themes: ["police"], topics: [] }],
      },
    }, "max");
    expect(decision.action.type).toBe("handoff");
    if (decision.action.type === "handoff") expect(decision.action.targetCharacter).toBe("emma");
  });
});
