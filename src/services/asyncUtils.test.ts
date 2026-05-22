import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "@/services/asyncUtils";

describe("withTimeout", () => {
  it("resolves with the wrapped value before the deadline", async () => {
    await expect(withTimeout("quick", Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects with a labelled TimeoutError after the deadline", async () => {
    vi.useFakeTimers();
    const promise = withTimeout("slow-step", new Promise(() => {}), 250);
    const caughtPromise = promise.catch((err) => err);

    await vi.advanceTimersByTimeAsync(250);
    const caught = await caughtPromise;

    expect(caught).toBeInstanceOf(TimeoutError);
    expect(caught).toMatchObject({
      name: "TimeoutError",
      label: "slow-step",
      timeoutMs: 250,
    });
    vi.useRealTimers();
  });
});
