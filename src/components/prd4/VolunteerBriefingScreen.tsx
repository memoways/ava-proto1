/** Onboarding du bénévole — séquence de cartes entre l'introduction et le choix du personnage. */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  VOLUNTEER_BRIEFING_CARDS,
  getVolunteerBriefingProgress,
  saveVolunteerBriefingProgress,
} from "@/services/volunteerBriefing";

interface Props {
  /** "review" = relecture depuis le choix du personnage : ne modifie pas la complétion. */
  mode?: "onboarding" | "review";
  onComplete: () => void;
  onClose?: () => void;
  onCardViewed?: (index: number, cardId: string) => void;
}

const VolunteerBriefingScreen = ({ mode = "onboarding", onComplete, onClose, onCardViewed }: Props) => {
  const [index, setIndex] = useState(() =>
    mode === "onboarding" ? getVolunteerBriefingProgress().lastCardIndex : 0,
  );
  const card = VOLUNTEER_BRIEFING_CARDS[index];
  const isLast = index === VOLUNTEER_BRIEFING_CARDS.length - 1;

  useEffect(() => {
    onCardViewed?.(index, VOLUNTEER_BRIEFING_CARDS[index].id);
    if (mode === "onboarding") saveVolunteerBriefingProgress({ lastCardIndex: index });
  }, [index, mode, onCardViewed]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 tablet:px-10">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(var(--fade-overlay))]" />
      <div className="relative z-10 mx-auto w-full max-w-xl space-y-8 text-center">
        <div key={card.id} className="animate-fade-in space-y-6">
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
            {card.title}
          </h2>
          {card.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-base leading-relaxed text-muted-foreground md:text-lg">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {VOLUNTEER_BRIEFING_CARDS.map((c, i) => (
            <span
              key={c.id}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Étape {index + 1} sur {VOLUNTEER_BRIEFING_CARDS.length}
        </p>

        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          {index > 0 ? (
            <Button variant="ghost" onClick={() => setIndex((i) => i - 1)} className="min-w-[160px]">
              Retour
            </Button>
          ) : mode === "review" && onClose ? (
            <Button variant="ghost" onClick={onClose} className="min-w-[160px]">
              Fermer
            </Button>
          ) : null}
          <Button
            onClick={() => {
              if (isLast) {
                if (mode === "onboarding") {
                  saveVolunteerBriefingProgress({ completed: true, lastCardIndex: 0 });
                }
                onComplete();
                return;
              }
              setIndex((i) => i + 1);
            }}
            className="min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLast ? (mode === "review" ? "Fermer" : "J'ai compris") : "Continuer"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerBriefingScreen;
