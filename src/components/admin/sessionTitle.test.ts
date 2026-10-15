import { describe, expect, it } from "vitest";
import { accountLabel, autoSessionTitle, describeSession } from "./sessionTitle";

const base = { environment_id: "sandbox-ulrich", started_at: null, duration_seconds: null, game_over_reason: null, ended_at: "x", conversation_log: [] };

describe("session auto title", () => {
  it("maps environments to account names", () => {
    expect(accountLabel({ environment_id: "prod" })).toBe("Production");
    expect(accountLabel({ environment_id: "sandbox-romed" })).toBe("Romed");
  });
  it("flags short tests and timeouts", () => {
    const log = [{ role: "user", content: "a" }, { role: "assistant", content: "b" }];
    expect(describeSession({ ...base, conversation_log: log, game_over_reason: "timeout" })).toBe("test court (1 tours), timeout");
  });
  it("includes participants and switches from the conversation in the automatic title", () => {
    expect(autoSessionTitle({ ...base, conversation_log: [
      { role: "user", spokenWith: "emma" }, { role: "emma" },
      { role: "user", spokenWith: "leo" }, { role: "leo" },
    ] })).toContain("Emma → Léo (2 personnages, 1 changement)");
  });
});
