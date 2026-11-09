# Feuille de route — jeu des personnages, mémoire, LLM juge

Date : 9 novembre 2026. Ce document fait suite à
[analyse_parole_sous_le_choc.md](analyse_parole_sous_le_choc.md) (lot C1, PR #185).
L'objectif : des échanges crédibles et intéressants, alignés avec le storyworld, la promesse éditoriale et le gameplay.

## Constat

Seize tâches Notion traitent du jeu, de la mémoire, de la rumination, du RAG, du Game Master et des tests. Elles ont été lues en lecture seule. Les avancées réelles se font chacune de leur côté, mais **aucun instrument ne mesure si un changement améliore le jeu**. Chaque lot s'arrête donc sur « écoute à faire ».

### Le LLM juge aujourd'hui

**Ce qui est livré** (plan [plan_llm_as_judge.md](plan_llm_as_judge.md), lots 1 et 2) :
- Un onglet Admin › Éval qui rejoue une réplique isolée dans la vraie chaîne de jeu (`processPRD4Turn`, `src/services/evalJudgePipeline.ts`) et la fait juger par un modèle à température 0.
- Les résultats sont stockés dans `eval_runs` et `eval_results`, et les coûts sont isolés sous `llm_as_judge`.
- Les leviers comparables sont le modèle, le sampling et le RAG.

**Ce qui manque pour qu'il serve :**
- Aucun historique. La rumination, la continuité et le Game Master sur plusieurs tours ne sont donc pas mesurables.
- Pas de comparaison entre deux versions du prompt ou de la fiche. C'est pourtant le besoin principal.
- Le juge se lance uniquement depuis le navigateur.
- La grille ne couvre pas :
  - le côté méta, quand le personnage explique trop ;
  - les faits donnés sans leur impact ;
  - la cohérence avec le canon et la timeline ;
  - la différence entre Max et Emma.
- « On entend Max » est codé en dur (`evalJudgeScoring.ts`).
- Les sous-critères `speech_quality` ne sont pas pondérés.
- La base corpus Notion ne contient qu'**une ligne d'exemple**. Son champ Personnage ne propose que Max, et elle n'a pas les colonnes Séquence, Tour et Continuité prévues par la spec v2.
- Le corpus v0 (4 séquences × 5 tours, Max, « vu le film ») est rédigé et commenté par Romed. Six arbitrages restent ouverts, et il a été écrit avant la réécriture des fiches du 25 octobre.

## Principe

D'abord un instrument de mesure, ensuite les améliorations. Chaque changement de prompt, de fiche ou de RAG est comparé avant et après par le juge, puis confirmé à l'oreille. Le juge ne remplace pas l'écoute ; il évite d'écouter à l'aveugle.

## Ordre des prochains lots

1. **J1 — juge utile, lancé à la demande.** Livré en code le 9 novembre ([plan](plan_llm_as_judge.md), [corpus v1 à valider](corpus_llm_juge_v1.md)). Prompt d'origine : [prompt_reprise_llm_juge_lot_j1.md](prompt_reprise_llm_juge_lot_j1.md).
   - **Grille** : ajouter quatre critères (`not_meta`, `lived_impact`, `canon_timeline`, `distinct_voice`), rendre le nom du personnage dynamique et pondérer `speech_quality`.
   - **Mode « référence vs candidat »** : comparer deux variantes de prompt ou deux instantanés de réglages.
   - **Corpus v1**, environ 20 lignes :
     - les cas M1–M4 et E1–E4 de la tâche « parole sous le choc » ;
     - les questions de recette (« Qu'est-ce qui s'est passé à la montagne ? », « Des nouvelles de la police ? », « Et Emma ? » / « Et Max ? ») ;
     - les régressions RAG du carnage (Peter, Mona, contamination d'Ava).
   - **Base corpus** : ajouter Emma au champ Personnage. C'est une base technique, distincte de la base Caractères, qui reste en lecture seule.
   - **Premier usage** : mesurer C1, puis décider du sort du générateur PRÉSENT.
2. **J2 — exécution sans navigateur.** Livré en code le 9 novembre ([plan](plan_llm_as_judge.md#lot-j2--lancer-le-juge-sans-navigateur-implémenté-9-novembre-2026)) : `npm run eval:judge` sur sandbox, ou le workflow manuel « LLM judge (manual) », avec plafond de coût. Il ne bloque pas la CI. Prompt d'origine : [prompt_reprise_llm_juge_lot_j2.md](prompt_reprise_llm_juge_lot_j2.md).
3. **P — parole, guidée par J1.** Livré en code le 9 novembre ([plan](plan_parole_lot_p.md), [rapport](rapport_parole_lot_p_sandbox_20261109.md)) : contrat `lived_v2` adopté (+0,33), PRÉSENT v2 non retenu (−0,27, faits perdus) ; écoute AP5 à faire. Prompt d'origine : [prompt_reprise_parole_lot_p.md](prompt_reprise_parole_lot_p.md).
   - Générateur PRÉSENT à la 2e personne, sans obligation de tout couvrir.
   - Reformuler la consigne « livre d'abord ton contenu ».
   - Puis écoute (AP5).
4. **J3 — juge sur plusieurs tours.** Prompt : [prompt_reprise_llm_juge_lot_j3.md](prompt_reprise_llm_juge_lot_j3.md). Rejeu de 3 à 5 tours avec historique et mémoire, sur le corpus v0 mis à jour après les arbitrages de Romed. Il mesure la rumination, la continuité et le Game Master. C'est le cœur de la spec v2 de la tâche « Batterie LLM juge ».
5. **R — rumination et sous-texte.** Décision prise **à partir des mesures de J3** : complément de fiche ou consigne au Game Master. Rien n'est ajouté avant d'avoir mesuré.
6. **S — storyworld spatial.** Réponses de Romed au questionnaire, enrichissement des souvenirs, puis vérification par le sous-corpus du carnage.
7. **GM.** D'abord le raccrochage sur décision du Game Master, après avoir tranché la contradiction avec l'interdit « raccrocher ». Puis les déclencheurs et le rythme.
8. **Tests humains.** Écoute audio de Romed et Julien, puis protocole, GIFF et Benoît, sur une version déjà mesurée.

## Regroupement des tâches Notion

Seuls les statuts et les renvois changent. Aucune tâche n'est supprimée.

| Action | Tâches |
|---|---|
| Clore avec renvoi | « Finaliser la parole incarnée (lots A & B) » → « Rendre les dialogues… moins écrits » ; « Tester l'interaction avec Max sur 5–10 scénarios » (page vide) → « Tester Max et Emma en audio » et le corpus |
| Fusionner | « Évaluer le besoin d'un complément rumination » et « Améliorer le GM avec l'implicite narratif » → un seul chantier, rumination et sous-texte, après J3 ; « Tester et optimiser le RAG Voyage 4 sur le carnage » → sous-corpus carnage du juge |
| Acter | « Clarifier le statut méta » : le personnage n'est jamais méta (séquence D4 du corpus) |
| Corriger l'état | Corpus 4×5 → En cours (v0 écrit) ; Chunking custom → à clore après les deux appels de contrôle ; Rumination → priorité 🔥🔥 |
| Garder | Batterie LLM juge (J1–J3), Parole sous le choc, Dialogues moins écrits, Contexte spatial, 5 développements GM, Raccrocher, Tester en audio, Protocole de tests ; LoRA reste en Idées |
