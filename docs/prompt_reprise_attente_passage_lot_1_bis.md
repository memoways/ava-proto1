# Prompt de reprise — Attente de passage lot 1 bis : le Game Master survit au tour suivant

À copier dans un nouveau chat Ava. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « mesure après lot 1 ». Ce lot seulement.

## Objectif

Quand le tour suivant démarre pendant le post-tour du Game Master, celui-ci va au bout et s'enregistre ; le tour suivant n'attend toujours pas sur un simple nom.

## État vérifié au 27 novembre (à revérifier)

- PR #305 sur main ; `pre_turn_handoff_prior_write` 0 ms sur 31 tentatives (`ab76a0c9`, `9e2ba88c`).
- `IndexPRD4.tsx` passe `postTurnSignal: handoffLease?.signal` ; `advanceHandoffTurn` donne un nouveau `requestId` à chaque tour sans demande ouverte, donc `HandoffCoordinator.bind` annule le signal précédent.
- Cas observés : `9e2ba88c` tours 5 et 8, `ab76a0c9` tour 13 (et 15, sans nom, comportement antérieur au lot 1) : spans GM en échec, tour absent de `gm_post_turn_log`, aucun `late_after_next_turn`.

## Périmètre

1. Test qui reproduit l'annulation, d'abord rouge.
2. Séparer l'annulation du post-tour de l'invalidation du passage. L'écriture du passage reste abandonnée si le tour est dépassé et `late_after_next_turn` doit alors pouvoir se déclencher. Fin d'appel, changement de personnage et redémarrage annulent toujours.
3. Avant de coder, vérifier les effets d'une évaluation arrivée tard : `persistPostTurnMemory` (ordre par `turnIndex`, `memory_last_turn`, `gm_post_turn_log`), guidage, état de parole et du personnage, cinématique, passage. Rien de périmé ne doit s'appliquer à un tour plus récent.
4. Règle unique proposée pour tous les tours ordinaires (avec ou sans nom). La préparation d'un passage (`character_handoff_preparation`) garde son comportement.

## Validations

`npm run test:quality` et `npm run test:delivery` verts. Aucune migration ni valeur enregistrée modifiée. Recette ensuite par Ulrich sur `sandbox-ulrich` après synchro : au moins 10 tours qui nomment Emma sans la demander, en reparlant moins de 3 s après la fin de chaque réplique ou en l'interrompant, puis une demande Max → Emma qui aboutit. La mesure (spans GM, `gm_post_turn_log`, `late_after_next_turn`) est un lot distinct.

## Limites

Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu. Les invariants de passage et d'interruption de fin d'AGENTS s'appliquent. Réglage de retour : `VOICE_HANDOFF_WAIT_ON_NAME` (à laisser tel qu'Ulrich l'a réglé).

## Clôture obligatoire

Livraison selon AGENTS ; plan, `docs/etat_courant.md`, CHANGELOG à jour. Écrire le prompt du lot suivant avec cette même obligation, ou dire qu'il n'y en a pas. Autres lots prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
