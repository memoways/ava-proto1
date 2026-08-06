import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchConversationTurnTrace,
  fetchConversationTurnTraceSummaries,
  type ConversationTurnTraceSummary,
} from "@/services/conversationTraceService";
import { materializeConversationTurnTrace } from "@/services/conversationTraceFormat";
import {
  discardConversationTraceOutboxRecord,
  listConversationTraceOutboxRecords,
  prewarmConversationTraceOutbox,
  retryConversationTraceOutboxRecord,
  subscribeConversationTraceOutbox,
  type ConversationTraceOutboxRecord,
} from "@/services/conversationTraceOutbox";
import { getBrowserDiagnostics } from "@/services/browserCapabilities";
import { getPassiveNetworkVerdict, getPassiveVoiceNetworkObservation } from "@/services/networkDiagnostics";
import type { ConversationTurnTrace, ConversationTurnTraceRow, ConversationTurnTraceV1 } from "@/types";
import { CircleHelp, Copy, Download, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
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

function formatChars(value: number | null | undefined): string {
  return typeof value === "number" ? `${value.toLocaleString("fr-CH")} car.` : "—";
}

function countMemoryItems(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const memory = value as Record<string, unknown>;
  return ["userFacts", "maxDisclosures", "commitments", "openThreads", "topics"]
    .reduce((sum, key) => sum + (Array.isArray(memory[key]) ? memory[key].length : 0), 0);
}

function JsonBlock({ value, label }: { value: unknown; label: string }) {
  const text = useMemo(
    () => typeof value === "string" ? value : JSON.stringify(value, null, 2),
    [value],
  );
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

function MaterializedTraceSection({
  trace,
  children,
}: {
  trace: ConversationTurnTrace;
  children: (materialized: ConversationTurnTraceV1) => ReactNode;
}) {
  const materialized = useMemo(() => materializeConversationTurnTrace(trace), [trace]);
  return <>{children(materialized)}</>;
}

/** Traduit un message technique brut en explication lisible pour l'admin. */
function explainStepError(raw: string | null | undefined): string | null {
  const message = raw?.trim();
  if (!message) return null;
  const timeout = message.match(/timed out after (\d+)\s*ms/i);
  if (timeout) {
    return `RAG interrompu après ${timeout[1]} ms (délai de dégradation) : la requête Voyage était encore en vol, le tour a continué sans contexte narratif. Message brut : ${message}`;
  }
  const http = message.match(/^HTTP (\d{3})/);
  if (http) {
    return `Échec serveur ${http[1]} sur query-rag : ${message}`;
  }
  return message;
}

function Step({
  label,
  duration,
  status = "complete",
  detail,
}: {
  label: string;
  duration?: number | null;
  status?: string;
  detail?: string | null;
}) {
  const explanation = status === "error" || status === "pending" ? explainStepError(detail) : explainStepError(detail);
  const badge = (
    <Badge variant={status === "error" ? "destructive" : status === "pending" ? "outline" : "secondary"}>{status}</Badge>
  );
  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          {explanation ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{badge}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm text-xs leading-relaxed">{explanation}</TooltipContent>
            </Tooltip>
          ) : badge}
          <span className="min-w-16 text-right font-mono text-xs text-muted-foreground">{formatMs(duration)}</span>
        </div>
      </div>
      {explanation ? (
        // Sur tablette le survol n'est pas fiable : la raison reste lisible en clair.
        <p className="mt-1 line-clamp-2 text-xs text-destructive">{explanation}</p>
      ) : null}
    </div>
  );
}


export default function PipelineTraceTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [traceSummaries, setTraceSummaries] = useState<ConversationTurnTraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<ConversationTurnTraceRow | null>(null);
  const [localRecords, setLocalRecords] = useState<ConversationTraceOutboxRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const traceRequestId = useRef(0);
  const traceCache = useRef(new Map<string, ConversationTurnTraceRow>());
  const selectedSessionId = searchParams.get("session") || "";
  const requestedTurn = Number(searchParams.get("turn") || 0);

  const selectedTurnIndex = useMemo(() => {
    if (!traceSummaries.length) return null;
    return traceSummaries.find((row) => row.turn_index === requestedTurn)?.turn_index
      ?? traceSummaries[traceSummaries.length - 1].turn_index;
  }, [requestedTurn, traceSummaries]);

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
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("session", data[0].id);
        return next;
      }, { replace: true });
    }
  }, [selectedSessionId, setSearchParams]);

  const loadTraceSummaries = useCallback(async () => {
    if (!selectedSessionId) {
      setTraceSummaries([]);
      setSelectedTrace(null);
      return;
    }
    setLoading(true);
    setSelectedTrace(null);
    traceCache.current.clear();
    try {
      const [remote, local] = await Promise.all([
        fetchConversationTurnTraceSummaries(selectedSessionId),
        listConversationTraceOutboxRecords(selectedSessionId),
      ]);
      setLocalRecords(local);
      const remoteTurns = new Set(remote.map((row) => row.turn_index));
      const pending = local
        .filter((record) => !remoteTurns.has(record.turnIndex))
        .map((record) => ({
          id: `local:${record.key}`,
          session_id: record.sessionId,
          turn_id: record.trace.identity.turnId,
          turn_index: record.turnIndex,
          schema_version: record.trace.schemaVersion,
          character_name: record.trace.identity.characterName,
          status: record.status,
          created_at: record.createdAt,
          updated_at: record.updatedAt,
        }));
      setTraceSummaries([...remote, ...pending].sort((a, b) => a.turn_index - b.turn_index));
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
    void prewarmConversationTraceOutbox().then(() => loadTraceSummaries()).catch(() => {});
    return subscribeConversationTraceOutbox(() => void loadTraceSummaries());
  }, [loadTraceSummaries]);

  const loadSelectedTrace = useCallback(async () => {
    if (!selectedSessionId || selectedTurnIndex === null) {
      setSelectedTrace(null);
      return;
    }
    const requestId = ++traceRequestId.current;
    const cacheKey = `${selectedSessionId}:${selectedTurnIndex}`;
    const cachedTrace = traceCache.current.get(cacheKey);
    if (cachedTrace) {
      setSelectedTrace(cachedTrace);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let row = await fetchConversationTurnTrace(selectedSessionId, selectedTurnIndex);
      if (!row) {
        const local = (await listConversationTraceOutboxRecords(selectedSessionId))
          .find((record) => record.turnIndex === selectedTurnIndex);
        if (local) {
          row = {
            id: `local:${local.key}`,
            session_id: local.sessionId,
            turn_id: local.trace.identity.turnId,
            turn_index: local.turnIndex,
            schema_version: local.trace.schemaVersion,
            character_name: local.trace.identity.characterName,
            status: local.status,
            trace: local.trace,
            created_at: local.createdAt,
            updated_at: local.updatedAt,
          };
        }
      }
      if (requestId === traceRequestId.current) {
        if (row) traceCache.current.set(cacheKey, row);
        setSelectedTrace(row);
      }
    } catch (error) {
      if (requestId === traceRequestId.current) {
        toast.error(`Chargement impossible : ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      if (requestId === traceRequestId.current) setLoading(false);
    }
  }, [selectedSessionId, selectedTurnIndex]);

  useEffect(() => {
    void loadSelectedTrace();
  }, [loadSelectedTrace]);

  const selectSession = (sessionId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("session", sessionId);
      next.delete("turn");
      return next;
    }, { replace: true });
  };

  const selectTurn = (turn: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("turn", turn);
      return next;
    }, { replace: true });
  };

  const exportTrace = () => {
    if (!selectedTrace) return;
    const materialized = materializeConversationTurnTrace(selectedTrace.trace);
    const blob = new Blob([JSON.stringify(materialized, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `max-trace-${selectedTrace.session_id}-turn-${selectedTrace.turn_index}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Keep V2 compact while the accordions are closed. Exact large strings are
  // only materialized inside the prompt/payload accordion content.
  const trace = selectedTrace?.trace ?? null;
  const localRecord = localRecords.find((record) => record.turnIndex === selectedTurnIndex) ?? null;
  const rawTimings = selectedTrace?.trace.schemaVersion === 2 ? selectedTrace.trace.timings : null;
  const networkVerdict = getPassiveNetworkVerdict(getBrowserDiagnostics(), {
    bps: rawTimings?.traceUploadBps,
    durationMs: rawTimings?.traceUploadMs,
  }, getPassiveVoiceNetworkObservation());
  const promptBudget = trace?.prompt?.budget;
  const unitStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const unit of promptBudget?.units ?? []) counts[unit.status] = (counts[unit.status] ?? 0) + 1;
    return counts;
  }, [promptBudget?.units]);
  const ragStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const candidate of promptBudget?.ragSelection ?? []) counts[candidate.status] = (counts[candidate.status] ?? 0) + 1;
    return counts;
  }, [promptBudget?.ragSelection]);
  const postTurnOutput = trace
    ? (trace.gm.postTurn as { parsedOutput?: { memory_delta?: unknown; memory_after?: unknown } }).parsedOutput
    : undefined;
  const memoryBefore = trace?.memory.structuredMemoryBefore;
  const memoryDelta = postTurnOutput?.memory_delta;
  const memoryAfter = postTurnOutput?.memory_after;

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
              ["2", "Converser", "Parle normalement avec Max. La trace est mise en file locale avant diffusion, puis synchronisée hors du chemin vocal."],
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
        <CardContent className="grid gap-3 tablet-lg:grid-cols-[1fr_220px_auto]">
          <Select value={selectedSessionId} onValueChange={selectSession}>
            <SelectTrigger><SelectValue placeholder="Choisir une session tracée" /></SelectTrigger>
            <SelectContent>
              {sessions.map((session) => <SelectItem key={session.id} value={session.id}>{sessionLabel(session)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTurnIndex === null ? "" : String(selectedTurnIndex)} onValueChange={selectTurn} disabled={!traceSummaries.length}>
            <SelectTrigger><SelectValue placeholder="Choisir un tour" /></SelectTrigger>
            <SelectContent>
              {traceSummaries.map((row) => <SelectItem key={row.id} value={String(row.turn_index)}>Tour {row.turn_index}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadTraceSummaries()} disabled={loading || !selectedSessionId}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
            </Button>
            <Button variant="outline" onClick={exportTrace} disabled={!selectedTrace}>
              <Download className="mr-1 h-4 w-4" /> JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">État diagnostic et réseau</CardTitle>
          <CardDescription>{networkVerdict.label}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={localRecord?.status === "error" ? "destructive" : "secondary"}>
            {localRecord
              ? localRecord.status === "pending" ? "En attente locale"
                : localRecord.status === "syncing" ? "Synchronisation"
                  : localRecord.status === "uploaded" ? "Enregistrée"
                    : "Erreur"
              : selectedTrace ? "Enregistrée" : "Aucune trace"}
          </Badge>
          {localRecord?.lastError ? <span className="text-xs text-destructive">{localRecord.lastError}</span> : null}
          {localRecord ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void retryConversationTraceOutboxRecord(localRecord.key)}>
                <RefreshCw className="mr-1 h-3 w-3" /> Réessayer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void discardConversationTraceOutboxRecord(localRecord.key)}>
                <Trash2 className="mr-1 h-3 w-3" /> Supprimer localement
              </Button>
            </>
          ) : null}
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
              <Step
                label="RAG"
                duration={trace.timings.ragMs}
                status={trace.rag.error ? "error" : "complete"}
                detail={trace.rag.error || trace.rag.rerankError || null}
              />
              <Step label="Assemblage prompt" duration={trace.timings.promptBuildMs} status={trace.prompt ? "complete" : "error"} detail={trace.prompt ? null : "Aucun prompt assemblé pour ce tour."} />
              <Step label="Max LLM" duration={trace.timings.maxClientMs} status={trace.maxCall.error ? "error" : "complete"} detail={trace.maxCall.error} />
              <Step label="Mise en file locale" duration={trace.timings.traceWriteMs} status={localRecord?.status || "complete"} detail={localRecord?.lastError ?? null} />
              <Step label="GM labels (parallèle)" duration={(trace.gm.labelPass as { latencyMs?: number }).latencyMs} status={String((trace.gm.labelPass as { status?: string }).status || "pending")} detail={(trace.gm.labelPass as { error?: string | null }).error ?? null} />
              <Step label="GM post-tour (pour la suite)" duration={(trace.gm.postTurn as { latencyMs?: number }).latencyMs} status={String((trace.gm.postTurn as { status?: string }).status || "pending")} detail={(trace.gm.postTurn as { error?: string | null }).error ?? null} />

              <Step label="Pipeline hors instrumentation" duration={trace.timings.pipelineUninstrumentedMs} />
              <Step label="Pipeline causal total" duration={trace.timings.coreTotalMs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Analyse compacte du payload</CardTitle>
              <CardDescription>
                Vue chargée sans reconstruire les gros blocs texte. Le JSON exact reste disponible dans les sections détaillées et au téléchargement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {promptBudget ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-xs tablet:grid-cols-3 xl:grid-cols-6">
                    {[
                      ["Variante", promptBudget.variant],
                      ["Système", formatChars(promptBudget.totalSystemChars)],
                      ["Historique", formatChars(promptBudget.historyChars)],
                      ["Mémoire", formatChars(promptBudget.sections.find((section) => section.key === "conversation_memory")?.chars)],
                      ["RAG", formatChars(promptBudget.sections.find((section) => section.key === "rag_context")?.chars)],
                      ["Message courant", formatChars(promptBudget.currentUserChars)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-muted/10 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                        <div className="mt-1 font-mono text-sm">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">
                          <Badge variant={promptBudget.withinBudget ? "secondary" : "destructive"}>
                            {promptBudget.withinBudget ? "Contexte dans le budget" : "Budget dépassé"}
                          </Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-xs leading-relaxed">
                        {`Prompt système ${formatChars(promptBudget.totalSystemChars)} pour un plafond de ${formatChars(promptBudget.limitChars)} (statique : ${formatChars(promptBudget.staticChars)} / ${formatChars(promptBudget.staticLimitChars)}). Variante ${promptBudget.variant}.`}
                      </TooltipContent>
                    </Tooltip>
                    <Badge variant="outline">Total payload : {formatChars(promptBudget.totalMessageChars)}</Badge>
                    {!promptBudget.withinBudget ? (
                      <Badge variant="outline">
                        Économie potentielle : {formatChars(Math.max(0, promptBudget.totalSystemChars - promptBudget.limitChars))}
                      </Badge>
                    ) : null}

                    {typeof promptBudget.contextLimitChars === "number" ? <Badge variant="outline">Plafond contexte : {formatChars(promptBudget.contextLimitChars)}</Badge> : null}
                    {typeof promptBudget.deduplicatedChars === "number" ? <Badge variant="outline">Doublons retirés : {formatChars(promptBudget.deduplicatedChars)}</Badge> : null}
                    {typeof promptBudget.memoryLastTurn === "number" ? <Badge variant="outline">Mémoire au tour {promptBudget.memoryLastTurn}</Badge> : null}
                    {promptBudget.oversizedCurrentUser ? <Badge variant="destructive">Dépassement dû au message courant intact</Badge> : null}
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Budget par section</p>
                      {promptBudget.sections.map((section) => (
                        <div key={section.key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs">
                          <span className="min-w-0 truncate">{section.title}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {formatChars(section.chars)}{section.originalChars !== section.chars ? ` / ${formatChars(section.originalChars)}` : ""}
                            {section.omissionReason ? ` · ${section.omissionReason}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Décisions de sélection</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(unitStatusCounts).map(([status, count]) => <Badge key={status} variant="outline">{status}: {count}</Badge>)}
                          {!Object.keys(unitStatusCounts).length ? <span className="text-xs text-muted-foreground">Trace antérieure sans décisions unitaires.</span> : null}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Candidats RAG</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ragStatusCounts).map(([status, count]) => <Badge key={status} variant="outline">{status}: {count}</Badge>)}
                          {!Object.keys(ragStatusCounts).length ? <span className="text-xs text-muted-foreground">Aucune décision RAG détaillée.</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cycle de mémoire du tour</p>
                    <div className="grid gap-2 text-xs tablet:grid-cols-3">
                      <div className="rounded-md border bg-muted/10 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avant</div>
                        <div className="mt-1 font-mono">tour {memoryBefore?.lastTurn ?? 0} · {countMemoryItems(memoryBefore)} éléments</div>
                      </div>
                      <div className="rounded-md border bg-muted/10 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Delta GM</div>
                        <div className="mt-1 font-mono">{memoryDelta ? `${countMemoryItems(memoryDelta)} éléments proposés` : "en attente ou absent"}</div>
                      </div>
                      <div className="rounded-md border bg-muted/10 p-2">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Après</div>
                        <div className="mt-1 font-mono">{memoryAfter && typeof memoryAfter === "object" ? `tour ${String((memoryAfter as { lastTurn?: unknown }).lastTurn ?? "—")} · ${countMemoryItems(memoryAfter)} éléments` : "en attente ou absent"}</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Trace antérieure sans rapport de budget.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Coût en tokens de la requête envoyée au LLM</CardTitle>
            </CardHeader>
            <CardContent>
              {trace.maxCall.diagnostic?.usage ? (
                <div className="grid grid-cols-2 tablet:grid-cols-4 gap-2 text-xs">
                  {[
                    ["Tokens entrée (prompt final)", trace.maxCall.diagnostic.usage.prompt_tokens],
                    ["Tokens sortie (réponse)", trace.maxCall.diagnostic.usage.completion_tokens],
                    ["Tokens totaux", trace.maxCall.diagnostic.usage.total_tokens],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md border bg-muted/10 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
                      <div className="font-mono text-sm">
                        {typeof value === "number" ? value.toLocaleString("fr-CH") : "—"}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-md border bg-muted/10 p-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Modèle facturé</div>
                    <div className="font-mono text-[11px] break-all">
                      {trace.maxCall.diagnostic.returnedModel || trace.maxCall.requestedSettings?.model || "—"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aucun relevé de tokens pour ce tour (réponse de secours ou trace antérieure).
                </p>
              )}
            </CardContent>
          </Card>



          <Accordion type="multiple" defaultValue={["response"]} className="space-y-2">
            <AccordionItem value="prompt" className="rounded-lg border px-4">
              <AccordionTrigger>1. Prompt maître et prompt système final</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <MaterializedTraceSection trace={trace}>{(fullTrace) => <>
                  <JsonBlock label="Provenance" value={fullTrace.prompt ? { baseSource: fullTrace.prompt.baseSource, characterPrompt: fullTrace.prompt.characterPrompt } : null} />
                  <JsonBlock label="Budget du prompt" value={fullTrace.prompt?.budget || "Trace antérieure sans rapport de budget"} />
                  <JsonBlock label="Prompt maître" value={fullTrace.prompt?.baseSystemPrompt || null} />
                  <JsonBlock label="Sections personnage" value={fullTrace.prompt?.characterPrompt.renderedSections || null} />
                  <JsonBlock label="Règles techniques" value={fullTrace.prompt?.technicalRules || null} />
                  <JsonBlock label="Prompt système final" value={fullTrace.prompt?.finalSystemPrompt || null} />
                </>}</MaterializedTraceSection>
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
                <MaterializedTraceSection trace={trace}>{(fullTrace) => <>
                  <JsonBlock label="Messages" value={fullTrace.maxCall.messages} />
                  <JsonBlock label="Payload OpenRouter exact" value={fullTrace.maxCall.diagnostic?.upstreamPayload || null} />
                  <JsonBlock label="Payload reçu par le proxy" value={fullTrace.maxCall.diagnostic?.clientPayload || null} />
                </>}</MaterializedTraceSection>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="model" className="rounded-lg border px-4">
              <AccordionTrigger>6. Modèle, paramètres et tokens</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <JsonBlock label="Paramètres demandés par l'application" value={trace.maxCall.requestedSettings} />
                <JsonBlock
                  label="Paramètres réellement transmis à OpenRouter"
                  value={trace.maxCall.diagnostic?.upstreamPayload
                    ? {
                        model: trace.maxCall.diagnostic.upstreamPayload.model,
                        temperature: trace.maxCall.diagnostic.upstreamPayload.temperature,
                        top_p: trace.maxCall.diagnostic.upstreamPayload.top_p,
                        max_tokens: trace.maxCall.diagnostic.upstreamPayload.max_tokens,
                        reasoning: trace.maxCall.diagnostic.upstreamPayload.reasoning,
                      }
                    : null}
                />
                <JsonBlock label="Modèle retourné et fournisseur" value={{ returnedModel: trace.maxCall.diagnostic?.returnedModel, provider: trace.maxCall.diagnostic?.provider, generationId: trace.maxCall.diagnostic?.generationId }} />
                <JsonBlock label="Tokens exacts renvoyés par OpenRouter" value={trace.maxCall.diagnostic?.usage || null} />
              </AccordionContent>
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
