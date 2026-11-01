/**
 * Deterministic video eligibility (selection lot 2).
 *
 * Runs before the Game Master sees the video list and again in the director
 * guard. Missing metadata falls back to the sync defaults (nature empty →
 * transformed, characters empty → all) so untagged videos keep today's behaviour.
 */
import type { ExperiencePath } from "@/services/experienceFrame";
import type { VideoTriggerRow } from "@/services/videoTriggerService";

/** Default for `VideoTriggerSettings.MIN_EXTRACTS_BEFORE_CINEMATIC`. */
export const DEFAULT_MIN_EXTRACTS_BEFORE_CINEMATIC = 2;

export type EligibilityVideo = Pick<VideoTriggerRow, "id" | "type"> & Partial<Pick<VideoTriggerRow, "nature" | "characters">>;

export interface VideoEligibilityInput {
  path: ExperiencePath | null | undefined;
  currentCharacter: string;
  playedVideoIds: readonly string[];
  /** Film extracts already shown this session (see `countPlayedExtracts`). */
  extractsShown: number;
  minExtractsBeforeCinematic: number;
}

export function videoNature(video: Pick<EligibilityVideo, "nature">): "extract" | "transformed" {
  return video.nature === "extract" ? "extract" : "transformed";
}

export function videoAvailableForCharacter(video: Pick<EligibilityVideo, "characters">, character: string): boolean {
  const characters = (video.characters ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (characters.length === 0 || characters.includes("all")) return true;
  return characters.includes(character.trim().toLowerCase());
}

function isIntro(video: Pick<EligibilityVideo, "type">): boolean {
  return (video.type ?? "").trim().toLowerCase() === "intro";
}

export function countPlayedExtracts(videos: readonly EligibilityVideo[], playedVideoIds: readonly string[]): number {
  const played = new Set(playedVideoIds);
  return videos.filter((video) => played.has(video.id) && videoNature(video) === "extract").length;
}

export function selectEligibleVideos<T extends EligibilityVideo>(videos: readonly T[], input: VideoEligibilityInput): T[] {
  const played = new Set(input.playedVideoIds);
  const candidates = videos.filter((video) =>
    !isIntro(video)
    && !played.has(video.id)
    && videoAvailableForCharacter(video, input.currentCharacter));

  if (input.path === "seen") return candidates.filter((video) => videoNature(video) === "transformed");
  if (input.path !== "unseen") return candidates;

  const extracts = candidates.filter((video) => videoNature(video) === "extract");
  // No extract left for this character: keep the current behaviour.
  if (extracts.length === 0) return candidates;
  return input.extractsShown >= Math.max(0, input.minExtractsBeforeCinematic) ? candidates : extracts;
}
