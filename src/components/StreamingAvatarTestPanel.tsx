import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, PlayCircle, Square, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createResponseOutput, type ResponseOutput, type StreamingAvatarSettings } from "@/services/streamingAvatar";
import { createPRD4Session } from "@/services/prd4Session";
import { supabase } from "@/integrations/supabase/client";

const TEST_PHRASE =
  "Bonjour, c'est Max. Ceci est un test privé de l'avatar vidéo, personne d'autre ne l'entend.";

interface TestLogEntry {
  at: number;
  label: string;
  tone?: "info" | "ok" | "error";
}

interface TestSummary {
  provider: string;
  finalMode: "video" | "tts";
  sessionId: string | null;
  externalSessionId: string | null;
  connectionMs: number | null;
  firstPlaybackMs: number | null;
  playbackTotalMs: number | null;
  totalMs: number;
  error: string | null;
}

export default function StreamingAvatarTestPanel({
  settings,
}: {
  settings: StreamingAvatarSettings;
}) {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<TestLogEntry[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputRef = useRef<ResponseOutput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const push = useCallback((label: string, tone: TestLogEntry["tone"] = "info") => {
    setLogs((current) => [...current, { at: Date.now(), label, tone }]);
  }, []);

  const cleanup = useCallback(async (sessionId: string | null) => {
    const output = outputRef.current;
    outputRef.current = null;
    if (output) await output.dispose().catch(() => {});
    if (sessionId) {
      await supabase
        .from("sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      void outputRef.current?.dispose().catch(() => {});
      outputRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    outputRef.current?.interrupt();
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    setSummary(null);
    const abort = new AbortController();
    abortRef.current = abort;
    const startedAt = performance.now();
    let sessionId: string | null = null;
    let connectionMs: number | null = null;
    let firstPlaybackMs: number | null = null;
    let playbackTotalMs: number | null = null;
    let finalMode: TestSummary["finalMode"] = "tts";
    let errorMessage: string | null = null;
    let externalSessionId: string | null = null;

    try {
      push("Création d'une session privée de test…");
      sessionId = await createPRD4Session(null, "max", {
        modalite_voix: "push_to_talk",
        output_mode: "streaming_avatar",
      } as never);
      push(`Session privée ${sessionId.slice(0, 8)}… créée`, "ok");

      const output = await createResponseOutput({
        mode: "streaming_avatar",
        avatarSettings: settings,
        callbacks: {
          onConnectionStateChange: (state) => push(`État connexion : ${state}`),
          onStreamReady: () => push("Flux vidéo prêt", "ok"),
          onDisconnected: (reason) => push(`Déconnexion : ${reason ?? "inconnue"}`, "error"),
          onSpeakStart: () => push("L'avatar commence à parler", "ok"),
          onSpeakEnd: () => push("L'avatar a fini de parler", "ok"),
        },
      });
      outputRef.current = output;

      push(`Connexion au fournisseur ${settings.activeProvider}…`);
      const connectStartedAt = performance.now();
      await output.prepare({ sessionId, signal: abort.signal });
      connectionMs = Math.round(performance.now() - connectStartedAt);
      externalSessionId = output.externalSessionId;
      push(`Connexion établie en ${connectionMs} ms`, "ok");

      if (videoRef.current) {
        output.attachMedia(videoRef.current);
        push("Flux attaché à l'élément vidéo");
      }

      push("Envoi de la phrase de test…");
      const result = await output.renderText(TEST_PHRASE, {
        sessionId,
        turnId: "avatar-test",
        signal: abort.signal,
      });
      firstPlaybackMs = result.firstPlaybackStartMs;
      playbackTotalMs = result.playbackTotalMs;
      finalMode = result.started ? "video" : "tts";
      push(
        `Rendu ${result.status} — ${result.playedSegments}/${result.generatedSegments} segments`,
        result.status === "played" ? "ok" : "error",
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      finalMode = "tts";
      push(`Échec : ${errorMessage} → repli TTS en session réelle`, "error");
    } finally {
      await cleanup(sessionId);
      push("Session de test fermée");
      setSummary({
        provider: settings.activeProvider,
        finalMode,
        sessionId,
        externalSessionId,
        connectionMs,
        firstPlaybackMs,
        playbackTotalMs,
        totalMs: Math.round(performance.now() - startedAt),
        error: errorMessage,
      });
      abortRef.current = null;
      setRunning(false);
    }
  }, [cleanup, push, settings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" />
          Test privé de l'avatar
        </CardTitle>
        <CardDescription>
          Ouvre une session isolée avec le fournisseur sélectionné, joue une phrase de test et la
          referme. Le switch global de sortie n'est pas modifié.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={run} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Tester l'avatar
          </Button>
          <Button variant="outline" onClick={stop} disabled={!running}>
            <Square className="mr-2 h-4 w-4" />
            Interrompre
          </Button>
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="aspect-video w-full max-w-md rounded-md border bg-muted object-cover"
        />

        {summary && (
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex items-center gap-2">
              {summary.finalMode === "video" ? (
                <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Mode final : vidéo</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />Mode final : repli TTS
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">Fournisseur : {summary.provider}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <SummaryRow label="Connexion" value={ms(summary.connectionMs)} />
              <SummaryRow label="Premier son/image" value={ms(summary.firstPlaybackMs)} />
              <SummaryRow label="Durée de lecture" value={ms(summary.playbackTotalMs)} />
              <SummaryRow label="Durée totale du test" value={ms(summary.totalMs)} />
              <SummaryRow label="Session Ava" value={summary.sessionId?.slice(0, 8) ?? "—"} />
              <SummaryRow label="Session fournisseur" value={summary.externalSessionId?.slice(0, 12) ?? "—"} />
            </dl>
            {summary.error && (
              <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                {summary.error}
              </p>
            )}
          </div>
        )}

        {logs.length > 0 && (
          <ol className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
            {logs.map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className={
                  entry.tone === "error"
                    ? "text-destructive"
                    : entry.tone === "ok"
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                }
              >
                {new Date(entry.at).toLocaleTimeString()} — {entry.label}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

function ms(value: number | null): string {
  return value === null ? "—" : `${value} ms`;
}
