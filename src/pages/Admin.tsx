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
import TTSConfigTab from "@/components/TTSConfigTab";
import STTConfigTab from "@/components/STTConfigTab";
import GameMasterConfigTab from "@/components/GameMasterConfigTab";
import CharacterEditorTab from "@/components/CharacterEditorTab";
import VideoTriggersEditor from "@/components/VideoTriggersEditor";
import MaxPromptTestTab from "@/components/MaxPromptTestTab";
import PipelineTraceTab from "@/components/PipelineTraceTab";
import AntiHallucinationValidatorTab from "@/components/AntiHallucinationValidatorTab";
import HallucinationMetricsTab from "@/components/HallucinationMetricsTab";
import LatencyBlockingTab from "@/components/LatencyBlockingTab";
import LatencyTelemetryTab from "@/components/LatencyTelemetryTab";
import SessionsTab, { type SessionRow } from "@/components/admin/SessionsTab";
import QuestionnairesTab from "@/components/admin/QuestionnairesTab";
import LLMUsageTab from "@/components/admin/LLMUsageTab";
import VoiceUsageTab from "@/components/admin/VoiceUsageTab";
import VideosListTab from "@/components/admin/VideosListTab";


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
      { id: "rag", label: "RAG Test" },
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
      { id: "giff-start", label: "Démarrage GIFF" },
      { id: "video-triggers", label: "Triggers vidéo" },
      { id: "validator", label: "Validateur" },
      { id: "metrics", label: "Métriques hallu." },
      { id: "latency", label: "Latence & blocage" },
      { id: "latency-telemetry", label: "Latences (PostHog)" },
      { id: "max-test", label: "Test Max" },
      { id: "pipeline", label: "Pipeline" },
    ],
  },
  {
    id: "tech",
    label: "🔧 Technique",
    tabs: [
      { id: "llm", label: "LLM Config" },
      { id: "voice", label: "TTS Config" },
      { id: "stt", label: "STT Config" },
      { id: "usage", label: "Consommation LLM" },
      { id: "voice-usage", label: "Consommation Voix" },
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
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<any[] | null>(null);
  const [ragSearching, setRagSearching] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [editingChar, setEditingChar] = useState<any | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [savingChar, setSavingChar] = useState(false);
  const [activeGroup, setActiveGroup] = useState("data");
  const [activeTab, setActiveTab] = useState("sessions");
  const [searchParams, setSearchParams] = useSearchParams();

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

  async function triggerSync(opts: { wipeAll?: boolean } = {}) {
    setSyncing(true);
    setSyncReport(null);
    try {
      toast.info(opts.wipeAll ? "Wipe & rebuild RAG…" : "Sync Notion…");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databases: {
            characters: AVA_NOTION_DATABASES.characters,
            videos: AVA_NOTION_DATABASES.videos,
          },
          wipe_all: !!opts.wipeAll,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSyncReport({ ...data, synced_at: new Date().toISOString() });
      clearSystemPromptCache();
      toast.success(`Sync OK : ${data.characters_synced} personnage(s), ${data.total_embeddings_in_db} embeddings total`);
      loadEmbeddings();
    } catch (err: any) {
      const msg = err.name === "AbortError" ? "Timeout (>180s)" : err.message;
      setSyncReport({ error: msg });
      toast.error(`Erreur sync : ${msg}`);
    }
    setSyncing(false);
  }

  async function testRAG() {
    if (!ragQuery.trim()) return;
    setRagSearching(true);
    setRagResults(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery, match_count: 10, match_threshold: 0.2 }),
      });
      const raw = await res.text();
      let data: any = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON response */ }

      if (!res.ok || data.error) {
        const rawMsg = typeof data.error === "string" ? data.error : (raw || `HTTP ${res.status}`);
        let friendly = rawMsg;
        if (/insufficient_quota|exceeded your current quota/i.test(rawMsg)) {
          friendly = "Quota OpenAI épuisé (embeddings). Recharge ton compte OpenAI ou bascule les embeddings sur un autre fournisseur.";
        } else if (/OPENAI_API_KEY/i.test(rawMsg)) {
          friendly = "Clé OPENAI_API_KEY manquante côté edge function.";
        } else if (/429/.test(rawMsg)) {
          friendly = "Rate-limit OpenAI (429). Réessaie dans quelques secondes.";
        } else if (/401|403|invalid_api_key/i.test(rawMsg)) {
          friendly = "Clé OpenAI invalide ou non autorisée.";
        }
        toast.error(`RAG indisponible : ${friendly}`);
        setRagResults([]);
        // Stocker le détail brut pour affichage
        (window as any).__lastRagError = rawMsg;
        setRagError(friendly + (rawMsg && rawMsg !== friendly ? `\n\nDétail technique :\n${rawMsg}` : ""));
        return;
      }

      setRagError(null);
      setRagResults(data.matches || []);
    } catch (e: any) {
      const msg = e?.message || "Erreur réseau";
      toast.error(`Erreur RAG : ${msg}`);
      setRagError(msg);
      setRagResults([]);
    } finally {
      setRagSearching(false);
    }
  }

  const filteredEmbeddings =
    embFilter === "all"
      ? embeddings
      : embeddings.filter((e) => e.source_table === embFilter);

  const uniqueSources = [...new Set(embeddings.map((e) => e.source_table))];

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("fr-CH") : "—";

  const currentGroup = TAB_GROUPS.find(g => g.id === activeGroup);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">🔧 Admin — Où est Ava ?</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Pilotage complet de l'expérience narrative
        </p>

        {/* ===== GROUP SELECTOR ===== */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TAB_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => {
                setActiveGroup(group.id);
                setActiveTab(group.tabs[0].id);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
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
          {currentGroup && currentGroup.tabs.length > 1 && (
            <TabsList className="mb-4">
              {currentGroup.tabs.map((tab) => {
                let count = "";
                if (tab.id === "sessions") count = ` (${sessions.length})`;
                if (tab.id === "questionnaires") count = ` (${sessions.filter(s => s.questionnaire_responses).length})`;
                if (tab.id === "characters") count = ` (${characters.length})`;
                if (tab.id === "embeddings") count = ` (${embeddings.length})`;
                return (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}{count}
                  </TabsTrigger>
                );
              })}
            </TabsList>
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

          {/* ==================== RAG TEST ==================== */}
          <TabsContent value="rag">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold mb-2">Test RAG</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Teste la recherche sémantique en envoyant une requête au pipeline RAG.
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && testRAG()}
                  placeholder="Ex: famille de Max, virus, chalet de montagne..."
                  className="flex-1 bg-muted/30 border rounded px-3 py-2 text-sm"
                />
                <Button onClick={testRAG} disabled={ragSearching || !ragQuery.trim()}>
                  {ragSearching ? "Recherche..." : "Chercher"}
                </Button>
              </div>

              {ragError && (
                <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-3 mb-4">
                  <p className="text-sm font-semibold text-destructive mb-1">⚠️ Recherche RAG impossible</p>
                  <pre className="text-xs whitespace-pre-wrap text-destructive/90 font-mono">{ragError}</pre>
                  <p className="text-xs text-muted-foreground mt-2">
                    Astuce : si le quota OpenAI est épuisé, recharge ton compte sur platform.openai.com,
                    ou demande de migrer les embeddings vers Lovable AI Gateway (gratuit).
                  </p>
                </div>
              )}

              {ragResults && !ragError && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{ragResults.length} résultat(s)</p>
                  {ragResults.map((m: any, i: number) => (
                    <div key={m.id} className="border rounded-lg p-3 mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>#{i + 1} — {m.source_table}</span>
                        <span>Similarité: {(m.similarity * 100).toFixed(1)}%</span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap">{m.content}</pre>
                    </div>
                  ))}
                </div>
              )}
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
            <MaxPromptTestTab />
          </TabsContent>

          <TabsContent value="pipeline">
            <PipelineTraceTab />
          </TabsContent>

          {/* ==================== LLM CONFIG ==================== */}
          <TabsContent value="llm">
            <LLMConfigTab />
          </TabsContent>

          {/* ==================== TTS CONFIG ==================== */}
          <TabsContent value="voice">
            <TTSConfigTab />
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
                <Button onClick={() => triggerSync()} disabled={syncing} size="lg">
                  {syncing ? "Sync en cours…" : "Sync incrémental"}
                </Button>
                <Button onClick={() => triggerSync({ wipeAll: true })} disabled={syncing} size="lg" variant="destructive">
                  {syncing ? "Sync en cours…" : "⚠️ Wipe & rebuild RAG"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                « Wipe & rebuild » supprime tous les embeddings puis reconstruit depuis zéro.
                À utiliser après un changement majeur dans Notion ou un changement de provider d'embeddings.
              </p>

              {syncReport && !syncReport.error && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    ✅ Sync terminé le {new Date(syncReport.synced_at).toLocaleString("fr-FR")}
                    {syncReport.wiped_all && <span className="text-xs text-yellow-400">(wipe global)</span>}
                  </div>

                  <div className="space-y-2">
                    {(syncReport.per_character || []).map((c: any) => (
                      <div key={c.id} className="border rounded-lg p-3">
                        <h4 className="font-semibold text-sm mb-1">🎭 {c.name}</h4>
                        <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                          <p>📄 Page : {c.page_chars} chars</p>
                          <p>🧩 RAG : {c.chunks_created} chunks</p>
                          <p>✏️ Champs : {c.prompt_fields_filled}/7 remplis</p>
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
