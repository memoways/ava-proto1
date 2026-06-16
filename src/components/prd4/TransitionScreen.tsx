/** PRD GIFF — Transition courte entre posture et conversation. */
import { useEffect } from "react";

interface Props {
  onContinue: () => void;
  durationMs?: number;
}

const TransitionScreen = ({ onContinue, durationMs = 800 }: Props) => {
  useEffect(() => {
    const id = window.setTimeout(onContinue, durationMs);
    return () => window.clearTimeout(id);
  }, [onContinue, durationMs]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
    </div>
  );
};

export default TransitionScreen;
