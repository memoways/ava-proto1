import { describe, expect, it } from "vitest";
import { resolveResumeTimerWindow } from "./resumeTimer";

describe("resolveResumeTimerWindow", () => {
  it("restaure le temps restant sans ajouter la marge technique", () => {
    const started = "2026-08-05T12:00:00.000Z";
    const expires = "2026-08-05T12:20:00.000Z"; // 15 min + 5 min de marge
    const window = resolveResumeTimerWindow(started, expires, Date.parse("2026-08-05T12:06:00.000Z"));

    expect(window).toEqual({
      configuredDurationSeconds: 900,
      elapsedSeconds: 360,
      remainingSeconds: 540,
    });
  });

  it("refuse des dates incohérentes", () => {
    expect(resolveResumeTimerWindow("invalide", "2026-08-05T12:20:00.000Z")).toBeNull();
    expect(resolveResumeTimerWindow("2026-08-05T12:20:00.000Z", "2026-08-05T12:00:00.000Z")).toBeNull();
  });
});
