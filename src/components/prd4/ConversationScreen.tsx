/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { useCallback, useEffect, useMemo } from "react";
import { Mic, Square, PhoneOff, Loader2 } from "lucide-react";
import maxLarge from "@/assets/characters/max-large.jpg";
import maxAvatar from "@/assets/characters/max.jpg";
import type { AudioState, ConversationMessage } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  audioState: AudioState;
  userSubtitle: string;
  maxSubtitle: string;
  conversationLog: ConversationMessage[];
  onPTTPress: () => void;
  onPTTRelease: () => void;
  onHangUp: () => void;
}

const ConversationScreen = ({
  audioState,
  userSubtitle,
  maxSubtitle,
  conversationLog,
  onPTTPress,
  onPTTRelease,
  onHangUp,
}: Props) => {
  const disabled = audioState === "mic_starting" || audioState === "max_thinking" || audioState === "max_speaking";
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
      if (!mx && m.role === "assistant") mx = m.content;
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
  const displayedUser = recording || audioState === "mic_starting"
    ? userSubtitle
    : lastUserText;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background photo (Max plein cadre) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${maxLarge})` }}
        aria-hidden
      />
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
          <img src={maxAvatar} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
          <div className="pr-2">
            <p className="text-xs font-medium leading-none text-foreground">Max</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</p>
          </div>
        </div>
        <button
          onClick={onHangUp}
          className="flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-3 py-2 text-sm text-foreground/80 backdrop-blur-md transition-colors hover:bg-destructive/20 hover:text-destructive"
        >
          <PhoneOff className="h-4 w-4" />
          Terminer
        </button>
      </header>

      <div className="flex-1" />

      {/* Bottom: Max line, then user line (subtitle style — replaced each turn) */}
      <section className="relative z-10 px-4 pb-6 md:px-8 md:pb-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3">
          {displayedMax && (
            <p
              key={`max-${displayedMax.length}`}
              className="animate-fade-in text-center font-serif text-xl leading-snug text-foreground drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] md:text-2xl"
            >
              {displayedMax}
            </p>
          )}
          {displayedUser && (
            <p
              key={`usr-${displayedUser.length}`}
              className={cn(
                "animate-fade-in text-center text-base italic leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] md:text-lg",
                recording ? "text-primary/90" : "text-foreground/80",
              )}
            >
              « {displayedUser} »
            </p>
          )}

          {/* Status helper line */}
          <p className="min-h-[1.25rem] text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            {audioState === "idle" && "Clique pour parler"}
            {audioState === "mic_starting" && "Micro en cours d'ouverture…"}
            {audioState === "user_speaking" && "Enregistrement — clique pour envoyer"}
            {audioState === "max_thinking" && "Max réfléchit…"}
            {audioState === "max_speaking" && "Max répond…"}
          </p>

          {/* Toggle Mic button — clear start/stop switch */}
          <button
            onClick={handleToggleTalk}
            disabled={disabled}
            className={cn(
              "mt-1 flex items-center gap-3 rounded-full border-2 px-6 py-3 text-sm font-semibold uppercase tracking-wider backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
              recording
                ? "border-destructive bg-destructive text-destructive-foreground shadow-[0_0_36px_-4px_hsl(var(--destructive)/0.8)] animate-pulse"
                : "border-primary bg-primary text-primary-foreground hover:brightness-110",
            )}
            aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
          >
            {audioState === "mic_starting" || audioState === "max_thinking" ? (
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
