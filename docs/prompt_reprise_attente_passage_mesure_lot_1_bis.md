# Prompt de reprise — Attente de passage, mesure après lot 1 bis

À copier dans un nouveau chat Ava, **après la recette d'Ulrich**. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « Attente de passage, lot 1 bis ». Ce lot seulement.

## Objectif

Vérifier sans coder que le post-tour du Game Master survit au tour suivant, et mesurer enfin les passages perdus.

## État au 27 novembre (à revérifier)

Code livré par la PR de la branche `claude/handoff-wait-lot1bis-post-turn` ; aucune session réelle mesurée après ce lot. Référence avant : sessions `9e2ba88c` (tours 5 et 8) et `ab76a0c9` (tours 13 et 15), post-tour annulé et absent de `gm_post_turn_log` ; 38 observations GM sur 288 en échec du 21 novembre à la fusion de la PR #305. `VOICE_HANDOFF_WAIT_ON_NAME` : laisser tel qu'Ulrich l'a réglé.

## Recette préalable (Ulrich, sandbox-ulrich, après synchro Lovable)

Au moins 10 tours qui nomment Emma sans la demander, en reparlant moins de 3 s après la fin de chaque réplique ou en l'interrompant, puis une demande Max → Emma qui aboutit.

## Mesure (lecture seule, MCP Lovable, projet `1265958d-b74e-40f2-917d-182fe05163fc`)

1. `voice_turn_events` : spans GM (`gm_generation`, `gm_persistence`) des tours dépassés ; attendu : aucun échec dû au tour suivant. `pre_turn_handoff_prior_write` attendu ≈ 0 sur les tours à simple nom.
2. `sessions.gm_post_turn_log` : chaque tour entendu présent une fois, dans l'ordre des tours, sans `parent_aborted`. Un tour jamais entendu est absent, c'est attendu.
3. Tours interrompus : distinguer voix en flux (partie entendue évaluée) et voix lue en bloc (rien de confirmé, donc pas de post-tour, comme avant).
4. `experience_events` : compter `blockedReason = late_after_next_turn` ; `handoff_validated` puis `handoff_executed` pour la demande Max → Emma.
5. Si un tour entendu manque ou qu'un résultat périmé s'est appliqué (conseil, état, cinématique d'un ancien tour) : établir la cause et proposer, sans coder.

## Limites

Production non publiée. Aucune écriture en base. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Clôture obligatoire

Consigner dans le plan, `docs/etat_courant.md` et le CHANGELOG (livraison selon AGENTS). S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Autres chantiers prêts, non lancés : [émotions lot 2](prompt_reprise_coherence_emotionnelle_lot_2.md), [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
