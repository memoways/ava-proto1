/** PRD4 — Écran 7 : Appel Max (sonnerie + animation visio) */
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import maxImg from "@/assets/characters/max.jpg";

interface Props {
  onAnswered: () => void;
}

const RING_MS = 1100;
const RINGS = 3; // ~3.3s total
const PICKUP_DELAY_MS = 400;

const CallingMaxScreen = ({ onAnswered }: Props) => {
  const [ring, setRing] = useState(1);
  const [pickingUp, setPickingUp] = useState(false);

  useEffect(() => {
    const intervals: number[] = [];
    for (let i = 2; i <= RINGS; i++) {
      intervals.push(window.setTimeout(() => setRing(i), (i - 1) * RING_MS));
    }
    const pickup = window.setTimeout(() => setPickingUp(true), RINGS * RING_MS);
    const done = window.setTimeout(onAnswered, RINGS * RING_MS + PICKUP_DELAY_MS);
    return () => {
      intervals.forEach(clearTimeout);
      clearTimeout(pickup);
      clearTimeout(done);
    };
  }, [onAnswered]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="space-y-8">
        <div className="relative mx-auto h-44 w-44">
          {/* multiple staggered rings to suggest sonnerie */}
          <span
            className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40"
            style={{ animationDuration: "1.6s" }}
          />
          <span
            className="absolute -inset-3 animate-ping rounded-full border border-primary/25"
            style={{ animationDuration: "1.6s", animationDelay: "0.4s" }}
          />
          <span
            className="absolute -inset-6 animate-ping rounded-full border border-primary/15"
            style={{ animationDuration: "1.6s", animationDelay: "0.8s" }}
          />
          <img
            src={maxImg}
            alt="Max"
            className={`relative h-full w-full rounded-full border-2 border-primary/60 object-cover transition-transform duration-300 ${
              pickingUp ? "scale-105" : "scale-100"
            }`}
          />
        </div>

        <div className="space-y-2">
          <p className="font-serif text-2xl font-light text-foreground">
            {pickingUp ? "Max décroche…" : "Appel en cours…"}
          </p>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            Max
            <span className="ml-2 tabular-nums text-xs text-muted-foreground/70">
              {ring}/{RINGS}
            </span>
          </p>
        </div>

        <p className="mx-auto max-w-md text-xs text-muted-foreground/80">
          Quand ce sera à toi de parler, maintiens le bouton micro appuyé
          (ou la barre&nbsp;Espace).
        </p>
      </div>
    </div>
  );
};

export default CallingMaxScreen;
