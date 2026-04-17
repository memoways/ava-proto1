import { useState } from "react";
import type { OnboardingVariant } from "@/types";

interface ABChoiceScreenProps {
  onChoose: (variant: OnboardingVariant) => void;
}

const ABChoiceScreen = ({ onChoose }: ABChoiceScreenProps) => {
  const [hovering, setHovering] = useState<OnboardingVariant | null>(null);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />
      <div className="cinema-vignette absolute inset-0 pointer-events-none z-10" />

      <div className="relative z-20 flex flex-col items-center gap-12 max-w-3xl text-center animate-fade-in">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/60 font-mono">
            Avant de commencer
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Choisissez.
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full">
          {/* Pill A — Bleue */}
          <button
            onMouseEnter={() => setHovering("A")}
            onMouseLeave={() => setHovering(null)}
            onClick={() => onChoose("A")}
            className="group relative flex flex-col items-center gap-6 p-8 rounded-xl border border-border/30 bg-black/20 backdrop-blur-sm transition-all hover:border-[hsl(220_80%_60%)] hover:bg-[hsl(220_80%_60%/0.05)] hover:scale-[1.02]"
          >
            <div
              className="h-24 w-24 rounded-full transition-all duration-500 group-hover:scale-110"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, hsl(220 90% 70%), hsl(220 80% 40%) 70%, hsl(220 70% 25%))",
                boxShadow:
                  hovering === "A"
                    ? "0 0 60px hsl(220 90% 60% / 0.5), inset -8px -10px 20px hsl(220 60% 20% / 0.6)"
                    : "0 0 20px hsl(220 90% 60% / 0.2), inset -8px -10px 20px hsl(220 60% 20% / 0.6)",
              }}
            />
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-mono">
                Variante
              </p>
              <p className="text-2xl font-bold text-foreground">A</p>
            </div>
          </button>

          {/* Pill B — Rouge */}
          <button
            onMouseEnter={() => setHovering("B")}
            onMouseLeave={() => setHovering(null)}
            onClick={() => onChoose("B")}
            className="group relative flex flex-col items-center gap-6 p-8 rounded-xl border border-border/30 bg-black/20 backdrop-blur-sm transition-all hover:border-[hsl(0_75%_55%)] hover:bg-[hsl(0_75%_55%/0.05)] hover:scale-[1.02]"
          >
            <div
              className="h-24 w-24 rounded-full transition-all duration-500 group-hover:scale-110"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, hsl(0 90% 70%), hsl(0 80% 45%) 70%, hsl(0 70% 25%))",
                boxShadow:
                  hovering === "B"
                    ? "0 0 60px hsl(0 90% 60% / 0.5), inset -8px -10px 20px hsl(0 60% 20% / 0.6)"
                    : "0 0 20px hsl(0 90% 60% / 0.2), inset -8px -10px 20px hsl(0 60% 20% / 0.6)",
              }}
            />
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/70 font-mono">
                Variante
              </p>
              <p className="text-2xl font-bold text-foreground">B</p>
            </div>
          </button>
        </div>

        <p className="text-sm text-muted-foreground/60 italic max-w-md">
          Aucune des deux n'est meilleure. Suivez votre intuition.
        </p>
      </div>
    </div>
  );
};

export default ABChoiceScreen;
