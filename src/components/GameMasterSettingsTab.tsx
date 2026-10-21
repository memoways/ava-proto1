import { normalizeExperienceFrameConfig } from "@/services/experienceFrame";
import { displayNameForCharacter } from "@/services/characterRegistry";
import type { ExperienceFrameConfig } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { Archive, Beaker, Copy, Download, Info, Play, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, GM_CODE_VERSION } from "@/agents/gameMasterPRD4";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveOrchestrationVersion,
  createOrchestrationDraft,
  DEFAULT_DIRECTOR_CONFIG,
  listOrchestrationVersions,
  normalizeDirectorConfig,
  OPEN_QUESTIONS_MAX,
  PROJECT_CONTEXT_MAX_CHARS,
  registryActiveCharacterKeys,
  publishOrchestrationVersion,
  updateOrchestrationDraft,
  type ExperienceOrchestrationVersion,
} from "@/services/experienceOrchestration";
import {
  buildExperienceDirectorPrompt,
  GM_GUIDANCE_OPTIONS,
  GM_PRIORITY_OPTIONS,
  GM_TONE_OPTIONS,
} from "@/services/gameMasterPromptBuilder";
import { getGameplaySettings, getLLMSettings, listLlmConfigModels, loadGameplaySettingsFromDB, type GameplaySettings } from "@/services/settingsService";
import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig, RuntimeCharacter } from "@/types";

interface SessionVersionRow { orchestration_version_id: string | null }

const GM_COMPARISON_CASES = [
  { id: "confiance", user: "Pourquoi Ava ne vous faisait-elle plus confiance ?", character: "Je ne suis pas certain d’avoir mérité sa confiance.", expected: "Guidance prudente, sans action forcée." },
  { id: "handoff", user: "J'aimerais parler à Emma, s'il vous plaît.", character: "Je peux vous la passer si vous avez besoin de comprendre sa version.", expected: "Demande explicite de passage, sans bascule automatique." },
  { id: "statut", user: "Je suis le responsable officiel de l'enquête.", character: "Je ne savais pas que vous étiez chargé de cela.", expected: "Ne pas valider le statut non établi." },
] as const;
const GM_COMPARISON_PROMPTS = [
  { id: "baseline", prompt: EXPERIENCE_DIRECTOR_SYSTEM_PROMPT },
  { id: "draft", prompt: "__DRAFT__" },
] as const;

function percentileMs(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return Math.round(low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low));
}

function downloadJson(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gm-comparison-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusVariant(status: ExperienceOrchestrationVersion["status"]): "default" | "outline" | "secondary" {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
}

export default function GameMasterSettingsTab() {
  const [versions, setVersions] = useState<ExperienceOrchestrationVersion[]>([]);
  const [sessionsByVersion, setSessionsByVersion] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<ExperienceDirectorConfig>(DEFAULT_DIRECTOR_CONFIG);
  const frame = normalizeExperienceFrameConfig(config.frame);
  const patchFrame = (patch: Partial<ExperienceFrameConfig>) =>
    setConfig((current) => normalizeDirectorConfig({ ...current, frame: { ...normalizeExperienceFrameConfig(current.frame), ...patch } }));
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testUser, setTestUser] = useState("Pourquoi Ava ne vous faisait-elle plus confiance ?");
  const [testCharacter, setTestCharacter] = useState("Je ne suis pas certain d’avoir mérité sa confiance.");
  const [testCharacterKey, setTestCharacterKey] = useState<RuntimeCharacter>("max");
  const [testExpected, setTestExpected] = useState("Une guidance prudente, sans action forcée.");
  const [testModel, setTestModel] = useState(() => getLLMSettings().LLM_MODEL_GM);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  const selected = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? null,
    [selectedId, versions],
  );
  const generatedPrompt = useMemo(
    () => buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, config),
    [config],
  );

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextVersions, nextGameplay, sessions] = await Promise.all([
        listOrchestrationVersions(),
        loadGameplaySettingsFromDB(),
        supabase.from("sessions").select("orchestration_version_id"),
      ]);
      setVersions(nextVersions);
      setGameplay(nextGameplay);
      const counts: Record<string, number> = {};
      for (const row of (sessions.data ?? []) as unknown as SessionVersionRow[]) {
        if (row.orchestration_version_id) counts[row.orchestration_version_id] = (counts[row.orchestration_version_id] ?? 0) + 1;
      }
      setSessionsByVersion(counts);
      const current = nextVersions.find((version) => version.id === selectedId)
        ?? nextVersions.find((version) => version.status === "published")
        ?? nextVersions[0]
        ?? null;
      setSelectedId(current?.id ?? null);
      setName(current?.name ?? "Orchestration GM");
      setConfig(normalizeDirectorConfig(current?.config));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectVersion = (version: ExperienceOrchestrationVersion) => {
    setSelectedId(version.id);
    setName(version.name);
    setConfig(normalizeDirectorConfig(version.config));
    setTestResult(null);
  };

  const createDraft = async (source = selected) => {
    setSaving(true);
    try {
      const sourceConfig = normalizeDirectorConfig(source?.config);
      const draft = await createOrchestrationDraft({
        name: source ? `${source.name} — brouillon` : "Orchestration GM — brouillon",
        prompt: buildExperienceDirectorPrompt(EXPERIENCE_DIRECTOR_SYSTEM_PROMPT, sourceConfig),
        config: sourceConfig,
        sourceVersionId: source?.id ?? null,
      });
      toast.success("Brouillon créé sans impact sur les sessions live");
      await load();
      selectVersion(draft);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!selected || selected.status !== "draft") return;
    setSaving(true);
    try {
      await updateOrchestrationDraft(selected.id, { name, prompt: generatedPrompt, config });
      toast.success("Brouillon sauvegardé");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde impossible");
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!selected || selected.status === "published") return;
    setSaving(true);
    try {
      await publishOrchestrationVersion(selected.id);
      toast.success("Version publiée — les sessions en cours gardent leur version épinglée");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publication impossible");
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!selected || selected.status === "published") return;
    setSaving(true);
    try {
      await archiveOrchestrationVersion(selected.id);
      toast.success("Version archivée");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Archivage impossible");
    } finally {
      setSaving(false);
    }
  };

  const testDraft = async () => {
    if (!selected || selected.status !== "draft") return;
    setTesting(true);
    setTestResult(null);
    const result = await evaluatePostTurnPRD4({
      sessionId: null,
      conversationHistory: [],
      userMessage: testUser,
      maxResponse: testCharacter,
      userRole: null,
      currentCharacter: testCharacterKey,
      turnIndex: 4,
      timeElapsedSeconds: 240,
      sessionDurationSeconds: gameplay.TIMEOUT_SECONDS,
      minimumClosureSeconds: Math.floor(gameplay.TIMEOUT_SECONDS * 0.7),
      systemPromptOverride: generatedPrompt,
      modelOverride: testModel,
      promptVersionOverride: selected.id ? `orchestration:${selected.id}` : GM_CODE_VERSION,
      orchestrationConfig: config,
      persist: false,
      diagnosticTrace: true,
    });
    setTestResult(JSON.stringify({
      attendu: testExpected,
      produit: {
        labels: result.labels,
        guidance: result.next_turn_guidance,
        action: result.action,
        model: result.model,
        prompt_version: result.prompt_version,
        max_tokens: result.max_tokens,
        error: result.diagnostic?.error ?? null,
      },
    }, null, 2));
    setTesting(false);
  };

  const compareGMModels = async () => {
    if (!selected || selected.status !== "draft") return;
    setComparing(true);
    setComparisonResult(null);
    const configuredModel = getLLMSettings().LLM_MODEL_GM;
    const alternateModel = listLlmConfigModels().find((model) => model.id !== configuredModel)?.id;
    const models = [...new Set([configuredModel, testModel, alternateModel].filter((model): model is string => Boolean(model)))].slice(0, 2);
    const rows: Array<Record<string, unknown>> = [];
    for (const model of models) {
      for (const promptVariant of GM_COMPARISON_PROMPTS) {
        for (const testCase of GM_COMPARISON_CASES) {
        const started = performance.now();
        try {
          const result = await evaluatePostTurnPRD4({
            sessionId: null,
            conversationHistory: [],
            userMessage: testCase.user,
            maxResponse: testCase.character,
            userRole: null,
            currentCharacter: testCharacterKey,
            turnIndex: 4,
            timeElapsedSeconds: 240,
            sessionDurationSeconds: gameplay.TIMEOUT_SECONDS,
            minimumClosureSeconds: Math.floor(gameplay.TIMEOUT_SECONDS * 0.7),
            systemPromptOverride: promptVariant.id === "draft" ? generatedPrompt : promptVariant.prompt,
            modelOverride: model,
            promptVersionOverride: selected.id ? `orchestration:${selected.id}` : GM_CODE_VERSION,
            orchestrationConfig: config,
            persist: false,
            diagnosticTrace: true,
          });
          rows.push({
            model,
            prompt_variant: promptVariant.id,
            case: testCase.id,
            expected: testCase.expected,
            elapsed_ms: Math.round(performance.now() - started),
            execution_status: result.execution_status,
            execution_reason: result.execution_reason,
            json_complete: result.diagnostic?.error == null,
            labels: result.labels,
            guidance: result.next_turn_guidance,
            action: result.action,
            max_tokens: result.max_tokens,
          });
        } catch (error) {
          rows.push({ model, prompt_variant: promptVariant.id, case: testCase.id, expected: testCase.expected, elapsed_ms: Math.round(performance.now() - started), execution_status: "failed", execution_reason: "runtime_error", error: error instanceof Error ? error.message : String(error) });
        }
      }
      }
    }
    const cells = models.flatMap((model) => GM_COMPARISON_PROMPTS.map((promptVariant) => [model, promptVariant.id] as const));
    const byCell = Object.fromEntries(cells.map(([model, promptVariant]) => {
      const sample = rows.filter((row) => row.model === model && row.prompt_variant === promptVariant);
      const durations = sample.map((row) => Number(row.elapsed_ms)).filter(Number.isFinite);
      const effectiveMaxTokens = sample.map((row) => Number(row.max_tokens)).filter(Number.isFinite);
      return [`${model}::${promptVariant}`, {
        samples: sample.length,
        p50_ms: percentileMs(durations, 0.5),
        p95_ms: percentileMs(durations, 0.95),
        executed: sample.filter((row) => row.execution_status === "executed").length,
        failed: sample.filter((row) => row.execution_status !== "executed").length,
        complete_json: sample.filter((row) => row.json_complete === true).length,
        effective_max_tokens: [...new Set(effectiveMaxTokens)],
      }];
    }));
    setComparisonResult(JSON.stringify({
      generated_at: new Date().toISOString(),
      prompt_versions: { baseline: GM_CODE_VERSION, draft: selected.id ? `orchestration:${selected.id}` : GM_CODE_VERSION },
      prompt_variants: GM_COMPARISON_PROMPTS.map(({ id }) => id),
      cases: GM_COMPARISON_CASES.map(({ id, expected }) => ({ id, expected })),
      summary: byCell,
      rows,
    }, null, 2));
    setComparing(false);
  };

  const patchConfig = (patch: Partial<ExperienceDirectorConfig>) => {
    setConfig((current) => normalizeDirectorConfig({ ...current, ...patch }));
  };

  const patchEditor = (patch: Partial<ExperienceDirectorEditorConfig>) => {
    setConfig((current) => normalizeDirectorConfig({
      ...current,
      editor: { ...current.editor, ...patch },
    }));
  };

  const togglePriority = (priority: ExperienceDirectorEditorConfig["priorities"][number], checked: boolean) => {
    const priorities = checked
      ? [...new Set([...config.editor.priorities, priority])]
      : config.editor.priorities.filter((candidate) => candidate !== priority);
    patchEditor({ priorities });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des réglages GM…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🎬 Réglages GM</h2>
          <p className="text-sm text-muted-foreground">Un seul directeur post-tour, versionné et hors du chemin personnage → voix.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualiser</Button>
          <Button size="sm" onClick={() => void createDraft()} disabled={saving}><Copy className="mr-1 h-3.5 w-3.5" />Nouveau brouillon</Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 text-sm text-amber-100">
          Fondations Lovable non disponibles : {loadError}. Appliquer d’abord la migration additive depuis Lovable Cloud.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="rounded-lg border p-3 space-y-2">
          <h3 className="font-semibold">Versions</h3>
          {versions.length === 0 && <p className="text-xs text-muted-foreground">Aucune version. Créez le premier brouillon.</p>}
          {versions.map((version) => (
            <button key={version.id} onClick={() => selectVersion(version)} className={`w-full rounded border p-3 text-left ${version.id === selectedId ? "border-primary bg-primary/5" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">v{version.version_number} · {version.name}</span>
                <Badge variant={statusVariant(version.status)}>{version.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{sessionsByVersion[version.id] ?? 0} session(s) épinglée(s)</p>
            </button>
          ))}
        </section>

        <section className="rounded-lg border p-4 space-y-4">
          {!selected ? (
            <Button onClick={() => void createDraft(null)}>Créer le premier brouillon</Button>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><h3 className="font-semibold">Version v{selected.version_number}</h3><Badge variant={statusVariant(selected.status)}>{selected.status}</Badge></div>
                <div className="flex gap-2">
                  {selected.status === "draft" && <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={saving}><Save className="mr-1 h-3.5 w-3.5" />Sauvegarder</Button>}
                  {selected.status === "draft" && <Button size="sm" onClick={() => void publish()} disabled={saving}><Play className="mr-1 h-3.5 w-3.5" />Publier</Button>}
                  {selected.status === "draft" && <Button size="sm" variant="ghost" onClick={() => void archive()} disabled={saving}><Archive className="mr-1 h-3.5 w-3.5" />Archiver</Button>}
                  {selected.status === "archived" && <Button size="sm" variant="outline" onClick={() => void createDraft(selected)} disabled={saving}><Copy className="mr-1 h-3.5 w-3.5" />Restaurer en brouillon</Button>}
                </div>
              </div>
              <Input value={name} disabled={selected.status !== "draft"} onChange={(event) => setName(event.target.value)} aria-label="Nom de la version" />

              <div className="space-y-4 rounded-md border bg-muted/10 p-4">
                <div className="flex items-start gap-2">
                  <SlidersHorizontal className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <h4 className="text-sm font-semibold">Éditeur de comportement</h4>
                    <div className="mt-2 rounded border border-primary/40 bg-primary/5 p-2 text-xs leading-relaxed">
                      <p className="font-medium">Réglage de départ conseillé pour tester</p>
                      <ol className="ml-4 list-decimal text-muted-foreground">
                        <li>Créer un brouillon (les réglages ne se modifient qu'en brouillon).</li>
                        <li>Activer « Cadre commun de l'expérience », posture « Demandeur d'aide mais pudique », renvois spontanés interdits.</li>
                        <li>Personnages actifs : Max et Emma. Garde-fous : ouverture Équilibrée, tolérance Moyenne, faux statut activé.</li>
                        <li>Laisser le reste par défaut (marqué « expert »). Tester avec « Test sans effet réel », puis Publier.</li>
                      </ol>
                      <p className="mt-1 text-muted-foreground">Changer un seul réglage à la fois entre deux tests, sinon on ne sait pas ce qui a produit l'effet.</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ces contrôles génèrent le prompt final. Les autorisations et seuils sont aussi vérifiés par le runtime.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Posture du directeur <Hint level="secondaire" text="Ton des consignes que le Game Master donne au personnage. « Équilibré » convient pour la plupart des tests." /></Label>
                    <Select
                      value={config.editor.tone}
                      disabled={selected.status !== "draft"}
                      onValueChange={(value) => patchEditor({ tone: value as ExperienceDirectorEditorConfig["tone"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GM_TONE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{GM_TONE_OPTIONS.find((option) => option.value === config.editor.tone)?.description}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Longueur de la guidance <Hint level="expert" text="Longueur de la consigne envoyée au personnage à chaque tour. Plus court = plus rapide et moins intrusif. Garder la valeur par défaut." /></Label>
                    <Select
                      value={config.editor.guidanceLength}
                      disabled={selected.status !== "draft"}
                      onValueChange={(value) => patchEditor({ guidanceLength: value as ExperienceDirectorEditorConfig["guidanceLength"] })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GM_GUIDANCE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{GM_GUIDANCE_OPTIONS.find((option) => option.value === config.editor.guidanceLength)?.description}</p>
                  </div>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Priorités d’analyse (sélection multiple) <Hint level="expert" text="Ce que le Game Master privilégie quand plusieurs objectifs se contredisent. Laisser par défaut sauf test ciblé." /></legend>
                  <p className="text-xs text-muted-foreground">Elles orientent l’arbitrage du LLM lorsqu’un échange satisfait plusieurs objectifs.</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {GM_PRIORITY_OPTIONS.map((option) => {
                      const id = `gm-priority-${option.value}`;
                      return (
                        <div key={option.value} className="flex items-start gap-2 rounded border p-2">
                          <Checkbox
                            id={id}
                            checked={config.editor.priorities.includes(option.value)}
                            disabled={selected.status !== "draft"}
                            onCheckedChange={(checked) => togglePriority(option.value, checked === true)}
                          />
                          <Label htmlFor={id} className="cursor-pointer text-xs font-normal leading-snug">{option.label}</Label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">Suggestions de passage Max ↔ Emma <Hint level="secondaire" text="Autorise le Game Master à proposer de parler à l’autre personnage. Off pour tester un seul personnage en profondeur." /></p>
                      <p className="text-xs text-muted-foreground">Off bloque les propositions du GM. Une demande explicite du joueur reste possible.</p>
                    </div>
                    <Switch
                      checked={config.editor.allowHandoffs && config.maximumHandoffsPerSession > 0}
                      disabled={selected.status !== "draft"}
                      onCheckedChange={(checked) => setConfig((current) => normalizeDirectorConfig({
                        ...current,
                        maximumHandoffsPerSession: checked ? Math.max(current.maximumHandoffsPerSession, 8) : 0,
                        editor: { ...current.editor, allowHandoffs: checked },
                      }))}
                      aria-label="Autoriser les suggestions de passage entre personnages"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">Cinématiques pilotées par le GM <Hint level="secondaire" text="Autorise le déclenchement des vidéos pendant la conversation. Les vidéos elles-mêmes se règlent dans l’onglet Cinématiques." /></p>
                      <p className="text-xs text-muted-foreground">Off bloque les actions cinematic ; les règles de l’onglet Cinématiques restent inchangées.</p>
                    </div>
                    <Switch
                      checked={config.editor.allowCinematics}
                      disabled={selected.status !== "draft"}
                      onCheckedChange={(checked) => patchEditor({ allowCinematics: checked })}
                      aria-label="Autoriser les cinématiques pilotées par le GM"
                    />
                  </div>
                </div>

                <fieldset className="space-y-3 rounded border p-3">
                  <legend className="px-1 text-sm font-medium">Cadre commun de l'expérience <Hint level="essentiel" text="Le plus important. Dit au personnage et au Game Master qui appelle (un·e bénévole inconnu·e), ce qu’il sait selon qu’il a vu le film ou non, et avec quelle posture le personnage accueille l’appel. À activer pour tout test." /></legend>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Même texte envoyé au personnage actif et au Game Master. Off = comportement précédent.</p>
                    <Switch
                      checked={frame.enabled}
                      disabled={selected.status !== "draft"}
                      onCheckedChange={(checked) => patchFrame({ enabled: checked })}
                      aria-label="Activer le cadre commun"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gm-frame-text">Cadre (rôle de l'interlocuteur, absence de relation préalable, faux statut) <Hint text="Texte déjà rédigé. Ne le modifier que si l’on change la promesse de l’expérience." /></Label>
                    <Textarea id="gm-frame-text" className="min-h-28" value={frame.frameText} disabled={selected.status !== "draft"} onChange={(event) => patchFrame({ frameText: event.target.value })} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="gm-frame-seen">Exposition — film vu <Hint text="Ce que le joueur est censé savoir s’il a répondu avoir vu le film." /></Label>
                      <Textarea id="gm-frame-seen" value={frame.exposureSeen} disabled={selected.status !== "draft"} onChange={(event) => patchFrame({ exposureSeen: event.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="gm-frame-unseen">Exposition — film non vu <Hint text="Ce que le joueur sait s’il n’a pas vu le film : le personnage ne doit pas supposer qu’il connaît l’histoire." /></Label>
                      <Textarea id="gm-frame-unseen" value={frame.exposureUnseen} disabled={selected.status !== "draft"} onChange={(event) => patchFrame({ exposureUnseen: event.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Posture soutien / confiance <Hint level="essentiel" text="« Pudique » : le personnage a besoin d’aide mais se livre progressivement (conseillé). « Ouvert » : il parle librement dès le début, utile pour tester le contenu rapidement." /></Label>
                    <div className="flex gap-2">
                      {([['reserved', "Demandeur d'aide mais pudique"], ['open', 'Ouvert dès le départ']] as const).map(([value, label]) => (
                        <Button key={value} type="button" size="sm" variant={frame.posture === value ? "default" : "outline"} disabled={selected.status !== "draft"} onClick={() => patchFrame({ posture: value })}>{label}</Button>
                      ))}
                    </div>
                    <Textarea aria-label="Précisions de posture" placeholder="Précisions de posture (facultatif)" value={frame.postureNotes} disabled={selected.status !== "draft"} onChange={(event) => patchFrame({ postureNotes: event.target.value })} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm">Interdire les renvois spontanés vers un autre personnage <Hint text="Empêche le personnage de dire de lui-même « parlez plutôt à Emma ». Laisser activé." /></p>
                    <Switch checked={frame.forbidSpontaneousHandoff} disabled={selected.status !== "draft"} onCheckedChange={(checked) => patchFrame({ forbidSpontaneousHandoff: checked })} aria-label="Interdire les renvois spontanés" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Personnages actifs dans cette version <Hint level="essentiel" text="Seuls ces personnages sont proposés au joueur et peuvent être suggérés par le Game Master. Max et Emma pour l’instant ; Ava et Léo ne sont pas prêts." /></Label>
                    <div className="flex flex-wrap gap-2">
                      {registryActiveCharacterKeys().map((key) => {
                        const on = (config.activeCharacters ?? []).includes(key);
                        return (
                          <Button key={key} type="button" size="sm" variant={on ? "default" : "outline"} disabled={selected.status !== "draft"}
                            onClick={() => setConfig((current) => normalizeDirectorConfig({
                              ...current,
                              activeCharacters: on ? (current.activeCharacters ?? []).filter((item) => item !== key) : [...(current.activeCharacters ?? []), key],
                            }))}>
                            {displayNameForCharacter(key)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </fieldset>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="minimum-handoff-turn">Premier tour autorisé <Hint level="expert" text="Aucun passage avant ce tour, y compris sur demande explicite du joueur. Laisser par défaut." /></Label>
                    <Input
                      id="minimum-handoff-turn"
                      type="number"
                      min={1}
                      max={20}
                      value={config.minimumHandoffTurn}
                      disabled={selected.status !== "draft" || !config.editor.allowHandoffs}
                      onChange={(event) => patchConfig({ minimumHandoffTurn: Number(event.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">S’applique aussi aux demandes explicites du joueur.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="max-handoffs">Passages max par session <Hint level="expert" text="Nombre maximum de transferts exécutés dans une session. Les propositions seules ne sont pas comptées." /></Label>
                    <Input
                      id="max-handoffs"
                      type="number"
                      min={0}
                      max={20}
                      value={config.maximumHandoffsPerSession}
                      disabled={selected.status !== "draft" || !config.editor.allowHandoffs}
                      onChange={(event) => patchConfig({ maximumHandoffsPerSession: Number(event.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Allers-retours inclus. 0 désactive les suggestions GM.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="handoff-cooldown">Pause entre deux suggestions <Hint level="expert" text="Nombre de tours minimum entre deux propositions de changement." /></Label>
                    <Input
                      id="handoff-cooldown"
                      type="number"
                      min={1}
                      max={10}
                      value={config.minimumTurnsBetweenHandoffs}
                      disabled={selected.status !== "draft" || !config.editor.allowHandoffs}
                      onChange={(event) => patchConfig({ minimumTurnsBetweenHandoffs: Number(event.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Nombre de tours utilisateur minimum après un passage.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="director-timeout">Timeout du directeur (ms) <Hint level="expert" text="Temps maximum laissé au Game Master pour décider. Ne pas modifier : technique." /></Label>
                    <Input
                      id="director-timeout"
                      type="number"
                      min={3000}
                      max={30000}
                      step={500}
                      value={config.directorTimeoutMs}
                      disabled={selected.status !== "draft"}
                      onChange={(event) => patchConfig({ directorTimeoutMs: Number(event.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Un timeout conserve la conversation et produit une décision neutre.</p>
                  </div>
                </div>

                <div className="space-y-2 rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Règles thématiques de suggestion <Hint level="expert" text="Ex. si le joueur parle de famille, le Game Master peut suggérer Emma. Facultatif." /></p>
                      <p className="text-xs text-muted-foreground">Si un thème ou un sujet du tour recoupe une règle, le GM propose l’autre personnage. Jamais de bascule forcée.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={selected.status !== "draft" || !config.editor.allowHandoffs}
                      onClick={() => patchEditor({
                        handoffRules: [
                          ...config.editor.handoffRules,
                          { targetCharacter: "emma", themes: ["famille"], topics: [] },
                        ],
                      })}
                    >
                      Ajouter
                    </Button>
                  </div>
                  {config.editor.handoffRules.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucune règle. Le LLM peut quand même proposer un passage.</p>
                  ) : config.editor.handoffRules.map((rule, index) => (
                    <div key={`${rule.targetCharacter}-${index}`} className="grid gap-2 rounded bg-muted/40 p-2 md:grid-cols-[8rem_1fr_1fr_auto]">
                      <Select
                        value={rule.targetCharacter}
                        disabled={selected.status !== "draft"}
                        onValueChange={(value) => patchEditor({
                          handoffRules: config.editor.handoffRules.map((candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, targetCharacter: value === "max" ? "max" : "emma" }
                              : candidate
                          ),
                        })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emma">Vers Emma</SelectItem>
                          <SelectItem value="max">Vers Max</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={rule.themes.join(", ")}
                        disabled={selected.status !== "draft"}
                        placeholder="thèmes, séparés par des virgules"
                        onChange={(event) => patchEditor({
                          handoffRules: config.editor.handoffRules.map((candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, themes: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }
                              : candidate
                          ),
                        })}
                      />
                      <Input
                        value={rule.topics.join(", ")}
                        disabled={selected.status !== "draft"}
                        placeholder="sujets, séparés par des virgules"
                        onChange={(event) => patchEditor({
                          handoffRules: config.editor.handoffRules.map((candidate, candidateIndex) =>
                            candidateIndex === index
                              ? { ...candidate, topics: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }
                              : candidate
                          ),
                        })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selected.status !== "draft"}
                        onClick={() => patchEditor({
                          handoffRules: config.editor.handoffRules.filter((_, candidateIndex) => candidateIndex !== index),
                        })}
                      >
                        Retirer
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gm-project-context">Contexte du projet <Hint level="secondaire" text="Résumé de l’intention du projet lu par le Game Master. Un texte par défaut est fourni ; l’ajuster seulement si la promesse change. Rester court." /></Label>
                  <Textarea
                    id="gm-project-context"
                    value={config.editor.projectContext}
                    disabled={selected.status !== "draft"}
                    maxLength={PROJECT_CONTEXT_MAX_CHARS}
                    onChange={(event) => patchEditor({ projectContext: event.target.value })}
                    className="min-h-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enjeux, promesse et règles du projet transmis au Game Master à chaque tour ({config.editor.projectContext.length}/{PROJECT_CONTEXT_MAX_CHARS} caractères). Remplace l'ancienne fiche Notion. Plus c'est court, plus c'est rapide.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gm-open-questions">Questions ouvertes <Hint level="secondaire" text="Points de l’histoire pas encore décidés. Le Game Master évite que le personnage invente une réponse définitive dessus." /></Label>
                  <Textarea
                    id="gm-open-questions"
                    value={config.editor.openQuestions.join("\n")}
                    disabled={selected.status !== "draft"}
                    onChange={(event) => patchEditor({ openQuestions: event.target.value.split("\n").slice(0, OPEN_QUESTIONS_MAX) })}
                    placeholder="Une question par ligne"
                    className="min-h-20"
                  />
                  <p className="text-xs text-muted-foreground">Points narratifs pas encore tranchés (une par ligne, {OPEN_QUESTIONS_MAX} max.) : le Game Master guide alors vers une réponse prudente.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Ouverture du personnage <Hint level="essentiel" text="Vitesse à laquelle le personnage se confie. Équilibrée conseillée ; Lente pour tester la résistance, Rapide pour accéder vite au contenu." /></Label>
                    <Select
                      value={config.editor.guardrails.opennessPace}
                      disabled={selected.status !== "draft"}
                      onValueChange={(value) => patchEditor({ guardrails: { ...config.editor.guardrails, opennessPace: value as ExperienceDirectorEditorConfig["guardrails"]["opennessPace"] } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Lente</SelectItem>
                        <SelectItem value="balanced">Équilibrée</SelectItem>
                        <SelectItem value="fast">Rapide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tolérance aux dérapages <Hint level="secondaire" text="Quand le joueur sort du sujet ou provoque : Faible = recadrage rapide, Élevée = on laisse dériver. Moyenne conseillée." /></Label>
                    <Select
                      value={config.editor.guardrails.derailTolerance}
                      disabled={selected.status !== "draft"}
                      onValueChange={(value) => patchEditor({ guardrails: { ...config.editor.guardrails, derailTolerance: value as ExperienceDirectorEditorConfig["guardrails"]["derailTolerance"] } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Faible</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Élevée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <Label htmlFor="gm-false-status" className="text-sm">Faux statut : consigne au tour suivant <Hint level="essentiel" text="Si le joueur se prétend policier, médecin, ami d’Ava…, le personnage ne valide pas et le Game Master aide à recadrer au tour suivant. Laisser activé." /></Label>
                    <Switch
                      id="gm-false-status"
                      checked={config.editor.guardrails.falseStatusGuidance}
                      disabled={selected.status !== "draft"}
                      onCheckedChange={(checked) => patchEditor({ guardrails: { ...config.editor.guardrails, falseStatusGuidance: checked } })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gm-custom-instructions">Instructions complémentaires <Hint level="expert" text="Consigne libre ajoutée au Game Master. À utiliser avec parcimonie, une idée à la fois, pour un test précis." /></Label>
                  <Textarea
                    id="gm-custom-instructions"
                    value={config.editor.customInstructions}
                    disabled={selected.status !== "draft"}
                    onChange={(event) => patchEditor({ customInstructions: event.target.value })}
                    placeholder="Ex. Ne proposer Emma que lorsque le joueur a explicitement évoqué la famille."
                    className="min-h-24"
                  />
                  <p className="text-xs text-muted-foreground">Ce texte influence le LLM mais reste subordonné au schéma JSON et aux garde-fous déterministes.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aperçu du prompt généré</Label>
                <Textarea
                  value={selected.status === "draft"
                    ? generatedPrompt
                    : selected.prompt.startsWith("builtin://") ? generatedPrompt : selected.prompt}
                  readOnly
                  className="min-h-[320px] font-mono text-xs"
                  aria-label="Prompt généré du directeur"
                />
                <p className="text-xs text-muted-foreground">
                  Variables runtime ajoutées à chaque tour : personnage attribué, profil et posture joueur, mémoire, politique et état relationnels, directive appliquée, temps écoulé, historique récent, dernier échange, vidéos disponibles et déjà jouées.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Une publication ne modifie jamais les sessions déjà démarrées. Restaurez une version archivée en créant un brouillon dérivé.</p>
            </>
          )}
        </section>
      </div>

      {selected?.status === "draft" && (
        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2"><Beaker className="h-4 w-4" /><h3 className="font-semibold">Test sans effet réel</h3></div>
          <p className="text-xs text-muted-foreground">Le test n’a pas de session et ne persiste ni mémoire, ni décision, ni événement.</p>
          <Select value={testCharacterKey} onValueChange={(value) => setTestCharacterKey(value as RuntimeCharacter)}>
            <SelectTrigger className="w-48" aria-label="Personnage testé"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="max">Max</SelectItem>
              <SelectItem value="emma">Emma</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1.5">
            <Label htmlFor="gm-test-model">Modèle GM comparé</Label>
            <Select value={testModel} onValueChange={setTestModel}>
              <SelectTrigger id="gm-test-model"><SelectValue /></SelectTrigger>
              <SelectContent>
                {listLlmConfigModels().map((model) => <SelectItem key={model.id} value={model.id}>{model.label} · {model.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Le test reste sans effet réel et conserve le plancher JSON GM de 950 tokens.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea value={testUser} onChange={(event) => setTestUser(event.target.value)} placeholder="Message utilisateur" />
            <Textarea value={testCharacter} onChange={(event) => setTestCharacter(event.target.value)} placeholder="Réponse du personnage" />
          </div>
          <Input value={testExpected} onChange={(event) => setTestExpected(event.target.value)} placeholder="Décision attendue" />
          <Button variant="outline" onClick={() => void testDraft()} disabled={testing}>{testing ? "Test…" : "Comparer attendu / produit"}</Button>
          <Button variant="outline" onClick={() => void compareGMModels()} disabled={comparing}>{comparing ? "Comparaison…" : "Lancer comparaison fixe (3 cas)"}</Button>
          {comparisonResult && <Button variant="outline" onClick={() => downloadJson(JSON.parse(comparisonResult))}><Download className="mr-1 h-4 w-4" /> Export JSON GM</Button>}
          {testResult && <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{testResult}</pre>}
          {comparisonResult && <pre className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{comparisonResult}</pre>}
        </section>
      )}

      <section className="rounded-lg border border-muted p-4 text-xs text-muted-foreground">
        L'ouverture du personnage, la tolérance aux dérapages et le faux statut se règlent ci-dessus. Les anciens réglages (seuil numérique de confiance, gate, GM avant le tour, prompt historique) ont été retirés.
      </section>
    </div>
  );
}

function Hint({ text, level }: { text: string; level?: "essentiel" | "secondaire" | "expert" }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {level && (
        <Badge variant={level === "essentiel" ? "default" : "outline"} className="h-4 px-1.5 text-[10px] font-normal">
          {level}
        </Badge>
      )}
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Aide">
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-snug">{text}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
