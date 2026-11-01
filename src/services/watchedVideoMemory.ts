/**
 * What the player has seen (video selection lot 5).
 *
 * - Post-video context: the full editorial Contexte of the video just played
 *   (catalogue max 600 chars) plus what it showed (Description, else AI
 *   description), for the next turn only.
 * - Watched videos: an ordered session list of played videos, the last three
 *   rendered as one compact block shared verbatim by the GM and the character,
 *   so a later allusion ("la scène du feu") is understood.
 *
 * A video ignored or dropped before playback never enters memory (it was not
 * seen). A video skipped during playback does, flagged as partly seen.
 */
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export const POST_VIDEO_CONTEXT_MAX_CHARS = 650;
export const POST_VIDEO_SHOWS_MAX_CHARS = 300;
/** Character prompt cap for the post-video section (context + shows + label). */
export const POST_VIDEO_SECTION_MAX_CHARS = 1_000;
export const WATCHED_VIDEOS_KEPT = 3;
export const WATCHED_VIDEOS_SECTION_TITLE = "VIDÉOS DÉJÀ VUES PAR LE JOUEUR";
export const WATCHED_VIDEO_TITLE_MAX_CHARS = 80;
export const WATCHED_VIDEO_SHOWS_MAX_CHARS = 140;
/** Character prompt cap for the watched videos section. */
export const WATCHED_VIDEOS_SECTION_MAX_CHARS = 750;

export interface WatchedVideo {
  id: string;
  title: string;
  /** What the video shows, already capped on a word boundary. */
  shows: string;
  /** GM turn that started the video; null when unknown. */
  turn: number | null;
  /** Skipped during playback: the player saw only its beginning. */
  partial: boolean;
}

type VideoText = Pick<VideoTriggerRow, "context" | "post_video_context" | "description" | "ai_description">;

/** One line, capped on a word boundary, never inside a word; "…" marks a cut. */
export function capAtWord(raw: string | null | undefined, max: number): string {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const head = text.slice(0, Math.max(0, max)); // room for the ellipsis below
  const lastSpace = head.lastIndexOf(" ");
  if (lastSpace <= 0) return "";
  return `${head.slice(0, lastSpace).replace(/[\s,;:–—-]+$/u, "")}…`;
}

/** Human Description wins; the AI description only fills an empty one. */
function rawShows(video: Pick<VideoTriggerRow, "description" | "ai_description">): string {
  return video.description?.trim() || video.ai_description?.trim() || "";
}

export function buildPostVideoContext(video: VideoText): string | null {
  const context = capAtWord(video.context || video.post_video_context, POST_VIDEO_CONTEXT_MAX_CHARS);
  const shows = capAtWord(rawShows(video), POST_VIDEO_SHOWS_MAX_CHARS);
  const text = [context, shows ? `Ce que la vidéo montrait : ${shows}` : ""].filter(Boolean).join("\n");
  return text || null;
}

export function watchedVideoFrom(
  video: Pick<VideoTriggerRow, "id" | "title" | "description" | "ai_description">,
  turn: number | null,
  partial: boolean,
): WatchedVideo {
  return {
    id: video.id,
    title: capAtWord(video.title, WATCHED_VIDEO_TITLE_MAX_CHARS),
    shows: capAtWord(rawShows(video), WATCHED_VIDEO_SHOWS_MAX_CHARS),
    turn,
    partial,
  };
}

/** Appends in viewing order; a replayed id moves to the end instead of doubling. */
export function rememberWatchedVideo(list: readonly WatchedVideo[], entry: WatchedVideo): WatchedVideo[] {
  return [...list.filter((video) => video.id !== entry.id), entry];
}

/** The block shared by GM and character: last videos, oldest first. */
export function formatWatchedVideos(list: readonly WatchedVideo[], kept = WATCHED_VIDEOS_KEPT): string {
  return list.slice(-kept).map((video) => {
    const details = [video.turn == null ? "" : `tour ${video.turn}`, video.partial ? "passée avant la fin" : ""]
      .filter(Boolean).join(", ");
    return `- « ${video.title} »${details ? ` (${details})` : ""}${video.shows ? ` : ${video.shows}` : ""}`;
  }).join("\n");
}
