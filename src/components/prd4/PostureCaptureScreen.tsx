/** PRD GIFF — Capture rapide de la posture utilisateur (PTT 1 phrase + Surprise me). */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff } from "lucide-react";
import { createConfiguredSTT, loadSTTSettingsFromDB, type STTSession } from "@/services/stt";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { cn } from "@/lib/utils";
import VariantFrame from "@/components/prd4/StartVariantFrame";
import type { GiffStartSettings } from "@/services/giffStartSettings";

interface Props {
  settings: GiffStartSettings;
  onSubmit: (raw: string) => void;
  onSurprise: () => void;
  onPTTError?: (err: Error) => void;
}

const MIN_CHARS = 4;

const PostureCaptureScreen = ({ settings, onSubmit, onPTTError }: Props) => {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sttRef = useRef<STTSession | null>(null);

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
      console.error("[Posture] STT error:", err);
      setError(err.message || "Erreur micro");
      setRecording(false);
      setStarting(false);
      onPTTError?.(err);
    },
    [onPTTError],
  );

  useEffect(() => {
    void loadSTTSettingsFromDB();
  }, []);

  const ensureSTT = useCallback(async () => {
    if (sttRef.current?.isActive) return sttRef.current;
    setStarting(true);
    setError(null);
    try {
      const stt = await createConfiguredSTT(handleTranscript, { onError: handleSTTError });
      sttRef.current = stt;
      await stt.start();
      stt.setManualMode(true);
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
    // Filet de sécu: si aucun "final" n'arrive après pause, on promeut l'interim courant
    setInterim((curInterim) => {
      if (curInterim.trim().length > 0) {
        setTranscript((prev) => (prev ? `${prev} ${curInterim}` : curInterim).trim());
      }
      return "";
    });
  }, []);

  const { buttonHandlers } = usePushToTalk({
    enabled: true,
    onPress: handlePress,
    onRelease: handleRelease,
    mode: "toggle",
  });

  useEffect(() => {
    return () => {
      sttRef.current?.stop();
      sttRef.current = null;
    };
  }, []);

  const displayText = (transcript + (interim ? ` ${interim}` : "")).trim();
  const canSubmit = transcript.trim().length >= MIN_CHARS && !recording;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-xl">
        <VariantFrame
          variant={settings.active_start_variant}
          voiceoverText={settings.voiceover_intro_text}
          gmHostText={settings.gm_host_handoff_text}
        >
          <div className="w-full space-y-6 text-center">
            <h2 className="font-serif text-2xl font-light text-foreground md:text-3xl">
              Tu peux poser une question, exprimer une émotion ou partager une intention pour démarrer l'expérience.
            </h2>

            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-5">
              <button
                type="button"
                {...buttonHandlers}
                className={cn(
                  "relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all select-none",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                  recording
                    ? "border-destructive bg-destructive/20 scale-110 shadow-[0_0_40px_-5px_hsl(var(--destructive)/0.6)]"
                    : "border-primary/60 bg-card hover:border-primary",
                )}
                aria-label={recording ? "Cliquer pour arrêter" : "Cliquer pour parler"}
              >
                {starting ? (
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                ) : recording ? (
                  <MicOff className="h-7 w-7 text-destructive" />
                ) : (
                  <Mic className="h-7 w-7 text-foreground/80" />
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                {recording
                  ? "🔴 Enregistrement… clique à nouveau (ou Espace) pour valider."
                  : "Clique sur le micro (ou Espace) pour parler. Une phrase suffit."}
              </p>

              <div
                className={cn(
                  "min-h-[4rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-left whitespace-pre-wrap",
                  displayText ? "text-foreground" : "text-muted-foreground/60 italic",
                )}
                aria-live="polite"
              >
                {displayText || "Ta question ou ton intention apparaîtra ici…"}
              </div>

              {error && <p className="text-center text-xs text-destructive">⚠️ {error}</p>}
            </div>

            <div className="flex flex-col items-center gap-3">
              <Button
                size="lg"
                disabled={!canSubmit}
                onClick={() => onSubmit(transcript.trim())}
                className="min-w-[220px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continuer
              </Button>
            </div>
          </div>
        </VariantFrame>
      </div>
    </div>
  );
};

export default PostureCaptureScreen;
