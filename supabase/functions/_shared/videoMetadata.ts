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
