import { describe, expect, it } from "vitest";
import {
  assertOnlyTranscription,
  buildTranscribeRequest,
  buildTranscriptionNotionPatch,
  checkTranscribable,
  chunkRichText,
  decideOverwrite,
  normalizeTranscription,
  parseTranscribeVideoBody,
  pickAudioRendition,
  selectExtractsToTranscribe,
  transcribeBlockedReason,
  TRANSCRIPTION_PROMPT,
} from "../../supabase/functions/_shared/videoTranscription";

const GUMLET_MASTER = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,URI="a_0_en_192k.m3u8",GROUP-ID="audio_192k",LANGUAGE="en",NAME="English",DEFAULT=YES,AUTOSELECT=YES,CHANNELS="2"
#EXT-X-STREAM-INF:BANDWIDTH=915058,CODECS="avc1.64001e,mp4a.40.2",RESOLUTION=640x360,AUDIO="audio_192k"
a_0_360p.m3u8
`;
const ASSET = "6a3177ccbf17ac22ca44a8bc";
const spoken = { notion_id: "n1", video_url: `https://gumlet.tv/watch/${ASSET}`, nature: "extract", dialogue: "spoken" as const };

describe("pickAudioRendition", () => {
  it("returns the separate audio playlist of a Gumlet master", () => {
    expect(pickAudioRendition(GUMLET_MASTER)).toEqual({ kind: "audio", uri: "a_0_en_192k.m3u8" });
  });
  it("prefers the DEFAULT audio group", () => {
    const m = `#EXT-X-MEDIA:TYPE=AUDIO,URI="fr.m3u8",NAME="Fr"\n#EXT-X-MEDIA:TYPE=AUDIO,URI="en.m3u8",DEFAULT=YES\n`;
    expect(pickAudioRendition(m)).toEqual({ kind: "audio", uri: "en.m3u8" });
  });
  it("falls back to the smallest muxed rendition that declares audio", () => {
    const m = `#EXT-X-STREAM-INF:CODECS="avc1.1,mp4a.40.2",RESOLUTION=1280x720\nhd.m3u8\n#EXT-X-STREAM-INF:CODECS="avc1.1,mp4a.40.2",RESOLUTION=640x360\nsd.m3u8\n`;
    expect(pickAudioRendition(m)).toEqual({ kind: "muxed", uri: "sd.m3u8" });
  });
  it("returns null for a video-only master: never an invented sound", () => {
    const m = `#EXT-X-STREAM-INF:CODECS="avc1.64001e",RESOLUTION=640x360\nsd.m3u8\n`;
    expect(pickAudioRendition(m)).toBeNull();
    expect(pickAudioRendition("")).toBeNull();
  });
});

describe("eligibility", () => {
  it("accepts only spoken extracts", () => {
    expect(checkTranscribable(spoken)).toEqual({ ok: true });
    expect(checkTranscribable({ ...spoken, dialogue: "silent" })).toEqual({ ok: false, error: "dialogue_silent" });
    expect(checkTranscribable({ ...spoken, dialogue: null })).toEqual({ ok: false, error: "dialogue_missing" });
    expect(checkTranscribable({ ...spoken, nature: "transformed" })).toEqual({ ok: false, error: "not_an_extract" });
    expect(checkTranscribable({ ...spoken, nature: null })).toEqual({ ok: false, error: "not_an_extract" });
  });
  it("explains why a button is inactive", () => {
    expect(transcribeBlockedReason(spoken)).toBeNull();
    expect(transcribeBlockedReason({ ...spoken, dialogue: "silent" })).toMatch(/silencieux/);
    expect(transcribeBlockedReason({ ...spoken, dialogue: null })).toMatch(/non renseigné/);
  });
});

describe("decideOverwrite", () => {
  it("allows an empty transcription", () => {
    expect(decideOverwrite({}, {})).toEqual({ ok: true, clearsVerified: false });
  });
  it("never replaces existing text without reanalyze", () => {
    expect(decideOverwrite({ transcription: "x" }, {})).toMatchObject({ ok: false, error: "already_transcribed" });
  });
  it("replaces an unverified text on reanalyze", () => {
    expect(decideOverwrite({ transcription: "x", transcription_verified: false }, { reanalyze: true })).toEqual({ ok: true, clearsVerified: false });
  });
  it("needs confirmation for a verified text, then unticks the case", () => {
    const row = { transcription: "x", transcription_verified: true };
    expect(decideOverwrite(row, { reanalyze: true })).toMatchObject({ ok: false, error: "verified_requires_confirmation" });
    expect(decideOverwrite(row, { confirmOverwriteVerified: true })).toMatchObject({ ok: false, error: "already_transcribed" });
    expect(decideOverwrite(row, { reanalyze: true, confirmOverwriteVerified: true })).toEqual({ ok: true, clearsVerified: true });
  });
});

describe("prompt and answer", () => {
  it("forbids interpretation, translation and visuals and defines the markers", () => {
    for (const needle of ["[inaudible]", "Voix 1", "Voix 2", "aucune traduction", "aucune interprétation", "[AUCUNE PAROLE]"]) {
      expect(TRANSCRIPTION_PROMPT).toContain(needle);
    }
  });
  it("builds the audio request and its MP4 fallback", () => {
    const a = buildTranscribeRequest("QUJD");
    expect(a.messages[0].content[1]).toEqual({ type: "input_audio", input_audio: { data: "QUJD", format: "m4a" } });
    const v = buildTranscribeRequest("QUJD", "video_url");
    expect(v.messages[0].content[1]).toEqual({ type: "video_url", video_url: { url: "data:video/mp4;base64,QUJD" } });
    expect(a.temperature).toBe(0);
  });
  it("normalises lines and strips fences", () => {
    expect(normalizeTranscription("```\nVoix 1 :  Bonjour.  \n\n Voix 2 : [inaudible]\n```")).toBe("Voix 1 : Bonjour.\nVoix 2 : [inaudible]");
  });
  it("returns null for no speech or empty answers", () => {
    for (const raw of ["[AUCUNE PAROLE]", " [Aucune parole]. ", "aucune parole détectée", "", "  ", null, undefined]) {
      expect(normalizeTranscription(raw)).toBeNull();
    }
  });
});

describe("Notion write", () => {
  it("splits long text into rich_text elements of at most 2000 chars without losing words", () => {
    const text = Array.from({ length: 900 }, (_, i) => `mot${i}`).join(" ");
    const chunks = chunkRichText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2000 && c.length > 0)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("writes Transcription only", () => {
    const patch = buildTranscriptionNotionPatch("Voix 1 : Bonjour.");
    expect(Object.keys(patch.properties)).toEqual(["Transcription"]);
    expect(() => assertOnlyTranscription(patch)).not.toThrow();
  });
  it("unticks 'Transcription vérifiée' only when asked, as false", () => {
    const patch = buildTranscriptionNotionPatch("x", { clearsVerified: true });
    expect(patch.properties["Transcription vérifiée"]).toEqual({ checkbox: false });
    expect(() => assertOnlyTranscription(patch)).not.toThrow();
  });
  it("fails past Notion's 100-element limit", () => {
    expect(() => buildTranscriptionNotionPatch("a ".repeat(110_000))).toThrow("transcription_too_long");
  });
  it("guard refuses Description, Description IA, Dialogue, ticking the case, and foreign properties", () => {
    const t = { rich_text: [] };
    for (const key of ["Description", "Description IA", "Dialogue"]) {
      expect(() => assertOnlyTranscription({ properties: { Transcription: t, [key]: {} } })).toThrow();
    }
    expect(() => assertOnlyTranscription({ properties: { Transcription: t, "Transcription vérifiée": { checkbox: true } } })).toThrow();
    expect(() => assertOnlyTranscription({ properties: { Transcription: t, Autre: {} } })).toThrow();
    expect(() => assertOnlyTranscription({ properties: { "Transcription vérifiée": { checkbox: false } } })).toThrow();
  });
});

describe("body and bulk selection", () => {
  it("parses the body", () => {
    expect(parseTranscribeVideoBody({})).toMatchObject({ ok: false });
    expect(parseTranscribeVideoBody({ notion_id: "40b62322-e595-80f9-b5bb-c177ffbda6f9", reanalyze: true })).toMatchObject({ ok: true, reanalyze: true, confirmOverwriteVerified: false });
  });
  it("selects spoken extracts without transcription; retranscribe adds unverified ones, never verified", () => {
    const rows = [
      { ...spoken, notion_id: "a" },
      { ...spoken, notion_id: "b", transcription: "x", transcription_verified: false },
      { ...spoken, notion_id: "c", transcription: "x", transcription_verified: true },
      { ...spoken, notion_id: "d", dialogue: "silent" as const },
      { ...spoken, notion_id: "e", dialogue: null },
      { ...spoken, notion_id: "f", nature: "transformed" },
      { ...spoken, notion_id: null },
      { ...spoken, notion_id: "g", video_url: null },
    ];
    expect(selectExtractsToTranscribe(rows).map((r) => r.notion_id)).toEqual(["a"]);
    expect(selectExtractsToTranscribe(rows, { retranscribe: true }).map((r) => r.notion_id)).toEqual(["a", "b"]);
  });
});
