# Diagnostic MCP -32603 après publication 76aec5a6 (lecture seule)

## Constats Cloud réels
- HEAD : aef4dfb319a9bdc35594165160c74d93a86d6a1d (commit 2026-10-14T10:11:46+02:00).
- Journaux de la fonction `mcp` (iralfqlslqndgvexixis) :
  - Avant publication : `list_sessions` outcome ok (222 ms), `oauth.verify.ok`.
  - Après publication, à chaque démarrage (3 occurrences, ~60 ms après boot) :
    `UncaughtException: @lovable.dev/mcp-js: tool "get_voice_latencies" outputSchema cannot be represented as JSON Schema: Transforms cannot be represented in JSON Schema`
    stack : `assertToolSchemas` (mcp-js 3.0.5 errors-ZmYYVYKN.js:119) <- `defineMcp` (:143) <- `mcp/index.ts:890`.
- Cause confirmée : `src/lib/mcp/voiceTurnProjection.ts:26`, milestones `z.number().finite().nullable().optional().transform(v => v ?? null)`, repris dans l'`outputSchema` de `get_voice_latencies`. `defineMcp` refuse tout le serveur au chargement : les quatre outils tombent, d'où -32603 sur `list_sessions` et `get_usage_overview`. Hypothèse validée.
- Publication : la nouvelle version MCP est servie (elle plante) ; le frontend de la même publication n'est pas en cause. Statut détaillé du déploiement 76aec5a6 non lisible par mes outils.

## Correction proposée (non appliquée, à valider)
1. Retirer `.transform(...)` du schéma milestone (garder `nullable().optional()`).
2. Normaliser `undefined -> null` dans `projectVoiceEvents` après `safeParse`.
3. Ajouter un test : `z.toJSONSchema` de chaque `outputSchema` MCP ne lève pas.
4. Régénérer le manifeste MCP par le SDK, puis republier (seule voie de déploiement de `mcp`).

Aucun impact voix, preset, prompts, réglages, secrets ou migrations. Rollback : republier la révision précédente.
