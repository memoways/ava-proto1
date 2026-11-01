import { describe, expect, it } from "vitest";
import { countPlayedExtracts, selectEligibleVideos, videoAvailableForCharacter, type EligibilityVideo } from "./videoEligibility";

const v = (id: string, extra: Partial<EligibilityVideo> = {}): EligibilityVideo => ({ id, type: "mid_conversation", ...extra });
const ids = (videos: EligibilityVideo[]) => videos.map((video) => video.id);
const base = { currentCharacter: "max", playedVideoIds: [] as string[], extractsShown: 0, minExtractsBeforeCinematic: 2 };

const catalog = [
  v("ext-1", { nature: "extract", characters: ["max"] }),
  v("ext-2", { nature: "extract", characters: ["all"] }),
  v("tr-1", { nature: "transformed", characters: ["max", "emma"] }),
  v("tr-2", { nature: null, characters: null }),
];

describe("selectEligibleVideos", () => {
  it("seen path keeps transformed videos only (empty nature counts as transformed)", () => {
    expect(ids(selectEligibleVideos(catalog, { ...base, path: "seen" }))).toEqual(["tr-1", "tr-2"]);
  });

  it("unseen path offers extracts first while the threshold is not reached", () => {
    expect(ids(selectEligibleVideos(catalog, { ...base, path: "unseen", extractsShown: 1 }))).toEqual(["ext-1", "ext-2"]);
  });

  it("unseen path opens transformed videos once enough extracts were shown", () => {
    expect(ids(selectEligibleVideos(catalog, { ...base, path: "unseen", extractsShown: 2 }))).toEqual(["ext-1", "ext-2", "tr-1", "tr-2"]);
  });

  it("unseen path without any eligible extract keeps the current behaviour", () => {
    const noExtract = catalog.filter((video) => video.nature !== "extract");
    expect(ids(selectEligibleVideos(noExtract, { ...base, path: "unseen" }))).toEqual(["tr-1", "tr-2"]);
    // Extracts all played: transformed videos are no longer held back.
    expect(ids(selectEligibleVideos(catalog, { ...base, path: "unseen", playedVideoIds: ["ext-1", "ext-2"], extractsShown: 1 })))
      .toEqual(["tr-1", "tr-2"]);
  });

  it("unseen path ignores extracts reserved for another character", () => {
    const emmaExtract = [v("ext-emma", { nature: "extract", characters: ["emma"] }), v("tr", { nature: "transformed" })];
    expect(ids(selectEligibleVideos(emmaExtract, { ...base, path: "unseen" }))).toEqual(["tr"]);
  });

  it("unknown path applies no nature filter", () => {
    expect(ids(selectEligibleVideos(catalog, { ...base, path: null }))).toEqual(["ext-1", "ext-2", "tr-1", "tr-2"]);
    expect(ids(selectEligibleVideos(catalog, { ...base, path: undefined }))).toEqual(["ext-1", "ext-2", "tr-1", "tr-2"]);
  });

  it("filters by the character on the line, with all/empty/absent open to everyone", () => {
    const videos = [
      v("max-only", { characters: ["max"] }),
      v("emma-only", { characters: ["emma"] }),
      v("all", { characters: ["all"] }),
      v("empty", { characters: [] }),
      v("absent"),
    ];
    expect(ids(selectEligibleVideos(videos, { ...base, path: "seen", currentCharacter: "emma" })))
      .toEqual(["emma-only", "all", "empty", "absent"]);
  });

  it("excludes intro videos and already played videos", () => {
    const videos = [v("intro", { type: "intro" }), v("Intro2", { type: " Intro " }), v("played"), v("free")];
    expect(ids(selectEligibleVideos(videos, { ...base, path: null, playedVideoIds: ["played"] }))).toEqual(["free"]);
  });

  it("keeps the input order (no chronology imposed)", () => {
    const videos = [v("b", { nature: "extract" }), v("a", { nature: "extract" })];
    expect(ids(selectEligibleVideos(videos, { ...base, path: "unseen" }))).toEqual(["b", "a"]);
  });

  it("with untagged videos the seen path matches today's list except intro", () => {
    const today = [v("x"), v("y", { type: "interlude" }), v("z", { type: "intro" })];
    expect(ids(selectEligibleVideos(today, { ...base, path: "seen" }))).toEqual(["x", "y"]);
  });
});

describe("countPlayedExtracts", () => {
  it("counts only played videos whose nature is extract", () => {
    expect(countPlayedExtracts(catalog, ["ext-1", "tr-1", "unknown"])).toBe(1);
  });
});

describe("videoAvailableForCharacter", () => {
  it("is case-insensitive", () => {
    expect(videoAvailableForCharacter({ characters: ["Max"] }, "max")).toBe(true);
  });
});
