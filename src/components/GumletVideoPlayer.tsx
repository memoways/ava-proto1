import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { START_BUFFER_MAX_WAIT_MS, START_BUFFER_S, bufferedAheadSeconds, resolveNativeVideoSource } from "@/services/videoPlayback";
import { attachVideoGain, canRouteThroughGain, getVideoGain, isIosWebKit, keepVideoGainAudible } from "@/services/videoGain";
import { getAudioContextState } from "@/services/audioPlayback";
import {
  DEFAULT_VIDEO_ASPECT,
  computePanFraming,
  isPanDrag,
  needsRotationInvite,
  panOffsetAfterDrag,
  type SmartphoneVideoMode,
} from "@/services/videoFraming";
import { Smartphone } from "lucide-react";

/** Idle time before the pointer hides again over a playing video. */
const POINTER_IDLE_HIDE_MS = 1_500;
const START_BUFFER_POLL_MS = 150;

const canControlNativeMedia = () =>
  typeof window !== "undefined" && !/jsdom/i.test(window.navigator.userAgent);

type WebKitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Leaves any fullscreen this player opened (element fullscreen or iOS native player). */
function leaveFullscreen(video: HTMLVideoElement | null): void {
  if (typeof document === "undefined") return;
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") void document.exitFullscreen().catch(() => undefined);
  } catch { /* not in fullscreen */ }
  try { screen.orientation?.unlock?.(); } catch { /* no orientation lock */ }
  const webkit = video as WebKitVideo | null;
  try {
    if (webkit?.webkitDisplayingFullscreen) webkit.webkitExitFullscreen?.();
  } catch { /* already inline */ }
}

export interface GumletVideoPlayerAudioDiagnostics {
  mode: string;
  engine: string;
  iosWebKit: boolean;
  volumeReadBack: number | null;
  contextState: string | null;
}

export interface GumletVideoPlayerHandle {
  playWithAudio: () => void;
  stop: () => void;
  /** iOS: routes the element through a Web Audio gain while the context is running (call from a gesture). */
  prepareGain: () => void;
  /** What the attenuation actually did on this device (telemetry). */
  getAudioDiagnostics: () => GumletVideoPlayerAudioDiagnostics;
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
  /** Keep the media silent while it plays (overlay mode: hidden until the voice is audible). Default false. */
  muted?: boolean;
  /**
   * Media volume 0..1 (default 1). Where the browser ignores `volume` (iOS), a value below 1 is
   * applied as a Web Audio gain when the source allows it (hls.js / same-origin file), and falls
   * back to silence otherwise so the video never covers the character's voice.
   */
  volume?: number;
  /** The media really started playing while active. */
  onPlaying?: () => void;
  /** Overlay: the video stands in for the character during a reply — no fullscreen button. */
  allowFullscreen?: boolean;
  /**
   * Smartphone presentation (back-office test): "current" keeps the whole 16:9 frame; "portrait" fills
   * the full height and pans with a finger; "landscape" invites to turn the phone. Default "current".
   */
  videoMode?: SmartphoneVideoMode;
  /** Portrait mode: where the pan starts, 0..1 of the film width (action point). Default centre. */
  panStart?: number;
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
  muted = false,
  volume = 1,
  onPlaying,
  allowFullscreen = true,
  videoMode = "current",
  panStart,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const onPlayingRef = useRef(onPlaying);
  const activeRef = useRef(active);
  const mutedRef = useRef(muted);
  const volumeRef = useRef(volume);
  /** Set once the browser ignores `volume` (iOS): attenuated playback then stays silent. */
  const volumeUnsupportedRef = useRef(false);
  const gainPendingRef = useRef(false);
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
  const playbackEngineRef = useRef(playbackEngine);
  playbackEngineRef.current = playbackEngine;
  const source = useMemo(() => resolveNativeVideoSource(videoUrl), [videoUrl]);
  const panMode = videoMode === "portrait";
  const [viewport, setViewport] = useState({ width: 0, height: 0, portrait: false });
  const [videoAspect, setVideoAspect] = useState(DEFAULT_VIDEO_ASPECT);
  /** Offset set by the finger; null = the framed starting point. Reset for every new film. */
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; offset: number; panning: boolean } | null>(null);
  const sourceUrlRef = useRef(source.url);
  sourceUrlRef.current = source.url;

  onCompleteRef.current = onComplete;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;
  onPlayingRef.current = onPlaying;
  activeRef.current = active;
  mutedRef.current = muted;
  volumeRef.current = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));

  /** Effective silence: requested, or an attenuation the browser cannot apply (no Web Audio gain). */
  const desiredMuted = () =>
    mutedRef.current
    || (volumeRef.current < 1 && volumeUnsupportedRef.current && !(videoRef.current && getVideoGain(videoRef.current)));

  const setAudioMode = (video: HTMLVideoElement, mode: "native-volume" | "web-audio-gain" | "muted-fallback") => {
    video.dataset.audioMode = mode;
  };

  /**
   * iOS ignores `volume`: route the element through a Web Audio gain instead. The video stays
   * muted until the gain is in place, so it can never cover the voice in the meantime.
   */
  const requestGain = (video: HTMLVideoElement) => {
    if (gainPendingRef.current || getVideoGain(video)) return;
    if (!canRouteThroughGain(playbackEngineRef.current, sourceUrlRef.current)) return;
    gainPendingRef.current = true;
    void attachVideoGain(video).then((gain) => {
      gainPendingRef.current = false;
      if (gain && videoRef.current === video && !stoppingRef.current) applyAudioRef.current(video);
    });
  };

  /** Applies the requested sound (default: audible at full volume, as before). */
  const applyAudio = useCallback((video: HTMLVideoElement) => {
    const wanted = volumeRef.current;
    const gain = getVideoGain(video);
    if (gain) {
      // Routed through Web Audio for good: attenuation is the gain, `volume` plays no part.
      gain.setLinear(wanted);
      keepVideoGainAudible(video);
      video.defaultMuted = mutedRef.current;
      video.muted = mutedRef.current;
      setAudioMode(video, "web-audio-gain");
      return;
    }
    try { video.volume = wanted; } catch { /* read-only volume */ }
    // iOS never honours `volume`, whatever it reads back: do not rely on the read-back there.
    if (wanted < 1 && (isIosWebKit() || Math.abs(video.volume - wanted) > 0.01)) {
      volumeUnsupportedRef.current = true;
      requestGain(video);
    }
    const silent = desiredMuted();
    video.defaultMuted = silent;
    video.muted = silent;
    setAudioMode(video, volumeUnsupportedRef.current && wanted < 1 ? "muted-fallback" : "native-volume");
  }, []);
  const applyAudioRef = useRef(applyAudio);
  applyAudioRef.current = applyAudio;

  /** The element drifted from the requested sound (autoplay policy, user agent). */
  const audioDrifted = (video: HTMLVideoElement) =>
    video.muted !== desiredMuted()
    || (!volumeUnsupportedRef.current && !getVideoGain(video) && Math.abs(video.volume - volumeRef.current) > 0.01);

  const pauseVideo = useCallback((video: HTMLVideoElement | null) => {
    if (video && canControlNativeMedia()) video.pause();
  }, []);

  const completeOnce = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    leaveFullscreen(videoRef.current);
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
    leaveFullscreen(video);

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
    applyAudio(video);

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
  }, [applyAudio]);

  const playWithAudioRef = useRef(playWithAudio);
  playWithAudioRef.current = playWithAudio;

  // Sound changes while playing (overlay: muted while hidden, attenuated once shown).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || stoppingRef.current || !(activeRef.current || playbackRequestedRef.current)) return;
    applyAudio(video);
  }, [applyAudio, muted, volume]);

  useImperativeHandle(ref, () => ({
    playWithAudio,
    stop: stopPlayback,
    prepareGain: () => {
      const video = videoRef.current;
      if (video && isIosWebKit()) requestGain(video);
    },
    getAudioDiagnostics: () => {
      const video = videoRef.current;
      return {
        mode: video?.dataset.audioMode ?? "unknown",
        engine: playbackEngineRef.current,
        iosWebKit: isIosWebKit(),
        volumeReadBack: video ? video.volume : null,
        contextState: getAudioContextState(),
      };
    },
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

  // Viewport size and orientation, only followed for the smartphone experiences.
  useEffect(() => {
    if (videoMode === "current" || typeof window === "undefined") return;
    const measure = () => {
      const box = containerRef.current?.getBoundingClientRect();
      const width = box?.width || window.innerWidth;
      const height = box?.height || window.innerHeight;
      setViewport({ width, height, portrait: height >= width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [videoMode]);

  // Every new film starts again on the framed point.
  useEffect(() => { setDragOffset(null); }, [source.url, videoMode, panStart]);

  const framing = useMemo(
    () => computePanFraming({ containerWidth: viewport.width, containerHeight: viewport.height, aspect: videoAspect, focus: panStart }),
    [viewport.width, viewport.height, videoAspect, panStart],
  );
  const panOffset = Math.min(framing.maxOffset, dragOffset ?? framing.offset);

  const onPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panMode || !active) return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: panOffset, panning: false };
  };
  const onPanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (!drag.panning) {
      if (!isPanDrag(dx, event.clientY - drag.y)) return;
      drag.panning = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture unavailable */ }
    }
    setDragOffset(panOffsetAfterDrag(drag.offset, dx, framing.maxOffset));
  };
  const onPanPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  const revealPointer = useCallback(() => {
    if (!activeRef.current) return;
    setPointerVisible(true);
    if (pointerTimerRef.current) window.clearTimeout(pointerTimerRef.current);
    pointerTimerRef.current = window.setTimeout(() => {
      pointerTimerRef.current = null;
      setPointerVisible(false);
    }, POINTER_IDLE_HIDE_MS);
  }, []);

  /**
   * Touch screens: the whole film, landscape. Element fullscreen + landscape
   * lock where the browser allows it (Android); iPhone has no element
   * fullscreen, so its native player opens and follows the rotation.
   */
  const enterFullscreen = useCallback(() => {
    const video = videoRef.current as WebKitVideo | null;
    const container = containerRef.current;
    if (!video) return;
    if (container && document.fullscreenEnabled && typeof container.requestFullscreen === "function") {
      void container.requestFullscreen({ navigationUI: "hide" })
        .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
        .catch(() => { /* fullscreen or lock refused: the film stays whole on screen */ });
      return;
    }
    try { video.webkitEnterFullscreen?.(); } catch { /* not allowed now */ }
  }, []);

  // Leaving the iOS native player must not leave the film paused.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnd = () => {
      if (activeRef.current && !video.ended && !hasCompletedRef.current) playWithAudioRef.current();
    };
    video.addEventListener("webkitendfullscreen", onEnd);
    return () => video.removeEventListener("webkitendfullscreen", onEnd);
  }, []);

  useEffect(() => {
    if (!active) leaveFullscreen(videoRef.current);
  }, [active]);

  const handleSkip = useCallback(() => {
    stopPlayback();
    onSkip();
  }, [onSkip, stopPlayback]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-0 bg-background transition-opacity duration-200 ${active ? "opacity-100" : "pointer-events-none opacity-0"} ${active && !pointerVisible ? "cursor-none" : ""}`}
      aria-hidden={!active}
      data-pointer={active && !pointerVisible ? "hidden" : "visible"}
      onMouseMove={revealPointer}
      data-video-mode={videoMode}
      style={panMode ? { touchAction: "none" } : undefined}
      onPointerDown={panMode ? onPanPointerDown : undefined}
      onPointerMove={panMode ? onPanPointerMove : undefined}
      onPointerUp={panMode ? onPanPointerEnd : undefined}
      onPointerCancel={panMode ? onPanPointerEnd : undefined}
    >
      {/* aria-label, not title: a title shows a "Video player" tooltip under the pointer. */}
      <video
        ref={videoRef}
        aria-label="Video player"
        data-source={source.url}
        data-playback-engine={playbackEngine}
        // Whole frame on touch screens and portrait windows (no side crop);
        // desktop landscape keeps filling the screen.
        className={cn(
          "bg-black",
          panMode
            ? "absolute left-0 top-0 h-full object-cover"
            : cn("absolute inset-0 h-full w-full", touchFirst ? "object-contain" : "object-cover portrait:object-contain"),
        )}
        style={panMode ? { width: framing.filmWidth || "100%", transform: `translate3d(${-panOffset}px,0,0)` } : undefined}
        data-fit={panMode ? "pan" : touchFirst ? "contain" : "cover"}
        data-pan-offset={panMode ? Math.round(panOffset) : undefined}
        controls={false}
        playsInline
        preload="auto"
        autoPlay
        muted={false}
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) setVideoAspect(videoWidth / videoHeight);
        }}
        onCanPlay={() => {
          onReadyRef.current?.();
          if (activeRef.current || playbackRequestedRef.current) playWithAudio();
        }}
        onLoadedData={() => {
          if (activeRef.current || playbackRequestedRef.current) playWithAudio();
        }}
        onPlaying={() => {
          if (!activeRef.current) return;
          hasPlayedRef.current = true;
          onPlayingRef.current?.();
        }}
        onPlay={() => {
          const video = videoRef.current;
          if (!video || stoppingRef.current) return;
          if (!activeRef.current && !playbackRequestedRef.current) {
            pauseVideo(video);
            try { video.currentTime = 0; } catch { /* metadata may not exist yet */ }
            return;
          }
          if (audioDrifted(video)) applyAudio(video);
        }}
        onVolumeChange={() => {
          const video = videoRef.current;
          if (!video || stoppingRef.current || !activeRef.current) return;
          if (audioDrifted(video)) applyAudio(video);
        }}
        onEnded={completeOnce}
        onError={() => {
          // Source removal while stopping or hidden is not a playback failure.
          if (!videoRef.current?.getAttribute("src") && !hlsRef.current) return;
          failOnce();
        }}
      />

      {active ? children : null}

      {active && needsRotationInvite(videoMode, viewport.portrait) ? (
        // Icon only: nothing is written over the image.
        <div
          data-testid="rotate-invite"
          role="img"
          aria-label="Tournez le téléphone en mode horizontal"
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 p-5 text-white/90 backdrop-blur-sm"
        >
          <Smartphone className="h-10 w-10 animate-pulse" style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
        </div>
      ) : null}

      {active && touchFirst && allowFullscreen && !panMode ? (
        <button
          type="button"
          onClick={enterFullscreen}
          className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 z-30 min-h-11 rounded-md border border-border/20 bg-black/40 px-4 py-1.5 font-mono text-sm text-muted-foreground/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-foreground"
        >
          Plein écran ⤢
        </button>
      ) : null}

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
