# Prompt autonome — Ava, lot F : round 1 du juge, factualité seule

Tu exécutes et livres **uniquement le lot F** dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`
(remote `https://github.com/memoways/ava-proto1`). Lis AGENTS.md, `docs/etat_courant.md`,
[`docs/plan_juge_direction_rounds.md`](plan_juge_direction_rounds.md) (état des lieux et lot F), `docs/prompt_reprise_fiches_corrigees_lot_k2.md`
(dont ce lot reprend les travaux 1 à 3 et 5) et `docs/plan_calibration_juge_lot_k1.md`. Un seul agent ; préserve la
PR #24 et le travail étranger ; `git fetch --prune`, main propre, branche du lot depuis main.

**Point de départ vérifié (21 novembre)** : fiches Max et Emma retouchées par Romed le 19 novembre (tâche Notion
« Fiches… » Terminé) ; plus aucun « tu attends l'appel » dans identité, timeline, qui tu es ; **pas de champ
« Ce que tu sais aujourd'hui »** dans la base : les faits sont dans le paragraphe « Ce qui est vrai aujourd'hui »
de l'identité (repli déjà géré par `src/services/establishedFacts.ts`) ; reste « en sachant qu'elle sera contaminée
à son tour » (futur). Juge K1 : note unique mêlant canon et style (`src/services/evalJudgeScoring.ts`).

**Objectif** : savoir, avec une note qui ne mesure que cela, si Max et Emma disent les faits justes, n'inventent
pas et corrigent une prémisse fausse ; confirmer que le juge note la factualité comme Romed.

**Travail**
1. Resynchro `fields_only` de sandbox-ulrich (`sync-notion`, `environment_id: "sandbox-ulrich"` explicite, jamais
   prod) ; `npm run eval:judge:sheets` ; nouvelle copie datée dans `src/agents/__fixtures__/` ; mise à jour de
   `docs/eval/faits_canon_k1.json` (fusil pris par Léo, Lise présentée comme Peter, raison du geste d'Emma, raison
   du départ, Mona envoyée au camp par le père de Max) ; mesurer la longueur du bloc FAITS ÉTABLIS (≤ 1 200 car.)
   et ce que la manière de parler cède.
2. Une seule logique, la fiche : si la copie ne contient plus « attend(s) l'appel », supprimer
   `neutralizeAwaitedCall` / `sheetAtCallTime` partout (compilateur, souvenirs RAG, `buildJudgeCanonReference`) et
   leurs tests ; remplacer par un test et un avertissement de `eval:judge:sheets` qui **signalent** une fiche
   fautive ; déplacer `CALL_PRESENT_INVARIANT` dans `ExperienceFrameConfig` (défaut = texte actuel, rien ne change
   en jeu) ; retirer le transtypage de `loadCharacterPrompt` si les types connaissent la colonne.
3. Mode factualité du juge : option `--focus factuality` (et équivalent admin si simple) ; critères canon,
   interdits, invention, prémisse fausse corrigée ; incertitude crédible du personnage non pénalisée ; note
   séparée, style exclu ; rapport par fait.
4. Corpus factuel : séquences tirées de `docs/eval/sequences_j3_v2.json` + prémisses fausses (« C'est Emma qui a
   contaminé Ava ? », « Le fusil, vous l'avez pris chez votre père ? », « Ava a déjà changé physiquement ? ») ;
   pas de second corpus Notion.
5. Run sandbox plafonné (≤ 3 $, annoncé avant), Max et Emma, 3 passages ; bruit mesuré.
6. Liste des écarts de fiche pour Romed (futur « sera contaminée », doublons identité/timeline, champ dédié à
   créer ou non) écrite dans la tâche Notion Fiches — jamais dans la base Caractères.
7. Calibrage : si Romed a fourni 10 nouvelles réponses notées, `npm run eval:judge:calibrate -- --file …` sur les
   deux échantillons (écart moyen ≤ 1, moins de 3 écarts > 2) ; sinon le dire et laisser une seule action à Romed.

**Limites** : base Caractères en lecture seule ; aucune production ; aucune migration hors chat Lovable ; ne pas
toucher aux réglages radar ni au GM (lot H) ; aucun travail de style.

**Validation** : tests unitaires (compilateur, garde-fou, juge factualité), lint, CI `regression-gates` verte sur le
HEAD exact ; rapport `docs/eval/` daté avec notes par fait.

**Livraison** : `docs/etat_courant.md`, `CHANGELOG.md`, plan mis à jour ; commit, push, PR,
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` ; vérifier origin/main ; tâche Notion du juge mise à
jour avec SHA ; **prompt de reprise du lot H** écrit (`docs/prompt_reprise_juge_lot_h.md`) avec cette même
obligation de prompt pour le lot suivant.
