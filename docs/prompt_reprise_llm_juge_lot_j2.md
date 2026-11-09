# Prompt autonome — Ava, J2 : lancer le juge sans navigateur

Tu exécutes et livres **uniquement le lot J2** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1` (remote
`https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, la
  [feuille de route](feuille_de_route_jeu_personnages.md) et le
  [plan du juge](plan_llm_as_judge.md), section « Lot J1 ».
- Ce prompt n'est pas une demande de nouveau plan : on attend l'implémentation, les tests et la livraison complète par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger.

## Point de départ (état J1, 9 novembre 2026)

- Le juge note onze critères, dont `not_meta`, `lived_impact`, `canon_timeline` et `distinct_voice` ;
  `speech_quality` est pondéré ; les résultats antérieurs gardent leur note.
- Le mode « Référence contre candidat » compare deux `MAX_PROMPT_VARIANT` ou deux instantanés JSON,
  en mémoire seulement (`evaluationOverrides.promptVariant`), et rend les Δ par critère, question et personnage
  (`compareReferenceCandidate`).
- Tout tourne encore **dans le navigateur** (Admin › Qualité › LLM as judge), avec la session admin :
  `runIsolatedEvalTurn` → `processPRD4Turn`, puis `judgeIsolatedEvalTurn`, résultats dans `eval_runs` / `eval_results`.
- Corpus : [corpus_llm_juge_v1.md](corpus_llm_juge_v1.md). Vérifie dans la base
  [corpus](https://app.notion.com/p/746db7ce482d410ca45bb35f316c89a9) ce qui a été validé et saisi.

## Objectif

Lancer la même comparaison référence/candidat sans navigateur, à la main, sur sandbox, pour mesurer avant
chaque lot P et J3 sans ouvrir l'admin.

## Travail attendu

1. Un script Node (ou `tsx`) qui réutilise les modules du juge sans dupliquer la grille ni le pipeline :
   lecture des `eval_items` actifs, configurations `buildReferenceCandidateConfigs`, rejeu, jugement,
   écriture dans `eval_runs` / `eval_results` comme l'admin, rapport Markdown des Δ en sortie.
2. Authentification par une voie serveur Lovable Cloud déjà prévue pour l'admin ; aucun secret dans le dépôt,
   aucun Supabase direct hors Lovable. Si cette voie n'existe pas, la concevoir dans le plan avant de coder.
3. Un workflow GitHub `workflow_dispatch` seulement (entrées : variantes, filtre personnage, nombre de passages),
   qui ne bloque pas la CI. Lire `~/CodeProjects/_shared/agent-context/14-ci-github-actions.md` avant.
4. Plafond de coût explicite et arrêt propre au dépassement.

## Hors périmètre

Plusieurs tours (J3), changement de grille, fiches et prompts de personnages, STT/TTS, production.

## Invariants

- Base Caractères AVA en lecture seule ; seules les tâches Notion se mettent à jour d'ici.
- Overrides en mémoire uniquement, jamais `admin_settings`.
- Lovable unique chaîne de livraison ; migrations éventuelles appliquées via le chat Lovable.

## Vérification

- Tests unitaires du script (configuration, plafond, rapport) ; `npm run test:quality` et `npm run test:delivery`.
- Un lancement réel sur sandbox, même corpus et mêmes variantes que le dernier run J1 : comparer les notes
  (écart attendu dans le bruit) et joindre coût et rapport.
- Livrer par PR, CI `regression-gates`, puis `ship-pr.mjs`. Mettre à jour CHANGELOG, `etat_courant`, le plan
  et la tâche Notion « Créer la batterie de tests automatiques avec LLM juge ».

## Première action

`git status`, `git fetch --prune`, main propre, puis lire `src/services/evalJudgePipeline.ts` et
`src/services/evalJudgeStore.ts` pour lister ce qui dépend du navigateur (`import.meta.env`, session, `fetch`).

## Clôture

Livrer à la clôture le prompt autonome du lot suivant (J3 ou P selon la feuille de route) dans
`docs/prompt_reprise_<sujet>_lot_<id>.md`, avec la même obligation, ou dire explicitement qu'aucun lot ne suit.
