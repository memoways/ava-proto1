import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  call: {
    on: vi.fn(), join: vi.fn(async () => {}), setLocalAudio: vi.fn(), setLocalVideo: vi.fn(),
    sendAppMessage: vi.fn(), leave: vi.fn(async () => {}), destroy: vi.fn(async () => {}),
    getNetworkStats: vi.fn(async () => ({ stats: {}, networkState: "good" })),
  },
  handlers: new Map<string, (event: unknown) => void>(),
  generateSpeech: vi.fn(),
}));
vi.mock("@daily-co/daily-js", () => ({ default: { createCallObject: () => fake.call } }));
vi.mock("../api", () => ({
  startAvatarSession: vi.fn(async () => ({ provider: "tavus", externalSessionId: "conversation", conversationUrl: "https://room.invalid", meetingToken: "ephemeral" })),
  endAvatarSession: vi.fn(async () => {}),
}));
vi.mock("@/services/tts", () => ({ generateSpeech: fake.generateSpeech }));
vi.mock("@/services/settingsService", () => ({ getTTSSettings: () => ({ outputFormat: "pcm_24000" }) }));
vi.mock("@/services/tts/providerSettings", () => ({ getActiveProviderId: () => "elevenlabs", resolveGradiumSettings: () => ({ outputFormat: "opus" }) }));
// Lines are cut on "|" so a test controls how many TTS segments a reply has.
vi.mock("@/services/tts/textChunking", () => ({ chunkTextForTTS: (text: string) => text.split("|").map((line) => line.trim()).filter(Boolean) }));
import { TavusStreamingAvatarOutput } from "./tavus";
import { streamingAvatarDefaults } from "../settings";
import { AvatarRenderError } from "../types";
import type { PerformanceIntent } from "@/services/tts/performanceIntent";

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
/** Raw 24 kHz PCM16: 14 400 samples = 600 ms = chunks of 250 + 250 + 100 ms. */
function speech(samples = 14_400) {
  return { arrayBuffer: async () => new Int16Array(samples).fill(1_000).buffer } as unknown as Blob;
}
const settings = { ...streamingAvatarDefaults.tavus, replicaId: "face", personaId: "pipecat0" };
const messages = () => fake.call.sendAppMessage.mock.calls.map(([message]) => message);
const echoes = () => messages().filter((message) => message.event_type === "conversation.echo");
const emotions = () => messages().filter((message) => message.event_type === "conversation.set_emotion").map((message) => message.properties.emotion);
function event(type: string, role = "replica") {
  fake.handlers.get("app-message")?.({ data: { event_type: type, conversation_id: "conversation", properties: { role } } });
}
const intent = (emotion: PerformanceIntent["emotion"]): PerformanceIntent => ({ emotion, intensity: 2, actingNl: "", source: "speech_state", speechState: "Tu tournes autour" });

describe("Tavus with Ava's voice (Echo audio)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "performance"] });
    vi.clearAllMocks(); fake.handlers.clear(); vi.stubGlobal("MediaStream", Stream);
    fake.call.on.mockImplementation((name, cb) => { fake.handlers.set(name, cb); return fake.call; });
    fake.generateSpeech.mockImplementation(async () => speech());
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  async function ready(output: TavusStreamingAvatarOutput, characterKey?: string) {
    const promise = output.prepare({ sessionId: "ava", characterKey });
    await vi.advanceTimersByTimeAsync(0); track("video"); track("audio");
    await vi.advanceTimersByTimeAsync(50); await promise;
    const video = document.createElement("video"); video.play = vi.fn(async () => {}); output.attachMedia(video);
    await vi.advanceTimersByTimeAsync(0);
    fake.call.sendAppMessage.mockClear();
  }

  it("sends Ava's TTS as Echo audio: 24 kHz PCM16 chunks of one line, done on the last", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const line = output.renderText("Je n'en peux plus.", { turnId: "t1", voiceId: "VK9GO2Vntd9rcY7Tg6wl", characterKey: "max" });
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.generateSpeech).toHaveBeenCalledWith("Je n'en peux plus.", expect.objectContaining({ voiceId: "VK9GO2Vntd9rcY7Tg6wl", characterKey: "max", providerId: "elevenlabs" }));
    const sent = echoes();
    expect(sent).toHaveLength(3);
    for (const message of sent) {
      expect(message).toMatchObject({ message_type: "conversation", conversation_id: "conversation", properties: { modality: "audio", sample_rate: 24_000 } });
      expect(message.properties).not.toHaveProperty("text");
    }
    expect(new Set(sent.map((message) => message.properties.inference_id)).size).toBe(1);
    expect(sent.map((message) => message.properties.done)).toEqual([false, false, true]);
    // Base64 of little-endian PCM16: 6 000 samples = 12 000 bytes = 16 000 characters.
    expect(sent[0].properties.audio).toHaveLength(16_000);
    expect(atob(sent[2].properties.audio).length).toBe(2_400 * 2);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(700); event("conversation.stopped_speaking");
    await expect(line).resolves.toMatchObject({ status: "played", provider: "Tavus", started: true, generatedSegments: 1 });
    await output.dispose();
  });

  it("follows the speech events: one start, pauses between segments ignored, ends after the last chunk", async () => {
    const onSpeakStart = vi.fn(), onSpeakEnd = vi.fn(), onPlaybackStart = vi.fn();
    let release!: () => void;
    fake.generateSpeech
      .mockImplementationOnce(async () => speech())
      .mockImplementationOnce(() => new Promise<Blob>((resolve) => { release = () => resolve(speech()); }));
    const output = new TavusStreamingAvatarOutput(settings, { onSpeakStart, onSpeakEnd }, 1000, 1000); await ready(output);
    let settled = false;
    const line = output.renderText("Première phrase. | Deuxième phrase.", { turnId: "t2", onPlaybackStart });
    void line.then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking", "replica"); event("conversation.started_speaking", "pal");
    await vi.advanceTimersByTimeAsync(600);
    // The second segment is late: Tavus stops on an empty queue. Not the end of the line.
    event("conversation.stopped_speaking");
    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(false); expect(onSpeakEnd).not.toHaveBeenCalled();
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(echoes().map((message) => message.properties.done)).toEqual([false, false, false, false, false, true]);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(600);
    event("conversation.stopped_speaking", "replica"); event("conversation.stopped_speaking", "pal");
    await expect(line).resolves.toMatchObject({ status: "played", generatedSegments: 2, playedSegments: 2 });
    expect(onSpeakStart).toHaveBeenCalledOnce(); expect(onSpeakEnd).toHaveBeenCalledOnce();
    expect(onPlaybackStart).toHaveBeenCalledOnce();
    expect(emotions().at(-1)).toBe("neutral"); // listening emotion after the line
    await output.dispose();
  });

  it("ignores a stale stop arriving right after the last chunk, then ends on the real one", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    let settled = false;
    const line = output.renderText("Laisse-moi.", { turnId: "t3" });
    void line.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(100);
    event("conversation.stopped_speaking"); await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(600);
    event("conversation.stopped_speaking"); await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    await output.dispose();
  });

  it("ignores the late stop of an interrupted line", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    let settled = false;
    const line = output.renderText("Encore.", { turnId: "t3b" });
    void line.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(700);
    fake.handlers.get("app-message")?.({ data: { event_type: "conversation.stopped_speaking", conversation_id: "conversation", properties: { role: "replica", interrupted: true } } });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    event("conversation.stopped_speaking"); await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    await output.dispose();
  });

  it("ends the line on its own when no stop arrives after the audio has played", async () => {
    const onSpeakEnd = vi.fn();
    const output = new TavusStreamingAvatarOutput(settings, { onSpeakEnd }, 1000, 1000); await ready(output);
    const line = output.renderText("Oui.", { turnId: "t4" }); await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking");
    await vi.advanceTimersByTimeAsync(600 + 4_000);
    await expect(line).resolves.toMatchObject({ status: "played" });
    expect(onSpeakEnd).toHaveBeenCalledWith("t4");
    await output.dispose();
  });

  it("picks the face emotion of the line from the acting intent, before the first audio chunk", async () => {
    const onAvatarCue = vi.fn();
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const line = output.renderText("Tu mens.", { turnId: "t5", performance: intent("accusatory"), onAvatarCue });
    await vi.advanceTimersByTimeAsync(0);
    const order = messages().map((message) => message.event_type === "conversation.set_emotion" ? message.properties.emotion : message.properties.modality);
    expect(order.slice(0, 2)).toEqual(["anger", "audio"]);
    expect(onAvatarCue).toHaveBeenCalledWith(expect.objectContaining({ provider: "tavus", cue: "anger", sent: true, origin: "intent", emotion: "accusatory", intensity: 2 }));
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(700); event("conversation.stopped_speaking");
    await line;
    // Without an intent (or a neutral one) the character's speaking emotion stays.
    const plain = output.renderText("Bon.", { performance: intent("neutral"), onAvatarCue }); await vi.advanceTimersByTimeAsync(0);
    expect(onAvatarCue).toHaveBeenLastCalledWith(expect.objectContaining({ cue: "sadness", origin: "fallback" }));
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(700); event("conversation.stopped_speaking");
    await plain; await output.dispose();
  });

  it("falls back (started: false) when Ava's TTS fails before the first chunk", async () => {
    fake.generateSpeech.mockRejectedValueOnce(new Error("TTS 503"));
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const line = output.renderText("Bonjour.");
    await expect(line).rejects.toMatchObject({ name: "AvatarRenderError", started: false, message: "TTS 503" });
    expect(echoes()).toHaveLength(0);
    await output.dispose();
  });

  it("falls back and stops the queued audio when Tavus never starts speaking", async () => {
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const line = output.renderText("Bonjour.");
    const failure = expect(line).rejects.toMatchObject({ started: false, message: "Tavus did not start speaking" });
    await vi.advanceTimersByTimeAsync(1_000);
    await failure;
    expect(messages().at(-1)).toEqual({ message_type: "conversation", event_type: "conversation.interrupt", conversation_id: "conversation" });
    await output.dispose();
  });

  it("stops Tavus and the TTS in flight when the player interrupts", async () => {
    let signal: AbortSignal | undefined;
    fake.generateSpeech
      .mockImplementationOnce(async () => speech())
      .mockImplementationOnce((_text: string, options: { signal: AbortSignal }) => { signal = options.signal; return new Promise<Blob>(() => {}); });
    const output = new TavusStreamingAvatarOutput(settings, {}, 1000, 1000); await ready(output);
    const line = output.renderText("Une. | Deux.");
    await vi.advanceTimersByTimeAsync(0);
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(0);
    fake.call.sendAppMessage.mockClear();
    output.interrupt();
    const error = await line.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AvatarRenderError);
    expect((error as AvatarRenderError).started).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(messages()[0]).toEqual({ message_type: "conversation", event_type: "conversation.interrupt", conversation_id: "conversation" });
    expect(echoes()).toHaveLength(0);
    await output.dispose();
  });

  it("uses the PAL voice for a character set to Tavus, Ava's audio for the others", async () => {
    const mixed = { ...settings, characters: { max: {}, emma: { voiceSource: "tavus" as const } } };
    const output = new TavusStreamingAvatarOutput(mixed, {}, 1000, 1000); await ready(output, "max");
    const max = output.renderText("C'est Max.", { characterKey: "max" }); await vi.advanceTimersByTimeAsync(0);
    expect(echoes().at(-1)?.properties.modality).toBe("audio");
    event("conversation.started_speaking"); await vi.advanceTimersByTimeAsync(700); event("conversation.stopped_speaking");
    await max;
    const emma = output.renderText("C'est Emma.", { characterKey: "emma" }); await vi.advanceTimersByTimeAsync(0);
    expect(echoes().at(-1)?.properties).toMatchObject({ modality: "text", text: '<emotion value="dejected"/> C\'est Emma.' });
    event("conversation.started_speaking", "pal"); await vi.advanceTimersByTimeAsync(0); event("conversation.stopped_speaking", "pal");
    await emma;
    expect(fake.generateSpeech).toHaveBeenCalledTimes(1);
    await output.dispose();
  });
});
