// Mapping of the "🎬 Vidéos AVA" selection fields (Nature, Personnages) to
// video_triggers columns. Pure functions shared by sync-notion and unit tests.

export type VideoNature = "extract" | "transformed";

/** Current online videos are all transformed: empty or unknown → transformed. */
export const DEFAULT_VIDEO_NATURE: VideoNature = "transformed";

/** "Tous" or an empty Personnages field means the video is available to everyone. */
export const ALL_CHARACTERS = "all";

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function mapVideoNature(value: string | null | undefined): VideoNature {
  const label = normalizeLabel(value ?? "");
  if (label === "extract" || label.startsWith("extrait")) return "extract";
  return DEFAULT_VIDEO_NATURE;
}

export function mapVideoCharacters(values: readonly string[] | null | undefined): string[] {
  const ids: string[] = [];
  for (const value of values ?? []) {
    const id = normalizeLabel(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!id) continue;
    if (id === "tous" || id === ALL_CHARACTERS) return [ALL_CHARACTERS];
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.length ? ids : [ALL_CHARACTERS];
}

export const VIDEO_METADATA_COLUMNS = ["nature", "characters", "ai_description"] as const;

/**
 * True when a write failed only because the additive migration adding the
 * metadata columns is not applied yet; the caller then retries without them.
 */
export function isMissingVideoMetadataColumnError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) return false;
  const message = error.message ?? "";
  return VIDEO_METADATA_COLUMNS.some((column) => message.includes(column));
}

// ---- Film extracts: transcription and dialogue (extracts lot 1) ----

export type VideoDialogue = "spoken" | "silent";

/** Notion select « Dialogue » → column. Empty or unknown → null (not filled in). */
export function mapVideoDialogue(value: string | null | undefined): VideoDialogue | null {
  const label = normalizeLabel(value ?? "");
  if (label === "parle" || label === "spoken") return "spoken";
  if (label === "silencieux" || label === "silent") return "silent";
  return null;
}

/** Notion « Transcription »: trimmed; absent or cleared → null so a deletion reaches the database. */
export function mapVideoTranscription(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  return text ? text : null;
}

export const EXTRACT_METADATA_COLUMNS = ["transcription", "dialogue", "transcription_verified"] as const;

/** True when a write failed only because the transcription migration is not applied yet. */
export function isMissingExtractColumnError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error || (error.code !== "PGRST204" && error.code !== "42703")) return false;
  const message = error.message ?? "";
  return EXTRACT_METADATA_COLUMNS.some((column) => message.includes(column));
}

export type ExtractTranscriptStatus =
  /** No dialogue: can be layered over the character's voice. */
  | "silent"
  /** Spoken, transcription present and checked by a human: usable. */
  | "spoken_verified"
  /** Spoken, transcription present but not checked: not a reliable basis. */
  | "spoken_unverified"
  /** Spoken, no transcription. */
  | "spoken_missing"
  /** Dialogue not filled in: treated as unreliable, never as silent. */
  | "unknown";

export interface ExtractTranscriptFields {
  dialogue?: VideoDialogue | string | null;
  transcription?: string | null;
  transcription_verified?: boolean | null;
}

export function extractTranscriptStatus(video: ExtractTranscriptFields): ExtractTranscriptStatus {
  const dialogue = mapVideoDialogue(video.dialogue);
  if (dialogue === "silent") return "silent";
  if (dialogue !== "spoken") return "unknown";
  if (!mapVideoTranscription(video.transcription)) return "spoken_missing";
  return video.transcription_verified === true ? "spoken_verified" : "spoken_unverified";
}

/** A spoken extract is usable for selection only with a verified transcription. */
export function isExtractTranscriptReliable(video: ExtractTranscriptFields): boolean {
  const status = extractTranscriptStatus(video);
  return status === "silent" || status === "spoken_verified";
}
