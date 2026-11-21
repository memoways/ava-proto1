// Pure building blocks of the admin "Transcrire" action for spoken film extracts
// (extracts lot 1b). Shared by the transcribe-video edge function and the admin
// editor; no Deno or browser API here so vitest covers every rule.
import { gumletAssetId, MAX_VIDEO_BYTES } from "./videoDescription.ts";

/** The only Notion property transcribe-video writes (plus the unticking exception below). */
export const TRANSCRIPTION_PROPERTY = "Transcription";
/** Human checkbox: only ever set to false, and only when a verified text is replaced. */
export const TRANSCRIPTION_VERIFIED_PROPERTY = "Transcription vérifiée";
export const FORBIDDEN_PROPERTIES = ["Description", "Description IA", "Dialogue"] as const;

export const TRANSCRIBE_VIDEO_MODEL = "google/gemini-2.5-flash";
/** Notion caps one rich_text element at 2000 chars and a property at 100 elements. */
export const NOTION_RICH_TEXT_CHUNK = 2000;
export const NOTION_RICH_TEXT_MAX_ELEMENTS = 100;
export { MAX_VIDEO_BYTES as MAX_AUDIO_BYTES };

/** Sentinel the model answers when nobody speaks; never stored. */
export const NO_SPEECH_SENTINEL = "[AUCUNE PAROLE]";

export const TRANSCRIPTION_PROMPT = [
  "Tu écoutes la bande son d'une courte séquence de film. Transcris uniquement les paroles réellement prononcées.",
  "Règles :",
  "- les paroles exactes, dans l'ordre où elles sont dites, dans la langue parlée : aucune traduction ;",
  "- une réplique par ligne, précédée du locuteur et de deux-points quand tu peux l'identifier avec certitude (« Voix 1 : », « Voix 2 : » sinon, jamais de prénom deviné) ;",
  "- un passage qu'on ne comprend pas : [inaudible] ;",
  "- aucune interprétation, aucune complétion de phrase, aucune correction, aucune description de ce qu'on voit ou des bruits, pas de résumé ;",
  "- pas d'introduction ni de commentaire, ni guillemets, ni mise en forme ;",
  `- si personne ne parle (musique, bruits, silence), réponds exactement : ${NO_SPEECH_SENTINEL}`,
].join("\n");

// ---- Audio rendition (the analysis rendition used for descriptions has no sound) ----

export type AudioRendition =
  | { kind: "audio"; uri: string }
  /** No separate audio group: smallest muxed rendition that declares an audio codec. */
  | { kind: "muxed"; uri: string };

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of line.replace(/^[^:]+:/, "").matchAll(/([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g)) {
    attrs[m[1]] = m[3] ?? m[2];
  }
  return attrs;
}

/**
 * Gumlet masters list video-only renditions plus a separate EXT-X-MEDIA TYPE=AUDIO
 * playlist (an AAC file of a few hundred KB per ten seconds). null → no usable sound.
 */
export function pickAudioRendition(masterPlaylist: string): AudioRendition | null {
  const lines = masterPlaylist.split(/\r?\n/).map((line) => line.trim());
  const audio = lines
    .filter((line) => line.startsWith("#EXT-X-MEDIA:"))
    .map(parseAttributes)
    .filter((attrs) => attrs.TYPE === "AUDIO" && attrs.URI);
  if (audio.length > 0) {
    const preferred = audio.find((attrs) => attrs.DEFAULT === "YES") ?? audio[0];
    return { kind: "audio", uri: preferred.URI };
  }
  const muxed: Array<{ uri: string; height: number }> = [];
  lines.forEach((line, index) => {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
    const attrs = parseAttributes(line);
    if (!/mp4a|ac-3|ec-3|opus/i.test(attrs.CODECS ?? "")) return;
    const uri = lines.slice(index + 1).find((next) => next && !next.startsWith("#"));
    if (uri) muxed.push({ uri, height: Number(attrs.RESOLUTION?.match(/x(\d+)/)?.[1] ?? 0) });
  });
  muxed.sort((a, b) => a.height - b.height);
  return muxed[0] ? { kind: "muxed", uri: muxed[0].uri } : null;
}

export type TranscribeFailure =
  | "no_audio_rendition"
  | "video_too_large"
  | "no_speech_detected"
  | "not_an_extract"
  | "dialogue_silent"
  | "dialogue_missing"
  | "already_transcribed"
  | "verified_requires_confirmation"
  | "transcription_too_long";

// ---- Eligibility ----

export interface TranscribableRow {
  nature?: string | null;
  dialogue?: string | null;
  transcription?: string | null;
  transcription_verified?: boolean | null;
}

const isBlank = (value: string | null | undefined) => !value || !value.trim();

/** Only a film extract labelled "Parlé": never silent, never "not filled in", never a cinematic. */
export function checkTranscribable(row: TranscribableRow): { ok: true } | { ok: false; error: TranscribeFailure } {
  if (row.nature !== "extract") return { ok: false, error: "not_an_extract" };
  if (row.dialogue === "spoken") return { ok: true };
  return { ok: false, error: row.dialogue === "silent" ? "dialogue_silent" : "dialogue_missing" };
}

export interface OverwriteDecision {
  ok: boolean;
  error?: TranscribeFailure;
  /** True when a verified transcription is replaced: the Notion checkbox is then unticked. */
  clearsVerified: boolean;
}

/**
 * An existing transcription is replaced only on explicit re-analysis; a verified one only
 * when the caller also confirmed the overwrite, and the "vérifiée" case is then unticked.
 */
export function decideOverwrite(
  row: TranscribableRow,
  options: { reanalyze?: boolean; confirmOverwriteVerified?: boolean },
): OverwriteDecision {
  if (isBlank(row.transcription)) return { ok: true, clearsVerified: false };
  if (!options.reanalyze) return { ok: false, error: "already_transcribed", clearsVerified: false };
  if (row.transcription_verified === true) {
    return options.confirmOverwriteVerified
      ? { ok: true, clearsVerified: true }
      : { ok: false, error: "verified_requires_confirmation", clearsVerified: false };
  }
  return { ok: true, clearsVerified: false };
}

// ---- Model request and answer ----

/** Primary request: AAC in an MP4 container as audio input. */
export function buildTranscribeRequest(audioBase64: string, mode: "input_audio" | "video_url" = "input_audio") {
  const media = mode === "input_audio"
    ? { type: "input_audio", input_audio: { data: audioBase64, format: "m4a" } }
    : { type: "video_url", video_url: { url: `data:video/mp4;base64,${audioBase64}` } };
  return {
    model: TRANSCRIBE_VIDEO_MODEL,
    messages: [{ role: "user", content: [{ type: "text", text: TRANSCRIPTION_PROMPT }, media] }],
    temperature: 0,
    max_tokens: 4000,
    usage: { include: true },
  };
}

/** Model answer → clean text, or null when there is nothing to store (empty / no speech). */
export function normalizeTranscription(raw: unknown): string | null {
  let text = String(raw ?? "").replace(/\r\n?/g, "\n");
  text = text.replace(/^\s*```[a-z]*\n?|\n?```\s*$/gi, "");
  text = text.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n").trim();
  if (!text) return null;
  const bare = text.replace(/[\s.[\]«»"]/g, "").toLowerCase();
  if (bare === "aucuneparole" || bare === "aucuneparoledétectée" || bare === "aucuneparoledetectee") return null;
  return text;
}

// ---- Notion write ----

/** Cuts at newline, then space, then hard; never empties a chunk. */
export function chunkRichText(text: string, size = NOTION_RICH_TEXT_CHUNK): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = window.lastIndexOf("\n");
    if (cut < size * 0.5) cut = window.lastIndexOf(" ");
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^[ ]/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export interface TranscriptionNotionPatch {
  properties: Record<string, unknown>;
}

export function buildTranscriptionNotionPatch(
  transcription: string,
  options: { clearsVerified?: boolean } = {},
): TranscriptionNotionPatch {
  const chunks = chunkRichText(transcription);
  if (chunks.length > NOTION_RICH_TEXT_MAX_ELEMENTS) throw new Error("transcription_too_long");
  const properties: Record<string, unknown> = {
    [TRANSCRIPTION_PROPERTY]: { rich_text: chunks.map((content) => ({ type: "text", text: { content } })) },
  };
  if (options.clearsVerified) properties[TRANSCRIPTION_VERIFIED_PROPERTY] = { checkbox: false };
  return { properties };
}

/**
 * Guard run before every Notion write: "Transcription" always; "Transcription vérifiée" only
 * as an unticked checkbox; Description / Description IA / Dialogue / anything else never.
 */
export function assertOnlyTranscription(patch: TranscriptionNotionPatch): void {
  const props = patch.properties ?? {};
  const keys = Object.keys(props);
  for (const forbidden of FORBIDDEN_PROPERTIES) {
    if (keys.includes(forbidden)) throw new Error(`transcribe-video must never write "${forbidden}"`);
  }
  if (!keys.includes(TRANSCRIPTION_PROPERTY)) throw new Error(`transcribe-video must write "${TRANSCRIPTION_PROPERTY}"`);
  const extras = keys.filter((key) => key !== TRANSCRIPTION_PROPERTY);
  if (extras.some((key) => key !== TRANSCRIPTION_VERIFIED_PROPERTY)) {
    throw new Error(`transcribe-video may only write "${TRANSCRIPTION_PROPERTY}"`);
  }
  if (extras.length > 0) {
    const verified = props[TRANSCRIPTION_VERIFIED_PROPERTY] as { checkbox?: unknown } | undefined;
    if (!verified || Object.keys(verified).join() !== "checkbox" || verified.checkbox !== false) {
      throw new Error(`transcribe-video may only untick "${TRANSCRIPTION_VERIFIED_PROPERTY}"`);
    }
  }
}

// ---- Request body and bulk selection ----

export type TranscribeVideoBody =
  | { ok: true; notionId: string; reanalyze: boolean; confirmOverwriteVerified: boolean }
  | { ok: false; error: string };

export function parseTranscribeVideoBody(body: unknown): TranscribeVideoBody {
  const raw = (body ?? {}) as Record<string, unknown>;
  const notionId = typeof raw.notion_id === "string" ? raw.notion_id.trim() : "";
  if (!/^[a-f0-9-]{32,36}$/i.test(notionId)) return { ok: false, error: "notion_id is required" };
  return {
    ok: true,
    notionId,
    reanalyze: raw.reanalyze === true,
    confirmOverwriteVerified: raw.confirm_overwrite_verified === true,
  };
}

export interface TranscribableVideo extends TranscribableRow {
  notion_id: string | null;
  video_url: string | null;
}

/**
 * Bulk "Transcrire les extraits parlés sans transcription": spoken extracts with no text.
 * `retranscribe` also includes existing UNVERIFIED transcriptions; a verified one is never
 * selected in bulk (it needs the per-extract explicit confirmation).
 */
export function selectExtractsToTranscribe<T extends TranscribableVideo>(
  videos: readonly T[],
  options: { retranscribe?: boolean } = {},
): T[] {
  return videos.filter((video) => {
    if (!video.notion_id || !gumletAssetId(video.video_url)) return false;
    if (!checkTranscribable(video).ok) return false;
    if (isBlank(video.transcription)) return true;
    return !!options.retranscribe && video.transcription_verified !== true;
  });
}

/** Admin-facing reason an extract has no active "Transcrire" button; null = button active. */
export function transcribeBlockedReason(video: TranscribableVideo): string | null {
  if (!video.notion_id) return "Pas de page Notion liée.";
  if (!gumletAssetId(video.video_url)) return "Pas de média Gumlet.";
  const check = checkTranscribable(video);
  if (!("error" in check)) return null;
  if (check.error === "dialogue_silent") return "Extrait silencieux : pas de transcription.";
  if (check.error === "dialogue_missing") return "Dialogue non renseigné dans Notion : à labelliser (Parlé / Silencieux) d'abord.";
  return "Ce n'est pas un extrait du film.";
}
