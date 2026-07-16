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
