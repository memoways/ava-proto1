# Prompt de reprise — Compression de la fiche, lot 2 : coût avec le modèle, puis qualité

À copier dans un nouveau chat Ava, quand Ulrich lance ce lot. Ce lot seulement.

## Objectif

Le lot 1 a livré trois niveaux de fiche envoyée (Actuel, Consignes entières, Fiche entière), réglables par personnage. Ce lot mesure ce qu'ils coûtent avec le vrai modèle, puis s'ils rendent Max et Emma meilleurs, pour qu'Ulrich choisisse le niveau par défaut.

Plan, décisions et chiffres du lot 1 : [plan_compression_fiche.md](plan_compression_fiche.md).

## État vérifié au 28 novembre (à revérifier sur origin/main)

- Lot 1 fusionné sur `main` (PR et SHA dans le CHANGELOG et le compte rendu du lot).
- Notion et l'application ont le même texte (9 champs identiques, Max et Emma, sandbox-ulrich, romed, benoit). Aucune correction de synchronisation.
- Réglage : Admin › Réglages personnages › « Fiche envoyée », clé `ava_character_sheet_compression` par environnement, lue à la préparation de l'appel ([characterSheetCompression.ts](../src/services/characterSheetCompression.ts)) ; niveaux dans [sheetCompression.ts](../src/agents/sheetCompression.ts) ; assemblage dans [maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts). Trace du tour : `budget.sheetCompression`.
- **Aucun niveau n'est encore enregistré** : tous les personnages jouent « Actuel ».
- Mesure sans modèle (605 questions) : prompt médian de Max 16 498 / 37 436 / 63 522 car., part de la fiche 14 / 52 / 100 % ; Emma 15 306 / 38 171 / 60 445 car., 14 / 57 / 100 %. Rien n'est évincé. « Actuel » est identique à l'ancien prompt.
- Outils : `npm run eval:replay:compression` (sans modèle), `npm run eval:llm-latency` (banc LLM, [llmLatency.ts](../scripts/eval-judge/llmLatency.ts)), `npm run eval:judge` (juge), `llm_usage` (latence, cache, fournisseur par appel).

## Périmètre

1. **Coût annoncé avant tout appel.** Estimer le coût du banc à partir de `llm_usage` (prix par jeton entrant et sortant, part en cache des appels récents de `optimized_v3`) : environ 4 700, 10 700 et 18 000 jetons entrants par tour selon le niveau. Proposer un banc court (par exemple 10 questions réelles × 3 niveaux × Max et Emma, deux passages pour voir le cache) et donner son coût. **Attendre l'accord d'Ulrich.**
2. **Banc avec le modèle** sur sandbox-ulrich, après accord, avec le niveau passé en mémoire (sans enregistrer le réglage) : délai de la première phrase, durée de l'appel, part en cache, coût par tour, par niveau. Généraliser `llmLatency.ts` si besoin.
3. **Juge de qualité** sur un même jeu de questions à chaque niveau : respect des limites de la fiche, réponse aux questions hors sujet, tests du joueur, approbation trop facile, exactitude des faits. Le coût du juge est annoncé et accepté avant.
4. **Présenter à Ulrich**, chiffres à l'appui, coût, délai et qualité par niveau, avec une recommandation de niveau par défaut. La décision est la sienne.
5. **Recette d'Ulrich** : appels sur sandbox-ulrich, niveau par niveau. Le niveau est enregistré dans l'écran seulement s'il le demande.

## Hors de ce lot

- La Bible des réponses (après le choix du niveau).
- Raccrocher (`[END_CALL]`).
- Les autres variantes de prompt (`legacy`, `compact_v1`, `rich_v2`).
- Le défaut de doublon à tort de la mémoire au niveau « Actuel » (prompt inchangé par décision).
- Toute modification de fiche Notion.

## Limites

- Base Caractères Notion en lecture seule.
- Aucun appel au modèle ni au juge sans accord d'Ulrich sur le coût annoncé.
- Aucune migration ; aucun réglage enregistré sans demande d'Ulrich.
- Production non publiée. Gami DigiDouble exclu. Un seul agent actif sur Ava.

## Livraison et clôture obligatoire

- Selon `AGENTS.md` : pour du code, `npm run test:quality` et `npm run test:delivery` verts, PR, CI, fusion par la garde ; pour un lot de mesure seule, l'exception documentaire.
- Consigner les mesures dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG.
- Distinguer la livraison technique de la recette d'Ulrich.
- À la clôture, écrire le prompt de reprise du lot suivant (`docs/prompt_reprise_<sujet>_lot_<id>.md`) avec cette même obligation, ou dire qu'il ne reste rien.

## Première action

Lire `AGENTS.md`, `docs/etat_courant.md`, `git status` et le plan, puis estimer le coût du banc depuis `llm_usage` (lecture seule) et le présenter à Ulrich.
