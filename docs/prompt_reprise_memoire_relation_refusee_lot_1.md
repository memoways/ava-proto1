# Prompt de reprise — Mémoire gardée quand la relation est refusée, lot 1

À copier dans un nouveau chat Ava, **seulement si Ulrich veut ce chantier**. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « Attente de passage, lot 1 ter : mesure ». Ce lot seulement.

## Objectif

Qu'un refus de la relation proposée par le Game Master ne fasse plus perdre le reste de la mémoire d'un tour entendu (confidences, faits, sujets, fils ouverts), sans jamais appliquer la relation refusée.

## État au 28 novembre (à revérifier sur origin/main)

Mesure livrée en documentation seule. `src/agents/gameMasterPRD4.ts` (autour de `gm_validation_relationship`) met `memory_delta` à `null` quand `validateRelationshipTransition` refuse, malgré le commentaire « Reject this mutation only ». Comportement fixé par `gameMasterPRD4.memory.test.ts` et `gameMasterPRD4.handoff.test.ts`. 32 tours sur 196 depuis le 24 novembre ; session `f89abea8`, tours 2 et 3 (confidence du tour 3 perdue). Motifs vus : `unknown_topic:*`, `upward_without_user_evidence`, `character_mismatch` + `policy_version_mismatch` + `source_turn_mismatch`.

## À faire

1. Chercher dans l'historique pourquoi tout le delta est jeté ; établir pour chaque motif si le reste du delta reste fiable (des métadonnées recopiées d'un autre tour peuvent signaler un delta périmé entier).
2. Présenter à Ulrich la règle proposée avant de coder ; puis reproduction rouge, correction, tests.
3. Vérifier que la persistance sans relation conserve la relation précédente.

## Limites

Aucune migration, aucun réglage ni prompt éditorial modifié, aucune écriture en base. Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Hors de ce lot

Post-tour annulé au raccrochage ; répétition après coupure ; résumé écrit avant lecture en voix lue en bloc et `held_batch` ; numérotation de télémétrie. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md), [ElevenLabs annuel lot 2](prompt_reprise_elevenlabs_annuel_lot_2.md).

## Clôture obligatoire

Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG (livraison selon AGENTS). S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire.
