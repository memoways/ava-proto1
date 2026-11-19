# Prompt de reprise — Réglages GM, lot B : priorités d'analyse en curseurs 0–3

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : remplacer les 4 cases « Priorités d'analyse » (sans effet visible) par des curseurs 0–3 dont l'effet est
mesurable dans les conseils du GM. Lot B du plan validé le 19 novembre 2026, après les lots A (#207) et C (modes GM).

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début
du CHANGELOG, puis [le plan](plan_reglages_gm_lisibles_gradues.md) (« État des lots », « Lot B », « Principe directeur »).

État vérifié (fin du lot C) :
- Registre `src/services/gmSettingsRegistry.ts` : une entrée par réglage (texte exact par valeur, aperçu automatique) ;
  entrée `priorities` actuelle = liste non pondérée (`prioritiesFragment`, `gameMasterPromptBuilder.ts`).
- Bloc de réglages compilé à chaque tour (`resolveDirectorSystemPrompt`, `src/agents/gameMasterPRD4.ts`), `builtin://`
  compris. `editor.gmMode` existe (off / light / full) ; en off, le GM n'est pas appelé : les priorités n'y ont aucun effet.
- `editor.priorities: Array<...>` (4 axes : narrative_continuity, player_engagement, safety, pace) ;
  normalisation dans `normalizeDirectorConfig` (`src/services/experienceOrchestration.ts`).
- Juge J3 : snapshot `parseSnapshotOverrides` / `buildEvalTurnOverrides` (`evalJudgePipeline.ts`), utile pour rejouer deux
  profils de priorités.

Périmètre (détail dans le plan) :
1. `editor.priorityLevels: Record<PriorityKey, 0|1|2|3>` (0 ignoré, 1 léger, 2 normal, 3 prioritaire) ; normalisation
   depuis `priorities[]` : cochée → 2, décochée → 0 ; `schemaVersion` + 1.
2. Fragment par cran et par axe au registre, plus règle d'arbitrage générée (« En cas de conflit, applique d'abord : X (3),
   puis Y (2)… »). Sécurité : plancher à 1 pour la sécurité (ne peut pas être coupée), affiché dans l'UI.
3. UI : 4 curseurs (`Slider` shadcn) avec le texte du cran courant ; aperçu automatique.
4. Effet mesurable : rejouer le corpus J3 avec deux profils contrastés ; la différence doit être visible dans les conseils
   GM, sinon réduire à 3 crans.

Hors périmètre : radar d'état (lot D), courbe d'expérience (chantier E).

Limites : base Caractères Notion en lecture seule ; aucun Supabase direct (MCP Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc` en lecture) ; aucune publication production ; aucun appel IA ajouté ; migration
éventuelle livrée en fichier et appliquée via le chat Lovable.

Première action : vérifier en lecture (Lovable) les `config->editor->priorities` des versions publiées par environnement,
puis écrire les tests (normalisation, fragments par cran, arbitrage, plancher de sécurité) avant le code.

Validations : tests unitaires, `npm run test:quality`, `npm run test:delivery`, contrôle navigateur
(`/__preview/gm-settings` en dev), CI de la PR verte (`regression-gates`).

Livraison : branche du lot depuis `main` à jour ; plan, CHANGELOG et `docs/etat_courant.md` mis à jour ; prompt de reprise
du lot D écrit avant push ; fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec` ; arbre fusionné vérifié ; branche nettoyée ; tâche Notion
[5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) mise à jour (tâches uniquement).

Clôture : s'il reste un lot (D, puis E), livrer son prompt de reprise autonome dans `docs/` avec cette même obligation.
