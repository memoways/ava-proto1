# Prompt de reprise — Cadre de l'appel, lot 2 : un emplacement qui arrive toujours

À copier dans un nouveau chat Ava, quand Ulrich lance ce lot. Ce lot seulement.

## État au 28 novembre (à revérifier sur origin/main)

Lot 1 (diagnostic, aucun code) : sur 450 questions réelles reconstituées, « Quand tu raccroches » n'est jamais envoyé et « Ce que tu ne fais jamais » presque jamais, faute de place dans le noyau de fiche. Ulrich a retenu un lot 2 **réduit à la tuyauterie** : les règles de style iront dans la [Bible des réponses](plan_cadre_appel.md), chantier suivant.

## Périmètre

1. Bloc « Comment tu réponds » dans la fiche : intitulé reconnu dans un champ existant, sans migration, envoyé en entier comme la Manière de parler.
2. Lui donner sa place (environ 900 caractères) sans évincer faits établis, mémoire, souvenirs ni canon : mesurer avant et après sur les fiches réelles, y compris l'effet sur la taille du prompt.
3. Proposer dans `docs/` un texte pour Max et Emma fait **seulement de limites déjà écrites dans les fiches**, sans `[END_CALL]` ni « allusion sentimentale ». Ulrich le colle dans Notion.
4. Sans bloc dans la fiche, prompt strictement identique à aujourd'hui. « Voir ce que reçoit le personnage » montre le bloc et signale s'il est trop long.

## Sources

[maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts), [characterEmbodiment.ts](../src/services/characterEmbodiment.ts), [CharacterReceivedPreview.tsx](../src/components/admin/CharacterReceivedPreview.tsx), test `maxOptimizedPromptCompiler.souvenirs.test.ts`.

## Hors de ce lot

Nouvelles règles de style, gabarit de fin de réplique (`responseHook.ts`), contrat de conversation, hors-champ et directive relationnelle (Bible) ; raccrochage ; synonymes des sujets sensibles.

## Limites

Aucune migration, écriture en base ni réglage modifié sans accord. Base Caractères Notion en lecture seule. Production non publiée. Gami DigiDouble exclu. Un seul agent actif sur Ava.

## Livraison et clôture obligatoire

Selon `AGENTS.md` : `test:quality` et `test:delivery` verts, PR, CI, fusion par la garde. Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG. Le travail suivant identifié est la préparation de la matière de la Bible : écrire son prompt (`docs/prompt_reprise_bible_reponses_lot_1.md`) avec cette même obligation.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis le [plan](plan_cadre_appel.md).
