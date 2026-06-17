/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import maxLarge from "@/assets/characters/max-large.jpg";
import maxAvatar from "@/assets/characters/max.jpg";
import type { AudioState, ConversationMessage, PRD4TurnLabels } from "@/types";
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

const STATE_LABELS: Record<AudioState, string> = {
  idle: "Clique pour parler",
  mic_starting: "Ouverture du micro…",
  user_speaking: "Tu parles — clique pour envoyer",
  max_thinking: "Max réfléchit…",
  max_speaking: "Max répond…",
};

function LabelChips({ labels }: { labels: PRD4TurnLabels | null | undefined }) {
  if (!labels) return null;
  const items: { kind: "theme" | "topic" | "intent"; value: string }[] = [];
  for (const v of labels.themes ?? []) items.push({ kind: "theme", value: v });
  for (const v of labels.topics ?? []) items.push({ kind: "topic", value: v });
  for (const v of labels.intentions ?? []) items.push({ kind: "intent", value: v });
  if (items.length === 0) return null;
  const colorFor = (k: string) =>
    k === "theme"
      ? "bg-primary/15 text-primary border-primary/30"
      : k === "topic"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return (
    <div className="mt-1 flex flex-wrap justify-end gap-1">
      {items.slice(0, 4).map((it, i) => (
        <span
          key={`${it.kind}-${it.value}-${i}`}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide backdrop-blur-sm",
            colorFor(it.kind),
          )}
          title={it.kind}
        >
          {it.value}
        </span>
      ))}
    </div>
  );
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
    if (audioState === "user_speaking") onPTTRelease();
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

  // Auto-scroll transcript on new messages
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversationLog.length, userSubtitle, maxSubtitle]);

  // Display only last ~6 messages in HUD
  const recent = useMemo(() => conversationLog.slice(-6), [conversationLog]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background photo (Max plein cadre) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${maxLarge})` }}
        aria-hidden
      />
      {/* Dark gradients to keep face area clear */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--background)/0.85) 0%, hsl(var(--background)/0.15) 18%, hsl(var(--background)/0.05) 45%, hsl(var(--background)/0.55) 78%, hsl(var(--background)/0.95) 100%)",
        }}
        aria-hidden
      />

      {/* HUD top */}
      <header className="relative z-10 flex items-start justify-between p-4 md:p-6">
        <div className="flex items-center gap-3 rounded-full border border-border/40 bg-background/60 px-3 py-2 backdrop-blur-md">
          <img src={maxAvatar} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
          <div className="pr-2">
            <p className="text-xs font-medium text-foreground leading-none">Max</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onHangUp}
          className="rounded-full border border-border/40 bg-background/60 text-foreground/80 backdrop-blur-md hover:bg-destructive/20 hover:text-destructive"
        >
          <PhoneOff className="mr-2 h-4 w-4" />
          Terminer
        </Button>
      </header>

      {/* Transcript */}
      <div className="relative z-10 flex-1 px-4 md:px-8">
        <div
          ref={scrollRef}
          className="mx-auto max-h-[55vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border/30 bg-background/40 p-4 backdrop-blur-md"
        >
          {recent.length === 0 ? (
            <p className="text-center text-xs italic text-muted-foreground">La conversation commence…</p>
          ) : (
            <div className="space-y-3">
              {recent.map((m, i) => (
                <div key={`${m.timestamp}-${i}`} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]",
                      m.role === "user"
                        ? "bg-primary/25 text-foreground"
                        : "bg-background/70 text-foreground font-serif",
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "user" && <LabelChips labels={m.labels} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom HUD — live STT + PTT */}
      <footer className="relative z-10 px-4 pb-5 md:px-8 md:pb-7">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {/* Live STT subtitle (mise à jour en temps réel pendant la parole) */}
          <div className="min-h-[2.5rem] text-center">
            {(recording || userSubtitle) && userSubtitle && (
              <p className="text-sm italic text-foreground/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                « {userSubtitle} »
              </p>
            )}
            {audioState === "max_speaking" && maxSubtitle && (
              <p className="font-serif text-lg leading-snug text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:text-xl">
                {maxSubtitle}
              </p>
            )}
          </div>

          {/* PTT */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleToggleTalk}
              disabled={disabled}
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full border-2 backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                recording
                  ? "scale-110 border-destructive bg-destructive/30 shadow-[0_0_40px_-5px_hsl(var(--destructive)/0.7)]"
                  : "border-primary/60 bg-background/60 hover:border-primary hover:bg-background/80",
              )}
              aria-label={recording ? "Cliquer pour envoyer" : "Cliquer pour parler"}
            >
              {audioState === "mic_starting" || audioState === "max_thinking" ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : recording ? (
                <MicOff className="h-7 w-7 text-destructive-foreground" />
              ) : (
                <Mic className="h-7 w-7 text-foreground" />
              )}
            </button>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {STATE_LABELS[audioState]}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ConversationScreen;
