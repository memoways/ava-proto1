import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { Film, Play, X } from "lucide-react";
import { resolveGumletThumbnailUrl, resolveNativeVideoSource } from "@/services/videoPlayback";

interface CinematicPreviewProps {
  videoUrl: string | null;
  title: string;
  /** Controlled by the list so that only one preview plays at a time. */
  playing: boolean;
  onPlay: () => void;
  onClose: () => void;
}

/**
 * Admin-only 16:9 preview: Gumlet poster frame, swapped for an inline player on
 * demand. Kept apart from GumletVideoPlayer, which owns the player-session rules
 * (single blessed element, skip overlay, completion callbacks).
 */
export default function CinematicPreview({ videoUrl, title, playing, onPlay, onClose }: CinematicPreviewProps) {
  const thumbnailUrl = useMemo(() => resolveGumletThumbnailUrl(videoUrl), [videoUrl]);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => setThumbnailFailed(false), [thumbnailUrl]);

  if (!videoUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-muted-foreground" aria-label="Aucun média">
        <Film className="h-6 w-6" />
      </div>
    );
  }

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        <InlineVideo videoUrl={videoUrl} title={title} />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
          aria-label={`Fermer la lecture de ${title}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group/preview relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground"
      aria-label={`Lire ${title}`}
    >
      {thumbnailUrl && !thumbnailFailed ? (
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          onError={() => setThumbnailFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Film className="h-6 w-6" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/preview:bg-black/30">
        <span className="rounded-full bg-black/60 p-2 text-white">
          <Play className="h-4 w-4 fill-current" />
        </span>
      </span>
    </button>
  );
}

/** jsdom does not implement media playback (same guard as GumletVideoPlayer). */
const canControlNativeMedia = () =>
  typeof window !== "undefined" && !/jsdom/i.test(window.navigator.userAgent);

/** Autoplay may be refused; the controls stay available. */
function tryPlay(video: HTMLVideoElement) {
  if (canControlNativeMedia()) void video.play().catch(() => undefined);
}

function InlineVideo({ videoUrl, title }: { videoUrl: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const source = useMemo(() => resolveNativeVideoSource(videoUrl), [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Same engine order as GumletVideoPlayer: hls.js first, native HLS as fallback.
    if (source.kind === "hls" && Hls.isSupported()) {
      const hls = new Hls();
      hls.attachMedia(video);
      hls.loadSource(source.url);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        tryPlay(video);
      });
      return () => hls.destroy();
    }

    video.src = source.url;
    tryPlay(video);
    return () => {
      if (!canControlNativeMedia()) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [source]);

  return <video ref={videoRef} controls playsInline className="h-full w-full" aria-label={title} />;
}
