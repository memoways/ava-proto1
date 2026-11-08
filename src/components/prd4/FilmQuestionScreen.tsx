/** PRD4 — Écran 2 : As-tu vu le film ? */
import { Button } from "@/components/ui/button";
import type { FilmAnswer } from "@/types";
import grangeAsset from "@/assets/ou-est-ava-grange.jpg.asset.json";

interface Props {
  onAnswer: (answer: FilmAnswer) => void;
}

const FilmQuestionScreen = ({ onAnswer }: Props) => {
  return (
    <section className="relative min-h-screen bg-background max-sm:flex max-sm:min-h-[100svh] max-sm:flex-col" aria-label="As-tu vu le film Où est Ava ?">
      {/* Phones (portrait): the whole image across the full width, buttons below within thumb reach.
          From 640 px: unchanged full-screen image with the buttons over it. */}
      <div className="absolute inset-0 max-sm:relative max-sm:inset-auto max-sm:flex max-sm:flex-1 max-sm:items-center">
        <img
          src={grangeAsset.url}
          alt="Les quatre personnages d’Où est Ava ? dans la grange"
          data-testid="film-question-image"
          className="h-full w-full object-cover object-center max-sm:h-auto max-sm:object-contain"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/95 to-transparent max-sm:hidden" />
      <div className="relative flex min-h-screen items-end justify-center px-6 pb-12 pt-10 sm:pb-20 max-sm:min-h-0 max-sm:px-4 max-sm:pt-6 max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-xl flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => onAnswer("vu")} className="h-auto min-h-12 flex-1 whitespace-normal px-6 py-3">
            J'ai vu le film
          </Button>
          <Button variant="outline" size="lg" onClick={() => onAnswer("pas_vu")} className="h-auto min-h-12 flex-1 whitespace-normal border-foreground/40 bg-background/80 px-6 py-3">
            Je n'ai pas vu le film
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FilmQuestionScreen;
