# P0 — Reprise compilation et déploiement après la PR #27 (sans réimplémentation)

## Situation vérifiée
- PR #27 « fix: correct quota status and capture readiness in P0 telemetry » est fusionnée : squash `6ad0d422fce66d6ea04c483fa22e743aa371d119`. Le HEAD de `main` sur GitHub est `6e52733cea6ae29cce63884ac2e824586946b705`.
- Le projet Lovable est encore à `7c8a9cb` : ni la PR #27 ni le HEAD de `main` ne sont présents. `query-rag` et `proxy-llm` contiennent toujours l'ancien appel `control_quota`.
- Le plan précédent, sur ce même défaut, est abandonné. Aucun code ne sera réécrit.

## Étapes
1. **Synchronisation** : attendre que Lovable ramène `main` GitHub dans le projet. Je ne lance moi-même aucune commande git. Ensuite, vérifier que `6ad0d42` et `6e52733` sont bien ancêtres de HEAD. S'ils ne le sont pas, m'arrêter et le signaler.
2. **Cible** : confirmer `project_id = iralfqlslqndgvexixis`.
3. **Compilation** :
   - `bun run build`, avec l'exit code réel.
   - Tests automatiques de la PR #27 et `deno check` des fonctions touchées.
   - Régénération du MCP par le SDK 3.0.5 uniquement (imports `npm:zod@4.6.6`, plugin intact).
4. **Déploiement Lovable Cloud** : uniquement les fonctions modifiées par la PR #27 (`query-rag`, `proxy-llm`, et un helper partagé s'il change). Relever les empreintes SHA256. `mcp` reste en attente de la publication.
5. **Contrôles** :
   - Refus anonyme toujours 401.
   - Logs récents propres.
   - Lecture V2 admin toujours HTTP 200.
   - Aucune donnée synthétique.
   - Sur le prochain tour réel d'Ulrich : `control_quota: ok` et la ligne de quota consommée.
6. **Traçabilité** : consigner dans `docs/plan_lot_1_observabilite_latence.md` les preuves suivantes :
   - la révision ;
   - le build ;
   - les fonctions déployées ;
   - les limites ;
   - le diagnostic en lecture seule (quota bien consommé à 17:54, faux statut « failed » dû à `null` interprété comme échec, droits de la fonction de quota inchangés depuis juillet).

Hors périmètre : publication du frontend, migration, droits, secrets, prompts, voix, capture et lot 2.
