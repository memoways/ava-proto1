import type { AudioState } from "@/types";
import SubtitleOverlay from "./SubtitleOverlay";

interface ConversationScreenProps {
  timerFormatted: string;
  timerWarning: boolean;
  trustLevel: number;
  trustThreshold: number;
  audioState: AudioState;
  userSubtitle: string;
  maxSubtitle: string;
  onMicToggle: () => void;
  micActive: boolean;
}

const statusLabels: Record<AudioState, string> = {
  idle: "En attente…",
  user_speaking: "Max écoute…",
  max_thinking: "Max réfléchit…",
  max_speaking: "Max parle…",
};

const ConversationScreen = ({
  timerFormatted,
  timerWarning,
  trustLevel,
  trustThreshold,
  audioState,
  userSubtitle,
  maxSubtitle,
  onMicToggle,
  micActive,
}: ConversationScreenProps) => {
  return (
    <div 
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/assets/max-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      {/* Vignette */}
      <div className="absolute inset-0 cinema-vignette pointer-events-none z-10" />
      <div className="absolute inset-0 cinema-gradient pointer-events-none" />

      {/* Timer top-right */}
      <div className="absolute top-6 right-6 z-20">
        <span className={`font-mono text-sm ${timerWarning ? "text-timer-warning" : "text-muted-foreground"}`}>
          {timerFormatted}
        </span>
      </div>

      {/* Trust top-left */}
      <div className="absolute top-6 left-6 z-20">
        <span className="font-mono text-xs text-trust">
          Confiance: {trustLevel}/{trustThreshold}
        </span>
      </div>

      {/* Status centered */}
      <div className="relative z-10 flex flex-col items-center gap-4 mt-[40vh]">
        <p className="text-sm font-mono text-muted-foreground animate-fade-in">
          {statusLabels[audioState]}
          {audioState === "max_thinking" && (
            <span className="ml-1">
              <span className="animate-typing-dot-1">.</span>
              <span className="animate-typing-dot-2">.</span>
              <span className="animate-typing-dot-3">.</span>
            </span>
          )}
        </p>

        {/* Mic hint */}
        {audioState === "idle" && !micActive && (
          <p className="text-xs text-muted-foreground/60 animate-fade-in">
            Cliquez sur le micro pour parler à Max
          </p>
        )}
      </div>

      {/* Mic button */}
      <div className="absolute bottom-32 z-20">
        <button
          onClick={onMicToggle}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
            micActive
              ? "border-primary bg-primary/10 text-primary animate-pulse-mic"
              : "border-border bg-secondary text-muted-foreground hover:border-primary/50"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
      </div>

      {/* Subtitles */}
      <SubtitleOverlay userText={userSubtitle} maxText={maxSubtitle} audioState={audioState} />
    </div>
  );
};

export default ConversationScreen;
