import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const talks: { chunks: [string, boolean][]; correlationId: string }[] = [];
  const client = {
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
  return { handlers, talks, client, createClient: vi.fn((_token: string, _options?: unknown) => client) };
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
vi.mock("../api", () => ({
  startAvatarSession: vi.fn(async () => ({ provider: "anam", externalSessionId: "binding", sessionToken: "ephemeral" })),
  endAvatarSession: vi.fn(async () => {}),
}));
import { AnamStreamingAvatarOutput } from "./anam";
import { endAvatarSession, startAvatarSession } from "../api";
import { streamingAvatarDefaults } from "../settings";

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
const warmUp = { maxWaitMs: 50, settleMs: 0 };
const anam = (overrides = {}, callbacks = {}) =>
  new AnamStreamingAvatarOutput({ ...settings, ...overrides }, callbacks, 1000, 1000, warmUp);
const sessionReady = () => fake.handlers.get("SESSION_READY")?.("anam-session");
/** jsdom never decodes a frame: report one as soon as playback is asked for. */
const videoWithFrame = () => {
  const video = document.createElement("video") as HTMLVideoElement;
  video.play = vi.fn(async () => {});
  video.requestVideoFrameCallback = vi.fn((cb: VideoFrameRequestCallback) => { queueMicrotask(() => cb(0, {} as VideoFrameCallbackMetadata)); return 1; });
  return video;
};
const persona = (content: string, extra: Record<string, unknown> = {}) =>
  fake.handlers.get("MESSAGE_STREAM_EVENT_RECEIVED")?.({ id: "m", content, role: "persona", endOfSpeech: false, interrupted: false, ...extra });

describe("Anam text-mode lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); fake.handlers.clear(); fake.talks.length = 0;
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
});
