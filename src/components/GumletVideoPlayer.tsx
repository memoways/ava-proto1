import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { START_BUFFER_MAX_WAIT_MS, START_BUFFER_S, bufferedAheadSeconds, resolveNativeVideoSource } from "@/services/videoPlayback";

/** Idle time before the pointer hides again over a playing video. */
const POINTER_IDLE_HIDE_MS = 1_500;
const START_BUFFER_POLL_MS = 150;

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
  /** Native media error or unsupported source while active (hls.js fatal errors are only logged). */
  onError?: () => void;
  /** Keep the single media element mounted/preloaded but visually hidden. */
  active?: boolean;
  /** Show the skip button overlay. */
  showSkip?: boolean;
  /** Touch device (tablet, smartphone): « Passer » becomes a 44 px target. Computed once by the caller. */
  touchFirst?: boolean;
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
  onError,
  active = true,
  showSkip = true,
  touchFirst = false,
  children,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const activeRef = useRef(active);
  const sourceGenerationRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const stoppingRef = useRef(false);
  const playbackRequestedRef = useRef(false);
  /** The first play (user gesture) blesses the element; only later cinematics wait for a buffer. */
  const hasPlayedRef = useRef(false);
  const startWaitRef = useRef<{ generation: number; since: number; timer: number | null } | null>(null);
  const [sourceEpoch, setSourceEpoch] = useState(0);
  // The pointer is hidden while a video plays; moving the mouse shows it briefly
  // so « Passer » stays reachable.
  const [pointerVisible, setPointerVisible] = useState(false);
  const pointerTimerRef = useRef<number | null>(null);
  const [playbackEngine, setPlaybackEngine] = useState<"pending" | "hls.js" | "native-hls" | "native-file" | "unsupported">("pending");
  const source = useMemo(() => resolveNativeVideoSource(videoUrl), [videoUrl]);

  onCompleteRef.current = onComplete;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  activeRef.current = active;

  const pauseVideo = useCallback((video: HTMLVideoElement | null) => {
    if (video && canControlNativeMedia()) video.pause();
  }, []);

  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    onCompleteRef.current();
  }, []);

  /** Reports one failure per source, only while the player is shown. */
  const failOnce = useCallback(() => {
    if (hasCompletedRef.current || stoppingRef.current || !activeRef.current) return;
    hasCompletedRef.current = true;
    onErrorRef.current?.();
  }, []);

  const clearStartWait = () => {
    const wait = startWaitRef.current;
    if (wait?.timer) window.clearTimeout(wait.timer);
    startWaitRef.current = null;
  };

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

    clearStartWait();
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
    if (hasPlayedRef.current && hlsRef.current && !video.ended && bufferedAheadSeconds(video) < START_BUFFER_S) {
      let wait = startWaitRef.current;
      if (!wait || wait.generation !== generation) {
        clearStartWait();
        wait = { generation, since: performance.now(), timer: null };
        startWaitRef.current = wait;
      }
      if (performance.now() - wait.since < START_BUFFER_MAX_WAIT_MS) {
        if (!wait.timer) {
          const pending = wait;
          pending.timer = window.setTimeout(() => {
            pending.timer = null;
            if (startWaitRef.current !== pending || !playbackRequestedRef.current) return;
            if (pending.generation !== sourceGenerationRef.current) return;
            playWithAudioRef.current();
          }, START_BUFFER_POLL_MS);
        }
        return;
      }
    }
    clearStartWait();
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

  const playWithAudioRef = useRef(playWithAudio);
  playWithAudioRef.current = playWithAudio;

  useImperativeHandle(ref, () => ({
    playWithAudio,
    stop: stopPlayback,
  }), [playWithAudio, stopPlayback]);

  useEffect(() => {
    hasCompletedRef.current = false;
    stoppingRef.current = false;
    sourceGenerationRef.current += 1;
    setPlaybackEngine("pending");
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
      setPlaybackEngine("native-file");
      video.src = source.url;
      if (canControlNativeMedia()) video.load();
      if (activeRef.current || playbackRequestedRef.current) playWithAudio();
      return () => {
        if (generation !== sourceGenerationRef.current) return;
        pauseVideo(video);
        video.removeAttribute("src");
        if (canControlNativeMedia()) video.load();
      };
    }

    // hls.js documents that Chromium can return "maybe" for the HLS MIME type
    // while still failing actual playback. Prefer MSE/hls.js whenever it is
    // supported; direct native HLS is only the fallback (Safari/WebKit, etc.).
    if (Hls.isSupported()) {
      setPlaybackEngine("hls.js");
      const hls = new Hls({
        autoStartLoad: true,
        enableWorker: true,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (generation !== sourceGenerationRef.current) return;
        onReadyRef.current?.();
        if (activeRef.current || playbackRequestedRef.current) playWithAudio();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || generation !== sourceGenerationRef.current) return;
        // Logged only: the player stays on screen with « Passer » (hls.js
        // fatal errors are not routed to onError, see the lot 3b plan).
        console.error("[Video] Fatal HLS error:", data.type, data.details);
      });
      hls.attachMedia(video);
      hls.loadSource(source.url);

      return () => {
        if (hlsRef.current === hls) hlsRef.current = null;
        try { hls.destroy(); } catch { /* already destroyed by a hard stop */ }
        if (generation !== sourceGenerationRef.current) return;
        pauseVideo(video);
        video.removeAttribute("src");
        if (canControlNativeMedia()) video.load();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setPlaybackEngine("native-hls");
      video.src = source.url;
      if (canControlNativeMedia()) video.load();
      if (activeRef.current || playbackRequestedRef.current) playWithAudio();
      return () => {
        if (generation !== sourceGenerationRef.current) return;
        pauseVideo(video);
        video.removeAttribute("src");
        if (canControlNativeMedia()) video.load();
      };
    }

    setPlaybackEngine("unsupported");
    if (canControlNativeMedia()) {
      console.error("[Video] HLS playback is not supported by this browser.");
      failOnce();
    }
  }, [failOnce, pauseVideo, playWithAudio, source.kind, source.url, sourceEpoch]);

  useEffect(() => {
    if (active) {
      stoppingRef.current = false;
      playbackRequestedRef.current = true;
      playWithAudio();
      return;
    }
    playbackRequestedRef.current = false;
    clearStartWait();
    pauseVideo(videoRef.current);
  }, [active, pauseVideo, playWithAudio]);

  useEffect(() => {
    setPointerVisible(false);
    return () => {
      if (pointerTimerRef.current) window.clearTimeout(pointerTimerRef.current);
      pointerTimerRef.current = null;
    };
  }, [active]);

  const revealPointer = useCallback(() => {
    if (!activeRef.current) return;
    setPointerVisible(true);
    if (pointerTimerRef.current) window.clearTimeout(pointerTimerRef.current);
    pointerTimerRef.current = window.setTimeout(() => {
      pointerTimerRef.current = null;
      setPointerVisible(false);
    }, POINTER_IDLE_HIDE_MS);
  }, []);

  const handleSkip = useCallback(() => {
    stopPlayback();
    onSkip();
  }, [onSkip, stopPlayback]);

  return (
    <div
      className={`fixed inset-0 z-0 bg-background transition-opacity duration-200 ${active ? "opacity-100" : "pointer-events-none opacity-0"} ${active && !pointerVisible ? "cursor-none" : ""}`}
      aria-hidden={!active}
      data-pointer={active && !pointerVisible ? "hidden" : "visible"}
      onMouseMove={revealPointer}
    >
      {/* aria-label, not title: a title shows a "Video player" tooltip under the pointer. */}
      <video
        ref={videoRef}
        aria-label="Video player"
        data-source={source.url}
        data-playback-engine={playbackEngine}
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
        onPlaying={() => { if (activeRef.current) hasPlayedRef.current = true; }}
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
        onError={() => {
          // Source removal while stopping or hidden is not a playback failure.
          if (!videoRef.current?.getAttribute("src") && !hlsRef.current) return;
          failOnce();
        }}
      />

      {active ? children : null}

      {showSkip ? (
        <button
          onClick={handleSkip}
          className={cn(
            "absolute bottom-8 right-8 z-30 rounded-md border border-border/20 bg-black/40 px-3 py-1.5 font-mono text-xs max-sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:right-4 max-sm:min-h-11 max-sm:px-4 max-sm:text-sm text-muted-foreground/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-foreground",
            touchFirst && "min-h-11 px-4 text-sm",
          )}
        >
          Passer →
        </button>
      ) : null}
    </div>
  );
});

GumletVideoPlayer.displayName = "GumletVideoPlayer";

export default GumletVideoPlayer;
