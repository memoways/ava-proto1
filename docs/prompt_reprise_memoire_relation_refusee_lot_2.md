# Prompt de reprise — Mémoire et relation, lot 2 : sujets sensibles non reconnus

À copier dans un nouveau chat Ava, **seulement si Ulrich veut ce chantier**. Ce lot seulement.

## Objectif

Qu'un sujet sensible proposé par le Game Master avec le bon identifiant soit reconnu, pour que la relation puisse progresser comme prévu.

## État au 28 novembre (à revérifier sur origin/main)

Lot 1 livré : un refus de relation garde la mémoire du tour ([plan](plan_latence_conversationnelle_llm_tts.md)) ; recette sur appel réel non faite. Mesure du 24 au 28 novembre : 32 refus sur 196 tours.

- `slug()` de `src/services/relationshipEngine.ts` coupe à 72 caractères et peut finir sur un tiret ; un second passage (validation, `normalizeRelationshipState`) le retire. L'identifiant du sujet n'est alors jamais reconnu, ni retrouvé par `buildTurnRelationshipDirective`. Présent dans 17 refus, seule cause pour 15.
- 4 refus : des identifiants de mémoire (`max-topic-…`, `emma-topic-…`) proposés comme sujets sensibles.
- Constaté à côté : les libellés de sujets sont des phrases entières de la fiche (champ sujets sensibles).

## À faire

1. Reproduire en rouge (identifiant de 72 caractères finissant sur un tiret).
2. Avant de coder, dire à Ulrich ce qui changera en jeu : des relations aujourd'hui refusées seront acceptées et des sujets pourront s'ouvrir. Obtenir son accord.
3. Rendre l'identifiant stable ; vérifier les états déjà stockés. Traiter les identifiants de mémoire seulement sur accord (une consigne du prompt GM est un changement distinct).

## Limites

Aucune migration, aucune écriture en base, aucun réglage modifié sans accord. Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Hors de ce lot

Recette du lot 1 (appel sur `sandbox-ulrich`) ; post-tour annulé au raccrochage ; répétition après coupure ; résumé écrit avant lecture en voix lue en bloc. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md), [ElevenLabs annuel lot 2](prompt_reprise_elevenlabs_annuel_lot_2.md).

## Livraison et clôture obligatoire

Selon `AGENTS.md` : `test:quality` et `test:delivery` verts, PR, CI, fusion par la garde. Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG. S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis la fonction `slug` et ses appelants.
