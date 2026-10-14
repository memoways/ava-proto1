import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({ onFrame: null as null | ((samples: Float32Array) => void), capture: { sampleRate: 48000, enabled: vi.fn(), reset: vi.fn(), flush: vi.fn(async () => {}), stop: vi.fn() } }));
vi.mock("@/services/gameAuth", () => ({ authenticatedFunctionFetch: vi.fn(async () => new Response(JSON.stringify({ token: "test-token" }))) }));
vi.mock("../pcmCapture", () => ({ createPcmCapture: vi.fn(async (_stream, _rate, _samples, onFrame) => { fake.onFrame = onFrame; return fake.capture; }), pcmBase64: () => "pcm" }));
vi.mock("@/services/latencyTelemetry", () => ({ recordAudioLatency: vi.fn() }));
import { GradiumSTT } from "./gradiumSTT";
import { AssemblyAISTT } from "./assemblyaiSTT";
import { createPcmCapture } from "../pcmCapture";
class Socket {
  static OPEN = 1; static all: Socket[] = [];
  readyState = 1; onopen: null | (() => void) = null; onmessage: null | ((event: MessageEvent) => void) = null;
  onclose = null; onerror = null; sent: { type: string; flush_id?: number; json_config?: unknown }[] = [];
  constructor() { Socket.all.push(this); queueMicrotask(() => this.onopen?.()); }
  send(raw: string) { const msg = JSON.parse(raw); this.sent.push(msg); if (msg.type === "setup") queueMicrotask(() => this.message({ type: "ready" })); }
  message(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent); }
  close() { this.readyState = 3; }
}
describe("Gradium actual lifecycle and exact flush", () => {
  beforeEach(() => { vi.clearAllMocks(); Socket.all = []; vi.stubGlobal("WebSocket", Socket); });
  afterEach(() => vi.unstubAllGlobals());
  it.each(["gradium", "assemblyai"])("stops a late worklet after %s startup was replaced", async provider => {
    let release!: (capture: typeof fake.capture) => void;
    vi.mocked(createPcmCapture).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const opts = { initialStream: { getTracks: () => [{ stop() {} }] } as unknown as MediaStream };
    const stt = provider === "gradium" ? new GradiumSTT(vi.fn(), opts) : new AssemblyAISTT(vi.fn(), opts);
    const start = stt.start();
    await vi.waitFor(() => expect(createPcmCapture).toHaveBeenCalledOnce());
    await stt.stop();release(fake.capture);
    await expect(start).rejects.toMatchObject({ name: "AbortError" });
    expect(fake.capture.stop).toHaveBeenCalledOnce();expect(stt.isActive).toBe(false);
  });
  it("awaits ready, uses valid delay 10, keeps a live utterance on repeated resume and rejects an old flush", async () => {
    const text = vi.fn(), stop = vi.fn();
    const stt = new GradiumSTT(text, { initialStream: { getTracks: () => [{ stop }] } as unknown as MediaStream });
    await stt.start(); const ws = Socket.all[0];
    expect(createPcmCapture).toHaveBeenCalledWith(expect.anything(), 24000, 1920, expect.any(Function), expect.any(Function));
    expect(ws.sent[0].json_config).toMatchObject({ delay_in_frames: 10 });
    ws.message({ type: "text", text: "premier mot", start_s: 0 }); stt.resume(); ws.message({ type: "text", text: "dernier mot", start_s: 0.2 });
    expect(text.mock.calls.at(-1)).toEqual(["premier mot dernier mot", false]);
    fake.onFrame?.(new Float32Array(1920).fill(0.2));
    let ended = false; const flush = stt.flush().then(() => { ended = true; });
    await vi.waitFor(() => expect(ws.sent.at(-1)?.type).toBe("flush"));
    fake.onFrame?.(new Float32Array(1920).fill(0.8));
    expect(ws.sent.at(-1)?.type).toBe("flush"); // First phoneme of the next utterance is queued.
    ws.message({ type: "flushed", flush_id: 0 });await Promise.resolve();expect(ended).toBe(false);
    ws.message({ type: "flushed", flush_id: 1 });await flush;expect(text.mock.calls.at(-1)).toEqual(["premier mot dernier mot", true]);
    stt.resume();expect(ws.sent.at(-1)?.type).toBe("audio");
    ws.message({ type: "text", text: "ancien", start_s: 0 });
    ws.message({ type: "text", text: "nouveau", start_s: 0.08 });
    const late = ws.onmessage; await stt.stop();late?.({ data: JSON.stringify({ type: "text", text: "périmé" }) } as MessageEvent);
    expect(text.mock.calls.at(-1)).toEqual(["nouveau", false]);expect(fake.capture.stop).toHaveBeenCalledOnce();expect(stop).toHaveBeenCalledOnce();
  });
});
