# Prompt de reprise — Attente de passage, mesure après lot 1

À copier dans un nouveau chat Ava, après la recette d'Ulrich. Origine : [plan latence](plan_latence_conversationnelle_llm_tts.md), « Attente de passage, lot 1 ».

## Objectif

Mesurer l'effet réel du lot 1, sans coder. Ce lot seulement.

## État au 27 novembre (à revérifier)

Code livré par PR depuis `fix/handoff-wait-name-only` ; réglage `VOICE_HANDOFF_WAIT_ON_NAME` éteint. Référence avant : 14 tours sur 574 avec `pre_turn_handoff_prior_write` > 0,5 s (médiane 1,45 s, max 3,10 s). Aucune session réelle mesurée après le lot.

## Recette préalable (Ulrich, sandbox-ulrich, preview à jour)

Un appel avec au moins 10 tours qui nomment Emma sans la demander, en enchaînant vite, puis une demande Max → Emma qui aboutit.

## Mesure (lecture seule, MCP Lovable, projet `1265958d-b74e-40f2-917d-182fe05163fc`)

1. `voice_turn_events` (`voice_turn_finished`) : spans `pre_turn_handoff_prior_write` de la session ; attendu ≈ 0 sur les tours à simple nom.
2. `experience_events` : passage `handoff_validated` puis accepté ; compter les `blockedReason = late_after_next_turn`.
3. Si une attente > 0,5 s ou un passage perdu apparaît : établir la cause et proposer, sans coder.

## Limites

Production non publiée. Aucune écriture en base. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.

## Clôture obligatoire

Consigner dans le plan, `docs/etat_courant.md` et le CHANGELOG (livraison selon AGENTS). S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Autres chantiers déjà préparés, non lancés : [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
