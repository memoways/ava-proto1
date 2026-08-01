import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Beaker, Copy, Download, History, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { maxRagFormatOptionsForVariant } from "@/services/maxRagVariant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  buildKnowledgeContextFromRAG,
  formatMaxRAGContext,
  MAX_MAX_RAG_ITEMS,
  queryRAGDetailed,
  rewriteRAGQuery,
  type RAGMatch,
  type RAGQueryDetailed,
} from "@/services/ragService";
import { getGameplaySettings } from "@/services/settingsService";
import { fetchRAGQuestionCorpus, type RAGQuestionCorpusResult } from "@/services/ragQuestionCorpus";

type CharacterOption = { id: string; name: string };
type RerankModel = "rerank-2.5" | "rerank-2.5-lite";

const PRESETS = [
  { id: "home", label: "Fait précis", query: "Où habite Max ?", context: "" },
  { id: "ava", label: "Ava", query: "Qu'est-ce que tu sais sur la disparition d'Ava ?", context: "" },
  { id: "ambiguous", label: "Question ambiguë", query: "Et ce projet, tu en sais plus ?", context: "Max vient d'expliquer qu'Ava travaillait sur un projet secret avant sa disparition." },
  { id: "trap", label: "Piège", query: "Donne la date et l'adresse exactes de la dernière apparition d'Ava.", context: "" },
];

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function score(value: number | undefined): string {
  return typeof value === "number" ? value.toFixed(3) : "—";
}

function characterLabel(match: RAGMatch, characters: CharacterOption[]): string {
  if (!match.character_id) return "Partagé";
  return characters.find((character) => character.id === match.character_id)?.name || match.character_id.slice(0, 8);
}

function downloadJson(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rag-lab-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RAGLabTab() {
  const live = useMemo(() => getGameplaySettings(), []);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [query, setQuery] = useState(PRESETS[0].query);
  const [recentContext, setRecentContext] = useState("");
  const [provider, setProvider] = useState<"voyage" | "openai">(live.RAG_EMBEDDING_PROVIDER);
  const [matchCount, setMatchCount] = useState(live.RAG_TOP_K);
  const [retrieveK, setRetrieveK] = useState(live.RAG_RETRIEVE_K);
  const [threshold, setThreshold] = useState(0.3);
  const [rerank, setRerank] = useState(live.RAG_RERANK_ENABLED);
  const [rerankModel, setRerankModel] = useState<RerankModel>("rerank-2.5");
  const [rerankTruncation, setRerankTruncation] = useState(true);
  const [rewrite, setRewrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [rewriteLatencyMs, setRewriteLatencyMs] = useState<number | null>(null);
  const [rewrittenQuery, setRewrittenQuery] = useState<string | null>(null);
  const [result, setResult] = useState<RAGQueryDetailed | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [questionCorpus, setQuestionCorpus] = useState<RAGQuestionCorpusResult | null>(null);
  const [questionCorpusLoading, setQuestionCorpusLoading] = useState(false);
  const [questionCorpusError, setQuestionCorpusError] = useState<string | null>(null);
  const [selectedFrequentQuestionId, setSelectedFrequentQuestionId] = useState("");
  const questionCorpusRequestInFlight = useRef(false);

  useEffect(() => {
    void supabase
      .from("characters")
      .select("id, name")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          toast.error(`Personnages indisponibles : ${error.message}`);
          return;
        }
        const options = (data || []) as CharacterOption[];
        setCharacters(options);
        const preferred = options.find((character) => character.name.toLowerCase() === "max") || options[0];
        if (preferred) setCharacterId(preferred.id);
      });
  }, []);

  const loadQuestionCorpus = useCallback(async (forceRefresh = false, notify = false) => {
    if (questionCorpusRequestInFlight.current) return;
    questionCorpusRequestInFlight.current = true;
    setQuestionCorpusLoading(true);
    try {
      const corpus = await fetchRAGQuestionCorpus(forceRefresh);
      setQuestionCorpus(corpus);
      setQuestionCorpusError(corpus.error);
      if (notify) {
        if (corpus.processing) toast.success("Analyse complète lancée en arrière-plan");
        else toast.success(`${corpus.questions.length} questions types actualisées`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setQuestionCorpusError(message);
      if (notify) toast.error(`Questions passées indisponibles : ${message}`);
    } finally {
      questionCorpusRequestInFlight.current = false;
      setQuestionCorpusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuestionCorpus(false);
    const refreshInterval = window.setInterval(() => void loadQuestionCorpus(false), 5 * 60_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadQuestionCorpus]);

  useEffect(() => {
    if (!questionCorpus?.processing) return;
    const poll = window.setInterval(() => void loadQuestionCorpus(false), 3_000);
    return () => window.clearInterval(poll);
  }, [loadQuestionCorpus, questionCorpus?.processing]);

  const character = characters.find((option) => option.id === characterId);
  const finalRankById = useMemo(
    () => new Map((result?.matches || []).map((match, index) => [match.id, index + 1])),
    [result],
  );
  const candidateById = useMemo(
    () => new Map((result?.retrievalMatches || []).map((match) => [match.id, match])),
    [result],
  );
  const selectedMatches = useMemo(() => {
    if (!result) return [];
    return selectedIds
      .map((id) => result.matches.find((match) => match.id === id) || candidateById.get(id))
      .filter((match): match is RAGMatch => Boolean(match));
  }, [candidateById, result, selectedIds]);
  const formattedContext = useMemo(
    () => formatMaxRAGContext(selectedMatches, maxRagFormatOptionsForVariant(live.MAX_PROMPT_VARIANT)),
    [selectedMatches, live.MAX_PROMPT_VARIANT],
  );
  const knowledgeContext = useMemo(() => buildKnowledgeContextFromRAG(selectedMatches), [selectedMatches]);
  const selectedFrequentQuestion = questionCorpus?.questions.find((item) => item.id === selectedFrequentQuestionId);

  async function runExperiment() {
    if (!query.trim()) {
      toast.error("Saisissez une question à rechercher");
      return;
    }
    if (!characterId) {
      toast.error("Sélectionnez un personnage");
      return;
    }

    const safeMatchCount = clampNumber(matchCount, 1, 20);
    const safeRetrieveK = clampNumber(Math.max(retrieveK, safeMatchCount), safeMatchCount, 100);
    const safeThreshold = clampNumber(threshold, 0, 1);
    setMatchCount(safeMatchCount);
    setRetrieveK(safeRetrieveK);
    setThreshold(safeThreshold);
    setRunning(true);
    setResult(null);
    setSelectedIds([]);
    setRewrittenQuery(null);
    setRewriteLatencyMs(null);

    try {
      let rewritten: string | null = null;
      if (rewrite) {
        const rewriteStartedAt = performance.now();
        rewritten = await rewriteRAGQuery(query.trim(), recentContext.trim(), character?.name);
        setRewriteLatencyMs(Math.round(performance.now() - rewriteStartedAt));
        setRewrittenQuery(rewritten);
      }

      const response = await queryRAGDetailed(
        query.trim(),
        recentContext.trim(),
        safeMatchCount,
        safeThreshold,
        {
          characterId,
          provider,
          rerank,
          retrieveK: safeRetrieveK,
          rewrittenQuery: rewritten || undefined,
          rerankModel,
          rerankTruncation,
          includeRetrievalMatches: true,
          timeoutMs: 20_000,
        },
      );
      setResult(response);
      setSelectedIds(response.matches.slice(0, MAX_MAX_RAG_ITEMS).map((match) => match.id));
      if (response.error) toast.error(response.error);
      else if (response.rerankError) toast.warning("Recherche terminée, mais le reranking a échoué");
      else toast.success(`${response.matches.length} résultat(s) final(aux)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  }

  function toggleSelection(id: string, checked: boolean) {
    if (checked) {
      if (selectedIds.includes(id)) return;
      if (selectedIds.length >= MAX_MAX_RAG_ITEMS) {
        toast.info(`Le prompt Max injecte au maximum ${MAX_MAX_RAG_ITEMS} souvenirs`);
        return;
      }
      setSelectedIds((current) => [...current, id]);
      return;
    }
    setSelectedIds((current) => current.filter((selectedId) => selectedId !== id));
  }

  function copyContext() {
    void navigator.clipboard.writeText(formattedContext).then(() => toast.success("Contexte injecté copié"));
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Laboratoire RAG</h2>
          <Badge variant="outline">isolé du live</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Expérimentez la recherche d’un personnage et observez précisément quels candidats sont retrouvés, rerankés, puis injectés dans le prompt de Max.
          Aucun réglage choisi ici n’est sauvegardé en production.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">1. Question et périmètre</CardTitle>
          <CardDescription>Les chunks du personnage sélectionné et les chunks partagés sont les seuls documents éligibles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 tablet-lg:grid-cols-[260px_1fr]">
            <div className="space-y-2">
              <Label>Personnage</Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger><SelectValue placeholder="Choisir un personnage" /></SelectTrigger>
                <SelectContent>{characters.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Preset technique</Label>
              <Select onValueChange={(id) => {
                const preset = PRESETS.find((item) => item.id === id);
                if (preset) { setQuery(preset.query); setRecentContext(preset.context); setSelectedFrequentQuestionId(""); }
              }}>
                <SelectTrigger><SelectValue placeholder="Charger un exemple…" /></SelectTrigger>
                <SelectContent>{PRESETS.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2 rounded-lg border bg-muted/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label className="flex items-center gap-2"><History className="h-4 w-4" /> Questions fréquentes des conversations</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tous les tours utilisateurs sont filtrés, analysés par intention sémantique, puis synthétisés en questions autonomes et réellement utiles au RAG.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadQuestionCorpus(true, true)} disabled={questionCorpusLoading || questionCorpus?.processing}>
                <RefreshCw className={`mr-1 h-4 w-4 ${questionCorpusLoading || questionCorpus?.processing ? "animate-spin" : ""}`} /> Régénérer l’analyse
              </Button>
            </div>
            <Select
              value={selectedFrequentQuestionId}
              onValueChange={(id) => {
                const frequentQuestion = questionCorpus?.questions.find((item) => item.id === id);
                if (!frequentQuestion) return;
                setSelectedFrequentQuestionId(id);
                setQuery(frequentQuestion.question);
              }}
              disabled={(questionCorpusLoading || questionCorpus?.processing) && !questionCorpus?.questions.length}
            >
              <SelectTrigger aria-label="Questions fréquentes des conversations">
                <SelectValue placeholder={questionCorpusLoading || questionCorpus?.processing ? "Analyse sémantique en arrière-plan…" : "Choisir parmi les questions les plus posées…"} />
              </SelectTrigger>
              <SelectContent>
                {(questionCorpus?.questions || []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.pinned ? "★ " : ""}{item.question} · {item.occurrences}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {questionCorpus?.questions.length ?? 0} types synthétiques · {questionCorpus?.sourceQuestionCount ?? 0} questions retenues sur {questionCorpus?.userTurnCount ?? 0} tours · {questionCorpus?.sessionCount ?? 0} sessions
              </span>
              {questionCorpus?.updatedAt && <span>· actualisé à {new Date(questionCorpus.updatedAt).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</span>}
              {questionCorpus?.excludedQuestionCount !== undefined && <Badge variant="outline">{questionCorpus.excludedQuestionCount} bruits/fragments écartés</Badge>}
              <Badge variant="outline">cache serveur</Badge>
              {questionCorpus?.processing && <Badge variant="secondary"><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> analyse en cours</Badge>}
              {questionCorpus?.stale && !questionCorpus.processing && <Badge variant="secondary">mise à jour programmée</Badge>}
            </div>
            {selectedFrequentQuestion && (
              <div className="rounded-md border bg-background/50 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedFrequentQuestion.pinned && <Badge>Épinglée depuis Sessions</Badge>}
                  <Badge variant="secondary">{selectedFrequentQuestion.occurrences} occurrence{selectedFrequentQuestion.occurrences > 1 ? "s" : ""}</Badge>
                  {selectedFrequentQuestion.theme && <Badge variant="outline">{selectedFrequentQuestion.theme}</Badge>}
                  {selectedFrequentQuestion.characterNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>)}
                </div>
                {selectedFrequentQuestion.variants.length > 1 && (
                  <p className="mt-2 text-muted-foreground">Variantes regroupées : {selectedFrequentQuestion.variants.join(" · ")}</p>
                )}
              </div>
            )}
            {questionCorpusError && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">Chargement impossible : {questionCorpusError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Question manuelle ou sélectionnée</Label>
            <Textarea
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSelectedFrequentQuestionId(""); }}
              className="min-h-20"
            />
          </div>
          <div className="space-y-2">
            <Label>Contexte récent (optionnel)</Label>
            <Textarea
              value={recentContext}
              onChange={(event) => setRecentContext(event.target.value)}
              className="min-h-20"
              placeholder="Les dernières phrases utiles de la conversation…"
            />
            <p className="text-xs text-muted-foreground">Sans réécriture, ce contexte est ajouté à la question pour calculer l’embedding de recherche.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="h-4 w-4" /> 2. Paramètres de l’expérience</CardTitle>
          <CardDescription>Valeurs locales à ce test. Les valeurs live actuelles sont indiquées sous les champs concernés.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label>Fournisseur d’embedding</Label>
              <Select value={provider} onValueChange={(value: "voyage" | "openai") => setProvider(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voyage">Voyage · voyage-3</SelectItem>
                  <SelectItem value="openai">OpenAI · text-embedding-3-small</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Live : {live.RAG_EMBEDDING_PROVIDER}</p>
            </div>
            <div className="space-y-2">
              <Label>Seuil cosine initial</Label>
              <Input type="number" min="0" max="1" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
              <p className="text-xs text-muted-foreground">Élimine les candidats avant reranking.</p>
            </div>
            <div className="space-y-2">
              <Label>Vivier de candidats (retrieve_k)</Label>
              <Input type="number" min="1" max="100" value={retrieveK} onChange={(event) => setRetrieveK(Number(event.target.value))} disabled={!rerank || provider !== "voyage"} />
              <p className="text-xs text-muted-foreground">Utilisé avant reranking · live : {live.RAG_RETRIEVE_K}</p>
            </div>
            <div className="space-y-2">
              <Label>Résultats finaux (top_k)</Label>
              <Input type="number" min="1" max="20" value={matchCount} onChange={(event) => setMatchCount(Number(event.target.value))} />
              <p className="text-xs text-muted-foreground">Live : {live.RAG_TOP_K} · Max en injecte au plus {MAX_MAX_RAG_ITEMS}.</p>
            </div>
          </div>

          <div className="grid gap-4 rounded-lg border bg-muted/10 p-4 md:grid-cols-3">
            <div className="flex items-start justify-between gap-3">
              <div><Label>Réécriture LLM</Label><p className="mt-1 text-xs text-muted-foreground">Transforme une question ambiguë en requête autonome.</p></div>
              <Switch checked={rewrite} onCheckedChange={setRewrite} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div><Label>Reranking Voyage</Label><p className="mt-1 text-xs text-muted-foreground">Reclasse le vivier après la recherche vectorielle.</p></div>
              <Switch checked={rerank} onCheckedChange={setRerank} disabled={provider !== "voyage"} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <div><Label>Troncature Voyage</Label><p className="mt-1 text-xs text-muted-foreground">Autorise Voyage à raccourcir une entrée trop longue.</p></div>
              <Switch checked={rerankTruncation} onCheckedChange={setRerankTruncation} disabled={!rerank || provider !== "voyage"} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Modèle de reranking</Label>
              <Select value={rerankModel} onValueChange={(value: RerankModel) => setRerankModel(value)} disabled={!rerank || provider !== "voyage"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rerank-2.5">rerank-2.5 · qualité</SelectItem>
                  <SelectItem value="rerank-2.5-lite">rerank-2.5-lite · vitesse/coût</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Embedding verrouillé :</strong> les documents sont indexés en Voyage 1024 dimensions. Changer de modèle exige un rebuild complet des embeddings.
            </div>
          </div>

          <Button onClick={runExperiment} disabled={running || !characterId || !query.trim()} size="lg">
            <Search className="mr-2 h-4 w-4" /> {running ? "Expérience en cours…" : "Lancer l’expérience RAG"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">3. Mécanique observée</CardTitle>
                  <CardDescription>Ce parcours explique pourquoi un chunk atteint — ou non — le prompt final.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadJson({ query, recentContext, character, result, selectedIds, formattedContext, knowledgeContext })}>
                  <Download className="mr-1 h-4 w-4" /> Export JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{result.error}</div>}
              {result.rerankError && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">Reranking en échec : {result.rerankError}. L’ordre vectoriel a été conservé.</div>}
              <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
                <div className="rounded-lg border p-3">
                  <Badge variant="outline">A · Entrée</Badge>
                  <p className="mt-2 text-sm font-medium">{rewrite && rewrittenQuery ? "Requête réécrite" : "Question + contexte"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rewriteLatencyMs !== null ? `${rewriteLatencyMs} ms de rewrite` : "Aucun appel LLM"}</p>
                </div>
                <ArrowDown className="mx-auto h-4 w-4 self-center lg:-rotate-90" />
                <div className="rounded-lg border p-3">
                  <Badge variant="outline">B · Retrieval</Badge>
                  <p className="mt-2 text-sm font-medium">{result.retrievalMatches.length} candidat(s)</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.embeddingProvider} · cosine ≥ {result.request.matchThreshold}</p>
                </div>
                <ArrowDown className="mx-auto h-4 w-4 self-center lg:-rotate-90" />
                <div className="rounded-lg border p-3">
                  <Badge variant="outline">C · Reranking</Badge>
                  <p className="mt-2 text-sm font-medium">{result.rerankUsed ? result.rerankModel : "Non appliqué"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{result.rerankUsed ? `${result.retrievalMatches.length} → ${result.matches.length}` : "Ordre cosine conservé"}</p>
                </div>
                <ArrowDown className="mx-auto h-4 w-4 self-center lg:-rotate-90" />
                <div className="rounded-lg border p-3">
                  <Badge variant="outline">D · Injection</Badge>
                  <p className="mt-2 text-sm font-medium">{selectedIds.length} chunk(s) sélectionné(s)</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formattedContext.length} caractères de contexte</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entrée réellement vectorisée</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{result.searchInput}</pre>
                </div>
                <div className="rounded-lg border bg-muted/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requête utilisée par le reranker</p>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{rewrittenQuery || query}</pre>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Latence navigateur : {result.latencyMs} ms · serveur : {result.serverLatencyMs ?? "—"} ms · personnage : {character?.name}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">4. Candidats et décision d’injection</CardTitle>
              <CardDescription>
                Le rang vectoriel mesure la proximité sémantique. Le rang final vient du reranker. Cochez jusqu’à {MAX_MAX_RAG_ITEMS} souvenirs pour simuler précisément le contexte envoyé à Max.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!result.retrievalMatches.length && <p className="py-8 text-center text-sm text-muted-foreground">Aucun candidat au-dessus du seuil. Essayez un seuil plus bas ou une formulation différente.</p>}
              {result.retrievalMatches.map((candidate, index) => {
                const finalMatch = result.matches.find((match) => match.id === candidate.id);
                const finalRank = finalRankById.get(candidate.id);
                const selected = selectedIds.includes(candidate.id);
                return (
                  <div key={candidate.id} className={`rounded-lg border p-4 transition-colors ${selected ? "border-primary/60 bg-primary/5" : "bg-muted/5"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => toggleSelection(candidate.id, checked === true)}
                        aria-label={`Injecter le candidat ${index + 1}`}
                      />
                      <Badge variant={selected ? "default" : "outline"}>{selected ? "Injecté" : "Non injecté"}</Badge>
                      <Badge variant="secondary">{characterLabel(candidate, characters)}</Badge>
                      <Badge variant="outline">{candidate.source_table}</Badge>
                      <div className="ml-auto flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
                        <span>rang vectoriel <strong className="text-foreground">#{candidate.retrieval_rank ?? index + 1}</strong></span>
                        <span>cosine <strong className="text-foreground">{score(candidate.retrieval_similarity ?? candidate.similarity)}</strong></span>
                        <span>rang final <strong className="text-foreground">{finalRank ? `#${finalRank}` : "écarté"}</strong></span>
                        <span>rerank <strong className="text-foreground">{score(finalMatch?.rerank_score)}</strong></span>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{candidate.content}</p>
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">source_id: {candidate.source_id} · chunk_id: {candidate.id}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">5. Texte effectivement injecté</CardTitle>
                  <CardDescription>Cette prévisualisation applique la même limite et la même troncature que le formateur RAG de Max.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={copyContext} disabled={!formattedContext}><Copy className="mr-1 h-4 w-4" /> Copier</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bloc RAG formaté</p>
                <pre className="max-h-[520px] min-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-xs">{formattedContext || "Aucun chunk sélectionné."}</pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexte de connaissance dérivé</p>
                <pre className="max-h-[520px] min-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-xs">{JSON.stringify(knowledgeContext, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
