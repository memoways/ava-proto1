import { describe, expect, it } from "vitest";
import {
  resolveExperienceDirection,
  type ExperienceDirectionInput,
} from "@/services/experienceDirection";
import type { StateLevels } from "@/services/characterState";

const levels = (v: Partial<StateLevels> = {}): StateLevels => ({
  combativite: 3, initiative: 3, lucidite: 3, ouverture: 3, agitation: 3, ...v,
});

const base = (p: Partial<ExperienceDirectionInput> = {}): ExperienceDirectionInput => ({
  tier: "contact", topicOpenness: {}, levels: levels(), elapsedRatio: 0.1, previous: null, ...p,
});

describe("resolveExperienceDirection", () => {
  it("starts with establish", () => {
    expect(resolveExperienceDirection(base()).direction).toBe("establish");
  });

  it("digs only with a sufficient tier, an open topic and openness", () => {
    const ok = base({ tier: "link", topicOpenness: { a: "partial" }, previous: "establish" });
    expect(resolveExperienceDirection(ok).direction).toBe("dig");
    expect(resolveExperienceDirection({ ...ok, tier: "contact" }).direction).toBe("establish");
    expect(resolveExperienceDirection({ ...ok, topicOpenness: { a: "closed" } }).direction).toBe("establish");
    expect(resolveExperienceDirection({ ...ok, levels: levels({ ouverture: 1 }) }).direction).toBe("establish");
  });

  it("weighs only at trust tier with an open topic", () => {
    const ok = base({ tier: "trust", topicOpenness: { a: "open" }, previous: "dig" });
    expect(resolveExperienceDirection(ok).direction).toBe("weigh");
    expect(resolveExperienceDirection({ ...ok, tier: "link" }).direction).toBe("dig");
  });

  it("never skips a direction forward", () => {
    const r = resolveExperienceDirection(base({ tier: "trust", topicOpenness: { a: "open" }, previous: "establish" }));
    expect(r.direction).toBe("dig");
  });

  it("can step back freely", () => {
    const r = resolveExperienceDirection(base({ tier: "contact", previous: "weigh" }));
    expect(r.direction).toBe("establish");
  });

  it("releases on high agitation or time pressure after digging", () => {
    const common = { tier: "trust", topicOpenness: { a: "open" }, previous: "weigh" } as const;
    expect(resolveExperienceDirection(base({ ...common, levels: levels({ agitation: 4 }) })).direction).toBe("release");
    expect(resolveExperienceDirection(base({ ...common, elapsedRatio: 0.65 })).direction).toBe("release");
    expect(resolveExperienceDirection(base({ ...common, elapsedRatio: 0.3 })).direction).toBe("weigh");
  });

  it("never concludes before the 80 % closure threshold", () => {
    const common = { tier: "trust", topicOpenness: { a: "open" }, previous: "release", signals: { closingSignal: true } } as const;
    expect(resolveExperienceDirection(base({ ...common, elapsedRatio: 0.79 })).direction).toBe("release");
    expect(resolveExperienceDirection(base({ ...common, elapsedRatio: 0.8 })).direction).toBe("conclude");
  });

  it("holds the previous direction on distress, hostility or off-topic", () => {
    for (const signals of [{ distress: true }, { hostility: true }, { offTopic: true }]) {
      const r = resolveExperienceDirection(base({ tier: "trust", topicOpenness: { a: "open" }, previous: "dig", signals }));
      expect(r.direction).toBe("dig");
      expect(r.suspended).toBe(true);
    }
  });

  it("respects directions forbidden by the character sheet", () => {
    const r = resolveExperienceDirection(base({
      tier: "trust", topicOpenness: { a: "open" }, previous: "dig", forbidden: ["weigh"],
    }));
    expect(r.direction).toBe("dig");
  });

  it("works without a radar and tolerates a bad time ratio", () => {
    const r = resolveExperienceDirection(base({ levels: null, tier: "link", topicOpenness: { a: "open" }, previous: "establish", elapsedRatio: NaN }));
    expect(r.direction).toBe("dig");
  });

  it("returns axis biases as hints", () => {
    const r = resolveExperienceDirection(base({ tier: "link", topicOpenness: { a: "partial" }, previous: "establish" }));
    expect(r.bias).toEqual({ ouverture: "up" });
  });
});
