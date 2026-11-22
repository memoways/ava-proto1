import { beforeEach, describe, expect, it, vi } from "vitest";

const resume = vi.fn(async () => {});
const ctx = {
  state: "running" as string,
  currentTime: 1,
  resume,
  createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
  createGain: vi.fn(() => ({
    gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  })),
  destination: {},
};
let shared: typeof ctx | null = ctx;

vi.mock("@/services/audioPlayback", () => ({
  getSharedAudioContext: () => shared,
  audioContextNeedsResume: (c: { state: string } | null) => Boolean(c) && c!.state !== "running" && c!.state !== "closed",
}));

import { attachVideoGain, canRouteThroughGain, getVideoGain, isIosWebKit, keepVideoGainAudible } from "./videoGain";

const video = () => document.createElement("video");

describe("canRouteThroughGain", () => {
  it("accepts MSE playback and same-origin files only", () => {
    expect(canRouteThroughGain("hls.js", "blob:x", "https://app.test")).toBe(true);
    expect(canRouteThroughGain("native-file", "/v/a.mp4", "https://app.test")).toBe(true);
    expect(canRouteThroughGain("native-file", "https://cdn.test/a.mp4", "https://app.test")).toBe(false);
    expect(canRouteThroughGain("native-hls", "https://cdn.test/a.m3u8", "https://app.test")).toBe(false);
    expect(canRouteThroughGain("pending", "x", "https://app.test")).toBe(false);
  });
});

describe("isIosWebKit", () => {
  it("detects iPhone, iPad and iPadOS posing as a Mac, not desktop or Android", () => {
    expect(isIosWebKit({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(true);
    expect(isIosWebKit({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(true);
    expect(isIosWebKit({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(true);
    expect(isIosWebKit({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe(false);
    expect(isIosWebKit({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130", maxTouchPoints: 5 })).toBe(false);
  });
});

describe("attachVideoGain", () => {
  beforeEach(() => {
    ctx.state = "running";
    ctx.createMediaElementSource.mockClear();
    resume.mockClear();
    shared = ctx;
  });

  it("connects an element once and reuses the gain", async () => {
    const el = video();
    const first = await attachVideoGain(el);
    expect(first).not.toBeNull();
    expect(await attachVideoGain(el)).toBe(first);
    expect(getVideoGain(el)).toBe(first);
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
    first!.setLinear(0.178);
  });

  it("resumes an interrupted context, and refuses to connect while it cannot run", async () => {
    ctx.state = "interrupted";
    const el = video();
    expect(await attachVideoGain(el)).toBeNull();
    expect(resume).toHaveBeenCalled();
    expect(ctx.createMediaElementSource).not.toHaveBeenCalled();
    expect(getVideoGain(el)).toBeNull();
  });

  it("returns null without Web Audio, and never retries a failed connection", async () => {
    shared = null;
    expect(await attachVideoGain(video())).toBeNull();
    shared = ctx;
    ctx.createMediaElementSource.mockImplementationOnce(() => { throw new Error("already connected"); });
    const el = video();
    expect(await attachVideoGain(el)).toBeNull();
    expect(await attachVideoGain(el)).toBeNull();
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  it("keeps a routed element audible by resuming a stopped context", async () => {
    const el = video();
    await attachVideoGain(el);
    ctx.state = "suspended";
    keepVideoGainAudible(el);
    expect(resume).toHaveBeenCalled();
  });
});
