const GUMLET_COLLECTION_ID = "673f29f4a5e1bf70aa645cb7";

export type NativeVideoSource = {
  url: string;
  kind: "hls" | "file";
};

const getGumletAssetId = (url: string) => {
  const match = url.match(/(?:watch|embed)\/([a-f0-9]{24})(?:[/?#]|$)/i);
  return match?.[1] ?? null;
};

/** Convert Gumlet watch/embed pages to direct media URLs controlled by <video>. */
export const resolveNativeVideoSource = (url: string): NativeVideoSource => {
  const assetId = getGumletAssetId(url);
  if (assetId) {
    return {
      url: `https://video.gumlet.io/${GUMLET_COLLECTION_ID}/${assetId}/main.m3u8`,
      kind: "hls",
    };
  }

  return {
    url,
    kind: /\.m3u8(?:$|\?)/i.test(url) ? "hls" : "file",
  };
};

/** Gumlet's default poster frame for a watch/embed URL, or null for other sources. */
export const resolveGumletThumbnailUrl = (url: string | null | undefined): string | null => {
  const assetId = url ? getGumletAssetId(url) : null;
  return assetId ? `https://video.gumlet.io/${GUMLET_COLLECTION_ID}/${assetId}/thumbnail-1-0.png` : null;
};

/**
 * Media buffered ahead before a cinematic starts. Started on its first fragment, the video
 * stalled within seconds (sound cut, stutter), the bandwidth being shared with the live avatar.
 */
export const START_BUFFER_S = 4;
/** Longest wait for that buffer: past it the video starts anyway. */
export const START_BUFFER_MAX_WAIT_MS = 4_000;

/** Seconds of media buffered after the playhead (0 when the playhead is outside every range). */
export function bufferedAheadSeconds(video: Pick<HTMLMediaElement, "buffered" | "currentTime">): number {
  const ranges = video.buffered;
  const at = video.currentTime;
  for (let index = 0; index < ranges.length; index++) {
    if (ranges.start(index) <= at + 0.1 && ranges.end(index) > at) return ranges.end(index) - at;
  }
  return 0;
}
