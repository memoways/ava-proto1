import { describe, expect, it } from "vitest";
import { MAX_ROWS, readAllPages } from "./readAllPages";

const source = (size: number) => async (from: number, to: number) =>
  Array.from({ length: size }, (_, index) => index).slice(from, to + 1);

describe("readAllPages", () => {
  it("reads past the first thousand rows", async () => {
    const { rows, capped } = await readAllPages(source(2300));
    expect(rows).toHaveLength(2300);
    expect(rows[2299]).toBe(2299);
    expect(capped).toBe(false);
  });

  it("says when the ceiling cut the reading", async () => {
    const { rows, capped } = await readAllPages(source(MAX_ROWS + 10));
    expect(rows).toHaveLength(MAX_ROWS);
    expect(capped).toBe(true);
  });
});
