# Prompt autonome — Ava, lot K1 : faits établis dans le prompt et juge calibré

Tu exécutes et livres **uniquement le lot K1** dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`
(remote `https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md` et l'[analyse du calibrage par Romed](analyse_calibration_juge_romed_20261114.md)
  en entier ; puis, pour le domaine touché seulement, le [plan du juge](plan_llm_as_judge.md) (J1 à J3) et la
  [pause du 10 novembre](bilan_pause_juge_parole_rumination_20261110.md).
- Ce prompt n'est pas une demande de nouveau plan général : écris le plan court dans `docs/plan_calibration_juge_lot_k1.md`,
  puis implémente, mesure et livre par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger ; `git fetch --prune`, main propre,
  une branche du lot depuis main.

## Point de départ vérifié (14 novembre 2026)

- Main : `9e12b49` au moment de l'analyse ; lots J1, J2, P (`lived_v2` joué), J3 (séquences) et #191 (GM) fusionnés ;
  lot R bloqué depuis la pause du 10 novembre.
- Calibrage de Romed ([fiche Notion](https://app.notion.com/p/41462322e59581758fdaca67f1ac3b50), notes versionnées dans
  `docs/eval/calibration_romed_20261114.json`) : écart moyen 1,51 ; 3 écarts > 2 points (Max A5 +3,8, Emma A2 +3,5,
  Emma A4 +2,6) → **seuil franchi : aucun lot ne se décide sur le juge avant ce lot.**
- Cause côté personnage : le noyau `optimized_v3` (7 000 car.) est pris par les sections protégées (manière de parler
  2 700, vécu 1 100, PRÉSENT 900) ; ~95 % du canon est écarté (1/29 titres de timeline, 1/9 paragraphes d'identité,
  1/19 interdits, 0/11 sujets sensibles). Les faits corrigés par Romed sont dans les fiches mais pas dans le prompt.
- Cause côté juge : `buildJudgeCanonReference` ne donne que PRÉSENT, timeline (derniers jours) et manière de parler ;
  il contient l'erreur source « il attend l'appel » ; aucune note plafonnée sur une contradiction de canon ;
  `parseJudgeResponse` compte 0 une réponse illisible.
- Erreurs de source (Notion, **à ne pas corriger d'ici**) : « Tu attends l'appel de la cellule de bénévoles »
  (identité fondamentale, timeline aujourd'hui.01, PRÉSENT généré) ; « Le fusil de ton père, donné à Léo dans ton dos » ;
  « Lise, prise pour Peter » ; « tu serais contaminée à ton tour ». Tâche Notion de correction à la source :
  [« Fiches Max et Emma : corriger à la source les dérives relevées au calibrage du juge »](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27).

## Objectif

Que Max et Emma aient sous les yeux les faits établis du moment de l'appel, et que le juge note comme Romed
(sous le seuil) avant toute nouvelle décision mesurée.

## Travail attendu

1. **Diagnostic outillé** : un test (ou script) qui compile le noyau `optimized_v3` sur la copie sandbox pour les dix
   questions du calibrage et liste les faits canoniques présents/absents (liste de contrôle versionnée, faits de
   l'analyse §2.1). Il sert de garde de non-régression.
2. **Bloc « FAITS ÉTABLIS » protégé** (≤ 1 200 car.) dans le noyau `optimized_v3`, avant la voix, sans grossir le
   budget total : prendre la place sur des sections déjà protégées (mesurer, par exemple, une manière de parler bornée)
   plutôt que d'allonger le prompt. Source, dans l'ordre : (a) un champ Notion optionnel « Ce que tu sais aujourd'hui »
   s'il existe (mappé par `sync-notion`, inactif tant que le champ est vide) ; (b) à défaut, extraction déterministe et
   testée des phrases canoniques déjà présentes (identité fondamentale, interdits) sur l'état du moment de l'appel.
   Aucun fait écrit dans le code : le texte vient des fiches.
3. **Présent de l'appel** : invariant dans le cadre commun (`experienceFrame`, personnage et GM) — l'appel attendu est
   celui qui a lieu ; le compilateur neutralise « tu attends l'appel / l'appel que tu attends » au moment de l'appel ;
   test sur la copie sandbox.
4. **Juge** : repère canon élargi (faits établis, identité, interdits, en budget borné) ; consigne de vérifier le canon
   même quand le corpus ne le demande pas et de signaler une attente du corpus douteuse ; **plafond** de la note
   pondérée quand `canon_timeline` ≤ 1 (valeur à mesurer, documentée) ; réponse illisible exclue des moyennes (et
   rejouée une fois), jamais 0.
5. **Corpus J3 corrigé d'après Romed** (`docs/eval/sequences_j3_v1.json` → v2 et `corpus_llm_juge_sequences_j3.md`) :
   B1 (Sam a raison ; Max s'est arrêté pour prendre les clés), B2 (Léo a pris le fusil, à la demande du père de Max, à
   l'insu de Max et Emma), B3 (Max sait que c'était Lise ; Lise s'était présentée comme Peter), B4 (Ava contamine Emma ;
   sans le mot « intériorité »), A1 (aucun changement visible d'Ava), A4 (il l'a fait parce qu'Emma le lui a demandé),
   A5 (interdit : « attendre l'appel » ; retirer « attente sans nouvelles »), Emma A2 (pas de « protéger Ava » ; elle a
   accepté de devenir protogyne pour rester proche d'Ava), Emma B2 (Mona est l'aînée d'Emma). Statut : « corrigé d'après
   Romed, à revalider ». Saisie dans la base corpus Notion seulement après validation.
6. **Calibrage outillé** : `npm run eval:judge -- --calibrate docs/eval/calibration_romed_20261114.json` (ou script
   dédié) rejuge les dix réponses telles quelles (sans régénérer), affiche l'écart par réponse, l'écart moyen et le
   nombre d'écarts > 2. Coût ≈ 10 appels juge, plafond explicite.
7. **Mesures réelles sur sandbox-ulrich** (plafond explicite, rapports joints au plan) : calibrage avant/après grille ;
   puis séquences J3 v2, référence `optimized_v3` actuel contre candidat « faits établis + présent de l'appel ».

## Critères de sortie

- Calibrage : moins de 3 écarts > 2 points et écart moyen ≤ 1 sur les dix réponses de Romed.
- Diagnostic : les faits de la liste de contrôle présents dans le noyau pour leurs questions (ou l'écart expliqué).
- Aucune régression de budget ni des invariants d'identité ; `npm run test:quality` et `npm run test:delivery` verts.

## Hors périmètre

Modifier la base Caractères (champs, contenu RAG, pages) : **interdiction formelle** ; les corrections de source passent
par la tâche Notion dédiée (Romed, Ulrich). Lot R, rumination, STT/TTS, production, resynchro `prod`.

## Invariants

- Base Caractères en lecture seule ; seules les tâches Notion se mettent à jour d'ici.
- Overrides d'évaluation en mémoire, jamais `admin_settings` ; `sync-notion` toujours avec `environment_id` explicite
  (`sandbox-ulrich`) ; jamais `prod`.
- Limite `proxy-llm` : 60 appels/min par compte ; le rejeu attend sur 429 (lot P).
- Lovable unique chaîne de livraison ; Edge Function modifiée redéployée par Lovable ; migrations via le chat Lovable.

## Livraison

PR, CI `regression-gates` verte sur le HEAD exact, puis
`~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
Mettre à jour CHANGELOG, `etat_courant`, la feuille de route, le plan du juge et la tâche Notion « Créer la batterie de
tests automatiques avec LLM juge » (reçu de livraison). Recette humaine distincte : Romed renote un échantillon après
le lot.

## Première action

`git status`, `git fetch --prune`, main propre ; relire `buildJudgeCanonReference` et `parseJudgeResponse`
(`src/services/evalJudgePipeline.ts`), puis `selectStaticUnits` et `protectedCharacterSections`
(`src/agents/maxOptimizedPromptCompiler.ts`) ; reproduire la mesure du §3 de l'analyse.

## Clôture

Livrer à la clôture le prompt autonome du lot suivant (relecture des corpus et définition de la rumination avec
Romed, puis lot R recadré) dans `docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire
explicitement qu'aucun lot ne suit.
