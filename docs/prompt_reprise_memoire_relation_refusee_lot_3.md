# Prompt de reprise — Mémoire et relation, lot 3 : liste des sujets sensibles

À copier dans un nouveau chat Ava, **seulement si Ulrich veut ce chantier**. Ce lot seulement.

## Objectif

Que les sujets sensibles d'un personnage soient les vrais sujets de sa fiche, et qu'une question ne les déclenche que lorsqu'elle les aborde.

## État au 28 novembre (à revérifier sur origin/main)

Lot 1 (mémoire gardée quand la relation est refusée) et lot 2 (identifiant coupé reconnu) livrés ([plan](plan_latence_conversationnelle_llm_tts.md)) ; aucune recette sur appel réel.

Constaté pendant le lot 2, dans `src/services/relationshipEngine.ts` :

- `cleanList` coupe le champ sujets sensibles à chaque ligne **et chaque point-virgule**, 12 morceaux au plus. Sur les fiches `prod` : l'introduction (« Aucun sujet n'est interdit… ») et des bouts de phrases sont des sujets ; « Les morts » et « L'après » manquent pour Max, « L'après » pour Emma.
- `parseTopicRules` garde comme mots-clés les 8 premiers mots de 3 lettres ou plus du libellé (« est », « pas », « les »). `buildTurnRelationshipDirective` demande de se retenir dès qu'un sujet ainsi reconnu est fermé (lu dans le code, fréquence non mesurée).
- 4 refus sur 32 (24 au 28 novembre) : identifiants de mémoire (`max-topic-…`, `emma-topic-…`) proposés comme sujets sensibles.

## À faire

1. Mesurer en lecture seule la fréquence des sujets reconnus et du mode `resist` sur des questions réelles ; reproduire en rouge.
2. Proposer une règle de découpage et de déclenchement. Les identifiants changeront : dire ce que deviennent les états déjà stockés.
3. Avant de coder, expliquer à Ulrich en langage simple ce qui changera en jeu et obtenir son accord. Une évolution de la fiche se propose dans `docs/`, Ulrich l'applique lui-même.
4. Traiter les identifiants de mémoire seulement sur accord (la consigne du prompt GM est un changement distinct).

## Limites

Aucune migration, aucune écriture en base, aucun réglage ni prompt modifié sans accord. Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Hors de ce lot

Recette des lots 1 et 2 (appel sur `sandbox-ulrich` : plus de `unknown_topic` sur un identifiant coupé ; mémoire du tour gardée sur un refus) ; post-tour annulé au raccrochage ; répétition après coupure ; résumé écrit avant lecture en voix lue en bloc. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md), [ElevenLabs annuel lot 2](prompt_reprise_elevenlabs_annuel_lot_2.md).

## Livraison et clôture obligatoire

Selon `AGENTS.md` : `test:quality` et `test:delivery` verts, PR, CI, fusion par la garde. Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG. S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis `cleanList`, `parseTopicRules`, `matchedTopics` et leurs appelants.
