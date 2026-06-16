/** PRD GIFF — Rappel court (texte, pas de vidéo). */
import { Button } from "@/components/ui/button";
import VariantFrame from "@/components/prd4/StartVariantFrame";
import type { GiffStartSettings } from "@/services/giffStartSettings";

interface Props {
  settings: GiffStartSettings;
  onContinue: () => void;
}

const TeaserRappelScreen = ({ settings, onContinue }: Props) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
    <div className="mx-auto max-w-2xl">
      <VariantFrame
        variant={settings.active_start_variant}
        voiceoverText={settings.voiceover_intro_text}
        gmHostText={settings.gm_host_intro_text}
      >
        <div className="space-y-6 text-center">
          <p className="text-base leading-relaxed text-foreground/90 md:text-lg">
            {settings.teaser_text_short}
          </p>
          <Button
            size="lg"
            onClick={onContinue}
            className="min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Continuer
          </Button>
        </div>
      </VariantFrame>
    </div>
  </div>
);

export default TeaserRappelScreen;
