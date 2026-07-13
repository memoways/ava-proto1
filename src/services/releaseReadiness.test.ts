import { describe, expect, it } from "vitest";
import { evaluateCanaryReadiness, INTERNAL_CANARY_THRESHOLDS } from "./releaseReadiness";

const completeThresholds = {
  ...INTERNAL_CANARY_THRESHOLDS,
  maximumCostPerSessionUsd: 0.25,
};

describe("evaluateCanaryReadiness", () => {
  it("holds a release while the internal sample or required metrics are incomplete", () => {
    const result = evaluateCanaryReadiness({
      sessionCount: 2,
      turnCount: 12,
      p95FirstSoundMs: 2_800,
      turnErrorRate: 0,
      persistenceRate: null,
      costPerSessionUsd: null,
    });

    expect(result.decision).toBe("hold");
    expect(result.checks.filter((check) => check.status === "hold").map((check) => check.key)).toEqual(
      expect.arrayContaining(["sessionCount", "turnCount", "persistenceRate", "costPerSessionUsd"]),
    );
  });

  it("requests rollback as soon as one safety threshold is exceeded", () => {
    const result = evaluateCanaryReadiness(
      {
        sessionCount: 5,
        turnCount: 30,
        p95FirstSoundMs: 5_001,
        turnErrorRate: 0.021,
        persistenceRate: 0.99,
        costPerSessionUsd: 0.2,
      },
      completeThresholds,
    );

    expect(result.decision).toBe("rollback");
    expect(result.checks.filter((check) => check.status === "fail")).toHaveLength(3);
  });

  it("promotes only when the sample and every threshold pass", () => {
    const result = evaluateCanaryReadiness(
      {
        sessionCount: 6,
        turnCount: 42,
        p95FirstSoundMs: 4_200,
        turnErrorRate: 0.01,
        persistenceRate: 0.998,
        costPerSessionUsd: 0.19,
      },
      completeThresholds,
    );

    expect(result.decision).toBe("promote");
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });
});
