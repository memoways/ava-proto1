/** PRD4 — Écran 8 : Conversation push-to-talk avec Max (stub Phase 1) */
import { Button } from "@/components/ui/button";
import { Mic, PhoneOff } from "lucide-react";
import maxImg from "@/assets/characters/max.svg";
import type { AudioState, ConversationMessage } from "@/types";
import { usePushToTalk } from "@/hooks/usePushToTalk";

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
  idle: "À toi de parler",
  user_speaking: "Je t'écoute…",
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
  const { buttonHandlers } = usePushToTalk({
    enabled: true,
    onPress: onPTTPress,
    onRelease: onPTTRelease,
  });

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* HUD top */}
      <header className="flex items-center justify-between border-b border-border/40 bg-card/30 px-6 py-3">
        <div className="flex items-center gap-3">
          <img src={maxImg} alt="" className="h-10 w-10 rounded-full border border-border" />
          <div>
            <p className="text-sm font-medium text-foreground">Max</p>
            <p className="text-xs text-muted-foreground">en ligne</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onHangUp} className="text-muted-foreground hover:text-destructive">
          <PhoneOff className="mr-2 h-4 w-4" />
          Terminer
        </Button>
      </header>

      {/* Stage */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="relative">
          <img
            src={maxImg}
            alt="Max"
            className="h-56 w-56 rounded-full border-2 border-primary/40 object-cover md:h-72 md:w-72"
          />
          {audioState === "max_speaking" && (
            <span className="absolute inset-0 animate-pulse rounded-full border-2 border-primary/60" />
          )}
        </div>

        {/* Subtitles */}
        <div className="mt-8 min-h-[6rem] w-full max-w-2xl space-y-3 text-center">
          {maxSubtitle && (
            <p className="font-serif text-xl leading-relaxed text-foreground md:text-2xl">
              {maxSubtitle}
            </p>
          )}
          {userSubtitle && (
            <p className="text-sm italic text-muted-foreground">
              « {userSubtitle} »
            </p>
          )}
        </div>
      </main>

      {/* PTT footer */}
      <footer className="flex flex-col items-center gap-3 border-t border-border/40 bg-card/30 px-6 py-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {STATE_LABELS[audioState]}
        </p>
        <button
          {...buttonHandlers}
          disabled={audioState === "max_thinking" || audioState === "max_speaking"}
          className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition active:scale-95 disabled:opacity-40 ${
            audioState === "user_speaking"
              ? "border-primary bg-primary/20 shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
              : "border-primary/40 bg-card hover:border-primary"
          }`}
          aria-label="Maintiens pour parler"
        >
          <Mic className="h-7 w-7 text-foreground" />
        </button>
        <p className="text-xs text-muted-foreground/70">
          Maintiens pour parler · relâche quand tu as terminé
        </p>
      </footer>
    </div>
  );
};

export default ConversationScreen;
