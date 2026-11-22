import { describe, expect, it } from "vitest";
import {
  applyTier,
  billingWindow,
  emptyPlan,
  parseServicePlans,
  periodCostReading,
  planSnapshot,
  requestedDays,
  serviceById,
  subscriptionSpend,
  sumPeriodTotals,
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

  it("reduces a prepaid balance only with usage after the top-up", () => {
    const service = serviceById("openrouter")!;
    const plan = { ...emptyPlan(), funding: "prepaid" as const, balanceUsd: 25, creditedOn: "2026-11-01" };
    const snapshot = planSnapshot(
      service,
      plan,
      [
        { serviceId: "openrouter", at: "2026-10-20T00:00:00.000Z", amount: 9 },
        { serviceId: "openrouter", at: "2026-11-02T00:00:00.000Z", amount: 4.5 },
      ],
      NOW,
      false,
    );
    expect(snapshot.status).toBe("credit");
    expect(snapshot.spentUsd).toBe(4.5);
    expect(snapshot.remainingUsd).toBe(20.5);
    expect(snapshot.periodUsd).toBe(25);
  });

  it("asks for a top-up once the loaded credit is spent", () => {
    const service = serviceById("inworld")!;
    const plan = { ...emptyPlan(), funding: "prepaid" as const, balanceUsd: 25, creditedOn: "2026-11-01", usdPerUnit: 5 / 1000 };
    const snapshot = planSnapshot(
      service,
      plan,
      [{ serviceId: "inworld", at: "2026-11-10T00:00:00.000Z", amount: 6000 }],
      NOW,
      false,
    );
    expect(snapshot.spentUsd).toBe(30);
    expect(snapshot.status).toBe("topup");
    expect(snapshot.remainingUsd).toBe(0);
    expect(snapshot.overageUsd).toBe(5);
  });

  it("stops the monthly fee when the subscription is cancelled", () => {
    const service = serviceById("fish")!;
    const plan = applyTier(service, "custom", "monthly", { ...emptyPlan(), account: "cancelled", monthlyFeeUsd: 11 });
    const snapshot = planSnapshot(service, plan, [{ serviceId: "fish", at: "2026-11-10T00:00:00.000Z", amount: 100 }], NOW, false);
    expect(snapshot.status).toBe("cancelled");
    expect(snapshot.fixedUsd).toBe(0);
    expect(snapshot.periodUsd).toBe(0);
    expect(snapshot.used).toBe(100);
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
    expect(parsed.elevenlabs?.funding).toBe("subscription");
    expect(parsed.elevenlabs?.account).toBe("active");
    expect(parsed.other).toBeUndefined();
    expect(parsed.tavus?.monthlyFeeUsd).toBeNull();
  });
});

describe("subscriptionSpend", () => {
  it("adds every monthly invoice from October through the December renewal", () => {
    const spend = subscriptionSpend({
      startedOn: "2026-10-15",
      renewsOn: "2026-12-15",
      endedOn: null,
      cadence: "monthly",
      monthlyFeeUsd: 59,
      account: "active",
      now: NOW,
    });
    expect(spend?.count).toBe(3);
    expect(spend?.totalUsd).toBe(177);
    expect(spend?.from).toBe("2026-10-15");
    expect(spend?.to).toBe("2026-12-15");
    expect(spend?.includesUpcoming).toBe(true);
  });

  it("stops at the end date and does not count a later renewal", () => {
    const spend = subscriptionSpend({
      startedOn: "2026-10-15",
      renewsOn: "2026-12-15",
      endedOn: "2026-11-20",
      cadence: "monthly",
      monthlyFeeUsd: 59,
      account: "cancelled",
      now: NOW,
    });
    expect(spend?.count).toBe(2);
    expect(spend?.totalUsd).toBe(118);
    expect(spend?.to).toBe("2026-11-15");
    expect(spend?.includesUpcoming).toBe(false);
  });
});

describe("periodCostReading", () => {
  const cycle: UsageEvent[] = [
    { serviceId: "tavus", at: "2026-11-10T12:00:00.000Z", amount: 20 },
    { serviceId: "tavus", at: "2026-11-20T12:00:00.000Z", amount: 10 },
    { serviceId: "tavus", at: "2026-10-20T12:00:00.000Z", amount: 40 },
  ];

  it("names the three period buttons and leaves an open range unprorated", () => {
    expect(requestedDays("24h")).toBe(1);
    expect(requestedDays("7d")).toBe(7);
    expect(requestedDays("30d")).toBe(30);
    expect(requestedDays("all")).toBeNull();
  });

  it("shares the monthly fee across the requested days and keeps the allowance for the whole cycle", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const reading = periodCostReading(service, plan, cycle, 10, NOW, 7);
    expect(reading.kind).toBe("subscription");
    expect(reading.consumedMinutes).toBe(10);
    expect(reading.subscriptionUsd).toBeCloseTo(59 * 7 / 30);
    expect(reading.remainingMinutes).toBe(145);
    expect(reading.overageUnits).toBe(0);
    expect(reading.totalUsd).toBeCloseTo(59 * 7 / 30);
  });

  it("prices only the minutes of this window that fall past the allowance", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const heavy: UsageEvent[] = [{ serviceId: "tavus", at: "2026-11-18T12:00:00.000Z", amount: 200 }];
    const reading = periodCostReading(service, plan, heavy, 40, NOW, 7);
    expect(reading.overageUnits).toBe(25);
    expect(reading.overageUsd).toBeCloseTo(8.75);
    expect(reading.remainingMinutes).toBe(0);
    expect(reading.totalUsd).toBeCloseTo((59 * 7) / 30 + 8.75);
  });

  it("does not turn minutes from the previous cycle into this month's overage", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const reading = periodCostReading(service, plan, cycle, 50, NOW, 30);
    expect(reading.consumedMinutes).toBe(50);
    expect(reading.overageUnits).toBe(0);
    expect(reading.subscriptionUsd).toBe(59);
    expect(reading.totalUsd).toBe(59);
  });

  it("shows the current month when the range is the whole history", () => {
    const service = serviceById("tavus")!;
    const plan = applyTier(service, "builder", "monthly", { ...emptyPlan(), renewsOn: "2026-12-01" });
    const over: UsageEvent[] = [{ serviceId: "tavus", at: "2026-11-18T12:00:00.000Z", amount: 200 }];
    const reading = periodCostReading(service, plan, over, 200, NOW, null);
    expect(reading.kind).toBe("month");
    expect(reading.subscriptionUsd).toBe(59);
    expect(reading.overageUsd).toBeCloseTo(8.75);
    expect(reading.totalUsd).toBeCloseTo(67.75);
  });

  it("converts HeyGen minutes with the plan's credits per minute", () => {
    const service = serviceById("heygen")!;
    const plan = applyTier(service, "essential", "monthly", emptyPlan());
    const reading = periodCostReading(
      service,
      plan,
      [{ serviceId: "heygen", at: "2026-11-02T00:00:00.000Z", amount: 10 }],
      10,
      NOW,
      7,
    );
    expect(reading.consumedUnits).toBe(20);
    expect(reading.consumedMinutes).toBe(10);
    expect(reading.minutesAreEstimate).toBe(false);
    expect(reading.remainingUnits).toBe(1080);
    expect(reading.remainingMinutes).toBe(540);
    expect(reading.subscriptionUsd).toBeCloseTo(99 * 7 / 30);
  });

  it("estimates spoken minutes from voice characters", () => {
    const service = serviceById("elevenlabs")!;
    const plan = applyTier(service, "creator", "monthly", { ...emptyPlan(), renewsOn: "2026-12-05" });
    const reading = periodCostReading(
      service,
      plan,
      [{ serviceId: "elevenlabs", at: "2026-11-10T12:00:00.000Z", amount: 1500 }],
      1500,
      NOW,
      1,
    );
    expect(reading.consumedMinutes).toBe(2);
    expect(reading.minutesAreEstimate).toBe(true);
    expect(reading.subscriptionUsd).toBeCloseTo(22 / 30);
    expect(reading.remainingUnits).toBe(121000 - 1500);
    expect(reading.totalUsd).toBeCloseTo(22 / 30);
  });

  it("stops the fee when the subscription is paused", () => {
    const service = serviceById("tavus")!;
    const plan = { ...applyTier(service, "builder", "monthly", emptyPlan()), account: "paused" as const };
    const reading = periodCostReading(service, plan, cycle, 10, NOW, 7);
    expect(reading.kind).toBe("stopped");
    expect(reading.subscriptionUsd).toBe(0);
    expect(reading.totalUsd).toBe(0);
    expect(reading.consumedMinutes).toBe(10);
  });

  it("does not invent a price when no plan is saved", () => {
    const service = serviceById("lemonslice")!;
    const reading = periodCostReading(service, emptyPlan(), [], 4, NOW, 7);
    expect(reading.kind).toBe("unset");
    expect(reading.consumedMinutes).toBe(4);
    expect(reading.subscriptionUsd).toBeNull();
    expect(reading.totalUsd).toBeNull();
  });

  it("still shares a fee when the included minutes were not typed", () => {
    const service = serviceById("anam")!;
    const plan = { ...emptyPlan(), monthlyFeeUsd: 49, renewsOn: "2026-12-01" };
    const reading = periodCostReading(service, plan, [], 3, NOW, 7);
    expect(reading.allowanceMissing).toBe(true);
    expect(reading.subscriptionUsd).toBeCloseTo(49 * 7 / 30);
    expect(reading.totalUsd).toBeCloseTo(49 * 7 / 30);
    expect(reading.remainingUnits).toBeNull();
  });

  it("spends a prepaid balance over the period and leaves the rest of the credit", () => {
    const service = serviceById("inworld")!;
    const plan = { ...emptyPlan(), funding: "prepaid" as const, balanceUsd: 10, creditedOn: "2026-11-01", usdPerUnit: 5 / 1000 };
    const reading = periodCostReading(
      service,
      plan,
      [
        { serviceId: "inworld", at: "2026-10-20T00:00:00.000Z", amount: 9000 },
        { serviceId: "inworld", at: "2026-11-10T00:00:00.000Z", amount: 1000 },
      ],
      1000,
      NOW,
      7,
    );
    expect(reading.kind).toBe("prepaid");
    expect(reading.spentUsd).toBe(5);
    expect(reading.remainingUsd).toBe(5);
    expect(reading.consumedMinutes).toBeCloseTo(1000 / 750);
  });

  it("asks for the character price before spending a prepaid balance", () => {
    const service = serviceById("inworld")!;
    const plan = { ...emptyPlan(), funding: "prepaid" as const, balanceUsd: 10, creditedOn: "2026-11-01" };
    const reading = periodCostReading(service, plan, [], 1000, NOW, 7);
    expect(reading.rateMissing).toBe(true);
    expect(reading.spentUsd).toBeNull();
    expect(reading.remainingUsd).toBeNull();
  });

  it("keeps the headline complete when an unused service has no plan", () => {
    const tavus = serviceById("tavus")!;
    const lemon = serviceById("lemonslice")!;
    const priced = periodCostReading(tavus, applyTier(tavus, "builder", "monthly", emptyPlan()), [], 0, NOW, 7);
    const empty = periodCostReading(lemon, emptyPlan(), [], 0, NOW, 7);
    const used = periodCostReading(lemon, emptyPlan(), [], 2, NOW, 7);
    expect(sumPeriodTotals([priced, empty])).toEqual({ total: priced.totalUsd, partial: false });
    expect(sumPeriodTotals([priced, used]).partial).toBe(true);
    expect(sumPeriodTotals([empty]).total).toBeNull();
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
