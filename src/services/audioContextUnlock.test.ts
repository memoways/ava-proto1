import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  state: string = "running";
  sampleRate = 48000;
  destination = {};
  started = 0;
  resume = vi.fn(() => { this.state = "running"; return Promise.resolve(); });
  private listeners: Array<() => void> = [];
  constructor() { FakeAudioContext.last = this; }
  addEventListener(_name: string, listener: () => void) { this.listeners.push(listener); }
  emitState(state: string) { this.state = state; this.listeners.forEach(listener => listener()); }
  createBuffer() { return {}; }
  createBufferSource() {
    return { buffer: null, connect: () => {}, start: () => { this.started += 1; } };
  }
}

async function loadModule() {
  vi.resetModules();
  return import("./audioPlayback");
}

describe("shared AudioContext on iOS", () => {
  beforeEach(() => {
    FakeAudioContext.last = null;
    vi.stubGlobal("AudioContext", FakeAudioContext);
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resumes an interrupted context and starts the unlock buffer inside the gesture", async () => {
    const audio = await loadModule();
    await audio.unlockAudioPlayback();
    const ctx = FakeAudioContext.last!;
    ctx.state = "interrupted";
    ctx.resume.mockClear();
    const pending = audio.unlockAudioPlayback();
    // Synchronous part of the gesture: resume requested and a buffer started.
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.started).toBe(2);
    await pending;
    expect(audio.getAudioContextState()).toBe("running");
  });

  it("treats suspended and interrupted as needing a resume, never running or closed", async () => {
    const { audioContextNeedsResume } = await loadModule();
    expect(audioContextNeedsResume({ state: "suspended" } as AudioContext)).toBe(true);
    expect(audioContextNeedsResume({ state: "interrupted" } as unknown as AudioContext)).toBe(true);
    expect(audioContextNeedsResume({ state: "running" } as AudioContext)).toBe(false);
    expect(audioContextNeedsResume({ state: "closed" } as AudioContext)).toBe(false);
    expect(audioContextNeedsResume(null)).toBe(false);
  });

  it("re-unlocks on a gesture only while the context is not running", async () => {
    const audio = await loadModule();
    await audio.unlockAudioPlayback();
    const ctx = FakeAudioContext.last!;
    const target = new EventTarget() as unknown as Document;
    const uninstall = audio.installAudioGestureUnlock(target);
    ctx.resume.mockClear();
    target.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resume).not.toHaveBeenCalled();
    ctx.state = "interrupted";
    target.dispatchEvent(new Event("pointerdown"));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    uninstall();
    ctx.state = "suspended";
    target.dispatchEvent(new Event("click"));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("tries to resume as soon as iOS interrupts the context", async () => {
    const audio = await loadModule();
    await audio.unlockAudioPlayback();
    const ctx = FakeAudioContext.last!;
    ctx.resume.mockClear();
    ctx.emitState("interrupted");
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});
