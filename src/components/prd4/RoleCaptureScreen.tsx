/** PRD4 — Écran 4 : Création libre du personnage utilisateur (PTT + Deepgram, Phase 2) */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Loader2 } from "lucide-react";
import { DeepgramSTT } from "@/services/deepgramSTT";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (rawInput: string) => void;
  /** Phase 2 : indique au parent qu'une erreur PTT s'est produite (compteur télémétrie). */
  onPTTError?: (err: Error) => void;
  /** True pendant que le parent appelle summarize-role (désactive le bouton). */
  submitting?: boolean;
}

const EXAMPLES = [
  "Tu pourrais être une amie d'Ava qui cherche à comprendre ce qui s'est passé.",
  "Tu pourrais être un psychologue mandaté par les autorités.",
  "Tu pourrais être un voisin qui connaît la famille de loin.",
];

const MIN_CHARS = 20;

const RoleCaptureScreen = ({ onSubmit, onPTTError, submitting = false }: Props) => {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sttRef = useRef<DeepgramSTT | null>(null);

  // Reçoit les transcripts (interim + final) depuis Deepgram.
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
      setInterim("");
    } else {
      setInterim(text);
    }
  }, []);

  const handleSTTError = useCallback(
    (err: Error) => {
      console.error("[RoleCapture] STT error:", err);
      setError(err.message || "Erreur micro");
      setRecording(false);
      setStarting(false);
      onPTTError?.(err);
    },
    [onPTTError],
  );

  // Démarre une session STT au premier press, la garde en vie jusqu'au démontage.
  const ensureSTT = useCallback(async () => {
    if (sttRef.current?.isActive) return sttRef.current;
    setStarting(true);
    setError(null);
    try {
      const stt = new DeepgramSTT(handleTranscript, { onError: handleSTTError });
      sttRef.current = stt;
      await stt.start();
      // Démarre en pause — l'utilisateur active via PTT.
      stt.pause();
      return stt;
    } finally {
      setStarting(false);
    }
  }, [handleTranscript, handleSTTError]);

  const handlePress = useCallback(async () => {
    setError(null);
    try {
      const stt = await ensureSTT();
      stt?.resume();
      setRecording(true);
    } catch (err) {
      handleSTTError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [ensureSTT, handleSTTError]);

  const handleRelease = useCallback(() => {
    const stt = sttRef.current;
    if (!stt) return;
    stt.flush();
    stt.pause();
    setRecording(false);
  }, []);

  const { buttonHandlers } = usePushToTalk({
    enabled: !submitting,
    onPress: handlePress,
    onRelease: handleRelease,
  });

  // Cleanup
  useEffect(() => {
    return () => {
      sttRef.current?.stop();
      sttRef.current = null;
    };
  }, []);

  const displayText = (transcript + (interim ? ` ${interim}` : "")).trim();
  const canSubmit = transcript.trim().length >= MIN_CHARS && !recording && !submitting;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-7">
        <header className="space-y-3 text-center">
          <h2 className="font-serif text-3xl font-light text-foreground md:text-4xl">
            À toi de jouer.
          </h2>
          <p className="text-muted-foreground">
            Présente le personnage que tu souhaites incarner.
          </p>
        </header>

        <div className="space-y-3 rounded-md border border-border bg-card/50 p-5 text-sm text-foreground/85">
          <p>
            Tu vas pouvoir t'entretenir par visioconférence avec l'un ou l'autre
            des membres de la famille. Mais pour entrer dans leur monde, tu dois
            d'abord exister dans le leur.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Qui es-tu&nbsp;?</li>
            <li>Quelle est ta relation avec Max, Emma, Léo et Ava&nbsp;?</li>
            <li>Quel est ton genre&nbsp;?</li>
            <li>Quel est ton âge&nbsp;?</li>
            <li>Pourquoi appelles-tu maintenant&nbsp;?</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Quelques exemples</p>
          <ul className="space-y-1 text-sm italic text-muted-foreground/90">
            {EXAMPLES.map((e, i) => (
              <li key={i}>— {e}</li>
            ))}
          </ul>
        </div>

        {/* PTT + transcript live */}
        <div className="space-y-4 rounded-md border border-border bg-muted/20 p-5">
          <div className="flex items-center justify-center">
            <button
              type="button"
              {...buttonHandlers}
              disabled={submitting}
              className={cn(
                "relative flex h-24 w-24 items-center justify-center rounded-full border-2 transition-all select-none",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                recording
                  ? "border-primary bg-primary/20 scale-110 shadow-[0_0_40px_-5px_hsl(var(--primary)/0.6)]"
                  : "border-border bg-card hover:border-primary/60",
                submitting && "opacity-50 cursor-not-allowed",
              )}
              aria-label="Maintiens pour parler"
            >
              {starting ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Mic className={cn("h-8 w-8", recording ? "text-primary" : "text-foreground/70")} />
              )}
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {recording
              ? "🔴 Parle… relâche pour valider ce segment."
              : "Maintiens le micro (ou la barre d'espace) pour parler. Tu peux faire plusieurs prises."}
          </p>

          <div
            className={cn(
              "min-h-[6rem] rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-pre-wrap",
              displayText ? "text-foreground" : "text-muted-foreground/60 italic",
            )}
            aria-live="polite"
          >
            {displayText || "Ton texte apparaîtra ici au fur et à mesure…"}
            {interim && <span className="text-muted-foreground">{" "}</span>}
          </div>

          {transcript && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setTranscript("");
                  setInterim("");
                }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Effacer et recommencer
              </button>
            </div>
          )}

          {error && (
            <p className="text-center text-xs text-destructive">⚠️ {error}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            disabled={!canSubmit}
            onClick={() => onSubmit(transcript.trim())}
            className="min-w-[220px] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyse en cours…
              </>
            ) : (
              "Valider mon personnage"
            )}
          </Button>
          {!canSubmit && !submitting && transcript.trim().length < MIN_CHARS && (
            <p className="text-xs text-muted-foreground">
              Parle un peu plus pour que Max puisse te situer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleCaptureScreen;
