# Prompt de reprise — Cadre de l'appel, lot 2 : les limites arrivent au personnage

À copier dans un nouveau chat Ava, **seulement après l'accord d'Ulrich sur le [plan](plan_cadre_appel.md)**. Ce lot seulement.

## État au 28 novembre (à revérifier sur origin/main)

Lot 1 (diagnostic, aucun code) : sur 450 questions réelles, « Quand tu raccroches » n'est jamais envoyé et « Ce que tu ne fais jamais » presque jamais, faute de place dans le noyau de fiche ; aucun code ne traite `[END_CALL]`. Réponses d'Ulrich aux trois questions du plan : **à lire avant de coder** (les consigner dans le plan). Note de posture proposée : essayée ou non, à demander.

## Périmètre

1. Définir un bloc « Limites de l'appel » dans la fiche (intitulé reconnu dans un champ existant, sans migration), envoyé en entier comme la Manière de parler.
2. Lui donner la place (environ 900 caractères) sans évincer faits établis, mémoire, souvenirs ni canon : mesurer avant et après sur les fiches réelles.
3. Proposer dans `docs/` le texte pour Max et Emma, sans `[END_CALL]` tant que le lot 4 n'est pas décidé. Ulrich le colle dans Notion.
4. Sans bloc dans la fiche, prompt strictement identique à aujourd'hui. L'aperçu « Voir ce que reçoit le personnage » montre le bloc et signale s'il est trop long.

## Sources

[maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts), [characterEmbodiment.ts](../src/services/characterEmbodiment.ts), [CharacterReceivedPreview.tsx](../src/components/admin/CharacterReceivedPreview.tsx), test `maxOptimizedPromptCompiler.souvenirs.test.ts`.

## Hors de ce lot

Contrat de conversation, hors-champ et directive relationnelle (lot 3) ; raccrochage (lot 4) ; synonymes des sujets sensibles.

## Limites

Aucune migration, écriture en base ni réglage modifié sans accord. Base Caractères Notion en lecture seule. Production non publiée. Gami DigiDouble exclu. Un seul agent actif sur Ava.

## Livraison et clôture obligatoire

Selon `AGENTS.md` : `test:quality` et `test:delivery` verts, PR, CI, fusion par la garde. Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG. S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis le [plan](plan_cadre_appel.md).
