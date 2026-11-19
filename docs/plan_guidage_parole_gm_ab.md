# Guidage de parole du GM — interrupteur pour tests A/B

Tâche Notion : [Désactiver le guidage de parole du Game Master pour les tests A/B](https://app.notion.com/p/b7762322e5958387a17b81364680708e)
(Gamilab). Lot 1 livré le 19 novembre 2026 (code, sandbox). Production non publiée.

## Ce que fait le réglage

Backoffice → Expérience → Réglages GM → **Guidage de parole du GM**.

- **Activé** (défaut, et valeur des versions publiées avant ce lot) : comportement inchangé.
- **Désactivé** : le personnage ne reçoit plus, au tour suivant, ce que le GM lui conseille de dire ou de quelle
  manière. Le GM continue de tourner à chaque tour, avec le même prompt : il calcule toujours son conseil, qui reste
  visible dans l'historique des sessions avec la mention « non transmis au personnage ».

Le mode « naturel » garde la fiche, le contexte, le RAG, la mémoire, la relation, le cadre commun et les garde-fous du
personnage. Aucune fiche n'est modifiée.

## Cartographie : ce qui est coupé, ce qui reste

| Sortie du GM post-tour | Chemin vers le personnage | Désactivé |
|---|---|---|
| `next_turn_guidance` | bloc « CONSEIL DE MISE EN SCÈNE » / « GUIDANCE GM » / « Orientation de jeu » (selon le compilateur) | **coupé** |
| `next_speech_state` | « État de parole proposé pour ce tour » (`speechStateDirective`) | **coupé** ; le personnage garde ses états de fiche, sa rugosité et son historique et déclare lui-même l'état joué |
| `topics_covered` | « Déjà abordé : … Ne repars pas de zéro. » (attaché au conseil) | **coupé** (toujours cumulé et journalisé) |
| `action.handoff.proposalGuidance` | même canal que le conseil | **conservé** : c'est le passage entre personnages |
| règle de demande de changement du joueur (`buildSwitchRequestGuidance`, hors GM) | même canal | **conservé** |
| `memory_delta`, relation (`relationship`) | mémoire structurée, directive relationnelle | **conservé** (mémoire et relation) |
| état émotionnel de la mémoire | prosodie de la voix (`pendingEmotionalStateRef`), pas le texte | **conservé** |
| `trigger_video_id`, `action.cinematic`, `action.end`, labels | cinématiques, fin d'appel, étiquettes | **conservé** |

Le filtre est appliqué au moment de construire l'entrée du personnage (`src/services/gmSpeechGuidance.ts`, appelé
par `src/services/prd4Orchestrator.ts`). Chaque morceau de guidage porte son origine (`gm_advice`,
`handoff_proposal`, `switch_request`) depuis `src/pages/IndexPRD4.tsx` ; seul `gm_advice` est retiré. Activé, le texte
injecté est identique à celui d'avant (même concaténation).

## Dépendance à arbitrer : recadrages des garde-fous

Les garde-fous du GM (hors-sujet, faux statut, tolérance aux dérapages) agissent **par le conseil du tour suivant**.
Désactivé, ces recadrages ne sont plus transmis. Restent actifs : la frontière du monde et les interdits de la fiche du
personnage, la fin d'appel décidée par le GM (`action.type = end`) et ses garde-fous. Choix retenu pour ce lot : un mode
« naturel » sans aucun conseil, conformément à la tâche. Si l'écoute montre qu'il faut garder les recadrages en mode
désactivé, c'est un arbitrage d'Ulrich (lot 2).

## Traçabilité et changement en cours de session

- Le réglage est dans la configuration d'orchestration versionnée ; une session **épingle** sa version au départ
  (`pin_current_orchestration_version`). Le mode est donc fixe pour toute la session : changer et publier le réglage
  vaut pour les sessions suivantes. Aucune comparaison ambiguë au sein d'une session.
- Par tour : `gm_post_turn_log[].speech_guidance` (`on` / `off`) et `orchestration_config.editor.speechGuidance` ;
  trace diagnostique `gm.causalGuidance.speechGuidance` avec ce qui a été retenu (`withheld`) ; événements PostHog
  `prd4_turn_completed.gm_speech_guidance` et `prd4_gm_post_turn.speech_guidance`.
- Historique des sessions (admin) : « guidage de parole : activé / désactivé » en tête du journal GM.
- Résultats tardifs : le conseil en attente est consommé une seule fois et vient d'un post-tour de la même session,
  donc de la même version épinglée ; il ne peut pas réactiver le guidage. Double barrière : un post-tour marqué
  `speech_guidance: off` ne met jamais de conseil ni d'état de parole en attente (aussi à la reprise de session), et la
  génération refiltre selon la version épinglée ; si la lecture de cette version dépasse 400 ms, la première barrière
  suffit. GM absent ou en erreur : aucun conseil,
  comme avant, dans les deux modes.
- Rejeu sans session (juge J3) : `evaluationOverrides.gmSpeechGuidance` force le mode, rien n'est persisté.

## Latence

Aucun appel ajouté : la configuration épinglée était déjà lue avant la génération. Le GM tourne de la même façon dans
les deux modes.

## Protocole de recette humaine (Ulrich, Romed)

1. Sandbox : dans Réglages GM, créer un brouillon, désactiver « Guidage de parole du GM », publier. Noter le numéro de
   version. Pour revenir, publier une version avec l'interrupteur activé.
2. Pour chaque mode, au moins trois appels par personnage (Max, Emma), mêmes fiches, mêmes réglages de voix, scénarios
   comparables : ouverture, question sur la situation, question intime, détour hors-sujet, demande de parler à l'autre.
3. Vérifier dans l'historique des sessions la mention du mode et, en mode désactivé, les conseils « non transmis ».
4. Écouter et noter : fidélité au personnage, compréhension, spontanéité, émotion, répétitions, qualité des relances,
   tenue face au hors-sujet. Comparer plusieurs conversations avant de conclure.
5. Vérifier que cinématiques, passages Max ↔ Emma et fin d'appel fonctionnent dans les deux modes.

La livraison technique ne vaut pas validation artistique.

## Tests

`src/services/gmSpeechGuidance.test.ts` (défaut, ancienne version, aller-retour de sauvegarde, filtrage),
`src/services/prd4Orchestrator.test.ts` « GM speech guidance switch » (Max et Emma, activé / absent / désactivé,
proposition de passage conservée, GM toujours appelé, trace, rejeu forcé).

Suite : [prompt de reprise lot 2](prompt_reprise_guidage_parole_gm_lot_2.md).
