/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  /**
   * "call" is the smartphone voice call screen (round portrait, no avatar
   * video); "video" (default) is the full-screen avatar screen. Computed once by
   * the caller from the device class, never from `window` here.
   */
  layout?: "video" | "call";
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
  /** "contain" shows the whole provider frame (LemonSlice); default crops to fill the screen. */
  avatarVideoFit?: "cover" | "contain";
  activeCharacter: "max" | "emma";
  portraitUrl?: string | null;
  handoffIssue?: { phase: 'preparing' | 'error'; reason: string; reload?: boolean } | null;
  onRetryHandoff?: () => void;
  handoffOffer?: { reason: string; targetCharacter?: "max" | "emma" } | null;
  handoffPortraitUrl?: string | null;
  handoffCalling?: boolean;
  handoffInputLocked?: boolean;
  /** A cinematic is announced: no new turn and no interruption until it is over. */
  inputHeld?: boolean;
  /** A cinematic is coming: discreet capsule under the characters, with « Ignorer ». */
  cinematicAnnounced?: boolean;
  onIgnoreCinematic?: () => void;
  handoffCallingTarget?: "max" | "emma";
  onAcceptHandoff?: () => void;
  onRejectHandoff?: () => void;
}

const characterCapsuleClass = "flex min-h-14 w-full items-center gap-3 rounded-full border bg-background/60 px-3 py-2 text-left backdrop-blur-md";

const ConversationScreen = ({
  layout = "video",
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
  streamingAvatarActive: streamingAvatarRequested = false,
  streamingAvatarState = "inactive",
  attachAvatarMedia,
  avatarVideoFit = "cover",
  activeCharacter,
  portraitUrl = null,
  handoffIssue = null,
  handoffOffer = null,
  handoffPortraitUrl = null,
  handoffCalling = false,
  handoffInputLocked = false,
  inputHeld = false,
  cinematicAnnounced = false,
  onIgnoreCinematic,
  handoffCallingTarget = "emma",
  onAcceptHandoff,
  onRejectHandoff,
}: Props) => {
  const handoffStatusId = useId();
  // Le flux vidéo en direct est celui de Max. Pour tout autre personnage (Emma),
  // on n'affiche ni le flux, ni sa dernière image figée : seulement sa photo.
  const callLayout = layout === "call";
  // The call screen never shows the avatar stream, whatever the caller requests.
  const streamingAvatarActive = streamingAvatarRequested && activeCharacter === "max" && !callLayout;
  const handoffInputBlocked = handoffCalling || handoffInputLocked;
  const disabled = handoffInputBlocked || inputHeld || audioState === "mic_starting" || audioState === "user_finalizing" || audioState === "max_thinking" || audioState === "max_speaking";
  const recording = audioState === "user_speaking";

  const handleToggleTalk = useCallback(() => {
    if (handsFree) {
      if ((handoffInputBlocked) && !handsFreeListening) return;
      if (audioState !== "mic_starting") onToggleHandsFree?.();
      return;
    }
    if (handoffInputBlocked) return;
    if (audioState === "idle" && !inputHeld) onPTTPress();
    else if (audioState === "user_speaking") onPTTRelease();
  }, [audioState, handoffInputBlocked, handsFree, handsFreeListening, inputHeld, onPTTPress, onPTTRelease, onToggleHandsFree]);

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
  // Once the live video is on screen it stays there until the stream is lost: a short stall
  // freezes the last frame instead of flashing the portrait.
  const [videoShown, setVideoShown] = useState(false);
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
    if (streamLost) {
      setVideoLive(false);
      setVideoShown(false);
    }
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

  const warming = streamingAvatarState === "warming";
  const videoVisible = streamingAvatarActive && !streamLost && !warming && (videoLive || videoShown);
  const frozenVisible = streamingAvatarActive && hasFrozenFrame && !videoVisible && !warming;
  useEffect(() => {
    if (videoVisible) setVideoShown(true);
  }, [videoVisible]);
  const photoVisible = !videoVisible && !frozenVisible;
  const displayName = displayNameForCharacter(activeCharacter);
  const portrait = portraitUrl ?? (activeCharacter === "emma" ? emmaAvatar : maxAvatar);
  const backgroundPortrait = portraitUrl ?? (activeCharacter === "emma" ? emmaAvatar : maxLarge);
  const offerTarget = handoffOffer?.targetCharacter ?? (activeCharacter === "max" ? "emma" : "max");
  const offerTargetName = displayNameForCharacter(offerTarget);
  const offerPortrait = handoffPortraitUrl ?? (offerTarget === "max" ? maxAvatar : emmaAvatar);
  const handoffPreparing = !handoffOffer && handoffIssue?.phase === "preparing";
  const handoffCaptureBusy = audioState === "mic_starting" || audioState === "user_finalizing" || recording;
  const handoffReady = Boolean(handoffOffer) && !handoffInputBlocked && !handoffCaptureBusy;
  const handoffStatus = handoffInputBlocked ? "Connexion…"
    : handoffOffer ? (handoffCaptureBusy ? "Parole en cours" : "Disponible")
    : handoffPreparing ? "En préparation…" : "Indisponible";
  const callingName = displayNameForCharacter(handoffCallingTarget ?? "emma");

  const handoffControls = (
    <>
    <span className="sr-only" aria-live="polite" aria-atomic="true">
      {handoffOffer ? `${displayName} vous propose de parler avec ${offerTargetName}.`
        : handoffPreparing ? `Passage vers ${offerTargetName} en préparation.` : ""}
    </span>
    <button
      type="button"
      data-character-capsule="handoff"
      data-state={handoffReady ? "ready" : handoffOffer ? "busy" : handoffPreparing ? "preparing" : "unavailable"}
      aria-label={handoffOffer ? `Appeler ${offerTargetName}` : `Passage vers ${offerTargetName} — ${handoffPreparing ? "en préparation" : "indisponible"}`}
      aria-describedby={handoffStatusId}
      disabled={!handoffReady}
      onClick={onAcceptHandoff}
      className={cn(characterCapsuleClass,
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed",
        handoffReady ? "animate-handoff-ready border-accent bg-accent/15 text-foreground hover:bg-accent/25"
          : handoffPreparing || handoffOffer ? "border-border/70 text-foreground/80" : "border-dashed border-border/60 text-foreground/60",
      )}
    >
      <img src={offerPortrait} alt="" className={cn("h-8 w-8 shrink-0 rounded-full border border-border object-cover", !handoffOffer && "opacity-60")} />
      <span className="min-w-0 pr-1">
        <span className="block text-xs font-medium leading-none">{handoffOffer ? `Appeler ${offerTargetName}` : offerTargetName}</span>
        <span id={handoffStatusId} className={cn("mt-1 flex items-center gap-1 text-[10px]", handoffReady && "font-semibold text-accent")}>
          {(handoffPreparing || handoffInputBlocked) && <Loader2 aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" />}
          {handoffStatus}
        </span>
      </span>
    </button>
    {handoffOffer && (
        <button type="button" disabled={handoffInputBlocked} onClick={onRejectHandoff}
          className="min-h-11 rounded-full px-3 text-xs text-foreground/80 underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
          Rester avec {displayName}
        </button>
    )}
    {/* In the header column, never over the conversation text. */}
    {cinematicAnnounced && (
      <div role="status" data-testid="cinematic-announced"
        className="flex min-h-9 w-full items-center gap-2 rounded-full border border-border/40 bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-foreground/70 motion-reduce:animate-none" />
        <span className="min-w-0 flex-1 leading-tight">Une vidéo arrive</span>
        {onIgnoreCinematic && (
          <button type="button" onClick={onIgnoreCinematic}
            className={cn(callLayout && "min-h-11 px-2", "shrink-0 underline-offset-2 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary")}>
            Ignorer
          </button>
        )}
      </div>
    )}
    </>
  );

  const talkControls = (
    <>
    {/* Status helper line */}
    <p role="status" aria-live="polite" hidden={handsFree} className="min-h-[1.25rem] text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
      {audioState === "idle" && (callLayout ? "Touche pour parler" : "Clique pour parler")}
      {audioState === "mic_starting" && "Micro en cours d'ouverture…"}
      {audioState === "user_speaking" && (callLayout ? "Enregistrement — touche pour envoyer" : "Enregistrement — clique pour envoyer")}
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
          {audioState === "max_speaking" && (inputHeld ? `${displayName} répond` : `${displayName} répond — tu peux l'interrompre`)}
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
    </>
  );

  if (handoffCalling) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-muted"><PhoneCall className="h-9 w-9 animate-pulse text-primary" /></div>
        <Button variant="destructive" onClick={onHangUp}>Terminer</Button>
        <div><h1 className="font-serif text-3xl">{callingName === "Emma" ? "Appel d’Emma…" : "Appel de Max…"}</h1><p className="mt-2 text-sm text-muted-foreground">La session et le temps restant sont conservés · {sessionTimeRemaining}</p></div>
      </div>
    );
  }

  if (callLayout) {
    const callStatus = audioState === "max_speaking" ? "parle…"
      : audioState === "max_thinking" ? "réfléchit…"
      : audioState === "user_speaking" || handsFreeListening ? "écoute…"
      : "en ligne";
    return (
      <div
        data-layout="call"
        className="relative flex min-h-[100svh] flex-col overflow-hidden bg-background"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4">
          <span
            aria-label="Temps restant"
            className="rounded-full border border-border/40 bg-background/60 px-3 py-2 font-mono text-xs text-foreground/70"
          >
            {sessionTimeRemaining}
          </span>
          <button
            onClick={onHangUp}
            className="flex min-h-11 items-center gap-2 rounded-full border border-border/40 bg-background/60 px-4 py-2 text-sm text-foreground/80 transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            <PhoneOff className="h-4 w-4" />
            Terminer
          </button>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
          <img
            src={portrait}
            alt={`Portrait d’${displayName}`}
            data-testid="call-portrait"
            className={cn(
              "h-36 w-36 rounded-full border-2 object-cover transition-shadow",
              audioState === "max_speaking" ? "border-primary shadow-[0_0_40px_-6px_hsl(var(--primary)/0.8)]" : "border-border",
            )}
          />
          <h1 className="font-serif text-3xl text-foreground">{displayName}</h1>
          <p data-testid="call-status" aria-live="polite" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {callStatus}
          </p>
          {displayedUser && (
            <p className="mt-4 max-w-sm text-base italic leading-snug text-foreground/90" aria-live="polite">
              « {displayedUser} »
            </p>
          )}
        </main>

        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-stretch gap-2 px-4">
          {handoffControls}
        </div>

        <section className="relative z-10 px-4 pb-6 pt-4">
          <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            {talkControls}
          </div>
        </section>
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
            "absolute inset-0 h-full w-full transition-opacity duration-300",
            avatarVideoFit === "contain" ? "object-contain" : "object-cover",
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
            "absolute inset-0 h-full w-full transition-opacity duration-300",
            avatarVideoFit === "contain" ? "object-contain" : "object-cover",
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
        <div className="flex w-40 max-w-full flex-col items-stretch gap-2">
          <div data-character-capsule="current" className={cn(characterCapsuleClass, "border-border/40")}>
            <img src={portrait} alt={`Portrait d’${displayName}`} className="h-8 w-8 rounded-full border border-border object-cover" />
            <div className="pr-2">
              <p className="text-xs font-medium leading-none text-foreground">{displayName}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</p>
            </div>
          </div>
          {handoffControls}
        </div>
        {streamingAvatarActive && (streamingAvatarState === "connecting" || warming) && (
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

          {talkControls}
        </div>
      </section>
    </div>
  );
};

export default ConversationScreen;
