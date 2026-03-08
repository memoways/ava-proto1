interface GateScreenProps {
  onContinue: () => void;
}

const GateScreen = ({ onContinue }: GateScreenProps) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background animate-fade-in">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />

      <div className="relative z-10 max-w-md text-center space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-trust">
            Confiance acquise
          </p>
          <h2 className="text-2xl font-bold text-foreground">
            Max te fait confiance
          </h2>
          <p className="text-secondary-foreground leading-relaxed">
            "Je crois que tu es prêt·e. Il y a quelqu'un que tu devrais rencontrer…
            Léo ou Emma pourrait t'en dire plus sur Ava."
          </p>
        </div>

        <button
          onClick={onContinue}
          className="rounded-md bg-primary px-8 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
        >
          Continuer
        </button>
      </div>
    </div>
  );
};

export default GateScreen;
