import { describe, expect, it } from "vitest";
import {
  applyTier,
  billingWindow,
  emptyPlan,
  parseServicePlans,
  planSnapshot,
  serviceById,
  sumUsage,
  type UsageEvent,
} from "./servicePlans";

const NOW = new Date("2026-11-22T08:00:00.000Z");

describe("billingWindow", () => {
  it("uses the month that ends on the next renewal", () => {
    const window = billingWindow("2026-12-05", "monthly", NOW);
    expect(window.source).toBe("renewal");
    expect(window.start.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });

  it("rolls a past renewal forward to the current cycle", () => {
    const window = billingWindow("2025-03-15", "monthly", NOW);
    expect(window.start.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-15T00:00:00.000Z");
  });

  it("keeps a yearly anniversary even when the typed date is far ahead", () => {
    const window = billingWindow("2028-03-15", "yearly", NOW);
    expect(window.start.toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });

  it("falls back to the calendar month when no renewal is typed", () => {
    const window = billingWindow(null, "monthly", NOW);
    expect(window.source).toBe("calendar");
    expect(window.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("planSnapshot", () => {
  const events: UsageEvent[] = [
    { serviceId: "elevenlabs", at: "2026-11-10T12:00:00.000Z", amount: 1000 },
    { serviceId: "elevenlabs", at: "2026-10-10T12:00:00.000Z", amount: 9000 },
    { serviceId: "tavus", at: "2026-11-20T12:00:00.000Z", amount: 200 },
  ];

  it("does not bill characters that are still inside the allowance", () => {
    const service = serviceById("elevenlabs")!;
    const plan = applyTier(service, "creator", "monthly", { ...emptyPlan(), renewsOn: "2026-12-05" });
    const snapshot = planSnapshot(service, plan, events, NOW, false);
    expect(snapshot.status).toBe("inside");
    expect(snapshot.used).toBe(1000);
    expect(snapshot.overageUnits).toBe(0);
    expect(snapshot.overageUsd).toBe(0);
    expect(snapshot.periodUsd).toBe(22);
    expect(snapshot.minutesAreEstimate).toBe(true);
  });

  it("bills only the minutes above the video allowance, on top of the fixed fee", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const snapshot = planSnapshot(service, plan, events, NOW, false);
    expect(snapshot.used).toBe(200);
    expect(snapshot.overageUnits).toBe(25);
    expect(snapshot.overageUsd).toBeCloseTo(8.75);
    expect(snapshot.periodUsd).toBeCloseTo(59 + 8.75);
    expect(snapshot.status).toBe("over");
  });

  it("asks for the overage price instead of inventing one", () => {
    const service = serviceById("elevenlabs")!;
    const plan = applyTier(service, "starter", "monthly", emptyPlan());
    plan.included = 100;
    const snapshot = planSnapshot(service, plan, events, NOW, false);
    expect(snapshot.status).toBe("over-rate-missing");
    expect(snapshot.overageUnits).toBe(900);
    expect(snapshot.overageUsd).toBeNull();
    expect(snapshot.periodUsd).toBeNull();
  });

  it("treats OpenRouter as the measured bill, with no second copy of the same dollars", () => {
    const service = serviceById("openrouter")!;
    const snapshot = planSnapshot(
      service,
      emptyPlan(),
      [{ serviceId: "openrouter", at: "2026-11-02T00:00:00.000Z", amount: 4.5 }],
      NOW,
      false,
    );
    expect(snapshot.status).toBe("payg");
    expect(snapshot.fixedUsd).toBe(0);
    expect(snapshot.periodUsd).toBe(4.5);
  });

  it("adds an OpenRouter credit only once, then the part above it", () => {
    const service = serviceById("openrouter")!;
    const plan = { ...emptyPlan(), monthlyFeeUsd: 20, included: 10 };
    const snapshot = planSnapshot(
      service,
      plan,
      [{ serviceId: "openrouter", at: "2026-11-02T00:00:00.000Z", amount: 12 }],
      NOW,
      false,
    );
    expect(snapshot.status).toBe("over");
    expect(snapshot.overageUsd).toBe(2);
    expect(snapshot.periodUsd).toBe(22);
  });

  it("converts HeyGen minutes into FULL-mode credits before comparing the allowance", () => {
    const service = serviceById("heygen")!;
    const plan = applyTier(service, "essential", "monthly", emptyPlan());
    const snapshot = planSnapshot(
      service,
      plan,
      [{ serviceId: "heygen", at: "2026-11-02T00:00:00.000Z", amount: 40 }],
      NOW,
      false,
    );
    expect(snapshot.used).toBe(80);
    expect(snapshot.usedMinutes).toBe(40);
    expect(snapshot.minutesAreEstimate).toBe(false);
    expect(snapshot.status).toBe("inside");
    expect(snapshot.periodUsd).toBe(99);
  });

  it("keeps Voyage as a fee with no measured usage", () => {
    const service = serviceById("voyage")!;
    const snapshot = planSnapshot(service, { ...emptyPlan(), monthlyFeeUsd: 15 }, [], NOW, false);
    expect(snapshot.status).toBe("unmeasured");
    expect(snapshot.used).toBeNull();
    expect(snapshot.periodUsd).toBe(15);
  });
});

describe("parseServicePlans", () => {
  it("keeps a typed plan and drops unknown services", () => {
    const parsed = parseServicePlans({
      plans: {
        elevenlabs: { tierId: "creator", cadence: "yearly", monthlyFeeUsd: 18.33, included: 121000, overagePerUnitUsd: 0.0003, renewsOn: "2026-12-05" },
        other: { monthlyFeeUsd: 10 },
        tavus: { monthlyFeeUsd: -5 },
      },
    });
    expect(parsed.elevenlabs?.monthlyFeeUsd).toBe(18.33);
    expect(parsed.elevenlabs?.cadence).toBe("yearly");
    expect(parsed.other).toBeUndefined();
    expect(parsed.tavus?.monthlyFeeUsd).toBeNull();
  });
});

describe("sumUsage", () => {
  it("ignores events outside the window and negative amounts", () => {
    const total = sumUsage(
      [
        { serviceId: "anam", at: "2026-11-20T00:00:00.000Z", amount: 10 },
        { serviceId: "anam", at: "2026-11-20T00:00:00.000Z", amount: -3 },
        { serviceId: "anam", at: "2026-12-20T00:00:00.000Z", amount: 99 },
      ],
      "anam",
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-12-01T00:00:00.000Z"),
    );
    expect(total).toBe(10);
  });
});
