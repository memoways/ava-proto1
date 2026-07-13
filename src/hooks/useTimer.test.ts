import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_DURATION_SECONDS } from "@/config/experienceRuntime";
import { useTimer } from "@/hooks/useTimer";

describe("useTimer — session 15 minutes", () => {
  afterEach(() => vi.useRealTimers());

  it("runs for 15 minutes before closing exactly once", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useTimer(SESSION_DURATION_SECONDS, onTimeout));

    expect(result.current.formatted).toBe("15:00");
    act(() => result.current.start());
    await act(async () => vi.advanceTimersByTimeAsync(14 * 60 * 1_000));
    expect(onTimeout).not.toHaveBeenCalled();
    expect(result.current.formatted).toBe("1:00");

    await act(async () => vi.advanceTimersByTimeAsync(60 * 1_000));
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(result.current.formatted).toBe("0:00");
  });
});
