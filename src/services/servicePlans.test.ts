import { describe, expect, it } from "vitest";
import {
  applyTier,
  billingWindow,
  emptyPlan,
  parseServicePlans,
  periodCostReading,
  planSnapshot,
  quotaWindow,
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
    expect(snapshot.used).toBe(440);
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
    expect(snapshot.overageUnits).toBe(340);
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
    expect(reading.consumedMinutes).toBe(1.5);
    expect(reading.minutesAreEstimate).toBe(true);
    expect(reading.subscriptionUsd).toBeCloseTo(22 / 30);
    expect(reading.remainingUnits).toBe(121000 - 660);
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

describe("yearly ElevenLabs Creator", () => {
  const service = serviceById("elevenlabs")!;
  const annual = {
    ...applyTier(service, "creator", "yearly", emptyPlan()),
    startedOn: "2026-11-27",
    renewsOn: "2027-11-27",
    firstYearFeeUsd: 107.02,
    renewalFeeUsd: 237.82,
  };
  const at = (day: string) => new Date(`${day}T12:00:00.000Z`);
  const call = (day: string, amount: number, model?: string): UsageEvent => ({
    serviceId: "elevenlabs", at: at(day).toISOString(), amount, model,
  });
  const window = (plan: typeof annual, day: string) => {
    const { start, end } = quotaWindow(plan, at(day));
    return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
  };

  it("compares the allowance with one month, anchored on the start day", () => {
    expect(window(annual, "2026-11-27")).toEqual(["2026-11-27", "2026-12-27"]);
    expect(window(annual, "2027-03-02")).toEqual(["2027-02-27", "2027-03-27"]);
    const snapshot = planSnapshot(
      service,
      annual,
      [call("2026-11-28", 1000, "eleven_v4_turbo"), call("2026-12-28", 2000, "eleven_v4_turbo")],
      at("2026-12-29"),
      false,
    );
    expect(snapshot.used).toBe(440);
    expect(snapshot.included).toBe(121_000);
  });

  it("keeps a start on the 31st through shorter months", () => {
    const plan = { ...annual, startedOn: "2026-01-31", renewsOn: "2027-01-31" };
    expect(window(plan, "2026-02-15")).toEqual(["2026-01-31", "2026-02-28"]);
    expect(window(plan, "2026-02-28")).toEqual(["2026-02-28", "2026-03-31"]);
    expect(window(plan, "2026-04-30")).toEqual(["2026-04-30", "2026-05-31"]);
  });

  it("anchors on the renewal day when the start is not typed", () => {
    expect(window({ ...annual, startedOn: null }, "2027-01-10")).toEqual(["2026-12-27", "2027-01-27"]);
  });

  it("leaves a monthly plan on its renewal date", () => {
    const monthly = { ...annual, cadence: "monthly" as const, startedOn: "2026-11-02", renewsOn: "2026-12-05" };
    expect(window(monthly, "2026-11-22")).toEqual(["2026-11-05", "2026-12-05"]);
  });

  it("spreads the discounted first year, then the renewal amount", () => {
    const first = planSnapshot(service, annual, [], at("2026-11-28"), false);
    expect(first.fixedUsd).toBeCloseTo(107.02 / 12);
    expect(first.spend).toMatchObject({ count: 1, totalUsd: 107.02, includesUpcoming: false });
    const second = planSnapshot(service, annual, [], at("2027-11-27"), false);
    expect(second.fixedUsd).toBeCloseTo(237.82 / 12);
    expect(second.spend?.count).toBe(2);
    expect(second.spend?.totalUsd).toBeCloseTo(344.84);
    const third = planSnapshot(service, { ...annual, renewsOn: "2029-11-27" }, [], at("2028-12-01"), false);
    expect(third.spend?.totalUsd).toBeCloseTo(107.02 + 2 * 237.82);
  });

  it("does not invent a missing renewal amount", () => {
    const plan = { ...annual, renewalFeeUsd: null };
    expect(planSnapshot(service, plan, [], at("2026-12-01"), false).spend?.totalUsd).toBe(107.02);
    const later = planSnapshot(service, plan, [], at("2027-12-01"), false);
    expect(later.fixedUsd).toBeNull();
    expect(later.spend?.totalUsd).toBeNull();
  });

  it("does not count the end date of a stopped year as an invoice", () => {
    const plan = { ...annual, account: "cancelled" as const, endedOn: "2027-11-27" };
    expect(planSnapshot(service, plan, [], at("2028-02-01"), false).spend?.totalUsd).toBe(107.02);
  });

  it("keeps the old monthly equivalent while no yearly amount is typed", () => {
    const plan = { ...annual, firstYearFeeUsd: null, renewalFeeUsd: null };
    const snapshot = planSnapshot(service, plan, [], at("2026-12-01"), false);
    expect(snapshot.fixedUsd).toBe(18.33);
    expect(snapshot.spend?.totalUsd).toBeCloseTo(18.33 * 12);
  });

  it("charges each model its own credits and flags an unknown one at the highest rate", () => {
    const calls = [
      call("2026-11-28", 1000, "eleven_v4_turbo"),
      call("2026-11-28", 1000, "eleven_flash_v2_5"),
      call("2026-11-28", 1000, "eleven_multilingual_v2"),
      call("2026-11-28", 500),
      call("2026-11-28", 500, "eleven_future"),
    ];
    const reading = periodCostReading(service, annual, calls, calls, at("2026-11-29"), 7);
    expect(reading.consumedUnits).toBe(220 + 220 + 440 + 440);
    expect(reading.consumedMinutes).toBe(4);
    expect(reading.unknownModelChars).toBe(1000);
    expect(reading.subscriptionUsd).toBeCloseTo((107.02 / 12) * (7 / 30));
    expect(reading.remainingMinutes).toBeNull();
    expect(reading.renewsOn).toBe("2027-11-27");
  });

  it("shows the monthly capacity of each model family", () => {
    const snapshot = planSnapshot(service, annual, [], at("2026-11-28"), false);
    expect(snapshot.capacity.map((family) => Math.round(family.includedMinutes!))).toEqual([550, 275]);
    expect(snapshot.includedMinutes).toBeNull();
  });

  it("prices a prepaid balance per character, whatever the model", () => {
    const plan = { ...emptyPlan(), funding: "prepaid" as const, balanceUsd: 10, creditedOn: "2026-11-01", usdPerUnit: 0.001 };
    const snapshot = planSnapshot(service, plan, [call("2026-11-10", 1000, "eleven_v4_turbo")], NOW, false);
    expect(snapshot.spentUsd).toBe(1);
    expect(snapshot.capacity).toEqual([]);
    expect(snapshot.usedMinutes).toBe(1);
  });

  it("reads back the two yearly amounts", () => {
    const parsed = parseServicePlans({ plans: { elevenlabs: annual } });
    expect(parsed.elevenlabs).toMatchObject({ firstYearFeeUsd: 107.02, renewalFeeUsd: 237.82 });
  });
});
