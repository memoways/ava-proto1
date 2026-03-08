import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AVA_NOTION_DATABASES } from "@/services/ragService";
import { clearSystemPromptCache } from "@/agents/maxAgent";
import LLMConfigTab from "@/components/LLMConfigTab";
import VoiceConfigTab from "@/components/VoiceConfigTab";
import GameMasterConfigTab from "@/components/GameMasterConfigTab";

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
      { id: "characters", label: "Personnages" },
      { id: "embeddings", label: "Embeddings" },
      { id: "rag", label: "RAG Test" },
      { id: "sync", label: "Sync Notion" },
    ],
  },
  {
    id: "mechanics",
    label: "🎮 Mécanique",
    tabs: [
      { id: "gamemaster", label: "Game Master" },
    ],
  },
  {
    id: "tech",
    label: "🔧 Technique",
    tabs: [
      { id: "llm", label: "LLM Config" },
      { id: "voice", label: "Voix" },
    ],
  },
];

interface SessionRow {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  trust_level: number | null;
  game_over_reason: string | null;
  duration_seconds: number | null;
  branch: string | null;
  triggers_activated: string[] | null;
  conversation_log: any;
  questionnaire_responses: any;
}

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
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [selectedEmbedding, setSelectedEmbedding] = useState<EmbeddingRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [embFilter, setEmbFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<any[] | null>(null);
  const [ragSearching, setRagSearching] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [editingChar, setEditingChar] = useState<any | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [savingChar, setSavingChar] = useState(false);
  const [activeGroup, setActiveGroup] = useState("data");
  const [activeTab, setActiveTab] = useState("sessions");

  useEffect(() => {
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
      .select("id, name, personality, system_prompt")
      .order("name");
    setCharacters(data || []);
  }

  async function saveCharacterPrompt() {
    if (!editingChar) return;
    setSavingChar(true);
    try {
      const { error, data } = await supabase
        .from("characters")
        .update({ system_prompt: editPrompt })
        .eq("id", editingChar.id)
        .select();
      if (error) {
        console.error("[Admin] Save error:", error);
        toast.error("Erreur: " + error.message);
      } else {
        console.log("[Admin] Saved prompt:", data);
        toast.success(`System prompt de ${editingChar.name} sauvegardé ✓`);
        clearSystemPromptCache();
        setEditingChar({ ...editingChar, system_prompt: editPrompt });
        setCharacters(prev => prev.map(c => c.id === editingChar.id ? { ...c, system_prompt: editPrompt } : c));
      }
    } catch (err) {
      console.error("[Admin] Save exception:", err);
      toast.error("Erreur inattendue lors de la sauvegarde");
    }
    setSavingChar(false);
  }

  async function triggerSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databases: AVA_NOTION_DATABASES }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSyncResult(JSON.stringify(data, null, 2));
      toast.success("Sync Notion terminé !");
      loadEmbeddings();
    } catch (err: any) {
      setSyncResult(`Erreur: ${err.message}`);
      toast.error("Erreur lors du sync");
    } finally {
      setSyncing(false);
    }
  }

  async function testRAG() {
    if (!ragQuery.trim()) return;
    setRagSearching(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/query-rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery, match_count: 10, match_threshold: 0.2 }),
      });
      const data = await res.json();
      setRagResults(data.matches || []);
    } catch {
      toast.error("Erreur RAG");
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Sessions récentes</h2>
                  <Button size="sm" variant="outline" onClick={loadSessions}>
                    Rafraîchir
                  </Button>
                </div>
                <ScrollArea className="h-[70vh] border rounded-lg">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                        selectedSession?.id === s.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-mono text-muted-foreground">
                            {s.id.slice(0, 8)}
                          </span>
                          <p className="text-sm">{fmt(s.started_at)}</p>
                        </div>
                        <div className="text-right text-xs">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full ${
                              s.ended_at
                                ? "bg-green-900/40 text-green-300"
                                : "bg-yellow-900/40 text-yellow-300"
                            }`}
                          >
                            {s.ended_at ? "Terminée" : "En cours"}
                          </span>
                          <p className="mt-1">Trust: {s.trust_level ?? 0} | {s.duration_seconds ?? "—"}s</p>
                        </div>
                      </div>
                      {s.game_over_reason && (
                        <p className="text-xs text-red-400 mt-1">Fin: {s.game_over_reason}</p>
                      )}
                    </button>
                  ))}
                  {sessions.length === 0 && (
                    <p className="p-4 text-muted-foreground text-sm">Aucune session</p>
                  )}
                </ScrollArea>
              </div>

              <div>
                {selectedSession ? (
                  <div className="border rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">
                      Session {selectedSession.id.slice(0, 8)}
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <Stat label="Début" value={fmt(selectedSession.started_at)} />
                      <Stat label="Fin" value={fmt(selectedSession.ended_at)} />
                      <Stat label="Trust" value={String(selectedSession.trust_level ?? 0)} />
                      <Stat label="Durée" value={`${selectedSession.duration_seconds ?? "—"}s`} />
                      <Stat label="Branch" value={selectedSession.branch || "—"} />
                      <Stat label="Raison fin" value={selectedSession.game_over_reason || "—"} />
                    </div>

                    {selectedSession.triggers_activated?.length ? (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Triggers activés</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedSession.triggers_activated.map((t) => (
                            <span key={t} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mb-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        Conversation ({Array.isArray(selectedSession.conversation_log) ? selectedSession.conversation_log.length : 0} messages)
                      </p>
                      <ScrollArea className="h-60 border rounded p-2">
                        {Array.isArray(selectedSession.conversation_log) &&
                          selectedSession.conversation_log.map((msg: any, i: number) => (
                            <div key={i} className={`mb-2 text-sm ${msg.role === "max" ? "text-blue-300" : "text-green-300"}`}>
                              <span className="font-bold">{msg.role === "max" ? "Max" : "User"}:</span> {msg.content}
                            </div>
                          ))}
                      </ScrollArea>
                    </div>

                    {selectedSession.questionnaire_responses && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Questionnaire</p>
                        <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 rounded p-3">
                          <Stat label="Note expérience" value={`${selectedSession.questionnaire_responses.experience_rating}/10`} />
                          <Stat label="Mot" value={selectedSession.questionnaire_responses.experience_word || "—"} />
                          <Stat label="NPS" value={`${selectedSession.questionnaire_responses.nps}/10`} />
                          <Stat label="Immersion histoire" value={`${selectedSession.questionnaire_responses.immersion_story}/5`} />
                          <Stat label="Immersion naturel" value={`${selectedSession.questionnaire_responses.immersion_natural}/5`} />
                          <Stat label="Écoute Max" value={`${selectedSession.questionnaire_responses.mechanic_listening}/5`} />
                          <Stat label="Latence gênante" value={selectedSession.questionnaire_responses.mechanic_latency || "—"} />
                          <Stat label="Compris objectif" value={selectedSession.questionnaire_responses.narration_understood || "—"} />
                          <Stat label="Envie continuer" value={`${selectedSession.questionnaire_responses.narration_continue}/5`} />
                          <Stat label="Prêt à payer" value={selectedSession.questionnaire_responses.value_pay || "—"} />
                          <Stat label="Fourchette prix" value={selectedSession.questionnaire_responses.value_price || "—"} />
                          <Stat label="Format préféré" value={selectedSession.questionnaire_responses.value_format || "—"} />
                        </div>
                        {selectedSession.questionnaire_responses.open_feedback && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">Feedback ouvert</p>
                            <p className="text-sm italic">{selectedSession.questionnaire_responses.open_feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    Sélectionne une session pour voir les détails
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== EMBEDDINGS ==================== */}
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

              {ragResults && (
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

          {/* ==================== CHARACTERS ==================== */}
          <TabsContent value="characters">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">Personnages</h2>
                  <Button size="sm" variant="outline" onClick={loadCharacters}>Rafraîchir</Button>
                </div>
                <div className="space-y-2">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setEditingChar(c); setEditPrompt(c.system_prompt || ""); }}
                      className={`w-full text-left p-4 border rounded-lg hover:bg-accent/50 transition-colors ${
                        editingChar?.id === c.id ? "bg-accent border-primary" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.system_prompt?.length || 0} chars</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{c.personality || "—"}</p>
                      <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">{c.system_prompt?.slice(0, 120) || "Aucun system prompt"}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  💡 Le system prompt doit être minimal : rôle, comportement, règles de jeu.
                  Le reste (mémoire, backstory, storyworld) provient du RAG automatiquement.
                </p>
              </div>

              <div>
                {editingChar ? (
                  <div className="border rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-1">System Prompt — {editingChar.name}</h2>
                    <p className="text-xs text-muted-foreground mb-3">
                      Ce prompt est envoyé au LLM. Les règles de jeu et le contexte RAG sont ajoutés automatiquement après.
                    </p>
                    <Textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="min-h-[50vh] font-mono text-sm"
                      placeholder="Écris le system prompt minimal pour ce personnage..."
                    />
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-muted-foreground">{editPrompt.length} caractères</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditPrompt(editingChar.system_prompt || "")}>Annuler</Button>
                        <Button size="sm" onClick={saveCharacterPrompt} disabled={savingChar || editPrompt === (editingChar.system_prompt || "")}>
                          {savingChar ? "Sauvegarde..." : "Sauvegarder"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    Sélectionne un personnage pour éditer son system prompt
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== QUESTIONNAIRES ==================== */}
          <TabsContent value="questionnaires">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Réponses au questionnaire</h2>
                <Button size="sm" variant="outline" onClick={loadSessions}>Rafraîchir</Button>
              </div>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium text-muted-foreground">Session</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Note</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Mot</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">NPS</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Immersion</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Naturel</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Écoute</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Latence</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Compris</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Continuer</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Payer</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Prix</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Format</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Trust</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions
                      .filter((s) => s.questionnaire_responses)
                      .map((s) => {
                        const q = s.questionnaire_responses;
                        return (
                          <tr key={s.id} className="border-b hover:bg-accent/30">
                            <td className="p-2 font-mono text-xs">{s.id.slice(0, 8)}</td>
                            <td className="p-2 text-xs">{fmt(s.started_at)}</td>
                            <td className="p-2 text-center">{q.experience_rating}/10</td>
                            <td className="p-2">{q.experience_word || "—"}</td>
                            <td className="p-2 text-center">{q.nps}/10</td>
                            <td className="p-2 text-center">{q.immersion_story}/5</td>
                            <td className="p-2 text-center">{q.immersion_natural}/5</td>
                            <td className="p-2 text-center">{q.mechanic_listening}/5</td>
                            <td className="p-2 text-xs">{q.mechanic_latency}</td>
                            <td className="p-2 text-xs">{q.narration_understood}</td>
                            <td className="p-2 text-center">{q.narration_continue}/5</td>
                            <td className="p-2 text-xs">{q.value_pay}</td>
                            <td className="p-2 text-xs">{q.value_price || "—"}</td>
                            <td className="p-2 text-xs">{q.value_format || "—"}</td>
                            <td className="p-2 text-center">{s.trust_level ?? 0}</td>
                            <td className="p-2 text-xs max-w-[200px] truncate">{q.open_feedback || "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {sessions.filter((s) => s.questionnaire_responses).length === 0 && (
                  <p className="p-4 text-muted-foreground text-sm text-center">Aucune réponse au questionnaire</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ==================== GAME MASTER ==================== */}
          <TabsContent value="gamemaster">
            <GameMasterConfigTab />
          </TabsContent>

          {/* ==================== LLM CONFIG ==================== */}
          <TabsContent value="llm">
            <LLMConfigTab />
          </TabsContent>

          {/* ==================== VOICE CONFIG ==================== */}
          <TabsContent value="voice">
            <VoiceConfigTab />
          </TabsContent>

          {/* ==================== NOTION SYNC ==================== */}
          <TabsContent value="sync">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold mb-2">Sync Notion → DB</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Synchronise les 4 bases Notion (Characters, Storyworld, Gameplay, Vidéos) vers la base de données et régénère les embeddings.
              </p>
              <div className="border rounded-lg p-4 mb-4">
                <p className="text-xs font-mono text-muted-foreground mb-2">Databases Notion configurées :</p>
                {Object.entries(AVA_NOTION_DATABASES).map(([k, v]) => (
                  <div key={k} className="text-sm flex justify-between py-1">
                    <span className="font-medium">{k}</span>
                    <span className="font-mono text-xs text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
              <Button onClick={triggerSync} disabled={syncing} size="lg">
                {syncing ? "Sync en cours... (peut prendre ~60s)" : "Lancer le Sync"}
              </Button>
              {syncResult && (
                <pre className="mt-4 text-xs bg-muted/30 rounded p-3 overflow-auto max-h-60">{syncResult}</pre>
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
