import { describe, expect, it } from "vitest";
import { START_BUFFER_MAX_WAIT_MS, START_BUFFER_S, bufferedAheadSeconds } from "./videoPlayback";

describe("bufferedAheadSeconds", () => {
  const media = (ranges: [number, number][], currentTime: number) => ({
    currentTime,
    buffered: { length: ranges.length, start: (i: number) => ranges[i][0], end: (i: number) => ranges[i][1] } as TimeRanges,
  });

  it("measures the buffer after the playhead", () => {
    expect(bufferedAheadSeconds(media([[0, 6]], 0))).toBe(6);
    expect(bufferedAheadSeconds(media([[0, 2], [10, 14]], 11))).toBe(3);
  });

  it("is zero before the first fragment or outside every range", () => {
    expect(bufferedAheadSeconds(media([], 0))).toBe(0);
    expect(bufferedAheadSeconds(media([[0, 2]], 5))).toBe(0);
  });

  it("asks for more than a single short fragment before a cinematic starts", () => {
    expect(START_BUFFER_S).toBeGreaterThanOrEqual(3);
    expect(START_BUFFER_MAX_WAIT_MS).toBeLessThanOrEqual(5_000);
  });
});
