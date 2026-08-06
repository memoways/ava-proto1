import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import {
import { getCachedSession } from "@/services/gameAuth";
  getOutputSettings,
  loadOutputSettingsFromDB,
  saveOutputSettingsToDB,
  type OutputMode,
} from "@/services/streamingAvatar";


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Tab group definitions
const TAB_GROUPS = [
  {
    id: "data",
    label: "📊 Données",
    tabs: [
      { id: "sessions", label: "Sessions" },
      { id: "questionnaires", label: "Questionnaires" },
    ],
  },
  {
    id: "content",
    label: "📚 Contenu Notion",
    tabs: [
      { id: "sync", label: "Sync Notion" },
      { id: "videos", label: "Vidéos" },
      { id: "embeddings", label: "Embeddings" },
    ],
  },
  {
    id: "characters",
    label: "🎭 Personnages",
    tabs: [
      { id: "character-editor", label: "Éditeur personnage" },
    ],
  },
  {
    id: "mechanics",
    label: "🎮 Mécanique",
    tabs: [
      { id: "gamemaster", label: "Game Master" },
      
      { id: "video-triggers", label: "Triggers vidéo" },
      { id: "validator", label: "Validateur" },
      { id: "metrics", label: "Métriques hallu." },
      { id: "latency", label: "Latence & blocage" },
      { id: "latency-telemetry", label: "Latences (PostHog)" },
      { id: "max-test", label: "Laboratoire RAG" },
      { id: "pipeline", label: "Traces Max" },
    ],
  },
  {
    id: "tech",
    label: "🔧 Technique",
    tabs: [
      { id: "stt", label: "STT Config" },
      { id: "rag", label: "RAG Config" },
      { id: "llm", label: "LLM Config" },
      { id: "voice", label: "TTS Config" },
      { id: "streaming-avatar", label: "Streaming Avatar Config" },
      { id: "usage", label: "Consommation LLM" },
      { id: "voice-usage", label: "Consommation Voix" },
      { id: "avatar-usage", label: "Consommation Streaming Avatar" },
    ],
  },
];

// SessionRow is imported from SessionsTab

interface EmbeddingRow {
  id: string;
  source_table: string;
  source_id: string;
  content: string;
  created_at: string | null;
  has_embedding: boolean;
}

export default function Admin() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [embeddings, setEmbeddings] = useState<EmbeddingRow[]>([]);
  // selectedSession moved to SessionsTab
  const [selectedEmbedding, setSelectedEmbedding] = useState<EmbeddingRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<any | null>(null);
  const [embFilter, setEmbFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [editingChar, setEditingChar] = useState<any | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [savingChar, setSavingChar] = useState(false);
  const [activeGroup, setActiveGroup] = useState("data");
  const [activeTab, setActiveTab] = useState("sessions");
  const [searchParams, setSearchParams] = useSearchParams();
  const [outputMode, setOutputMode] = useState<OutputMode>(() => getOutputSettings().mode);

  // Lire ?tab=... au montage et lors d'un changement d'URL (ex: lien depuis le tooltip GM fallback)
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    for (const group of TAB_GROUPS) {
      const found = group.tabs.find((t) => t.id === requested);
      if (found) {
        setActiveGroup(group.id);
        setActiveTab(requested);
        return;
      }
    }
  }, [searchParams]);

  // Quand l'utilisateur change d'onglet manuellement, refléter dans l'URL (sans push history)
  useEffect(() => {
    if (searchParams.get("tab") !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [activeTab]);

  useEffect(() => {
    hydrateAllSettings(); // Load all settings from DB into localStorage
    void loadOutputSettingsFromDB().then((settings) => setOutputMode(settings.mode));
    loadSessions();
    loadEmbeddings();
    loadCharacters();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    setSessions((data as SessionRow[]) || []);
    setLoading(false);
  }

  async function loadEmbeddings() {
    const { data } = await supabase
      .from("embeddings")
      .select("id, source_table, source_id, content, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setEmbeddings(
      (data || []).map((e: any) => ({ ...e, has_embedding: true }))
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
      const data = await res.json();
      setSyncReport({ ...data, synced_at: new Date().toISOString(), mode });
      clearSystemPromptCache();
      toast.success(`Sync OK (${mode}) : ${data.characters_synced} personnage(s), ${data.total_embeddings_in_db} embeddings total`);
      loadEmbeddings();
    } catch (err: any) {
      const msg = err.name === "AbortError" ? "Timeout (>180s)" : err.message;
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

  const currentGroup = TAB_GROUPS.find(g => g.id === activeGroup);

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
        <h1 className="text-2xl font-bold mb-1">🔧 Admin — Où est Ava ?</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Pilotage complet de l'expérience narrative
        </p>

        {/* ===== GROUP SELECTOR ===== */}
        <div className="scroll-tabs -mx-4 mb-4 flex gap-2 px-4 tablet:mx-0 tablet:flex-wrap tablet:px-0">
          {TAB_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                setActiveGroup(group.id);
                setActiveTab(group.tabs[0].id);
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {activeGroup === "tech" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3">
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
            <SessionsTab sessions={sessions} onRefresh={loadSessions} />
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

          {/* ==================== GAME MASTER ==================== */}
          <TabsContent value="gamemaster">
            <GameMasterConfigTab />
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
                    {(syncReport.per_character || []).map((c: any) => (
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
