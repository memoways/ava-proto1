# P0 — Faux statut « failed » du contrôle de quota (diagnostic et correction proposée)

## Constat (lecture seule, 12 oct. 2026, Lovable Cloud iralfqlslqndgvexixis)

- Session accc1e30, ~17:54 UTC : la ligne de quota du participant a bien été consommée.
  `query-rag` : 1 requête (fenêtre ouverte 17:54:11) ; `proxy-llm` : 4 requêtes (fenêtre ouverte 17:54:14).
  Le contrôle a donc été appliqué et a autorisé ces appels. Pas de vrai refus, pas de contournement (fail-open).
- Aucun log `[game-guard] ... rate-limit error` pour `query-rag` ni pour `proxy-llm` sur cette période : l'appel de quota n'a pas échoué.
- `public.consume_game_rate_limit(p_bucket text, p_session_id uuid)` : SECURITY DEFINER ; EXECUTE pour authenticated, service_role et postgres ; pas pour anon.
  Ces droits sont inchangés depuis la migration `20260712165019_secure_public_game_sessions.sql`, réappliquée telle quelle le 10 sept.
- Les erreurs `42501` de 16:55 UTC venaient de mes appels de contrôle faits avec la clé anonyme, sans identité de jeu. Elles n'ont aucun lien avec l'échange réel.

## Cause exacte

`supabase/functions/_shared/monotonicSpans.ts` arrive avec le squash P0 `12d5f29`. La fonction `failedResult` y considère `null` comme un échec.
Or `enforceGameRequest` renvoie `null` quand l'appel est **autorisé**, et une `Response` (401/429/503) quand il est refusé.
Chaque contrôle de quota réussi est donc marqué `control_quota: failed` dans `_ava_observability`.

- C'est une **régression P0 d'observabilité seulement**. Le contrôle et la voix ne sont pas touchés.
- Les vrais refus restent bien marqués « failed » : une `Response` 4xx/5xx a `ok === false`.
- Conséquence sur la mesure : le statut de ce jalon est faux. La durée relevée (~166 ms et ~80 ms) reste valable.

## Impact sur la gate de publication

Ce défaut ne bloque pas le parcours vocal. Il bloque en revanche la validation des mesures V2 : tous les tours afficheraient un échec de quota.
Je recommande de le corriger avant de publier. Sinon, publier en documentant que `control_quota.status` n'est pas fiable.

## Correction P0 proposée (non appliquée)

1. Dans `query-rag` et `proxy-llm`, envelopper l'appel `control_quota` : `null` (autorisé) donne `ok`, une `Response` donne `failed`.
   Alternative : passer à `spans.run` un classificateur propre au jalon. Aucun changement de `failedResult` pour les autres jalons.
2. Tests unitaires : appel autorisé (`null`) → `ok` ; 401, 429 et 503 → `failed`.
3. Redéployer uniquement `query-rag` et `proxy-llm` via Lovable Cloud.
   Vérifier sur un tour réel en sandbox-ulrich : `control_quota: ok`, et la ligne de quota consommée.
4. Consigner le diagnostic et la correction dans `docs/plan_lot_1_observabilite_latence.md`.

Hors périmètre : migration, droits, secrets, prompts, voix, capture, et la fonction de quota elle-même.
