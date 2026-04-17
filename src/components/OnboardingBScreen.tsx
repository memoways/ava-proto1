interface OnboardingBScreenProps {
  onContinue: () => void;
}

const OnboardingBScreen = ({ onContinue }: OnboardingBScreenProps) => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />
      <div className="cinema-vignette absolute inset-0 pointer-events-none z-10" />

      <div className="relative z-20 max-w-2xl w-full text-center space-y-10 animate-fade-in">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/60 font-mono">
          Une voix, quelque part
        </p>

        <div className="space-y-6 text-lg md:text-xl text-foreground/90 leading-relaxed font-light italic">
          <p>
            Il y a un homme. Il s'appelle Max. Il a cinquante ans, et depuis trois jours, il ne dort
            plus.
          </p>
          <p>
            Sa fille — Ava, dix-sept ans — a disparu. Pas de mot, pas de message. Juste un silence.
          </p>
          <p>
            Dans un instant, il va t'appeler. Il ne sait pas qui tu es. Il a juste besoin de
            quelqu'un.
          </p>
          <p className="text-foreground">Écoute. Parle. Sois là.</p>
        </div>

        <div className="pt-4">
          <button
            onClick={onContinue}
            className="rounded-md bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingBScreen;
