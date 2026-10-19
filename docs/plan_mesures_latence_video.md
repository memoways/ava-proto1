# Mesure de latence des services vidéo — 19 octobre 2026

## Objectif et contrat de mesure

Ajouter le service vidéo réellement exécuté dans Qualité → Latence & blocage et
Latence PostHog. L'instrumentation reste passive, sans nouvelle attente réseau,
dépendance, migration, polling ou modification des interruptions.

- `video_ms` / `t_video_wait_ms` : appel de rendu → premier callback de parole du
  fournisseur, avec le lecteur déjà autorisé par le parcours existant. C'est une
  estimation logicielle, pas une mesure physique du premier pixel/son.
- Le service vidéo intègre sa propre synthèse : aucune séparation TTS/animation
  n'est inventée. En succès vidéo, cette attente remplace le segment TTS local.
- En échec avant démarrage, conserver l'attente vidéo jusqu'à l'échec et mesurer
  ensuite le TTS de secours séparément. Les totaux observés ne sont pas augmentés
  une deuxième fois. Annulation et absence de démarrage restent explicites.
- Fournisseur et identifiant de modèle/avatar viennent de l'instance exécutée,
  jamais d'un fournisseur fixé dans le reporting ou des réglages courants.
- Les anciens tours sans vidéo restent non mesurés ; pas de zéro inventé.

## Réalisation

1. Instrumenter l'interface commune de sortie et conserver le résultat du service
   vidéo même lorsqu'un TTS de secours prend le relais.
2. Enrichir le pipeline persistant, les événements PostHog existants et les
   observations V2. Réutiliser les colonnes JSON existantes.
3. Ajouter vidéo aux segments, budgets diagnostiques, comparaisons/évolution,
   agrégats PostHog, filtres de fournisseur et détail des tours lents. Tolérer
   l'ancienne réponse backend pendant une synchronisation Lovable progressive.
4. Tester succès, échec, annulation, fallback, fournisseur arbitraire, historique
   et absence de double comptage ; exécuter typecheck, lint et tests adaptés.

## Livraison et validation

Lovable `1265958d-b74e-40f2-917d-182fe05163fc` / Lovable Cloud demeure l'unique
chaîne de publication. PostHog `137897` (AVA prototype 1) confirmé via MCP.
Livrer par branche et PR vers `main`, puis synchroniser/vérifier dans Lovable.
La fonction `posthog-latency-stats` doit être déployée par Lovable Cloud.
Aucun changement de réglage vidéo ni publication externe.

Référence capture additive : https://posthog.com/docs/libraries/js/usage

## État

Implémentation terminée : mesures V1/V2, segments persistants, filtres et détails
PostHog, comparaisons et évolution internes. Le bundle MCP est régénéré pour
accepter le service vidéo sans invalider les nouveaux tours.

Vérifications locales : 631 tests unitaires et 34 tests d'intégration réussis ;
typecheck, lint (un avertissement préexistant) et compilation compatibles avec le
projet Lovable réussis. Les tests couvrent les deux panneaux, l'ancienne réponse
Cloud, l'attribution réelle, le premier callback vs durée de lecture, l'échec,
l'annulation, le fallback et les autorisations de l'agrégateur. Tests navigateur
et CI en cours à la création de la PR. Aucun gain de latence revendiqué.

À vérifier après fusion : synchronisation du commit dans Lovable, déploiement
Lovable Cloud de `posthog-latency-stats` et `mcp`, compilation/preview, puis un tour
vidéo réel et les mesures visibles dans Qualité. La publication et les mesures
réelles restent distinctes des tests locaux ; pas de mesures rétroactives.

## Publication autorisée et vérifiée — 19 octobre 2026

- Accord explicite d'Ulrich : « Oui, publier et déployer ». Le refus initial de
  publication sans cet accord a été respecté.
- PR [#47](https://github.com/memoways/ava-proto1/pull/47) fusionnée :
  `813cef8b837d5b8b143630523fbc23143905d3ca`. CI de la PR et CI post-fusion
  réussies ; 631 tests unitaires, 34 d'intégration et 45 navigateur réussis.
- `posthog-latency-stats` déployée par Lovable Cloud, démarrage attesté dans les
  journaux le 19 octobre à 11:05:36–37 UTC. Appel anonyme refusé 401.
- Lovable a ajouté les types `SupabaseClient` et des gardes `!body` redondantes
  pour corriger ses erreurs Deno préexistantes dans `manage-test-invitations`,
  `redeem-test-invitation` et `rag-question-corpus`. Ces fonctions n'ont pas été
  redéployées pendant cette intervention. Les différences ont été relues : pas
  de nouveau parcours métier, modification de droits ni dépendance runtime.
  Deno check réussit dans Lovable sur les trois fonctions ; 8 tests associés
  réussissent, puis 18 tests ciblés sont rejoués localement avec succès.
- Révision Lovable publiée : `cd9286bdb490ee526df38e6c2d3bc65987f2a33c`.
  Compilation Lovable « build OK » à 11:07:07 UTC. Manifeste MCP régénéré pour
  `video` et `durations.video_wait_ms`. Checkout canonique synchronisé et propre.
- Publication native demandée : `ac0566f0-7178-4fc1-88bb-adcba93e0fb9`.
  Le statut terminal détaillé de ce job n'est pas exposé par le connecteur ;
  le résultat est vérifié sur le site effectivement servi : HTTP 200, module
  `assets/index-Bcr-tbnY.js` contenant le nouveau libellé vidéo, et vérification
  visuelle authentifiée des deux panneaux en production.
- [Latence & blocage publiée](https://proto1.parle-a-ava.com/admin/qualite/latence-et-blocages) :
  étape vidéo et évolution visibles ; historique sans vidéo non mesuré.
- [Latences PostHog publiées](https://proto1.parle-a-ava.com/admin/qualite/latences-posthog) :
  filtre Service vidéo, décomposition vidéo et réponse authentifiée PostHog
  avec fraîcheur affichée au 19 octobre à 13:10:16 Europe/Zurich.
- MCP opérationnel après publication : appel natif `get_voice_latencies`
  réussi, 0 ligne V2 invalide ; journaux `oauth.verify.ok` et `outcome: ok`
  à 11:10:01–02 UTC. Lovable livre MCP par la publication du site ; aucune
  empreinte/version du bundle effectivement déployé n'est disponible pour
  attester séparément son schéma. Ne pas confondre disponibilité et preuve de
  version exacte.

Reste fonctionnel : observer le premier nouveau tour vidéo réel pour confirmer
la mesure du fournisseur effectif et son passage dans les données V1/V2. Aucun
tour payant ni donnée synthétique n'a été ajouté pour simuler cette preuve.
