import { afterEach, describe, expect, it, vi } from "vitest";
import { disableScreenWakeLock, enableScreenWakeLock, getWakeLockStatus } from "./screenWakeLock";

describe("screenWakeLock", () => {
  afterEach(() => {
    disableScreenWakeLock();
    vi.unstubAllGlobals();
  });

  it("holds a screen lock and releases it", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    enableScreenWakeLock();
    await vi.waitFor(() => expect(getWakeLockStatus().apiHeld).toBe(true));
    expect(request).toHaveBeenCalledWith("screen");
    disableScreenWakeLock();
    expect(release).toHaveBeenCalled();
    expect(getWakeLockStatus().apiHeld).toBe(false);
  });

  it("re-requests the lock when the page becomes visible again", async () => {
    let calls = 0;
    const request = vi.fn().mockImplementation(async () => { calls += 1; return { release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() }; });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    enableScreenWakeLock();
    await vi.waitFor(() => expect(calls).toBe(1));
    disableScreenWakeLock();
    enableScreenWakeLock();
    await vi.waitFor(() => expect(calls).toBe(2));
  });

  it("does not throw without the API", () => {
    Object.defineProperty(navigator, "wakeLock", { value: undefined, configurable: true });
    expect(() => enableScreenWakeLock()).not.toThrow();
  });
});
