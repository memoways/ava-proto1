import { describe, expect, it } from "vitest";
import {
  AI_DESCRIPTION_MAX_CHARS,
  assertOnlyAiDescription,
  buildAiDescriptionNotionPatch,
  buildDescribeVideoRequest,
  DESCRIBE_VIDEO_MODEL,
  gumletAssetId,
  gumletMasterPlaylistUrl,
  normalizeAiDescription,
  parseDescribeVideoBody,
  pickAnalysisVariant,
  selectVideosToDescribe,
  variantMediaFileUrl,
  VIDEO_DESCRIPTION_PROMPT,
} from "../../supabase/functions/_shared/videoDescription";

// Shapes copied from the real Gumlet catalogue (2026-11-01).
const MASTER = [
  "#EXTM3U",
  '#EXT-X-MEDIA:TYPE=AUDIO,URI="a_0_en_128k.m3u8",GROUP-ID="audio_128k"',
  "#EXT-X-STREAM-INF:BANDWIDTH=1842593,RESOLUTION=1026x540,AUDIO=\"audio_128k\"",
  "a_avc_540p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=983349,RESOLUTION=684x360,AUDIO=\"audio_128k\"",
  "a_avc_360p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=500000,RESOLUTION=426x240",
  "a_avc_240p.m3u8",
  '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=72718,RESOLUTION=684x360,URI="a_avc_360p_iframe.m3u8"',
].join("\n");
const VARIANT = [
  "#EXTM3U",
  '#EXT-X-MAP:URI="a_avc_360p.mp4?token=t&expires=1",BYTERANGE="900@0"',
  "#EXTINF:4.000,",
  "#EXT-X-BYTERANGE:78185@1244",
  "a_avc_360p.mp4?token=t&expires=1",
  "#EXTINF:4.000,",
  "#EXT-X-BYTERANGE:276134",
  "a_avc_360p.mp4?token=t&expires=1",
].join("\n");
const BASE = "https://video.gumlet.io/673f29f4a5e1bf70aa645cb7/6acc8341689a80cf2e4a427d/";

describe("Gumlet media resolution", () => {
  it("reads the asset id from watch, embed and direct media links", () => {
    expect(gumletAssetId("https://gumlet.tv/watch/6ae6fc5f90944ced717fe68b")).toBe("6ae6fc5f90944ced717fe68b");
    expect(gumletAssetId("https://play.gumlet.io/embed/6ae6fc5f90944ced717fe68b?x=1")).toBe("6ae6fc5f90944ced717fe68b");
    expect(gumletAssetId(`${BASE}main.m3u8`)).toBe("6acc8341689a80cf2e4a427d");
    expect(gumletAssetId("https://example.com/video.mp4")).toBeNull();
    expect(gumletAssetId(null)).toBeNull();
  });

  it("targets the public master playlist", () => {
    expect(gumletMasterPlaylistUrl("6acc8341689a80cf2e4a427d")).toBe(`${BASE}main.m3u8`);
  });

  it("picks the smallest rendition at 360p or more, ignoring I-frame playlists", () => {
    expect(pickAnalysisVariant(MASTER)).toBe("a_avc_360p.m3u8");
  });

  it("falls back to the largest rendition below 360p, null without renditions", () => {
    expect(pickAnalysisVariant("#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=320x180\nlow.m3u8\n#EXT-X-STREAM-INF:RESOLUTION=426x240\nmid.m3u8"))
      .toBe("mid.m3u8");
    expect(pickAnalysisVariant("#EXTM3U")).toBeNull();
  });

  it("resolves the single fragmented MP4 behind a byte-range playlist", () => {
    expect(variantMediaFileUrl(VARIANT, `${BASE}a_avc_360p.m3u8`)).toBe(`${BASE}a_avc_360p.mp4?token=t&expires=1`);
  });

  it("refuses playlists made of distinct segment files or without a map", () => {
    const segmented = VARIANT.replace(/a_avc_360p\.mp4\?token=t&expires=1$/, "seg2.m4s");
    expect(variantMediaFileUrl(segmented, `${BASE}a_avc_360p.m3u8`)).toBeNull();
    expect(variantMediaFileUrl("#EXTM3U\n#EXTINF:4,\nseg1.ts", `${BASE}x.m3u8`)).toBeNull();
  });
});

describe("analysis request and instruction", () => {
  it("sends the video inline to Gemini 2.5 Flash with the instruction", () => {
    const request = buildDescribeVideoRequest("QUJD");
    expect(request.model).toBe(DESCRIBE_VIDEO_MODEL);
    expect(DESCRIBE_VIDEO_MODEL).toBe("google/gemini-2.5-flash");
    const [text, video] = request.messages[0].content;
    expect(text).toEqual({ type: "text", text: VIDEO_DESCRIPTION_PROMPT });
    expect(video).toEqual({ type: "video_url", video_url: { url: "data:video/mp4;base64,QUJD" } });
    expect(request.usage).toEqual({ include: true });
  });

  it("asks for an objective French description without narrative interpretation", () => {
    expect(VIDEO_DESCRIPTION_PROMPT).toContain("objectivement");
    expect(VIDEO_DESCRIPTION_PROMPT).toMatch(/personnages.*lieu.*actions.*ambiance/s);
    expect(VIDEO_DESCRIPTION_PROMPT).toContain("en français");
    expect(VIDEO_DESCRIPTION_PROMPT).toContain("aucune interprétation narrative");
    expect(VIDEO_DESCRIPTION_PROMPT).toContain("300 caractères");
  });

  it("never sends the editorial context or the human description to the model", () => {
    const body = JSON.stringify(buildDescribeVideoRequest("QUJD"));
    expect(body).not.toMatch(/contexte="|Contexte :|description="/);
  });
});

describe("Description IA output", () => {
  it("normalizes to one line without wrapping quotes", () => {
    expect(normalizeAiDescription('  « Un homme marche\n dans la neige. »  ')).toBe("Un homme marche dans la neige.");
    expect(normalizeAiDescription(undefined)).toBe("");
  });

  it("caps at 300 characters on a word boundary", () => {
    const capped = normalizeAiDescription("neige ".repeat(80));
    expect(capped.length).toBeLessThanOrEqual(AI_DESCRIPTION_MAX_CHARS);
    expect(capped.endsWith("…")).toBe(true);
    expect(capped).not.toMatch(/ne…$/);
  });

  it("builds a Notion patch holding Description IA and nothing else", () => {
    const patch = buildAiDescriptionNotionPatch("Une femme regarde le feu.");
    expect(Object.keys(patch.properties)).toEqual(["Description IA"]);
    expect(patch.properties["Description IA"]).toEqual({
      rich_text: [{ type: "text", text: { content: "Une femme regarde le feu." } }],
    });
    expect(() => assertOnlyAiDescription(patch)).not.toThrow();
  });

  it("guard: never Description, never another field", () => {
    expect(() => assertOnlyAiDescription({ properties: { Description: {} } })).toThrow(/human Description/);
    expect(() => assertOnlyAiDescription({ properties: { "Description IA": {}, Description: {} } })).toThrow(/human Description/);
    expect(() => assertOnlyAiDescription({ properties: { "Description IA": {}, Contexte: {} } })).toThrow(/only write/);
    expect(() => assertOnlyAiDescription({ properties: {} })).toThrow(/only write/);
  });
});

describe("request body", () => {
  it("requires a Notion page id", () => {
    expect(parseDescribeVideoBody({ notion_id: "40b62322-e595-80f9-b5bb-c177ffbda6f9" }))
      .toEqual({ ok: true, notionId: "40b62322-e595-80f9-b5bb-c177ffbda6f9" });
    expect(parseDescribeVideoBody({})).toEqual({ ok: false, error: "notion_id is required" });
    expect(parseDescribeVideoBody({ notion_id: "../users" }).ok).toBe(false);
    expect(parseDescribeVideoBody(null).ok).toBe(false);
  });
});

describe("videos to analyse", () => {
  const url = "https://gumlet.tv/watch/6ae6fc5f90944ced717fe68b";
  const videos = [
    { id: "empty", notion_id: "n1", video_url: url, description: "", ai_description: "" },
    { id: "nulls", notion_id: "n2", video_url: url, description: null, ai_description: null },
    { id: "human", notion_id: "n3", video_url: url, description: "Max tient un fusil.", ai_description: "" },
    { id: "ai", notion_id: "n4", video_url: url, description: "  ", ai_description: "Un homme seul." },
    { id: "no-notion", notion_id: null, video_url: url, description: "", ai_description: "" },
    { id: "no-media", notion_id: "n6", video_url: null, description: "", ai_description: "" },
    { id: "foreign-media", notion_id: "n7", video_url: "https://example.com/a.mp4", description: "", ai_description: "" },
  ];

  it("keeps only videos whose Description and Description IA are both empty", () => {
    expect(selectVideosToDescribe(videos).map((v) => v.id)).toEqual(["empty", "nulls"]);
  });

  it("re-analysis adds existing Descriptions IA, never human Descriptions", () => {
    expect(selectVideosToDescribe(videos, { reanalyze: true }).map((v) => v.id)).toEqual(["empty", "nulls", "ai"]);
  });
});
