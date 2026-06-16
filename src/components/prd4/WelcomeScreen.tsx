/** PRD4/GIFF — Écran 1 : Accueil */
import { Button } from "@/components/ui/button";
import VariantFrame from "@/components/prd4/StartVariantFrame";
import type { GiffStartSettings } from "@/services/giffStartSettings";

interface Props {
  onStart: () => void;
  settings?: GiffStartSettings | null;
}

const WelcomeScreen = ({ onStart, settings }: Props) => {
  const giff = settings && settings.use_giff_flow;
  const welcome = giff ? settings!.welcome_text : "Où est Ava\u00a0?";
  const promise = giff
    ? settings!.promise_text
    : "Après le film, les personnages peuvent encore te parler.";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(var(--fade-overlay))]" />
      <div className="relative z-10 w-full max-w-2xl">
        {giff ? (
          <VariantFrame
            variant={settings!.active_start_variant}
            voiceoverText={settings!.voiceover_intro_text}
            gmHostText={settings!.gm_host_intro_text}
          >
            <div className="space-y-8">
              <h1 className="font-serif text-5xl font-light tracking-tight text-foreground md:text-7xl">
                {welcome}
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl">{promise}</p>
              <Button
                size="lg"
                onClick={onStart}
                className="mt-4 min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Commencer
              </Button>
            </div>
          </VariantFrame>
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default WelcomeScreen;
