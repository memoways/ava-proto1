import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchConversationTurnTraces } from "@/services/conversationTraceService";
import type { ConversationTurnTraceRow, ConversationTurnTraceV1 } from "@/types";
import { CircleHelp, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DiagnosticSession {
  id: string;
  name: string | null;
  started_at: string | null;
  ended_at: string | null;
}

function sessionLabel(session: DiagnosticSession): string {
  const date = session.started_at ? new Date(session.started_at).toLocaleString("fr-CH") : "date inconnue";
  return `${session.name || session.id.slice(0, 8)} · ${date}`;
}

function formatMs(value: number | null | undefined): string {
  return typeof value === "number" ? `${value} ms` : "—";
}

function JsonBlock({ value, label }: { value: unknown; label: string }) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(text || "");
    toast.success(`${label} copié`);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Button size="sm" variant="ghost" onClick={copy} disabled={!text}>
          <Copy className="mr-1 h-3 w-3" /> Copier
        </Button>
      </div>
      <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/20 p-3 text-xs">
        {text || "—"}
      </pre>
    </div>
  );
}

function Step({ label, duration, status = "complete" }: { label: string; duration?: number | null; status?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant={status === "error" ? "destructive" : status === "pending" ? "outline" : "secondary"}>{status}</Badge>
        <span className="min-w-16 text-right font-mono text-xs text-muted-foreground">{formatMs(duration)}</span>
      </div>
    </div>
  );
}

export default function PipelineTraceTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [traces, setTraces] = useState<ConversationTurnTraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedSessionId = searchParams.get("session") || "";
  const requestedTurn = Number(searchParams.get("turn") || 0);

  const selectedTrace = useMemo(() => {
    if (!traces.length) return null;
    return traces.find((row) => row.turn_index === requestedTurn) || traces[traces.length - 1];
  }, [requestedTurn, traces]);

  const loadSessions = useCallback(async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, name, started_at, ended_at")
      .eq("diagnostic_trace_enabled", true)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    setSessions(data || []);
    if (!selectedSessionId && data?.[0]) {
      const next = new URLSearchParams(searchParams);
      next.set("session", data[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedSessionId, setSearchParams]);

  const loadTraces = useCallback(async () => {
    if (!selectedSessionId) {
      setTraces([]);
      return;
    }
    setLoading(true);
    try {
      setTraces(await fetchConversationTurnTraces(selectedSessionId));
    } catch (error) {
      toast.error(`Chargement impossible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    void loadSessions().catch((error) => toast.error(error instanceof Error ? error.message : String(error)));
  }, [loadSessions]);

  useEffect(() => {
    void loadTraces();
  }, [loadTraces]);

  const selectSession = (sessionId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("session", sessionId);
    next.delete("turn");
    setSearchParams(next, { replace: true });
  };

  const selectTurn = (turn: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("turn", turn);
    setSearchParams(next, { replace: true });
  };

  const exportTrace = () => {
    if (!selectedTrace) return;
    const blob = new Blob([JSON.stringify(selectedTrace.trace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `max-trace-${selectedTrace.session_id}-turn-${selectedTrace.turn_index}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const trace: ConversationTurnTraceV1 | null = selectedTrace?.trace ?? null;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trace exacte des réponses de Max</h2>
          <p className="text-sm text-muted-foreground">
            Inspecteur causal du pipeline PRD4 réel. Les étapes parallèles du Game Master sont séparées des éléments ayant produit la réponse.
          </p>
        </div>
        <Button asChild>
          <a href="/?diagnostic=full" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" /> Lancer une session tracée
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CircleHelp className="h-4 w-4" /> Mode d’emploi rapide
          </CardTitle>
          <CardDescription>Quatre étapes pour comprendre pourquoi Max a produit une réponse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            {[
              ["1", "Lancer", "Clique sur « Lancer une session tracée ». Le mode reste actif pendant toute cette session."],
              ["2", "Converser", "Parle normalement avec Max. Chaque réponse générée est enregistrée avant son affichage et sa lecture."],
              ["3", "Choisir le tour", "Reviens ici, rafraîchis, puis sélectionne la session et le tour à examiner."],
              ["4", "Analyser", "Ouvre les huit sections, copie un élément ou exporte le JSON complet pour le comparer."],
            ].map(([number, title, description]) => (
              <li key={number} className="rounded-md border bg-muted/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary">{number}</Badge>
                  <span className="font-medium">{title}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-md border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Repère rapide :</strong> réponse incohérente → vérifie mémoire, RAG et prompt ;
            ton ou comportement étrange → vérifie prompt maître et guidance GM ; réponse lente → ouvre les latences ;
            modèle inattendu → compare configuration demandée et modèle retourné.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session et tour</CardTitle>
          <CardDescription>Seules les sessions explicitement lancées en diagnostic sont proposées.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Select value={selectedSessionId} onValueChange={selectSession}>
            <SelectTrigger><SelectValue placeholder="Choisir une session tracée" /></SelectTrigger>
            <SelectContent>
              {sessions.map((session) => <SelectItem key={session.id} value={session.id}>{sessionLabel(session)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTrace ? String(selectedTrace.turn_index) : ""} onValueChange={selectTurn} disabled={!traces.length}>
            <SelectTrigger><SelectValue placeholder="Choisir un tour" /></SelectTrigger>
            <SelectContent>
              {traces.map((row) => <SelectItem key={row.id} value={String(row.turn_index)}>Tour {row.turn_index}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadTraces()} disabled={loading || !selectedSessionId}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
            </Button>
            <Button variant="outline" onClick={exportTrace} disabled={!selectedTrace}>
              <Download className="mr-1 h-4 w-4" /> JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {!trace ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aucune trace disponible pour cette sélection.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Chronologie — tour {trace.identity.turnIndex}</CardTitle>
                <Badge variant="secondary">schéma v{trace.schemaVersion}</Badge>
                <Badge variant="outline">{trace.identity.status}</Badge>
              </div>
              <CardDescription>{trace.identity.turnId} · {new Date(trace.identity.createdAt).toLocaleString("fr-CH")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              <Step label="Mémoire / résumé" duration={trace.timings.summaryFetchMs} />
              <Step label="RAG" duration={trace.timings.ragMs} status={trace.rag.error ? "error" : "complete"} />
              <Step label="Assemblage prompt" duration={trace.timings.promptBuildMs} status={trace.prompt ? "complete" : "error"} />
              <Step label="Max LLM" duration={trace.timings.maxClientMs} status={trace.maxCall.error ? "error" : "complete"} />
              <Step label="Sauvegarde garantie" duration={trace.timings.traceWriteMs} />
              <Step label="GM labels (parallèle)" duration={(trace.gm.labelPass as { latencyMs?: number }).latencyMs} status={String((trace.gm.labelPass as { status?: string }).status || "pending")} />
              <Step label="GM post-tour (pour la suite)" duration={(trace.gm.postTurn as { latencyMs?: number }).latencyMs} status={String((trace.gm.postTurn as { status?: string }).status || "pending")} />
              <Step label="Pipeline hors instrumentation" duration={trace.timings.pipelineUninstrumentedMs} />
              <Step label="Pipeline causal total" duration={trace.timings.coreTotalMs} />
            </CardContent>
          </Card>

          <Accordion type="multiple" defaultValue={["response", "rag", "payload"]} className="space-y-2">
            <AccordionItem value="prompt" className="rounded-lg border px-4">
              <AccordionTrigger>1. Prompt maître et prompt système final</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <JsonBlock label="Provenance" value={trace.prompt ? { baseSource: trace.prompt.baseSource, characterPrompt: trace.prompt.characterPrompt } : null} />
                <JsonBlock label="Prompt maître" value={trace.prompt?.baseSystemPrompt || null} />
                <JsonBlock label="Sections personnage" value={trace.prompt?.characterPrompt.renderedSections || null} />
                <JsonBlock label="Règles techniques" value={trace.prompt?.technicalRules || null} />
                <JsonBlock label="Prompt système final" value={trace.prompt?.finalSystemPrompt || null} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="memory" className="rounded-lg border px-4">
              <AccordionTrigger>2. Mémoire de conversation réellement injectée</AccordionTrigger>
              <AccordionContent><JsonBlock label="Mémoire résolue" value={trace.memory} /></AccordionContent>
            </AccordionItem>

            <AccordionItem value="gm" className="rounded-lg border px-4">
              <AccordionTrigger>3. Instructions et traitements du Game Master</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <JsonBlock label="Cause de la réponse actuelle" value={{ causalGuidance: trace.gm.causalGuidance, preTurnPlanner: trace.gm.preTurnPlanner, validator: trace.gm.validator }} />
                <JsonBlock label="Labels parallèles — non causaux" value={trace.gm.labelPass} />
                <JsonBlock label="Post-tour — influence le tour suivant" value={trace.gm.postTurn} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rag" className="rounded-lg border px-4">
              <AccordionTrigger>4. Chunks RAG sélectionnés et scores</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <JsonBlock label="Requête RAG effective" value={trace.rag.request} />
                <JsonBlock label={`Matches (${trace.rag.matches.length})`} value={trace.rag.matches} />
                <JsonBlock label="Contexte formaté injecté" value={trace.rag.formattedContext} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payload" className="rounded-lg border px-4">
              <AccordionTrigger>5. Payload final envoyé au LLM</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <JsonBlock label="Messages" value={trace.maxCall.messages} />
                <JsonBlock label="Payload OpenRouter exact" value={trace.maxCall.diagnostic?.upstreamPayload || null} />
                <JsonBlock label="Payload reçu par le proxy" value={trace.maxCall.diagnostic?.clientPayload || null} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="model" className="rounded-lg border px-4">
              <AccordionTrigger>6. Modèle, paramètres et tokens</AccordionTrigger>
              <AccordionContent><JsonBlock label="Configuration effective" value={{ requested: trace.maxCall.requestedSettings, returnedModel: trace.maxCall.diagnostic?.returnedModel, provider: trace.maxCall.diagnostic?.provider, generationId: trace.maxCall.diagnostic?.generationId, usage: trace.maxCall.diagnostic?.usage }} /></AccordionContent>
            </AccordionItem>

            <AccordionItem value="response" className="rounded-lg border px-4">
              <AccordionTrigger>7. Réponse produite et réponse diffusée</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="flex gap-2"><Badge variant={trace.response.source === "fallback" ? "destructive" : "secondary"}>{trace.response.source}</Badge>{trace.maxCall.error && <Badge variant="destructive">{trace.maxCall.error}</Badge>}</div>
                <JsonBlock label="Sortie brute LLM" value={trace.response.rawLlmResponse} />
                <JsonBlock label="Réponse diffusée" value={trace.response.deliveredResponse} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="latency" className="rounded-lg border px-4">
              <AccordionTrigger>8. Latences détaillées</AccordionTrigger>
              <AccordionContent><JsonBlock label="Latences" value={trace.timings} /></AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  );
}
