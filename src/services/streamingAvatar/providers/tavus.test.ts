import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ call: {
  on: vi.fn(), join: vi.fn(async () => {}), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(),
  sendAppMessage: vi.fn(), leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}),
}, handlers: new Map<string, (event: unknown) => void>() }));
vi.mock("@daily-co/daily-js", () => ({ default: { createCallObject: () => fake.call } }));
vi.mock("../api", () => ({ startAvatarSession: vi.fn(async () => ({ provider: "tavus", externalSessionId: "conversation", conversationUrl: "https://room.invalid", meetingToken: "ephemeral" })), endAvatarSession: vi.fn(async () => {}) }));
import { TavusStreamingAvatarOutput } from "./tavus";
class Stream {
  tracks: MediaStreamTrack[] = [];
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
  addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
  removeTrack(track: MediaStreamTrack) { this.tracks = this.tracks.filter(t => t !== track); }
}
function track(kind: string, id = kind) {
  fake.handlers.get("track-started")?.({ participant: { local: false }, type: kind, track: { id, kind, readyState: "live" } });
}
const settings = { replicaId: "face", personaId: "pal", language: "French", maxDurationSeconds: 900, emotion: "sadness" as const };
describe("Tavus actual receive-only lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); fake.handlers.clear(); vi.stubGlobal("MediaStream", Stream);
    fake.call.on.mockImplementation((name, cb) => { fake.handlers.set(name, cb); return fake.call; });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function ready(output: TavusStreamingAvatarOutput) {
    const promise = output.prepare({ sessionId: "ava" });
    await vi.advanceTimersByTimeAsync(0); track("video"); track("audio");
    await vi.advanceTimersByTimeAsync(50); await promise;
  }
  it("waits for both audio and video, not video alone", async () => {
    const onStreamReady = vi.fn();
    const output = new TavusStreamingAvatarOutput(settings, { onStreamReady }, 1000, 1000);
    let prepared = false;
    const promise = output.prepare({ sessionId: "ava" }).then(() => { prepared = true; });
    await vi.advanceTimersByTimeAsync(0); track("video");
    await vi.advanceTimersByTimeAsync(100);
    expect(prepared).toBe(false); expect(onStreamReady).not.toHaveBeenCalled();
    track("audio"); await vi.advanceTimersByTimeAsync(50); await promise;
    expect(onStreamReady).toHaveBeenCalledOnce();
    await output.dispose();
  });
  it("does not reset srcObject or play on a repeated attachment", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const video = document.createElement("video"); video.play = vi.fn(async () => {});
    const assign = vi.fn(); let stream: MediaProvider | null = null;
    Object.defineProperty(video, "srcObject", { get: () => stream, set: value => { stream = value; assign(); } });
    output.attachMedia(video); output.attachMedia(video); await vi.advanceTimersByTimeAsync(0);
    expect(assign).toHaveBeenCalledTimes(1); expect(video.play).toHaveBeenCalledTimes(1);
    await output.dispose();
  });
  it("rejects blocked audio before sending speech instead of reporting silent playback", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const video = document.createElement("video");
    video.play = vi.fn(async () => { throw new DOMException("autoplay blocked", "NotAllowedError"); });
    output.attachMedia(video); await vi.advanceTimersByTimeAsync(0);
    await expect(output.renderText("Bonjour")).rejects.toMatchObject({ started: false });
    const sent = fake.call.sendAppMessage.mock.calls.map(([message]) => message.event_type);
    expect(sent).not.toContain("conversation.echo"); await output.dispose();
  });
  it("accepts PAL speech and ignores wrong conversations and duplicate legacy events", async () => {
    const onSpeakStart = vi.fn(), onSpeakEnd = vi.fn();
    const output = new TavusStreamingAvatarOutput(settings, { onSpeakStart, onSpeakEnd }, 1000, 1000);
    await ready(output); const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Bonjour", { turnId: "turn" }); await vi.advanceTimersByTimeAsync(0);
    const event = (type: string, conversation_id = "conversation", role = "pal") => fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id, properties: { role } } });
    event("conversation.started_speaking", "other"); expect(onSpeakStart).not.toHaveBeenCalled();
    event("conversation.started_speaking"); event("conversation.started_speaking", "conversation", "replica");
    await vi.advanceTimersByTimeAsync(0);
    event("conversation.stopped_speaking"); event("conversation.stopped_speaking", "conversation", "replica");
    await expect(speech).resolves.toMatchObject({ status: "played", playedSegments: 1 });
    expect(onSpeakStart).toHaveBeenCalledOnce(); expect(onSpeakEnd).toHaveBeenCalledOnce(); await output.dispose();
  });
  it("sets the face emotion at join, when ready, and tags each spoken line", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const emotionCalls = () => fake.call.sendAppMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.event_type === "conversation.set_emotion");
    // Once right after joining, once when the stream is ready.
    expect(emotionCalls()).toHaveLength(2);
    expect(emotionCalls()[0]).toEqual({
      message_type: "conversation",
      event_type: "conversation.set_emotion",
      conversation_id: "conversation",
      properties: { emotion: "sadness" },
    });
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Je n'en peux plus."); await vi.advanceTimersByTimeAsync(0);
    const order = fake.call.sendAppMessage.mock.calls.map(([message]) => message.event_type);
    expect(order.slice(-2)).toEqual(["conversation.set_emotion", "conversation.echo"]);
    const echo = fake.call.sendAppMessage.mock.calls.at(-1)?.[0];
    expect(echo.properties.text).toBe('<emotion value="dejected"/> Je n\'en peux plus.');
    const event = (type: string) => fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id: "conversation", properties: { role: "pal" } } });
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(0); event("conversation.stopped_speaking");
    await speech; await output.dispose();
  });
  it("re-asserts the emotion after each line and while listening", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Laisse-moi."); await vi.advanceTimersByTimeAsync(0);
    const event = (type: string) => fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id: "conversation", properties: { role: "pal" } } });
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(0);
    fake.call.sendAppMessage.mockClear();
    event("conversation.stopped_speaking"); await speech;
    const types = () => fake.call.sendAppMessage.mock.calls.map(([message]) => message.event_type);
    expect(types()).toEqual(["conversation.set_emotion"]);
    (fake.call as { getNetworkStats?: () => Promise<unknown> }).getNetworkStats = vi.fn(async () => ({}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(types()).toEqual(["conversation.set_emotion", "conversation.set_emotion"]);
    await output.dispose();
  });
});
