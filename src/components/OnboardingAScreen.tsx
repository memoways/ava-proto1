import { useState, useEffect } from "react";

interface OnboardingAScreenProps {
  onContinue: () => void;
}

const cards = [
  { label: "QUI", value: "Max", hint: "Un père, 50 ans." },
  { label: "QUOI", value: "Sa fille a disparu", hint: "Ava, 17 ans." },
  { label: "QUAND", value: "Maintenant", hint: "Un appel en visio, en direct." },
  { label: "RÔLE", value: "Vous écoutez", hint: "Et parfois, vous parlez." },
];

const OnboardingAScreen = ({ onContinue }: OnboardingAScreenProps) => {
  const [step, setStep] = useState(0); // 0 = règle d'or, 1+ = cartes

  useEffect(() => {
    if (step === 0) {
      const t = setTimeout(() => setStep(1), 2400);
      return () => clearTimeout(t);
    }
    if (step >= 1 && step <= cards.length) {
      const t = setTimeout(() => setStep(step + 1), 1100);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 overflow-hidden">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />
      <div className="cinema-vignette absolute inset-0 pointer-events-none z-10" />

      <div className="relative z-20 max-w-2xl w-full text-center space-y-10">
        {step === 0 && (
          <div className="animate-fade-in space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/60 font-mono">
              Règle d'or
            </p>
            <p className="text-2xl md:text-3xl font-light text-foreground leading-relaxed italic">
              "Soyez vous-même. C'est la seule chose qui compte."
            </p>
          </div>
        )}

        {step >= 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {cards.map((c, i) => (
              <div
                key={c.label}
                className={`p-6 rounded-xl border border-border/30 bg-black/20 backdrop-blur-sm text-left transition-all duration-700 ${
                  step > i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <p className="text-xs uppercase tracking-widest text-muted-foreground/60 font-mono mb-2">
                  {c.label}
                </p>
                <p className="text-xl font-semibold text-foreground mb-1">{c.value}</p>
                <p className="text-sm text-muted-foreground/70">{c.hint}</p>
              </div>
            ))}
          </div>
        )}

        {step > cards.length && (
          <div className="animate-fade-in pt-4">
            <button
              onClick={onContinue}
              className="rounded-md bg-primary px-8 py-3 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
            >
              Continuer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingAScreen;
