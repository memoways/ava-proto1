import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFunctionFetch = vi.hoisted(() => vi.fn());

vi.mock("./latencyTelemetry", () => ({ recordAudioLatency: vi.fn() }));
vi.mock("./gameAuth", () => ({ authenticatedFunctionFetch }));

import {
  buildDeepgramWebSocketUrl,
  getDeepgramToken,
  getDeepgramWebSocketProtocols,
  DeepgramSTT,
} from "./deepgramSTT";

describe("Deepgram token diagnostics", () => {
  beforeEach(() => authenticatedFunctionFetch.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("reports capture readiness only after a delayed WebSocket opens and recording starts", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({ key: "temporary-jwt" })));
    const milestones: string[] = [];
    const startRecording = vi.fn(() => milestones.push("recorder_started"));
    const sockets: TestSocket[] = [];
    class TestSocket {
      static OPEN = 1;
      readyState = 0;
      onopen?: () => void;
      constructor() { sockets.push(this); }
      close() { this.readyState = 3; }
    }
    class TestRecorder {
      static isTypeSupported() { return true; }
      state = "recording";
      start = startRecording;
      stop() { this.state = "inactive"; }
    }
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubGlobal("MediaRecorder", TestRecorder);
    const stopTrack = vi.fn();
    const stt = new DeepgramSTT(vi.fn(), {
      initialStream: { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream,
      onVoiceObservation: (name) => milestones.push(name),
    });
    try {
      await stt.start();
      expect(milestones).toEqual([]);
      expect(startRecording).not.toHaveBeenCalled();
      sockets[0].readyState = TestSocket.OPEN;
      sockets[0].onopen!();
      expect(milestones).toEqual(["recorder_started", "capture_started", "capture_ready"]);
      expect(startRecording).toHaveBeenCalledWith(150);
    } finally { stt.stop(); }
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("turns an upstream grant permission failure into an actionable message", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({
      code: "DEEPGRAM_GRANT_PERMISSION",
      error: "Deepgram API key needs Member permission for temporary tokens",
    }), { status: 502, headers: { "Content-Type": "application/json" } }));

    await expect(getDeepgramToken()).rejects.toThrow(/permission Member/i);
  });

  it("authenticates temporary JWTs with the Bearer WebSocket subprotocol", () => {
    expect(getDeepgramWebSocketProtocols("temporary-jwt")).toEqual([
      "bearer",
      "temporary-jwt",
    ]);
  });

  it("uses the shared nova-3 baseline when the proxy omits optional metadata", async () => {
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({
      key: "temporary-jwt",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(getDeepgramToken()).resolves.toEqual({
      key: "temporary-jwt",
      model: "nova-3",
      language: "fr",
    });
  });

  it("builds the live stream from the effective token configuration", () => {
    const url = new URL(buildDeepgramWebSocketUrl({ model: "nova-3", language: "fr" }));

    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v1/listen");
    expect(url.searchParams.get("model")).toBe("nova-3");
    expect(url.searchParams.get("language")).toBe("fr");
    expect(url.searchParams.get("interim_results")).toBe("true");
    expect(url.searchParams.get("endpointing")).toBe("false");
    expect(url.searchParams.getAll("keyterm")).toEqual([]);
  });

  it("appends each dictionary term as a repeated keyterm query param", () => {
    const url = new URL(
      buildDeepgramWebSocketUrl(
        { model: "nova-3", language: "fr" },
        { keyterms: ["Ava", "Protogyny", "Ulrich Fischer", "  ", ""] },
      ),
    );
    expect(url.searchParams.getAll("keyterm")).toEqual([
      "Ava",
      "Protogyny",
      "Ulrich Fischer",
    ]);
  });

  it("caps keyterms at Deepgram's 100-term limit", () => {
    const terms = Array.from({ length: 150 }, (_, i) => `term${i}`);
    const url = new URL(
      buildDeepgramWebSocketUrl({ model: "nova-3", language: "fr" }, { keyterms: terms }),
    );
    expect(url.searchParams.getAll("keyterm")).toHaveLength(100);
  });
});


describe("Deepgram delayed microphone tail", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it.each([false, true])("waits for the tail response with a post-flush interim=%s", async (postFlushInterim) => {
    vi.useFakeTimers();
    authenticatedFunctionFetch.mockResolvedValue(new Response(JSON.stringify({ key: "temporary" })));
    const sockets: Socket[] = [];
    class Socket {
      static OPEN = 1; readyState = 1;
      onopen?: () => void; onmessage?: (event: MessageEvent) => void;
      sent: unknown[] = [];
      constructor() { sockets.push(this); }
      send(value: unknown) { this.sent.push(value); }
      close() { this.readyState = 3; }
      message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent); }
    }
    class Recorder extends EventTarget {
      static isTypeSupported() { return true; }
      state = "recording"; ondataavailable?: (event: { data: Blob }) => void;
      start() {} stop() { this.state = "inactive"; }
      requestData() { const data = new Blob(["last syllables"]); this.ondataavailable?.({ data }); this.dispatchEvent(new Event("dataavailable")); }
    }
    vi.stubGlobal("WebSocket", Socket); vi.stubGlobal("MediaRecorder", Recorder);
    const text = vi.fn();
    const stt = new DeepgramSTT(text, { initialStream: { getTracks: () => [{ stop() {} }] } as unknown as MediaStream });
    stt.setManualMode(true); await stt.start(); const ws = sockets[0]; ws.onopen?.();
    await vi.advanceTimersByTimeAsync(10);
    ws.message({ type: "Results", is_final: false, channel: { alternatives: [{ transcript: "Je voudrais comprendre" }] } });
    const flush = stt.flush(); await vi.advanceTimersByTimeAsync(100);
    if (postFlushInterim) ws.message({ type: "Results", is_final: false, channel: { alternatives: [{ transcript: "Je voudrais comprendre le" }] } });
    await vi.advanceTimersByTimeAsync(500);
    expect(text.mock.calls.filter(([, final]) => final)).toEqual([]);
    ws.message({ type: "Results", is_final: true, from_finalize: true, channel: { alternatives: [{ transcript: "Je voudrais comprendre le dernier mot" }] } });
    await vi.advanceTimersByTimeAsync(25); await flush;
    expect(text.mock.calls.at(-1)).toEqual(["Je voudrais comprendre le dernier mot", true]);
    expect(ws.sent[0]).toBeInstanceOf(Blob); expect(ws.sent[1]).toBe(JSON.stringify({ type: "Finalize" })); stt.stop();
  });
});
