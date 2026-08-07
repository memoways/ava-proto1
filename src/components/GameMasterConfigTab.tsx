import { useEffect, useMemo, useState } from "react";
import { Archive, Beaker, Copy, Play, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { evaluatePostTurnPRD4, EXPERIENCE_DIRECTOR_SYSTEM_PROMPT } from "@/agents/gameMasterPRD4";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveOrchestrationVersion,
  createOrchestrationDraft,
  DEFAULT_DIRECTOR_CONFIG,
  fetchCharacterAutoReadiness,
  listCharacterRuntimeProfiles,
  listOrchestrationVersions,
  publishOrchestrationVersion,
  updateOrchestrationDraft,
  updateCharacterRuntimeProfile,
  uploadCharacterPortrait,
  type CharacterAutoReadiness,
  type CharacterRuntimeProfile,
  type ExperienceOrchestrationVersion,
} from "@/services/experienceOrchestration";
import {
  getGameplaySettings,
  loadGameplaySettingsFromDB,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  type GameplaySettings,
} from "@/services/settingsService";
import {
  MAX_SESSION_DURATION_SECONDS,
  MIN_SESSION_DURATION_SECONDS,
} from "@/config/experienceRuntime";

interface SessionVersionRow { orchestration_version_id: string | null }

function statusVariant(status: ExperienceOrchestrationVersion["status"]): "default" | "outline" | "secondary" {
  if (status === "published") return "default";
  if (status === "draft") return "outline";
  return "secondary";
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readiness(
  profile: CharacterRuntimeProfile,
  auto: CharacterAutoReadiness | undefined,
): Array<{ label: string; ok: boolean; hint: string }> {
  const chunks = auto?.ragChunks ?? 0;
  return [
    {
      label: "Fiche Notion",
      ok: Boolean(auto?.characterId),
      hint: auto?.characterId
        ? `Fiche « ${auto.characterName} » synchronisée`
        : "Aucune fiche « En cours » trouvée dans Contenu Notion → Sync Notion",
    },
    {
      label: "Prompt compilé",
      ok: Boolean(auto?.hasPrompt),
      hint: auto?.hasPrompt
        ? "Prompt présent dans Personnages"
        : "Lancer une synchronisation Notion pour générer le prompt du personnage",
    },
    {
      label: "Corpus RAG isolé",
      ok: chunks > 0,
      hint: chunks > 0 ? `${chunks} chunk(s) indexé(s)` : "Aucun chunk indexé pour ce personnage (onglet Embeddings)",
    },
    {
      label: "Portrait",
      ok: Boolean(profile.portrait_url),
      hint: profile.portrait_url ? "Portrait défini" : "Téléverser un portrait ci-dessous",
    },
    {
      label: "Phrase d’ouverture",
      ok: Boolean(profile.opening_line),
      hint: profile.opening_line ? "Phrase définie" : "Saisir la première réplique du personnage",
    },
    {
      label: "Provider et voix TTS",
      ok: Boolean(profile.tts_provider && profile.tts_voice_id),
      hint: profile.tts_provider && profile.tts_voice_id
        ? `${profile.tts_provider} · ${profile.tts_voice_id}`
        : "Renseigner le provider et le Voice ID (voir TTS Config)",
    },
  ];
}

export default function GameMasterConfigTab() {
  const [versions, setVersions] = useState<ExperienceOrchestrationVersion[]>([]);
  const [profiles, setProfiles] = useState<CharacterRuntimeProfile[]>([]);
  const [sessionsByVersion, setSessionsByVersion] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [savedTimeout, setSavedTimeout] = useState(gameplay.TIMEOUT_SECONDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [testUser, setTestUser] = useState("Pourquoi Ava ne vous faisait-elle plus confiance ?");
  const [testCharacter, setTestCharacter] = useState("Je ne suis pas certain d’avoir mérité sa confiance.");
  const [testExpected, setTestExpected] = useState("Une guidance prudente, sans action forcée.");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [autoReadiness, setAutoReadiness] = useState<Record<string, CharacterAutoReadiness>>({});
  const [uploadingPortrait, setUploadingPortrait] = useState<string | null>(null);

  const selected = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? null,
    [selectedId, versions],
  );

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [nextVersions, nextProfiles, nextGameplay, sessions] = await Promise.all([
        listOrchestrationVersions(),
        listCharacterRuntimeProfiles(),
        loadGameplaySettingsFromDB(),
        supabase.from("sessions").select("orchestration_version_id"),
      ]);
      setVersions(nextVersions);
      setProfiles(nextProfiles);
      try {
        setAutoReadiness(await fetchCharacterAutoReadiness(nextProfiles.map((profile) => profile.display_name)));
      } catch {
        setAutoReadiness({});
      }
      setGameplay(nextGameplay);
      setSavedTimeout(nextGameplay.TIMEOUT_SECONDS);
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

  const saveTimeout = async () => {
    setSaving(true);
    try {
      const updated = saveGameplaySettings({ TIMEOUT_SECONDS: gameplay.TIMEOUT_SECONDS });
      await saveGameplaySettingsToDB(updated);
      setGameplay(updated);
      setSavedTimeout(updated.TIMEOUT_SECONDS);
      toast.success("Durée de session sauvegardée");
    } finally {
      setSaving(false);
    }
  };

  const patchProfile = (id: string, patch: Partial<CharacterRuntimeProfile>) => {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
  };

  const uploadPortrait = async (profile: CharacterRuntimeProfile, file: File) => {
    setUploadingPortrait(profile.id);
    try {
      const url = await uploadCharacterPortrait(profile.character_key, file);
      patchProfile(profile.id, { portrait_url: url });
      toast.success("Portrait téléversé, pensez à sauvegarder le profil");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléversement du portrait impossible");
    } finally {
      setUploadingPortrait(null);
    }
  };

  const saveProfile = async (profile: CharacterRuntimeProfile) => {
    setSaving(true);
    try {
      const auto = autoReadiness[profile.display_name];
      await updateCharacterRuntimeProfile(profile.id, {
        enabled: profile.enabled,
        // The Notion link is resolved automatically from the Personnages sync.
        notion_character_id: auto?.characterId ?? profile.notion_character_id,
        opening_line: profile.opening_line,
        portrait_url: profile.portrait_url,
        tts_provider: profile.tts_provider,
        tts_voice_id: profile.tts_voice_id,
        prompt_validated: Boolean(auto?.hasPrompt),
        rag_validated: (auto?.ragChunks ?? 0) > 0,
        qualitative_tests_validated: profile.qualitative_tests_validated,
        knowledge_isolation_validated: profile.knowledge_isolation_validated,
      });
      toast.success(`Profil runtime ${profile.display_name} sauvegardé`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sauvegarde du profil impossible");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement de l’orchestration…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🎭 Orchestration de l’expérience</h2>
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

      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Durée de l’expérience</h3>
            <p className="text-xs text-muted-foreground">
              C’est la durée maximale d’une session joueur, et le seul réglage de gameplay piloté depuis cet onglet.
              Le choix du prompt de Max (variantes legacy / rich_v2 / optimized_v3) se règle ailleurs, dans Technique avancée → LLM Config.
            </p>
          </div>
          <Button size="sm" onClick={() => void saveTimeout()} disabled={saving || gameplay.TIMEOUT_SECONDS === savedTimeout}>
            <Save className="mr-1 h-3.5 w-3.5" />Enregistrer
          </Button>
        </div>
        <div className="flex justify-between text-sm">
          <span>Durée maximale de session</span>
          <span className="font-mono">{formatDuration(gameplay.TIMEOUT_SECONDS)} min:sec ({gameplay.TIMEOUT_SECONDS}s)</span>
        </div>
        <Slider
          value={[gameplay.TIMEOUT_SECONDS]}
          min={MIN_SESSION_DURATION_SECONDS}
          max={MAX_SESSION_DURATION_SECONDS}
          step={30}
          onValueChange={([value]) => setGameplay((current) => ({ ...current, TIMEOUT_SECONDS: value }))}
        />
      </section>

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

      <section className="rounded-lg border p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Disponibilité des personnages</h3>
          <p className="text-xs text-muted-foreground">
            Les prérequis Fiche Notion, Prompt et Corpus RAG sont détectés automatiquement dans la base. Emma ne peut être proposée que lorsque tout est vert.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {profiles.map((profile) => {
            const auto = autoReadiness[profile.display_name];
            const checks = readiness(profile, auto);
            const blockers = checks.filter((check) => !check.ok);
            const ready = profile.enabled && blockers.length === 0;
            return (
              <div key={profile.id} className="rounded border p-3">
                <div className="flex items-center justify-between"><strong>{profile.display_name}</strong><Badge variant={ready ? "default" : "outline"}>{ready ? "prêt" : "incomplet"}</Badge></div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                  {checks.map((check) => (
                    <span key={check.label} title={check.hint} className={check.ok ? "text-emerald-500" : "text-muted-foreground"}>
                      {check.ok ? "✓" : "○"} {check.label}
                    </span>
                  ))}
                </div>
                {blockers.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                    {blockers.map((blocker) => (
                      <li key={blocker.label}><span className="font-medium text-foreground">{blocker.label} :</span> {blocker.hint}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 space-y-2 border-t pt-3">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Checkbox checked={profile.enabled} onCheckedChange={(checked) => patchProfile(profile.id, { enabled: checked === true })} />
                    Personnage activable par le runtime
                  </label>
                  <Textarea value={profile.opening_line ?? ""} onChange={(event) => patchProfile(profile.id, { opening_line: event.target.value || null })} placeholder="Phrase d’ouverture" className="min-h-20" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {profile.portrait_url && (
                        <img src={profile.portrait_url} alt={`Portrait de ${profile.display_name}`} className="h-12 w-12 rounded object-cover" />
                      )}
                      <label className="flex-1">
                        <span className="sr-only">Téléverser un portrait</span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingPortrait === profile.id}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadPortrait(profile, file);
                          }}
                          className="w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs"
                        />
                      </label>
                    </div>
                    <Input value={profile.portrait_url ?? ""} onChange={(event) => patchProfile(profile.id, { portrait_url: event.target.value || null })} placeholder="URL du portrait (renseignée par le téléversement)" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={profile.tts_provider ?? ""} onChange={(event) => patchProfile(profile.id, { tts_provider: event.target.value || null })} placeholder="Provider TTS" />
                    <Input value={profile.tts_voice_id ?? ""} onChange={(event) => patchProfile(profile.id, { tts_voice_id: event.target.value || null })} placeholder="Voice ID" />
                  </div>
                  <Button size="sm" variant="outline" disabled={saving || uploadingPortrait === profile.id} onClick={() => void saveProfile(profile)}>
                    <Save className="mr-1 h-3.5 w-3.5" />{uploadingPortrait === profile.id ? "Téléversement…" : "Sauvegarder le profil"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-muted p-4 text-xs text-muted-foreground">
        Les anciens seuils de confiance, tolérance aux insultes, gate, placeholder vidéo, modes de parole, prompt historique et GM pré-tour restent conservés en données legacy mais ne sont plus présentés comme actifs dans PRD4.
      </section>
    </div>
  );
}
