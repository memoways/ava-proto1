import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  call: {
    on: vi.fn(), join: vi.fn(async () => {}), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(),
    leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}), getNetworkStats: vi.fn(async () => ({ stats: {}, networkState: "good" })),
  },
  createCallObject: vi.fn(),
  handlers: new Map<string, (event: unknown) => void>(),
  sockets: [] as FakeSocket[],
  generateSpeech: vi.fn(),
  control: vi.fn(async (_input: { control: unknown }) => {}),
  end: vi.fn(async () => {}),
}));
class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(readonly address: string) { fake.sockets.push(this); queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; }
  receive(message: Record<string, unknown>) { this.onmessage?.({ data: JSON.stringify(message) }); }
  commands() { return this.sent.map((message) => message.command); }
}
vi.mock("@daily-co/daily-js", () => ({ default: { createCallObject: (options: unknown) => { fake.createCallObject(options); return fake.call; } } }));
vi.mock("../api", () => ({
  startAvatarSession: vi.fn(async () => ({
    provider: "lemonslice", externalSessionId: "ls-session", roomUrl: "https://ava.daily.co/ava-ls-x",
    meetingToken: "viewer", websocketAddress: "wss://bridge.invalid/s", audioSampleRate: 16_000,
  })),
  endAvatarSession: fake.end,
  controlLemonSliceSession: fake.control,
}));
vi.mock("@/services/tts", () => ({ generateSpeech: fake.generateSpeech }));
vi.mock("@/services/settingsService", () => ({ getTTSSettings: () => ({ outputFormat: "pcm_16000" }) }));
vi.mock("@/services/tts/providerSettings", () => ({ getActiveProviderId: () => "elevenlabs", resolveGradiumSettings: () => ({ outputFormat: "opus" }) }));
import { LemonSliceStreamingAvatarOutput } from "./lemonslice";
import { streamingAvatarDefaults } from "../settings";

class Stream {
  tracks: MediaStreamTrack[] = [];
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
  removeTrack(track: MediaStreamTrack) { this.tracks = this.tracks.filter(t => t !== track); }
}
function track(kind: string) {
  fake.handlers.get("track-started")?.({ participant: { local: false }, type: kind, track: { id: kind, kind, readyState: "live" } });
}
/** 250 ms of raw 16 kHz PCM16 → three audio chunks. */
function speech(samples = 4_000) {
  return { arrayBuffer: async () => new Int16Array(samples).fill(1_000).buffer } as unknown as Blob;
}
const settings = { ...streamingAvatarDefaults.lemonslice, agentId: "agent" };
const socket = () => fake.sockets[fake.sockets.length - 1];

describe("LemonSlice audio-bridge lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); fake.generateSpeech.mockReset(); fake.handlers.clear(); fake.sockets.length = 0;
    vi.stubGlobal("MediaStream", Stream); vi.stubGlobal("WebSocket", FakeSocket);
    fake.call.on.mockImplementation((name, cb) => { fake.handlers.set(name, cb); return fake.call; });
    fake.generateSpeech.mockImplementation(async () => speech());
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function ready(output: LemonSliceStreamingAvatarOutput) {
    const promise = output.prepare({ sessionId: "ava" });
    await vi.advanceTimersByTimeAsync(0); track("video"); track("audio");
    await vi.advanceTimersByTimeAsync(50); await promise;
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    await vi.advanceTimersByTimeAsync(0);
  }

  it("joins the room receive-only and never asks for the microphone", async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const onStreamReady = vi.fn();
    const output = new LemonSliceStreamingAvatarOutput(settings, { onStreamReady }, 1000, 1000);
    await ready(output);
    expect(fake.createCallObject).toHaveBeenCalledWith(expect.objectContaining({ audioSource: false, videoSource: false, startAudioOff: true }));
    expect(fake.call.join).toHaveBeenCalledWith(expect.objectContaining({ url: "https://ava.daily.co/ava-ls-x", token: "viewer", audioSource: false }));
    expect(fake.call.setLocalAudio).toHaveBeenCalledWith(false, { forceDiscardTrack: true });
    expect(socket().address).toBe("wss://bridge.invalid/s");
    expect(onStreamReady).toHaveBeenCalledOnce();
    expect(getUserMedia).not.toHaveBeenCalled();
    await output.dispose();
  });

  it("streams Ava's TTS audio, commits with audio_end and ends on playback_finished", async () => {
    const onSpeakStart = vi.fn(), onSpeakEnd = vi.fn(), onPlaybackStart = vi.fn();
    const output = new LemonSliceStreamingAvatarOutput(settings, { onSpeakStart, onSpeakEnd }, 1000, 1000);
    await ready(output);
    let done = false;
    const result = output.renderText("Je n'en peux plus.", { turnId: "t1", voiceId: "max-voice", characterKey: "max", onPlaybackStart })
      .then((value) => { done = true; return value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.generateSpeech).toHaveBeenCalledWith("Je n'en peux plus.", expect.objectContaining({ voiceId: "max-voice", characterKey: "max" }));
    expect(socket().commands()).toEqual(["audio", "audio", "audio", "audio_end"]);
    expect(socket().sent[0]).toMatchObject({ sampleRate: 16_000, encoding: "PCM16" });
    expect(onSpeakStart).toHaveBeenCalledWith("t1");
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(done).toBe(false);
    socket().receive({ command: "playback_finished", playback_position: 0.25, interrupted: false });
    await expect(result).resolves.toMatchObject({ status: "played", provider: "LemonSlice", started: true });
    expect(onSpeakEnd).toHaveBeenCalledWith("t1");
    await output.dispose();
  });

  it("ignores a playback_finished received before the line is committed", async () => {
    let release!: (blob: Blob) => void;
    fake.generateSpeech
      .mockImplementationOnce(async () => speech())
      .mockImplementationOnce(() => new Promise<Blob>((resolve) => { release = resolve; }));
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    await ready(output);
    let done = false;
    // Over 900 characters: two TTS segments, the second one still synthesizing.
    const sentence = `${"Je ne sais plus quoi faire de ces journées vides ".repeat(10).trim()}.`;
    const result = output.renderText(`${sentence} ${sentence}`).then((value) => { done = true; return value; });
    await vi.advanceTimersByTimeAsync(0);
    socket().receive({ command: "playback_finished", playback_position: 0.2, interrupted: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    release(speech());
    await vi.advanceTimersByTimeAsync(0);
    expect(socket().commands().at(-1)).toBe("audio_end");
    socket().receive({ command: "playback_finished", playback_position: 0.5, interrupted: false });
    await expect(result).resolves.toMatchObject({ status: "played", generatedSegments: 2 });
    await output.dispose();
  });

  it("interrupts mid-line: sends interrupt and reports a started line", async () => {
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    await ready(output);
    const result = output.renderText("Bonjour.");
    await vi.advanceTimersByTimeAsync(0);
    output.interrupt();
    await expect(result).rejects.toMatchObject({ started: true });
    expect(socket().commands()).toContain("interrupt");
    await output.dispose();
  });

  it("stops waiting for Ava's TTS as soon as the line is interrupted", async () => {
    fake.generateSpeech.mockImplementationOnce(() => new Promise<Blob>(() => {}));
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    await ready(output);
    const result = output.renderText("Bonjour.");
    await vi.advanceTimersByTimeAsync(0);
    output.interrupt();
    await expect(result).rejects.toMatchObject({ started: false });
    expect(socket().commands()).not.toContain("audio");
    await output.dispose();
  });

  it("keeps the local TTS fallback when Ava's TTS fails before any audio", async () => {
    fake.generateSpeech.mockRejectedValueOnce(new Error("ElevenLabs TTS error: 500"));
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    await ready(output);
    await expect(output.renderText("Bonjour.")).rejects.toMatchObject({ started: false });
    expect(socket().commands()).not.toContain("audio");
    await output.dispose();
  });

  it("refuses to speak while playback is blocked", async () => {
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    const promise = output.prepare({ sessionId: "ava" });
    await vi.advanceTimersByTimeAsync(0); track("video"); track("audio");
    await vi.advanceTimersByTimeAsync(50); await promise;
    const video = document.createElement("video");
    video.play = vi.fn(async () => { throw new DOMException("blocked", "NotAllowedError"); });
    output.attachMedia(video); await vi.advanceTimersByTimeAsync(0);
    await expect(output.renderText("Bonjour.")).rejects.toMatchObject({ started: false });
    expect(fake.generateSpeech).not.toHaveBeenCalled();
    await output.dispose();
  });

  it("resets the idle timer while the player speaks and nods only on CWM-1", async () => {
    const flash = new LemonSliceStreamingAvatarOutput({ ...settings, listenAction: true }, {}, 1000, 1000);
    await ready(flash);
    flash.setListening(true); flash.setListening(true);
    expect(fake.control.mock.calls.map(([input]) => input.control)).toEqual([{ event: "reset-idle-timeout" }]);
    await flash.dispose();
    fake.control.mockClear();
    const cwm = new LemonSliceStreamingAvatarOutput({ ...settings, model: "cwm-1", listenAction: true }, {}, 1000, 1000);
    await ready(cwm);
    cwm.setListening(true); cwm.setListening(false);
    expect(fake.control.mock.calls.map(([input]) => input.control)).toEqual([
      { event: "reset-idle-timeout" }, { event: "action", value: "listen" },
    ]);
    await cwm.dispose();
  });

  it("terminates the bridge and asks the server to end the session and the room", async () => {
    const output = new LemonSliceStreamingAvatarOutput(settings, {}, 1000, 1000);
    await ready(output);
    const bridge = socket();
    await output.dispose();
    expect(bridge.commands()).toContain("terminate");
    expect(bridge.readyState).toBe(3);
    expect(fake.call.leave).toHaveBeenCalled();
    expect(fake.end).toHaveBeenCalledWith({ provider: "lemonslice", sessionId: "ava", externalSessionId: "ls-session" });
  });

  it("reports a closed bridge as a disconnection without leaking its address", async () => {
    const onDisconnected = vi.fn();
    const output = new LemonSliceStreamingAvatarOutput(settings, { onDisconnected }, 1000, 1000);
    await ready(output);
    socket().onclose?.({ code: 1006 });
    expect(onDisconnected).toHaveBeenCalledWith("bridge_closed");
    expect(JSON.stringify(onDisconnected.mock.calls)).not.toContain("wss://");
    await output.dispose();
  });
});
