import { describe, expect, it } from "vitest";
import { validateDirectorDecision, type DirectorGuardContext } from "./experienceDirector";

const context: DirectorGuardContext = {
  configPublished: true,
  currentCharacter: "max",
  userTurn: 4,
  handoffCount: 0,
  handoffPending: false,
  handoffsEnabled: true,
  minimumHandoffTurn: 4,
  maximumHandoffsPerSession: 1,
  emmaReady: true,
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
  it("blocks Max→Emma before the fourth user turn", () => {
    const result = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "emma", reason: "pertinent", proposalGuidance: "Propose Emma." },
    }, { ...context, userTurn: 3 });
    expect(result.action).toEqual({ type: "none" });
    expect(result.blockedReason).toBe("handoff_before_minimum_turn");
  });

  it("accepts one ready Max→Emma handoff from turn four", () => {
    const result = validateDirectorDecision({
      labels: { themes: [], topics: [], intentions: [] },
      nextTurnGuidance: null,
      memoryDelta: null,
      action: { type: "handoff", targetCharacter: "emma", reason: "pertinent", proposalGuidance: "Propose Emma." },
    }, context);
    expect(result.accepted).toBe(true);
    expect(result.action.type).toBe("handoff");
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
});
