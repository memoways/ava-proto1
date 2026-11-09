# Prompt autonome — Ava, lot P : parole guidée par le juge (générateur PRÉSENT)

Tu exécutes et livres **uniquement le lot P** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1` (remote
`https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, la
  [feuille de route](feuille_de_route_jeu_personnages.md) (lot 3, « P »),
  [l'analyse de la parole sous le choc](analyse_parole_sous_le_choc.md) (« Après ce lot ») et le
  [plan du juge](plan_llm_as_judge.md), sections « Lot J1 » et « Lot J2 ».
- Ce prompt n'est pas une demande de nouveau plan général : écris le plan court du lot dans
  `docs/plan_parole_lot_p.md`, puis implémente, mesure et livre par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger.

## Point de départ (9 novembre 2026)

- C1 (`optimized_v3`) : vécu Notion protégé avant les faits ; PRÉSENT renommé « REPÈRES — CE QUE TU SAIS ».
- Juge J1 : grille de onze critères, mode référence contre candidat. Juge J2 : même comparaison sans navigateur,
  `npm run eval:judge` (identifiants dans `.env.eval.local`, plafond `--max-cost-usd`), ou workflow manuel
  « LLM judge (manual) » (secrets `AVA_EVAL_EMAIL` / `AVA_EVAL_PASSWORD`).
- Mesures de référence (sandbox-ulrich, 21 questions × 2 × 3 passages, juge Claude Sonnet 5.5) :
  J1 run `690eaf20-4e1c-44b2-99f3-4ea23817a9d4` (admin) et J2 run `b12b2d34-5d57-44bf-aaab-e6798aeb0fcd` (sans navigateur ; `optimized_v3` 5,02 /10, `rich_v2` 4,96, bruit ± 0,57, 2,13 $) ;
  résultats dans le [plan du juge](plan_llm_as_judge.md#lancement-réel-sans-navigateur-sandbox-ulrich-9-novembre-2026).
- Défauts relevés par le juge côté Max : énumération des morts à « Qu'est-ce qui s'est passé à la montagne ? »
  (`not_meta`, `lived_impact` à 2) et « Peter a été tué il y a deux jours » (`canon_timeline` 0), cohérent avec
  l'erreur du résumé PRÉSENT généré pour Max. Critère le plus faible : la longueur.
- Le résumé PRÉSENT n'est pas écrit par Ulrich : `generateSituationSummary` dans
  `supabase/functions/sync-notion/index.ts` le génère à la synchro (3e personne, faits denses,
  « OBLIGATION DE COUVERTURE »), puis le stocke dans `character_prompts.situation_summary` **par environnement**
  (`environment_id`, défaut `prod` si absent). Le mode `fields_only` régénère les champs sans toucher au RAG.

## Objectif

Faire parler Max et Emma depuis leur vécu plutôt qu'en inventaire, et corriger la chronologie du PRÉSENT, en
mesurant chaque changement avec le juge J2 avant toute écoute.

## Travail attendu

1. **Mesure avant** : un run J2 témoin `--reference optimized_v3 --candidate optimized_v3` (le bruit), si le run
   J2 de référence ci-dessus ne suffit pas. Noter coût et Δ.
2. **Générateur PRÉSENT** : consigne à la 2e personne, sans « OBLIGATION DE COUVERTURE », chronologie explicite
   (J−2 à l'hôtel ≠ appartement aujourd'hui ; dates de mort exactes). Tests du prompt généré.
3. **Comparer sans toucher prod** : rendre le PRÉSENT candidat mesurable en mémoire (par exemple un résumé candidat
   transmis par `evaluationOverrides`, généré à la volée ou lu depuis un instantané), ou, à défaut, resynchroniser
   **uniquement `sandbox-ulrich` en `fields_only`** puis comparer au run J2 de référence. Décider dans le plan et
   le justifier. Jamais de resynchro `prod`.
4. **« Livre d'abord ton contenu »** (`src/services/responseIntentStream.ts`) : reformulation candidate, mesurée de
   la même manière, séparément du point 2 pour isoler les effets.
5. Rapport : Δ par critère et par question (surtout `not_meta`, `lived_impact`, `canon_timeline`, longueur), coût,
   décision proposée ; puis écoute AP5 par Ulrich (recette humaine, distincte de la livraison technique).

## Hors périmètre

Plusieurs tours (J3), changement de grille du juge, fiches et champs Notion des personnages, STT/TTS, production.

## Invariants

- **Base Caractères AVA en lecture seule** : aucune modification de champ, de contenu RAG ni de page personnage ;
  une évolution éditoriale se propose dans `docs/`. Seules les tâches Notion se mettent à jour d'ici.
- `sync-notion` lit Notion et écrit la copie Lovable : toujours `environment_id` explicite (`sandbox-ulrich`).
- Overrides d'évaluation en mémoire uniquement, jamais `admin_settings`.
- Lovable unique chaîne de livraison ; Edge Function modifiée redéployée par Lovable ; migrations via le chat Lovable.

## Vérification

- Tests unitaires du générateur et du compilateur ; `npm run test:quality` et `npm run test:delivery`.
- Runs J2 réels sur sandbox avec plafond explicite, coûts et rapports joints au plan.
- Livrer par PR, CI `regression-gates`, puis `ship-pr.mjs`. Mettre à jour CHANGELOG, `etat_courant`, la feuille
  de route et la tâche Notion « Rendre les dialogues… moins écrits » (ou la tâche parole sous le choc).

## Première action

`git status`, `git fetch --prune`, main propre, puis lire `generateSituationSummary`
(`supabase/functions/sync-notion/index.ts`) et la manière dont `runIsolatedEvalTurn` obtient
`situation_summary` (`characterPromptService`, `experienceOrchestration`), pour choisir la voie de comparaison
en mémoire.

## Clôture

Livrer à la clôture le prompt autonome du lot suivant (J3 selon la feuille de route) dans
`docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire explicitement qu'aucun lot ne suit.
