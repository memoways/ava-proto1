import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AVA_NOTION_DATABASES } from "@/services/ragService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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

  useEffect(() => {
    loadSessions();
    loadEmbeddings();
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">🔧 Admin — Où est Ava ?</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sessions, RAG, Embeddings, Notion Sync
        </p>

        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="sessions">
              Sessions ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="embeddings">
              Embeddings ({embeddings.length})
            </TabsTrigger>
            <TabsTrigger value="rag">RAG Test</TabsTrigger>
            <TabsTrigger value="sync">Notion Sync</TabsTrigger>
          </TabsList>

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
                          <p className="text-sm">
                            {fmt(s.started_at)}
                          </p>
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
                          <p className="mt-1">
                            Trust: {s.trust_level ?? 0} | {s.duration_seconds ?? "—"}s
                          </p>
                        </div>
                      </div>
                      {s.game_over_reason && (
                        <p className="text-xs text-red-400 mt-1">
                          Fin: {s.game_over_reason}
                        </p>
                      )}
                    </button>
                  ))}
                  {sessions.length === 0 && (
                    <p className="p-4 text-muted-foreground text-sm">
                      Aucune session
                    </p>
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
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Triggers activés
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedSession.triggers_activated.map((t) => (
                            <span
                              key={t}
                              className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded"
                            >
                              {t}
                            </span>
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
                            <div
                              key={i}
                              className={`mb-2 text-sm ${
                                msg.role === "max"
                                  ? "text-blue-300"
                                  : "text-green-300"
                              }`}
                            >
                              <span className="font-bold">
                                {msg.role === "max" ? "Max" : "User"}:
                              </span>{" "}
                              {msg.content}
                            </div>
                          ))}
                      </ScrollArea>
                    </div>

                    {selectedSession.questionnaire_responses && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">
                          Questionnaire
                        </p>
                        <pre className="text-xs bg-muted/30 rounded p-2 overflow-auto max-h-40">
                          {JSON.stringify(selectedSession.questionnaire_responses, null, 2)}
                        </pre>
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
                  <Button
                    size="sm"
                    variant={embFilter === "all" ? "default" : "outline"}
                    onClick={() => setEmbFilter("all")}
                  >
                    Tous ({embeddings.length})
                  </Button>
                  {uniqueSources.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={embFilter === s ? "default" : "outline"}
                      onClick={() => setEmbFilter(s)}
                    >
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
                        <span className="text-xs font-mono text-muted-foreground">
                          {e.source_table}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 line-clamp-2">
                        {e.content.slice(0, 120)}...
                      </p>
                    </button>
                  ))}
                </ScrollArea>
              </div>

              <div>
                {selectedEmbedding ? (
                  <div className="border rounded-lg p-4">
                    <h2 className="text-lg font-semibold mb-2">
                      Embedding Detail
                    </h2>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <Stat label="Source" value={selectedEmbedding.source_table} />
                      <Stat label="Source ID" value={selectedEmbedding.source_id.slice(0, 8)} />
                      <Stat label="Créé" value={fmt(selectedEmbedding.created_at)} />
                      <Stat label="Longueur" value={`${selectedEmbedding.content.length} chars`} />
                    </div>
                    <ScrollArea className="h-[55vh] border rounded p-3">
                      <pre className="text-sm whitespace-pre-wrap">
                        {selectedEmbedding.content}
                      </pre>
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
                  <p className="text-sm text-muted-foreground mb-2">
                    {ragResults.length} résultat(s)
                  </p>
                  {ragResults.map((m: any, i: number) => (
                    <div key={m.id} className="border rounded-lg p-3 mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          #{i + 1} — {m.source_table}
                        </span>
                        <span>
                          Similarité: {(m.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap">{m.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ==================== SYNC ==================== */}
          <TabsContent value="sync">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold mb-2">Sync Notion → DB</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Synchronise les 4 bases Notion (Characters, Storyworld, Gameplay,
                Vidéos) vers la base de données et régénère les embeddings.
              </p>
              <div className="border rounded-lg p-4 mb-4">
                <p className="text-xs font-mono text-muted-foreground mb-2">
                  Databases Notion configurées :
                </p>
                {Object.entries(AVA_NOTION_DATABASES).map(([k, v]) => (
                  <div key={k} className="text-sm flex justify-between py-1">
                    <span className="font-medium">{k}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <Button onClick={triggerSync} disabled={syncing} size="lg">
                {syncing ? "Sync en cours... (peut prendre ~60s)" : "Lancer le Sync"}
              </Button>
              {syncResult && (
                <pre className="mt-4 text-xs bg-muted/30 rounded p-3 overflow-auto max-h-60">
                  {syncResult}
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
