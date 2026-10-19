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
