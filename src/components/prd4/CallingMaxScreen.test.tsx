import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CallingMaxScreen from "./CallingMaxScreen";

describe("CallingMaxScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    const oscillator = { type: "", frequency: { value: 0 }, connect: vi.fn(() => gain), start: vi.fn(), stop: vi.fn() };
    vi.stubGlobal("AudioContext", class {
      currentTime = 0;
      destination = {};
      createOscillator = () => oscillator;
      createGain = () => gain;
      close = () => Promise.resolve();
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the portrait uploaded for the selected character", () => {
    render(
      <CallingMaxScreen
        character="emma"
        portraitUrl="https://portraits.example/emma-uploaded.jpg"
        onAnswered={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Emma" }))
      .toHaveAttribute("src", "https://portraits.example/emma-uploaded.jpg");
  });

  it("answers at the original deadline using the latest callback despite parent renders", () => {
    const callbacks = Array.from({ length: 5 }, () => vi.fn());
    const { rerender } = render(<CallingMaxScreen character="emma" onAnswered={callbacks[0]} />);
    for (let second = 1; second <= 4; second++) {
      act(() => { vi.advanceTimersByTime(1000); });
      rerender(<CallingMaxScreen character="emma" onAnswered={callbacks[second]} />);
    }
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText("Emma décroche…")).toBeInTheDocument();
    expect(callbacks.every(callback => callback.mock.calls.length === 0)).toBe(true);
    act(() => { vi.advanceTimersByTime(500); });
    expect(callbacks[4]).toHaveBeenCalledTimes(1);
    expect(callbacks.slice(0, 4).every(callback => callback.mock.calls.length === 0)).toBe(true);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(callbacks[4]).toHaveBeenCalledTimes(1);
  });

  it("cancels the answer when the call screen unmounts", () => {
    const onAnswered = vi.fn();
    const { unmount } = render(<CallingMaxScreen character="max" onAnswered={onAnswered} />);
    act(() => { vi.advanceTimersByTime(4500); });
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onAnswered).not.toHaveBeenCalled();
  });
});
