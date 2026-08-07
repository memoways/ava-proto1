import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Gauge, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { maxRagFormatOptionsForVariant } from "@/services/maxRagVariant";
import {
  MAX_MAX_RAG_CONTEXT_CHARS,
  MAX_MAX_RAG_ITEM_CHARS,
  MAX_MAX_RAG_ITEMS,
} from "@/services/ragService";
import {
  activateExistingRagProfile,
  buildAndActivateRagProfile,
  loadRagIndexDashboardData,
  RAG_EMBEDDING_PROFILES,
  type RagEmbeddingProfileId,
  type RagIndexDashboardData,
} from "@/services/ragIndexService";
import {
  getGameplaySettings,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  loadGameplaySettingsFromDB,
  type GameplaySettings,
} from "@/services/settingsService";

const SELECTABLE_PROFILES: RagEmbeddingProfileId[] = [
  "voyage-4-realtime",
  "voyage-context-4-quality",
  "voyage-3-legacy",
  "openai-legacy",
];

function Doc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground/75">{children}</p>;
}

function Tradeoff({ low, high }: { low: string; high: string }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold text-muted-foreground">↓ Valeur basse — </span>
        <span className="text-muted-foreground/80">{low}</span>
      </div>
      <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold text-muted-foreground">↑ Valeur haute — </span>
        <span className="text-muted-foreground/80">{high}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">{detail}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "jamais";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function RAGConfigTab() {
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [saved, setSaved] = useState<GameplaySettings>(getGameplaySettings());
  const [dashboard, setDashboard] = useState<RagIndexDashboardData | null>(null);
  const [targetProfile, setTargetProfile] = useState<RagEmbeddingProfileId>("voyage-4-realtime");
  const [saving, setSaving] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [activatingProfile, setActivatingProfile] = useState(false);

  const refreshDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await loadRagIndexDashboardData();
      setDashboard(data);
      if (data.state?.active_profile) setTargetProfile(data.state.active_profile);
    } catch (error) {
      toast.error(`État de l’index indisponible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    void loadGameplaySettingsFromDB().then((settings) => {
      setGameplay(settings);
      setSaved(settings);
    });
    void refreshDashboard();
  }, [refreshDashboard]);

  const hasChanges = JSON.stringify(gameplay) !== JSON.stringify(saved);
  const activeProfile = dashboard?.state
    ? RAG_EMBEDDING_PROFILES[dashboard.state.active_profile]
    : RAG_EMBEDDING_PROFILES["voyage-3-legacy"];
  const selectedProfile = RAG_EMBEDDING_PROFILES[targetProfile];
  const ragFormat = useMemo(() => maxRagFormatOptionsForVariant(gameplay.MAX_PROMPT_VARIANT), [gameplay.MAX_PROMPT_VARIANT]);
  const effectiveMaxItems = ragFormat.maxItems ?? MAX_MAX_RAG_ITEMS;
  const effectiveItemChars = ragFormat.itemChars ?? MAX_MAX_RAG_ITEM_CHARS;
  const effectiveTotalChars = ragFormat.totalChars ?? MAX_MAX_RAG_CONTEXT_CHARS;

  function update(patch: Partial<GameplaySettings>) {
    setGameplay(saveGameplaySettings(patch));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveGameplaySettingsToDB(gameplay);
      setSaved(gameplay);
      toast.success("Réglages de récupération sauvegardés ✓");
    } finally {
      setSaving(false);
    }
  }

  async function handleBuildProfile() {
    const confirmed = window.confirm(
      `Construire puis activer « ${selectedProfile.label} » dans Lovable Cloud ?\n\n` +
      "L’index actuellement actif restera utilisé jusqu’à la réussite complète du rebuild.",
    );
    if (!confirmed) return;
    setBuildingProfile(true);
    try {
      const result = await buildAndActivateRagProfile(targetProfile);
      toast.success(`${selectedProfile.label} activé · ${result.profile_embeddings_in_db} chunks`);
      await refreshDashboard();
    } catch (error) {
      toast.error(`Rebuild non activé : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBuildingProfile(false);
    }
  }

  async function handleActivateExistingProfile() {
    const existingChunks = dashboard?.profileCounts[targetProfile] || 0;
    const confirmed = window.confirm(
      `Activer immédiatement « ${selectedProfile.label} » avec ses ${existingChunks} chunks existants ?\n\n` +
      "Le profil actif actuel deviendra le profil de rollback.",
    );
    if (!confirmed) return;
    setActivatingProfile(true);
    try {
      await activateExistingRagProfile(targetProfile);
      toast.success(`${selectedProfile.label} activé sans rebuild`);
      await refreshDashboard();
    } catch (error) {
      toast.error(`Activation impossible : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setActivatingProfile(false);
    }
  }

  const metrics = dashboard?.metrics;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🔎 Configuration RAG</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Index documentaire, récupération, reranking et budget réellement transmis à Max. La future mémoire
            conversationnelle et le payload LLM resteront des budgets séparés.
          </p>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}>
          <Save className="mr-1 h-3 w-3" /> {saving ? "Sauvegarde…" : "Sauvegarder les réglages"}
        </Button>
      </div>

      {hasChanges && (
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-300">
          Modifications de retrieval non sauvegardées. Le profil d’index est activé séparément après rebuild.
        </div>
      )}

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold"><Database className="h-4 w-4" /> Index effectif</h3>
            <p className="mt-1 text-xs text-muted-foreground">État lu dans Lovable Cloud, utilisé côté serveur par `query-rag`.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshDashboard()} disabled={loadingDashboard}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loadingDashboard ? "animate-spin" : ""}`} /> Actualiser
          </Button>
        </div>

        {dashboard?.migrationMissing ? (
          <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium">Migration des profils non appliquée dans Lovable Cloud</p>
              <p className="mt-1 text-xs text-muted-foreground">Le code conserve le profil legacy. Appliquer `20260805120000_rag_embedding_profiles.sql` avant tout rebuild Voyage 4.</p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium">{activeProfile.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Index compatible et activé côté serveur.</p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Documents" value={dashboard?.state?.document_model || activeProfile.documentModel} detail="calculés au sync Notion" />
          <Metric label="Questions" value={dashboard?.state?.query_model || activeProfile.queryModel} detail="calculées à chaque tour" />
          <Metric label="Format" value={`${dashboard?.state?.dimension || activeProfile.dimension}D · ${dashboard?.state?.dtype || activeProfile.dtype}`} detail={dashboard?.state?.chunking_strategy || activeProfile.chunkingStrategy} />
          <Metric label="Corpus actif" value={`${dashboard?.state?.total_chunks ?? dashboard?.profileCounts[activeProfile.id] ?? 0} chunks`} detail={`rebuild : ${formatDate(dashboard?.state?.last_rebuild_at)}`} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h3 className="text-base font-semibold">🧬 Profils d’embedding</h3>
          <p className="mt-1 text-xs text-muted-foreground">Un profil change d’espace vectoriel. Il est construit en parallèle avant activation ; enregistrer les sliders ne change jamais l’index.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {SELECTABLE_PROFILES.map((profileId) => {
            const profile = RAG_EMBEDDING_PROFILES[profileId];
            const active = dashboard?.state?.active_profile === profileId;
            return (
              <button
                type="button"
                key={profile.id}
                onClick={() => setTargetProfile(profile.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${targetProfile === profile.id ? "border-primary bg-primary/5" : "hover:bg-muted/20"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{profile.label}</span>
                  {profile.recommended && <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">RECOMMANDÉ</span>}
                  {profile.experimental && <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300">CANARY</span>}
                  {active && <span className="rounded bg-primary/15 px-2 py-0.5 text-[10px] text-primary">ACTIF</span>}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{profile.description}</p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">{profile.documentModel} → {profile.queryModel} · {profile.dimension}D · {dashboard?.profileCounts[profile.id] || 0} chunks présents</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
          <div>
            <p className="text-sm font-medium">Cible : {selectedProfile.label}</p>
            <p className="text-xs text-muted-foreground">L’ancien profil est conservé pour rollback après activation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(dashboard?.profileCounts[targetProfile] || 0) > 0 && dashboard?.state?.active_profile !== targetProfile && (
              <Button variant="outline" onClick={() => void handleActivateExistingProfile()} disabled={activatingProfile || buildingProfile || dashboard?.migrationMissing}>
                {activatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {activatingProfile ? "Activation…" : "Activer l’index existant"}
              </Button>
            )}
            <Button
              onClick={() => void handleBuildProfile()}
              disabled={buildingProfile || activatingProfile || dashboard?.migrationMissing || dashboard?.state?.active_profile === targetProfile}
            >
              {buildingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              {buildingProfile ? "Rebuild dans Lovable Cloud…" : "Construire et activer"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-4">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Gauge className="h-4 w-4" /> Résultats live observés</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Échantillon" value={`${metrics?.sampleSize || 0} tours`} detail={metrics?.lastMeasuredAt ? `dernier : ${formatDate(metrics.lastMeasuredAt)}` : "aucune mesure disponible"} />
          <Metric label="Latence RAG p50" value={metrics?.p50Ms != null ? `${metrics.p50Ms} ms` : "—"} detail="cible diagnostique : 250 ms" />
          <Metric label="Latence RAG p95" value={metrics?.p95Ms != null ? `${metrics.p95Ms} ms` : "—"} detail="deadline live : 2 000 ms" />
          <Metric label="Tours sans résultat" value={metrics?.missRate != null ? `${Math.round(metrics.missRate * 100)} %` : "—"} detail="questions avec 0 chunk final" />
        </div>
        <Doc>Ces valeurs proviennent des événements de tours réellement joués. Elles remplacent les promesses génériques de latence fournisseur.</Doc>
      </section>

      <section className="space-y-5 rounded-lg border p-4">
        <h3 className="text-base font-semibold">🧭 Reranking</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Modèle Voyage</label>
            <Select value={gameplay.RAG_RERANK_MODEL} onValueChange={(value: "rerank-2.5" | "rerank-2.5-lite") => update({ RAG_RERANK_MODEL: value })}>
              <SelectTrigger disabled={!gameplay.RAG_RERANK_ENABLED}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rerank-2.5-lite">rerank-2.5-lite — temps réel recommandé</SelectItem>
                <SelectItem value="rerank-2.5">rerank-2.5 — qualité maximale</SelectItem>
              </SelectContent>
            </Select>
            <Doc>Les deux modèles sont multilingues et suivent une instruction de pertinence. Le mode Lite est destiné aux usages sensibles à la latence ; le modèle complet reste utile pour les comparaisons du Laboratoire.</Doc>
          </div>
          <div className="grid gap-3">
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="text-sm text-muted-foreground">Reranking activé</span>
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={gameplay.RAG_RERANK_ENABLED} onChange={(event) => update({ RAG_RERANK_ENABLED: event.target.checked })} />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2">
              <span className="text-sm text-muted-foreground">Troncature de sécurité</span>
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={gameplay.RAG_RERANK_TRUNCATION} onChange={(event) => update({ RAG_RERANK_TRUNCATION: event.target.checked })} disabled={!gameplay.RAG_RERANK_ENABLED} />
            </label>
          </div>
        </div>
        <Doc>Le reranker reçoit désormais la même question contextualisée que l’embedding, précédée d’une instruction qui privilégie les faits narratifs explicites. Il reste utilisable même si l’index actif est OpenAI.</Doc>
      </section>

      <section className="space-y-6 rounded-lg border p-4">
        <h3 className="text-base font-semibold">🎚️ Récupération et injection</h3>

        <div className="rounded-lg border bg-muted/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="text-sm font-medium">Variante du prompt Max</label>
              <Doc>Réglage technique consommé par le compilateur Max et le formatage RAG. Il n’appartient plus à l’orchestration GM.</Doc>
            </div>
            <Select
              value={gameplay.MAX_PROMPT_VARIANT}
              onValueChange={(value: "legacy" | "compact_v1" | "rich_v2" | "optimized_v3") => update({ MAX_PROMPT_VARIANT: value })}
            >
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="optimized_v3">Optimized v3</SelectItem>
                <SelectItem value="rich_v2">Rich v2</SelectItem>
                <SelectItem value="compact_v1">Compact v1</SelectItem>
                <SelectItem value="legacy">Legacy (rollback)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between"><label className="text-sm font-medium text-muted-foreground">Seuil cosine minimal</label><span className="font-mono text-sm">{gameplay.RAG_MATCH_THRESHOLD.toFixed(2)}</span></div>
          <Slider value={[gameplay.RAG_MATCH_THRESHOLD]} onValueChange={([value]) => update({ RAG_MATCH_THRESHOLD: value })} min={0} max={0.8} step={0.05} />
          <Doc>Filtre appliqué avant reranking. Les distributions changent avec le profil d’embedding : recalibrer dans le Laboratoire après chaque migration de modèle.</Doc>
          <Tradeoff low="rappel élevé ; le reranker reçoit davantage de bruit." high="précision initiale élevée ; davantage de questions risquent de ne rien retourner." />
        </div>

        <div>
          <div className="mb-1 flex justify-between"><label className="text-sm font-medium text-muted-foreground">Vivier de candidats (retrieve_k)</label><span className="font-mono text-sm">{gameplay.RAG_RETRIEVE_K}</span></div>
          <Slider value={[gameplay.RAG_RETRIEVE_K]} onValueChange={([value]) => update({ RAG_RETRIEVE_K: value })} min={Math.max(1, gameplay.RAG_TOP_K)} max={60} step={1} />
          <Doc>Nombre de chunks relus par le reranker. Avec `top_k=3`, 8 à 12 candidats constituent le point de départ recommandé pour le corpus AVA.</Doc>
          <Tradeoff low="latence minimale, mais un fait mal classé est perdu." high="meilleur rappel, avec davantage de tokens et de latence de reranking." />
        </div>

        <div>
          <div className="mb-1 flex justify-between"><label className="text-sm font-medium text-muted-foreground">Résultats finaux du retrieval (top_k)</label><span className="font-mono text-sm">{gameplay.RAG_TOP_K}</span></div>
          <Slider value={[gameplay.RAG_TOP_K]} onValueChange={([value]) => update({ RAG_TOP_K: value })} min={1} max={15} step={1} />
          <Doc>Nombre de résultats renvoyés au pipeline. Max n’en injecte jamais plus de {effectiveMaxItems} : augmenter `top_k` au-delà sert au diagnostic et aux consommateurs secondaires, pas à augmenter automatiquement son prompt.</Doc>
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-3">
          <Metric label="Souvenirs Max" value={`${Math.min(gameplay.RAG_TOP_K, effectiveMaxItems)} / ${effectiveMaxItems}`} detail="dédupliqués avant injection" />
          <Metric label="Budget par souvenir" value={`${effectiveItemChars} caractères`} detail={`variante ${gameplay.MAX_PROMPT_VARIANT}`} />
          <Metric label="Budget RAG total" value={`${effectiveTotalChars} caractères`} detail="séparé de la future mémoire de session" />
        </div>
      </section>

      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-2 text-sm font-semibold">Config effective résumée</h3>
        <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify({
          embedding_profile: dashboard?.state?.active_profile || "migration requise / legacy",
          document_model: dashboard?.state?.document_model || activeProfile.documentModel,
          query_model: dashboard?.state?.query_model || activeProfile.queryModel,
          reranker: gameplay.RAG_RERANK_ENABLED ? gameplay.RAG_RERANK_MODEL : null,
          cosine_threshold: gameplay.RAG_MATCH_THRESHOLD,
          retrieve_k: gameplay.RAG_RETRIEVE_K,
          top_k: gameplay.RAG_TOP_K,
          max_memories_injected: Math.min(gameplay.RAG_TOP_K, effectiveMaxItems),
          rag_prompt_budget_chars: effectiveTotalChars,
        }, null, 2)}</pre>
        <p className="mt-2 text-xs text-muted-foreground">Pour comparer les scores et les rangs sans changer le live, utiliser Qualité → Laboratoire RAG.</p>
      </section>
    </div>
  );
}
