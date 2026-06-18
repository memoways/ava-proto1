import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import Hls from "hls.js";
import { Player } from "@gumlet/player.js";

const GUMLET_COLLECTION_ID = "673f29f4a5e1bf70aa645cb7";

export interface GumletVideoPlayerHandle {
  playWithAudio: () => void;
}

interface GumletVideoPlayerProps {
  videoUrl: string;
  onComplete: () => void;
  onSkip: () => void;
  onReady?: () => void;
  /** Keep mounted/preloaded but visually hidden until the experience starts. */
  active?: boolean;
  /** Whether the player should request autoplay. */
  autoPlay?: boolean;
  /** Show the skip button overlay. */
  showSkip?: boolean;
  /** Optional overlay content (e.g. HUD) rendered on top of the video */
  children?: React.ReactNode;
}

/**
 * Full-screen responsive Gumlet video player via iframe embed.
 * Only play/pause + volume controls are shown (configured via Gumlet dashboard).
 * Includes a "Passer" skip button overlay.
 */
const GumletVideoPlayer = forwardRef<GumletVideoPlayerHandle, GumletVideoPlayerProps>(({
  videoUrl,
  onComplete,
  onSkip,
  onReady,
  active = true,
  autoPlay = true,
  showSkip = true,
  children,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onReadyRef = useRef(onReady);
  const hasCompletedRef = useRef(false);
  onCompleteRef.current = onComplete;
  onReadyRef.current = onReady;


  const isGumletEndedMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") return false;

    const message = data as { type?: string; event?: string };
    return message.type === "gumlet" && message.event === "ended";
  }, []);

  // Extract asset ID from various Gumlet URL formats
  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onCompleteRef.current();
  }, []);

  const forceAudioOn = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      try {
        if (/jsdom/i.test(window.navigator.userAgent)) {
          video.muted = false;
          video.defaultMuted = false;
          video.volume = 1;
          return;
        }
        // Classic autoplay trick: start muted so play() always succeeds, then
        // immediately unmute. With user activation (from the « Commencer »
        // click), unmuting is allowed by all browsers.
        const playAttempt = video.play();
        const unmute = () => {
          video.muted = false;
          video.defaultMuted = false;
          video.volume = 1;
        };
        if (playAttempt && typeof playAttempt.then === "function") {
          playAttempt.then(unmute).catch(() => {
            // play() rejected: start muted then retry, then unmute.
            video.muted = true;
            const retry = video.play();
            if (retry && typeof retry.then === "function") {
              retry.then(unmute).catch(() => { /* still blocked */ });
            }
          });
        } else {
          unmute();
        }
      } catch {
        // silent: test environments and some browsers may throw synchronously.
      }
    }

    const player = playerRef.current;
    if (!player) return;
    try {
      // Do not await here: all three commands must be dispatched in the same
      // user-gesture call stack when triggered by « Commencer ».
      void player.play().catch(() => { /* Browser may still require a gesture. */ });
      void player.setVolume(100).catch(() => { /* silent */ });
      void player.unmute().catch(() => { /* silent */ });
      void player.play().catch(() => { /* Browser may still require a gesture. */ });
    } catch {
      // silent: autoplay policies vary by browser/device.
    }
  }, []);

  const getGumletAssetId = useCallback((url: string) => {
    const match = url.match(/(?:watch|embed)\/([a-f0-9]+)/i);
    return match?.[1] ?? null;
  }, []);

  const getEmbedUrl = useCallback((url: string) => {
    const withAudioDefaults = (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        parsed.searchParams.set("preload", "true");
        parsed.searchParams.set("autoplay", autoPlay ? "true" : "false");
        parsed.searchParams.set("muted", "false");
        parsed.searchParams.set("volume", "100");
        parsed.searchParams.set("playsinline", "true");
        return parsed.toString();
      } catch {
        const separator = rawUrl.includes("?") ? "&" : "?";
        return `${rawUrl}${separator}preload=true&autoplay=${autoPlay ? "true" : "false"}&muted=false&volume=100&playsinline=true`;
      }
    };

    if (url.includes("play.gumlet.io/embed/")) return withAudioDefaults(url);
    const match = url.match(/(?:watch|embed)\/([a-f0-9]+)/i);
    if (match) {
      const assetId = match[1];
      return withAudioDefaults(`https://play.gumlet.io/embed/${assetId}`);
    }
    return withAudioDefaults(url);
  }, [autoPlay]);

  const embedUrl = getEmbedUrl(videoUrl);
  const gumletAssetId = getGumletAssetId(videoUrl);
  const hlsUrl = videoUrl.endsWith(".m3u8") ? videoUrl : null;

  useImperativeHandle(ref, () => ({
    playWithAudio: () => {
      forceAudioOn();
    },
  }), [forceAudioOn]);

  useEffect(() => {
    hasCompletedRef.current = false;
  }, [embedUrl]);

  // Force audio ON: unmute on ready, on play, periodically during the first
  // seconds, and on any user gesture (fallback if browser re-mutes autoplay).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let player: Player | null = null;
    let cancelled = false;
    let retryCount = 0;
    const forceAudioOnIfActive = () => {
      if (active) forceAudioOn();
    };
    const handleReady = () => {
      onReadyRef.current?.();
      forceAudioOnIfActive();
    };

    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        player = new Player(iframe);
        playerRef.current = player;
        player.on("ready", handleReady);
        player.on("play", forceAudioOnIfActive);
        player.on("ended", completeOnce);
        player.on("timeupdate", () => {
          if (retryCount < 6) {
            retryCount += 1;
            forceAudioOnIfActive();
          }
        });
        forceAudioOnIfActive();
      } catch (err) {
        console.warn("Player.js init failed:", err);
      }
    }, 0);

    const retryTimers = [100, 300, 700, 1200, 2000, 3500, 5500].map((delay) =>
      window.setTimeout(forceAudioOnIfActive, delay),
    );

    const onUserGesture = () => {
      if (active) forceAudioOn();
    };
    window.addEventListener("pointerdown", onUserGesture, { capture: true });
    window.addEventListener("click", onUserGesture, { capture: true });
    window.addEventListener("touchstart", onUserGesture, { capture: true });
    window.addEventListener("keydown", onUserGesture, { capture: true });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      retryTimers.forEach((retryTimer) => clearTimeout(retryTimer));
      if (playerRef.current === player) playerRef.current = null;
      window.removeEventListener("pointerdown", onUserGesture, { capture: true });
      window.removeEventListener("click", onUserGesture, { capture: true });
      window.removeEventListener("touchstart", onUserGesture, { capture: true });
      window.removeEventListener("keydown", onUserGesture, { capture: true });
    };
  }, [active, completeOnce, embedUrl, forceAudioOn]);

  useEffect(() => {
    if (active) forceAudioOn();
  }, [active, forceAudioOn]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.preload = "auto";

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      onReadyRef.current?.();
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({ autoStartLoad: true });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onReadyRef.current?.();
    });

    return () => hls.destroy();
  }, [hlsUrl]);

  // Listen for Gumlet player events via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isGumletEndedMessage(event.data)) {
        completeOnce();
        return;
      }

      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (isGumletEndedMessage(parsed)) {
            completeOnce();
          }
        } catch {
          // not JSON, ignore
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [completeOnce, isGumletEndedMessage]);


  return (
    <div
      className={`fixed inset-0 z-0 bg-background transition-opacity duration-200 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!active}
    >
      {hlsUrl ? (
        <video
          ref={videoRef}
          title="Video player"
          data-source={hlsUrl}
          className="absolute inset-0 h-full w-full object-cover"
          controls={active}
          playsInline
          preload="auto"
          autoPlay={active}
          muted={false}
          onCanPlay={() => { onReadyRef.current?.(); if (active) forceAudioOn(); }}
          onLoadedData={() => { if (active) forceAudioOn(); }}
          onLoadedMetadata={() => { if (active) forceAudioOn(); }}
          onPlay={forceAudioOn}
          onEnded={completeOnce}
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title="Video player"
          className="absolute inset-0 w-full h-full"
          style={{ border: "none" }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
          onLoad={() => {
            if (active) forceAudioOn();
          }}
          allowFullScreen
        />
      )}

      {/* Overlay content (HUD, etc.) */}
      {active ? children : null}

      {/* Skip button */}
      {showSkip ? (
        <button
          onClick={onSkip}
          className="absolute bottom-8 right-8 z-30 text-xs text-muted-foreground/80 hover:text-foreground transition-colors font-mono px-3 py-1.5 rounded-md bg-black/40 backdrop-blur-sm border border-border/20 hover:bg-black/60"
        >
          Passer →
        </button>
      ) : null}
    </div>
  );
});

GumletVideoPlayer.displayName = "GumletVideoPlayer";

export default GumletVideoPlayer;
