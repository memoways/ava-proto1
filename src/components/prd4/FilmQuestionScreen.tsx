/** PRD4 — Écran 2 : As-tu vu le film ? */
import { Button } from "@/components/ui/button";
import type { FilmAnswer } from "@/types";

interface Props {
  onAnswer: (answer: FilmAnswer) => void;
}

const FilmQuestionScreen = ({ onAnswer }: Props) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="max-w-2xl space-y-8 text-center">
        <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
          As-tu vu le film <em>Où est Ava&nbsp;?</em>
        </h2>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" size="lg" onClick={() => onAnswer("vu")} className="min-w-[200px]">
            Oui
          </Button>
          <Button variant="outline" size="lg" onClick={() => onAnswer("pas_vu")} className="min-w-[200px]">
            Non
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onAnswer("rappel")}
            className="w-full whitespace-normal text-center leading-tight px-6 sm:w-auto sm:min-w-[280px]"
          >
            Je ne m'en souviens pas bien
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FilmQuestionScreen;
