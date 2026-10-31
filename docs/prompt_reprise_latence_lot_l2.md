# Prompt de reprise — Lot L2 : retard intermittent entre fin du LLM et TTS

> Remplacé par `prompt_reprise_gravite_ava_latence_lot_g1.md` (partie C) le 31 octobre 2026.

Copier dans un nouveau chat sur Ava.

---

Lot L2 Ava : environ un tour sur cinq perd 2 à 3,6 s entre la fin de la réplique LLM et
l'envoi du texte au TTS, avec ElevenLabs comme avec Gradium. Objectif : trouver la cause et
la supprimer si elle n'est pas voulue, sans toucher à la lecture progressive livrée par L1.

Préalable : la recette L1.3 d'Ulrich (sandbox, Max, 5 tours ElevenLabs v4 Turbo, Gradium
inchangé, interruption propre) est faite ou explicitement reportée par lui.

Contexte vérifié le 31 oct. : `docs/plan_latence_elevenlabs_et_relance_2026-10-31.md`,
sections « Mesure L1.0 » et « Exécution L1.1 ».
- Mesure : `voice_turn_events` (`voice_turn_finished`, `metadata_json.milestones`), écart
  `tts_text_sent − llm_response`. Exemples du 31 oct. (sandbox-ulrich, origine
  `app_turn_decision`) : 4 379 → 8 034 ms, 3 685 → 6 093 ms ; Gradium le 28 oct. :
  3 160 → 5 113 ms. Les autres tours : écart de quelques ms.
- Pistes, non vérifiées : préparation de passage (`needsHandoffPreparation`,
  `prepareHandoff` dans `src/services/prd4Orchestrator.ts`), garde d'identité ou relance de
  récupération, travail synchrone entre `processPRD4Turn` et `LocalTTSOutput.renderText`
  dans `src/pages/IndexPRD4.tsx`.
- `VOICE_INCREMENTAL_OUTPUT` est `false` en sandbox-ulrich et `true` en prod
  (`admin_settings.ava_gameplay_settings`) : les mesures sandbox ne reflètent pas le chemin
  incrémental. Ne pas changer ce réglage sans l'accord d'Ulrich.

Étapes, chacune arrêtable :
- **L2.0 Mesure (sans code)** : isoler les tours lents, corréler avec les événements du tour
  (passage, relance, GM, garde) et nommer la cause avec preuve. Me présenter le constat.
- **L2.1 Correctif** seulement si la cause est un travail évitable sur le chemin critique ;
  sinon, documenter pourquoi l'attente est voulue.
- **L2.2 Recette** : sandbox, Max, 10 tours, aucun écart > 500 ms hors passage voulu.

Contraintes : façade `src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable
uniquement ; invariants parole/mains libres d'AGENTS. Une simulation ne prouve pas le
rendu vocal : la recette d'écoute est celle d'Ulrich.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne
suit), avec cette même obligation.
