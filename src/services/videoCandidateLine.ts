/**
 * One line of the GM "VIDÉOS DISPONIBLES" block (selection lot 3).
 *
 * The GM chooses among eligible candidates by meaning: it reads the editorial
 * Contexte first, then the factual description (human Description, else the
 * AI one), then the themes. Both texts are capped so the block stays bounded.
 */
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export const VIDEO_LINE_TEXT_MAX_CHARS = 300;

/** Single line, no double quotes, capped on a word boundary with an ellipsis. */
export function capVideoText(raw: string | null | undefined, max = VIDEO_LINE_TEXT_MAX_CHARS): string {
  const text = String(raw ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Human Description wins; the AI description only fills an empty one. */
export function factualVideoDescription(video: Pick<VideoTriggerRow, "description" | "ai_description">): string {
  return capVideoText(video.description) || capVideoText(video.ai_description);
}

export function formatVideoCandidateLine(video: VideoTriggerRow): string {
  const themes = (video.themes ?? []).join(", ") || "—";
  const description = factualVideoDescription(video);
  const context = capVideoText(video.context);
  return `- id=${video.id} | titre="${capVideoText(video.title, 120)}" | type=${video.type} | priorité=${video.priority ?? "?"} | thèmes=[${themes}]`
    + (context ? ` | contexte="${context}"` : "")
    + (description ? ` | description="${description}"` : "");
}
