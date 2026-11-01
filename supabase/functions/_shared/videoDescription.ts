// Pure building blocks of the admin "Description IA" analysis (selection lot 4).
// Shared by the describe-video edge function and the admin editor; no Deno or
// browser API here so vitest covers every rule.

/** The only Notion property describe-video may ever write. */
export const AI_DESCRIPTION_PROPERTY = "Description IA";
/** Human property: never read for the analysis, never written. */
export const HUMAN_DESCRIPTION_PROPERTY = "Description";

export const DESCRIBE_VIDEO_MODEL = "google/gemini-2.5-flash";
export const AI_DESCRIPTION_MAX_CHARS = 300;
/** Gemini inline requests stay under 20 MB; base64 adds a third. */
export const MAX_VIDEO_BYTES = 12 * 1024 * 1024;

// Same collection as src/services/videoPlayback.ts (player left untouched by this lot).
export const GUMLET_COLLECTION_ID = "673f29f4a5e1bf70aa645cb7";
const GUMLET_MEDIA_BASE = `https://video.gumlet.io/${GUMLET_COLLECTION_ID}`;

export const VIDEO_DESCRIPTION_PROMPT = [
  "Tu regardes une courte séquence vidéo, sans le son.",
  "Décris objectivement ce qu'on voit : personnages (apparence, attitude), lieu, actions, lumière et ambiance visuelle.",
  "Règles :",
  "- en français, au présent, une ou deux phrases, 300 caractères au plus ;",
  "- seulement ce qui est visible à l'écran : aucune interprétation narrative, aucune intention prêtée, aucun nom propre deviné ;",
  "- pas d'introduction ni de commentaire (« La vidéo montre… » est inutile) ;",
  "- réponds par la description seule, sans guillemets ni mise en forme.",
].join("\n");

export function gumletAssetId(url: string | null | undefined): string | null {
  const match = (url ?? "").match(/(?:watch|embed)\/([a-f0-9]{24})(?:[/?#]|$)/i)
    ?? (url ?? "").match(/video\.gumlet\.io\/[a-f0-9]{24}\/([a-f0-9]{24})\//i);
  return match?.[1] ?? null;
}

export function gumletMasterPlaylistUrl(assetId: string): string {
  return `${GUMLET_MEDIA_BASE}/${assetId}/main.m3u8`;
}

interface HlsVariant {
  uri: string;
  height: number;
}

/** Smallest rendition at 360p or more (enough to see, light to send); else the largest. */
export function pickAnalysisVariant(masterPlaylist: string): string | null {
  const lines = masterPlaylist.split(/\r?\n/).map((line) => line.trim());
  const variants: HlsVariant[] = [];
  lines.forEach((line, index) => {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
    const uri = lines.slice(index + 1).find((next) => next && !next.startsWith("#"));
    const height = Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0);
    if (uri) variants.push({ uri, height });
  });
  if (variants.length === 0) return null;
  const usable = variants.filter((v) => v.height >= 360).sort((a, b) => a.height - b.height);
  return (usable[0] ?? [...variants].sort((a, b) => b.height - a.height)[0]).uri;
}

/**
 * Gumlet renditions are single fragmented MP4 files addressed by byte ranges:
 * the EXT-X-MAP file, fetched without a range, is the whole video track.
 */
export function variantMediaFileUrl(variantPlaylist: string, variantUrl: string): string | null {
  const map = variantPlaylist.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
  if (!map) return null;
  const mapPath = map.split("?")[0];
  const segments = variantPlaylist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  // A playlist of distinct segment files cannot be rebuilt into one MP4 here.
  if (segments.some((segment) => segment.split("?")[0] !== mapPath)) return null;
  return new URL(map, variantUrl).toString();
}

export function buildDescribeVideoRequest(videoBase64: string, mimeType = "video/mp4") {
  return {
    model: DESCRIBE_VIDEO_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VIDEO_DESCRIPTION_PROMPT },
          { type: "video_url", video_url: { url: `data:${mimeType};base64,${videoBase64}` } },
        ],
      },
    ],
    temperature: 0.2,
    // Room for Gemini 2.5 thinking before the short answer.
    max_tokens: 1200,
    usage: { include: true },
  };
}

/** One line, no wrapping quotes, capped at a word boundary. */
export function normalizeAiDescription(raw: unknown): string {
  const text = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["«“\s]+|["»”\s]+$/g, "")
    .trim();
  if (text.length <= AI_DESCRIPTION_MAX_CHARS) return text;
  const cut = text.slice(0, AI_DESCRIPTION_MAX_CHARS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > AI_DESCRIPTION_MAX_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Notion PATCH body: "Description IA" and nothing else, by construction. */
export function buildAiDescriptionNotionPatch(description: string) {
  const content = normalizeAiDescription(description);
  return {
    properties: {
      [AI_DESCRIPTION_PROPERTY]: {
        rich_text: content ? [{ type: "text", text: { content } }] : [],
      },
    },
  };
}

/** Guard run before every Notion write: refuses any other property, Description first. */
export function assertOnlyAiDescription(patch: { properties: Record<string, unknown> }): void {
  const keys = Object.keys(patch.properties ?? {});
  if (keys.includes(HUMAN_DESCRIPTION_PROPERTY)) {
    throw new Error("describe-video must never write the human Description");
  }
  if (keys.length !== 1 || keys[0] !== AI_DESCRIPTION_PROPERTY) {
    throw new Error(`describe-video may only write "${AI_DESCRIPTION_PROPERTY}"`);
  }
}

export type DescribeVideoBody = { ok: true; notionId: string } | { ok: false; error: string };

export function parseDescribeVideoBody(body: unknown): DescribeVideoBody {
  const notionId = typeof (body as { notion_id?: unknown } | null)?.notion_id === "string"
    ? (body as { notion_id: string }).notion_id.trim()
    : "";
  if (!/^[a-f0-9-]{32,36}$/i.test(notionId)) return { ok: false, error: "notion_id is required" };
  return { ok: true, notionId };
}

export interface DescribableVideo {
  notion_id: string | null;
  video_url: string | null;
  description?: string | null;
  ai_description?: string | null;
}

const isBlank = (value: string | null | undefined) => !value || !value.trim();

/**
 * Bulk "Analyser les vidéos sans description": only videos whose Description and
 * Description IA are both empty; `reanalyze` lifts the Description IA condition only.
 * Videos without a Notion page or a Gumlet asset are never sent.
 */
export function selectVideosToDescribe<T extends DescribableVideo>(
  videos: readonly T[],
  options: { reanalyze?: boolean } = {},
): T[] {
  return videos.filter((video) =>
    !!video.notion_id
    && !!gumletAssetId(video.video_url)
    && isBlank(video.description)
    && (options.reanalyze || isBlank(video.ai_description))
  );
}
