import { describe, expect, it } from "vitest";
import { classifyPlaybackError } from "@/services/audioPlayback";

describe("classifyPlaybackError", () => {
  it("classifies autoplay policy failures as locked audio", () => {
    const err = new DOMException("The request is not allowed", "NotAllowedError");

    expect(classifyPlaybackError(err)).toEqual({
      type: "not_allowed",
      name: "NotAllowedError",
      message: "The request is not allowed",
    });
  });

  it("classifies unsupported media decode failures", () => {
    const err = new DOMException("Could not decode", "NotSupportedError");

    expect(classifyPlaybackError(err).type).toBe("not_supported");
  });
});
