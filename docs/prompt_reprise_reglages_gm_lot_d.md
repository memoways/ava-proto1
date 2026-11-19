# Prompt de reprise — Réglages GM, lot D : état du personnage (radar 5 dimensions)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : donner à chaque personnage un état initial sur 5 dimensions (radar), transmis au personnage à chaque tour, que
le GM peut faire évoluer pas à pas, sans appel IA ajouté. Lot D du plan validé le 19 novembre 2026, après les lots A (#207),
C (modes GM, #208) et B (priorités en curseurs).

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début
du CHANGELOG, puis [le plan](plan_reglages_gm_lisibles_gradues.md) (« État des lots », « Lot D », « Principe directeur »).

État vérifié (fin du lot B) :
- Registre `src/services/gmSettingsRegistry.ts` : une entrée par réglage (texte exact, aperçu automatique). Le lot B a
  ajouté `src/services/gmPriorities.ts` (modèle à niveaux 0–3, fragments par cran, règle d'arbitrage) : bon modèle pour
  les fragments par niveau d'axe du radar.
- `editor.gmMode` (off / light / full) et `injected` par tour existent ; en off le GM n'est pas appelé, l'état reste donc
  à sa valeur initiale.
- `editor.priorityLevels` (lot B) remplace `priorities[]` ; `schemaVersion` des configs GM vaut 2.
- Blocs prompt personnage : « PAROLE DU TOUR » dans `src/agents/maxAgent.ts` et `src/agents/maxOptimizedPromptCompiler.ts`.
- Sortie GM post-tour : JSON de `src/agents/gameMasterPRD4.ts` / `src/services/gameMasterContract.ts` ; journal
  `gm_post_turn_log[]` par session.

Périmètre (détail dans le plan, « Lot D ») :
1. Dimensions proposées, 0–5, libellés éditables, **à valider avec Romed avant code définitif** : Combativité, Initiative,
   Lucidité, Ouverture, Agitation.
2. Stockage : colonne `state_profile` jsonb dans `character_runtime_profiles` : `{ initial, min, max, gmCanEvolve,
   maxStepPerTurn (défaut 1) }`. Migration SQL livrée en fichier dans `supabase/migrations/`, **appliquée via le chat
   Lovable** après fusion (jamais de Supabase direct).
3. Back-office `src/components/CharacterRuntimeSettingsTab.tsx` : radar Recharts éditable (5 curseurs), bornes min/max,
   aperçu du fragment envoyé.
4. Personnage : bloc « ÉTAT DU PERSONNAGE À CE TOUR » compilé par niveau d'axe (fragments au registre), avec « PAROLE DU
   TOUR ». Coexiste avec la rugosité (forme de la parole) ; l'état règle l'attitude.
5. GM : section « ## ÉTAT DU PERSONNAGE » et champ optionnel `character_state_delta` dans la sortie post-tour. Validation
   déterministe : ±`maxStepPerTurn`, bornes, personnage et tour source corrects, résultat tardif ignoré (mêmes protections
   que le conseil en attente). Appliqué au tour suivant. Mode off : état initial fixe ; light : évolution conservée.
6. Trace : état par tour dans `gm_post_turn_log`, mini-radar et courbe par dimension dans l'historique des sessions.
7. `emotionalState` → prosodie inchangé.

Hors périmètre : courbe d'expérience (lot E, cadrage seulement).

Limites : base Caractères Notion en lecture seule (aucune modification de champ ni de contenu RAG) ; aucun Supabase direct
(MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc` en lecture) ; aucune publication production ; aucun appel IA ajouté.

Première action : vérifier en lecture (Lovable) la forme actuelle de `character_runtime_profiles` (colonnes, RLS, lignes par
environnement), puis écrire les tests (validation de `character_state_delta` : bornes, pas, tardif, mauvais tour ;
fragments par niveau ; modes off / light) avant le code. Demander à Ulrich la validation des 5 dimensions avec Romed si
elle n'est pas déjà consignée dans le plan.

Validations : tests unitaires, `npm run test:quality`, `npm run test:delivery`, contrôle navigateur (radar éditable,
historique des sessions), CI de la PR verte (`regression-gates`). Recette humaine sandbox (Ulrich + Romed) distincte.

Livraison : branche du lot depuis `main` à jour ; plan, CHANGELOG et `docs/etat_courant.md` mis à jour ; prompt de reprise
du lot E (déjà écrit : [lot E](prompt_reprise_courbe_experience_gm_lot_e.md)) relu et ajusté avant push ; fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec` ;
arbre fusionné vérifié ; branche nettoyée ; migration collée dans le chat Lovable après fusion ; tâche Notion
[5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) mise à jour (tâches uniquement).

Clôture : s'il reste un lot (E), livrer son prompt de reprise autonome dans `docs/` avec cette même obligation ; sinon le
dire explicitement.
