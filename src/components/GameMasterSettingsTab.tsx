import { useEffect, useMemo, useState } from "react";
import { Archive, Beaker, Copy, Play, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "@/agents/gameMasterPRD4";
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
import { getGameplaySettings, loadGameplaySettingsFromDB, type GameplaySettings } from "@/services/settingsService";
import type { ExperienceDirectorConfig, ExperienceDirectorEditorConfig } from "@/types";

interface SessionVersionRow { orchestration_version_id: string | null }

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
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testUser, setTestUser] = useState("Pourquoi Ava ne vous faisait-elle plus confiance ?");
  const [testCharacter, setTestCharacter] = useState("Je ne suis pas certain d’avoir mérité sa confiance.");
  const [testExpected, setTestExpected] = useState("Une guidance prudente, sans action forcée.");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

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
      turnIndex: 4,
      timeElapsedSeconds: 240,
      sessionDurationSeconds: gameplay.TIMEOUT_SECONDS,
      minimumClosureSeconds: Math.floor(gameplay.TIMEOUT_SECONDS * 0.7),
      systemPromptOverride: generatedPrompt,
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
        error: result.diagnostic?.error ?? null,
      },
    }, null, 2));
    setTesting(false);
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
          <p className="text-sm text-muted-foreground">Un seul directeur post-tour, versionné et hors du chemin Max → voix.</p>
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
                    <p className="text-xs text-muted-foreground">
                      Ces contrôles génèrent le prompt final. Les autorisations et seuils sont aussi vérifiés par le runtime.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Posture du directeur</Label>
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
                    <Label>Longueur de la guidance</Label>
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
                  <legend className="text-sm font-medium">Priorités d’analyse (sélection multiple)</legend>
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
                      <p className="text-sm font-medium">Handoff vers Emma</p>
                      <p className="text-xs text-muted-foreground">Off bloque toute proposition, même si le LLM en produit une.</p>
                    </div>
                    <Switch
                      checked={config.editor.allowHandoffs && config.maximumHandoffsPerSession > 0}
                      disabled={selected.status !== "draft"}
                      onCheckedChange={(checked) => setConfig((current) => normalizeDirectorConfig({
                        ...current,
                        maximumHandoffsPerSession: checked ? 1 : 0,
                        editor: { ...current.editor, allowHandoffs: checked },
                      }))}
                      aria-label="Autoriser les handoffs vers Emma"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded border p-3">
                    <div>
                      <p className="text-sm font-medium">Cinématiques pilotées par le GM</p>
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="minimum-handoff-turn">Premier tour autorisé pour le handoff</Label>
                    <Input
                      id="minimum-handoff-turn"
                      type="number"
                      min={1}
                      max={20}
                      value={config.minimumHandoffTurn}
                      disabled={selected.status !== "draft" || !config.editor.allowHandoffs}
                      onChange={(event) => patchConfig({ minimumHandoffTurn: Number(event.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">Avant ce tour, toute recommandation de handoff est rejetée par le runtime.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="director-timeout">Timeout du directeur (ms)</Label>
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

                <div className="space-y-1.5">
                  <Label htmlFor="gm-custom-instructions">Instructions complémentaires</Label>
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
                  Variables runtime ajoutées à chaque tour : profil et posture joueur, mémoire, temps écoulé, historique récent, dernier échange, vidéos disponibles et déjà jouées.
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
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea value={testUser} onChange={(event) => setTestUser(event.target.value)} placeholder="Message utilisateur" />
            <Textarea value={testCharacter} onChange={(event) => setTestCharacter(event.target.value)} placeholder="Réponse de Max" />
          </div>
          <Input value={testExpected} onChange={(event) => setTestExpected(event.target.value)} placeholder="Décision attendue" />
          <Button variant="outline" onClick={() => void testDraft()} disabled={testing}>{testing ? "Test…" : "Comparer attendu / produit"}</Button>
          {testResult && <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs whitespace-pre-wrap">{testResult}</pre>}
        </section>
      )}

      <section className="rounded-lg border border-muted p-4 text-xs text-muted-foreground">
        Les anciens seuils de confiance, tolérance aux insultes, gate, placeholder vidéo, modes de parole, prompt historique et GM pré-tour restent conservés en données legacy mais ne sont plus présentés comme actifs dans PRD4.
      </section>
    </div>
  );
}
