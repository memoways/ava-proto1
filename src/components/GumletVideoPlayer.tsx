import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import Hls from "hls.js";
import { Player } from "@gumlet/player.js";

const GUMLET_COLLECTION_ID = "673f29f4a5e1bf70aa645cb7";

const canControlNativeMedia = () =>
  typeof window !== "undefined" && !/jsdom/i.test(window.navigator.userAgent);

const pauseNativeVideo = (video: HTMLVideoElement | null) => {
  if (video && canControlNativeMedia()) video.pause();
};

const resetNativeVideo = (video: HTMLVideoElement) => {
  video.removeAttribute("src");
  if (canControlNativeMedia()) video.load();
};

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
  /** Use the proven Gumlet embed (teaser) or native HLS (later cinematics). */
  playbackMode?: "embed" | "native";
  /** Show the skip button overlay. */
  showSkip?: boolean;
  /** Optional overlay content (e.g. HUD) rendered on top of the video */
  children?: React.ReactNode;
}

/**
 * Full-screen Gumlet player. Gumlet assets use their native HLS stream so audio
 * remains under first-party media-element control; unknown URLs keep an iframe
 * fallback. Includes a "Passer" skip button overlay.
 */
const GumletVideoPlayer = forwardRef<GumletVideoPlayerHandle, GumletVideoPlayerProps>(({
  videoUrl,
  onComplete,
  onSkip,
  onReady,
  active = true,
  autoPlay = true,
  playbackMode = "native",
  showSkip = true,
  children,
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onReadyRef = useRef(onReady);
  const hasCompletedRef = useRef(false);
  const activeRef = useRef(active);
  onCompleteRef.current = onComplete;
  onReadyRef.current = onReady;
  activeRef.current = active;


  const isGumletEndedMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") return false;
    const message = data as { type?: string; event?: string; name?: string; method?: string };
    const eventName = (message.event || message.name || message.method || "").toLowerCase();
    if (message.type === "gumlet" && (eventName === "ended" || eventName === "complete" || eventName === "finish")) {
      return true;
    }
    // player.js relay: { event: "ended" } sans type
    return eventName === "ended" || eventName === "complete";
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
        video.muted = false;
        video.defaultMuted = false;
        video.volume = 1;
        if (!canControlNativeMedia()) return;
        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.then === "function") {
          playAttempt.catch(() => pauseNativeVideo(video));
        }
      } catch {
        pauseNativeVideo(video);
      }
      return;
    }

    const player = playerRef.current;
    if (!player) return;
    try {
      // Dispatch every command synchronously inside the user-gesture stack.
      // Waiting for setVolume/unmute first makes play() lose that activation.
      void player.setVolume(100).catch(() => { /* retry on next gesture */ });
      void player.unmute().catch(() => { /* retry on next gesture */ });
      void player.play().catch(() => { /* retry on next gesture */ });
    } catch {
      // Retried by ready/load and subsequent user gestures.
    }
  }, []);

  const getGumletAssetId = useCallback((url: string) => {
    const match = url.match(/(?:watch|embed)\/([a-f0-9]+)/i);
    return match?.[1] ?? null;
  }, []);

  const getNativePlaybackUrl = useCallback((url: string) => {
    if (/\.m3u8(?:$|\?)/i.test(url)) return url;
    const assetId = getGumletAssetId(url);
    if (!assetId) return null;
    return `https://video.gumlet.io/${GUMLET_COLLECTION_ID}/${assetId}/main.m3u8`;
  }, [getGumletAssetId]);

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
  const hlsUrl = playbackMode === "native" ? getNativePlaybackUrl(videoUrl) : null;

  useImperativeHandle(ref, () => ({
    playWithAudio: () => {
      forceAudioOn();
    },
  }), [forceAudioOn]);

  useEffect(() => {
    hasCompletedRef.current = false;
  }, [videoUrl]);

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

    let lastKnownDuration = 0;
    const checkEndFromTime = (current: unknown) => {
      const t = typeof current === "number" ? current : Number(current);
      if (!Number.isFinite(t) || lastKnownDuration <= 0) return;
      // Fallback : certains navigateurs/embeds ne dispatchent pas "ended".
      // On considère la vidéo terminée dès qu'on est à <0.4s de la fin.
      if (t >= lastKnownDuration - 0.4) completeOnce();
    };

    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        player = new Player(iframe);
        playerRef.current = player;
        player.on("ready", () => {
          handleReady();
          try {
            player?.getDuration((d: number) => {
              if (typeof d === "number" && Number.isFinite(d) && d > 0) lastKnownDuration = d;
            });
          } catch { /* ignore */ }
        });
        player.on("play", forceAudioOnIfActive);
        player.on("volumeChange", forceAudioOnIfActive);
        player.on("ended", completeOnce);
        player.on("timeupdate", (data: unknown) => {
          if (retryCount < 6) {
            retryCount += 1;
            forceAudioOnIfActive();
          }
          // Player.js émet { seconds, duration } dans timeupdate
          if (data && typeof data === "object") {
            const payload = data as { seconds?: number; duration?: number };
            if (typeof payload.duration === "number" && payload.duration > 0) {
              lastKnownDuration = payload.duration;
            }
            checkEndFromTime(payload.seconds);
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
    if (active) {
      forceAudioOn();
      return;
    }

    pauseNativeVideo(videoRef.current);
    try {
      void playerRef.current?.pause().catch(() => { /* player may not be ready */ });
    } catch {
      // Player teardown can race a phase change.
    }
  }, [active, forceAudioOn]);

  // Later cinematics use native HLS. Retry audible playback while the stream
  // becomes ready and on any in-video user gesture, without inserting a gate.
  useEffect(() => {
    if (!active || !hlsUrl) return;
    const retryTimers = [100, 300, 700, 1200, 2000, 3500].map((delay) =>
      window.setTimeout(forceAudioOn, delay),
    );
    const onUserGesture = () => forceAudioOn();
    window.addEventListener("pointerdown", onUserGesture, { capture: true });
    window.addEventListener("touchstart", onUserGesture, { capture: true });
    window.addEventListener("keydown", onUserGesture, { capture: true });
    return () => {
      retryTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pointerdown", onUserGesture, { capture: true });
      window.removeEventListener("touchstart", onUserGesture, { capture: true });
      window.removeEventListener("keydown", onUserGesture, { capture: true });
    };
  }, [active, forceAudioOn, hlsUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    video.preload = "auto";

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      if (canControlNativeMedia()) video.load();
      onReadyRef.current?.();
      if (activeRef.current) forceAudioOn();
      return () => {
        pauseNativeVideo(video);
        resetNativeVideo(video);
      };
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({
      autoStartLoad: true,
      enableWorker: true,
      startLevel: -1,
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onReadyRef.current?.();
      if (activeRef.current) forceAudioOn();
    });

    return () => {
      pauseNativeVideo(video);
      hls.destroy();
      resetNativeVideo(video);
    };
  }, [forceAudioOn, hlsUrl]);

  // Listen for Gumlet player events via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      if (isGumletEndedMessage(event.data)) {
        completeOnce();
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
          onPlaying={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.muted || video.volume < 1) forceAudioOn();
          }}
          onVolumeChange={() => {
            const video = videoRef.current;
            if (!video || !active) return;
            if (video.muted || video.volume < 1) forceAudioOn();
          }}
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
