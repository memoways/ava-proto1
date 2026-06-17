/** PRD4 — Écran 1 : Accueil */
import { Button } from "@/components/ui/button";

interface Props {
  onStart: () => void;
}

const WelcomeScreen = ({ onStart }: Props) => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(var(--fade-overlay))]" />
      <div className="relative z-10 w-full max-w-2xl">
        <div className="space-y-8">
          <h1 className="font-serif text-5xl font-light tracking-tight text-foreground md:text-7xl">
            Où est Ava&nbsp;?
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl">
            Après le film, les personnages peuvent encore te parler.
          </p>
          <p className="mx-auto max-w-lg text-sm text-muted-foreground/80 md:text-base">
            Cette expérience te propose d'entrer dans le monde du film et d'appeler
            ses protagonistes.
          </p>
          <Button
            size="lg"
            onClick={onStart}
            className="mt-6 min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Commencer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
