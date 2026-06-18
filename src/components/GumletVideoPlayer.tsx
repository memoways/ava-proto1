import { useEffect, useRef, useCallback } from "react";
import { Player } from "@gumlet/player.js";

interface GumletVideoPlayerProps {
  videoUrl: string;
  onComplete: () => void;
  onSkip: () => void;
  /** Optional overlay content (e.g. HUD) rendered on top of the video */
  children?: React.ReactNode;
}

/**
 * Full-screen responsive Gumlet video player via iframe embed.
 * Only play/pause + volume controls are shown (configured via Gumlet dashboard).
 * Includes a "Passer" skip button overlay.
 */
const GumletVideoPlayer = ({ videoUrl, onComplete, onSkip, children }: GumletVideoPlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);
  onCompleteRef.current = onComplete;


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

  const forceAudioOn = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      await player.setVolume(100);
      await player.unmute();
      try { await player.play(); } catch { /* Browser may still require a direct user gesture. */ }
    } catch {
      // silent: autoplay policies vary by browser/device.
    }
  }, []);

  const getEmbedUrl = useCallback((url: string) => {
    const withAudioDefaults = (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        parsed.searchParams.set("preload", "true");
        parsed.searchParams.set("autoplay", "true");
        parsed.searchParams.set("muted", "false");
        parsed.searchParams.set("volume", "100");
        parsed.searchParams.set("playsinline", "true");
        return parsed.toString();
      } catch {
        const separator = rawUrl.includes("?") ? "&" : "?";
        return `${rawUrl}${separator}preload=true&autoplay=true&muted=false&volume=100&playsinline=true`;
      }
    };

    if (url.includes("play.gumlet.io/embed/")) return withAudioDefaults(url);
    const match = url.match(/(?:watch|embed)\/([a-f0-9]+)/i);
    if (match) {
      const assetId = match[1];
      return withAudioDefaults(`https://play.gumlet.io/embed/${assetId}`);
    }
    return withAudioDefaults(url);
  }, []);

  const embedUrl = getEmbedUrl(videoUrl);

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

    const timer = setTimeout(() => {
      if (cancelled) return;
      try {
        player = new Player(iframe);
        playerRef.current = player;
        player.on("ready", () => void forceAudioOn());
        player.on("play", () => void forceAudioOn());
        player.on("ended", completeOnce);
        player.on("timeupdate", () => {
          if (retryCount < 6) {
            retryCount += 1;
            void forceAudioOn();
          }
        });
        void forceAudioOn();
      } catch (err) {
        console.warn("Player.js init failed:", err);
      }
    }, 0);

    const retryTimers = [100, 300, 700, 1200, 2000, 3500, 5500].map((delay) =>
      window.setTimeout(() => void forceAudioOn(), delay),
    );

    const onUserGesture = () => void forceAudioOn();
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
  }, [completeOnce, embedUrl, forceAudioOn]);

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
    <div className="fixed inset-0 z-0 bg-background">
      {/* Gumlet iframe — full viewport */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Video player"
        className="absolute inset-0 w-full h-full"
        style={{ border: "none" }}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; accelerometer; gyroscope"
        onLoad={() => void forceAudioOn()}
        allowFullScreen
      />

      {/* Overlay content (HUD, etc.) */}
      {children}

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute bottom-8 right-8 z-30 text-xs text-muted-foreground/80 hover:text-foreground transition-colors font-mono px-3 py-1.5 rounded-md bg-black/40 backdrop-blur-sm border border-border/20 hover:bg-black/60"
      >
        Passer →
      </button>
    </div>
  );
};

export default GumletVideoPlayer;
