import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// iOS Safari, hands-free: `<audio>.play()` is refused outside a gesture while
// the shared AudioContext, unlocked at "Appeler", keeps running (session feb8eb9b).

class FakeSource {
  static autoEnd = true;
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn(() => { if (FakeSource.autoEnd) setTimeout(() => this.onended?.(), 0); });
  stop = vi.fn();
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  state = "running";
  sampleRate = 48000;
  destination = {};
  sources: FakeSource[] = [];
  resume = vi.fn(() => Promise.resolve());
  constructor() { FakeAudioContext.last = this; }
  addEventListener() {}
  createBuffer() { return {}; }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s; }
  decodeAudioData(_bytes: ArrayBuffer, ok: (b: unknown) => void) { ok({ duration: 1 }); return undefined; }
}

class RefusingAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  pause = vi.fn();
  play = vi.fn(() => Promise.reject(new DOMException("The request is not allowed", "NotAllowedError")));
}

async function loadModule() {
  vi.resetModules();
  return import("./audioPlayback");
}

describe("autoplay refusal of <audio> (iOS hands-free)", () => {
  let audios: RefusingAudio[];
  beforeEach(() => {
    audios = [];
    FakeAudioContext.last = null;
    vi.stubGlobal("AudioContext", FakeAudioContext);
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    vi.stubGlobal("Audio", vi.fn(() => { const a = new RefusingAudio(); audios.push(a); return a; }));
    FakeSource.autoEnd = true;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:mp3") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("plays the same speech through the unlocked AudioContext, then skips <audio> on later turns", async () => {
    const audio = await loadModule();
    await audio.unlockAudioPlayback();
    const onStart = vi.fn();

    const first = await audio.playAudioBlobRobust(new Blob(["mp3"]), 5_000, onStart);
    expect(first.status).toBe("played");
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(audios).toHaveLength(1);
    expect(audio.isMediaElementAutoplayBlocked()).toBe(true);
    // Unlock buffer + the speech.
    expect(FakeAudioContext.last!.sources).toHaveLength(2);

    const second = await audio.playAudioBlobRobust(new Blob(["mp3"]), 5_000);
    expect(second.status).toBe("played");
    expect(audios).toHaveLength(1);
  });

  it("stops the Web Audio speech on barge-in", async () => {
    const audio = await loadModule();
    audio.noteMediaElementAutoplayBlocked();
    const controller = new AbortController();
    FakeSource.autoEnd = false;
    const pending = audio.playAudioBlobWebAudio(new Blob(["mp3"]), () => controller.abort(), controller.signal);
    const result = await pending;
    expect(result.status).toBe("failed");
    expect(result.errorInfo?.type).toBe("aborted");
  });

  it("does not hide a refusal when Web Audio is missing", async () => {
    vi.stubGlobal("AudioContext", undefined);
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    const audio = await loadModule();
    const result = await audio.playAudioBlobRobust(new Blob(["mp3"]), 5_000);
    expect(result.status).toBe("failed");
    expect(result.errorInfo?.type).toBe("not_allowed");
  });
});
