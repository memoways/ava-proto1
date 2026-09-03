import { useAdminEnvironment } from "@/contexts/AdminEnvironmentContext";
import { canSwitchEnvironments, ENVIRONMENTS } from "@/services/environmentContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, UserCog, BookOpen, FlaskConical, Globe, Lock, RefreshCw, Coins } from "lucide-react";

export default function SandboxGuideTab() {
  const { profile, environmentId } = useAdminEnvironment();
  const environmentLabel = ENVIRONMENTS.find((env) => env.id === environmentId)?.label ?? environmentId;
  const isProduction = environmentId === "prod";
  const canSwitch = canSwitchEnvironments(profile);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Mode d'emploi · Sandbox</h2>
          <p className="text-sm text-muted-foreground">
            Compte connecté : <strong>{profile.display_name}</strong> · Environnement actif :{" "}
            <span className={isProduction ? "text-emerald-400" : "text-fuchsia-400 font-medium"}>
              {isProduction ? "Production" : `Sandbox — ${environmentLabel}`}
            </span>
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={`/?env=${encodeURIComponent(environmentId)}`} target="_blank" rel="noreferrer">
            Tester l'expérience <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      <Alert className="border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-100">
        <FlaskConical className="h-4 w-4" />
        <AlertTitle>En deux mots</AlertTitle>
        <AlertDescription>
          Une sandbox, c'est un espace à toi pour tester des réglages sans toucher à l'expérience
          publique. Ce que tu changes ici (modèle LLM, voix, STT, etc.) reste dans ta sandbox.
          Les fiches Notion, les vidéos, le RAG et les coûts sont communs à tout le monde.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog className="h-4 w-4" /> Ton compte et tes droits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Tu es connecté·e en tant que <strong>{profile.display_name}</strong>.
            Chaque compte admin est rattaché à un environnement par défaut :
            Benoît et Romed arrivent directement dans leur sandbox, toi (Ulrich) arrives en
            Production par défaut.
          </p>
          {canSwitch ? (
            <p>
              Seul le compte <strong>ulrich.fischer@memoways.com</strong> peut changer de sandbox
              via le menu déroulant en haut de page. Le changement se fait sans re-login : la page
              se recharge simplement.
            </p>
          ) : (
            <p>
              Le sélecteur d'environnement est masqué pour ton compte. Si tu dois en changer,
              demande à Ulrich de te connecter avec son compte, ou bien passe par
              « Tester l'expérience » depuis ta sandbox actuelle.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Ce qui est isolé par sandbox
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="mb-2">
            Quand tu changes un réglage dans une sandbox, cela n'affecte ni la Production ni les
            autres sandbox :
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Modèle LLM, température, tokens max</li>
            <li>Voix TTS (ElevenLabs, Gradium) et paramètres de voix</li>
            <li>Provider STT (Deepgram, Gradium, Whisper…) et dictionnaire custom</li>
            <li>Réglages du Game Master, de l'orchestration et des personnages</li>
            <li>Paramètres RAG (top-k, rerank, etc.)</li>
            <li>Configuration de l'avatar streaming</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Ce qui est partagé avec tout le monde
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="mb-2">
            Ces éléments ne sont pas cloisonnés : une modification les change pour tout le monde,
            Production comprise.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Fiches Notion</strong> (personnages, règles, récit) : la synchronisation écrit
              dans le référentiel commun.
            </li>
            <li>
              <strong>Vidéos / Cinématiques</strong> : seules les vidéos marquées « En ligne » dans
              Notion sont synchronisées, et elles sont visibles en Production immédiatement.
            </li>
            <li>
              <strong>RAG et embeddings</strong> : le corpus vectoriel est unique. Un rebuild ou
              un changement de profil d'embeddings agit sur tout le monde.
            </li>
            <li>
              <strong>Secrets et fournisseurs</strong> : il n'y a qu'une seule clé OpenRouter,
              Voyage, Deepgram, etc. pour tout le projet.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" /> Comment tester en sandbox
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            1. Vérifie que tu es bien dans la bonne sandbox (bandeau violet en haut de page).
          </p>
          <p>
            2. Règle ce que tu veux dans les onglets <strong>Technique</strong> et{" "}
            <strong>Expérience</strong>.
          </p>
          <p>
            3. Clique sur <strong>« Tester l'expérience »</strong> pour lancer le jeu avec tes
            réglages. N'ouvre pas simplement l'URL publique : elle reste toujours en Production.
          </p>
          <p>
            4. Tes sessions de test apparaissent dans l'onglet <strong>Sessions</strong>, filtrées
            avec leur environnement et leur contexte.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" /> Les 5 bons réflexes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>Regarde l'environnement actif</strong> avant chaque modification. Le bandeau
              en haut te le rappelle.
            </li>
            <li>
              <strong>Ne clique pas sur « Sync Notion » ou « Rebuild RAG »</strong> à la légère :
              cela touche au contenu partagé.
            </li>
            <li>
              <strong>Synchronise les vidéos</strong> depuis l'onglet Cinématiques uniquement si
              les vidéos Notion sont prêtes à être en ligne.
            </li>
            <li>
              <strong>Les tests consomment du crédit fournisseur</strong> (OpenRouter, ElevenLabs,
              etc.) comme du trafic réel, même en sandbox.
            </li>
            <li>
              <strong>En cas de doute</strong>, reviens sur cette page ou demande à Ulrich de
              vérifier l'environnement actif.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4" /> Coûts et métriques
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Les onglets <strong>Latence</strong>, <strong>Usage LLM</strong>,{" "}
            <strong>Traces Max</strong> et <strong>Hallucinations</strong> affichent pour l'instant
            les données de tous les environnements mélangées. Seul l'onglet <strong>Sessions</strong>{" "}
            permet de filtrer par environnement, et <strong>Alertes</strong> est déjà limité à
            l'environnement actif.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
