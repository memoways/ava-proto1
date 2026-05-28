/** PRD4 — Écran 2 : As-tu vu le film ? */
import { Button } from "@/components/ui/button";
import type { FilmAnswer } from "@/types";

interface Props {
  onAnswer: (answer: FilmAnswer) => void;
}

const FilmQuestionScreen = ({ onAnswer }: Props) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
    <div className="max-w-2xl space-y-8">
      <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
        As-tu vu le film <em>Où est Ava&nbsp;?</em>
      </h2>
      <p className="text-muted-foreground">
        Si tu ne l'as pas vu — ou s'il date un peu — on peut t'en faire un rappel.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAnswer("vu")}
          className="min-w-[200px]"
        >
          Oui
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAnswer("pas_vu")}
          className="min-w-[200px]"
        >
          Non
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => onAnswer("rappel")}
          className="w-full whitespace-normal text-center leading-tight px-6 sm:w-auto sm:min-w-[320px]"
        >
          Il y a longtemps / j'ai besoin d'un rappel
        </Button>
      </div>
    </div>
  </div>
);

export default FilmQuestionScreen;
