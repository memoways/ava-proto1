import { useCallback } from "react";
import type { GamePhase } from "@/types";

interface OnboardingScreenProps {
  onStart: () => void;
  onSkip: () => void;
}

const OnboardingScreen = ({ onStart, onSkip }: OnboardingScreenProps) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 animate-fade-in">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />
      
      <div className="relative z-10 max-w-xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-cinema-glow font-mono">
          Où est Ava ?
        </h1>
        
        <div className="space-y-4 text-secondary-foreground leading-relaxed text-lg">
          <p>
            Le monde a changé. Une pandémie a tout bouleversé. 
            Et Ava… Ava a disparu.
          </p>
          <p>
            <span className="text-foreground font-medium">Max</span> te contacte en visio. 
            Il a besoin de ton aide. Parle-lui sincèrement — 
            ta voix est ta seule arme.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
            Prototype expérimental — Autorisez l'accès au micro quand demandé
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 pt-4">
          <button
            onClick={onStart}
            className="w-full max-w-xs rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
          >
            Commencer
          </button>
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Passer →
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
