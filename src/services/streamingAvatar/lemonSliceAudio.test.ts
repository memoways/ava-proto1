import { describe, expect, it } from "vitest";
import {
  buildLemonSliceAudioCommand,
  chunkPcm16,
  downmixToMono,
  floatToPcm16,
  parseLemonSliceServerMessage,
  pcm16BytesToFloat,
  pcm16ToBase64,
  rawPcmRate,
  resampleLinear,
  speechToLemonSliceChunks,
} from "./lemonSliceAudio";

describe("LemonSlice audio bridge", () => {
  it("converts float samples to clamped PCM16", () => {
    expect(Array.from(floatToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5])))).toEqual([0, 32767, -32768, 32767, -32768, 16384]);
  });

  it("resamples 24 kHz and 48 kHz speech to the session rate", () => {
    const tone = new Float32Array(2_400).map((_, i) => Math.sin(i / 10));
    expect(resampleLinear(tone, 24_000, 16_000)).toHaveLength(1_600);
    expect(resampleLinear(new Float32Array(4_800), 48_000, 24_000)).toHaveLength(2_400);
    expect(resampleLinear(tone, 16_000, 16_000)).toBe(tone);
    const ramp = resampleLinear(new Float32Array([0, 1]), 8_000, 24_000);
    expect(ramp[0]).toBe(0);
    expect(ramp[ramp.length - 1]).toBe(1);
  });

  it("downmixes stereo to mono", () => {
    expect(Array.from(downmixToMono([new Float32Array([1, 0]), new Float32Array([0, 0])]))).toEqual([0.5, 0]);
  });

  it("cuts 100 ms chunks at the session rate, last chunk shorter", () => {
    const chunks = chunkPcm16(new Int16Array(16_000 * 0.25), 16_000);
    expect(chunks.map((chunk) => chunk.length)).toEqual([1_600, 1_600, 800]);
    expect(chunkPcm16(new Int16Array(4_800), 24_000).map((chunk) => chunk.length)).toEqual([2_400, 2_400]);
  });

  it("encodes little-endian base64 and builds the documented audio command", () => {
    expect(pcm16ToBase64(new Int16Array([1, -2]))).toBe("AQD+/w==");
    expect(buildLemonSliceAudioCommand(new Int16Array([1, -2]), 16_000)).toEqual({
      command: "audio", audio: "AQD+/w==", sampleRate: 16_000, encoding: "PCM16",
    });
  });

  it("reads raw pcm formats and leaves containers to the browser decoder", () => {
    expect(rawPcmRate("pcm_24000")).toBe(24_000);
    expect(rawPcmRate("pcm_16000")).toBe(16_000);
    expect(rawPcmRate("mp3_44100_128")).toBeNull();
    expect(rawPcmRate("opus")).toBeNull();
    const bytes = new Int16Array([16_384, -16_384]).buffer;
    expect(Array.from(pcm16BytesToFloat(bytes))).toEqual([0.5, -0.5]);
  });

  it("turns 1 s of 24 kHz Gradium speech into ten 16 kHz chunks", () => {
    const chunks = speechToLemonSliceChunks([new Float32Array(24_000)], 24_000, 16_000);
    expect(chunks).toHaveLength(10);
    expect(chunks.every((chunk) => chunk.length === 1_600)).toBe(true);
  });

  it("parses playback_finished and ignores acks and garbage", () => {
    expect(parseLemonSliceServerMessage('{"command":"playback_finished","playback_position":4.2,"interrupted":false}')).toEqual({
      command: "playback_finished", playbackPosition: 4.2, interrupted: false,
    });
    expect(parseLemonSliceServerMessage('{"command":"heartbeat_ack"}')).toBeNull();
    expect(parseLemonSliceServerMessage("not json")).toBeNull();
    expect(parseLemonSliceServerMessage(new ArrayBuffer(2))).toBeNull();
  });
});
