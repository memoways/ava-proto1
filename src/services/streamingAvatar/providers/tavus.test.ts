import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({ call: {
  on: vi.fn(), join: vi.fn(async () => {}), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(),
  sendAppMessage: vi.fn(), leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}),
}, handlers: new Map<string, (event: unknown) => void>() }));
vi.mock("@daily-co/daily-js", () => ({ default: { createCallObject: () => fake.call } }));
vi.mock("../api", () => ({ startAvatarSession: vi.fn(async () => ({ provider: "tavus", externalSessionId: "conversation", conversationUrl: "https://room.invalid", meetingToken: "ephemeral" })), endAvatarSession: vi.fn(async () => {}) }));
import { TavusStreamingAvatarOutput } from "./tavus";
import { streamingAvatarDefaults } from "../settings";
import { endAvatarSession, startAvatarSession } from "../api";
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
// The PAL-voice path (Echo text); the Ava-audio path has its own suite below.
const settings = { ...streamingAvatarDefaults.tavus, replicaId: "face", personaId: "pal", voiceSource: "tavus" as const };
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
      properties: { emotion: "neutral" },
    });
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Je n'en peux plus."); await vi.advanceTimersByTimeAsync(0);
    const order = fake.call.sendAppMessage.mock.calls.map(([message]) => message.event_type);
    expect(order.slice(-2)).toEqual(["conversation.set_emotion", "conversation.echo"]);
    expect(emotionCalls().at(-1)?.properties.emotion).toBe("sadness");
    const echo = fake.call.sendAppMessage.mock.calls.at(-1)?.[0];
    expect(echo.properties.text).toBe('<emotion value="dejected"/> Je n\'en peux plus.');
    const event = (type: string) => fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id: "conversation", properties: { role: "pal" } } });
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(0); event("conversation.stopped_speaking");
    await speech; await output.dispose();
  });
  it("switches to the listening emotion after each line and keeps it while idle", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Laisse-moi."); await vi.advanceTimersByTimeAsync(0);
    const event = (type: string) => fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id: "conversation", properties: { role: "pal" } } });
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(0);
    fake.call.sendAppMessage.mockClear();
    event("conversation.stopped_speaking"); await speech;
    const types = () => fake.call.sendAppMessage.mock.calls.map(([message]) => message.event_type);
    expect(types()).toEqual(["conversation.set_emotion"]);
    expect(fake.call.sendAppMessage.mock.calls[0][0].properties.emotion).toBe("neutral");
    (fake.call as { getNetworkStats?: () => Promise<unknown> }).getNetworkStats = vi.fn(async () => ({}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(types()).toEqual(["conversation.set_emotion", "conversation.set_emotion"]);
    await output.dispose();
  });
  it("sends conversation.interrupt and rejects the current line when interrupted", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    const speech = output.renderText("Attends."); await vi.advanceTimersByTimeAsync(0);
    fake.call.sendAppMessage.mockClear();
    output.interrupt();
    await expect(speech).rejects.toThrow("Tavus speech interrupted");
    expect(fake.call.sendAppMessage.mock.calls[0][0]).toEqual({
      message_type: "conversation",
      event_type: "conversation.interrupt",
      conversation_id: "conversation",
    });
    await output.dispose();
  });
});

describe("Tavus per-character Face and emotions (lot 1)", () => {
  const perCharacter = {
    ...settings,
    replicaId: "r-global",
    echoEmotion: "dejected" as const,
    characters: {
      max: { faceId: "r-max", echoEmotion: "neutral" as const, listeningEmotion: "contempt" as const },
      emma: { emotion: "fear" as const },
    },
  };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); fake.handlers.clear(); vi.stubGlobal("MediaStream", Stream);
    fake.call.on.mockImplementation((name, cb) => { fake.handlers.set(name, cb); return fake.call; });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const messages = () => fake.call.sendAppMessage.mock.calls.map(([message]) => message);
  const event = (type: string, conversation_id = "conversation") =>
    fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id, properties: { role: "pal" } } });
  async function connect(output: TavusStreamingAvatarOutput, characterKey?: string) {
    const promise = output.prepare({ sessionId: "ava", characterKey });
    await vi.advanceTimersByTimeAsync(0); track("video"); track("audio");
    await vi.advanceTimersByTimeAsync(50); await promise;
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
  }
  async function speak(output: TavusStreamingAvatarOutput, text: string, characterKey?: string, conversation = "conversation") {
    const speech = output.renderText(text, { characterKey }); await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking", conversation); await vi.advanceTimersByTimeAsync(0);
    event("conversation.stopped_speaking", conversation); return speech;
  }

  it("opens the conversation with the character's Face, without sending the override table", async () => {
    const output = new TavusStreamingAvatarOutput(perCharacter, {}, 1000, 1000);
    await connect(output, "max");
    const sent = vi.mocked(startAvatarSession).mock.calls[0][0];
    expect(sent.tavus).toMatchObject({ replicaId: "r-max", characters: {} });
    expect(output.model).toBe("r-max");
    expect(messages()[0].properties.emotion).toBe("contempt");
    await speak(output, "Laisse-moi.");
    const echo = messages().find((message) => message.event_type === "conversation.echo");
    expect(echo.properties.text).toBe('<emotion value="neutral"/> Laisse-moi.');
    await output.dispose();
  });

  it("keeps the global Face and Echo tag without a character", async () => {
    const output = new TavusStreamingAvatarOutput(perCharacter, {}, 1000, 1000);
    await connect(output);
    expect(vi.mocked(startAvatarSession).mock.calls[0][0].tavus).toMatchObject({ replicaId: "r-global" });
    await speak(output, "Oui.");
    expect(messages().find((message) => message.event_type === "conversation.echo").properties.text)
      .toBe('<emotion value="dejected"/> Oui.');
    await output.dispose();
  });

  it("switches only the emotions when the next character shares the Face", async () => {
    const sameFace = { ...perCharacter, characters: { ...perCharacter.characters, max: {} } };
    const output = new TavusStreamingAvatarOutput(sameFace, {}, 1000, 1000);
    await connect(output, "max");
    fake.call.sendAppMessage.mockClear();
    await speak(output, "Bonjour.", "emma");
    expect(startAvatarSession).toHaveBeenCalledOnce();
    expect(endAvatarSession).not.toHaveBeenCalled();
    const emotions = messages().filter((message) => message.event_type === "conversation.set_emotion").map((m) => m.properties.emotion);
    expect(emotions.slice(0, 2)).toEqual(["neutral", "fear"]);
    await output.dispose();
  });

  it("recreates the Tavus conversation when the next character has another Face", async () => {
    const onDisconnected = vi.fn();
    const output = new TavusStreamingAvatarOutput(perCharacter, { onDisconnected }, 1000, 1000);
    await connect(output, "max");
    const firstCall = fake.call;
    const oldLeft = fake.handlers.get("left-meeting");
    const secondCall = {
      on: vi.fn((name: string, cb: (event: unknown) => void) => { fake.handlers.set(name, cb); return secondCall; }),
      join: vi.fn(async () => {}), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(),
      sendAppMessage: vi.fn(), leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}),
    };
    fake.call = secondCall as unknown as typeof fake.call;
    try {
      vi.mocked(startAvatarSession).mockResolvedValueOnce({
        provider: "tavus", externalSessionId: "conversation-2", conversationUrl: "https://room2.invalid", meetingToken: "ephemeral-2",
      } as Awaited<ReturnType<typeof startAvatarSession>>);
      const speech = output.renderText("C'est Emma.", { characterKey: "emma" });
      await vi.advanceTimersByTimeAsync(0);
      expect(firstCall.leave).toHaveBeenCalledOnce();
      expect(endAvatarSession).toHaveBeenCalledWith({ provider: "tavus", sessionId: "ava", externalSessionId: "conversation" });
      // The old room leaving is expected, not a disconnection of the avatar.
      oldLeft?.({});
      expect(onDisconnected).not.toHaveBeenCalled();
      track("video", "v2"); track("audio", "a2");
      await vi.advanceTimersByTimeAsync(50);
      expect(vi.mocked(startAvatarSession).mock.calls[1][0].tavus).toMatchObject({ replicaId: "r-global" });
      expect(output.externalSessionId).toBe("conversation-2");
      expect(output.model).toBe("r-global");
      event("conversation.started_speaking", "conversation-2"); await vi.advanceTimersByTimeAsync(0);
      event("conversation.stopped_speaking", "conversation-2");
      await expect(speech).resolves.toMatchObject({ status: "played", model: "r-global" });
      const echo = secondCall.sendAppMessage.mock.calls.map(([message]) => message)
        .filter((message) => message.event_type === "conversation.echo").at(-1);
      expect(echo).toMatchObject({ conversation_id: "conversation-2", properties: { text: '<emotion value="dejected"/> C\'est Emma.' } });
      await output.dispose();
      expect(endAvatarSession).toHaveBeenLastCalledWith({ provider: "tavus", sessionId: "ava", externalSessionId: "conversation-2" });
    } finally {
      fake.call = firstCall;
    }
  });
});
