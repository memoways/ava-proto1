import { describe, expect, it } from "vitest";
import { accountLabel, describeSession } from "./sessionTitle";

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
});
