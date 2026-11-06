import { describe, expect, it } from "vitest";
import { AvSyncController, DEFAULT_AV_SYNC, readPlayoutOffset } from "./avSync";

const options = { ...DEFAULT_AV_SYNC, window: 3, cooldownMs: 1_000 };
/** Feeds the same offset `count` times, one sample per 100 ms from `start`. */
const feed = (sync: AvSyncController, offset: number, start: number, count = 3) => {
  let result = null;
  for (let i = 0; i < count; i++) result = sync.observe(offset, start + i * 100) ?? result;
  return result;
};

describe("AvSyncController", () => {
  it("starts with the same floor on both tracks", () => {
    expect(new AvSyncController(options).targets).toEqual({ audioMs: 400, videoMs: 400 });
  });

  it("leaves an offset within tolerance alone", () => {
    const sync = new AvSyncController(options);
    expect(feed(sync, 40, 0)).toBeNull();
    expect(sync.isSettled(1_000)).toBe(true);
  });

  it("delays the track ahead, part of the offset at a time, after a median of samples", () => {
    const sync = new AvSyncController(options);
    expect(sync.observe(1_000, 0)).toBeNull();
    expect(sync.observe(1_000, 100)).toBeNull();
    expect(sync.observe(1_000, 200)).toEqual({ audioMs: 400, videoMs: 1_100 });
    expect(sync.isSettled(300)).toBe(false);
    // Cooling down: the buffers are still moving.
    expect(feed(sync, 300, 300)).toBeNull();
    // Image still 300 ms ahead: 210 ms more on the video.
    expect(feed(sync, 300, 1_300)).toEqual({ audioMs: 400, videoMs: 1_310 });
  });

  it("delays the voice when the image lags, and ignores a single outlier", () => {
    const sync = new AvSyncController(options);
    expect(sync.observe(-500, 0)).toBeNull();
    expect(sync.observe(2_000, 100)).toBeNull();
    expect(sync.observe(-500, 200)).toEqual({ audioMs: 750, videoMs: 400 });
  });

  it("never shifts one track by more than the limit", () => {
    const sync = new AvSyncController({ ...options, gain: 1, maxShiftMs: 1_000 });
    expect(feed(sync, 5_000, 0)).toEqual({ audioMs: 400, videoMs: 1_400 });
  });

  it("stops when the browser keeps undoing its corrections", () => {
    const sync = new AvSyncController(options);
    let now = 0;
    for (let step = 0; step < 6; step++) {
      feed(sync, 800, now);
      now += 2_000;
    }
    expect(sync.stopped).toBe(true);
    expect(sync.isSettled(now)).toBe(true);
    const frozen = sync.targets;
    feed(sync, 800, now);
    expect(sync.targets).toEqual(frozen);
  });
});

describe("readPlayoutOffset", () => {
  const pc = (reports: Record<string, unknown>[]) =>
    ({ getStats: async () => new Map(reports.map((r, i) => [String(i), r])) }) as unknown as RTCPeerConnection;

  it("returns video minus audio playout instant", async () => {
    await expect(readPlayoutOffset(pc([
      { type: "inbound-rtp", kind: "audio", estimatedPlayoutTimestamp: 1_000 },
      { type: "inbound-rtp", kind: "video", estimatedPlayoutTimestamp: 1_750.4 },
    ]))).resolves.toBe(750);
  });

  it("is null until both tracks expose a timestamp", async () => {
    await expect(readPlayoutOffset(pc([
      { type: "inbound-rtp", kind: "audio", estimatedPlayoutTimestamp: 1_000 },
      { type: "inbound-rtp", kind: "video" },
    ]))).resolves.toBeNull();
  });
});
