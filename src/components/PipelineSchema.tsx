import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = {
  id: string;
  label: string;
  role: string;
  provider?: string;
  color: string;
};

const STEPS: Step[] = [
  {
    id: "user",
    label: "Utilisateur",
    role: "Parle (voix, push-to-talk ou VAD)",
    color: "bg-primary/15 text-primary border-primary/30",
  },
  {
    id: "stt",
    label: "STT (façade multi-providers)",
    role: "Transcription voix → texte",
    provider: "Deepgram (défaut) · Whisper · AssemblyAI · Gradium · Gamilab (préparé)",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "rewrite",
    label: "Query rewrite",
    role: "Reformule la requête utilisateur en question autonome",
    provider: "Lovable AI Gateway",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "rag-embed",
    label: "RAG — Embedding",
    role: "Vectorise la requête (1024 dims)",
    provider: "Voyage voyage-3 (fallback OpenAI text-embedding-3-small)",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "rag-search",
    label: "RAG — Recherche pgvector",
    role: "Recherche scopée par personnage (+ chunks partagés NULL)",
    provider: "Supabase Postgres · pgvector",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "rag-rerank",
    label: "RAG — Rerank",
    role: "Re-classe les top-K par pertinence sémantique",
    provider: "Voyage rerank-2.5",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "gm-pre",
    label: "GM pré-tour",
    role: "Brief : mode, ouverture, faits autorisés, interdits",
    provider: "OpenRouter (modèle configurable)",
    color: "bg-accent/30 text-accent-foreground border-accent/40",
  },
  {
    id: "max",
    label: "Max Agent",
    role: "Génère la réponse sous contraintes du brief GM + RAG",
    provider: "OpenRouter (modèle configurable · google/gemini-2.5-flash par défaut)",
    color: "bg-secondary/40 text-secondary-foreground border-secondary",
  },
  {
    id: "validator",
    label: "Validateur anti-hallucination",
    role: "Vérifie faits + interdits, retry/fallback",
    provider: "OpenRouter",
    color: "bg-destructive/10 text-destructive-foreground border-destructive/30",
  },
  {
    id: "tts",
    label: "TTS (façade multi-providers)",
    role: "Lecture audio streaming",
    provider: "ElevenLabs (défaut) · Hume · Inworld · Gradium",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "gm-post",
    label: "GM post-tour",
    role: "trust, trigger vidéo, gate, game over",
    provider: "OpenRouter",
    color: "bg-accent/30 text-accent-foreground border-accent/40",
  },
  {
    id: "summarize",
    label: "Résumés (async)",
    role: "Résumé de session (fin) · résumé de rôle (post-capture)",
    provider: "Lovable AI (session) · OpenRouter (rôle)",
    color: "bg-muted text-foreground border-border",
  },
];

const GLOSSARY: Array<{ term: string; def: string }> = [
  { term: "GM (Game Master)", def: "Agent LLM arbitre. Avant le tour : produit le brief. Après : score trust, déclenche vidéos." },
  { term: "Max", def: "Personnage incarné. Génère la réponse vocale sous contraintes du brief GM + RAG." },
  { term: "RAG", def: "Retrieval Augmented Generation : récupère des chunks narratifs depuis Notion → Supabase (pgvector)." },
  { term: "Query rewrite", def: "Reformulation LLM de la requête pour lever les références contextuelles (ex : « et toi ? » → « Où habites-tu, Max ? »)." },
  { term: "Voyage", def: "Fournisseur d'embeddings + rerank (voyage-3 · rerank-2.5). OpenAI reste en fallback si Voyage indisponible." },
  { term: "OpenRouter", def: "Passerelle LLM utilisée pour tout le pipeline conversationnel (Max, GM, validateur, résumé de rôle, résumés Notion)." },
  { term: "Lovable AI Gateway", def: "Passerelle LLM utilisée hors OpenRouter pour les tâches courtes : query rewrite + résumé de session." },
  { term: "Brief de tour", def: "JSON produit par le GM avant Max : mode de parole, faits autorisés, sujets interdits." },
  { term: "Validateur", def: "LLM juge qui vérifie la réponse de Max avant TTS. Régénère si fait inventé." },
  { term: "trust", def: "Score de confiance 0→TRUST_THRESHOLD. Déclenche le gate quand atteint." },
  { term: "Trigger vidéo", def: "Événement narratif Gumlet déclenché par le GM (famille, secret, disparition)." },
  { term: "Fallback", def: "Réponse de prudence si la régénération échoue après MAX_VALIDATION_RETRIES." },
];

const PROVIDER_SUMMARY = [
  { title: "LLM conversationnels", detail: "OpenRouter — Max, GM (pré + post), validateur anti-hallucination, résumé de rôle, résumés Notion." },
  { title: "LLM utilitaires", detail: "Lovable AI Gateway — query rewrite RAG + résumé de session post-jeu." },
  { title: "Embeddings + rerank", detail: "Voyage AI (voyage-3 + rerank-2.5). OpenAI text-embedding-3-small en fallback si Voyage renvoie 0." },
  { title: "STT", detail: "Façade multi-providers (src/services/stt) — Deepgram par défaut, Whisper / AssemblyAI / Gradium / Gamilab sélectionnables." },
  { title: "TTS", detail: "Façade multi-providers (src/services/tts) — ElevenLabs par défaut, Hume / Inworld / Gradium sélectionnables." },
];

export default function PipelineSchema() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🧩 Schéma du pipeline conversationnel</CardTitle>
          <CardDescription>Flux complet d'un tour de jeu, de la voix utilisateur à la mise à jour d'état.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, idx) => (
              <li key={step.id} className="relative">
                <div className={`rounded-md border p-3 h-full ${step.color}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono opacity-70">#{idx + 1}</span>
                    <Badge variant="outline" className="text-[10px]">{step.id}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-sm">{step.label}</p>
                  <p className="text-xs opacity-80 mt-1">{step.role}</p>
                  {step.provider && (
                    <p className="text-[10px] opacity-70 mt-1 font-mono">{step.provider}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Flux : 1→2→3 (rewrite) → 4→5→6 (RAG) → 7 (brief) → 8 (Max) → 9 (validateur) → 10 (TTS joué) · 11 (GM post en parallèle du TTS) · 12 (résumés async en fin de session).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔌 Dépendances externes</CardTitle>
          <CardDescription>Vue synthétique des passerelles LLM et fournisseurs voix / RAG.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {PROVIDER_SUMMARY.map((p) => (
              <li key={p.title} className="rounded-md border p-3">
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{p.detail}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">📖 Glossaire</CardTitle>
          <CardDescription>Termes utilisés dans l'orchestration.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <div key={g.term} className="rounded-md border p-3">
                <dt className="text-sm font-semibold">{g.term}</dt>
                <dd className="text-xs text-muted-foreground mt-1">{g.def}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
