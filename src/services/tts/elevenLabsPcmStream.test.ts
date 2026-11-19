import { describe, expect, it } from "vitest";
import { createPcmChunker } from "./elevenLabsPcmStream";

/** `n` samples of value 1..n as little-endian PCM16 bytes. */
function bytesOf(values: number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setInt16(i * 2, value, true));
  return bytes;
}
const ramp = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("createPcmChunker", () => {
  it("cuts 250 ms chunks at 24 kHz (6000 samples) and keeps the rest", () => {
    const chunker = createPcmChunker(24_000, 250);
    const chunks = chunker.push(bytesOf(ramp(14_400)));
    expect(chunks.map((c) => c.length)).toEqual([6000, 6000]);
    expect(chunker.flush().length).toBe(2400);
  });

  it("keeps an odd byte between reads and loses no sample", () => {
    const chunker = createPcmChunker(24_000, 250);
    const all = bytesOf(ramp(12_500));
    const out: number[] = [];
    // Reads of odd sizes: every boundary falls inside a 16-bit sample at some point.
    for (let offset = 0; offset < all.length; ) {
      const size = Math.min(all.length - offset, 4999);
      for (const chunk of chunker.push(all.subarray(offset, offset + size))) out.push(...chunk);
      offset += size;
    }
    out.push(...chunker.flush());
    expect(out).toEqual(ramp(12_500));
  });

  it("emits nothing before a full chunk is available and drops a lone trailing byte", () => {
    const chunker = createPcmChunker(24_000, 250);
    expect(chunker.push(bytesOf(ramp(100)))).toEqual([]);
    expect(chunker.push(new Uint8Array([7]))).toEqual([]);
    expect(chunker.flush().length).toBe(100);
  });

  it("ignores empty reads", () => {
    const chunker = createPcmChunker(24_000, 250);
    expect(chunker.push(new Uint8Array(0))).toEqual([]);
    expect(chunker.flush().length).toBe(0);
  });
});
