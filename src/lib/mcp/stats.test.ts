import { describe, expect, it } from "vitest";
import {
  isoDay,
  latencyStats,
  percentile,
  round4,
  sumBy,
  sumGroupBy,
  tally,
  toNumber,
} from "./stats";

describe("latencyStats", () => {
  it("reports percentiles over the values that are present", () => {
    const stats = latencyStats([100, 200, 300, 400, null, undefined]);
    expect(stats).toEqual({
      count: 4,
      min: 100,
      mean: 250,
      p50: 250,
      p90: 370,
      p95: 385,
      max: 400,
    });
  });

  it("returns nulls instead of zeroes when there is no sample", () => {
    expect(latencyStats([null, undefined])).toEqual({
      count: 0,
      min: null,
      mean: null,
      p50: null,
      p90: null,
      p95: null,
      max: null,
    });
  });

  it("keeps a single sample as every percentile", () => {
    expect(percentile([42], 0.9)).toBe(42);
  });
});

describe("tally", () => {
  it("counts values and groups missing ones under a label", () => {
    const rows = [
      { environment: "prod" },
      { environment: null },
      { environment: "prod" },
      { environment: "" },
    ];
    expect(tally(rows, (row) => row.environment)).toEqual({
      prod: 2,
      "non renseigné": 2,
    });
  });
});

describe("sumBy and sumGroupBy", () => {
  it("ignores missing numbers", () => {
    const rows = [
      { cost: 1.5 },
      { cost: null },
      { cost: 2 },
    ];
    expect(sumBy(rows, (row) => row.cost)).toBe(3.5);
  });

  it("keeps a group that only has missing values at zero", () => {
    const rows = [
      { day: "2026-10-12", cost: 1 },
      { day: "2026-10-12", cost: 2 },
      { day: "2026-10-11", cost: null },
    ];
    expect(sumGroupBy(rows, (row) => row.day, (row) => row.cost)).toEqual({
      "2026-10-12": 3,
      "2026-10-11": 0,
    });
  });
});

describe("toNumber, round4 and isoDay", () => {
  it("accepts numeric strings and rejects junk", () => {
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("abc")).toBeNull();
    expect(toNumber("")).toBeNull();
  });

  it("rounds money to four decimals", () => {
    expect(round4(0.123456)).toBe(0.1235);
  });

  it("reduces a timestamp to its UTC day", () => {
    expect(isoDay("2026-10-12T06:58:00Z")).toBe("2026-10-12");
    expect(isoDay(null)).toBe("unknown");
    expect(isoDay("not a date")).toBe("unknown");
  });
});
