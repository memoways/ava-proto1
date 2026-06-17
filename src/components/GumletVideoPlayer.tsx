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

  const isGumletEndedMessage = useCallback((data: unknown) => {
    if (!data || typeof data !== "object") return false;

    const message = data as { type?: string; event?: string };
    return message.type === "gumlet" && message.event === "ended";
  }, []);

  // Extract asset ID from various Gumlet URL formats
  const getEmbedUrl = useCallback((url: string) => {
    // Already an embed URL
    if (url.includes("play.gumlet.io/embed/")) return url;
    
    // Extract asset ID from gumlet.tv/watch/{id} or similar
    const match = url.match(/(?:watch|embed)\/([a-f0-9]+)/i);
    if (match) {
      const assetId = match[1];
      return `https://play.gumlet.io/embed/${assetId}?preload=true&autoplay=true`;
    }
    
    // Fallback: use as-is
    return url;
  }, []);

  const embedUrl = getEmbedUrl(videoUrl);

  // Initialize Player.js and unmute as soon as the player is ready
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Wait for iframe to load before creating the player
    const initPlayer = () => {
      try {
        const player = new Player(iframe);
        playerRef.current = player;

        player.on("ready", async () => {
          try {
            await player.unmute();
            await player.setVolume(100);
          } catch (err) {
            console.warn("Gumlet unmute failed:", err);
          }
        });
      } catch (err) {
        console.warn("Player.js init failed:", err);
      }
    };

    if (iframe.contentDocument?.readyState === "complete" || iframe.src) {
      initPlayer();
    } else {
      iframe.addEventListener("load", initPlayer);
      return () => iframe.removeEventListener("load", initPlayer);
    }
  }, [embedUrl]);

  // Listen for Gumlet player events via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (isGumletEndedMessage(event.data)) {
        onComplete();
        return;
      }

      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (isGumletEndedMessage(parsed)) {
            onComplete();
          }
        } catch {
          // not JSON, ignore
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isGumletEndedMessage, onComplete]);

  const embedUrl = getEmbedUrl(videoUrl);

  return (
    <div className="fixed inset-0 z-0 bg-background">
      {/* Gumlet iframe — full viewport */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Video player"
        className="absolute inset-0 w-full h-full"
        style={{ border: "none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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
