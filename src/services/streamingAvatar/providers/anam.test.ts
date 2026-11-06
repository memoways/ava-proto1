import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const talks: { chunks: [string, boolean][]; correlationId: string }[] = [];
  const peer = { current: null as null | { getReceivers: () => unknown[]; getStats: () => Promise<Map<string, unknown>> } };
  const client = {
    streamingClient: { getPeerConnection: () => peer.current },
    addListener: vi.fn((name: string, cb: (...args: unknown[]) => void) => { handlers.set(name, cb); }),
    stream: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
    isStreaming: vi.fn(() => true),
    interruptPersona: vi.fn(),
    sendDirectorNoteCue: vi.fn(),
    stopStreaming: vi.fn(async () => {}),
    createTalkMessageStream: vi.fn(() => {
      const talk = { chunks: [] as [string, boolean][], correlationId: `corr-${talks.length + 1}` };
      talks.push(talk);
      return {
        getCorrelationId: () => talk.correlationId,
        streamMessageChunk: vi.fn(async (text: string, end: boolean) => { talk.chunks.push([text, end]); }),
      };
    }),
  };
  return { handlers, talks, client, peer, recordAvatarAvSync: vi.fn(), createClient: vi.fn((_token: string, _options?: unknown) => client) };
});
vi.mock("@anam-ai/js-sdk", () => ({
  createClient: fake.createClient,
  AnamEvent: {
    MESSAGE_STREAM_EVENT_RECEIVED: "MESSAGE_STREAM_EVENT_RECEIVED",
    TALK_STREAM_INTERRUPTED: "TALK_STREAM_INTERRUPTED",
    MESSAGE_DELIVERY_FAILED: "MESSAGE_DELIVERY_FAILED",
    CONNECTION_CLOSED: "CONNECTION_CLOSED",
    SESSION_READY: "SESSION_READY",
  },
  MessageRole: { USER: "user", PERSONA: "persona" },
}));
vi.mock("../../voiceTelemetry", () => ({ recordAvatarAvSync: fake.recordAvatarAvSync }));
vi.mock("../api", () => ({
  startAvatarSession: vi.fn(async () => ({ provider: "anam", externalSessionId: "binding", sessionToken: "ephemeral" })),
  endAvatarSession: vi.fn(async () => {}),
}));
import { AnamStreamingAvatarOutput } from "./anam";
import { endAvatarSession, startAvatarSession } from "../api";
import { streamingAvatarDefaults } from "../settings";
import { DEFAULT_AV_SYNC as avSync } from "../avSync";

class Stream {
  tracks: MediaStreamTrack[] = [];
  constructor(tracks: MediaStreamTrack[] = []) { this.tracks = [...tracks]; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
}
const track = (kind: string) => ({ id: kind, kind, readyState: "live" }) as unknown as MediaStreamTrack;
const settings = {
  ...streamingAvatarDefaults.anam,
  avatarId: "30fa96d0-26c4-4e55-94a0-517025942e18",
  voiceId: "6bfbe25a-979d-40f3-a92b-5394170af54b",
};
const warmUp = { maxWaitMs: 50, settleMs: 0, pollMs: 1, steadySamples: 2 };
/**
 * Fake peer connection: video decodes `fps` frames per second, audio flows unless `audio` is false.
 * `offset` (video minus audio playout, ms) reads the receivers' targets: delaying the video by
 * N ms brings the image N ms back, as the browser does.
 */
const peerConnection = ({ fps = 25, audio = true, freezes = (): number => 0, offset = null as null | number, level = null as null | (() => number) } = {}) => {
  const startedAt = performance.now();
  const receivers = [
    { track: { kind: "audio" }, jitterBufferTarget: null as number | null },
    { track: { kind: "video" }, jitterBufferTarget: null as number | null },
  ];
  let calls = 0;
  return {
    receivers,
    getReceivers: () => receivers,
    getStats: async () => {
      calls++;
      const elapsed = performance.now() - startedAt;
      return new Map<string, unknown>([
        ["v", {
          type: "inbound-rtp", kind: "video", framesDecoded: Math.floor((elapsed * fps) / 1000), freezeCount: freezes(),
          ...(offset === null ? {} : { estimatedPlayoutTimestamp: 1_000_000 + offset - Number(receivers[1].jitterBufferTarget ?? 0) }),
        }],
        ["a", {
          type: "inbound-rtp", kind: "audio", packetsReceived: audio ? calls : 1, ...(level ? { audioLevel: level() } : {}),
          ...(offset === null ? {} : { estimatedPlayoutTimestamp: 1_000_000 - Number(receivers[0].jitterBufferTarget ?? 0) }),
        }],
      ]);
    },
  };
};
const anam = (overrides = {}, callbacks = {}, timing = warmUp) =>
  new AnamStreamingAvatarOutput({ ...settings, ...overrides }, callbacks, 1000, 1000, timing);
const sessionReady = () => fake.handlers.get("SESSION_READY")?.("anam-session");
/** jsdom never decodes a frame: report one as soon as playback is asked for. */
const videoWithFrame = () => {
  const video = document.createElement("video") as HTMLVideoElement;
  let paused = true;
  Object.defineProperty(video, "paused", { get: () => paused });
  video.play = vi.fn(async () => { paused = false; });
  document.body.append(video);
  video.requestVideoFrameCallback = vi.fn((cb: VideoFrameRequestCallback) => { queueMicrotask(() => cb(0, {} as VideoFrameCallbackMetadata)); return 1; });
  return video;
};
const persona = (content: string, extra: Record<string, unknown> = {}) =>
  fake.handlers.get("MESSAGE_STREAM_EVENT_RECEIVED")?.({ id: "m", content, role: "persona", endOfSpeech: false, interrupted: false, ...extra });

describe("Anam text-mode lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fake.handlers.clear(); fake.talks.length = 0; fake.peer.current = null;
    vi.stubGlobal("MediaStream", Stream);
    fake.client.stream.mockImplementation(async () => [new Stream([track("video")]), new Stream([track("audio")])]);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  async function ready(callbacks = {}) {
    const output = anam({}, callbacks);
    await output.prepare({ sessionId: "ava" });
    sessionReady();
    output.attachMedia(videoWithFrame());
    return output;
  }

  it("never opens or publishes the microphone", async () => {
    const output = await ready();
    expect(startAvatarSession).toHaveBeenCalledWith(expect.objectContaining({ provider: "anam", anam: settings }));
    expect(fake.createClient).toHaveBeenCalledWith("ephemeral", expect.objectContaining({ disableInputAudio: true }));
    // Client metrics stay on so Anam (and its Lab Sessions page) gets the connection telemetry.
    const options = fake.createClient.mock.calls[0][1] as { metrics?: { disableClientMetrics?: boolean } };
    expect(options.metrics?.disableClientMetrics).toBeUndefined();
    expect(fake.client.stream).toHaveBeenCalledWith();
    await output.dispose();
  });

  it("is ready only with both audio and video tracks", async () => {
    fake.client.stream.mockImplementation(async () => [new Stream([track("video")])]);
    const onStreamReady = vi.fn();
    const output = new AnamStreamingAvatarOutput(settings, { onStreamReady }, 1000, 1000);
    await expect(output.prepare({ sessionId: "ava" })).rejects.toThrow(/tracks missing/);
    expect(onStreamReady).not.toHaveBeenCalled();
    await output.dispose();
  });

  it("speaks plain text with a face-only cue and ends on the persona end of speech", async () => {
    const onSpeakStart = vi.fn(), onSpeakEnd = vi.fn(), onTranscript = vi.fn(), onPlaybackStart = vi.fn();
    const output = await ready({ onSpeakStart, onSpeakEnd, onTranscript });
    const speech = output.renderText("Je ne sais pas.", { turnId: "turn", onPlaybackStart });
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["Je ne sais pas.", true]]));
    expect(fake.client.sendDirectorNoteCue).toHaveBeenCalledWith("sad", { atSeconds: 0 });
    fake.handlers.get("MESSAGE_STREAM_EVENT_RECEIVED")?.({ id: "u", content: "hors tour", role: "user", endOfSpeech: true, interrupted: false });
    expect(onSpeakStart).not.toHaveBeenCalled();
    persona("Je ne sais ");
    persona("pas.", { endOfSpeech: true });
    await expect(speech).resolves.toMatchObject({ status: "played", provider: "Anam", started: true });
    expect(onSpeakStart).toHaveBeenCalledWith("turn"); expect(onSpeakEnd).toHaveBeenCalledWith("turn");
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(onTranscript).toHaveBeenCalledWith("Je ne sais pas.", "turn");
    await output.dispose();
  });

  it("sends no tag when the cue is off", async () => {
    const output = anam({ speakingCue: "none" });
    await output.prepare({ sessionId: "ava" });
    sessionReady(); output.attachMedia(videoWithFrame());
    const speech = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["Bonjour.", true]]));
    expect(fake.client.sendDirectorNoteCue).not.toHaveBeenCalled();
    persona("Bonjour.", { endOfSpeech: true });
    await speech; await output.dispose();
  });

  it("still speaks when the cue cannot be sent", async () => {
    fake.client.sendDirectorNoteCue.mockImplementationOnce(() => { throw new Error("data channel closed"); });
    const output = await ready();
    const speech = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["Bonjour.", true]]));
    persona("Bonjour.", { endOfSpeech: true });
    await expect(speech).resolves.toMatchObject({ status: "played" });
    await output.dispose();
  });

  it("holds the opening line until the session is ready and a frame is shown, once", async () => {
    const onMediaDiagnostics = vi.fn();
    const output = anam({}, { onMediaDiagnostics });
    await output.prepare({ sessionId: "ava" });
    output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fake.talks).toHaveLength(0);
    sessionReady();
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "warm_up", warmUpComplete: true }));
    persona("Bonjour.", { endOfSpeech: true });
    await opening;
    const next = output.renderText("Encore.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(2));
    persona("Encore.", { endOfSpeech: true });
    await next;
    expect(onMediaDiagnostics.mock.calls.filter(([d]) => d.event === "warm_up")).toHaveLength(1);
    await output.dispose();
  });

  it("speaks after the warm-up bound when Anam never reports ready", async () => {
    const onMediaDiagnostics = vi.fn();
    const output = anam({}, { onMediaDiagnostics });
    await output.prepare({ sessionId: "ava" });
    output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "warm_up", warmUpComplete: false }));
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });

  it("sets one playout buffer on every receiver", async () => {
    const pc = peerConnection(); fake.peer.current = pc;
    const output = await ready();
    expect(pc.receivers.map(r => r.jitterBufferTarget)).toEqual([400, 400]);
    await output.dispose();
  });

  it("delays the video when the image runs ahead of the voice, before the opening line", async () => {
    const pc = peerConnection({ fps: 25, offset: 800 }); fake.peer.current = pc;
    const onMediaDiagnostics = vi.fn();
    const output = new AnamStreamingAvatarOutput(settings, { onMediaDiagnostics }, 1000, 1000,
      { maxWaitMs: 3_000, settleMs: 0, pollMs: 50, steadySamples: 2 },
      { ...avSync, pollMs: 5, cooldownMs: 30 });
    await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1), { timeout: 3_000 });
    const [audioTarget, videoTarget] = pc.receivers.map(r => Number(r.jitterBufferTarget));
    expect(audioTarget).toBe(400);
    expect(Math.abs(videoTarget - audioTarget - 800)).toBeLessThanOrEqual(avSync.toleranceMs);
    expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "av_sync", avSyncState: "corrected", avOffsetMs: 800 }));
    const warm = onMediaDiagnostics.mock.calls.map(([d]) => d).find((d) => d.event === "warm_up");
    expect(warm).toMatchObject({ warmUpComplete: true, audioPlayoutTargetMs: 400 });
    expect(Math.abs(warm.avOffsetMs)).toBeLessThanOrEqual(avSync.toleranceMs);
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });

  it("drives the sync with the audible voice only, corrects in the silence, records each line", async () => {
    let voice = 0;
    let speakingOffset = 0;
    const pc = peerConnection({ fps: 25, level: () => voice }); fake.peer.current = pc;
    const stats = pc.getStats;
    // Idle face: in sync. Speaking: the image runs `speakingOffset` ms ahead.
    pc.getStats = async () => new Map([...(await stats())].map(([key, report]) => {
      const r = report as Record<string, unknown>;
      const ahead = voice > 0 ? speakingOffset : 0;
      return [key, r.kind === "video" ? { ...r, estimatedPlayoutTimestamp: 1_000_000 + ahead - Number(pc.receivers[1].jitterBufferTarget ?? 0) }
        : { ...r, estimatedPlayoutTimestamp: 1_000_000 - Number(pc.receivers[0].jitterBufferTarget ?? 0) }];
    }));
    const output = new AnamStreamingAvatarOutput(settings, {}, 1000, 1000, warmUp, { ...avSync, pollMs: 5, cooldownMs: 30, baseMs: 20 });
    await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
    const line = output.renderText("Bonjour.", { turnId: "turn-1" });
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    persona("Bonjour.", { endOfSpeech: true });
    await line;
    // Anam ended its speech early; the voice is audible now, image 500 ms ahead.
    speakingOffset = 500; voice = 0.3;
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(pc.receivers.map(r => r.jitterBufferTarget)).toEqual([20, 20]); // Never mid-voice.
    voice = 0;
    await vi.waitFor(() => expect(Number(pc.receivers[1].jitterBufferTarget)).toBeGreaterThan(300), { timeout: 3_000 });
    expect(pc.receivers[0].jitterBufferTarget).toBe(20);
    await vi.waitFor(() => expect(fake.recordAvatarAvSync).toHaveBeenCalled(), { timeout: 3_000 });
    const record = fake.recordAvatarAvSync.mock.calls[0][0];
    expect(record).toMatchObject({ provider: "anam", session_id: "ava", turn_id: "turn-1", line_index: 1, offset_median_ms: 500, offset_spread_ms: 0 });
    expect(record.voiced_samples).toBeGreaterThan(3);
    expect(record.series.some(([, , voiced]: [number, number | null, number]) => voiced === 1)).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/Bonjour/);
    await output.dispose();
  });

  it("takes no sample while the avatar element is detached (cinematic)", async () => {
    const pc = peerConnection({ fps: 25, offset: 800 }); fake.peer.current = pc;
    const output = new AnamStreamingAvatarOutput(settings, {}, 1000, 1000, warmUp, { ...avSync, pollMs: 5, cooldownMs: 30 });
    await output.prepare({ sessionId: "ava" });
    const video = videoWithFrame(); output.attachMedia(video); video.remove();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pc.receivers.map(r => r.jitterBufferTarget)).toEqual([400, 400]);
    await output.dispose();
  });

  it("delays the voice when it runs ahead of the image", async () => {
    const pc = peerConnection({ fps: 25, offset: -300 }); fake.peer.current = pc;
    const output = new AnamStreamingAvatarOutput(settings, {}, 1000, 1000, warmUp, { ...avSync, pollMs: 5, cooldownMs: 30 });
    await output.prepare({ sessionId: "ava" }); output.attachMedia(videoWithFrame());
    await vi.waitFor(() => {
      const [audioTarget, videoTarget] = pc.receivers.map(r => Number(r.jitterBufferTarget));
      expect(videoTarget).toBe(400);
      expect(Math.abs(audioTarget - videoTarget - 300)).toBeLessThanOrEqual(avSync.toleranceMs);
    }, { timeout: 2_000 });
    await output.dispose();
  });

  it("speaks first once the stream decodes at full rate with audio flowing", async () => {
    fake.peer.current = peerConnection({ fps: 25 });
    const onMediaDiagnostics = vi.fn();
    const output = anam({}, { onMediaDiagnostics }, { ...warmUp, maxWaitMs: 2_000, pollMs: 40 });
    await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "warm_up", warmUpComplete: true, steadyStream: true }));
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });

  it("keeps waiting while video stutters, then speaks at the bound", async () => {
    fake.peer.current = peerConnection({ fps: 8 });
    const onMediaDiagnostics = vi.fn();
    const output = anam({}, { onMediaDiagnostics }, { ...warmUp, maxWaitMs: 300, pollMs: 40 });
    await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fake.talks).toHaveLength(0);
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "warm_up", warmUpComplete: false, steadyStream: false }));
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });

  it("is not steady while video freezes or audio is silent", async () => {
    let freezes = 0;
    for (const pc of [peerConnection({ freezes: () => freezes++ }), peerConnection({ audio: false })]) {
      fake.peer.current = pc; fake.talks.length = 0;
      const onMediaDiagnostics = vi.fn();
      const output = anam({}, { onMediaDiagnostics }, { ...warmUp, maxWaitMs: 300, pollMs: 40 });
      await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
      const opening = output.renderText("Bonjour.");
      await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
      expect(onMediaDiagnostics).toHaveBeenCalledWith(expect.objectContaining({ event: "warm_up", steadyStream: false }));
      persona("Bonjour.", { endOfSpeech: true });
      await opening; await output.dispose();
    }
  });

  it("reports warming until the warm-up before the first line ends, then ready once", async () => {
    const onConnectionStateChange = vi.fn();
    const output = await ready({ onConnectionStateChange });
    expect(onConnectionStateChange.mock.calls.map(([state]) => state)).toEqual(["connecting", "warming"]);
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    expect(onConnectionStateChange).toHaveBeenLastCalledWith("ready");
    persona("Bonjour.", { endOfSpeech: true });
    await opening;
    const next = output.renderText("Encore.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(2));
    persona("Encore.", { endOfSpeech: true });
    await next;
    expect(onConnectionStateChange.mock.calls.map(([state]) => state)).toEqual(["connecting", "warming", "ready", "speaking", "ready", "speaking", "ready"]);
    await output.dispose();
  });

  it("interrupts mid-line through interruptPersona and reports a started render", async () => {
    const output = await ready();
    const speech = output.renderText("Une longue réplique.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    persona("Une longue");
    await vi.waitFor(() => expect(output).toBeDefined());
    output.interrupt();
    await expect(speech).rejects.toMatchObject({ started: true });
    expect(fake.client.interruptPersona).toHaveBeenCalledOnce();
    await output.dispose();
  });

  it("fails before speech when Anam does not confirm the text, so the TTS fallback can take over", async () => {
    const output = await ready();
    const speech = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    fake.handlers.get("MESSAGE_DELIVERY_FAILED")?.({ messageType: "talkStream", correlationId: "other" });
    fake.handlers.get("MESSAGE_DELIVERY_FAILED")?.({ messageType: "talkStream", correlationId: "corr-1" });
    await expect(speech).rejects.toMatchObject({ started: false });
    await output.dispose();
  });

  it("rejects the current line on a closed connection and cleans up the binding", async () => {
    const onDisconnected = vi.fn();
    const output = await ready({ onDisconnected });
    const speech = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    fake.handlers.get("CONNECTION_CLOSED")?.("CONNECTION_CLOSED_CODE_SERVER_CLOSED_CONNECTION");
    await expect(speech).rejects.toMatchObject({ started: false });
    expect(onDisconnected).toHaveBeenCalledWith("connection_closed_code_server_closed_connection");
    await output.dispose();
    expect(fake.client.stopStreaming).toHaveBeenCalledOnce();
    expect(endAvatarSession).toHaveBeenCalledWith({ provider: "anam", sessionId: "ava", externalSessionId: "binding" });
  });

  it("refuses to speak while browser playback is blocked", async () => {
    const output = anam();
    await output.prepare({ sessionId: "ava" });
    const video = document.createElement("video");
    video.play = vi.fn(async () => { throw new DOMException("autoplay blocked", "NotAllowedError"); });
    output.attachMedia(video);
    await expect(output.renderText("Bonjour")).rejects.toMatchObject({ started: false });
    expect(fake.talks).toHaveLength(0);
    await output.dispose();
  });
  it("adds the selected network path to the warm-up diagnostic, never an address", async () => {
    const pc = peerConnection({ fps: 25 });
    const stats = pc.getStats;
    pc.getStats = async () => new Map<string, unknown>([
      ...(await stats()),
      ["T", { type: "transport", selectedCandidatePairId: "P" }],
      ["P", { id: "P", type: "candidate-pair", localCandidateId: "L", remoteCandidateId: "R", currentRoundTripTime: 0.084, availableIncomingBitrate: 2_400_000 }],
      ["L", { id: "L", type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "tls", address: "192.0.2.10", port: 50_000, url: "turns:relay.example:443" }],
      ["R", { id: "R", type: "remote-candidate", candidateType: "host", protocol: "udp", address: "198.51.100.7", port: 3478 }],
    ]);
    fake.peer.current = pc;
    const onMediaDiagnostics = vi.fn();
    const output = anam({ sessionOptions: { ...settings.sessionOptions, region: "eu" } }, { onMediaDiagnostics }, { ...warmUp, maxWaitMs: 2_000, pollMs: 40 });
    await output.prepare({ sessionId: "ava" }); sessionReady(); output.attachMedia(videoWithFrame());
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    const warm = onMediaDiagnostics.mock.calls.map(([d]) => d).find((d) => d.event === "warm_up");
    expect(warm).toMatchObject({
      localCandidateType: "relay", remoteCandidateType: "host", transportProtocol: "udp", relayProtocol: "tls",
      roundTripTimeMs: 84, incomingBitrateKbps: 2400, requestedRegion: "eu",
    });
    expect(JSON.stringify(warm)).not.toMatch(/192\.0\.2|198\.51\.100|50000|3478|turns:|relay\.example/);
    expect(Object.keys(warm).filter((key) => ["address", "port", "url"].includes(key))).toEqual([]);
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });

  it("warms up without a network path when the connection is private", async () => {
    const onMediaDiagnostics = vi.fn();
    const output = await ready({ onMediaDiagnostics });
    const opening = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks).toHaveLength(1));
    const warm = onMediaDiagnostics.mock.calls.map(([d]) => d).find((d) => d.event === "warm_up");
    expect(warm).toMatchObject({ requestedRegion: "auto" });
    expect(warm).not.toHaveProperty("localCandidateType");
    persona("Bonjour.", { endOfSpeech: true });
    await opening; await output.dispose();
  });
});

describe("Anam evolving face cue (AN2)", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fake.handlers.clear(); fake.talks.length = 0; fake.peer.current = null;
    fake.client.sendDirectorNoteCue.mockReset();
    vi.stubGlobal("MediaStream", Stream);
    fake.client.stream.mockImplementation(async () => [new Stream([track("video")]), new Stream([track("audio")])]);
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  async function ready(overrides = {}, callbacks = {}) {
    const output = anam(overrides, callbacks);
    await output.prepare({ sessionId: "ava" });
    sessionReady();
    output.attachMedia(videoWithFrame());
    return output;
  }
  const intent = (emotion: string, extra: Record<string, unknown> = {}) =>
    ({ emotion, intensity: 1, actingNl: "", source: "speech_state", ...extra }) as never;
  /** Says one line and returns the cues sent over the data channel for it. */
  async function say(output: AnamStreamingAvatarOutput, text: string, context: Record<string, unknown>) {
    const before = fake.client.sendDirectorNoteCue.mock.calls.length;
    const talks = fake.talks.length;
    const speech = output.renderText(text, context);
    await vi.waitFor(() => expect(fake.talks[talks]?.chunks.at(-1)?.[1]).toBe(true));
    persona(text, { endOfSpeech: true });
    await expect(speech).resolves.toMatchObject({ status: "played" });
    return fake.client.sendDirectorNoteCue.mock.calls.slice(before).map(([cue]) => cue);
  }

  it("changes the face register over a session as the acting intent evolves", async () => {
    const onMediaDiagnostics = vi.fn();
    const onAvatarCue = vi.fn();
    const output = await ready({ speakingCue: "distressed" }, { onMediaDiagnostics });
    const turns = [
      intent("tense", { speechState: "Tu tournes autour" }),
      intent("fragile", { speechState: "Bloqué" }),
      intent("urgent", { speechState: "La digue cède", intensity: 2 }),
      intent("angry", { source: "lexicon", tempered: "calmed" }),
      intent("neutral", { source: "gm_memory" }),
    ];
    const sent: string[][] = [];
    for (const [index, performance] of turns.entries()) {
      sent.push(await say(output, `Réplique ${index}.`, { turnId: `t${index}`, characterKey: "max", performance, onAvatarCue }));
    }
    expect(sent).toEqual([["concerned"], ["sad"], ["distressed"], ["angry"], []]);
    expect(new Set(sent.flat()).size).toBeGreaterThanOrEqual(2);
    // Plain text only: the cue never enters the spoken text.
    expect(fake.talks.map((talk) => talk.chunks.map(([chunk]) => chunk).join(""))).toEqual(turns.map((_, i) => `Réplique ${i}.`));
    for (const call of fake.client.sendDirectorNoteCue.mock.calls) expect(call[1]).toEqual({ atSeconds: 0 });
    expect(onAvatarCue.mock.calls.map(([value]) => value)).toEqual([
      { provider: "anam", cue: "concerned", sent: true, origin: "intent", emotion: "tense", intensity: 1, source: "speech_state", speech_state: "Tu tournes autour", tempered: false },
      { provider: "anam", cue: "sad", sent: true, origin: "intent", emotion: "fragile", intensity: 1, source: "speech_state", speech_state: "Bloqué", tempered: false },
      { provider: "anam", cue: "distressed", sent: true, origin: "intent", emotion: "urgent", intensity: 2, source: "speech_state", speech_state: "La digue cède", tempered: false },
      { provider: "anam", cue: "angry", sent: true, origin: "intent", emotion: "angry", intensity: 1, source: "lexicon", speech_state: null, tempered: true },
      { provider: "anam", cue: "none", sent: false, origin: "intent", emotion: "neutral", intensity: 1, source: "gm_memory", speech_state: null, tempered: false },
    ]);
    const cues = onMediaDiagnostics.mock.calls.map(([d]) => d).filter((d) => d.event === "speaking_cue");
    expect(cues.map((d) => d.cue)).toEqual(["concerned", "sad", "distressed", "angry", "none"]);
    expect(cues[2]).toEqual({
      event: "speaking_cue", cue: "distressed", cueSent: true, cueOrigin: "intent", emotion: "urgent",
      intensity: 2, performanceSource: "speech_state", speechState: "La digue cède", tempered: false,
    });
    // Labels only: no spoken text in the per-line diagnostic.
    expect(JSON.stringify(cues)).not.toContain("Réplique");
    await output.dispose();
  });

  it("keeps the fixed cue in fixed mode, whatever the intent", async () => {
    const onAvatarCue = vi.fn();
    const output = await ready({ emotionCueMode: "fixed", speakingCue: "sad" });
    expect(await say(output, "Non.", { characterKey: "max", performance: intent("angry"), onAvatarCue })).toEqual(["sad"]);
    expect(await say(output, "Non.", { characterKey: "max", performance: intent("tense"), onAvatarCue })).toEqual(["sad"]);
    expect(onAvatarCue.mock.calls.map(([value]) => value.origin)).toEqual(["fixed", "fixed"]);
    await output.dispose();
  });

  it("falls back to the fixed cue when a line carries no intent", async () => {
    const onAvatarCue = vi.fn();
    const output = await ready({ speakingCue: "distressed" });
    expect(await say(output, "Bonjour.", { characterKey: "max", onAvatarCue })).toEqual(["distressed"]);
    expect(onAvatarCue).toHaveBeenCalledWith(expect.objectContaining({ cue: "distressed", origin: "fallback", emotion: null, sent: true }));
    await output.dispose();
  });

  it("uses the active character's table", async () => {
    const output = await ready({ emotionCues: { ...settings.emotionCues, emma: { ...settings.emotionCues.emma, tense: "distressed" } } });
    expect(await say(output, "Léo ?", { characterKey: "emma", performance: intent("tense") })).toEqual(["distressed"]);
    expect(await say(output, "Quoi ?", { characterKey: "max", performance: intent("tense") })).toEqual(["concerned"]);
    await output.dispose();
  });

  it("says the line without a cue when the send fails, and reports it", async () => {
    fake.client.sendDirectorNoteCue.mockImplementationOnce(() => { throw new Error("data channel closed"); });
    const onAvatarCue = vi.fn();
    const output = await ready();
    const speech = output.renderText("Je suis là.", { characterKey: "max", performance: intent("sad"), onAvatarCue });
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["Je suis là.", true]]));
    persona("Je suis là.", { endOfSpeech: true });
    await expect(speech).resolves.toMatchObject({ status: "played" });
    expect(onAvatarCue).toHaveBeenCalledWith(expect.objectContaining({ cue: "sad", sent: false, origin: "intent" }));
    await output.dispose();
  });

  it("still speaks when the cue observer throws", async () => {
    const output = await ready({}, { onMediaDiagnostics: (d: { event: string }) => {
      if (d.event === "speaking_cue") throw new Error("analytics down");
    } });
    expect(await say(output, "Oui.", { characterKey: "max", performance: intent("sad") })).toEqual(["sad"]);
    await output.dispose();
  });
});
