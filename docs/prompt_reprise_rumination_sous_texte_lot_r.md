# Prompt autonome — Ava, R : rumination et sous-texte

Tu exécutes et livres **uniquement le lot R** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1` (remote
`https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, la [feuille de route](feuille_de_route_jeu_personnages.md) (lot 5, « R »),
  le [plan du juge](plan_llm_as_judge.md) (section « Lot J3 ») et le [rapport J3](rapport_llm_juge_j3_sandbox_20261109.md).
- Ce prompt n'est pas une demande de nouveau plan général : écris le plan court du lot dans `docs/plan_rumination_lot_r.md`,
  puis implémente, mesure et livre par la garde.
- Un seul agent travaille sur le dépôt. Vérifie les sessions et worktrees actifs ; attends qu'un lot en cours soit
  fusionné avant de toucher ses fichiers. Préserve la PR #24 et le travail étranger.

## Point de départ (J3, 9 novembre 2026)

- `npm run eval:judge:sequences` rejoue 3 à 5 tours enchaînés (historique, mémoire structurée, boucle GM →
  personnage), en mémoire, sans session ; deux notes jamais fusionnées : par tour (grille J1) et par séquence
  (`continuity`, `thread_resumption`, `rumination`, `timeline_consistency`, `relational_trajectory`).
- Bruit mesuré par deux témoins : note par tour < 0,3, note de séquence < **1,0**, tour isolé < 1,2. Conclure avec
  3 passages au moins sur les 4 séquences.
- Mesures (contrat `lived_v2` joué) : `rumination` ≈ 3,3/5 — ce qui pèse revient, mais par **la même formule à chaque
  tour** (« je ne peux pas rendre ça moins grave », « je ne sais pas comment… ») ; `thread_resumption` est le critère
  le plus bas (2,4–3,1/5). Max **accepte des prémisses fausses** du joueur (thermos « le même soir », « Emma a
  contaminé Ava »). Emma « pas vu le film » nomme Mona, Léo, la contamination sans les présenter. Le prénom et le
  registre de l'interlocuteur sont peu repris alors que la mémoire structurée les contient.
- Le GM post-tour rend un JSON illisible dans ~17 % des tours (`invalid_json · json_unreadable`) : conseil et mémoire
  du tour perdus, en jeu comme en rejeu.
- Limite connue : le repère canon du juge ne contient que les derniers jours de la timeline en entier ; le juge de
  séquence a pénalisé la scène canon du premier soir (`max-A`).
- Corpus J3 : proposition [`docs/eval/sequences_j3_v1.json`](eval/sequences_j3_v1.json), à valider par Ulrich
  ([document](corpus_llm_juge_sequences_j3.md)) ; séquences C et D en attente des arbitrages A–F de Romed (tâche
  Notion « Rédiger et valider le corpus AVA »).

## Objectif

Rendre la rumination **crédible et non mécanique** (ce qui pèse revient sous une forme qui bouge, avec ce qui a déjà
été dit) et le sous-texte lisible, sans fausse prémisse acceptée, puis décider sur mesures entre un **complément de
fiche** (texte candidat en mémoire, jamais écrit dans la base Caractères) et une **consigne au Game Master**
(`next_turn_guidance` qui nomme ce qui a déjà été dit et ce qui reste sous la surface).

## Travail attendu

1. **Préalables de l'instrument** (petits, avant toute mesure) : donner au juge de séquence les faits attendus du
   corpus par tour comme repère prioritaire pour les jours que l'extrait de timeline ne contient pas ; si Ulrich a
   validé le corpus J3, saisir les séquences dans la base corpus (colonnes du document) ; sinon rejouer le fichier.
2. **Deux leviers, mesurés séparément en mémoire**, référence `optimized_v3` actuel :
   - (a) consigne GM « sous-texte » : le post-tour relève les formules déjà dites par le personnage et propose une
     autre entrée (un geste, un objet, une phrase coupée) plutôt que de les redire ; variante en mémoire du prompt GM
     (`systemPromptOverride` ou équivalent d'évaluation), jamais publiée ;
   - (b) complément de fiche candidat (rumination : ce qui revient, comment ça bouge d'un tour à l'autre, ne jamais
     valider une affirmation fausse du joueur), injecté en mémoire comme le PRÉSENT candidat du lot P.
3. **Mesure** : `npm run eval:judge:sequences` à 3 passages, plafond explicite (3,50 $ par run), un run par levier ;
   lire `rumination`, `thread_resumption`, `continuity` et la note par tour (aucun recul de `canon_timeline` ni de
   `must_not`). Adoption seulement au-delà des seuils de bruit ci-dessus.
4. **GM illisible** : mesurer le taux `invalid_json` sur les mêmes runs ; s'il gêne la lecture du levier (a),
   proposer un lot séparé de fiabilisation plutôt que de le traiter ici.

## Hors périmètre

Base Caractères (lecture seule : un complément adopté se propose à Ulrich, il ne s'écrit pas d'ici), grille J1 par
tour, STT/TTS, production, publication Lovable.

## Invariants

- Base Caractères AVA en lecture seule ; seules les tâches Notion et la base corpus (après validation) s'écrivent.
- Overrides d'évaluation en mémoire, jamais `admin_settings` ni `character_prompts` ; jamais `prod`.
- Lovable unique chaîne de livraison ; migrations éventuelles par le chat Lovable.

## Vérification

- Tests unitaires des leviers et de leur transport en mémoire ; `npm run test:quality` et `npm run test:delivery`.
- Runs réels sur sandbox avec plafond explicite ; coûts et rapports joints au plan.
- Livrer par PR, CI `regression-gates`, puis `ship-pr.mjs`. Mettre à jour CHANGELOG, `etat_courant`, la feuille de
  route et les tâches Notion « Évaluer le besoin d'un complément rumination » et « Batterie LLM juge ».

## Première action

`git status`, `git fetch --prune`, main propre, puis relire `buildSequenceJudgePrompt`
(`src/services/evalJudgeSequence.ts`) et le prompt du GM post-tour (`src/agents/gameMasterPRD4.ts`,
`next_turn_guidance` et `memory_delta`).

## Clôture

Livrer à la clôture le prompt autonome du lot suivant selon la feuille de route dans
`docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire explicitement qu'aucun lot ne suit.
