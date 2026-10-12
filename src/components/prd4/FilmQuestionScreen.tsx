/** PRD4 — Écran 2 : As-tu vu le film ? */
import { Button } from "@/components/ui/button";
import type { FilmAnswer } from "@/types";
import grangeAsset from "@/assets/ou-est-ava-grange.jpg.asset.json";

interface Props {
  onAnswer: (answer: FilmAnswer) => void;
}

const FilmQuestionScreen = ({ onAnswer }: Props) => {
  return (
    <section className="relative min-h-screen bg-background" aria-label="As-tu vu le film Où est Ava ?">
      <img
        src={grangeAsset.url}
        alt="Les quatre personnages d’Où est Ava ? dans la grange"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/95 to-transparent" />
      <div className="relative flex min-h-screen items-end justify-center px-6 pb-12 pt-10 sm:pb-20">
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
