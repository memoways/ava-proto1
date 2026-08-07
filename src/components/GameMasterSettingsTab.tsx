import { useEffect, useMemo, useState } from "react";
import { Archive, Beaker, Copy, Play, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "@/agents/gameMasterPRD4";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveOrchestrationVersion,
  createOrchestrationDraft,
  DEFAULT_DIRECTOR_CONFIG,
  listOrchestrationVersions,
  publishOrchestrationVersion,
  updateOrchestrationDraft,
  type ExperienceOrchestrationVersion,
} from "@/services/experienceOrchestration";
import { getGameplaySettings, loadGameplaySettingsFromDB, type GameplaySettings } from "@/services/settingsService";

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
  const [prompt, setPrompt] = useState("");
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
      setPrompt(current?.prompt?.startsWith("builtin://") ? EXPERIENCE_DIRECTOR_SYSTEM_PROMPT : current?.prompt ?? EXPERIENCE_DIRECTOR_SYSTEM_PROMPT);
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
    setPrompt(version.prompt.startsWith("builtin://") ? EXPERIENCE_DIRECTOR_SYSTEM_PROMPT : version.prompt);
    setTestResult(null);
  };

  const createDraft = async (source = selected) => {
    setSaving(true);
    try {
      const draft = await createOrchestrationDraft({
        name: source ? `${source.name} — brouillon` : "Orchestration GM — brouillon",
        prompt: source?.prompt?.startsWith("builtin://") ? EXPERIENCE_DIRECTOR_SYSTEM_PROMPT : source?.prompt || EXPERIENCE_DIRECTOR_SYSTEM_PROMPT,
        config: source?.config || DEFAULT_DIRECTOR_CONFIG,
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
      await updateOrchestrationDraft(selected.id, { name, prompt, config: selected.config });
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
      systemPromptOverride: prompt,
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
              <Textarea value={prompt} disabled={selected.status !== "draft"} onChange={(event) => setPrompt(event.target.value)} className="min-h-[320px] font-mono text-xs" aria-label="Prompt du directeur" />
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
