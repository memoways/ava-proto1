/** PRD4 — Écran 1 : Accueil */
import { useEffect, useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { prefetchOpeningTTS } from "@/services/openingTTSCache";
import { isPrivacyNoticeEnabled, type PrivacyPreferences } from "@/services/privacyConsent";

interface Props {
  onStart: (captchaToken?: string) => Promise<boolean>;
  onStartIntent?: () => void;
  videoReady?: boolean;
  privacyPreferences: PrivacyPreferences | null;
  onPrivacyChange: (choice: Pick<PrivacyPreferences, "voiceAndStorageAcknowledged" | "analyticsAllowed">) => void;
  resumeAvailable?: boolean;
  resumeLoading?: boolean;
  onResume?: () => Promise<void>;
}

const HCAPTCHA_SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined;
const HCAPTCHA_ENABLED = import.meta.env.VITE_GAME_SECURITY_ENABLED === "true" && Boolean(HCAPTCHA_SITE_KEY);

const WelcomeScreen = ({
  onStart,
  onStartIntent,
  videoReady = true,
  privacyPreferences,
  onPrivacyChange,
  resumeAvailable = false,
  resumeLoading = false,
  onResume,
}: Props) => {
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [starting, setStarting] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);
  const privacyNoticeEnabled = isPrivacyNoticeEnabled();
  const voiceAcknowledged = !privacyNoticeEnabled || privacyPreferences?.voiceAndStorageAcknowledged === true;
  const analyticsAllowed = privacyPreferences?.analyticsAllowed === true;

  // Ne prépare aucune sortie vocale tant qu'une reprise est recherchée ou
  // disponible. Une reprise restaure uniquement l'état textuel avant un geste
  // explicite ultérieur de l'utilisateur.
  useEffect(() => {
    if (resumeLoading || resumeAvailable) return;
    void prefetchOpeningTTS().catch(() => { /* silent */ });
  }, [resumeAvailable, resumeLoading]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-center tablet:px-10">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(var(--fade-overlay))]" />
      <div className="relative z-10 w-full max-w-2xl tablet:max-w-3xl">

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
          {privacyNoticeEnabled ? (
            <div className="mx-auto max-w-xl space-y-3 rounded-lg border border-border/80 bg-card/70 p-4 text-left text-sm">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="voice-consent"
                  checked={voiceAcknowledged}
                  onCheckedChange={(checked) => onPrivacyChange({
                    voiceAndStorageAcknowledged: checked === true,
                    analyticsAllowed,
                  })}
                />
                <Label htmlFor="voice-consent" className="cursor-pointer font-normal leading-relaxed">
                  J’ai compris que ma voix sera transcrite pour faire fonctionner l’expérience et que la conversation
                  sera conservée de manière pseudonyme pour les tests.
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="analytics-consent"
                  checked={analyticsAllowed}
                  onCheckedChange={(checked) => onPrivacyChange({
                    voiceAndStorageAcknowledged: voiceAcknowledged,
                    analyticsAllowed: checked === true,
                  })}
                />
                <Label htmlFor="analytics-consent" className="cursor-pointer font-normal leading-relaxed">
                  J’accepte les mesures techniques optionnelles pour améliorer la fluidité. Aucun replay, clic ou texte
                  libre n’est enregistré par les outils analytics.
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Le second choix est facultatif et modifiable. <Link to="/confidentialite" className="underline underline-offset-2">En savoir plus</Link>
              </p>
            </div>
          ) : null}
          {HCAPTCHA_ENABLED && HCAPTCHA_SITE_KEY ? (
            <div className="flex justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                theme="dark"
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken(undefined)}
                onError={() => setCaptchaToken(undefined)}
              />
            </div>
          ) : null}
          <Button
            size="lg"
            onPointerDown={onStartIntent}
            onTouchStart={onStartIntent}
            onClick={async () => {
              setStarting(true);
              const started = await onStart(captchaToken);
              setStarting(false);
              if (!started) {
                captchaRef.current?.resetCaptcha();
                setCaptchaToken(undefined);
              }
            }}
            disabled={starting || resumeLoading || !videoReady || !voiceAcknowledged || Boolean(HCAPTCHA_ENABLED && !captchaToken)}
            className="mt-6 min-w-[200px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {resumeLoading
              ? "Recherche d’un appel…"
              : !videoReady
              ? "Préparation…"
              : starting
                ? "Démarrage…"
                : HCAPTCHA_ENABLED && !captchaToken
                  ? "Vérification…"
                : "Commencer"}
          </Button>
          {resumeAvailable && onResume ? (
            <Button
              size="lg"
              variant="outline"
              onClick={async () => {
                setStarting(true);
                await onResume().finally(() => setStarting(false));
              }}
              disabled={starting || resumeLoading || !voiceAcknowledged}
              className="min-w-[200px]"
            >
              {resumeLoading ? "Recherche…" : "Reprendre l’appel"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
