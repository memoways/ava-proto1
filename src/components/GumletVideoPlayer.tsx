import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { resolveNativeVideoSource } from "@/services/videoPlayback";

const canControlNativeMedia = () =>
  typeof window !== "undefined" && !/jsdom/i.test(window.navigator.userAgent);

export interface GumletVideoPlayerHandle {
  playWithAudio: () => void;
  stop: () => void;
}

interface GumletVideoPlayerProps {
  videoUrl: string;
  onComplete: () => void;
  onSkip: () => void;
  onReady?: () => void;
  /** Keep the single media element mounted/preloaded but visually hidden. */
  active?: boolean;
  /** Show the skip button overlay. */
  showSkip?: boolean;
  /** Optional overlay content (e.g. HUD) rendered on top of the video. */
  children?: React.ReactNode;
}

/**
 * One persistent native player for the teaser and every later cinematic.
 * The initial "Commencer" gesture blesses this exact media element; subsequent
 * videos only swap its source, as recommended by WebKit autoplay guidance.
 */
const GumletVideoPlayer = forwardRef<GumletVideoPlayerHandle, GumletVideoPlayerProps>(({
  videoUrl,
  onComplete,
  onSkip,
  onReady,
  active = true,
  showSkip = true,
  children,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onReadyRef = useRef(onReady);
  const activeRef = useRef(active);
  const sourceGenerationRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const stoppingRef = useRef(false);
  const playbackRequestedRef = useRef(false);
  const [sourceEpoch, setSourceEpoch] = useState(0);
  const source = useMemo(() => resolveNativeVideoSource(videoUrl), [videoUrl]);

  onCompleteRef.current = onComplete;
  onReadyRef.current = onReady;
  activeRef.current = active;

  const pauseVideo = useCallback((video: HTMLVideoElement | null) => {
    if (video && canControlNativeMedia()) video.pause();
  }, []);

  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onCompleteRef.current();
  }, []);

  const stopPlayback = useCallback(() => {
    sourceGenerationRef.current += 1;
    stoppingRef.current = true;
    playbackRequestedRef.current = false;

    const video = videoRef.current;
    if (!video) return;

    // Mute first so the sound is cut synchronously, even if the decoder takes
    // another task to acknowledge pause/detach.
    video.muted = true;
    video.defaultMuted = true;
    pauseVideo(video);
    try { video.currentTime = 0; } catch { /* metadata may not exist yet */ }

    const hls = hlsRef.current;
    hlsRef.current = null;
    if (hls) {
      try { hls.stopLoad(); } catch { /* already stopped */ }
      try { hls.detachMedia(); } catch { /* already detached */ }
      try { hls.destroy(); } catch { /* already destroyed */ }
    }

    video.removeAttribute("src");
    if (canControlNativeMedia()) video.load();
    // Recreate the native pipeline while hidden. This keeps the same <video>
    // element but makes a later replay/restart possible even when the URL did
    // not change (for example after an authentication failure).
    setSourceEpoch((epoch) => epoch + 1);
  }, [pauseVideo]);

  const playWithAudio = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    playbackRequestedRef.current = true;
    stoppingRef.current = false;
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;

    if (!canControlNativeMedia()) return;
    const generation = sourceGenerationRef.current;
    try {
      const attempt = video.play();
      if (attempt && typeof attempt.catch === "function") {
        void attempt.catch((error: unknown) => {
          if (generation !== sourceGenerationRef.current || stoppingRef.current) return;
          console.warn("[Video] Audible autoplay rejected:", error);
        });
      }
    } catch (error) {
      if (generation === sourceGenerationRef.current && !stoppingRef.current) {
        console.warn("[Video] Audible autoplay failed:", error);
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    playWithAudio,
    stop: stopPlayback,
  }), [playWithAudio, stopPlayback]);

  useEffect(() => {
    hasCompletedRef.current = false;
    stoppingRef.current = false;
    sourceGenerationRef.current += 1;
  }, [source.url, sourceEpoch]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const generation = sourceGenerationRef.current;
    const playbackIntended = activeRef.current || playbackRequestedRef.current;
    video.preload = "auto";
    video.defaultMuted = !playbackIntended;
    video.muted = !playbackIntended;
    video.volume = 1;

    if (source.kind === "file") {
      video.src = source.url;
      if (canControlNativeMedia()) video.load();
      onReadyRef.current?.();
      if (activeRef.current || playbackRequestedRef.current) playWithAudio();
      return () => {
        if (generation !== sourceGenerationRef.current) return;
        pauseVideo(video);
        video.removeAttribute("src");
        if (canControlNativeMedia()) video.load();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.url;
      if (canControlNativeMedia()) video.load();
      onReadyRef.current?.();
      if (activeRef.current || playbackRequestedRef.current) playWithAudio();
      return () => {
        if (generation !== sourceGenerationRef.current) return;
        pauseVideo(video);
        video.removeAttribute("src");
        if (canControlNativeMedia()) video.load();
      };
    }

    if (!Hls.isSupported()) {
      if (canControlNativeMedia()) {
        console.error("[Video] HLS playback is not supported by this browser.");
      }
      return;
    }

    const hls = new Hls({
      autoStartLoad: true,
      enableWorker: true,
      startLevel: -1,
    });
    hlsRef.current = hls;
    hls.loadSource(source.url);
    hls.attachMedia(video);
    // The source is armed before the welcome action becomes available. If the
    // manifest is still loading when the user clicks, playbackRequestedRef
    // preserves the intent and MANIFEST_PARSED retries play on the same node.
    onReadyRef.current?.();
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (generation !== sourceGenerationRef.current) return;
      onReadyRef.current?.();
      if (activeRef.current || playbackRequestedRef.current) playWithAudio();
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal || generation !== sourceGenerationRef.current) return;
      console.error("[Video] Fatal HLS error:", data.type, data.details);
    });

    return () => {
      if (hlsRef.current === hls) hlsRef.current = null;
      try { hls.destroy(); } catch { /* already destroyed by a hard stop */ }
      if (generation !== sourceGenerationRef.current) return;
      pauseVideo(video);
      video.removeAttribute("src");
      if (canControlNativeMedia()) video.load();
    };
  }, [pauseVideo, playWithAudio, source.kind, source.url, sourceEpoch]);

  useEffect(() => {
    if (active) {
      stoppingRef.current = false;
      playbackRequestedRef.current = true;
      playWithAudio();
      return;
    }
    playbackRequestedRef.current = false;
    pauseVideo(videoRef.current);
  }, [active, pauseVideo, playWithAudio]);

  const handleSkip = useCallback(() => {
    stopPlayback();
    onSkip();
  }, [onSkip, stopPlayback]);

  return (
    <div
      className={`fixed inset-0 z-0 bg-background transition-opacity duration-200 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
      aria-hidden={!active}
    >
      <video
        ref={videoRef}
        title="Video player"
        data-source={source.url}
        className="absolute inset-0 h-full w-full object-cover"
        controls={false}
        playsInline
        preload="auto"
        autoPlay
        muted={false}
        onCanPlay={() => {
          onReadyRef.current?.();
          if (activeRef.current || playbackRequestedRef.current) playWithAudio();
        }}
        onLoadedData={() => {
          if (activeRef.current || playbackRequestedRef.current) playWithAudio();
        }}
        onPlay={() => {
          const video = videoRef.current;
          if (!video || stoppingRef.current) return;
          if (!activeRef.current && !playbackRequestedRef.current) {
            pauseVideo(video);
            try { video.currentTime = 0; } catch { /* metadata may not exist yet */ }
            return;
          }
          if (video.muted || video.volume !== 1) {
            video.defaultMuted = false;
            video.muted = false;
            video.volume = 1;
          }
        }}
        onVolumeChange={() => {
          const video = videoRef.current;
          if (!video || stoppingRef.current || !activeRef.current) return;
          if (video.muted || video.volume !== 1) {
            video.defaultMuted = false;
            video.muted = false;
            video.volume = 1;
          }
        }}
        onEnded={completeOnce}
      />

      {active ? children : null}

      {showSkip ? (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 right-8 z-30 rounded-md border border-border/20 bg-black/40 px-3 py-1.5 font-mono text-xs text-muted-foreground/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-foreground"
        >
          Passer →
        </button>
      ) : null}
    </div>
  );
});

GumletVideoPlayer.displayName = "GumletVideoPlayer";

export default GumletVideoPlayer;
