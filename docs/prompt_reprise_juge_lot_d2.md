# Prompt autonome — Ava, lot D2 : un état émotionnel qui évolue vraiment

Tu exécutes et livres **uniquement le lot D2** dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`
(remote `https://github.com/memoways/ava-proto1`). Lis AGENTS.md, `docs/etat_courant.md`,
[`docs/plan_juge_direction_rounds.md`](plan_juge_direction_rounds.md) (lot D2 et lot H livré),
[`docs/eval/juge_hierarchie_lot_h_20261121.md`](eval/juge_hierarchie_lot_h_20261121.md),
[`docs/plan_reglages_gm_lisibles_gradues.md`](plan_reglages_gm_lisibles_gradues.md) (lot D) et le code cité ci-dessous.
Un seul agent ; préserve la PR #24 et le travail étranger ; `git fetch --prune`, main propre (le lot H est fusionné :
relis les six derniers commits de main), branche du lot depuis main.

**Point de départ vérifié (fin du lot H, 21 novembre 2026)**
- Hiérarchie écrite en tête du prompt personnage (`INSTRUCTION_HIERARCHY`, `src/agents/maxOptimizedPromptCompiler.ts`) :
  faits de la fiche > cadre > état de l'app > parole du tour ; le radar règle l'attitude, jamais la vérité ni le registre.
- Radar (`src/services/characterState.ts`) : textes « attitude vécue » `STATE_LEVEL_TEXT_LIVED`, joués seulement si le profil
  a `livedTexts: true` (désactivé par défaut tant que Romed n'a pas validé le libellé, voir
  `docs/proposition_romed_hierarchie_lot_h.md`) ; bornes recommandées Max `RECOMMENDED_STATE_BOUNDS` (non appliquées).
- Une seule décision GM par tour : la section « ÉTAT DU PERSONNAGE » du GM impose la cohérence de `next_speech_state`
  avec le radar. Vue « Voir ce que reçoit le personnage » (Réglages personnages) avec la provenance de chaque couche
  (`src/services/characterPromptLayers.ts`). Interrupteurs d'évaluation en mémoire : `instructionHierarchy`,
  `intellectualReferences`, `radarTexts` (instantané du juge, jamais `admin_settings`).
- Mesure factualité avant/après lot H : voir le rapport ci-dessus (même corpus, bruit 1,37 pt).

**Objectif** : les courbes d'état sont « très linéaires » (retour du 19 novembre). Comprendre pourquoi, puis faire évoluer
l'état de façon crédible, ancrée sur des événements, dans les bornes de l'app.

**Travail**
1. Diagnostic sur des sessions réelles de sandbox-ulrich (lecture seule) : calcul de `character_state_after`,
   `validateStateDelta` (pas maximum 1, bornes), ce que le GM propose réellement (`character_state_delta`), transmission au
   tour suivant (`resolveCharacterStateForTurn`, mode GM off/léger/fort), affichage (`stateSeriesByCharacter`). Dire où la
   linéarité naît (GM qui bouge toujours dans le même sens ? pas de 1 ? bornes ? absence d'événement déclencheur ?).
2. Règles d'évolution ancrées sur des événements, dans le contrat GM (`buildGmStateSection`) : insistance → fermeture,
   écoute → ouverture, sujet Emma/Mona → agitation, etc. ; toujours dans les bornes ; validation par le code, jamais d'appel IA
   ajouté ; textes validés par Romed avant tout effet en jeu (réglage désactivé par défaut).
3. Persistance de l'état entre deux appels d'une même expérience (`rebuildCharacterStates`), à vérifier de bout en bout.
4. Mesure : courbes non linéaires sur au moins 3 sessions rejouées en sandbox ; rapport daté dans `docs/eval/` ; la
   factualité ne baisse pas au-delà du bruit (rejeu du corpus factuel du lot F, plafond ≤ 3 $ annoncé avant chaque run).

**Limites** : base Caractères en lecture seule (interdiction formelle) ; aucune production ; aucune migration hors chat
Lovable (la colonne `state_profile` est déjà migrée si la migration `20261119140000` a été collée : le vérifier, sans
l'appliquer) ; `sync-notion` seulement avec `environment_id: "sandbox-ulrich"` ; ne pas relancer les rounds F, J4, J5 ;
overrides d'évaluation en mémoire.

**Validation** : tests purs de l'évolution (non linéarité sur des scénarios d'événements), `npm run test:quality`,
`npm run test:delivery`, CI `regression-gates` verte sur le HEAD exact.

**Livraison** : `docs/etat_courant.md`, `CHANGELOG.md`, plan mis à jour ; commit, push, PR,
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` ;
vérifier origin/main ; tâche Notion du juge mise à jour avec le SHA ; **prompt de reprise du lot suivant (J4 : direction
de jeu) écrit dans `docs/prompt_reprise_juge_lot_j4.md`** avec cette même obligation de prompt, ou dire explicitement
qu'aucun lot ne suit.
