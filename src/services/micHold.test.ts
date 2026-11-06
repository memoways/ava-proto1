import { describe, expect, it, vi } from "vitest";
import { holdMicrophone } from "./micHold";

const fakeStream = () => {
  const track = { stop: vi.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
};

describe("holdMicrophone", () => {
  it("opens the device with the STT processing and closes it on release", async () => {
    const { stream, track } = fakeStream();
    const getUserMedia = vi.fn(async () => stream);
    const hold = holdMicrophone(getUserMedia);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: expect.objectContaining({ echoCancellation: true }) });
    await Promise.resolve(); await Promise.resolve();
    expect(track.stop).not.toHaveBeenCalled();
    hold.release();
    hold.release();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("closes a device granted after an early release", async () => {
    const { stream, track } = fakeStream();
    let grant!: (value: MediaStream) => void;
    const hold = holdMicrophone(() => new Promise((resolve) => { grant = resolve; }));
    hold.release();
    grant(stream);
    await vi.waitFor(() => expect(track.stop).toHaveBeenCalled());
  });

  it("does nothing without a microphone", () => {
    expect(() => holdMicrophone(undefined).release()).not.toThrow();
    const refused = holdMicrophone(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    expect(() => refused.release()).not.toThrow();
  });
});
