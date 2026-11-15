# Prompt autonome — Ava, lot K2 : fiches corrigées, juge confirmé, corpus validé

Tu exécutes et livres **uniquement le lot K2** dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`
(remote `https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, le [plan du lot K1](plan_calibration_juge_lot_k1.md) en entier et
  l'[analyse du calibrage par Romed](analyse_calibration_juge_romed_20261114.md) ; puis, pour le domaine touché seulement,
  le [plan du juge](plan_llm_as_judge.md) (lot K1) et le [corpus J3](corpus_llm_juge_sequences_j3.md) (section v2).
- Ce prompt n'est pas une demande de nouveau plan général : écris le plan court dans
  `docs/plan_fiches_corrigees_lot_k2.md`, puis exécute, mesure et livre par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger ; `git fetch --prune`, main propre,
  une branche du lot depuis main.

## Conditions de départ — à vérifier, sinon s'arrêter et le dire

Ce lot ne démarre que si les quatre points humains ci-dessous sont faits. Vérifie-les en lecture seule ; si l'un manque,
ne le fais pas à la place d'Ulrich ou de Romed : rends la main avec **une seule** action précise.

1. **Migration appliquée** : la colonne `character_prompts.ce_que_tu_sais_aujourdhui` existe (lecture SQL par le MCP
   Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`) et `sync-notion` est redéployée.
2. **Fiches corrigées dans Notion par Romed et Ulrich** ([tâche](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27)) :
   champ « Ce que tu sais aujourd'hui » créé et rempli pour Max et Emma ; présent écrit comme le présent de l'appel ;
   titres de timeline avec un agent explicite (fusil, clés, Lise).
3. **Corpus J3 v2 relu** par Romed et Ulrich ([section v2](corpus_llm_juge_sequences_j3.md#corpus-v2--corrigé-daprès-romed-14-novembre-lot-k1)),
   avec leurs corrections écrites (commentaires Notion ou message d'Ulrich).
4. **Dix nouvelles réponses notées par Romed** (échantillon du run K1 ou d'un run plus récent), au format de
   `docs/eval/calibration_romed_20261114.json`.

## Point de départ vérifié (14 novembre 2026, fin du lot K1)

- Noyau `optimized_v3` : bloc protégé « FAITS ÉTABLIS » (≤ 1 200 car.), tiré du champ « Ce que tu sais aujourd'hui » s'il
  est rempli, sinon du paragraphe « Ce qui est vrai aujourd'hui » de l'identité ; la fiche est lue au moment de l'appel
  (« tu attends l'appel » devient l'appel en cours) ; la fin de la manière de parler cède la place (641 car. pour Max,
  1 037 pour Emma). Interrupteur d'évaluation `establishedFacts` (défaut actif). Code : `src/services/establishedFacts.ts`,
  `src/agents/maxOptimizedPromptCompiler.ts`.
- Juge : repère canon élargi, vérification du canon avant toute note, plafond (≤ 3 si `canon_timeline` = 0, ≤ 4 si ≤ 1),
  réponse illisible écartée. Calibrage sur les dix réponses de Romed : écart moyen 0,82 à 0,85, aucun écart > 2 points
  (1,51 et 3 avant). **Réglé sur ces dix réponses : non confirmé sur d'autres.**
- Liste de contrôle `docs/eval/faits_canon_k1.json` : quatre faits encore absents du prompt, tous par défaut de la fiche
  (fusil pris par Léo, Lise présentée comme Peter, raison du geste d'Emma, raison du départ).
- **Recul mesuré à corriger à la source** : avec le bloc, Max B1 nie que son père ait envoyé Mona au camp (5 réponses sur
  6) ; la phrase source « Elle est toujours dans un camp de quarantaine » (paragraphe « Ce qui est vrai aujourd'hui »)
  est lue comme la cause. Le champ « Ce que tu sais aujourd'hui » doit dire pourquoi Mona est au camp.
- Corpus J3 v2 (`docs/eval/sequences_j3_v2.json`) : statut « corrigé d'après Romed, à revalider » ; rien dans Notion.
- Outils : `npm run eval:judge:calibrate`, `npm run eval:judge:sheets`, `npm run eval:judge:sequences`.

## Objectif

Confirmer sur des fiches corrigées et sur un échantillon neuf que les personnages disent les faits justes et que le juge
note comme Romed ; rendre le corpus J3 officiel. C'est la condition pour rouvrir le lot R.

## Travail attendu

1. **Resynchronisation `fields_only` de sandbox-ulrich** (`sync-notion` avec `environment_id: "sandbox-ulrich"` explicite,
   jamais `prod`), puis `npm run eval:judge:sheets` et comparaison avec la copie de test.
2. **Copie de test et liste de contrôle** : nouvelle copie datée dans `src/agents/__fixtures__/` (l'ancienne reste pour
   les tests qui la citent) ; `docs/eval/faits_canon_k1.json` mis à jour : les quatre faits absents doivent devenir
   présents, sinon l'écart est expliqué et renvoyé à la fiche. Remesurer Max B (3 passages) : B1 ne doit plus reculer.
3. **Neutralisation de l'appel** : si les fiches disent désormais le présent de l'appel, vérifier que
   `neutralizeAwaitedCall` ne transforme plus rien ; garder la fonction comme filet (test).
4. **Budget de la voix** : mesurer ce que la manière de parler cède avec le nouveau champ ; si le champ dépasse
   1 200 caractères, le dire à Romed plutôt que de couper davantage la voix.
5. **Calibrage de confirmation** : `npm run eval:judge:calibrate -- --file <nouvel échantillon>` ; si le critère n'est pas
   atteint (écart moyen ≤ 1, moins de 3 écarts > 2), ajuster la consigne ou le plafond et **remesurer sur les deux
   échantillons** (l'ancien ne doit pas se dégrader).
6. **Corpus J3 officiel** : intégrer les corrections de Romed et d'Ulrich (v3 si le texte change), passer le statut à
   « validé », puis saisir dans la base corpus Notion (base technique, pas la base Caractères) selon les colonnes
   décrites dans le document du corpus.
7. **Mesure** : séquences J3, fiches d'avant contre fiches corrigées n'étant pas rejouable, comparer au run K1
   (même corpus, mêmes réglages) : note par tour, `canon_timeline`, contradictions relevées par le juge.

## Critères de sortie

- Liste de contrôle : tous les faits présents pour leurs questions, ou écart expliqué et renvoyé à Notion.
- Calibrage : critère atteint sur le nouvel échantillon **et** sur celui du 14 novembre.
- Corpus J3 validé et saisi ; `npm run test:quality` et `npm run test:delivery` verts.

## Hors périmètre

Modifier la base Caractères (champs, contenu RAG, pages) : **interdiction formelle**. Lot R (rumination) : il reste
bloqué jusqu'à la définition éditoriale de Romed ([bilan de la pause](bilan_pause_juge_parole_rumination_20261110.md)).
STT/TTS, production, resynchro `prod`.

## Invariants

- Base Caractères en lecture seule ; seules les tâches Notion et la base corpus (technique) se mettent à jour d'ici.
- Overrides d'évaluation en mémoire, jamais `admin_settings` ; `sync-notion` toujours avec `environment_id` explicite.
- Limite `proxy-llm` : 60 appels/min par compte ; le rejeu attend sur 429.
- Plafond de coût explicite sur chaque run ; rapports joints au plan.
- Lovable unique chaîne de livraison ; Edge Function modifiée redéployée par Lovable ; migrations via le chat Lovable.

## Livraison

PR, CI `regression-gates` verte sur le HEAD exact, puis
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
Mettre à jour CHANGELOG, `etat_courant`, la feuille de route, le plan du juge et la tâche Notion « Créer la batterie de
tests automatiques avec LLM juge » (reçu de livraison). Recette humaine distincte : écoute sandbox par Ulrich.

## Première action

`git status`, `git fetch --prune`, main propre ; vérifier les quatre conditions de départ (SQL en lecture pour la
colonne, lecture Notion Gamilab `7e1a9a09-09cb-4deb-a306-83a29b831bc2` pour les fiches et la tâche).

## Clôture

Livrer à la clôture le prompt autonome du lot suivant (lot R recadré sur la définition de la rumination validée par
Romed et Ulrich) dans `docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire explicitement
qu'aucun lot ne suit.
