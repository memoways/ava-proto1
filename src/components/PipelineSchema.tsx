import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = {
  id: string;
  label: string;
  role: string;
  provider?: string;
  color: string;
  activeInPrd4?: boolean;
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
    provider: "Profil serveur versionné (Voyage 4 temps réel recommandé)",
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
    provider: "Voyage rerank-2.5-lite / 2.5",
    color: "bg-muted text-foreground border-border",
  },
  {
    id: "gm-pre",
    label: "GM pré-tour (simulateur)",
    role: "Non exécuté dans le PRD4 live",
    provider: "OpenRouter (modèle configurable)",
    color: "bg-accent/30 text-accent-foreground border-accent/40",
    activeInPrd4: false,
  },
  {
    id: "max",
    label: "Max Agent",
    role: "Génère la réponse avec RAG, mémoire et guidance du tour précédent",
    provider: "OpenRouter (modèle configurable · google/gemini-2.5-flash par défaut)",
    color: "bg-secondary/40 text-secondary-foreground border-secondary",
  },
  {
    id: "validator",
    label: "Validateur (simulateur)",
    role: "Non exécuté dans le PRD4 live",
    provider: "OpenRouter",
    color: "bg-destructive/10 text-destructive-foreground border-destructive/30",
    activeInPrd4: false,
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
  { term: "GM (Game Master)", def: "En PRD4 live : labels en parallèle et évaluation post-tour pour préparer la suite. Le pré-tour reste réservé au simulateur." },
  { term: "Max", def: "Personnage incarné. Génère la réponse vocale avec RAG, mémoire et éventuelle guidance GM du tour précédent." },
  { term: "RAG", def: "Retrieval Augmented Generation : récupère des chunks narratifs depuis Notion → Supabase (pgvector)." },
  { term: "Query rewrite", def: "Reformulation LLM de la requête pour lever les références contextuelles (ex : « et toi ? » → « Où habites-tu, Max ? »)." },
  { term: "Voyage", def: "Fournisseur d’embeddings et de reranking. Le profil actif fixe un espace vectoriel compatible ; aucun fallback ne peut interroger un index absent." },
  { term: "OpenRouter", def: "Passerelle LLM utilisée pour tout le pipeline conversationnel (Max, GM, validateur, résumé de rôle, résumés Notion)." },
  { term: "Lovable AI Gateway", def: "Passerelle LLM utilisée hors OpenRouter pour les tâches courtes : query rewrite + résumé de session." },
  { term: "Brief de tour", def: "Objet produit uniquement par le banc d'essai GM pré-tour ; non exécuté dans le PRD4 live." },
  { term: "Validateur", def: "Contrôle disponible dans le simulateur ; non exécuté dans le PRD4 live." },
  { term: "trust", def: "Score de confiance 0→TRUST_THRESHOLD. Déclenche le gate quand atteint." },
  { term: "Trigger vidéo", def: "Événement narratif Gumlet déclenché par le GM (famille, secret, disparition)." },
  { term: "Fallback", def: "Réponse de prudence si la régénération échoue après MAX_VALIDATION_RETRIES." },
];

const PROVIDER_SUMMARY = [
  { title: "LLM conversationnels", detail: "OpenRouter — Max, labels GM, GM post-tour et résumé de rôle. GM pré-tour et validateur : simulateur seulement." },
  { title: "LLM utilitaires", detail: "Lovable AI Gateway — query rewrite RAG + résumé de session post-jeu." },
  { title: "Embeddings + rerank", detail: "Profil actif côté serveur (Voyage 4 temps réel recommandé) + rerank-2.5-lite ou rerank-2.5. Les anciens profils restent disponibles pour rollback explicite." },
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
                  {step.activeInPrd4 === false && <Badge variant="outline" className="mt-1 text-[10px]">non exécuté en live</Badge>}
                  <p className="text-xs opacity-80 mt-1">{step.role}</p>
                  {step.provider && (
                    <p className="text-[10px] opacity-70 mt-1 font-mono">{step.provider}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            PRD4 live : STT → RAG → Max → sauvegarde de la trace diagnostique → TTS. Les labels GM tournent en parallèle ; le GM post-tour prépare le tour suivant. Le GM pré-tour et le validateur ne sont pas exécutés.
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
