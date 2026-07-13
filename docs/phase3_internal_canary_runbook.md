# Phase 3 — Canary interne et rollback

Date : 13 juillet 2026

Statut : **fondations implémentées — gate publique fermée**

## Périmètre

Cette phase prépare un déploiement progressif sans ouvrir l'application au public. Le premier palier est réservé à l'équipe interne. Le petit groupe de testeurs externes ne pourra être activé qu'en septembre, après validation explicite de la release gate.

La durée de l'expérience n'est pas fixée par le code : le slider admin enregistre `TIMEOUT_SECONDS` (2 à 30 minutes). Le runtime charge cette valeur avant la conversation ; le timer, la clôture Game Master et la durée persistée utilisent la même valeur. Pour la recette cible de 15 minutes, régler le slider à 900 secondes (ou à la valeur exacte souhaitée) avant de démarrer.

## Seuils de décision

Le panneau **Admin → Mécanique → Latences (PostHog)** applique les seuils suivants sur la fenêtre récente :

| Mesure | Promotion | Rollback |
|---|---:|---:|
| Échantillon interne | ≥ 5 sessions et ≥ 30 tours | — |
| p95 fin de parole → premier son | ≤ 5 000 ms | > 5 000 ms |
| Tours en échec | ≤ 2 % | > 2 % |
| Opérations de persistance réussies | ≥ 99,5 % | < 99,5 % |
| Coût total par session | sous budget approuvé | au-dessus du budget |

Une donnée absente, un échantillon insuffisant ou un budget non approuvé donne **EN ATTENTE**, jamais une promotion implicite. Un seul dépassement donne **ROLLBACK**.

## Télémétrie et confidentialité

- `voice_turn_completed` mesure les tours, le p95 du premier son et la sévérité.
- `prd4_persistence_result` mesure séparément création, onboarding, mise à jour de conversation, clôture et questionnaire.
- Les coûts LLM sont agrégés par `session_id` dans le dashboard usage ; le budget maximum doit être validé avant le canary externe.
- PostHog ne collecte plus automatiquement les clics et n'enregistre plus les sessions. Seuls les événements explicitement conçus sont envoyés.

Dans PostHog, créer une insight sur `prd4_persistence_result`, filtrer la période du canary et calculer le pourcentage de `success = true`. Créer une seconde insight sur `voice_turn_completed` avec p95 de `t_turn_voice_ready_ms` et un breakdown de `severity`.

## Procédure interne

1. Vérifier que la visibilité Lovable reste privée/interne.
2. Choisir et sauvegarder la durée dans le slider admin ; recharger l'admin et confirmer la valeur persistée.
3. Publier le frontend et, pour ce lot, redéployer uniquement `summarize-session` car son prompt ne suppose plus une durée fixe.
4. Faire un smoke test STT → RAG → LLM → TTS avec Deepgram puis Gamilab.
5. Réaliser au moins 5 sessions internes et 30 tours cumulés, dont une session complète à la durée cible.
6. Relever les quatre mesures, ajouter le budget approuvé, puis appliquer la décision sans dérogation silencieuse.
7. Revoir quotidiennement erreurs, coûts, complétion et abandons pendant la première semaine de tout canary externe.

## Rollback

Si un seuil est dépassé :

1. arrêter immédiatement l'élargissement du groupe ;
2. republier dans Lovable le dernier commit validé ;
3. si `summarize-session` a été redéployée, remettre sa version précédente ;
4. conserver les événements de diagnostic, sans exporter de transcription ;
5. corriger et recommencer avec une nouvelle fenêtre de mesures.

Ce lot ne contient aucune migration de base ni modification de secret fournisseur. Le rollback frontend est donc indépendant des données déjà persistées.
