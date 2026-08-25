import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, RefreshCw, Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OPENROUTER_MODELS } from "@/services/settingsService";
import {
  EVAL_DEFAULT_JUDGE_MODEL,
  EVAL_NOTION_COLUMNS,
  EVAL_REPEATS,
  buildOfatConfigs,
  defaultOfatSelection,
  estimateEvalRun,
  judgeIsolatedEvalTurn,
  listEvalWorkItems,
  rankConfigs,
  resultWorkKey,
  runIsolatedEvalTurn,
  snapshotLiveSettings,
  strongestFactor,
  type EvalItem,
  type EvalResult,
  type EvalRun,
  type EvalTurnConfig,
  type OfatSelection,
  type RankedConfig,
} from "@/services/evalJudgePipeline";
import {
  createEvalRun,
  fetchEvalItems,
  fetchEvalResults,
  fetchEvalRuns,
  insertEvalResult,
  loadEvalNotionDatabaseId,
  patchEvalRun,
  saveEvalNotionDatabaseId,
  syncEvalItemsFromNotion,
} from "@/services/evalJudgeStore";

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(3)}`;
}

function latencyFrom(row: EvalResult): { total_ms?: number } | null {
  const latencies = row.latencies as { total_ms?: number } | null;
  return latencies && typeof latencies === "object" ? latencies : null;
}

export default function EvalJudgeTab() {
  const [notionId, setNotionId] = useState("");
  const [items, setItems] = useState<EvalItem[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [activeRun, setActiveRun] = useState<EvalRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [judgeModel, setJudgeModel] = useState(EVAL_DEFAULT_JUDGE_MODEL);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [tempZero, setTempZero] = useState(true);
  const [tempHigh, setTempHigh] = useState(true);
  const [ragConservative, setRagConservative] = useState(true);
  const [ragGenerous, setRagGenerous] = useState(true);
  const [drill, setDrill] = useState<{ label: string; rows: EvalResult[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  const live = useMemo(() => snapshotLiveSettings(), []);
  const ofatDefaults = useMemo(() => defaultOfatSelection(live), [live]);

  useEffect(() => {
    if (!modelA && ofatDefaults.extraModels[0]) setModelA(ofatDefaults.extraModels[0]);
    if (!modelB && ofatDefaults.extraModels[1]) setModelB(ofatDefaults.extraModels[1]);
  }, [modelA, modelB, ofatDefaults.extraModels]);

  const selection: OfatSelection = useMemo(() => ({
    extraModels: [modelA, modelB].filter(Boolean),
    samplingTemps: [
      ...(tempZero ? [0] : []),
      ...(tempHigh ? [0.8] : []),
    ],
    ragVariants: [
      ...(ragConservative ? ofatDefaults.ragVariants.filter((variant) => variant.key === "conservative") : []),
      ...(ragGenerous ? ofatDefaults.ragVariants.filter((variant) => variant.key === "generous") : []),
    ],
  }), [modelA, modelB, ofatDefaults.ragVariants, ragConservative, ragGenerous, tempHigh, tempZero]);

  const configs = useMemo(() => buildOfatConfigs(live, selection), [live, selection]);
  const activeItems = useMemo(() => items.filter((item) => item.active), [items]);
  const estimate = useMemo(
    () => estimateEvalRun(activeItems.length, configs, EVAL_REPEATS),
    [activeItems.length, configs],
  );
  const ranked: RankedConfig[] = useMemo(
    () => rankConfigs(results.map((row) => ({
      config_label: row.config_label,
      factor: row.factor,
      overall_score: row.overall_score,
      latencies: latencyFrom(row),
    }))),
    [results],
  );
  const factorWinner = useMemo(() => strongestFactor(ranked), [ranked]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [id, nextItems, nextRuns] = await Promise.all([
        loadEvalNotionDatabaseId(),
        fetchEvalItems(),
        fetchEvalRuns(),
      ]);
      setNotionId(id);
      setItems(nextItems);
      setRuns(nextRuns);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSaveNotionId() {
    try {
      await saveEvalNotionDatabaseId(notionId);
      toast.success("ID Notion enregistré pour cet environnement");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSync() {
    if (!notionId.trim()) {
      toast.error("Colle l’ID de la base Notion avant de synchroniser");
      return;
    }
    setSyncing(true);
    try {
      await saveEvalNotionDatabaseId(notionId);
      const report = await syncEvalItemsFromNotion(notionId);
      toast.success(`${report.items_upserted} item(s) synchronisé(s)`);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }

  async function loadRun(run: EvalRun) {
    setActiveRun(run);
    try {
      setResults(await fetchEvalResults(run.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function executeRun(run: EvalRun, runConfigs: EvalTurnConfig[], existing: EvalResult[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    pauseRef.current = false;
    setRunning(true);
    await patchEvalRun(run.id, { status: "running", started_at: run.started_at ?? new Date().toISOString() });
    const done = new Set(existing.map(resultWorkKey));
    const queue = listEvalWorkItems(runConfigs, activeItems, run.repeats, done);
    let completed = existing.length;
    const acc = [...existing];
    try {
      for (const work of queue) {
        if (pauseRef.current) {
          await patchEvalRun(run.id, { status: "paused", current_index: completed });
          setActiveRun({ ...run, status: "paused", current_index: completed });
          toast.message("Run en pause");
          return;
        }
        if (controller.signal.aborted) return;
        setProgressLabel(`${work.config.label} · ${work.item.question.slice(0, 60)} · passage ${work.repeatIndex}`);
        const turn = await runIsolatedEvalTurn(work.item, work.config, { signal: controller.signal });
        const judge = turn.maxResponse
          ? await judgeIsolatedEvalTurn(work.item, turn.maxResponse, run.judge_model, { signal: controller.signal })
          : null;
        const saved = await insertEvalResult({
          runId: run.id,
          item: work.item,
          config: work.config,
          repeatIndex: work.repeatIndex,
          turn,
          judge,
        });
        acc.push(saved);
        completed += 1;
        setResults([...acc]);
        await patchEvalRun(run.id, { current_index: completed, status: "running" });
      }
      await patchEvalRun(run.id, {
        status: "done",
        current_index: completed,
        finished_at: new Date().toISOString(),
      });
      setActiveRun({ ...run, status: "done", current_index: completed });
      toast.success("Run terminé");
      await reload();
    } catch (error) {
      if (pauseRef.current || (error instanceof DOMException && error.name === "AbortError")) {
        await patchEvalRun(run.id, { status: "paused", current_index: completed });
        setActiveRun({ ...run, status: "paused", current_index: completed });
        toast.message("Run en pause");
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      await patchEvalRun(run.id, { status: "failed", error_message: message, current_index: completed });
      setActiveRun({ ...run, status: "failed", error_message: message });
      toast.error(message);
    } finally {
      setRunning(false);
      abortRef.current = null;
      setProgressLabel("");
    }
  }

  async function handleStart() {
    if (activeItems.length === 0) {
      toast.error("Aucun item actif. Synchronise Notion d’abord.");
      return;
    }
    const currentLive = snapshotLiveSettings();
    const currentConfigs = buildOfatConfigs(currentLive, selection);
    const currentEstimate = estimateEvalRun(activeItems.length, currentConfigs, EVAL_REPEATS);
    if (!window.confirm(`Lancer ${currentEstimate.turns} tours (~${currentEstimate.llmCalls} appels LLM, ~${formatUsd(currentEstimate.estimatedCostUsd)}) ?`)) {
      return;
    }
    try {
      const run = await createEvalRun({
        baseline: currentLive,
        configs: currentConfigs,
        judgeModel,
        repeats: EVAL_REPEATS,
        estimatedTurns: currentEstimate.turns,
        estimatedCostUsd: currentEstimate.estimatedCostUsd,
      });
      setActiveRun(run);
      setResults([]);
      await executeRun(run, currentConfigs, []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleResume(run: EvalRun) {
    const stored = (run.ofat_config as { configs?: EvalTurnConfig[] } | null)?.configs;
    const runConfigs = stored?.length ? stored : configs;
    const existing = await fetchEvalResults(run.id);
    setResults(existing);
    setActiveRun(run);
    await executeRun(run, runConfigs, existing);
  }

  function handlePause() {
    pauseRef.current = true;
    abortRef.current?.abort();
  }

  function exportRun() {
    const blob = new Blob([JSON.stringify({ run: activeRun, results, ranked }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eval-judge-${activeRun?.id ?? "run"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const progress = activeRun && activeRun.total_turns > 0
    ? Math.round((results.length / activeRun.total_turns) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">LLM as judge — tours isolés</h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Pipeline texte réel (RAG → GM → Max → validateur), sans voix. OFAT sur modèle, sampling et RAG.
            Trois passages par question. Le juge compare à la cible Notion (or + grille).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corpus Notion</CardTitle>
          <CardDescription>
            Crée une database avec ces colonnes, puis colle l’ID. La sync ne crée pas d’embeddings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {EVAL_NOTION_COLUMNS.map((column) => (
              <Badge key={column.name} variant="outline">{column.name}</Badge>
            ))}
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            {EVAL_NOTION_COLUMNS.map((column) => (
              <li key={column.name}><span className="font-medium text-foreground">{column.name}</span> ({column.type}) — {column.note}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Label htmlFor="eval-notion-id">ID de la base Notion</Label>
              <Input id="eval-notion-id" value={notionId} onChange={(event) => setNotionId(event.target.value)} placeholder="32 caractères hex" />
            </div>
            <Button variant="outline" onClick={() => void handleSaveNotionId()}>Enregistrer l’ID</Button>
            <Button onClick={() => void handleSync()} disabled={syncing}>
              {syncing ? "Sync…" : "Synchroniser"}
            </Button>
          </div>
          <p className="text-sm">{activeItems.length} item(s) actif(s) / {items.length} synchronisé(s).</p>
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordre</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.sort_order}</TableCell>
                    <TableCell className="max-w-md truncate">{item.question}</TableCell>
                    <TableCell>{item.category || "—"}</TableCell>
                    <TableCell>{item.active ? "oui" : "non"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leviers OFAT</CardTitle>
          <CardDescription>
            Référence = réglages live ({live.model}, temp {live.temperature}, RAG k={live.ragTopK}). Un facteur à la fois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Modèle A</Label>
              <Select value={modelA} onValueChange={setModelA}>
                <SelectTrigger><SelectValue placeholder="Modèle" /></SelectTrigger>
                <SelectContent>
                  {OPENROUTER_MODELS.filter((model) => model.id !== live.model).map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modèle B</Label>
              <Select value={modelB} onValueChange={setModelB}>
                <SelectTrigger><SelectValue placeholder="Modèle" /></SelectTrigger>
                <SelectContent>
                  {OPENROUTER_MODELS.filter((model) => model.id !== live.model && model.id !== modelA).map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modèle juge (température 0)</Label>
              <Select value={judgeModel} onValueChange={setJudgeModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPENROUTER_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={tempZero} onCheckedChange={(value) => setTempZero(value === true)} />
              Sampling temp 0
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={tempHigh} onCheckedChange={(value) => setTempHigh(value === true)} />
              Sampling temp 0.8
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ragConservative} onCheckedChange={(value) => setRagConservative(value === true)} />
              RAG conservateur
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={ragGenerous} onCheckedChange={(value) => setRagGenerous(value === true)} />
              RAG généreux
            </label>
          </div>
          <p className="text-sm">
            {estimate.configs} configs × {estimate.items} questions × {estimate.repeats} = <strong>{estimate.turns} tours</strong>
            {" "}(~{estimate.llmCalls} appels LLM, {formatUsd(estimate.estimatedCostUsd)}).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleStart()} disabled={running}>
              <Play className="mr-2 h-4 w-4" /> Lancer
            </Button>
            {running ? (
              <Button variant="outline" onClick={handlePause}>
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
            ) : null}
            {activeRun && (activeRun.status === "paused" || activeRun.status === "failed") && !running ? (
              <Button variant="secondary" onClick={() => void handleResume(activeRun)}>Reprendre</Button>
            ) : null}
          </div>
          {running || progressLabel ? (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{progressLabel || `${results.length}/${activeRun?.total_turns ?? 0}`}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Classement</CardTitle>
            <CardDescription>
              {factorWinner
                ? `Levier le plus fort : ${factorWinner.factor} (Δ moyen ${factorWinner.absDelta})`
                : "Lance un run pour comparer les deltas vs la référence live."}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportRun} disabled={!activeRun}>
            <Download className="mr-2 h-4 w-4" /> Export JSON
          </Button>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore de scores.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Config</TableHead>
                  <TableHead>Facteur</TableHead>
                  <TableHead>Moyenne</TableHead>
                  <TableHead>±</TableHead>
                  <TableHead>Δ vs live</TableHead>
                  <TableHead>Latence méd.</TableHead>
                  <TableHead>n</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((row) => (
                  <TableRow
                    key={row.label}
                    className="cursor-pointer"
                    onClick={() => setDrill({
                      label: row.label,
                      rows: results.filter((result) => result.config_label === row.label),
                    })}
                  >
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.factor}</TableCell>
                    <TableCell>{row.mean.toFixed(2)}</TableCell>
                    <TableCell>{row.stddev.toFixed(2)}</TableCell>
                    <TableCell className={row.delta > 0 ? "text-emerald-400" : row.delta < 0 ? "text-red-400" : ""}>
                      {row.delta > 0 ? "+" : ""}{row.delta.toFixed(2)}
                    </TableCell>
                    <TableCell>{row.medianLatencyMs == null ? "—" : `${Math.round(row.medianLatencyMs)} ms`}</TableCell>
                    <TableCell>{row.n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {drill ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" /> {drill.label}
            </CardTitle>
            <CardDescription>Trois passages par question. Clique une autre ligne pour changer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {drill.rows.map((row) => {
              const item = items.find((candidate) => candidate.id === row.item_id);
              const judge = row.judge_json as { rationale?: string; overall?: number } | null;
              return (
                <div key={row.id} className="border-b pb-3 text-sm">
                  <p className="font-medium">{item?.question ?? row.item_id} · passage {row.repeat_index}</p>
                  <p className="whitespace-pre-wrap mt-1">{row.max_response || "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    overall {row.overall_score ?? "—"} — {judge?.rationale || row.error_message || ""}
                  </p>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={() => setDrill(null)}>Fermer</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runs précédents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
              <button className="text-left" onClick={() => void loadRun(run)}>
                {new Date(run.created_at).toLocaleString("fr-CH")} · {run.status} · juge {run.judge_model}
              </button>
              {run.status === "paused" || run.status === "failed" ? (
                <Button size="sm" variant="outline" onClick={() => void handleResume(run)} disabled={running}>
                  Reprendre
                </Button>
              ) : null}
            </div>
          ))}
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun run.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
