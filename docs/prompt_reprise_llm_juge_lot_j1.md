# Prompt autonome — Ava, J1 : un LLM juge qui mesure le jeu

Tu exécutes et livres **uniquement le lot J1** dans
`/Users/ulrich/CodeProjects/memoways/ava-proto1` (remote
`https://github.com/memoways/ava-proto1`).

**Avant de commencer**
- Lis AGENTS.md, `docs/etat_courant.md`, la
  [feuille de route](feuille_de_route_jeu_personnages.md) et le
  [plan du juge](plan_llm_as_judge.md).
- Ce prompt n'est pas une demande de nouveau plan : on attend l'implémentation, les tests et la livraison complète par la garde.
- Un seul agent travaille sur le dépôt. Préserve la PR #24 et le travail étranger.

## Point de départ vérifié (9 novembre 2026)

- Main contient le lot C1 « parole sous le choc » (#185). Le vécu Notion est protégé avant les faits en `optimized_v3`.
- Le juge existe, mais il ne juge qu'une réplique isolée, et seulement depuis le navigateur :
  - rejeu dans la vraie chaîne via `runIsolatedEvalTurn`, qui appelle `processPRD4Turn` (`src/services/evalJudgePipeline.ts`) ;
  - jugement via `judgeIsolatedEvalTurn` ;
  - grille et analyse dans `src/services/evalJudgeScoring.ts` ;
  - interface dans `src/components/admin/EvalJudgeTab.tsx` et `evalJudge/*` ;
  - synchronisation Notion par `supabase/functions/sync-eval-items` ;
  - tables `eval_items`, `eval_runs` et `eval_results`.
- La base corpus Notion « AVA LLM-as-judge — corpus Max » (`746db7ce482d410ca45bb35f316c89a9`) contient une ligne d'exemple. Son champ Personnage ne propose que Max.

## Objectif

Pouvoir répondre en un lancement à la question : « le prompt candidat fait-il mieux jouer Max et Emma que la référence ? ». Le juge doit voir le défaut constaté par Ulrich : des personnages trop méta, qui énumèrent des faits sans leur impact.

## Travail attendu

1. **Grille.**
   - Ajouter quatre critères notés de 0 à 5 au prompt du juge, au parseur et aux poids par défaut :
     - `not_meta` : n'explique pas la situation comme un narrateur ;
     - `lived_impact` : les faits passent par ce qu'ils font à sa vie et à sa famille ;
     - `canon_timeline` : rien qui contredise la fiche, la timeline ou le présent (souvenir J−2 de l'hôtel ≠ présent dans l'appartement) ;
     - `distinct_voice` : on reconnaît ce personnage-là, pas l'autre.
   - Remplacer « On entend Max » par le nom du personnage de l'item.
   - Faire compter `speech_quality` dans la note pondérée.
   - Garder la compatibilité avec les résultats déjà stockés.
2. **Personnage.**
   - Les items portent Max ou Emma, et le rejeu cible le bon personnage.
   - Ajouter l'option Emma au champ Personnage de la base corpus. C'est une base technique : **la base Caractères AVA reste interdite en écriture**.
3. **Référence vs candidat.**
   - Ajouter un levier qui compare deux valeurs de `MAX_PROMPT_VARIANT` ou deux instantanés de réglages, appliqués en mémoire uniquement, jamais dans `admin_settings`.
   - Les résultats montrent le Δ par critère et par item.
4. **Corpus v1.**
   - Proposer une vingtaine de lignes, Max et Emma, dans un document `docs/` pour validation par Ulrich :
     - les cas M1–M4 et E1–E4 de la tâche Notion « Ava : parole sous le choc » ;
     - les questions de recette (montagne, police, « Et Emma ? » / « Et Max ? ») ;
     - les régressions du carnage (Peter, Mona, contamination d'Ava).
   - Ne les saisis dans la base Notion qu'après accord explicite d'Ulrich.

## Hors périmètre

- Plusieurs tours (J3).
- Exécution sans navigateur (J2).
- Toute modification des fiches ou des prompts de personnages.
- STT et TTS.

## Vérification

- Tests unitaires du parseur, des poids, de la compatibilité ascendante et du mode référence/candidat.
- `npm run test:quality` et `npm run test:delivery`.
- Un lancement réel en sandbox sur au moins 5 items, référence = `optimized_v3` actuel. Joindre au compte rendu le résultat et le coût.
- Livrer par PR, CI `regression-gates`, puis `ship-pr.mjs`.
- Mettre à jour CHANGELOG, `etat_courant` et la tâche Notion « Créer la batterie de tests automatiques avec LLM juge ».
