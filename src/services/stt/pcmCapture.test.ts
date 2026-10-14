import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { encodePcm16 } from "./pcmCapture";

function worklet(rate: number, targetRate: number, frameSamples: number) {
  const messages: { type: string; samples?: Float32Array; id?: number }[] = [];
  let Processor: new (options: unknown) => { process(inputs: Float32Array[][]): boolean; port: { onmessage: (event: unknown) => void } };
  runInNewContext(readFileSync("public/audio/pcm-capture-worklet.js", "utf8"), {
    sampleRate: rate, Float32Array,
    AudioWorkletProcessor: class { port = { onmessage: null, postMessage: (value: typeof messages[number]) => messages.push(value) }; },
    registerProcessor: (_: string, constructor: typeof Processor) => { Processor = constructor; },
  });
  return { processor: new Processor!({ processorOptions: { targetRate, frameSamples } }), messages };
}
describe("real capture worklet frames", () => {
  it.each([44100, 48000])("resamples the effective %i Hz rate into exact Gradium frames", rate => {
    const { processor, messages } = worklet(rate, 24000, 1920);
    for (let offset = 0; offset < rate; offset += 128) processor.process([[new Float32Array(Math.min(128, rate - offset)).fill(0.25)]]);
    expect(messages.filter(m => m.type === "frame")).toHaveLength(12);
    for (const message of messages) expect(message.samples?.length).toBe(1920);
    processor.port.onmessage({ data: { type: "flush", id: 7 } });
    expect(messages.at(-1)).toEqual({ type: "flushed", id: 7 });
    expect(messages.filter(m => m.type === "frame")).toHaveLength(13);
  });
  it("retains the first sample, flushes the last partial frame, and clears video/paused buffers", () => {
    const { processor, messages } = worklet(16000, 16000, 800);
    processor.process([[new Float32Array(100).fill(0.5)]]);
    processor.port.onmessage({ data: { type: "flush", id: 1 } });
    expect(messages[0].samples?.[0]).toBe(0.5);expect(messages[0].samples?.[99]).toBe(0.5);expect(messages[0].samples?.[100]).toBe(0);
    processor.port.onmessage({ data: { type: "enabled", value: false } });processor.process([[new Float32Array(800).fill(0.9)]]);
    processor.port.onmessage({ data: { type: "enabled", value: true } });processor.process([[new Float32Array(800).fill(0.2)]]);
    expect(messages[2].samples?.[0]).toBeCloseTo(0.2);expect(messages[2].samples?.[799]).toBeCloseTo(0.2);
    const view = new DataView(encodePcm16(new Float32Array([-1, 0, 1])));
    expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([-32768, 0, 32767]);
  });
});
