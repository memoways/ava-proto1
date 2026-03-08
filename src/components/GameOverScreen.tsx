interface GameOverScreenProps {
  reason: string | null;
  onRestart: () => void;
  onQuestionnaire: () => void;
}

const reasonLabels: Record<string, string> = {
  timeout: "Le temps est écoulé.",
  moderation: "La conversation a été interrompue.",
  completion: "L'expérience est terminée.",
};

const GameOverScreen = ({ reason, onRestart, onQuestionnaire }: GameOverScreenProps) => {
  const label = reason ? reasonLabels[reason] || reason : "Fin de la session.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background animate-fade-in">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />

      <div className="relative z-10 max-w-md text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-primary">
            Fin de session
          </p>
          <p className="text-xl text-foreground">{label}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onQuestionnaire}
            className="w-full rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90"
          >
            Donner mon avis
          </button>
          <button
            onClick={onRestart}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Recommencer
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
