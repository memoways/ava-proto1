/** Wrappers visuels par variante de démarrage GIFF. */
import type { ReactNode } from "react";
import type { AvaStartVariant } from "@/services/giffStartSettings";

interface VariantFrameProps {
  variant: AvaStartVariant;
  voiceoverText?: string;
  gmHostText?: string;
  children: ReactNode;
}

/** Bandeau "Game Master" discret pour la variante gm_host. */
export const GMHostChip = ({ text }: { text?: string }) => (
  <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs uppercase tracking-wider text-primary">
    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
    Game Master
    {text ? <span className="ml-2 normal-case tracking-normal text-foreground/80">— {text}</span> : null}
  </div>
);

/** Phrase voix-off (texte italique sobre, sans TTS). */
export const VoiceoverLine = ({ text }: { text?: string }) =>
  text ? (
    <p className="mb-6 text-center text-sm italic text-muted-foreground/80">
      « {text} »
    </p>
  ) : null;

const VariantFrame = ({ variant, voiceoverText, gmHostText, children }: VariantFrameProps) => (
  <div className="flex flex-col items-center">
    {variant === "gm_host" ? <GMHostChip text={gmHostText} /> : null}
    {variant === "voiceover_hybrid" ? <VoiceoverLine text={voiceoverText} /> : null}
    {children}
  </div>
);

export default VariantFrame;
