import { describe, expect, it } from "vitest";
import { createMicRecoveryPolicy, isMicSilentlyDead, MIC_RECOVERY_DELAYS_MS } from "./handsFreeRecovery";

describe("mic recovery policy", () => {
  it("retries with growing delays, then gives up so the player is told", () => {
    const policy = createMicRecoveryPolicy();
    expect([policy.next(), policy.next(), policy.next()]).toEqual([...MIC_RECOVERY_DELAYS_MS]);
    expect(policy.next()).toBeNull();
    expect(policy.attempts).toBe(MIC_RECOVERY_DELAYS_MS.length);
  });

  it("gives the budget back once the mic delivered speech again", () => {
    const policy = createMicRecoveryPolicy([100, 200]);
    policy.next(); policy.next();
    expect(policy.next()).toBeNull();
    policy.reset();
    expect(policy.attempts).toBe(0);
    expect(policy.next()).toBe(100);
  });
});

describe("mic watchdog", () => {
  const live = { listening: true, ended: false, blocked: false, starting: false, sttActive: true };

  it("flags a mic that should listen but has no connected STT", () => {
    expect(isMicSilentlyDead({ ...live, sttActive: false })).toBe(true);
  });

  it("leaves a healthy mic alone", () => {
    expect(isMicSilentlyDead(live)).toBe(false);
  });

  it("ignores deliberate silences: mic off, call ended, video/handoff, start in progress", () => {
    for (const patch of [{ listening: false }, { ended: true }, { blocked: true }, { starting: true }]) {
      expect(isMicSilentlyDead({ ...live, sttActive: false, ...patch })).toBe(false);
    }
  });
});
