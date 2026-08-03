import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  getGameplaySettings,
  saveGameplaySettings,
  saveGameplaySettingsToDB,
  loadGameplaySettingsFromDB,
  type GameplaySettings,
} from "@/services/settingsService";

function Doc({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground/70">{children}</p>;
}

function Tradeoff({ low, high }: { low: string; high: string }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold text-muted-foreground">↓ Valeur basse — </span>
        <span className="text-muted-foreground/80">{low}</span>
      </div>
      <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 text-xs">
        <span className="font-semibold text-muted-foreground">↑ Valeur haute — </span>
        <span className="text-muted-foreground/80">{high}</span>
      </div>
    </div>
  );
}

export default function RAGConfigTab() {
  const [gameplay, setGameplay] = useState<GameplaySettings>(getGameplaySettings());
  const [saved, setSaved] = useState<GameplaySettings>(getGameplaySettings());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGameplaySettingsFromDB().then((gp) => {
      setGameplay(gp);
      setSaved(gp);
    });
  }, []);

  const hasChanges = JSON.stringify(gameplay) !== JSON.stringify(saved);

  function update(patch: Partial<GameplaySettings>) {
    setGameplay(saveGameplaySettings(patch));
  }

  async function handleSave() {
    setSaving(true);
    await saveGameplaySettingsToDB(gameplay);
    setSaved(gameplay);
    setSaving(false);
    toast.success("Réglages RAG sauvegardés ✓");
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">🔎 Configuration RAG</h2>
          <p className="text-sm text-muted-foreground">
            Récupération augmentée : ce qui est cherché dans le corpus Notion, comment c'est trié, et combien de
            matière arrive dans le prompt de Max.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={hasChanges ? "bg-green-600 hover:bg-green-700" : ""}
        >
          <Save className="mr-1 h-3 w-3" /> {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      {hasChanges && (
        <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/30 px-4 py-2 text-sm text-yellow-300">
          ⚠️ Modifications non sauvegardées — clique « Sauvegarder » pour persister en base de données.
        </div>
      )}

      {/* ===== PIPELINE EXPLAINER ===== */}
      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="text-base font-semibold">🧭 Comment fonctionne le RAG ici</h3>
        <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <strong>Embedding de la question</strong> — la phrase du joueur est convertie en vecteur par le
            fournisseur choisi ci-dessous. Ce vecteur doit provenir du <em>même</em> modèle que celui utilisé pour
            indexer le corpus, sinon les distances n'ont aucun sens.
          </li>
          <li>
            <strong>Recherche vectorielle (pgvector)</strong> — on récupère les <code>retrieve_k</code> chunks les
            plus proches en similarité cosine, en filtrant ceux sous le <code>seuil cosine</code>.
          </li>
          <li>
            <strong>Reranking (Voyage uniquement)</strong> — un modèle de reranking relit la question et chaque
            chunk candidat pour les réordonner sémantiquement. C'est le gain de pertinence le plus important, au
            prix d'un aller-retour réseau supplémentaire.
          </li>
          <li>
            <strong>Sélection finale</strong> — les <code>top_k</code> meilleurs chunks sont injectés dans le prompt
            de Max comme « souvenirs » mobilisables.
          </li>
        </ol>
        <Doc>
          ⚠️ Enjeu transversal : chaque chunk injecté consomme des tokens sur <em>chaque</em> tour de conversation.
          Trop de contexte = latence plus élevée, coût LLM plus élevé, et paradoxalement plus de risque de
          hallucination par dilution (Max s'accroche à un détail hors sujet). Trop peu = Max devient vague et perd
          ses repères factuels.
        </Doc>
      </section>

      {/* ===== EMBEDDING / RERANK PROVIDERS ===== */}
      <section className="space-y-5 rounded-lg border p-4">
        <h3 className="text-base font-semibold">🧬 Fournisseurs</h3>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Fournisseur d'embedding</label>
            <Select
              value={gameplay.RAG_EMBEDDING_PROVIDER}
              onValueChange={(v: "voyage" | "openai") => update({ RAG_EMBEDDING_PROVIDER: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="voyage">Voyage · voyage-3 (reranking dispo)</SelectItem>
                <SelectItem value="openai">OpenAI · text-embedding-3-small</SelectItem>
              </SelectContent>
            </Select>
            <Doc>
              <strong>Voyage</strong> : meilleure qualité sur du français narratif et seule option ouvrant le
              reranking. <strong>OpenAI</strong> : repli utile si Voyage est indisponible, mais sans reranking la
              pertinence repose uniquement sur la distance vectorielle.
            </Doc>
            <Doc>
              ⚠️ Le corpus est indexé en <code>voyage-3</code> (1024 dims). Basculer sur OpenAI ne réindexe pas les
              embeddings existants — à n'utiliser qu'en dépannage, ou après une réindexation complète.
            </Doc>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Modèle de reranking Voyage</label>
            <Select
              value={gameplay.RAG_RERANK_MODEL}
              onValueChange={(v: "rerank-2.5" | "rerank-2.5-lite") => update({ RAG_RERANK_MODEL: v })}
            >
              <SelectTrigger
                className="w-full"
                disabled={!gameplay.RAG_RERANK_ENABLED || gameplay.RAG_EMBEDDING_PROVIDER !== "voyage"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rerank-2.5">rerank-2.5 — qualité maximale</SelectItem>
                <SelectItem value="rerank-2.5-lite">rerank-2.5-lite — latence minimale</SelectItem>
              </SelectContent>
            </Select>
            <Doc>
              <code>rerank-2.5</code> discrimine mieux les nuances proches (deux souvenirs qui parlent du même
              lieu). <code>rerank-2.5-lite</code> est environ 2× plus rapide pour une perte de précision modeste :
              c'est le bon choix si la latence voix-à-voix est la contrainte dominante.
            </Doc>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">Reranking activé</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={gameplay.RAG_RERANK_ENABLED}
              onChange={(e) => update({ RAG_RERANK_ENABLED: e.target.checked })}
            />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">Troncature Voyage autorisée</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={gameplay.RAG_RERANK_TRUNCATION}
              onChange={(e) => update({ RAG_RERANK_TRUNCATION: e.target.checked })}
            />
          </label>
        </div>
        <Doc>
          <strong>Reranking activé</strong> : +150 à 400 ms de latence par tour, mais nettement moins de chunks hors
          sujet dans le prompt. Le désactiver n'a de sens que pour isoler un problème de latence.
        </Doc>
        <Doc>
          <strong>Troncature</strong> : sans elle, un chunk plus long que la fenêtre du reranker fait échouer tout
          l'appel et le système retombe sur les seuls scores vectoriels. Avec elle, la fin du chunk est ignorée pour
          le classement (le texte complet reste injecté). Garder activé sauf test de diagnostic.
        </Doc>
      </section>

      {/* ===== RETRIEVAL TUNING ===== */}
      <section className="space-y-6 rounded-lg border p-4">
        <h3 className="text-base font-semibold">🎚️ Réglages de récupération</h3>

        {/* Seuil cosine */}
        <div>
          <div className="mb-1 flex justify-between">
            <label className="text-sm font-medium text-muted-foreground">Seuil cosine minimal</label>
            <span className="font-mono text-sm">{gameplay.RAG_MATCH_THRESHOLD.toFixed(2)}</span>
          </div>
          <Slider
            value={[gameplay.RAG_MATCH_THRESHOLD]}
            onValueChange={([v]) => update({ RAG_MATCH_THRESHOLD: v })}
            min={0}
            max={0.8}
            step={0.05}
          />
          <Doc>
            Similarité minimale exigée pour qu'un chunk soit même considéré. Sur ce corpus, les bons chunks tombent
            typiquement entre 0.35 et 0.60 ; au-delà de 0.6 on ne garde que les reformulations quasi littérales.
          </Doc>
          <Tradeoff
            low="tout passe, le reranker fait le tri — bon rappel, plus de bruit si le reranking est désactivé."
            high="filtre agressif : sur une question tangente le RAG peut renvoyer 0 souvenir et Max improvise."
          />
        </div>

        {/* retrieve_k */}
        <div>
          <div className="mb-1 flex justify-between">
            <label className="text-sm font-medium text-muted-foreground">Vivier de candidats (retrieve_k)</label>
            <span className="font-mono text-sm">{gameplay.RAG_RETRIEVE_K}</span>
          </div>
          <Slider
            value={[gameplay.RAG_RETRIEVE_K]}
            onValueChange={([v]) => update({ RAG_RETRIEVE_K: v })}
            min={Math.max(1, gameplay.RAG_TOP_K)}
            max={60}
            step={1}
          />
          <Doc>
            Nombre de chunks remontés par la recherche vectorielle <em>avant</em> reranking. Le reranker ne peut pas
            repêcher un bon souvenir absent de ce vivier : c'est le plafond du rappel. Règle simple : 3 à 5 fois le
            top_k.
          </Doc>
          <Tradeoff
            low="très rapide, mais un souvenir pertinent mal classé vectoriellement est perdu définitivement."
            high="excellent rappel ; coût reranking et latence Voyage augmentent proportionnellement."
          />
        </div>

        {/* top_k */}
        <div>
          <div className="mb-1 flex justify-between">
            <label className="text-sm font-medium text-muted-foreground">Résultats finaux (top_k)</label>
            <span className="font-mono text-sm">{gameplay.RAG_TOP_K}</span>
          </div>
          <Slider
            value={[gameplay.RAG_TOP_K]}
            onValueChange={([v]) => update({ RAG_TOP_K: v })}
            min={1}
            max={15}
            step={1}
          />
          <Doc>
            Chunks réellement injectés dans le prompt de Max. C'est le réglage qui pèse le plus sur les tokens par
            tour et donc sur le coût et le temps de première parole.
          </Doc>
          <Tradeoff
            low="réponses courtes et sûres, mais Max peut manquer un détail que le joueur attend."
            high="beaucoup de matière narrative ; risque de dilution, de digression et de latence perçue."
          />
        </div>
      </section>

      <section className="rounded-lg border bg-muted/20 p-4">
        <h3 className="mb-2 text-sm font-semibold">📋 Config RAG active</h3>
        <pre className="whitespace-pre-wrap font-mono text-xs">
{JSON.stringify(
  {
    RAG_EMBEDDING_PROVIDER: gameplay.RAG_EMBEDDING_PROVIDER,
    RAG_RERANK_ENABLED: gameplay.RAG_RERANK_ENABLED,
    RAG_RERANK_MODEL: gameplay.RAG_RERANK_MODEL,
    RAG_RERANK_TRUNCATION: gameplay.RAG_RERANK_TRUNCATION,
    RAG_MATCH_THRESHOLD: gameplay.RAG_MATCH_THRESHOLD,
    RAG_RETRIEVE_K: gameplay.RAG_RETRIEVE_K,
    RAG_TOP_K: gameplay.RAG_TOP_K,
  },
  null,
  2,
)}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          💡 Pour tester ces valeurs sans les enregistrer, utilise Mécanique → Laboratoire RAG.
        </p>
      </section>
    </div>
  );
}
