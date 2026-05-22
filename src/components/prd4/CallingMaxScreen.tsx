/** PRD4 — Écran 7 : Appel Max (sonnerie + animation visio) */
import { useEffect } from "react";
import { Phone } from "lucide-react";
import maxImg from "@/assets/characters/max.svg";

interface Props {
  onAnswered: () => void;
}

const CallingMaxScreen = ({ onAnswered }: Props) => {
  useEffect(() => {
    const t = setTimeout(onAnswered, 3500);
    return () => clearTimeout(t);
  }, [onAnswered]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="space-y-8">
        <div className="relative mx-auto h-40 w-40">
          <img
            src={maxImg}
            alt="Max"
            className="h-full w-full rounded-full border-2 border-primary/50 object-cover"
          />
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40" />
        </div>
        <div className="space-y-2">
          <p className="font-serif text-2xl font-light text-foreground">
            Appel en cours…
          </p>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            Max
          </p>
        </div>
        <p className="mx-auto max-w-md text-xs text-muted-foreground/80">
          Max va décrocher. Quand ce sera à toi de parler, maintiens le bouton
          appuyé.
        </p>
      </div>
    </div>
  );
};

export default CallingMaxScreen;
