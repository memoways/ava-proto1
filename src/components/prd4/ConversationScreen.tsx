/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, PhoneOff, Loader2, VideoOff, PhoneCall } from "lucide-react";
import maxLarge from "@/assets/characters/max-large.jpg";
import maxAvatar from "@/assets/characters/max.jpg";
import emmaAvatar from "@/assets/characters/emma.jpg";
import { displayNameForCharacter } from "@/services/characterRegistry";
import type { AudioState, ConversationMessage } from "@/types";
import { cn } from "@/lib/utils";
import type { StreamingAvatarConnectionState } from "@/services/streamingAvatar";
import { Button } from "@/components/ui/button";
import { sliceConversationForCharacter } from "@/services/characterConversation";

interface Props {
  audioState: AudioState;
  userSubtitle: string;
  maxSubtitle: string;
  conversationLog: ConversationMessage[];
  sessionTimeRemaining: string;
  onPTTPress: () => void;
  onPTTRelease: () => void;
  /** Mode mains libres : un seul bouton pour ouvrir/couper le micro. */
  handsFree?: boolean;
  voiceOnly?: boolean;
  handsFreeListening?: boolean;
  onToggleHandsFree?: () => void;
  onHangUp: () => void;
  streamingAvatarActive?: boolean;
  streamingAvatarState?: StreamingAvatarConnectionState;
  attachAvatarMedia?: (element: HTMLMediaElement | null) => void;
  activeCharacter: "max" | "emma";
  portraitUrl?: string | null;
  handoffOffer?: { reason: string; targetCharacter?: "max" | "emma" } | null;
  handoffPortraitUrl?: string | null;
  handoffCalling?: boolean;
  handoffInputLocked?: boolean;
  handoffCallingTarget?: "max" | "emma";
  onAcceptHandoff?: () => void;
  onRejectHandoff?: () => void;
}

const ConversationScreen = ({
  audioState,
  userSubtitle,
  conversationLog,
  sessionTimeRemaining,
  onPTTPress,
  onPTTRelease,
  handsFree = false,
  handsFreeListening = false,
  onToggleHandsFree,
  onHangUp,
  streamingAvatarActive = false,
  streamingAvatarState = "inactive",
  attachAvatarMedia,
  activeCharacter,
  portraitUrl = null,
  handoffOffer = null,
  handoffPortraitUrl = null,
  handoffCalling = false,
  handoffInputLocked = false,
  handoffCallingTarget = "emma",
  onAcceptHandoff,
  onRejectHandoff,
}: Props) => {
  const handoffInputBlocked = handoffCalling || handoffInputLocked;
  const disabled = handoffInputBlocked || audioState === "mic_starting" || audioState === "user_finalizing" || audioState === "max_thinking" || audioState === "max_speaking";
  const recording = audioState === "user_speaking";

  const handleToggleTalk = useCallback(() => {
    if (handsFree) {
      if ((handoffInputBlocked) && !handsFreeListening) return;
      if (audioState !== "mic_starting") onToggleHandsFree?.();
      return;
    }
    if (handoffInputBlocked) return;
    if (audioState === "idle") onPTTPress();
    else if (audioState === "user_speaking") onPTTRelease();
  }, [audioState, handoffInputBlocked, handsFree, handsFreeListening, onPTTPress, onPTTRelease, onToggleHandsFree]);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("button, a, input, textarea, select, [role=button]")) || target.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || isInteractiveTarget(event.target)) return;
      if (handoffInputBlocked) return;
      event.preventDefault();
      handleToggleTalk();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggleTalk, handoffInputBlocked]);

  // Only the user's words are displayed, scoped to the active character.
  const lastUserText = useMemo(() => {
    const visibleLog = sliceConversationForCharacter(conversationLog, activeCharacter);
    return [...visibleLog].reverse().find(message => message.role === "user")?.content ?? "";
  }, [activeCharacter, conversationLog]);

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

  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    attachAvatarMedia?.(element);
  }, [attachAvatarMedia]);

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
      if (time - last < 500) return;
      last = time;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
      if (canvas.width !== Math.min(video.videoWidth, 640)) {
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
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
  const displayName = displayNameForCharacter(activeCharacter);
  const portrait = portraitUrl ?? (activeCharacter === "emma" ? emmaAvatar : maxAvatar);
  const backgroundPortrait = portraitUrl ?? (activeCharacter === "emma" ? emmaAvatar : maxLarge);
  const offerTarget = handoffOffer?.targetCharacter === "max" ? "max" : "emma";
  const offerTargetName = displayNameForCharacter(offerTarget);
  const offerPortrait = handoffPortraitUrl ?? (offerTarget === "max" ? maxAvatar : emmaAvatar);
  const callingName = displayNameForCharacter(handoffCallingTarget ?? "emma");

  if (handoffCalling) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-muted"><PhoneCall className="h-9 w-9 animate-pulse text-primary" /></div>
        <Button variant="destructive" onClick={onHangUp}>Terminer</Button>
        <div><h1 className="font-serif text-3xl">{callingName === "Emma" ? "Appel d’Emma…" : "Appel de Max…"}</h1><p className="mt-2 text-sm text-muted-foreground">La session et le temps restant sont conservés · {sessionTimeRemaining}</p></div>
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
        style={{ backgroundImage: `url(${backgroundPortrait})` }}
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
          ref={attachVideo}
          autoPlay
          playsInline
          muted={false}
          onLoadedData={handleVideoLive}
          onPlaying={handleVideoLive}
          onCanPlay={handleVideoLive}
          onWaiting={handleVideoStall}
          onStalled={handleVideoStall}
          onEmptied={handleVideoStall}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            videoVisible ? "opacity-100" : "opacity-0",
          )}
          aria-label={`Flux vidéo en direct de ${displayName}`}
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
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-3 p-4 md:p-6">
        <div className="flex flex-col items-start gap-2">
          <div className="flex items-center gap-3 rounded-full border border-border/40 bg-background/60 px-3 py-2 backdrop-blur-md">
            <img src={portrait} alt={`Portrait d’${displayName}`} className="h-8 w-8 rounded-full border border-border object-cover" />
            <div className="pr-2">
              <p className="text-xs font-medium leading-none text-foreground">{displayName}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</p>
            </div>
          </div>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {handoffOffer ? `${displayName} vous propose de parler avec ${offerTargetName}.` : ""}
          </span>
          {handoffOffer && (
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                aria-label={`Appeler ${offerTargetName}`}
                disabled={handoffInputBlocked || audioState === "mic_starting" || audioState === "user_finalizing" || audioState === "user_speaking"}
                onClick={onAcceptHandoff}
                className="relative flex min-h-12 items-center gap-2 rounded-full border border-primary bg-background/90 px-3 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-md hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/40 motion-safe:animate-pulse motion-reduce:animate-none" style={{ animationDuration: "3s" }} />
                <img src={offerPortrait} alt={`Portrait de ${offerTargetName}`} className="h-8 w-8 rounded-full border border-primary/50 object-cover" />
                <span>Appeler {offerTargetName}</span>
              </button>
              <button type="button" disabled={handoffInputBlocked} onClick={onRejectHandoff}
                className="min-h-11 rounded-full px-3 text-xs text-foreground/80 underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
                Rester avec {displayName}
              </button>
            </div>
          )}
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

      {/* Bottom: live user transcription, then the exact submitted line */}
      <section className="relative z-10 px-4 pb-6 md:px-8 md:pb-8 tablet:pb-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 tablet:gap-4">

          {displayedUser && (
            <p
              className="text-center text-base italic leading-snug text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] md:text-lg"
              aria-live="polite"
            >
              « {displayedUser} »
            </p>
          )}

          {/* Status helper line */}
          <p role="status" aria-live="polite" hidden={handsFree} className="min-h-[1.25rem] text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            {audioState === "idle" && "Clique pour parler"}
            {audioState === "mic_starting" && "Micro en cours d'ouverture…"}
            {audioState === "user_speaking" && "Enregistrement — clique pour envoyer"}
            {audioState === "user_finalizing" && "Finalisation de tout ce qui a été dit…"}
            {audioState === "max_thinking" && `${displayName} réfléchit…`}
            {audioState === "max_speaking" && `${displayName} répond…`}
          </p>

          {handsFree ? (
            <>
              <p role="status" aria-live="polite" className="min-h-[1.25rem] text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                {!handsFreeListening && audioState !== "mic_starting" && "Active le micro, puis parle librement"}
                {audioState === "mic_starting" && "Micro en cours d'ouverture…"}
                {handsFreeListening && audioState === "idle" && "À l'écoute…"}
                {handsFreeListening && audioState === "user_speaking" && "Je t'écoute…"}
                {audioState === "user_finalizing" && "…"}
                {audioState === "max_thinking" && `${displayName} réfléchit…`}
                {audioState === "max_speaking" && `${displayName} répond — tu peux l'interrompre`}
              </p>
              <button
                onClick={handleToggleTalk}
                disabled={handoffInputBlocked || audioState === "mic_starting"}
                className={cn(
                  "mt-1 flex min-h-12 items-center gap-3 rounded-full border-2 px-6 py-3 text-sm font-semibold uppercase tracking-wider backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 tablet:min-h-14 tablet:px-8 tablet:text-base",
                  handsFreeListening
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-primary bg-primary text-primary-foreground hover:brightness-110",
                )}
                aria-label={handsFreeListening ? "Couper le micro" : "Activer le micro"}
              >
                {audioState === "mic_starting" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className={cn("h-5 w-5", handsFreeListening && "animate-pulse")} />}
                <span>{handsFreeListening ? "Micro ouvert" : "Activer le micro"}</span>
              </button>
            </>
          ) : (
          <>
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
          </>
          )}
        </div>
      </section>
    </div>
  );
};

export default ConversationScreen;
