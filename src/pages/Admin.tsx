import { getCachedSession } from "@/services/gameAuth";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import { clearSystemPromptCache } from "@/agents/maxAgent";
import { hydrateAllSettings } from "@/services/settingsService";
import LLMConfigTab from "@/components/LLMConfigTab";
import RAGConfigTab from "@/components/RAGConfigTab";
import TTSConfigTab from "@/components/TTSConfigTab";
import STTConfigTab from "@/components/STTConfigTab";
import GameMasterConfigTab from "@/components/GameMasterConfigTab";
import GameMasterSettingsTab from "@/components/GameMasterSettingsTab";
import CharacterRuntimeSettingsTab from "@/components/CharacterRuntimeSettingsTab";
import CharacterEditorTab from "@/components/CharacterEditorTab";
import VideoTriggersEditor from "@/components/VideoTriggersEditor";
import RAGLabTab from "@/components/RAGLabTab";
import PipelineTraceTab from "@/components/PipelineTraceTab";
import AntiHallucinationValidatorTab from "@/components/AntiHallucinationValidatorTab";
import HallucinationMetricsTab from "@/components/HallucinationMetricsTab";
import LatencyBlockingTab from "@/components/LatencyBlockingTab";
import LatencyTelemetryTab from "@/components/LatencyTelemetryTab";
import SessionsTab, { type SessionRow } from "@/components/admin/SessionsTab";
import QuestionnairesTab from "@/components/admin/QuestionnairesTab";
import LLMUsageTab from "@/components/admin/LLMUsageTab";
import VoiceUsageTab from "@/components/admin/VoiceUsageTab";
import StreamingAvatarUsageTab from "@/components/admin/StreamingAvatarUsageTab";
import VideosListTab from "@/components/admin/VideosListTab";
import StreamingAvatarConfigTab from "@/components/StreamingAvatarConfigTab";
import AlertsTab from "@/components/admin/AlertsTab";
import ExperienceArchitectureTab from "@/components/ExperienceArchitectureTab";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { useAdminEnvironment } from "@/contexts/AdminEnvironmentContext";
import { ENVIRONMENTS, type EnvironmentId } from "@/services/environmentContext";
import { trackEvent } from "@/services/posthogService";
import {
  DEFAULT_ADMIN_TAB,
  LEGACY_GROUP,
  TAB_GROUPS,
  adminSessionPath,
  adminTabPath,
  findAdminTab,
  resolveAdminPath,
} from "@/services/adminNavigation";
import {
  getOutputSettings,
  loadOutputSettingsFromDB,
  saveOutputSettingsToDB,
  type OutputMode,
} from "@/services/streamingAvatar";


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// SessionRow is imported from SessionsTab

interface EmbeddingRow {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  created_at: string | null;
  has_embedding: boolean;
}

interface CharacterRow {
  id: string;
  name: string;
  personality: string | null;
  system_prompt: string | null;
  updated_at: string | null;
}

interface SyncMappingWarning {
  character?: string;
  field: string;
  expected_notion_property: string;
  accepted_aliases: string[];
  reason: "property_missing" | "property_empty";
  message: string;
}

interface SyncCharacterReport {
  id: string;
  name: string;
  mapping_warnings?: SyncMappingWarning[];
  page_chars: number;
  chunks_created: number;
  prompt_fields_filled: number;
  summary_chars: number;
}

interface SyncReport {
  error?: string;
  synced_at?: string;
  mode?: string;
  wiped_all?: boolean;
  in_place_profile_refresh?: boolean;
  rag_profile?: string;
  characters_synced?: number;
  total_embeddings_in_db?: number;
  latency_ms?: number;
  per_character?: SyncCharacterReport[];
  sync_errors?: string[];
  mapping_warnings?: SyncMappingWarning[];
}

export default function Admin() {
  const { profile, environmentId, selectEnvironment } = useAdminEnvironment();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRow[]>([]);
  // selectedSession moved to SessionsTab
  const [selectedEmbedding, setSelectedEmbedding] = useState<EmbeddingRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [embFilter, setEmbFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [editingChar, setEditingChar] = useState<CharacterRow | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [savingChar, setSavingChar] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pathLocation = useMemo(() => resolveAdminPath(location.pathname), [location.pathname]);
  const legacyTab = searchParams.get("tab");
  const requestedLocation = legacyTab ? findAdminTab(legacyTab) : null;
  const defaultLocation = findAdminTab(DEFAULT_ADMIN_TAB)!;
  const activeGroup = requestedLocation?.group.id ?? pathLocation?.group ?? defaultLocation.group.id;
  const activeTab = requestedLocation?.tab.id ?? pathLocation?.tab ?? defaultLocation.tab.id;
  const selectedSessionId = activeTab === "sessions" ? pathLocation?.sessionId ?? null : null;
  const [outputMode, setOutputMode] = useState<OutputMode>(() => getOutputSettings().mode);
  const legacyVisible = searchParams.get("legacy") === "1"
    || activeGroup === "legacy";
  const availableGroups = useMemo(
    () => legacyVisible ? [...TAB_GROUPS, LEGACY_GROUP] : TAB_GROUPS,
    [legacyVisible],
  );

  // Canonicaliser les anciennes URL ?tab=... et les chemins admin incomplets/inconnus.
  useEffect(() => {
    if (requestedLocation) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("tab");
      navigate({ pathname: adminTabPath(requestedLocation.tab.id), search: nextParams.toString() }, { replace: true });
      return;
    }
    if (legacyTab) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("tab");
      navigate({
        pathname: pathLocation ? location.pathname : adminTabPath(DEFAULT_ADMIN_TAB),
        search: nextParams.toString(),
      }, { replace: true });
      return;
    }
    if (!pathLocation) {
      navigate({ pathname: adminTabPath(DEFAULT_ADMIN_TAB), search: searchParams.toString() }, { replace: true });
    }
  }, [legacyTab, location.pathname, navigate, pathLocation, requestedLocation, searchParams]);

  useEffect(() => {
    if (activeGroup !== "legacy") return;
    trackEvent("admin_legacy_view_opened", { tab: activeTab });
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from("admin_legacy_access_log" as never).insert({
        user_id: data.user.id,
        tab: activeTab,
      } as never);
    });
  }, [activeGroup, activeTab]);

  const navigateToTab = (tabId: string) => navigate(adminTabPath(tabId));

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: members }] = await Promise.all([
      supabase.from("sessions").select("*").order("started_at", { ascending: false }).limit(50),
      supabase.from("admin_users" as never).select("user_id,display_name"),
    ]);
    const memberNames = new Map(
      ((members ?? []) as Array<{ user_id: string; display_name: string }>)
        .map((member) => [member.user_id, member.display_name]),
    );
    const withAccount = (session: SessionRow): SessionRow => ({
      ...session,
      account_display_name: session.started_by_user_id
        ? memberNames.get(session.started_by_user_id) ?? "membre"
        : "public",
    });
    const recentSessions = ((data as unknown as SessionRow[]) || []).map(withAccount);
    if (selectedSessionId && !recentSessions.some((session) => session.id === selectedSessionId)) {
      const { data: requestedSession } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", selectedSessionId)
        .maybeSingle();
      if (requestedSession) recentSessions.push(withAccount(requestedSession as unknown as SessionRow));
    }
    setSessions(recentSessions);
    setLoading(false);
  }, [selectedSessionId]);

  useEffect(() => {
    hydrateAllSettings(); // Load all settings from DB into localStorage
    void loadOutputSettingsFromDB().then((settings) => setOutputMode(settings.mode));
    loadEmbeddings();
    loadCharacters();
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function loadEmbeddings() {
    const { data } = await supabase
      .from("embeddings")
      .select("id, source_table, source_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setEmbeddings(
      (data || []).map((e) => ({ ...e, has_embedding: true }))
    );
  }

  async function loadCharacters() {
    const { data } = await supabase
      .from("characters")
      .select("id, name, personality, system_prompt, updated_at")
      .order("name");
    setCharacters(data || []);
  }

  // Short stable hash (FNV-1a 32-bit) for visual fingerprint of a string
  function promptHash(text: string | null | undefined): string {
    if (!text) return "00000000";
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  async function saveCharacterPrompt() {
    if (!editingChar) return;
    setSavingChar(true);
    try {
      const { error } = await supabase
        .from("characters")
        .update({ system_prompt: editPrompt })
        .eq("id", editingChar.id)
        .select();
      if (error) {
        console.error("[Admin] Save error:", error);
        toast.error("Erreur: " + error.message);
      } else {
        // Verify the save by re-reading from DB
        const { data: verifyData } = await supabase
          .from("characters")
          .select("system_prompt, updated_at")
          .eq("id", editingChar.id)
          .single();


        if (verifyData?.system_prompt === editPrompt) {
          console.log("[Admin] Prompt verified in DB ✓", editPrompt.length, "chars");
          toast.success(`System prompt de ${editingChar.name} sauvegardé et vérifié ✓`);
        } else {
          console.warn("[Admin] Prompt verification mismatch!");
          toast.warning("Prompt sauvegardé mais vérification incertaine — rafraîchis la page");
        }

        clearSystemPromptCache();
        const newUpdatedAt = verifyData?.updated_at || new Date().toISOString();
        setEditingChar({ ...editingChar, system_prompt: editPrompt, updated_at: newUpdatedAt });
        setCharacters(prev => prev.map(c => c.id === editingChar.id ? { ...c, system_prompt: editPrompt, updated_at: newUpdatedAt } : c));
      }
    } catch (err) {
      console.error("[Admin] Save exception:", err);
      toast.error("Erreur inattendue lors de la sauvegarde");
    }
    setSavingChar(false);
  }

  async function triggerSync(opts: { wipeAll?: boolean; mode?: "full" | "rag_only" | "fields_only" } = {}) {
    setSyncing(true);
    setSyncReport(null);
    const mode = opts.mode || "rag_only";
    try {
      const label = opts.wipeAll
        ? "Rafraîchissement sécurisé du profil RAG actif…"
        : mode === "rag_only" ? "Sync RAG (pages Notion)…"
        : mode === "fields_only" ? "Sync champs personnages…"
        : "Sync complète (RAG + champs)…";
      toast.info(label);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      const cachedAuthSession = await getCachedSession();
      const token = cachedAuthSession?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          databases: {
            characters: AVA_NOTION_DATABASES.characters,
            videos: AVA_NOTION_DATABASES.videos,
          },
          wipe_all: !!opts.wipeAll,
          mode,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as Omit<SyncReport, "synced_at" | "mode">;
      setSyncReport({ ...data, synced_at: new Date().toISOString(), mode });
      clearSystemPromptCache();
      const errorCount = data.sync_errors?.length || 0;
      const warningCount = data.mapping_warnings?.length || 0;
      if (errorCount > 0) {
        toast.error(`Sync partiel (${mode}) : ${errorCount} erreur(s) — détails dans le rapport ci-dessous`);
      } else if (warningCount > 0) {
        toast.warning(`Sync OK (${mode}) avec ${warningCount} champ(s) Notion non mappé(s) — voir le rapport`);
      } else {
        toast.success(`Sync OK (${mode}) : ${data.characters_synced} personnage(s), ${data.total_embeddings_in_db} embeddings total`);
      }
      loadEmbeddings();
    } catch (err: unknown) {
      const msg = err instanceof DOMException && err.name === "AbortError"
        ? "Timeout (>180s)"
        : err instanceof Error ? err.message : String(err);
      setSyncReport({ error: msg });
      toast.error(`Erreur sync : ${msg}`);
    }
    setSyncing(false);
  }

  const filteredEmbeddings =
    embFilter === "all"
      ? embeddings
      : embeddings.filter((e) => e.source_table === embFilter);

  const uniqueSources = [...new Set(embeddings.map((e) => e.source_table))];

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("fr-CH") : "—";

  const currentGroup = availableGroups.find(g => g.id === activeGroup);

  const changeOutputMode = async (mode: OutputMode) => {
    const previous = outputMode;
    setOutputMode(mode);
    try {
      await saveOutputSettingsToDB({ mode });
      toast.success(mode === "tts" ? "Output Voix TTS activé" : "Output Avatar vidéo activé");
    } catch (error) {
      setOutputMode(previous);
      toast.error(error instanceof Error ? error.message : "Impossible de sauvegarder l'output");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 pr-44">
          <div>
            <h1 className="text-2xl font-bold mb-1">🔧 Admin — Où est Ava ?</h1>
            <p className="text-muted-foreground text-sm">
              Pilotage complet de l'expérience narrative · {profile.display_name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={environmentId} onValueChange={(value) => selectEnvironment(value as EnvironmentId)}>
              <SelectTrigger className="w-[210px]" aria-label="Environnement actif">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENTS.map((environment) => (
                  <SelectItem key={environment.id} value={environment.id}>
                    {environment.type === "production" ? "Production" : `Sandbox — ${environment.label}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <a href={`/?env=${encodeURIComponent(environmentId)}`} target="_blank" rel="noreferrer">
                Tester l'expérience <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {environmentId === "prod" ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-500/40 bg-slate-500/10 px-4 py-2 text-sm font-semibold tracking-wide">
            <ShieldCheck className="h-4 w-4" /> PRODUCTION
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/15 px-4 py-2 text-sm font-bold tracking-wide text-fuchsia-100">
            SANDBOX — {ENVIRONMENTS.find((environment) => environment.id === environmentId)?.label.toUpperCase()}
          </div>
        )}

        {/* ===== GROUP SELECTOR ===== */}
        <div className="scroll-tabs -mx-4 mb-4 flex gap-2 px-4 tablet:mx-0 tablet:flex-wrap tablet:px-0">
          {availableGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                navigateToTab(group.tabs[0].id);
              }}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                activeGroup === group.id
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>


        {/* ===== TABS WITHIN GROUP ===== */}
        <Tabs value={activeTab} onValueChange={navigateToTab} className="w-full">
          {activeGroup === "tech" && (
            <div className="mb-4 space-y-4 rounded-lg border bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Output de Max</p>
                <p className="text-xs text-muted-foreground">
                  Ce choix est figé au démarrage de chaque nouvelle session publique.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={outputMode === "tts" ? "text-sm font-medium" : "text-sm text-muted-foreground"}>Voix TTS</span>
                <Switch
                  checked={outputMode === "streaming_avatar"}
                  onCheckedChange={(checked) => void changeOutputMode(checked ? "streaming_avatar" : "tts")}
                  aria-label="Basculer entre voix TTS et avatar vidéo"
                />
                <span className={outputMode === "streaming_avatar" ? "text-sm font-medium" : "text-sm text-muted-foreground"}>Avatar vidéo</span>
              </div>
              </div>
              {environmentId === "prod" ? <PublicPasswordSetting /> : null}
            </div>
          )}
          {activeGroup === "legacy" && (
            <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
              Accès legacy temporaire journalisé. Ces vues décrivent l’ancien validateur, absent du pipeline PRD4 live.
            </div>
          )}
          {currentGroup && currentGroup.tabs.length > 1 && (
            <div className="scroll-tabs -mx-4 mb-4 px-4 tablet:mx-0 tablet:px-0">
              <TabsList className="h-auto w-max justify-start p-1">
                {currentGroup.tabs.map((tab) => {
                  let count = "";
                  if (tab.id === "sessions") count = ` (${sessions.length})`;
                  if (tab.id === "questionnaires") count = ` (${sessions.filter(s => s.questionnaire_responses).length})`;
                  if (tab.id === "characters") count = ` (${characters.length})`;
                  if (tab.id === "embeddings") count = ` (${embeddings.length})`;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      ref={(node) => {
                        if (node && tab.id === activeTab) {
                          node.scrollIntoView({ block: "nearest", inline: "nearest" });
                        }
                      }}
                      className="min-h-10 shrink-0 whitespace-nowrap"
                    >
                      {tab.label}{count}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
          )}


          {/* ==================== SESSIONS ==================== */}
          <TabsContent value="sessions">
            <SessionsTab
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={(sessionId) => navigate(sessionId ? adminSessionPath(sessionId) : adminTabPath("sessions"))}
              onRefresh={loadSessions}
            />
          </TabsContent>

          {/* ==================== EMBEDDINGS ==================== */}
          <TabsContent value="videos">
            <VideosListTab />
          </TabsContent>

          <TabsContent value="embeddings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h2 className="text-lg font-semibold">Embeddings</h2>
                  <Button size="sm" variant={embFilter === "all" ? "default" : "outline"} onClick={() => setEmbFilter("all")}>
                    Tous ({embeddings.length})
                  </Button>
                  {uniqueSources.map((s) => (
                    <Button key={s} size="sm" variant={embFilter === s ? "default" : "outline"} onClick={() => setEmbFilter(s)}>
                      {s} ({embeddings.filter((e) => e.source_table === s).length})
                    </Button>
                  ))}
                </div>
                <ScrollArea className="h-[70vh] border rounded-lg">
                  {filteredEmbeddings.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedEmbedding(e)}
                      className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                        selectedEmbedding?.id === e.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="text-xs font-mono text-muted-foreground">{e.source_table}</span>
                        <span className="text-xs text-muted-foreground">{e.id.slice(0, 8)}</span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2">{e.content.slice(0, 120)}...</p>
                    </button>
                  ))}
                </ScrollArea>
              </div>

              <div>
                {selectedEmbedding ? (
                  <div className="border rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">Embedding Detail</h2>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <Stat label="Source" value={selectedEmbedding.source_table} />
                      <Stat label="Source ID" value={selectedEmbedding.source_id.slice(0, 8)} />
                      <Stat label="Créé" value={fmt(selectedEmbedding.created_at)} />
                      <Stat label="Longueur" value={`${selectedEmbedding.content.length} chars`} />
                    </div>
                    <ScrollArea className="h-[55vh] border rounded p-3">
                      <pre className="text-sm whitespace-pre-wrap">{selectedEmbedding.content}</pre>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    Sélectionne un embedding pour voir le contenu complet
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== CHARACTER EDITOR ==================== */}
          <TabsContent value="character-editor">
            <CharacterEditorTab />
          </TabsContent>

          {/* ==================== QUESTIONNAIRES ==================== */}
          <TabsContent value="questionnaires">
            <QuestionnairesTab sessions={sessions} onRefresh={loadSessions} />
          </TabsContent>

          {/* ==================== EXPÉRIENCE ==================== */}
          <TabsContent value="architecture">
            <ExperienceArchitectureTab />
          </TabsContent>

          <TabsContent value="gamemaster">
            <GameMasterConfigTab />
          </TabsContent>

          <TabsContent value="gm-settings">
            <GameMasterSettingsTab />
          </TabsContent>

          <TabsContent value="character-runtime">
            <CharacterRuntimeSettingsTab />
          </TabsContent>

          <TabsContent value="video-triggers">
            <VideoTriggersEditor />
          </TabsContent>





          <TabsContent value="validator">
            <AntiHallucinationValidatorTab />
          </TabsContent>

          <TabsContent value="metrics">
            <HallucinationMetricsTab />
          </TabsContent>

          <TabsContent value="latency">
            <LatencyBlockingTab />
          </TabsContent>
          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>
          <TabsContent value="latency-telemetry">
            <LatencyTelemetryTab />
          </TabsContent>

          <TabsContent value="max-test">
            <RAGLabTab />
          </TabsContent>

          <TabsContent value="pipeline">
            <PipelineTraceTab />
          </TabsContent>

          {/* ==================== LLM CONFIG ==================== */}
          <TabsContent value="rag">
            <RAGConfigTab />
          </TabsContent>

          <TabsContent value="llm">
            <LLMConfigTab />
          </TabsContent>

          {/* ==================== TTS CONFIG ==================== */}
          <TabsContent value="voice">
            <TTSConfigTab />
          </TabsContent>

          <TabsContent value="streaming-avatar">
            <StreamingAvatarConfigTab />
          </TabsContent>

          {/* ==================== STT CONFIG ==================== */}
          <TabsContent value="stt">
            <STTConfigTab />
          </TabsContent>

          {/* ==================== LLM USAGE / CONSUMPTION ==================== */}
          <TabsContent value="usage">
            <LLMUsageTab />
          </TabsContent>

          {/* ==================== VOICE USAGE ==================== */}
          <TabsContent value="voice-usage">
            <VoiceUsageTab />
          </TabsContent>

          {/* ============ STREAMING AVATAR USAGE ============ */}
          <TabsContent value="avatar-usage">
            <StreamingAvatarUsageTab />
          </TabsContent>

          {/* ==================== NOTION SYNC ==================== */}
          <TabsContent value="sync">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold mb-2">Sync Notion → DB</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Synchronise la base <strong>Caractères AVA</strong> (seule source) : champs éditoriaux,
                résumé situation actuelle et embeddings RAG (corps de page uniquement, scoping strict par personnage).
              </p>
              <div className="border rounded-lg p-4 mb-4">
                <p className="text-xs font-mono text-muted-foreground mb-2">Database Notion configurée :</p>
                <div className="text-sm flex justify-between py-1">
                  <span className="font-medium">characters</span>
                  <span className="font-mono text-xs text-muted-foreground">{AVA_NOTION_DATABASES.characters}</span>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={() => triggerSync({ mode: "rag_only" })} disabled={syncing} size="lg">
                  {syncing ? "Sync en cours…" : "Sync RAG (pages Notion)"}
                </Button>
                <Button onClick={() => triggerSync({ mode: "full" })} disabled={syncing} size="lg" variant="outline">
                  {syncing ? "Sync en cours…" : "Sync complète (RAG + champs)"}
                </Button>
                <Button onClick={() => triggerSync({ wipeAll: true, mode: "full" })} disabled={syncing} size="lg" variant="outline">
                  {syncing ? "Sync en cours…" : "Rafraîchir le profil actif"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Sync RAG</strong> (par défaut) ne touche QUE les embeddings du corps des pages Notion — les champs éditoriaux des personnages restent intacts.
                <br/><strong>Sync complète</strong> re-synchronise aussi les 8 champs éditoriaux + le résumé de situation (équivalent à un « Resync » par personnage pour tous d'un coup).
                <br/><strong>Rafraîchir le profil actif</strong> remplace les vecteurs personnage par personnage, sans vider tout le corpus live. Pour changer de modèle, construire un profil parallèle dans <strong>Configuration RAG</strong>.
              </p>

              {syncReport && !syncReport.error && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    ✅ Sync terminé le {new Date(syncReport.synced_at).toLocaleString("fr-FR")}
                    {syncReport.wiped_all && <span className="text-xs text-yellow-400">(profil reconstruit)</span>}
                    {syncReport.in_place_profile_refresh && <span className="text-xs text-muted-foreground">(remplacement progressif)</span>}
                    {syncReport.rag_profile && <span className="text-xs text-muted-foreground">{syncReport.rag_profile}</span>}
                  </div>

                  <div className="space-y-2">
                    {(syncReport.per_character || []).map((c) => (
                      <div key={c.id} className="border rounded-lg p-3">
                        <h4 className="font-semibold text-sm mb-1">🎭 {c.name}</h4>
                        <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                          <p>📄 Page : {c.page_chars} chars</p>
                          <p>🧩 RAG : {c.chunks_created} chunks</p>
                          <p>✏️ Champs : {c.prompt_fields_filled}/8 remplis</p>
                          <p>📝 Résumé : {c.summary_chars} chars</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(syncReport.sync_errors || []).length > 0 && (
                    <div className="border border-destructive/40 rounded-lg p-3 bg-destructive/10 space-y-1">
                      <p className="text-sm font-medium text-destructive">
                        ⛔ {syncReport.sync_errors!.length} erreur(s) pendant la sync — les données concernées n'ont pas été mises à jour
                      </p>
                      <ul className="list-disc pl-5 text-xs text-destructive space-y-1">
                        {syncReport.sync_errors!.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}

                  {(syncReport.mapping_warnings || []).length > 0 && (
                    <div className="border border-yellow-500/40 rounded-lg p-3 bg-yellow-500/10 space-y-1">
                      <p className="text-sm font-medium text-yellow-400">
                        ⚠️ {syncReport.mapping_warnings!.length} champ(s) Notion non récupéré(s)
                      </p>
                      <ul className="list-disc pl-5 text-xs text-yellow-200/90 space-y-1">
                        {syncReport.mapping_warnings!.map((w, i) => (
                          <li key={`${w.character}-${w.field}-${i}`}>
                            <strong>{w.character || "—"}</strong> · {w.expected_notion_property} :{" "}
                            {w.reason === "property_missing" ? "propriété absente de Notion" : "propriété vide dans Notion"} — {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-sm font-medium">
                      📊 Total embeddings en base : <span className="font-bold">{syncReport.total_embeddings_in_db}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Latence sync : {syncReport.latency_ms}ms · {syncReport.characters_synced} personnage(s) traité(s)
                    </p>
                  </div>
                </div>
              )}

              {syncReport?.error && (
                <pre className="mt-4 text-xs bg-destructive/10 text-destructive rounded p-3 overflow-auto max-h-60">
                  Erreur: {syncReport.error}
                </pre>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function PublicPasswordSetting() {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 8) {
      toast.error("Utilisez au moins 8 caractères pour le mot de passe public.");
      return;
    }
    setSaving(true);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase
      .from("admin_settings" as never)
      .upsert({
        key: "public_access.password",
        environment_id: "prod",
        value: { sha256 },
        updated_at: new Date().toISOString(),
      } as never, { onConflict: "key,environment_id" });
    setSaving(false);
    if (error) {
      toast.error(`Mot de passe non enregistré : ${error.message}`);
      return;
    }
    setPassword("");
    toast.success("Mot de passe public mis à jour pour les nouvelles visites.");
  };

  return (
    <div className="border-t pt-4">
      <Label htmlFor="public-access-password">Mot de passe d'accès public (global)</Label>
      <p className="mb-2 text-xs text-muted-foreground">
        La valeur actuelle n'est jamais relue dans le navigateur. Saisissez une nouvelle valeur pour la remplacer.
      </p>
      <div className="flex max-w-lg gap-2">
        <Input
          id="public-access-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nouveau mot de passe"
        />
        <Button onClick={() => void save()} disabled={saving || !password}>
          {saving ? "Enregistrement…" : "Mettre à jour"}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
