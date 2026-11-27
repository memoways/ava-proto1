# Prompt de reprise — Attente de passage, mesure après lot 1 ter

À copier dans un nouveau chat Ava, **après la recette d'Ulrich**. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « Attente de passage, lot 1 ter ». Ce lot seulement.

## Objectif

Vérifier sans coder qu'une réplique interrompue n'est plus créditée au personnage, et que le post-tour des répliques entendues survit toujours au tour suivant.

## État au 27 novembre (à revérifier sur origin/main)

Code livré par la PR de la branche `fix/handoff-interrupted-reply-unheard` ; aucun appel réel mesuré. Référence avant : session `8cd27ab0` (`sandbox-ulrich`), tours 7 et 9 : reçus `cancelled`, `delivered` vide, post-tour écrit avec la fin des répliques, confidence `sourceTurn: 9` ; 11 tours sur 11 au journal.

Choix d'Ulrich : tour coupé = aucun post-tour. Il est donc **attendu** que ces tours manquent à `gm_post_turn_log`.

## Recette préalable (Ulrich, sandbox-ulrich, voix seule, mains libres, après synchro Lovable)

Environ 10 tours avec Max : au moins 4 répliques finies, 3 coupées au milieu d'une phrase porteuse d'information, 2 reprises de parole aussitôt après une réplique finie, puis une demande Max → Emma qui aboutit.

## Mesure (lecture seule, MCP Lovable, projet `1265958d-b74e-40f2-917d-182fe05163fc`)

1. Reçus de livraison et `voice_turn_events` (`output_stream` = `feed`) : lister les tours `completed` et les tours coupés.
2. `sessions.gm_post_turn_log` : chaque tour `completed` présent une fois, dans l'ordre ; aucun tour coupé présent.
3. `conversation_memory` et résumé de session : aucune confidence ni fait tiré d'un tour coupé.
4. `experience_events` : `late_after_next_turn`, puis `handoff_validated` et `handoff_executed` pour la demande Max → Emma. Aucun message d'échec de passage après une interruption.
5. Si un tour entendu manque ou qu'un tour coupé apparaît : établir la cause et proposer, sans coder.

## Restes connus, hors de ce lot sauf décision d'Ulrich

Voix lue en bloc et `held_batch` : résumé de session écrit avant la lecture (lu dans le code). Préfixe entendu fiable en voix `feed` : à instrumenter par sortie. Conseils écartés après interruption ; numérotation en double de la télémétrie après une tentative abandonnée.

## Limites

Production non publiée. Aucune écriture en base. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Clôture obligatoire

Consigner dans le plan, `docs/etat_courant.md` et le CHANGELOG (livraison selon AGENTS). S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
