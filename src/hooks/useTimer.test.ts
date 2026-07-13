import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTimer } from "@/hooks/useTimer";

describe("useTimer — durée pilotée par l'admin", () => {
  afterEach(() => vi.useRealTimers());

  it("runs for the configured 930 seconds before closing exactly once", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useTimer(930, onTimeout));

    expect(result.current.formatted).toBe("15:30");
    act(() => result.current.start());
    await act(async () => vi.advanceTimersByTimeAsync(14 * 60 * 1_000 + 30_000));
    expect(onTimeout).not.toHaveBeenCalled();
    expect(result.current.formatted).toBe("1:00");

    await act(async () => vi.advanceTimersByTimeAsync(60 * 1_000));
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(result.current.formatted).toBe("0:00");
  });

  it("accepts a freshly loaded admin duration when reset", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useTimer(600, onTimeout));

    act(() => result.current.reset(930));

    expect(result.current.formatted).toBe("15:30");
  });
});
