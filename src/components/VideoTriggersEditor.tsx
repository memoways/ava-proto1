import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cinematicPresentationFrom, type CinematicPresentation } from "@/services/cinematicTransition";
import { toast } from "sonner";
import { Pencil, Save, X, RefreshCw, ExternalLink, Settings as SettingsIcon, Sparkles, Mic, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  listVideoTriggers,
  updateVideoTriggerOnNotion,
  describeVideoWithAi,
  transcribeVideoWithAi,
  type VideoTriggerRow,
  type UpdateVideoTriggerPatch,
} from "@/services/videoTriggerService";
import {
  loadExtractSettingsFromDB,
  saveExtractSettingsToDB,
  resetExtractSettings,
  extractDefaults,
  type ExtractSettings,
  loadVideoTriggerSettingsFromDB,
  saveVideoTriggerSettingsToDB,
  resetVideoTriggerSettings,
  videoTriggerDefaults,
  type VideoTriggerSettings,
} from "@/services/settingsService";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import { adminTabPath } from "@/services/adminNavigation";
import { loadPlayCounts, playCountLabel, type PlayCount } from "@/services/videoDecisionLog";
import { getCachedSession } from "@/services/gameAuth";
import {
  appendVideoSyncRun,
  diffTitles,
  loadVideoSyncHistory,
  type VideoSyncRunSummary,
} from "@/services/videoSyncHistory";
import { selectVideosToDescribe } from "../../supabase/functions/_shared/videoDescription";
import {
  selectExtractsToTranscribe,
  transcribeBlockedReason,
} from "../../supabase/functions/_shared/videoTranscription";
import { extractTranscriptStatus, type ExtractTranscriptStatus } from "../../supabase/functions/_shared/videoMetadata";
import CinematicPreview from "@/components/CinematicPreview";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const TYPE_OPTIONS = ["intro", "interlude", "mid_conversation"];
const TRANSITION_OPTIONS = ["fade_black", "glitch", "screen_share"];

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function TextField({ label, clamp, children }: { label: string; clamp?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="font-medium text-foreground/80">{label}</dt>
      <dd className={`text-muted-foreground ${clamp ?? ""}`}>{children}</dd>
    </div>
  );
}


const TRANSCRIPT_STATUS_LABEL: Record<ExtractTranscriptStatus, { label: string; ok: boolean }> = {
  silent: { label: "Sans dialogue", ok: true },
  spoken_verified: { label: "Parlé · transcription vérifiée", ok: true },
  spoken_unverified: { label: "Parlé · transcription à vérifier", ok: false },
  spoken_missing: { label: "Parlé · transcription absente", ok: false },
  unknown: { label: "Dialogue non renseigné", ok: false },
};

function TranscriptStatusBadge({ video }: { video: VideoTriggerRow }) {
  const { label, ok } = TRANSCRIPT_STATUS_LABEL[extractTranscriptStatus(video)];
  return <Badge variant={ok ? "outline" : "destructive"} data-testid="extract-transcript-status">{label}</Badge>;
}

function CompactNumber({
  id,
  label,
  hint,
  value,
  min = 0,
  max,
  disabled,
  onChange,
}: {
  id?: string;
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label htmlFor={id} className="min-w-0" title={hint}>
      <span className="block truncate text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        className="mt-0.5 h-8"
        onChange={(e) => onChange(Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, Number(e.target.value) || 0)))}
      />
    </label>
  );
}

function ExtractRulesPanel() {
  const [settings, setSettings] = useState<ExtractSettings>(extractDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExtractSettingsFromDB().then(setSettings).finally(() => setLoading(false));
  }, []);

  const update = (patch: Partial<ExtractSettings>) => setSettings((s) => ({ ...s, ...patch }));

  async function save() {
    setSaving(true);
    try {
      await saveExtractSettingsToDB(settings);
      toast.success("Réglages des extraits enregistrés ✓");
    } catch (err) {
      toast.error("Erreur sauvegarde : " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <section className="rounded-lg border bg-muted/5 px-3 py-2" data-testid="extract-rules">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Règles des extraits</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={settings.ENABLED} onCheckedChange={(ENABLED) => update({ ENABLED })} />
            Activer les extraits
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={settings.REQUIRE_VERIFIED_TRANSCRIPT}
              onCheckedChange={(REQUIRE_VERIFIED_TRANSCRIPT) => update({ REQUIRE_VERIFIED_TRANSCRIPT })} />
            Exiger une transcription vérifiée
          </label>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Parcours « film pas vu », distinct des cinématiques. La bascule retire les extraits de leur pool : parlé après la réplique (son propre), silencieux superposé. Seuls les silencieux, ou les parlés à transcription vérifiée, sont proposés. Inactif par défaut.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <CompactNumber label="Tours avant le 1er" hint="Tours avant le premier extrait." value={settings.MIN_TURNS_BEFORE_FIRST}
          onChange={(MIN_TURNS_BEFORE_FIRST) => update({ MIN_TURNS_BEFORE_FIRST })} />
        <CompactNumber label="Tours entre deux" hint="Tours entre deux extraits." value={settings.MIN_TURNS_BETWEEN}
          onChange={(MIN_TURNS_BETWEEN) => update({ MIN_TURNS_BETWEEN })} />
        <CompactNumber label="Max / session (0 = illimité)" value={settings.MAX_PER_SESSION}
          onChange={(MAX_PER_SESSION) => update({ MAX_PER_SESSION })} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => { setSettings(resetExtractSettings()); toast.success("Réglages réinitialisés"); }}>Réinitialiser</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="h-3 w-3 mr-1" /> {saving ? "Sauvegarde…" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function VideoTriggerRulesPanel() {
  const [settings, setSettings] = useState<VideoTriggerSettings>(videoTriggerDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadVideoTriggerSettingsFromDB();
        setSettings(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<VideoTriggerSettings>) => setSettings((s) => ({ ...s, ...patch }));

  async function save() {
    setSaving(true);
    try {
      await saveVideoTriggerSettingsToDB(settings);
      toast.success("Réglages enregistrés ✓");
    } catch (err) {
      toast.error("Erreur sauvegarde : " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const d = resetVideoTriggerSettings();
    setSettings(d);
    toast.success("Réglages réinitialisés");
  }

  if (loading) return null;

  const presentation = cinematicPresentationFrom(settings.PRESENTATION);
  const overlay = presentation === "overlay";

  return (
    <section className="rounded-lg border bg-muted/5 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <SettingsIcon className="h-4 w-4 shrink-0 text-primary" />
          <h3 className="text-sm font-semibold">Règles de déclenchement</h3>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Quand une cinématique part, hors matching thématique.</span>
        </div>
        <label className="flex items-center gap-2 text-sm" title="Désactiver pour bloquer toutes les vidéos en jeu.">
          <Switch checked={settings.ENABLED} onCheckedChange={(ENABLED) => update({ ENABLED })} />
          Cinématiques actives
        </label>
      </div>

      <fieldset className="mt-2 border-0 p-0" data-testid="cinematic-presentation" aria-label="Intégration dans la conversation">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <RadioGroup
          value={presentation}
          onValueChange={(value) => update({ PRESENTATION: cinematicPresentationFrom(value) as CinematicPresentation })}
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          <label htmlFor="cinematic-presentation-interrupt" className="flex cursor-pointer items-center gap-1.5 text-sm" title="Après la réponse, fondu au noir, la vidéo seule, puis retour au personnage.">
            <RadioGroupItem id="cinematic-presentation-interrupt" value="interrupt" />
            Interrompre
          </label>
          <label htmlFor="cinematic-presentation-overlay" className="flex cursor-pointer items-center gap-1.5 text-sm" title="La vidéo remplace l'image du personnage pendant la réponse qui l'a motivée, son atténué. Sans vidéo prête à temps, la réponse reste normale.">
            <RadioGroupItem id="cinematic-presentation-overlay" value="overlay" />
            Superposer à la réponse
          </label>
          </RadioGroup>
          <label htmlFor="cinematic-overlay-gain" className="flex items-center gap-2 text-[11px] text-muted-foreground" title="Superposition seulement. −15 dB = valeur d'essai. Sur iPhone/iPad, le réglage passe par Web Audio ; si la source ne le permet pas, la vidéo y reste muette.">
          Son sous la voix (dB)
          <Input
            id="cinematic-overlay-gain"
            type="number"
            max={0}
            min={-60}
            step={1}
            value={settings.OVERLAY_VIDEO_GAIN_DB}
            disabled={!overlay}
            className="h-8 w-16"
            onChange={(e) => update({ OVERLAY_VIDEO_GAIN_DB: Math.min(0, Math.max(-60, Number(e.target.value) || 0)) })}
          />
          </label>
          <span className="text-[11px] text-muted-foreground">Fréquence commune aux deux modes.</span>
        </div>
      </fieldset>

      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
        <CompactNumber
          label="Tours avant la 1re"
          hint="Ex. 3 = aucune vidéo avant le 3e tour de parole."
          value={settings.MIN_TURNS_BEFORE_FIRST}
          onChange={(MIN_TURNS_BEFORE_FIRST) => update({ MIN_TURNS_BEFORE_FIRST })}
        />
        <CompactNumber
          label="Tours min. entre 2"
          hint="Délai de respiration entre cinématiques."
          value={settings.MIN_TURNS_BETWEEN}
          onChange={(MIN_TURNS_BETWEEN) => update({ MIN_TURNS_BETWEEN })}
        />
        <CompactNumber
          label="Max / session (0 = ∞)"
          hint="0 = illimité."
          value={settings.MAX_PER_SESSION}
          onChange={(MAX_PER_SESSION) => update({ MAX_PER_SESSION })}
        />
        <CompactNumber
          label="Labels min. requis"
          hint="Nombre min. de thèmes, sujets ou intentions extraits du tour."
          value={settings.MIN_LABELS_REQUIRED}
          onChange={(MIN_LABELS_REQUIRED) => update({ MIN_LABELS_REQUIRED })}
        />
        <CompactNumber
          label="Extraits avant transformée"
          hint="Parcours « film pas vu » : extraits montrés avant une vidéo transformée. Sans effet quand les extraits sont activés (onglet Extraits)."
          value={settings.MIN_EXTRACTS_BEFORE_CINEMATIC}
          onChange={(MIN_EXTRACTS_BEFORE_CINEMATIC) => update({ MIN_EXTRACTS_BEFORE_CINEMATIC })}
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={reset} disabled={saving}>Réinitialiser</Button>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-3 w-3 mr-1" /> {saving ? "Sauvegarde…" : "Enregistrer"}
        </Button>
      </div>
    </section>
  );
}

function NotionVideoSyncPanel({ onSynced }: { onSynced: () => Promise<void> | void }) {
  const [history, setHistory] = useState<VideoSyncRunSummary[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadVideoSyncHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  async function runSync() {
    setSyncing(true);
    try {
      const session = await getCachedSession();
      const token = session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ databases: { videos: AVA_NOTION_DATABASES.videos } }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const titles: string[] = (data.per_video ?? []).map((v: { title: string }) => v.title);
      const { added, removed } = diffTitles(titles, history[0]);
      const run: VideoSyncRunSummary = {
        at: new Date().toISOString(),
        synced: data.videos_synced ?? 0,
        skipped: data.videos_skipped ?? 0,
        titles,
        added,
        removed,
        missingMedia: (data.per_video ?? []).filter((v: { has_url?: boolean }) => !v.has_url).length,
        errors: (data.video_sync_errors ?? []).map(
          (e: { title: string; error: string }) => `${e.title} : ${e.error}`,
        ),
        latencyMs: data.latency_ms ?? 0,
      };
      setHistory(await appendVideoSyncRun(run, history));
      toast.success(`Sync Notion : ${run.synced} vidéo(s) « En ligne », ${run.skipped} ignorée(s)`);
      await onSynced();
    } catch (err) {
      toast.error("Erreur sync Notion : " + (err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const last = history[0];

  return (
    <Collapsible className="rounded-lg border bg-muted/5" data-testid="notion-video-sync">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left [&[data-state=open]>svg]:rotate-90" data-testid="notion-video-sync-toggle">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
        <span className="text-sm font-semibold">Synchronisation Notion</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {last
            ? `${new Date(last.at).toLocaleString("fr-FR")} · ${last.synced} en ligne`
            : "Aucun sync dans cet environnement"}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-t px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-3xl text-[11px] leading-snug text-muted-foreground">
            Importe la base « 🎬 Vidéos AVA ». Seules les vidéos dont l'<strong>État</strong> est <em>En ligne</em> sont publiées ; les autres sont retirées.
          </p>
          <Button size="sm" onClick={runSync} disabled={syncing}>
            <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronisation…" : "Synchroniser avec Notion"}
          </Button>
        </div>

        {last ? (
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border px-2 py-1">
              <div className="text-[10px] uppercase text-muted-foreground">Dernier sync</div>
              <div>{new Date(last.at).toLocaleString("fr-FR")}</div>
            </div>
            <div className="rounded border px-2 py-1">
              <div className="text-[10px] uppercase text-muted-foreground">Vidéos en ligne</div>
              <div>{last.synced}</div>
            </div>
            <div className="rounded border px-2 py-1">
              <div className="text-[10px] uppercase text-muted-foreground">Ignorées (État ≠ En ligne)</div>
              <div>{last.skipped}</div>
            </div>
            <div className="rounded border px-2 py-1">
              <div className="text-[10px] uppercase text-muted-foreground">Média absent</div>
              <div>{last.missingMedia}</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucun sync enregistré dans cet environnement.</p>
        )}

        {history.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-medium text-muted-foreground">3 derniers syncs</div>
            {history.map((run) => (
              <div key={run.at} className="space-y-0.5 border-t pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{new Date(run.at).toLocaleString("fr-FR")}</Badge>
                  <span>{run.synced} en ligne · {run.skipped} ignorée(s) · {Math.round(run.latencyMs / 100) / 10}s</span>
                </div>
                {run.added.length > 0 && (
                  <p className="text-muted-foreground">+ Ajoutées : {run.added.join(", ")}</p>
                )}
                {run.removed.length > 0 && (
                  <p className="text-muted-foreground">− Retirées : {run.removed.join(", ")}</p>
                )}
                {run.added.length === 0 && run.removed.length === 0 && (
                  <p className="italic text-muted-foreground/70">Aucun changement de catalogue</p>
                )}
                {run.errors.length > 0 && (
                  <p className="text-destructive">Erreurs : {run.errors.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function VideoTriggersEditor({ scope = "cinematics" }: { scope?: "cinematics" | "extracts" } = {}) {
  const isExtracts = scope === "extracts";

  const [triggers, setTriggers] = useState<VideoTriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<VideoTriggerRow>>({});
  const [newTheme, setNewTheme] = useState("");
  const [playCounts, setPlayCounts] = useState<PlayCount[]>([]);
  const [playsUnreadable, setPlaysUnreadable] = useState(false);
  const [sortByPlays, setSortByPlays] = useState(true);
  const [describingId, setDescribingId] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [reanalyze, setReanalyze] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [transcribeProgress, setTranscribeProgress] = useState<{ done: number; total: number } | null>(null);
  const [retranscribe, setRetranscribe] = useState(false);
  const [transcribeErrors, setTranscribeErrors] = useState<Record<string, string>>({});

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listVideoTriggers();
      setTriggers(rows);
    } catch (err) {
      toast.error("Erreur chargement triggers : " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTriggers(); }, [fetchTriggers]);
  useEffect(() => {
    let cancelled = false;
    loadPlayCounts()
      .then((result) => {
        if (cancelled) return;
        setPlayCounts(result.counts);
        setPlaysUnreadable(result.zeroRows || Boolean(result.error));
      })
      .catch(() => { if (!cancelled) setPlaysUnreadable(true); });
    return () => { cancelled = true; };
  }, []);

  function startEdit(t: VideoTriggerRow) {
    setEditingId(t.id);
    setDraft({ ...t });
    setNewTheme("");
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
    setNewTheme("");
  }

  function addTheme() {
    const tag = newTheme.trim().toLowerCase();
    if (!tag) return;
    const current = draft.themes ?? [];
    if (!current.includes(tag)) setDraft({ ...draft, themes: [...current, tag] });
    setNewTheme("");
  }

  function removeTheme(tag: string) {
    setDraft({ ...draft, themes: (draft.themes ?? []).filter((t) => t !== tag) });
  }

  async function saveTrigger() {
    if (!editingId || !draft.title?.trim()) return;
    const row = triggers.find((t) => t.id === editingId);
    if (!row?.notion_id) {
      toast.error("Cette ligne n'a pas d'ID Notion — re-synchronise la base d'abord.");
      return;
    }
    setSaving(true);
    try {
      const patch: UpdateVideoTriggerPatch = {
        title: draft.title,
        context: draft.context ?? "",
        description: draft.description ?? "",
        priority: draft.priority ?? 1,
        themes: draft.themes ?? [],
        type: draft.type ?? "interlude",
        transition_style: draft.transition_style ?? "fade_black",
        video_url: draft.video_url || null,
      };
      await updateVideoTriggerOnNotion(row.notion_id, patch);
      toast.success("Sauvegardé sur Notion ✓");
      cancelEdit();
      await fetchTriggers();
    } catch (err) {
      toast.error("Erreur sauvegarde Notion : " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function describeOne(t: VideoTriggerRow): Promise<boolean> {
    if (!t.notion_id) return false;
    setDescribingId(t.id);
    try {
      const result = await describeVideoWithAi(t.notion_id);
      setTriggers((rows) => rows.map((row) => (row.id === t.id ? { ...row, ai_description: result.ai_description } : row)));
      toast.success(`Description IA écrite : ${t.title}`);
      return true;
    } catch (err) {
      toast.error(`Analyse impossible (${t.title}) : ${(err as Error).message}`);
      return false;
    } finally {
      setDescribingId(null);
    }
  }

  // Film extracts and AI cinematics are managed in separate sections of the back-office.
  const visibleTriggers = triggers.filter((t) => (t.nature === "extract") === isExtracts);
  const playById = new Map(playCounts.map((count) => [count.videoId, count]));
  const shownTriggers = sortByPlays
    ? [...visibleTriggers].sort((a, b) => (playById.get(b.id)?.plays ?? 0) - (playById.get(a.id)?.plays ?? 0))
    : visibleTriggers;
  const toDescribe = selectVideosToDescribe(visibleTriggers, { reanalyze });

  async function describeMissing() {
    if (toDescribe.length === 0) return;
    const message = `Analyser ${toDescribe.length} vidéo(s) ? Seule « Description IA » sera écrite dans Notion.`;
    if (!window.confirm(message)) return;
    setBulkProgress({ done: 0, total: toDescribe.length });
    let written = 0;
    for (const [index, video] of toDescribe.entries()) {
      if (await describeOne(video)) written += 1;
      setBulkProgress({ done: index + 1, total: toDescribe.length });
    }
    setBulkProgress(null);
    toast.success(`${written}/${toDescribe.length} Description(s) IA écrite(s)`);
  }

  async function transcribeOne(t: VideoTriggerRow, options: { reanalyze?: boolean; confirmOverwriteVerified?: boolean } = {}): Promise<boolean> {
    if (!t.notion_id) return false;
    setTranscribingId(t.id);
    setTranscribeErrors((errors) => { const { [t.id]: _drop, ...rest } = errors; return rest; });
    try {
      const result = await transcribeVideoWithAi(t.notion_id, options);
      if (!result.written || !result.transcription) {
        setTranscribeErrors((errors) => ({ ...errors, [t.id]: "Aucune parole détectée : rien n'a été écrit." }));
        toast.message(`Aucune parole détectée : ${t.title}`);
        return false;
      }
      const text = result.transcription;
      setTriggers((rows) => rows.map((row) => (row.id === t.id
        ? { ...row, transcription: text, ...(result.verified_cleared ? { transcription_verified: false } : {}) }
        : row)));
      toast.success(`Transcription écrite (à vérifier) : ${t.title}`);
      return true;
    } catch (err) {
      const message = (err as Error).message;
      setTranscribeErrors((errors) => ({ ...errors, [t.id]: message }));
      toast.error(`Transcription impossible (${t.title}) : ${message}`);
      return false;
    } finally {
      setTranscribingId(null);
    }
  }

  async function transcribeSingle(t: VideoTriggerRow) {
    const hasText = !!t.transcription?.trim();
    if (!hasText) {
      if (!window.confirm(`Transcrire « ${t.title} » ? 1 vidéo envoyée à l'IA. Seule « Transcription » sera écrite dans Notion (non vérifiée).`)) return;
      await transcribeOne(t);
      return;
    }
    const verified = t.transcription_verified === true;
    const message = verified
      ? `« ${t.title} » a une transcription VÉRIFIÉE. La retranscrire l'écrase et décoche « Transcription vérifiée » (à re-relire). Continuer ?`
      : `Retranscrire « ${t.title} » ? La transcription actuelle (non vérifiée) sera remplacée.`;
    if (!window.confirm(message)) return;
    await transcribeOne(t, { reanalyze: true, confirmOverwriteVerified: verified });
  }

  const toTranscribe = isExtracts ? selectExtractsToTranscribe(visibleTriggers, { retranscribe }) : [];

  async function transcribeMissing() {
    if (toTranscribe.length === 0) return;
    const message = `Transcrire ${toTranscribe.length} extrait(s) parlé(s) ? ${toTranscribe.length} vidéo(s) envoyée(s) à l'IA (coût proportionnel). Seule « Transcription » sera écrite dans Notion, non vérifiée${retranscribe ? " ; les transcriptions existantes non vérifiées seront remplacées (jamais les vérifiées)" : ""}.`;
    if (!window.confirm(message)) return;
    setTranscribeProgress({ done: 0, total: toTranscribe.length });
    let written = 0;
    for (const [index, video] of toTranscribe.entries()) {
      if (await transcribeOne(video, { reanalyze: !!video.transcription?.trim() })) written += 1;
      setTranscribeProgress({ done: index + 1, total: toTranscribe.length });
    }
    setTranscribeProgress(null);
    toast.success(`${written}/${toTranscribe.length} transcription(s) écrite(s)`);
  }

  const busy = describingId !== null || bulkProgress !== null || transcribingId !== null || transcribeProgress !== null;

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des triggers…</p>;

  return (
    <div className="space-y-4">
    <NotionVideoSyncPanel onSynced={fetchTriggers} />
    {isExtracts ? <ExtractRulesPanel /> : <VideoTriggerRulesPanel />}

    <section className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base mb-1">{isExtracts ? "🎞️ Extraits du film" : "🎬 Catalogue et déclenchement des cinématiques"}</h3>
          <p className="text-xs text-muted-foreground">
            {isExtracts
              ? "Médias de « 🎬 Vidéos AVA » dont la Nature est « Extrait du film » · média : Gumlet. Réponses vidéo du parcours « film pas vu », distinctes des cinématiques d'ambiance."
              : "Source éditoriale : Notion · média : Gumlet. Le GM recommande ; le moteur vérifie disponibilité, rythme et doublons avant lecture après la voix."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={sortByPlays ? "default" : "outline"}
            size="sm"
            onClick={() => setSortByPlays((current) => !current)}
            data-testid="video-sort-plays"
          >
            {sortByPlays ? "Les plus jouées" : "Ordre du catalogue"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchTriggers}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border rounded p-3 bg-muted/5">
        <div className="text-xs text-muted-foreground max-w-xl">
          <strong>Description IA</strong> : Gemini regarde la vidéo (sans le son) et décrit ce qu'on voit.
          Écrit seulement « Description IA » dans Notion ; la Description humaine n'est jamais lue ni écrasée,
          et reste prioritaire pour le GM.
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={reanalyze} onCheckedChange={setReanalyze} disabled={busy} />
            Réanalyser les Descriptions IA existantes
          </label>
          <Button size="sm" variant="outline" onClick={describeMissing} disabled={busy || toDescribe.length === 0}>
            <Sparkles className="h-3 w-3 mr-1" />
            {bulkProgress
              ? `Analyse ${bulkProgress.done}/${bulkProgress.total}…`
              : `Analyser les vidéos sans description (${toDescribe.length})`}
          </Button>
        </div>
      </div>

      {isExtracts && (
        <div className="flex flex-wrap items-center justify-between gap-3 border rounded p-3 bg-muted/5" data-testid="extract-transcribe-panel">
          <div className="text-xs text-muted-foreground max-w-xl">
            <strong>Transcription IA</strong> : Gemini écoute la bande son des extraits <em>parlés</em> (label « Dialogue » de Notion)
            et note les paroles dites, sans interprétation. Écrit seulement « Transcription » dans Notion, jamais « Description »,
            « Dialogue » ni « Transcription vérifiée » : la relecture humaine reste nécessaire avant toute utilisation en jeu.
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={retranscribe} onCheckedChange={setRetranscribe} disabled={busy} />
              Retranscrire les transcriptions existantes non vérifiées
            </label>
            <Button size="sm" variant="outline" onClick={transcribeMissing} disabled={busy || toTranscribe.length === 0} data-testid="extract-transcribe-bulk">
              <Mic className="h-3 w-3 mr-1" />
              {transcribeProgress
                ? `Transcription ${transcribeProgress.done}/${transcribeProgress.total}…`
                : `Transcrire les extraits parlés sans transcription (${toTranscribe.length})`}
            </Button>
          </div>
        </div>
      )}

      {visibleTriggers.length === 0 && (
        <p className="text-sm text-muted-foreground/60 text-center py-4">
          {isExtracts ? "Aucun extrait en base (Nature = « Extrait du film », État = « En ligne »). " : "Aucune cinématique en base. "} Lance une sync Notion depuis l'onglet <em>Contenu Notion → Vidéos</em>.
        </p>
      )}

      <p className="text-xs text-muted-foreground">Lectures des 30 derniers jours.</p>
      {shownTriggers.map((t) => {
        const isEditing = editingId === t.id;

        if (isEditing) {
          return (
            <div key={t.id} className="border-2 border-primary/40 rounded-lg p-4 space-y-3 bg-muted/10">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Titre</label>
                  <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select
                    value={draft.type ?? "interlude"}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Thèmes (déclencheurs pour le Game Master)</label>
                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                  {(draft.themes ?? []).map((tag) => (
                    <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                      {tag}
                      <button onClick={() => removeTheme(tag)} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    placeholder="Ajouter un thème…"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTheme())}
                  />
                  <Button variant="outline" size="sm" onClick={addTheme}>+</Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">URL Gumlet</label>
                  <Input value={draft.video_url ?? ""} onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} placeholder="https://play.gumlet.io/…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priorité</label>
                    <Input type="number" value={draft.priority ?? 1} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Transition</label>
                    <select
                      value={draft.transition_style ?? "fade_black"}
                      onChange={(e) => setDraft({ ...draft, transition_style: e.target.value })}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {TRANSITION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Contexte (injecté dans Max après la vidéo)</label>
                <Textarea value={draft.context ?? ""} onChange={(e) => setDraft({ ...draft, context: e.target.value })} className="min-h-[60px] text-sm" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description (ce qui se passe dans la vidéo, factuel)</label>
                <Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-[80px] text-sm" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}><X className="h-3 w-3 mr-1" /> Annuler</Button>
                <Button size="sm" onClick={saveTrigger} disabled={saving}>
                  <Save className="h-3 w-3 mr-1" /> {saving ? "Sauvegarde…" : "Sauvegarder sur Notion"}
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div key={t.id} className="border rounded-lg p-4 bg-muted/10 group flex flex-col gap-5 md:flex-row">
            {/* Media: preview plus its sources, kept together under the video. */}
            <div className="w-full shrink-0 space-y-2 md:w-80 xl:w-96">
              <CinematicPreview
                videoUrl={t.video_url}
                title={t.title}
                playing={playingId === t.id}
                onPlay={() => setPlayingId(t.id)}
                onClose={() => setPlayingId(null)}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {t.video_url && (
                  <a href={t.video_url} target="_blank" rel="noopener noreferrer" title={t.video_url} className="inline-flex items-center gap-1 hover:text-primary">
                    Gumlet <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {t.notion_id && (
                  <a
                    href={`https://www.notion.so/${t.notion_id.replace(/-/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-primary"
                  >
                    Notion <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <span className="ml-auto text-[11px]">Synchronisé : {t.updated_at ? new Date(t.updated_at).toLocaleString("fr-FR") : "date inconnue"}</span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              {/* Identity and actions. */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-mono text-base font-semibold leading-tight">{t.title}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="video-play-count">{playCountLabel(playById.get(t.id), playsUnreadable)}</Badge>
                    {!playsUnreadable && playById.get(t.id) && (
                      <span className="text-xs text-muted-foreground">
                        dernière lecture {new Date(playById.get(t.id)!.lastPlayedAt).toLocaleString("fr-FR", { dateStyle: "medium" })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void describeOne(t)}
                    disabled={busy || !t.notion_id || !t.video_url}
                  >
                    <Sparkles className={`h-3 w-3 mr-1 ${describingId === t.id ? "animate-pulse" : ""}`} />
                    {describingId === t.id ? "Analyse…" : "Analyser"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                    <Pencil className="h-3 w-3 mr-1" /> Éditer
                  </Button>
                </div>
              </div>

              {/* Classification: one labelled field per kind of information. */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
                <MetaField label="Type"><span className="font-mono">{t.type}</span></MetaField>
                <MetaField label="Priorité">{t.priority != null ? `P${t.priority}` : "—"}</MetaField>
                <MetaField label="Nature">{t.nature ? (t.nature === "extract" ? "Extrait du film" : "Vidéo transformée") : "—"}</MetaField>
                <MetaField label="Personnages">
                  {t.characters && t.characters.length > 0 ? (t.characters.includes("all") ? "Tous" : t.characters.join(", ")) : "—"}
                </MetaField>
                <MetaField label="Média">
                  {t.video_url ? (
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Disponible</span>
                  ) : (
                    <Badge variant="destructive">Absent</Badge>
                  )}
                </MetaField>
              </dl>

              <dl>
                <MetaField label="Thèmes (déclencheurs)">
                  <div className="flex flex-wrap gap-1">
                    {(t.themes ?? []).map((tag) => (
                      <span key={tag} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{tag}</span>
                    ))}
                    {(!t.themes || t.themes.length === 0) && <span className="text-xs text-muted-foreground/50 italic">Aucun thème</span>}
                  </div>
                </MetaField>
              </dl>

              {/* Editorial texts read by the Game Master. */}
              {isExtracts && (
                <div className="space-y-2 border-t pt-3 text-xs">
                  <TranscriptStatusBadge video={t} />
                  {t.transcription && <TextField label="Transcription" clamp="line-clamp-4 whitespace-pre-line">{t.transcription}</TextField>}
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const blocked = transcribeBlockedReason(t);
                      return blocked ? (
                        <span className="text-muted-foreground" data-testid="extract-transcribe-blocked">{blocked}</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => void transcribeSingle(t)} disabled={busy} data-testid="extract-transcribe-one">
                          <Mic className={`h-3 w-3 mr-1 ${transcribingId === t.id ? "animate-pulse" : ""}`} />
                          {transcribingId === t.id ? "Transcription…" : t.transcription?.trim() ? "Retranscrire" : "Transcrire"}
                        </Button>
                      );
                    })()}
                    {transcribeErrors[t.id] && <span className="text-destructive" data-testid="extract-transcribe-error">{transcribeErrors[t.id]}</span>}
                  </div>
                </div>
              )}

              {(t.context || t.description || t.ai_description) && (
                <dl className="space-y-2 border-t pt-3 text-xs">
                  {t.context && <TextField label="Contexte">{t.context}</TextField>}
                  {t.description && <TextField label="Description" clamp="line-clamp-2">{t.description}</TextField>}
                  {t.ai_description && <TextField label="Description IA" clamp="line-clamp-3">{t.ai_description}</TextField>}
                </dl>
              )}
            </div>
          </div>
        );
      })}
    </section>
    <section className="border rounded-lg p-4 space-y-1">
      <h3 className="font-semibold text-base">Décisions</h3>
      <p className="text-sm text-muted-foreground">
        Pourquoi une vidéo a été choisie ou écartée :{" "}
        <a className="underline" href={adminTabPath("video-decisions")}>ouvrir l'onglet Décisions vidéo</a>.
      </p>
    </section>
    </div>
  );
}
