/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, PhoneOff, Loader2, VideoOff, PhoneCall } from "lucide-react";
import maxLarge from "@/assets/characters/max-large.jpg";
import maxAvatar from "@/assets/characters/max.jpg";
import emmaAvatar from "@/assets/characters/emma.jpg";
import type { AudioState, ConversationMessage } from "@/types";
import { cn } from "@/lib/utils";
import type { StreamingAvatarConnectionState } from "@/services/streamingAvatar";
import { Button } from "@/components/ui/button";

interface Props {
  audioState: AudioState;
  userSubtitle: string;
  maxSubtitle: string;
  conversationLog: ConversationMessage[];
  sessionTimeRemaining: string;
  onPTTPress: () => void;
  onPTTRelease: () => void;
  onHangUp: () => void;
  streamingAvatarActive?: boolean;
  streamingAvatarState?: StreamingAvatarConnectionState;
  attachAvatarMedia?: (element: HTMLMediaElement | null) => void;
  activeCharacter?: "max" | "emma";
  handoffOffer?: { reason: string } | null;
  handoffCalling?: boolean;
  onAcceptHandoff?: () => void;
  onRejectHandoff?: () => void;
}

const ConversationScreen = ({
  audioState,
  userSubtitle,
  maxSubtitle,
  conversationLog,
  sessionTimeRemaining,
  onPTTPress,
  onPTTRelease,
  onHangUp,
  streamingAvatarActive = false,
  streamingAvatarState = "inactive",
  attachAvatarMedia,
  activeCharacter = "max",
  handoffOffer = null,
  handoffCalling = false,
  onAcceptHandoff,
  onRejectHandoff,
}: Props) => {
  const disabled = handoffCalling || Boolean(handoffOffer) || audioState === "mic_starting" || audioState === "user_finalizing" || audioState === "max_thinking" || audioState === "max_speaking";
  const recording = audioState === "user_speaking";

  const handleToggleTalk = useCallback(() => {
    if (audioState === "idle") onPTTPress();
    else if (audioState === "user_speaking") onPTTRelease();
  }, [audioState, onPTTPress, onPTTRelease]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();
      handleToggleTalk();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggleTalk]);

  // Derive the last Max and last user message from the conversation log so
  // they persist on screen between turns (until replaced on the next turn).
  const { lastMaxText, lastUserText } = useMemo(() => {
    let mx = "";
    let us = "";
    for (let i = conversationLog.length - 1; i >= 0; i--) {
      const m = conversationLog[i];
      if (!mx && m.role !== "user") mx = m.content;
      else if (!us && m.role === "user") us = m.content;
      if (mx && us) break;
    }
    return { lastMaxText: mx, lastUserText: us };
  }, [conversationLog]);

  // While Max is generating, show the streaming maxSubtitle; otherwise fallback
  // to the last assistant message from the log.
  const displayedMax =
    (audioState === "max_speaking" || audioState === "max_thinking") && maxSubtitle
      ? maxSubtitle
      : lastMaxText;

  // While the user is speaking, show the live interim STT text; otherwise the
  // last finalized user message from the log.
  const displayedUser = recording || audioState === "mic_starting" || audioState === "user_finalizing"
    ? userSubtitle
    : lastUserText;

  // Anti-flash : on garde en permanence la dernière image du flux dans un canvas.
  // Si le flux hoquette (waiting/stalled) ou se coupe, on fige cette image au lieu
  // d'afficher un écran noir ou de rebasculer brutalement sur la photo.
  const [videoLive, setVideoLive] = useState(false);
  const [hasFrozenFrame, setHasFrozenFrame] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleVideoLive = useCallback(() => setVideoLive(true), []);
  const handleVideoStall = useCallback(() => setVideoLive(false), []);

  const streamLost =
    !streamingAvatarActive ||
    streamingAvatarState === "failed" ||
    streamingAvatarState === "disconnected" ||
    streamingAvatarState === "inactive";

  useEffect(() => {
    if (streamLost) setVideoLive(false);
  }, [streamLost]);

  useEffect(() => {
    if (!streamingAvatarActive) {
      setHasFrozenFrame(false);
      return;
    }
    let raf = 0;
    let last = 0;
    const capture = (time: number) => {
      raf = requestAnimationFrame(capture);
      if (time - last < 150) return;
      last = time;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setHasFrozenFrame(true);
      } catch {
        // Frame not drawable yet (tainted or not decoded) — on réessaie plus tard.
      }
    };
    raf = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(raf);
  }, [streamingAvatarActive]);

  const videoVisible = streamingAvatarActive && videoLive && !streamLost;
  const frozenVisible = streamingAvatarActive && hasFrozenFrame && !videoVisible;
  const photoVisible = !videoVisible && !frozenVisible;
  const displayName = activeCharacter === "emma" ? "Emma" : "Max";
  const portrait = activeCharacter === "emma" ? emmaAvatar : maxAvatar;

  if (handoffCalling) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-muted"><PhoneCall className="h-9 w-9 animate-pulse text-primary" /></div>
        <div><h1 className="font-serif text-3xl">Appel d’Emma…</h1><p className="mt-2 text-sm text-muted-foreground">La session et le temps restant sont conservés · {sessionTimeRemaining}</p></div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background photo (Max plein cadre) — masquée dès qu'une image vidéo existe */}
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center transition-opacity duration-500",
          photoVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ backgroundImage: `url(${activeCharacter === "emma" ? emmaAvatar : maxLarge})` }}
        aria-hidden
      />
      {streamingAvatarActive && (
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            frozenVisible ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
      )}
      {streamingAvatarActive && (
        <video
          ref={(element) => {
            videoRef.current = element;
            attachAvatarMedia?.(element);
          }}
          autoPlay
          playsInline
          muted={false}
          onLoadedData={handleVideoLive}
          onPlaying={handleVideoLive}
          onCanPlay={handleVideoLive}
          onWaiting={handleVideoStall}
          onStalled={handleVideoStall}
          onSuspend={handleVideoStall}
          onEmptied={handleVideoStall}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            videoVisible ? "opacity-100" : "opacity-0",
          )}
          aria-label="Flux vidéo en direct de Max"
        />
      )}


      {/* Dark gradients to keep face area clear and bottom legible */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--background)/0.55) 0%, hsl(var(--background)/0.08) 22%, hsl(var(--background)/0.05) 45%, hsl(var(--background)/0.75) 78%, hsl(var(--background)/0.97) 100%)",
        }}
        aria-hidden
      />

      {/* HUD top */}
      <header className="relative z-10 flex items-start justify-between p-4 md:p-6">
        <div className="flex items-center gap-3 rounded-full border border-border/40 bg-background/60 px-3 py-2 backdrop-blur-md">
          <img src={portrait} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
          <div className="pr-2">
            <p className="text-xs font-medium leading-none text-foreground">{displayName}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</p>
          </div>
        </div>
        {streamingAvatarActive && streamingAvatarState === "connecting" && (
          <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Connexion vidéo…
          </div>
        )}
        {streamingAvatarActive && (streamingAvatarState === "failed" || streamingAvatarState === "disconnected") && (
          <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground backdrop-blur-md">
            <VideoOff className="h-3.5 w-3.5" />
            Mode voix
          </div>
        )}
        <div className="flex items-center gap-2">
          <span
            aria-label="Temps restant"
            className="rounded-full border border-border/40 bg-background/60 px-3 py-2 font-mono text-xs text-foreground/70 backdrop-blur-md"
          >
            {sessionTimeRemaining}
          </span>
          <button
            onClick={onHangUp}
            className="flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/80 backdrop-blur-md transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            <PhoneOff className="h-4 w-4" />
            Terminer
          </button>
        </div>
      </header>

      <div className="flex-1" />

      {/* Bottom: Max line, then user line (subtitle style — replaced each turn) */}
      <section className="relative z-10 px-4 pb-6 md:px-8 md:pb-8 tablet:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 tablet:gap-4">

          {displayedMax && (
            <p className="text-center font-serif text-xl leading-snug text-foreground drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] md:text-2xl transition-opacity duration-200">
              {displayedMax}
            </p>
          )}
          {displayedUser && (
            <p
              className="text-center text-base italic leading-snug text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] md:text-lg"
              aria-live="polite"
            >
              « {displayedUser} »
            </p>
          )}

          {handoffOffer && activeCharacter === "max" && (
            <div className="w-full max-w-xl rounded-xl border border-primary/40 bg-background/90 p-4 text-center shadow-xl backdrop-blur-md">
              <p className="font-medium">Max vous propose de parler avec Emma.</p>
              <p className="mt-1 text-xs text-muted-foreground">{handoffOffer.reason}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button onClick={onAcceptHandoff}>Appeler Emma</Button>
                <Button variant="outline" onClick={onRejectHandoff}>Rester avec Max</Button>
              </div>
            </div>
          )}

          {/* Status helper line */}
          <p className="min-h-[1.25rem] text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            {audioState === "idle" && "Clique pour parler"}
            {audioState === "mic_starting" && "Micro en cours d'ouverture…"}
            {audioState === "user_speaking" && "Enregistrement — clique pour envoyer"}
            {audioState === "user_finalizing" && "Finalisation de tout ce qui a été dit…"}
            {audioState === "max_thinking" && `${displayName} réfléchit…`}
            {audioState === "max_speaking" && `${displayName} répond…`}
          </p>

          {/* Toggle Mic button — clear start/stop switch */}
          <button
            onClick={handleToggleTalk}
            disabled={disabled}
            className={cn(
              "mt-1 flex min-h-12 items-center gap-3 rounded-full border-2 px-6 py-3 text-sm font-semibold uppercase tracking-wider backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 tablet:min-h-14 tablet:px-8 tablet:text-base",
              recording
                ? "border-destructive bg-destructive text-destructive-foreground shadow-[0_0_36px_-4px_hsl(var(--destructive)/0.8)] animate-pulse"
                : "border-primary bg-primary text-primary-foreground hover:brightness-110",
            )}
            aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
          >
            {audioState === "mic_starting" || audioState === "user_finalizing" || audioState === "max_thinking" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : recording ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
            <span>{recording ? "Arrêter" : "Démarrer"}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default ConversationScreen;
