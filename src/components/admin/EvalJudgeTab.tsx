import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listLlmConfigModels } from "@/services/settingsService";
import {
  EVAL_DEFAULT_JUDGE_MODEL,
  EVAL_REPEATS,
  buildOfatConfigs,
  defaultOfatSelection,
  estimateEvalRun,
  judgeIsolatedEvalTurn,
  listEvalMaxModels,
  listEvalWorkItems,
  resultWorkKey,
  runIsolatedEvalTurn,
  snapshotLiveSettings,
  type EvalItem,
  type EvalResult,
  type EvalRun,
  type EvalTurnConfig,
  type OfatSelection,
} from "@/services/evalJudgePipeline";
import {
  DEFAULT_SCORE_WEIGHTS,
  analyseEvalResults,
  auditEvalCorpus,
  loadScoreWeights,
  saveScoreWeights,
  type EvalScoreWeights,
} from "@/services/evalJudgeScoring";
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
import EvalCorpusPanel from "./evalJudge/EvalCorpusPanel";
import EvalLeversPanel, { type LeverToggles } from "./evalJudge/EvalLeversPanel";
import EvalResultsPanel from "./evalJudge/EvalResultsPanel";
import EvalScoringPanel from "./evalJudge/EvalScoringPanel";

export default function EvalJudgeTab() {
  const [notionId, setNotionId] = useState("");
  const [items, setItems] = useState<EvalItem[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [results, setResults] = useState<EvalResult[]>([]);
  const [activeRun, setActiveRun] = useState<EvalRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [judgeModel, setJudgeModel] = useState(EVAL_DEFAULT_JUDGE_MODEL);
  const [extraModels, setExtraModels] = useState<string[]>([]);
  const extraModelsReady = useRef(false);
  const [weights, setWeights] = useState<EvalScoreWeights>({ ...DEFAULT_SCORE_WEIGHTS });
  const [toggles, setToggles] = useState<LeverToggles>({
    tempZero: true,
    tempHigh: true,
    ragConservative: true,
    ragGenerous: true,
  });
  const [drillLabel, setDrillLabel] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  const live = useMemo(() => snapshotLiveSettings(), []);
  const catalog = useMemo(() => listLlmConfigModels(), []);
  const evalMaxModels = useMemo(() => listEvalMaxModels(live.model), [live.model]);
  const liveCatalogModel = catalog.find((model) => model.id === live.model);
  const ofatDefaults = useMemo(() => defaultOfatSelection(live), [live]);

  useEffect(() => {
    if (extraModelsReady.current) return;
    if (ofatDefaults.extraModels.length === 0) return;
    setExtraModels(ofatDefaults.extraModels);
    extraModelsReady.current = true;
  }, [ofatDefaults.extraModels]);

  const selection: OfatSelection = useMemo(() => ({
    extraModels,
    samplingTemps: [
      ...(toggles.tempZero ? [0] : []),
      ...(toggles.tempHigh ? [0.8] : []),
    ],
    ragVariants: [
      ...(toggles.ragConservative ? ofatDefaults.ragVariants.filter((variant) => variant.key === "conservative") : []),
      ...(toggles.ragGenerous ? ofatDefaults.ragVariants.filter((variant) => variant.key === "generous") : []),
    ],
  }), [extraModels, ofatDefaults.ragVariants, toggles]);

  const configs = useMemo(() => buildOfatConfigs(live, selection), [live, selection]);
  const audit = useMemo(() => auditEvalCorpus(items), [items]);
  const activeItems = useMemo(
    () => {
      const usable = new Set(
        audit.issues.filter((issue) => issue.level !== "error").map((issue) => issue.itemId),
      );
      return items.filter((item) => item.active && usable.has(item.id));
    },
    [audit.issues, items],
  );
  const estimate = useMemo(
    () => estimateEvalRun(activeItems.length, configs, EVAL_REPEATS),
    [activeItems.length, configs],
  );
  const runConfigs = useMemo(() => {
    const stored = (activeRun?.ofat_config as { configs?: EvalTurnConfig[] } | null)?.configs;
    return stored?.length ? stored : configs;
  }, [activeRun, configs]);
  const analysis = useMemo(
    () => analyseEvalResults({ results, items, configs: runConfigs, weights }),
    [items, results, runConfigs, weights],
  );
  const lastSyncAt = useMemo(
    () => items.reduce<string | null>((latest, item) => (
      !latest || item.synced_at > latest ? item.synced_at : latest
    ), null),
    [items],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [id, nextItems, nextRuns, storedWeights] = await Promise.all([
        loadEvalNotionDatabaseId(),
        fetchEvalItems(),
        fetchEvalRuns(),
        loadScoreWeights(),
      ]);
      setNotionId(id);
      setItems(nextItems);
      setRuns(nextRuns);
      setWeights(storedWeights);
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

  async function handleSaveWeights() {
    setSavingWeights(true);
    try {
      await saveScoreWeights(weights);
      toast.success("Poids enregistrés pour cet environnement");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingWeights(false);
    }
  }

  async function handleSync() {
    if (!notionId.trim()) {
      toast.error("Colle l’ID de la base Notion avant d’importer");
      return;
    }
    setSyncing(true);
    try {
      await saveEvalNotionDatabaseId(notionId);
      const report = await syncEvalItemsFromNotion(notionId);
      toast.success(`${report.items_upserted} question(s) importée(s)`);
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

  async function executeRun(run: EvalRun, nextConfigs: EvalTurnConfig[], existing: EvalResult[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    pauseRef.current = false;
    setRunning(true);
    await patchEvalRun(run.id, { status: "running", started_at: run.started_at ?? new Date().toISOString() });
    const done = new Set(existing.map(resultWorkKey));
    const queue = listEvalWorkItems(nextConfigs, activeItems, run.repeats, done);
    let completed = existing.length;
    const acc = [...existing];
    try {
      for (const work of queue) {
        if (pauseRef.current) {
          await patchEvalRun(run.id, { status: "paused", current_index: completed });
          setActiveRun({ ...run, status: "paused", current_index: completed });
          toast.message("Test en pause");
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
      toast.success("Test terminé");
      await reload();
    } catch (error) {
      if (pauseRef.current || (error instanceof DOMException && error.name === "AbortError")) {
        await patchEvalRun(run.id, { status: "paused", current_index: completed });
        setActiveRun({ ...run, status: "paused", current_index: completed });
        toast.message("Test en pause");
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
    if (!audit.readyToRun || activeItems.length === 0) {
      toast.error(audit.blockers[0] ?? "Corpus insuffisant");
      return;
    }
    const currentLive = snapshotLiveSettings();
    const currentConfigs = buildOfatConfigs(currentLive, selection);
    const currentEstimate = estimateEvalRun(activeItems.length, currentConfigs, EVAL_REPEATS);
    if (!window.confirm(`Lancer ${currentEstimate.turns} tours (~${currentEstimate.llmCalls} appels LLM, ~$${currentEstimate.estimatedCostUsd.toFixed(3)}) ?`)) {
      return;
    }
    try {
      const run = await createEvalRun({
        baseline: { ...currentLive, scoreWeights: weights } as typeof currentLive,
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
    const nextConfigs = stored?.length ? stored : configs;
    const existing = await fetchEvalResults(run.id);
    setResults(existing);
    setActiveRun(run);
    await executeRun(run, nextConfigs, existing);
  }

  function handlePause() {
    pauseRef.current = true;
    abortRef.current?.abort();
  }

  function exportRun() {
    const blob = new Blob([JSON.stringify({ run: activeRun, weights, results, analysis }, null, 2)], {
      type: "application/json",
    });
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
          <h2 className="text-lg font-semibold">LLM as judge — banc d’essai des réponses de Max</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Quatre étapes : vérifier le corpus Notion, choisir ce qu’on compare, régler la grille de notation, lire les
            résultats et les recommandations. Chaque question est jouée trois fois, sans mémoire entre les questions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
        </Button>
      </div>

      <EvalCorpusPanel
        notionId={notionId}
        onNotionIdChange={setNotionId}
        onSaveNotionId={() => void handleSaveNotionId()}
        onSync={() => void handleSync()}
        syncing={syncing}
        items={items}
        audit={audit}
        lastSyncAt={lastSyncAt}
      />

      <EvalLeversPanel
        live={live}
        liveModelLabel={liveCatalogModel?.label ?? live.model}
        catalog={catalog}
        evalModels={evalMaxModels}
        extraModels={extraModels}
        onExtraModelsChange={setExtraModels}
        judgeModel={judgeModel}
        onJudgeModelChange={setJudgeModel}
        toggles={toggles}
        onTogglesChange={setToggles}
        estimate={estimate}
        onStart={() => void handleStart()}
        onPause={handlePause}
        onResume={() => activeRun && void handleResume(activeRun)}
        running={running}
        canResume={Boolean(activeRun && (activeRun.status === "paused" || activeRun.status === "failed"))}
        blocked={!audit.readyToRun}
        blockedReason={audit.blockers[0] ?? null}
        progress={progress}
        progressLabel={progressLabel || `${results.length}/${activeRun?.total_turns ?? 0}`}
      />

      <EvalScoringPanel
        weights={weights}
        onChange={setWeights}
        onSave={() => void handleSaveWeights()}
        saving={savingWeights}
      />

      <EvalResultsPanel
        analysis={analysis}
        results={results}
        items={items}
        onExport={exportRun}
        canExport={Boolean(activeRun)}
        drillLabel={drillLabel}
        onDrill={setDrillLabel}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tests précédents</CardTitle>
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
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun test lancé pour l’instant.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
