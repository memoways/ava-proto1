import { describe, expect, it } from "vitest";
import { selectMediaRecorderMimeType } from "@/services/browserCapabilities";

describe("selectMediaRecorderMimeType", () => {
  it("selects the first supported recorder mime type", () => {
    const selected = selectMediaRecorderMimeType((mime) => mime === "audio/ogg;codecs=opus");

    expect(selected).toBe("audio/ogg;codecs=opus");
  });

  it("returns an empty mime when MediaRecorder exists but no candidate is supported", () => {
    const selected = selectMediaRecorderMimeType(() => false);

    expect(selected).toBe("");
  });
});
