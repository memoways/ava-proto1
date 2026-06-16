/** Wrappers visuels par variante de démarrage GIFF. */
import type { ReactNode } from "react";
import type { AvaStartVariant } from "@/services/giffStartSettings";

interface VariantFrameProps {
  variant: AvaStartVariant;
  voiceoverText?: string;
  gmHostText?: string;
  children: ReactNode;
}

/** Conservé pour compat: ne rend plus le chip "Game Master". */
export const GMHostChip = (_: { text?: string }) => null;

/** Phrase voix-off (texte italique sobre, sans TTS). */
export const VoiceoverLine = ({ text }: { text?: string }) =>
  text ? (
    <p className="mb-6 text-center text-sm italic text-muted-foreground/80">
      « {text} »
    </p>
  ) : null;

const VariantFrame = ({ variant, voiceoverText, children }: VariantFrameProps) => (
  <div className="flex flex-col items-center">
    {variant === "voiceover_hybrid" ? <VoiceoverLine text={voiceoverText} /> : null}
    {children}
  </div>
);

export default VariantFrame;
