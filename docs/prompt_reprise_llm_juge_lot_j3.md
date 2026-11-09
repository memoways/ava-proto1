# Prompt autonome — Ava, J3 : juge sur plusieurs tours

Tu exécutes et livres **uniquement le lot J3** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1` (remote
`https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, la [feuille de route](feuille_de_route_jeu_personnages.md) (lot 4, « J3 »),
  le [plan du juge](plan_llm_as_judge.md) (sections J1 et J2) et le [plan du lot P](plan_parole_lot_p.md) (décisions et
  résultats).
- Ce prompt n'est pas une demande de nouveau plan général : écris le plan court du lot dans `plan_llm_as_judge.md`
  (section « Lot J3 »), puis implémente, mesure et livre par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger.

## Point de départ (lot P, 9 novembre 2026)

- Le juge J1/J2 rejoue **une réplique isolée** : `runIsolatedEvalTurn` appelle `processPRD4Turn` avec
  `conversationHistory: []`, sans mémoire de session ni conseil du Game Master du tour précédent. Rumination,
  continuité, reprise d'un fil et effet du GM ne sont donc pas mesurables.
- J2 : `npm run eval:judge` sur sandbox (identifiants dans `.env.eval.local` à la racine du checkout canonique,
  plafond `--max-cost-usd`, `prod` refusé, `admin_settings` intouchable). Lot P : leviers en mémoire
  `situationSummaries` (PRÉSENT candidat, `--candidate-present`, `--candidate-json @fichier`) et `streamContract`.
- Lot P : contrat de flux `lived_v2` joué par défaut (+0,33/10 sur une réplique) ; PRÉSENT v2 non retenu. Le juge
  rejoue un tour refusé par la limite `proxy-llm` (60 appels/min par compte) au lieu de noter une réplique de
  secours ; un rejeu multi-tours multiplie les appels : prévoir le rythme.
- Bruit mesuré (lot P) : sur la même référence, |Δ| moyen par question 0,53, jusqu'à 2,3 ; seul le global et les
  critères agrégés se lisent ; une question isolée compte au-delà de 1,3.
- Corpus multi-tours : corpus v0 (4 séquences × 5 tours, Max, « vu le film ») rédigé et commenté par Romed dans la
  tâche Notion « Batterie LLM juge » (spec v2), six arbitrages ouverts, écrit avant la réécriture des fiches du
  25 octobre. La base corpus n'a pas encore les colonnes Séquence, Tour et Continuité.

## Objectif

Mesurer référence contre candidat sur **3 à 5 tours enchaînés**, avec historique, mémoire de session et boucle
GM → personnage, sur Max et Emma, pour décider ensuite du lot R (rumination et sous-texte) sur des mesures.

## Travail attendu

1. Lire la spec v2 et le corpus v0 dans Notion (Gamilab, `get-self` = `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) ;
   lister les six arbitrages de Romed et les décisions déjà prises. Proposer dans `docs/` la mise à jour du corpus
   (séquences Max et Emma, état « vu / non vu le film ») ; ne saisir dans la base corpus qu'après validation
   d'Ulrich. La base corpus est technique ; la **base Caractères reste en lecture seule**.
2. Rejeu de séquence : tours utilisateur fixés par le corpus, réponses du personnage générées, historique et
   mémoire reconstruits comme en jeu (même chaîne `processPRD4Turn`, `gmGuidance` du post-tour précédent).
   Aucune session réelle écrite ; overrides en mémoire uniquement.
3. Grille : critères par tour (grille J1 inchangée) et critères de séquence (continuité, reprise d'un fil sans
   répétition, rumination crédible, cohérence de la timeline sur la durée). Poids et compatibilité des anciens runs
   documentés.
4. Rapport J2 étendu : Δ par séquence, par tour et par critère de séquence ; coût par séquence ; plafond respecté.
5. Premier run réel sur sandbox-ulrich : `optimized_v3` contre lui-même (bruit multi-tours), puis `lived_v2`
   (joué) contre `streamContract: "v1"` pour vérifier le gain du lot P sur plusieurs tours. Rapport joint au plan.

## Hors périmètre

Changement des fiches Notion, de la grille J1 par tour, STT/TTS, production, publication Lovable.

## Invariants

- Base Caractères AVA en lecture seule ; seules les tâches Notion et la base corpus (après validation) s'écrivent.
- Overrides d'évaluation en mémoire, jamais `admin_settings` ni `character_prompts` ; jamais `prod`.
- Lovable unique chaîne de livraison ; migrations éventuelles par le chat Lovable.

## Vérification

- Tests unitaires du rejeu de séquence (historique, mémoire, GM) et de la grille ; `npm run test:quality` et
  `npm run test:delivery`.
- Runs réels sur sandbox avec plafond explicite ; coûts et rapports joints au plan.
- Livrer par PR, CI `regression-gates`, puis `ship-pr.mjs`. Mettre à jour CHANGELOG, `etat_courant`, la feuille de
  route et la tâche Notion « Batterie LLM juge ».

## Première action

`git status`, `git fetch --prune`, main propre, puis lire `runIsolatedEvalTurn` (`src/services/evalJudgePipeline.ts`)
et ce que `processPRD4Turn` attend pour l'historique, la mémoire (`conversationMemory`) et `gmGuidance`.

## Clôture

Livrer à la clôture le prompt autonome du lot suivant (R, rumination et sous-texte, selon la feuille de route)
dans `docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire explicitement qu'aucun lot ne suit.
