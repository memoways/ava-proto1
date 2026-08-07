import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  AudioLines,
  Bot,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CloudCog,
  Database,
  FileStack,
  Film,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  Mic2,
  Network,
  Radio,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type FlowId = "conversation" | "knowledge" | "operations";
type ArchitectureLayerId = "interface" | "browser" | "cloud" | "external";

interface ArchitectureNode {
  id: string;
  label: string;
  eyebrow: string;
  summary: string;
  layer: ArchitectureLayerId;
  icon: LucideIcon;
  flows: FlowId[];
  description: string;
  responsibilities: string[];
  exchanges: string[];
  implementation: string[];
}

interface TurnStep {
  id: string;
  number: number;
  label: string;
  shortLabel: string;
  lane: "critical" | "background";
  icon: LucideIcon;
  timing: string;
  promise: string;
  input: string[];
  process: string[];
  output: string[];
  example: string;
  resilience: string;
}

const FLOWS: Array<{ id: FlowId; label: string; description: string; defaultNode: string }> = [
  {
    id: "conversation",
    label: "Tour vocal",
    description: "Micro → compréhension → réponse → voix",
    defaultNode: "prd4-ui",
  },
  {
    id: "knowledge",
    label: "Contenu & RAG",
    description: "Notion → index narratif → faits injectés",
    defaultNode: "notion",
  },
  {
    id: "operations",
    label: "Pilotage & qualité",
    description: "Configuration, traces et mesure",
    defaultNode: "admin-ui",
  },
];

const ARCHITECTURE_LAYERS: Array<{
  id: ArchitectureLayerId;
  index: string;
  title: string;
  subtitle: string;
}> = [
  { id: "interface", index: "01", title: "Interfaces", subtitle: "Ce que voient le public et l’équipe" },
  { id: "browser", index: "02", title: "Runtime navigateur", subtitle: "État, orchestration et média temps réel" },
  { id: "cloud", index: "03", title: "Lovable Cloud", subtitle: "Supabase fourni et opéré par Lovable" },
  { id: "external", index: "04", title: "Services spécialisés", subtitle: "IA, voix, contenu, vidéo et analytics" },
];

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: "prd4-ui",
    label: "Expérience PRD4",
    eyebrow: "React · parcours public",
    summary: "Écrans, micro, sous-titres, personnage et cinématiques",
    layer: "interface",
    icon: UserRound,
    flows: ["conversation", "operations"],
    description: "Le parcours public pilote les phases d’onboarding, l’appel, la conversation et la fin de session. Il affiche immédiatement le texte final produit par Ava, puis confie exactement ce texte au moteur de sortie choisi.",
    responsibilities: [
      "Capturer les gestes utilisateur et l’audio push-to-talk.",
      "Maintenir la phase, les messages, le personnage actif et les sous-titres.",
      "Jouer la voix, l’avatar ou une cinématique sans réécrire la réponse.",
    ],
    exchanges: ["Reçoit une transcription STT.", "Appelle l’orchestrateur PRD4.", "Persiste la conversation en best effort."],
    implementation: ["src/pages/IndexPRD4.tsx", "src/hooks/useExperienceState.ts", "src/components/prd4/*"],
  },
  {
    id: "admin-ui",
    label: "Console admin",
    eyebrow: "React · accès protégé",
    summary: "Contenu, orchestration, qualité et configuration technique",
    layer: "interface",
    icon: LayoutDashboard,
    flows: ["knowledge", "operations"],
    description: "La console permet de piloter l’expérience sans exposer les secrets : versions d’orchestration, profils des personnages, providers, corpus RAG, sessions et observabilité.",
    responsibilities: [
      "Éditer puis publier une orchestration versionnée.",
      "Synchroniser les contenus Notion et vérifier les profils prêts pour le live.",
      "Inspecter les traces, latences, coûts et sessions.",
    ],
    exchanges: ["Lit et écrit via Supabase/RPC.", "Déclenche les Edge Functions d’administration.", "Hydrate les réglages utilisés par le runtime."],
    implementation: ["src/pages/Admin.tsx", "src/services/adminNavigation.ts", "src/components/admin/*"],
  },
  {
    id: "experience-state",
    label: "État d’expérience",
    eyebrow: "Machine d’état locale",
    summary: "Phase, conversation, timer, personnage et reprises",
    layer: "browser",
    icon: RefreshCw,
    flows: ["conversation", "operations"],
    description: "L’état React porte ce qui doit être rendu. Des refs synchrones protègent en parallèle le hot path audio contre les tours obsolètes, les doubles soumissions et les fins de session.",
    responsibilities: ["Faire avancer les phases PRD4.", "Conserver le journal conversationnel courant.", "Annuler proprement un tour ou un rendu audio dépassé."],
    exchanges: ["Alimente l’orchestrateur avec le contexte courant.", "Reçoit la réponse et les décisions du directeur.", "Restaure une session persistée si elle est reprenable."],
    implementation: ["src/hooks/useExperienceState.ts", "src/pages/IndexPRD4.tsx", "src/services/sessionConversationMemory.ts"],
  },
  {
    id: "turn-orchestrator",
    label: "Orchestrateur de tour",
    eyebrow: "Chemin critique PRD4",
    summary: "RAG → prompt Max → réponse, puis directeur asynchrone",
    layer: "browser",
    icon: Workflow,
    flows: ["conversation", "knowledge", "operations"],
    description: "Le cœur du tour recherche les faits autorisés, compose le contexte de Max et demande sa réponse. Le directeur post-tour ne bloque jamais la voix : il prépare la guidance et l’action du tour suivant.",
    responsibilities: [
      "Appliquer des deadlines séparées au RAG et au LLM Max.",
      "Assembler historique, mémoire, rôle, temps, RAG et guidance précédente.",
      "Lancer le directeur post-tour, les résumés et les traces hors du chemin vocal.",
    ],
    exchanges: ["Appelle query-rag puis proxy-llm.", "Retourne le texte et les timings dès que Max a répondu.", "Expose une promesse postTurn séparée."],
    implementation: ["src/services/prd4Orchestrator.ts", "src/agents/maxAgent.ts", "src/agents/gameMasterPRD4.ts"],
  },
  {
    id: "voice-runtime",
    label: "Façades voix & avatar",
    eyebrow: "Entrée / sortie interchangeable",
    summary: "STT multi-provider, TTS segmenté ou avatar vidéo",
    layer: "browser",
    icon: AudioLines,
    flows: ["conversation", "operations"],
    description: "Des façades stables isolent l’interface des providers. L’entrée produit du texte finalisé ; la sortie reçoit le texte exact d’Ava et le rend en audio TTS ou via l’avatar live.",
    responsibilities: ["Créer le provider STT configuré.", "Mesurer transcription, premier audio et lecture complète.", "Basculer proprement vers le TTS si l’avatar échoue avant de parler."],
    exchanges: ["Obtient des jetons courts via Lovable Cloud.", "Ouvre ensuite les flux temps réel provider.", "Remonte états et métriques au parcours React."],
    implementation: ["src/services/stt/*", "src/services/tts/*", "src/services/streamingAvatar/*"],
  },
  {
    id: "trace-runtime",
    label: "Traces & télémétrie",
    eyebrow: "Best effort · non bloquant",
    summary: "Outbox locale, timings de segments et événements produit",
    layer: "browser",
    icon: Activity,
    flows: ["conversation", "operations"],
    description: "L’observabilité est découplée de l’expérience. Les traces diagnostiques passent par une file locale durable ; la conversation et les métriques sont écrites sans retarder la première voix.",
    responsibilities: ["Corréler STT, RAG, Max, TTS et GM par turn_id.", "Tolérer un réseau temporairement indisponible.", "Rendre les traces causales inspectables dans l’admin."],
    exchanges: ["Écrit dans Supabase quand possible.", "Envoie les événements consentis à PostHog.", "N’interrompt pas la réponse si une écriture échoue."],
    implementation: ["src/services/conversationTraceOutbox.ts", "src/services/voiceTelemetry.ts", "src/services/posthogService.ts"],
  },
  {
    id: "cloud-auth",
    label: "Auth, RLS & garde-fous",
    eyebrow: "Lovable Cloud · sécurité",
    summary: "Session anonyme, accès admin, rate limits et secrets serveur",
    layer: "cloud",
    icon: LockKeyhole,
    flows: ["conversation", "knowledge", "operations"],
    description: "Le navigateur ne reçoit pas les clés des providers. L’identité Supabase, les politiques RLS et les gardes des Edge Functions séparent le jeu public des opérations d’administration.",
    responsibilities: ["Émettre ou réutiliser une session de jeu authentifiée.", "Contrôler les requêtes publiques et admin.", "Garder les secrets dans Lovable Cloud."],
    exchanges: ["Ajoute le JWT aux appels de fonctions.", "Vérifie le rôle et les limites côté serveur.", "Autorise les données selon les politiques RLS."],
    implementation: ["src/services/gameAuth.ts", "supabase/functions/_shared/gameRequestGuard.ts", "supabase/functions/_shared/adminAuth.ts"],
  },
  {
    id: "edge-functions",
    label: "Edge Functions",
    eyebrow: "Lovable Cloud · API serveur",
    summary: "Proxies LLM/voix, query-rag, sync et résumés",
    layer: "cloud",
    icon: ServerCog,
    flows: ["conversation", "knowledge", "operations"],
    description: "Les fonctions serveur valident les requêtes, appliquent les timeouts, appellent les fournisseurs avec les secrets Cloud et normalisent leurs réponses pour le client.",
    responsibilities: ["Proxyfier LLM, STT, TTS et avatar.", "Exécuter la recherche RAG et le reranking.", "Synchroniser Notion et produire les résumés de rôle/session."],
    exchanges: ["Reçoit des appels authentifiés du navigateur.", "Lit/écrit Postgres et pgvector.", "Appelle les API externes avec les secrets Lovable Cloud."],
    implementation: ["supabase/functions/proxy-llm", "supabase/functions/query-rag", "supabase/functions/proxy-stt*", "supabase/functions/proxy-tts*"],
  },
  {
    id: "database",
    label: "Postgres + pgvector",
    eyebrow: "Lovable Cloud · données",
    summary: "Sessions, personnages, mémoire, embeddings et traces",
    layer: "cloud",
    icon: Database,
    flows: ["conversation", "knowledge", "operations"],
    description: "La base fournie par Lovable est la mémoire persistante du produit. pgvector porte l’index sémantique et les fonctions RPC encapsulent les opérations sensibles ou atomiques.",
    responsibilities: ["Persister sessions, conversations, profils et questionnaires.", "Rechercher les chunks du personnage actif et les chunks partagés.", "Versionner l’orchestration et conserver les traces de tours."],
    exchanges: ["Alimentée par la synchronisation Notion.", "Interrogée par query-rag et le runtime.", "Lue par les vues d’administration et de qualité."],
    implementation: ["src/integrations/supabase/types.ts", "supabase/migrations/*", "src/services/prd4Session.ts"],
  },
  {
    id: "runtime-config",
    label: "Configuration versionnée",
    eyebrow: "Lovable Cloud · contrôle",
    summary: "Réglages, profils runtime et orchestration épinglée",
    layer: "cloud",
    icon: CloudCog,
    flows: ["conversation", "knowledge", "operations"],
    description: "Les réglages opérationnels et profils de personnages vivent en base. Une session épingle sa version publiée d’orchestration afin qu’un changement admin n’altère pas une conversation déjà commencée.",
    responsibilities: ["Hydrater les providers et deadlines au démarrage.", "Publier une version sans muter l’historique.", "Vérifier la disponibilité d’un personnage avant un handoff."],
    exchanges: ["Configurée depuis l’admin.", "Lue par le runtime au démarrage et au tour.", "Attachée aux sessions et événements d’expérience."],
    implementation: ["src/services/settingsService.ts", "src/services/experienceOrchestration.ts", "src/config/experienceRuntime.ts"],
  },
  {
    id: "notion",
    label: "Notion",
    eyebrow: "Source éditoriale",
    summary: "Personnages, univers narratif, vidéos et questionnaire",
    layer: "external",
    icon: FileStack,
    flows: ["knowledge", "operations"],
    description: "Notion reste l’outil éditorial. La synchronisation admin transforme les pages en profils et chunks indexables ; le live ne dépend donc pas d’un appel Notion à chaque tour.",
    responsibilities: ["Fournir les fiches de personnages et le corpus narratif.", "Référencer les cinématiques et leurs déclencheurs.", "Recevoir les questionnaires synchronisés."],
    exchanges: ["Lu par sync-notion.", "Écrit par les fonctions de questionnaire/vidéo.", "N’est pas sur le chemin critique vocal."],
    implementation: ["supabase/functions/sync-notion", "supabase/functions/sync-questionnaire", "src/services/ragService.ts"],
  },
  {
    id: "ai-providers",
    label: "IA & recherche",
    eyebrow: "Services externes",
    summary: "OpenRouter pour les LLM, Voyage pour les vecteurs et le rerank",
    layer: "external",
    icon: BrainCircuit,
    flows: ["conversation", "knowledge", "operations"],
    description: "OpenRouter exécute Max et le directeur d’expérience avec des modèles configurables. Voyage produit l’espace vectoriel compatible du corpus et reranke les candidats RAG.",
    responsibilities: ["Générer le texte du personnage.", "Évaluer le tour et préparer la suite.", "Encoder puis classer les connaissances narratives."],
    exchanges: ["Appelés uniquement via les Edge Functions.", "Renvoient contenu, usage et latence normalisés.", "Leurs erreurs déclenchent des modes dégradés explicites."],
    implementation: ["src/services/openRouterLLM.ts", "supabase/functions/proxy-llm", "supabase/functions/_shared/ragProfiles.ts"],
  },
  {
    id: "voice-providers",
    label: "Voix & avatar",
    eyebrow: "Services temps réel",
    summary: "Deepgram par défaut, TTS configurables, HeyGen LiveAvatar",
    layer: "external",
    icon: Radio,
    flows: ["conversation", "operations"],
    description: "Les providers spécialisés transcrivent le micro ou restituent le texte. Deepgram est le STT par défaut ; ElevenLabs est le TTS par défaut, avec d’autres providers configurables et HeyGen pour l’avatar live.",
    responsibilities: ["Finaliser une transcription française.", "Produire un premier audio rapidement puis lire les segments.", "Animer l’avatar à partir du texte exact fourni par Ava."],
    exchanges: ["Jetons et appels protégés par Lovable Cloud.", "Flux média directs une fois autorisés.", "Métadonnées de provider jointes aux timings."],
    implementation: ["src/services/stt/registry.ts", "src/services/tts/registry.ts", "src/services/streamingAvatar/providers/heygen.ts"],
  },
  {
    id: "media-analytics",
    label: "Média & observabilité",
    eyebrow: "Services périphériques",
    summary: "Gumlet pour les vidéos, PostHog/Grain pour la mesure consentie",
    layer: "external",
    icon: Film,
    flows: ["conversation", "operations"],
    description: "Gumlet diffuse les vidéos narratives. PostHog et Grain reçoivent les événements techniques prévus par les préférences de confidentialité ; Supabase conserve aussi les métriques structurées utiles au diagnostic.",
    responsibilities: ["Diffuser teaser et cinématiques.", "Mesurer phases, latence et erreurs techniques.", "Soutenir l’analyse qualité sans piloter la réponse de Max."],
    exchanges: ["Gumlet reçoit une URL vidéo sélectionnée.", "PostHog reçoit des événements sans contenu vocal brut.", "Les vues admin agrègent sources internes et externes."],
    implementation: ["src/components/GumletVideoPlayer.tsx", "src/services/posthogService.ts", "src/services/grainAnalytics.ts"],
  },
];

const TURN_STEPS: TurnStep[] = [
  {
    id: "capture",
    number: 1,
    label: "Capturer et transcrire",
    shortLabel: "Voix → texte",
    lane: "critical",
    icon: Mic2,
    timing: "Chemin critique · STT temps réel",
    promise: "Donner au pipeline une phrase finale, pas une suite d’hypothèses partielles.",
    input: ["Micro ouvert par le push-to-talk", "Audio encodé par le navigateur", "Dictionnaire de termes du projet"],
    process: ["La façade crée le provider STT configuré.", "Deepgram, par défaut, reçoit un jeton court puis le flux audio.", "Les segments finaux sont consolidés avant le lancement du tour."],
    output: ["Texte utilisateur finalisé", "Provider/modèle et latence STT", "Message utilisateur ajouté à la conversation"],
    example: "Audio : « Pourquoi Ava ne vous faisait-elle plus confiance ? » → texte final identique, horodaté et associé au turn_id.",
    resilience: "Un tour vide est ignoré. Les erreurs STT libèrent l’interface pour permettre de reparler.",
  },
  {
    id: "context",
    number: 2,
    label: "Rassembler le contexte utile",
    shortLabel: "Contexte & RAG",
    lane: "critical",
    icon: Search,
    timing: "Chemin critique · RAG ; mémoire chargée en parallèle",
    promise: "Donner à Max seulement les faits et souvenirs pertinents pour ce personnage et ce moment.",
    input: ["Question et échanges récents", "Personnage actif", "Résumé, mémoire structurée, rôle joueur", "Guidance GM du tour N−1"],
    process: ["Le personnage est résolu pour cloisonner le corpus.", "query-rag encode la recherche, interroge pgvector puis reranke les candidats.", "Résumé, mémoire structurée et orchestration épinglée sont préchargés en parallèle."],
    output: ["Jusqu’à 3 extraits RAG formatés pour Max", "Contexte de connaissance autorisé", "Mémoire visible par le personnage actif"],
    example: "La question récupère un chunk sur la rupture de confiance d’Ava, mais exclut les souvenirs privés d’Emma si Max parle.",
    resilience: "Le RAG est best effort : timeout ou erreur donnent un contexte vide, sans bloquer toute la conversation.",
  },
  {
    id: "max",
    number: 3,
    label: "Faire répondre le personnage",
    shortLabel: "Prompt → Max",
    lane: "critical",
    icon: Bot,
    timing: "Chemin critique · LLM Max",
    promise: "Produire une réponse incarnée, cohérente avec les faits, la relation et le temps restant.",
    input: ["Prompt système compilé du personnage", "Question + historique sélectionné", "RAG, mémoire, posture joueur", "Temps, numéro de tour et guidance précédente"],
    process: ["Le compilateur assemble un payload borné et traçable.", "proxy-llm appelle le modèle Max configuré via OpenRouter.", "La réponse finale est récupérée avant la deadline globale du tour."],
    output: ["Texte final d’Ava/Max", "Latence Max et métadonnées de modèle", "Promesses asynchrones pour préparer la suite"],
    example: "Max : « Elle avait compris que je lui cachais une partie de ce qui s’était passé. À partir de là, chaque silence ressemblait à un mensonge. »",
    resilience: "Si le LLM échoue, une phrase de prudence prédéfinie remplace la génération et maintient l’expérience utilisable.",
  },
  {
    id: "render",
    number: 4,
    label: "Restituer exactement la réponse",
    shortLabel: "Texte → voix",
    lane: "critical",
    icon: Volume2,
    timing: "Chemin critique perçu · premier audio",
    promise: "Afficher la réponse sans délai inutile puis la rendre audible sans autoriser un provider à la réécrire.",
    input: ["Texte final de Max", "Mode de sortie épinglé au démarrage", "Voix du personnage actif"],
    process: ["Le sous-titre est affiché immédiatement.", "La façade de sortie segmente le TTS ou transmet le texte exact à HeyGen.", "Le premier audio a sa propre deadline, indépendante du RAG/LLM."],
    output: ["Voix TTS ou avatar parlant", "Latence premier audio et lecture totale", "Interface rendue à l’utilisateur après lecture"],
    example: "Le même texte visible est envoyé à ElevenLabs — ou à HeyGen LiveAvatar — sans seconde génération conversationnelle.",
    resilience: "Un timeout de premier audio conserve le texte à l’écran. Un avatar qui échoue avant de parler peut basculer vers le TTS local.",
  },
  {
    id: "persist",
    number: 5,
    label: "Mémoriser et mesurer",
    shortLabel: "Trace & mémoire",
    lane: "background",
    icon: Gauge,
    timing: "Arrière-plan · best effort",
    promise: "Rendre le tour reprenable et diagnosticable sans ajouter de latence à la voix.",
    input: ["Messages utilisateur et personnage", "Timings STT/RAG/Max/TTS", "turn_id, session_id et providers"],
    process: ["La conversation est mise à jour après le rendu.", "Les métriques voix sont corrélées et persistées.", "En mode diagnostic, une outbox locale durable synchronise la trace causale."],
    output: ["Session reprenable", "Événement de tour complet", "Trace exploitable dans l’admin"],
    example: "Le tour 6 conserve rag_ms, max_ms, tts_ms, le provider réel de chaque segment et le bloqueur dominant.",
    resilience: "Les écritures sont non bloquantes ; une panne réseau ne doit pas empêcher l’utilisateur d’entendre la réponse.",
  },
  {
    id: "director",
    number: 6,
    label: "Interpréter ce qui vient de se passer",
    shortLabel: "Directeur post-tour",
    lane: "background",
    icon: BrainCircuit,
    timing: "Arrière-plan · démarre après Max, en parallèle de la voix",
    promise: "Comprendre la dynamique du tour et préparer la prochaine intervention sans retarder celle-ci.",
    input: ["Question et réponse du tour", "Historique récent et mémoire avant tour", "Rôle, temps, personnage et orchestration épinglée"],
    process: ["Un seul appel structuré évalue le post-tour.", "Il produit labels, évolution de mémoire, guidance et action recommandée.", "La projection labelPromise réutilise ce résultat : aucun deuxième appel LLM."],
    output: ["Thèmes, sujets et intentions", "next_turn_guidance consommée au tour N+1", "Action : aucune, cinématique, handoff ou fin"],
    example: "Labels : confiance, secret ; guidance : « admettre une faute sans tout révéler » ; action recommandée : aucune.",
    resilience: "Le résultat arrive via une promesse séparée. Une erreur du directeur ne bloque ni le texte ni la voix déjà produits.",
  },
  {
    id: "guard-loop",
    number: 7,
    label: "Valider l’action et boucler",
    shortLabel: "Garde-fous → N+1",
    lane: "background",
    icon: ShieldCheck,
    timing: "Arrière-plan · effet sur la suite",
    promise: "Transformer une recommandation IA en action produit seulement si les règles déterministes l’autorisent.",
    input: ["Décision du directeur", "Version publiée", "Vidéos déjà jouées et cooldown", "Personnage disponible et tour toujours courant"],
    process: ["validateDirectorDecision vérifie les invariants produit.", "Une action refusée est tracée avec sa raison.", "Une action acceptée prépare la cinématique, le handoff ou la clôture."],
    output: ["État d’expérience mis à jour", "Guidance one-shot pour le prochain tour", "Événement d’action accepté ou bloqué"],
    example: "Une cinématique proposée au tour 2 est bloquée si le minimum est 3 ; la conversation continue et la guidance reste disponible.",
    resilience: "Les règles déterministes ont le dernier mot. Un résultat tardif d’un ancien tour est ignoré grâce au contrôle isCurrentTurn().",
  },
];

function ArchitectureDiagram() {
  const [activeFlow, setActiveFlow] = useState<FlowId>("conversation");
  const [selectedNodeId, setSelectedNodeId] = useState("prd4-ui");
  const selectedNode = useMemo(
    () => ARCHITECTURE_NODES.find((node) => node.id === selectedNodeId) ?? ARCHITECTURE_NODES[0],
    [selectedNodeId],
  );

  const selectFlow = (flow: (typeof FLOWS)[number]) => {
    setActiveFlow(flow.id);
    setSelectedNodeId(flow.defaultNode);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card/40 p-3 tablet-lg:flex-row tablet-lg:items-center tablet-lg:justify-between">
        <div>
          <p className="text-sm font-semibold">Suivre un flux</p>
          <p className="text-xs text-muted-foreground">Les composants actifs s’illuminent ; chaque bloc reste sélectionnable.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Flux d’architecture">
          {FLOWS.map((flow) => (
            <Button
              key={flow.id}
              type="button"
              size="sm"
              variant={activeFlow === flow.id ? "default" : "outline"}
              aria-pressed={activeFlow === flow.id}
              onClick={() => selectFlow(flow)}
            >
              {flow.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background/40 p-3 md:p-4">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-4 w-4" aria-hidden="true" />
          <span>{FLOWS.find((flow) => flow.id === activeFlow)?.description}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span>les flèches indiquent le sens principal des échanges</span>
        </div>

        <div className="space-y-2">
          {ARCHITECTURE_LAYERS.map((layer, layerIndex) => {
            const nodes = ARCHITECTURE_NODES.filter((node) => node.layer === layer.id);
            return (
              <div key={layer.id}>
                <section className="grid gap-3 rounded-lg border border-border/70 bg-card/50 p-3 lg:grid-cols-[13rem_1fr]" aria-labelledby={`layer-${layer.id}`}>
                  <div className="flex gap-3 lg:block">
                    <span className="font-mono text-xs text-primary">{layer.index}</span>
                    <div className="lg:mt-1">
                      <h3 id={`layer-${layer.id}`} className="text-sm font-semibold">{layer.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{layer.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {nodes.map((node) => {
                      const Icon = node.icon;
                      const belongsToFlow = node.flows.includes(activeFlow);
                      const selected = node.id === selectedNode.id;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`min-h-28 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            selected
                              ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                              : belongsToFlow
                                ? "border-border bg-background hover:border-primary/60 hover:bg-primary/5"
                                : "border-border/50 bg-background/40 opacity-45 hover:opacity-80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Icon className={`h-4 w-4 ${belongsToFlow ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                            {belongsToFlow && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Inclus dans le flux actif" />}
                          </div>
                          <p className="mt-3 text-sm font-semibold">{node.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{node.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>
                {layerIndex < ARCHITECTURE_LAYERS.length - 1 && (
                  <div className="flex h-7 items-center pl-8 lg:pl-[14.5rem]" aria-hidden="true">
                    <ArrowDown className="h-4 w-4 text-primary/70" />
                    <span className="ml-2 h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Card aria-live="polite">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardDescription className="font-mono text-[11px] uppercase tracking-wider">{selectedNode.eyebrow}</CardDescription>
              <CardTitle className="mt-1 text-lg">{selectedNode.label}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1">
              {selectedNode.flows.map((flowId) => (
                <Badge key={flowId} variant="outline">
                  {FLOWS.find((flow) => flow.id === flowId)?.label}
                </Badge>
              ))}
            </div>
          </div>
          <p className="max-w-4xl pt-2 text-sm leading-6 text-muted-foreground">{selectedNode.description}</p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <DetailList title="Responsabilités" items={selectedNode.responsibilities} icon={Sparkles} />
          <DetailList title="Échanges" items={selectedNode.exchanges} icon={ArrowRight} />
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
              Repères dans le code
            </p>
            <ul className="space-y-2">
              {selectedNode.implementation.map((path) => (
                <li key={path} className="rounded-md bg-muted/50 px-2.5 py-2 font-mono text-[11px] text-foreground">{path}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2 leading-5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TurnMechanicsDiagram() {
  const [selectedStepId, setSelectedStepId] = useState("capture");
  const selectedIndex = TURN_STEPS.findIndex((step) => step.id === selectedStepId);
  const selectedStep = TURN_STEPS[selectedIndex] ?? TURN_STEPS[0];
  const criticalSteps = TURN_STEPS.filter((step) => step.lane === "critical");
  const backgroundSteps = TURN_STEPS.filter((step) => step.lane === "background");

  const selectRelative = (delta: number) => {
    const next = Math.min(TURN_STEPS.length - 1, Math.max(0, selectedIndex + delta));
    setSelectedStepId(TURN_STEPS[next].id);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
              Exemple fil rouge
            </p>
            <p className="mt-1 text-sm text-muted-foreground">« Pourquoi Ava ne vous faisait-elle plus confiance ? »</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />Chemin critique</Badge>
            <Badge variant="outline" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Prépare le tour suivant</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-background/40 p-3 md:p-4">
        <TurnLane
          title="Réponse audible du tour N"
          subtitle="Ces étapes déterminent quand l’utilisateur voit puis entend la réponse."
          steps={criticalSteps}
          selectedStepId={selectedStep.id}
          onSelect={setSelectedStepId}
          accent="primary"
        />

        <div className="my-4 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center" aria-label="Branchement asynchrone après la réponse de Max">
          <div className="hidden h-px bg-border md:block" />
          <div className="flex items-center justify-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent-foreground">
            <Workflow className="h-4 w-4" aria-hidden="true" />
            Après Max, le directeur part en parallèle de la restitution vocale
          </div>
          <div className="hidden h-px bg-border md:block" />
        </div>

        <TurnLane
          title="Mémoire et préparation du tour N+1"
          subtitle="Ces travaux ne retardent pas la voix déjà lancée."
          steps={backgroundSteps}
          selectedStepId={selectedStep.id}
          onSelect={setSelectedStepId}
          accent="accent"
        />
      </div>

      <Card aria-live="polite">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${selectedStep.lane === "critical" ? "bg-primary text-primary-foreground" : "bg-accent/20 text-accent"}`}>
                <span className="font-mono text-sm font-semibold">{selectedStep.number}</span>
              </div>
              <div>
                <CardDescription>{selectedStep.timing}</CardDescription>
                <CardTitle className="mt-1 text-lg">{selectedStep.label}</CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Étape précédente"
                onClick={() => selectRelative(-1)}
                disabled={selectedIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="min-w-12 text-center font-mono text-xs text-muted-foreground">{selectedIndex + 1} / {TURN_STEPS.length}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Étape suivante"
                onClick={() => selectRelative(1)}
                disabled={selectedIndex >= TURN_STEPS.length - 1}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <p className="pt-2 text-sm font-medium leading-6">{selectedStep.promise}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <TurnDetailColumn title="Entrées" items={selectedStep.input} icon={ArrowDown} />
            <TurnDetailColumn title="Traitement" items={selectedStep.process} icon={ServerCog} />
            <TurnDetailColumn title="Sorties" items={selectedStep.output} icon={ArrowRight} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Exemple concret
              </p>
              <p className="text-sm leading-6">{selectedStep.example}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> En cas de problème
              </p>
              <p className="text-sm leading-6">{selectedStep.resilience}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">La règle de fluidité</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            La voix attend la transcription, le RAG, Max et le premier audio. Elle n’attend ni le directeur post-tour,
            ni les résumés, ni les écritures de trace. Le résultat du directeur influence le tour suivant, jamais la
            réponse que l’utilisateur est déjà en train d’entendre.
          </p>
        </div>
      </div>
    </div>
  );
}

function TurnLane({
  title,
  subtitle,
  steps,
  selectedStepId,
  onSelect,
  accent,
}: {
  title: string;
  subtitle: string;
  steps: TurnStep[];
  selectedStepId: string;
  onSelect: (id: string) => void;
  accent: "primary" | "accent";
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className={`grid gap-2 ${steps.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const selected = step.id === selectedStepId;
          return (
            <div key={step.id} className="relative flex md:block">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(step.id)}
                className={`relative z-10 flex min-h-20 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:block ${
                  selected
                    ? accent === "primary"
                      ? "border-primary bg-primary/10"
                      : "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-primary/60 hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${accent === "primary" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>{step.number}</span>
                  <Icon className={`h-4 w-4 ${accent === "primary" ? "text-primary" : "text-accent"}`} aria-hidden="true" />
                </div>
                <div className="md:mt-2">
                  <p className="text-sm font-semibold">{step.shortLabel}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{step.label}</p>
                </div>
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 z-20 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground md:block" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TurnDetailColumn({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      <ol className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2 leading-5">
            <span className="font-mono text-[11px] text-primary">{String(index + 1).padStart(2, "0")}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ExperienceArchitectureTab() {
  const [activeDiagram, setActiveDiagram] = useState("architecture");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">PRD4 live</Badge>
            <span className="text-xs text-muted-foreground">Architecture actuelle · août 2026</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Comment l’expérience est construite</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Une lecture interactive du système complet, puis du chemin exact parcouru par une prise de parole.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CloudCog className="h-4 w-4 text-primary" aria-hidden="true" />
          Livraison et backend : Lovable / Lovable Cloud
        </div>
      </div>

      <Tabs value={activeDiagram} onValueChange={setActiveDiagram} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-1 p-1 sm:grid-cols-2">
          <TabsTrigger value="architecture" onClick={() => setActiveDiagram("architecture")} className="min-h-11 gap-2 px-3">
            <Network className="h-4 w-4" aria-hidden="true" />
            1. Architecture technique
          </TabsTrigger>
          <TabsTrigger value="turn" onClick={() => setActiveDiagram("turn")} className="min-h-11 gap-2 px-3">
            <Workflow className="h-4 w-4" aria-hidden="true" />
            2. Mécanique d’un tour
          </TabsTrigger>
        </TabsList>

        <TabsContent value="architecture" className="mt-4">
          <ArchitectureDiagram />
        </TabsContent>
        <TabsContent value="turn" className="mt-4">
          <TurnMechanicsDiagram />
        </TabsContent>
      </Tabs>
    </div>
  );
}
