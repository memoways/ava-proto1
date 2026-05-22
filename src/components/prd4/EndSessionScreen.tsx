/** PRD4 — Écran 9 : Fin de session, avant questionnaire */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onContinue: () => void;
  autoContinueAfterMs?: number;
}

const EndSessionScreen = ({ onContinue, autoContinueAfterMs }: Props) => {
  useEffect(() => {
    if (!autoContinueAfterMs) return;
    const t = setTimeout(onContinue, autoContinueAfterMs);
    return () => clearTimeout(t);
  }, [autoContinueAfterMs, onContinue]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-lg space-y-6">
        <p className="font-serif text-xl text-foreground/90">
          La communication se coupe.
        </p>
        <p className="font-serif text-lg italic text-muted-foreground">
          Max reste silencieux un instant.
        </p>
        <p className="text-sm text-muted-foreground/80">
          L'expérience s'arrête ici pour cette version du prototype.
        </p>
        <Button
          onClick={onContinue}
          className="mt-6 min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
};

export default EndSessionScreen;
