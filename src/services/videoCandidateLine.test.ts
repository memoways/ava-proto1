import { describe, expect, it } from "vitest";
import type { VideoTriggerRow } from "@/services/videoTriggerService";
import {
  VIDEO_LINE_TEXT_MAX_CHARS,
  capVideoText,
  factualVideoDescription,
  formatVideoCandidateLine,
} from "./videoCandidateLine";

const row = (extra: Partial<VideoTriggerRow>): VideoTriggerRow => ({
  id: "v1", notion_id: null, title: "couteau", type: "interlude", themes: ["famille"], video_url: "https://video",
  context: null, description: null, priority: 1, transition_style: null, post_video_context: null, updated_at: null,
  ...extra,
});

describe("video candidate line", () => {
  it("prefers the human Description over the AI description", () => {
    expect(factualVideoDescription({ description: "Max tient un couteau.", ai_description: "Un homme en cuisine." }))
      .toBe("Max tient un couteau.");
  });

  it("falls back to the AI description when Description is empty or blank", () => {
    expect(factualVideoDescription({ description: "", ai_description: "Un homme en cuisine." })).toBe("Un homme en cuisine.");
    expect(factualVideoDescription({ description: "   ", ai_description: "Un homme en cuisine." })).toBe("Un homme en cuisine.");
    expect(factualVideoDescription({ description: null, ai_description: undefined })).toBe("");
  });

  it("caps each text on a word boundary and keeps one line without double quotes", () => {
    const long = `Il dit "assez".\n${"mot ".repeat(200)}`;
    const capped = capVideoText(long);
    expect(capped.length).toBeLessThanOrEqual(VIDEO_LINE_TEXT_MAX_CHARS);
    expect(capped.endsWith("…")).toBe(true);
    expect(capped).not.toMatch(/["\n]/);
    expect(capped.startsWith("Il dit 'assez'. mot")).toBe(true);
  });

  it("writes context then description, both capped, in the existing line format", () => {
    const line = formatVideoCandidateLine(row({
      context: "c".repeat(600),
      description: "",
      ai_description: "d".repeat(600),
    }));
    expect(line.startsWith('- id=v1 | titre="couteau" | type=interlude | priorité=1 | thèmes=[famille] | contexte="')).toBe(true);
    expect(line).not.toContain("\n");
    const context = line.match(/contexte="([^"]*)"/)?.[1] ?? "";
    const description = line.match(/description="([^"]*)"/)?.[1] ?? "";
    expect(context.length).toBe(VIDEO_LINE_TEXT_MAX_CHARS);
    expect(description.length).toBe(VIDEO_LINE_TEXT_MAX_CHARS);
    expect(line.indexOf("contexte=")).toBeLessThan(line.indexOf("description="));
  });

  it("omits empty fields and keeps the historical placeholders", () => {
    expect(formatVideoCandidateLine(row({ themes: [], priority: null })))
      .toBe('- id=v1 | titre="couteau" | type=interlude | priorité=? | thèmes=[—]');
  });
});
