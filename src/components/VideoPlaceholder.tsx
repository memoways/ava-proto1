import { useState, useEffect } from "react";

interface VideoPlaceholderProps {
  title: string;
  description: string;
  durationSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
}

const VideoPlaceholder = ({ title, description, durationSeconds, onComplete, onSkip }: VideoPlaceholderProps) => {
  const [elapsed, setElapsed] = useState(0);
  const progress = Math.min((elapsed / durationSeconds) * 100, 100);

  useEffect(() => {
    if (elapsed >= durationSeconds) {
      onComplete();
      return;
    }
    const id = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => clearInterval(id);
  }, [elapsed, durationSeconds, onComplete]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background animate-fade-in">
      <div className="relative z-10 max-w-lg text-center space-y-6">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          {title}
        </p>
        <p className="text-lg text-secondary-foreground italic leading-relaxed">
          {description}
        </p>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64">
        <div className="h-0.5 w-full rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-primary/60 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        onClick={onSkip}
        className="absolute bottom-8 right-8 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
      >
        Passer →
      </button>
    </div>
  );
};

export default VideoPlaceholder;
