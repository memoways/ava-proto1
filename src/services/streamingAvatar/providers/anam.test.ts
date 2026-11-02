import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const talks: { chunks: [string, boolean][]; correlationId: string }[] = [];
  const client = {
    addListener: vi.fn((name: string, cb: (...args: unknown[]) => void) => { handlers.set(name, cb); }),
    stream: vi.fn(async (..._args: unknown[]) => [] as unknown[]),
    isStreaming: vi.fn(() => true),
    interruptPersona: vi.fn(),
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
    const output = new AnamStreamingAvatarOutput(settings, callbacks, 1000, 1000);
    await output.prepare({ sessionId: "ava" });
    const video = document.createElement("video"); video.play = vi.fn(async () => {});
    output.attachMedia(video);
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

  it("speaks the line with its cue tag and ends on the persona end of speech", async () => {
    const onSpeakStart = vi.fn(), onSpeakEnd = vi.fn(), onTranscript = vi.fn(), onPlaybackStart = vi.fn();
    const output = await ready({ onSpeakStart, onSpeakEnd, onTranscript });
    const speech = output.renderText("Je ne sais pas.", { turnId: "turn", onPlaybackStart });
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["[sad] Je ne sais pas.", true]]));
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
    const output = new AnamStreamingAvatarOutput({ ...settings, speakingCue: "none" }, {}, 1000, 1000);
    await output.prepare({ sessionId: "ava" });
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Bonjour.");
    await vi.waitFor(() => expect(fake.talks[0]?.chunks).toEqual([["Bonjour.", true]]));
    persona("Bonjour.", { endOfSpeech: true });
    await speech; await output.dispose();
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
    const output = new AnamStreamingAvatarOutput(settings, {}, 1000, 1000);
    await output.prepare({ sessionId: "ava" });
    const video = document.createElement("video");
    video.play = vi.fn(async () => { throw new DOMException("autoplay blocked", "NotAllowedError"); });
    output.attachMedia(video);
    await expect(output.renderText("Bonjour")).rejects.toMatchObject({ started: false });
    expect(fake.talks).toHaveLength(0);
    await output.dispose();
  });
});
