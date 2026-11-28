# Prompt de reprise — Compression de la fiche, lot 1 : vérifier, régler, mesurer

À copier dans un nouveau chat Ava, quand Ulrich lance ce lot. Ce lot seulement.

## Objectif

Max et Emma ne reçoivent qu'environ 15 % de leur fiche Notion à chaque réplique. Ulrich veut que ce qui est écrit dans Notion serve. Ce lot :

- vérifie que l'application a tout le texte de Notion ;
- ajoute un réglage par personnage à trois niveaux de compression ;
- mesure leur effet sans modèle, puis, avec l'accord d'Ulrich, avec le modèle.

Plan et décisions : [plan_compression_fiche.md](plan_compression_fiche.md).

## État au 28 novembre (à revérifier sur origin/main)

- `main` contient le lot 2 du cadre de l'appel (PR 319, `6ca9daf`). Le bloc « Comment tu réponds » est codé mais **pas à coller** (décision d'Ulrich) : il reste inactif sans bloc dans la fiche.
- Compilateur en jeu : `optimized_v3` ([maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts)).
  - Toujours envoyés : présent, faits établis, moteur, Manière de parler, « Ce que tu cherches » (`protectedCharacterSections`).
  - Le reste est trié par mots communs avec la question (`selectStaticUnits`), dans `OPTIMIZED_V3_LIMITS.staticChars` (7 000) + 900 avec les faits établis.
  - La limite de contexte (`generatedContextChars`, 22 500) borne le tout.
- Fiches de sandbox-ulrich : Max 54 027 car., Emma 52 072. Noyau envoyé ≈ 7 200 car. ; prompt système médian 16 498 (Max) et 15 306 (Emma) sur 605 questions.
- Outils existants :
  - `npm run eval:judge:sheets` (fiches synchronisées, lecture seule) ;
  - `npm run eval:replay:reply-block` (rejeu de toutes les questions sans modèle ; à généraliser) ;
  - `npm run eval:judge` et les scripts du banc LLM (`scripts/eval-judge/llmLatency.ts`).
- Précédent d'un réglage par personnage sans migration : la vidéo par personnage ([plan](plan_avatar_video_par_personnage.md)).

## Décisions déjà prises (ne pas les redemander)

- **Trois niveaux par nature de texte**, pas de pourcentage :
  - **Actuel** (défaut) ;
  - **Consignes entières** : Identité fondamentale, Qui tu es, Dynamique, Ce que tu ne fais jamais et Ce que tu sais sur l'utilisateur en entier ; Timeline, Sujets sensibles et Références triés ;
  - **Fiche entière** : tous les champs.
- **Réglage par personnage**, dans Admin › Réglages personnages, enregistré par sandbox, sans nouvelle version d'orchestration ni du Game Master, effet au prochain appel.

## Périmètre

1. **Notion et l'application ont-elles le même texte ?** Lire les pages Max et Emma dans Notion Gamilab, en lecture seule, et les comparer champ par champ à `character_prompts` sur sandbox-ulrich (et romed, benoit). Dire ce qui manque ou diffère, et pourquoi (champ non synchronisé, mise en forme perdue, synchro ancienne). Corriger la synchronisation seulement si c'est un défaut de code de ce dépôt et que la correction est petite ; sinon le consigner pour un lot suivant.
2. **Réglage à trois niveaux** dans `optimized_v3` :
   - les champs du niveau partent en entier, dans l'ordre de la fiche, avec leur place : noyau et limite de contexte grandissent d'autant ;
   - mémoire, cadre, directive relationnelle, état, parole du tour et souvenirs gardent leur place ;
   - les souvenirs ne répètent pas ce qui est déjà envoyé ;
   - texte fixe en tête du prompt pour le cache ;
   - sur le niveau Actuel, prompt identique à `main`, prouvé par rejeu (empreinte sur toutes les questions).
   Le réglage est lu au début de l'appel et noté dans la trace du tour.
3. **Aperçu** : « Voir ce que reçoit le personnage » montre le niveau en jeu, la taille du prompt et la part de la fiche envoyée, champ par champ.
4. **Mesure sans modèle** : rejouer les questions depuis le 19 novembre à chaque niveau. Relever :
   - la taille du prompt et la part de la fiche envoyée ;
   - les sections évincées et les alertes ;
   - les phrases de mémoire retirées à tort comme doublons (défaut constaté au lot 2 du cadre de l'appel : à corriger s'il grossit avec le noyau).
5. **Mesure avec le modèle**, après accord d'Ulrich sur le coût estimé, sur sandbox-ulrich : délai de la première phrase, part en cache, coût par tour, par niveau, sur quelques questions réelles.
6. **Présenter** à Ulrich, chiffres à l'appui, ce que coûte chaque niveau. Proposer le lot 2 (qualité au juge et recette).

## Hors de ce lot

- Le juge de qualité complet et la décision du niveau par défaut (lot 2).
- La Bible des réponses.
- Raccrocher.
- Les autres variantes de prompt (`legacy`, `compact_v1`, `rich_v2`).
- Toute modification de fiche Notion.

## Limites

- Base Caractères Notion **en lecture seule**.
- Aucune migration, aucune écriture en base et aucun réglage enregistré sans accord d'Ulrich.
- Aucun appel au modèle sans accord sur le coût.
- Production non publiée.
- Gami DigiDouble exclu. Un seul agent actif sur Ava.

## Livraison et clôture obligatoire

- Selon `AGENTS.md` : `npm run test:quality` et `npm run test:delivery` verts, PR, CI, fusion par la garde.
- Consigner dans le [plan](plan_compression_fiche.md), `docs/etat_courant.md`, STORY et le CHANGELOG.
- Distinguer la livraison technique de la recette d'Ulrich (appels sur sandbox-ulrich, niveau par niveau).
- À la clôture, écrire `docs/prompt_reprise_compression_fiche_lot_2.md` avec cette même obligation, ou dire qu'il ne reste rien.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status` et le [plan](plan_compression_fiche.md), puis lancer la comparaison Notion / application en lecture seule.
