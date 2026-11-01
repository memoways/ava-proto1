import { describe, expect, it } from "vitest";
import {
  buildPostVideoContext,
  capAtWord,
  formatWatchedVideos,
  POST_VIDEO_CONTEXT_MAX_CHARS,
  POST_VIDEO_SECTION_MAX_CHARS,
  rememberWatchedVideo,
  WATCHED_VIDEO_SHOWS_MAX_CHARS,
  WATCHED_VIDEOS_SECTION_MAX_CHARS,
  watchedVideoFrom,
  type WatchedVideo,
} from "./watchedVideoMemory";

const words = (count: number) => Array.from({ length: count }, (_, index) => `mot${index}`).join(" ");
const video = (id: string, extra: Partial<Parameters<typeof watchedVideoFrom>[0]> = {}) => ({
  id, title: id, description: null, ai_description: null, ...extra,
});

describe("capAtWord", () => {
  it("keeps a text within the limit untouched, on one line", () => {
    expect(capAtWord("  Max  regarde\nle feu. ", 50)).toBe("Max regarde le feu.");
  });

  it("cuts on a word boundary, never inside a word, within the limit", () => {
    const source = words(200);
    const cut = capAtWord(source, 120);
    expect(cut.length).toBeLessThanOrEqual(120);
    expect(cut.endsWith("…")).toBe(true);
    const kept = cut.slice(0, -1).split(" ");
    expect(source.split(" ").slice(0, kept.length)).toEqual(kept);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(capAtWord("Max avance, puis Emma recule doucement", 13)).toBe("Max avance…");
  });
});

describe("buildPostVideoContext", () => {
  it("delivers a 600-character Contexte in full, then what the video showed", () => {
    const context = `${words(120)}`.slice(0, 599) + "z";
    expect(context.length).toBe(600);
    const text = buildPostVideoContext({ context, post_video_context: null, description: null, ai_description: "Max seul dans la neige." })!;
    expect(text.startsWith(context.replace(/\s+/g, " ").trim())).toBe(true);
    expect(text).toContain("\nCe que la vidéo montrait : Max seul dans la neige.");
    expect(text.length).toBeLessThanOrEqual(POST_VIDEO_SECTION_MAX_CHARS);
  });

  it("cuts an oversized Contexte on a word", () => {
    const text = buildPostVideoContext({ context: words(300), post_video_context: null, description: null, ai_description: null })!;
    expect(text.length).toBeLessThanOrEqual(POST_VIDEO_CONTEXT_MAX_CHARS);
    expect(text).toMatch(/mot\d+…$/);
  });

  it("prefers the human Description over the AI one, falls back to the legacy context", () => {
    const text = buildPostVideoContext({ context: null, post_video_context: "Ancien contexte.", description: "Humaine.", ai_description: "IA." });
    expect(text).toBe("Ancien contexte.\nCe que la vidéo montrait : Humaine.");
    expect(buildPostVideoContext({ context: "", post_video_context: null, description: "", ai_description: "" })).toBeNull();
  });
});

describe("watched videos memory", () => {
  const entry = (id: string, turn: number, partial = false): WatchedVideo =>
    watchedVideoFrom(video(id, { ai_description: `${id} au coin du feu.` }), turn, partial);

  it("keeps viewing order and moves a replayed video to the end", () => {
    let list: WatchedVideo[] = [];
    list = rememberWatchedVideo(list, entry("feu", 3));
    list = rememberWatchedVideo(list, entry("neige", 6));
    list = rememberWatchedVideo(list, entry("feu", 9));
    expect(list.map((item) => [item.id, item.turn])).toEqual([["neige", 6], ["feu", 9]]);
  });

  it("renders only the last three, oldest first, marking a video skipped during playback", () => {
    const list = ["a", "b", "c", "d"].map((id, index) => entry(id, index + 1, id === "d"));
    expect(formatWatchedVideos(list)).toBe([
      "- « b » (tour 2) : b au coin du feu.",
      "- « c » (tour 3) : c au coin du feu.",
      "- « d » (tour 4, passée avant la fin) : d au coin du feu.",
    ].join("\n"));
    expect(formatWatchedVideos([])).toBe("");
  });

  it("stays compact with long titles and descriptions", () => {
    const list = ["a", "b", "c"].map((id, index) => watchedVideoFrom(
      video(`${id} ${words(40)}`, { description: words(120) }), index, false));
    expect(list.every((item) => item.shows.length <= WATCHED_VIDEO_SHOWS_MAX_CHARS)).toBe(true);
    expect(formatWatchedVideos(list).length).toBeLessThanOrEqual(WATCHED_VIDEOS_SECTION_MAX_CHARS);
  });

  it("omits an unknown turn without leaving empty parentheses", () => {
    expect(formatWatchedVideos([watchedVideoFrom(video("x"), null, false)])).toBe("- « x »");
  });
});
