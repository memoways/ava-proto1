import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { id: "user", label: "Utilisateur", role: "Parle (voix)", color: "bg-primary/15 text-primary border-primary/30" },
  { id: "stt", label: "STT (Deepgram)", role: "Transcription voix → texte", color: "bg-muted text-foreground border-border" },
  { id: "rag", label: "RAG", role: "Récupère contexte narratif", color: "bg-muted text-foreground border-border" },
  { id: "gm-pre", label: "GM pré-tour", role: "Brief : mode, ouverture, faits autorisés, interdits", color: "bg-accent/30 text-accent-foreground border-accent/40" },
  { id: "max", label: "Max Agent", role: "Génère sous contraintes", color: "bg-secondary/40 text-secondary-foreground border-secondary" },
  { id: "validator", label: "Validateur anti-hallucination", role: "Vérifie faits + interdits, retry/fallback", color: "bg-destructive/10 text-destructive-foreground border-destructive/30" },
  { id: "tts", label: "TTS (ElevenLabs)", role: "Lecture audio", color: "bg-muted text-foreground border-border" },
  { id: "gm-post", label: "GM post-tour", role: "trust, trigger vidéo, gate, game over", color: "bg-accent/30 text-accent-foreground border-accent/40" },
];

const GLOSSARY: Array<{ term: string; def: string }> = [
  { term: "GM (Game Master)", def: "Agent LLM arbitre. Avant le tour : produit le brief. Après : score trust, déclenche vidéos." },
  { term: "Max", def: "Personnage incarné. Génère la réponse vocale sous contraintes du brief GM + RAG." },
  { term: "RAG", def: "Retrieval Augmented Generation : récupère des chunks narratifs depuis Notion → Supabase." },
  { term: "Brief de tour", def: "JSON produit par le GM avant Max : mode de parole, faits autorisés, sujets interdits." },
  { term: "Validateur", def: "LLM juge qui vérifie la réponse de Max avant TTS. Régénère si fait inventé." },
  { term: "trust", def: "Score de confiance 0→TRUST_THRESHOLD. Déclenche le gate quand atteint." },
  { term: "Trigger vidéo", def: "Événement narratif déclenché par le GM (famille, secret, disparition)." },
  { term: "Fallback", def: "Réponse de prudence si la régénération échoue après MAX_VALIDATION_RETRIES." },
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
          <ol className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, idx) => (
              <li key={step.id} className="relative">
                <div className={`rounded-md border p-3 h-full ${step.color}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono opacity-70">#{idx + 1}</span>
                    <Badge variant="outline" className="text-[10px]">{step.id}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-sm">{step.label}</p>
                  <p className="text-xs opacity-80 mt-1">{step.role}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Flux : 1→2→3→4→5→6→7 (audio joué) → 8 (en parallèle de TTS pour réduire la latence).
          </p>
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
