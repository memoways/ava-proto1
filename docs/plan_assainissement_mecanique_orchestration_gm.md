# Assainissement de Mécanique et relance du Game Master

## Résumé et garde-fous

Le chantier se concentre sur l’actuel groupe **Mécanique**. Toutes les pages de **Technique** sont conservées, visibles et fonctionnellement inchangées, notamment Streaming Avatar et Consommation Streaming Avatar. Lovable reste l’unique chaîne de compilation, de migration Cloud et de publication.

La navigation cible est la suivante :

- **Expérience** : Orchestration GM, Cinématiques ;
- **Qualité** : Latence & blocage, Latences PostHog, Laboratoire RAG, Traces Max ;
- **Technique avancée** : STT, RAG, LLM, TTS, Streaming Avatar et toutes les pages de coûts/consommations.

Aucune donnée, colonne, table, migration ou configuration historique ne sera supprimée pendant la première phase. Les écrans Validateur et Métriques anti-hallucination resteront accessibles par une route administrateur legacy journalisée pendant 14 jours avant toute décision de retrait.

## Correspondance de navigation

| Page actuelle | Destination | Décision |
|---|---|---|
| Game Master | Expérience → Orchestration | Refonte autour du runtime PRD4 |
| Triggers vidéo | Expérience → Cinématiques | Conservation et amélioration |
| Validateur | Accès legacy temporaire | Masqué du menu principal, hors pipeline PRD4 live |
| Métriques hallu. | Accès legacy temporaire | Masqué du menu principal, mesure le validateur inactif |
| Latence & blocage | Qualité → Latence & blocage | Structure et interactions conservées |
| Latences (PostHog) | Qualité → Latences PostHog | Source PostHog réelle, distincte des données internes |
| Laboratoire RAG | Qualité → Laboratoire RAG | Conservation |
| Traces Max | Qualité → Traces Max | Conservation |

### Technique avancée — périmètre protégé

STT Config, RAG Config, LLM Config, TTS Config, Streaming Avatar Config, Consommation LLM, Consommation Voix et Consommation Streaming Avatar restent en place sans suppression, masquage ni fusion. Les coûts restent dans Technique avancée et le switch Voix TTS / Avatar vidéo demeure disponible.

## Phase 1 — Baseline et sécurité

- Inventorier dans Lovable Cloud les migrations réellement appliquées, tables disponibles, réglages actifs et erreurs de télémétrie avant toute migration.
- Aligner les tests PRD4 de timeout sur la constante réelle du délai RAG.
- Corriger les erreurs de lint du périmètre Mécanique/orchestrateurs/télémétrie ; isoler les corrections générales hors périmètre.
- Ajouter des tests de non-régression de navigation, chargement et sauvegarde pour toutes les pages Technique.
- Ne réaliser aucune migration destructive.
- Journaliser l’accès aux deux vues legacy et observer 14 jours avant décision de suppression.

## Phase 2 — Latence & blocage

La disposition générale, les graphiques empilés, détails par segment, diagnostics, comparaisons p50/p95, blockers et liens session/Traces Max sont conservés.

- Garder `conversation_log.pipeline` et les mesures internes Supabase comme sources.
- Séparer latence fournisseur, temps jusqu’au premier son et durée de lecture.
- Marquer explicitement les anciennes lignes dont `tts_ms` mélange génération et lecture.
- Ne jamais inventer de durée pour le GM pré-tour ou le validateur non exécutés dans PRD4.
- Afficher le provider, le modèle, la session et le `turn_id` observés.
- Aligner délai RAG configuré, libellés et tests.
- Représenter les mesures absentes comme « non mesuré », jamais comme zéro.

## Phase 3 — Latences PostHog

La page reste distincte de Latence & blocage et utilise PostHog comme source principale. Une Edge Function Lovable Cloud administrateur `posthog-latency-stats` assurera : JWT Supabase/Lovable, rôle `admin`, clé personnelle PostHog uniquement dans les secrets Lovable, identifiant de projet côté serveur, requêtes prédéfinies via `POST /api/projects/{project_id}/query/`, aucune requête libre dans le navigateur et cache de 60 secondes.

Filtres : 24 h, 7 j, 30 j, plage personnalisée, personnage, modèle, STT, TTS et navigateur.

Indicateurs : sessions/tours, p50/p95 du texte Max prêt, premier son et end-to-end, STT/RAG/Max LLM/TTS/GM post-tour, erreurs/fallbacks, blockers, providers/modèles, cinématiques recommandées/jouées/passées et handoffs proposés/acceptés/refusés/exécutés/bloqués.

La vue indiquera systématiquement la source PostHog, la fraîcheur, la période, les erreurs d’authentification/quota/disponibilité et distinguera absence de données et zéro.

Un panneau parallèle comparera sans fusion : compteurs PostHog/interne, écarts p50/p95, événements manquants par source, taux de persistance Supabase et lien dashboard PostHog. Le canary combinera explicitement les sources : performance/erreurs PostHog, persistance Supabase et coûts des tables de consommation. La décision restera indéterminée tant qu’un critère requis manque.

## Phase 4 — Expérience → Orchestration

La page Game Master legacy devient une gouvernance de versions connectée au runtime PRD4 : consultation de la version publiée, brouillon, test sans effet sur une trace/session, comparaison attendu/produit, publication explicite, archivage/restauration et sessions par version. Chaque session épingle sa version GM au démarrage.

Les réglages sans effet dans PRD4 passent en legacy : seuil de confiance, tolérance aux insultes, nombre minimal de questions, placeholder vidéo, modes de parole, prompt GM historique et GM pré-tour. `TIMEOUT_SECONDS` reste dans Orchestration ; `MAX_PROMPT_VARIANT` reste dans Technique avancée LLM/RAG.

Le label pass et le post-tour sont consolidés en un seul appel structuré après le texte Max, en parallèle de la sortie vocale :

```ts
type DirectorAction =
  | { type: "none" }
  | { type: "cinematic"; videoId: string; reason: string; confidence: number }
  | { type: "handoff"; targetCharacter: "emma"; reason: string; proposalGuidance: string }
  | { type: "end"; reason: string };

interface ExperienceDirectorDecisionV1 {
  labels: {
    themes: string[];
    topics: string[];
    intentions: string[];
  };
  nextTurnGuidance: string | null;
  memoryDelta: ConversationMemoryDeltaV2 | null;
  action: DirectorAction;
}
```

Le GM recommande et un moteur déterministe valide : configuration publiée/valide, ressource disponible, aucune action concurrente, rythme/doublons respectés, priorité handoff, résultat tardif reporté ou ignoré, JSON invalide/timeout converti en `none`. Le chemin Max → TTS n’attend jamais le GM.

## Phase 5 — Cinématiques

Fusionner la gestion fonctionnelle du catalogue et des triggers tout en conservant les services actuels, le lecteur Gumlet persistant et le bouton Passer. La page expose synchronisation, disponibilité média, thèmes/synonymes, priorité, contexte post-vidéo, nombre minimal de tours, cooldown, maximum par session et historique des décisions.

Le GM recommande un `videoId`, puis le moteur déterministe valide. La vidéo démarre après la fin de la réplique vocale, ne coupe jamais Max/TTS, injecte le contexte post-vidéo au personnage actif et est reportée lorsqu’un handoff concurrent est retenu.

## Phase 6 — Handoff Max → Emma V1

- Max reste l’unique personnage initial.
- Aucun handoff avant quatre tours utilisateur.
- Un seul handoff par session, Max vers Emma uniquement.
- Max formule la proposition ; l’utilisateur confirme via **Appeler Emma** ou **Rester avec Max**.
- Refus : Max continue et l’offre est close.
- Acceptation : écran d’appel générique puis Emma démarre avec sa fiche, son RAG et sa voix.
- Session, timer, rôle du joueur et mémoire sont conservés.
- Streaming Avatar reste disponible dans Technique, mais Emma V1 est validée d’abord via TTS.

Emma n’est activable qu’avec fiche Notion structurée, prompt validé, RAG isolé/non vide, portrait, phrase d’ouverture, provider/voix TTS, tests qualitatifs et test d’absence de fuite de connaissances de Max.

## Phase 7 — Mémoire inter-personnages

La mémoire évolue vers une V2 rétrocompatible :

```ts
interface CharacterMemoryItemV2 {
  id: string;
  text: string;
  sourceTurn: number;
  sourceCharacter: "max" | "emma";
  visibility: "private" | "shared";
  visibleTo: Array<"max" | "emma">;
  provenance: "user" | "character" | "gm";
}
```

Le rôle initial est partagé. Les confidences sont privées au personnage actif par défaut. Toute promotion GM en mémoire partagée est tracée. Les corpus RAG et canons restent isolés. Emma ne reçoit jamais le transcript brut de Max. La reprise restaure personnage actif, version GM, offre en attente et mémoire V2.

## Phase 8 — Persistance Lovable Cloud

Préparer, puis appliquer exclusivement via Lovable après validation :

- `experience_orchestration_versions` ;
- `character_runtime_profiles` ;
- `experience_events` append-only et idempotent ;
- références de version GM et personnage actif dans `sessions` ;
- mémoire V2 dans le JSON de session existant ;
- Edge Function `posthog-latency-stats`.

Les colonnes/logs historiques sont conservés durant la compatibilité. Aucune migration destructive.

## Phase 9 — Retrait legacy après observation

Après recette et 14 jours : retirer Validateur/Métriques anti-hallucination uniquement si aucun accès legacy utile n’est observé ; supprimer les réglages Mécanique sans consommateur et composants A/B non référencés uniquement après analyse de l’arbre d’imports. Rien n’est supprimé dans Technique avancée.

## Critères d’acceptation

- Build compatible Lovable et tests unitaires verts.
- Tests PRD4 de timeout alignés.
- Pages Technique inchangées, avec tests de chargement/sauvegarde.
- Latence & blocage conserve sa structure ; données absentes/ambiguës explicites ; drill-down fonctionnel.
- Edge Function PostHog interdite aux non-admins, secret absent du bundle/logs, 24 h/7 j/30 j vérifiés, parité `turn_id`, indisponibilité visible, canary uniquement sur données complètes.
- Une panne GM ne bloque jamais Max/TTS/PTT.
- Aucun handoff avant quatre tours, une seule offre Max→Emma, acceptation/refus/reprise testés, timer/session inchangés.
- Cinématique uniquement après la voix ; handoff prioritaire.
- Une mémoire privée de Max n’est jamais visible par Emma.
- Les brouillons GM ne modifient aucune session publique.
- Recette Lovable interne : Max seul, vidéo, handoff accepté/refusé, reprise, PostHog indisponible.
- Aucune publication Production sans approbation explicite.

## Hypothèses validées

Le nettoyage vise Mécanique ; Technique reste intégralement maintenue ; les coûts restent dans Technique avancée ; les mesures internes et PostHog restent deux vues distinctes ; Emma est le pilote ; mémoire privée par défaut ; handoff unique Max→Emma après quatre tours, confirmé par boutons et sans remise à zéro du timer.

## État de mise en œuvre — 7 août 2026

### Réalisé dans le dépôt

- Navigation réorganisée en Expérience, Qualité et Technique avancée ; les huit pages Technique protégées restent visibles. Validateur et Métriques hallu. ne sont accessibles qu’en mode legacy journalisé.
- Latence & blocage conserve sa disposition et accepte les tours Emma ; les segments absents, legacy ou non exécutés sont explicitement distingués des zéros.
- Latences PostHog utilise désormais une Edge Function admin à requêtes HogQL prédéfinies, avec filtres, fraîcheur, erreurs explicites, cache 60 secondes, comparaison interne sans fusion et canary multi-source.
- Orchestration dispose de versions brouillon/publiée/archivée, test sans effet réel, publication explicite, restauration par brouillon et épinglage immuable par session.
- Le label pass et le post-tour sont consolidés dans un seul directeur structuré hors du chemin personnage → voix ; un garde déterministe valide ses actions.
- Cinématiques : recommandation GM, contrôle de disponibilité/rythme/doublon, lecture après la voix et journal append-only.
- Handoff V1 : Max→Emma seulement, après quatre tours, une seule offre, choix explicite, reprise persistée, même session/timer et TTS dédié à Emma.
- Mémoire V2 rétrocompatible : visibilité par personnage, confidences privées par défaut, éléments partagés explicites et test anti-fuite Max→Emma. L’index global du tour est conservé après le handoff sans transmettre le transcript ou le résumé historique de Max à Emma.
- Migration additive et non destructive préparée pour les versions, profils runtime, événements, colonnes de session, mémoire V2 et journal legacy.
- Tests PRD4 de timeout alignés sur `RAG_DEGRADED_MODE_DEADLINE_MS`.

### À activer et vérifier exclusivement dans Lovable Cloud

1. Comparer la migration préparée avec les migrations réellement appliquées, puis appliquer `20260807120000_experience_orchestration_foundations.sql` via Lovable.
2. Déployer `posthog-latency-stats` via Lovable et définir `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` et, si nécessaire, `POSTHOG_API_HOST` dans les secrets Lovable Cloud.
3. Régénérer les types Supabase depuis le schéma Lovable après migration.
4. Compléter et activer le profil runtime Emma, puis valider sa fiche, son prompt, son corpus RAG, son portrait, sa phrase d’ouverture, sa voix et ses tests d’isolation.
5. Vérifier les requêtes PostHog sur 24 h, 7 j et 30 j et contrôler la parité des `turn_id` avec Supabase.
6. Exécuter la recette interne Lovable : Max seul, vidéo, handoff accepté, handoff refusé, reprise, indisponibilité PostHog et session longue.
7. Observer les accès legacy pendant 14 jours avant toute suppression. Aucune suppression ni publication Production n’est incluse dans cette mise en œuvre.

### Vérifications locales

- Build Vite compatible avec la chaîne Lovable : réussi.
- Suite unitaire complète : 58 fichiers et 233 tests réussis ; contrôle ciblé final : 23 tests réussis.
- Lint ciblé sur Mécanique, orchestration, navigation et télémétrie : sans erreur après correction des fichiers concernés.
- Aucune migration appliquée, aucun secret modifié et aucune publication déclenchée hors de Lovable.
