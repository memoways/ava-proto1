# Prompt de reprise — Compression de la fiche, lot 2 : limite du proxy, puis qualité

À copier dans un nouveau chat Ava, quand Ulrich lance ce lot. Ce lot seulement.

## Objectif

Le lot 1 a livré trois niveaux de fiche envoyée (Actuel, Consignes entières, Fiche entière), réglables par personnage, et le banc avec le modèle a mesuré leur délai et leur coût. Ce lot règle d'abord le sort de « Fiche entière » (refusée par `proxy-llm`), puis mesure si les niveaux rendent Max et Emma meilleurs, pour qu'Ulrich choisisse le niveau par défaut.

Plan, décisions et chiffres du lot 1 : [plan_compression_fiche.md](plan_compression_fiche.md).

## État vérifié au 28 novembre (à revérifier sur origin/main)

- Lot 1 fusionné sur `main` (PR et SHA dans le CHANGELOG et le compte rendu du lot).
- Notion et l'application ont le même texte (9 champs identiques, Max et Emma, sandbox-ulrich, romed, benoit). Aucune correction de synchronisation.
- Réglage : Admin › Réglages personnages › « Fiche envoyée », clé `ava_character_sheet_compression` par environnement, lue à la préparation de l'appel ([characterSheetCompression.ts](../src/services/characterSheetCompression.ts)) ; niveaux dans [sheetCompression.ts](../src/agents/sheetCompression.ts) ; assemblage dans [maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts). Trace du tour : `budget.sheetCompression`.
- **Aucun niveau n'est encore enregistré** : tous les personnages jouent « Actuel ».
- Mesure sans modèle (605 questions) : prompt médian de Max 16 498 / 37 436 / 63 522 car., part de la fiche 14 / 52 / 100 % ; Emma 15 306 / 38 171 / 60 445 car., 14 / 57 / 100 %. Rien n'est évincé. « Actuel » est identique à l'ancien prompt.
- Banc avec le modèle fait (115 appels, 0,09 $, `npm run eval:llm-latency -- --sheet-compression …`) : « Consignes entières » 0,0027 $ par réplique contre 0,0013 $ pour « Actuel », première phrase 782 ms contre 735 ms ; aucun cache d'une question à l'autre (seulement sur un prompt identique rejoué).
- « Fiche entière » était refusée par `proxy-llm` (limite de 60 000 caractères, prompts de 63 000 à 67 000). **Décision d'Ulrich : limite relevée à 120 000** ([proxyLlmLimits.ts](../supabase/functions/_shared/proxyLlmLimits.ts)) ; alerte `proxy_limit_exceeded` si un tour la dépasse. Fonction publiée et vérifiée le 28 novembre ; « Fiche entière » mesurée : première phrase 1 097 ms, 0,0042 $ par réplique (Actuel 735 ms, 0,0013 $ ; Consignes entières 782 ms, 0,0027 $).
- Outils : `npm run eval:replay:compression` (sans modèle), `npm run eval:llm-latency` (banc LLM, [llmLatency.ts](../scripts/eval-judge/llmLatency.ts)), `npm run eval:judge` (juge), `llm_usage` (latence, cache, fournisseur par appel).

## Périmètre

1. **Juge de qualité** sur un même jeu de questions à chaque niveau jouable : respect des limites de la fiche, réponse aux questions hors sujet, tests du joueur, approbation trop facile, exactitude des faits. Coût annoncé (≈ 0,02 $ par évaluation avec Claude Sonnet) et accepté avant.
2. **Présenter à Ulrich**, chiffres à l'appui, coût, délai et qualité par niveau, avec une recommandation de niveau par défaut. La décision est la sienne.
3. **Recette d'Ulrich** : appels sur sandbox-ulrich, niveau par niveau. Le niveau est enregistré dans l'écran seulement s'il le demande.

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

Lire `AGENTS.md`, `docs/etat_courant.md`, `git status` et le plan, puis annoncer à Ulrich le coût du juge de qualité et attendre son accord.
