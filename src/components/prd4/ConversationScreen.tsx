/** PRD4 — Écran 8 : Conversation avec Max (toggle-to-talk, fond Max plein écran) */
import { Button } from "@/components/ui/button";
import { Mic, MicOff, PhoneOff, Loader2 } from "lucide-react";
import maxLarge from "@/assets/characters/max-large.jpg";
import maxAvatar from "@/assets/characters/max.jpg";
import type { AudioState, ConversationMessage } from "@/types";
import { usePushToTalk } from "@/hooks/usePushToTalk";
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
  user_speaking: "Tu parles — clique pour envoyer",
  max_thinking: "Max réfléchit…",
  max_speaking: "Max répond…",
};

const ConversationScreen = ({
  audioState,
  userSubtitle,
  maxSubtitle,
  onPTTPress,
  onPTTRelease,
  onHangUp,
}: Props) => {
  const disabled = audioState === "max_thinking" || audioState === "max_speaking";
  const recording = audioState === "user_speaking";

  const { buttonHandlers } = usePushToTalk({
    enabled: !disabled,
    onPress: onPTTPress,
    onRelease: onPTTRelease,
    mode: "toggle",
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Background photo (Max plein cadre) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${maxLarge})` }}
        aria-hidden
      />
      {/* Dark gradients to keep face area clear, only edges dimmed */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, hsl(var(--background)/0.85) 0%, hsl(var(--background)/0.15) 18%, hsl(var(--background)/0.05) 45%, hsl(var(--background)/0.55) 78%, hsl(var(--background)/0.95) 100%)",
        }}
        aria-hidden
      />

      {/* HUD top — pinned to edges, away from face */}
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

      {/* Spacer — leave Max's face visible */}
      <div className="relative z-10 flex-1" />

      {/* Bottom HUD — subtitles + PTT */}
      <footer className="relative z-10 px-4 pb-5 md:px-8 md:pb-7">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {/* Subtitles */}
          <div className="min-h-[3.5rem] space-y-2 text-center">
            {maxSubtitle && (
              <p className="font-serif text-lg leading-snug text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:text-xl">
                {maxSubtitle}
              </p>
            )}
            {userSubtitle && (
              <p className="text-sm italic text-foreground/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                « {userSubtitle} »
              </p>
            )}
          </div>

          {/* PTT */}
          <div className="flex flex-col items-center gap-2">
            <button
              {...buttonHandlers}
              disabled={disabled}
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full border-2 backdrop-blur-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                recording
                  ? "scale-110 border-destructive bg-destructive/30 shadow-[0_0_40px_-5px_hsl(var(--destructive)/0.7)]"
                  : "border-primary/60 bg-background/60 hover:border-primary hover:bg-background/80",
              )}
              aria-label={recording ? "Cliquer pour envoyer" : "Cliquer pour parler"}
            >
              {audioState === "max_thinking" ? (
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
