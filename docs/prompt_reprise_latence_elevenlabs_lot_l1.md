# Prompt de reprise — Lot L1 : ElevenLabs réactif

Copier dans un nouveau chat sur Ava.

---

Lot L1 Ava : ElevenLabs sonne mieux mais répond nettement plus lentement que Gradium.
Objectif : rapprocher le délai fin de parole → premier son d'ElevenLabs de celui de
Gradium (~1,9 s), sans dégrader la prosodie ni Gradium. C'est la première tranche du
[grand plan streaming](plan_pipeline_vocal_streaming_unifie_2026-10-26.md), **pas** sa
refonte complète (pas de contrat universel, pas de Fish WebSocket dans ce lot).

Contexte vérifié le 31 oct. : `docs/plan_latence_elevenlabs_et_relance_2026-10-31.md` §1.
R1 est passé avant L1 : les répliques visent ~70 mots (au lieu de 45), donc l'attente du
MP3 complet ElevenLabs est plus longue qu'au diagnostic ; mesurer L1.0 sur ce nouveau texte.
- Chemin incrémental (segments LLM → TTS au fil de l'eau) réservé à Gradium :
  `src/pages/IndexPRD4.tsx` ~1505 (`=== 'gradium'`), `src/services/streamedVoiceTurn.ts`.
- `src/services/tts/providers/elevenlabs.ts` attend `response.blob()` : MP3 complet avant
  lecture, alors que `proxy-tts` relaie déjà le flux `/stream` en chunked.
- Pas de `createStreamingPlayback` ElevenLabs (seul `providers/gradium.ts` en a un).
- v4/v3 sans stitching ni `optimize_streaming_latency`
  (`supabase/functions/_shared/elevenLabsModels.ts`) ; v4 Turbo et v3 Conversational
  annoncés rapides.

Étapes, chacune arrêtable :
- **L1.0 Mesure (d'abord, sans code)** : décomposer un tour ElevenLabs réel à partir des
  traces/télémétrie existantes (1er token LLM, LLM fini, 1er octet TTS, blob fini, 1er son).
  Comparer v4 / v4 Turbo / v3 Conversational / Flash v2.5 dans l'atelier de parole.
  Me présenter le tableau et un choix de modèle à valider à l'oreille.
- **L1.1 Lecture progressive** : `createStreamingPlayback` ElevenLabs (MediaSource MP3,
  repli blob automatique, `abort` net pour le barge-in), branché via `tryCreateStreamingPlayback`.
- **L1.2 Seulement si nécessaire** : ouvrir le chemin incrémental à ElevenLabs. Vérifier
  d'abord dans la doc officielle ElevenLabs le WebSocket `stream-input` et sa compatibilité
  avec le modèle retenu ; sinon segments avec un premier segment court. Évaluer le risque
  de « prosody cliff » sur v3/v4 sans stitching.
- **L1.3 Recette** : sandbox, Max, 5 tours ; Gradium inchangé ; interruption propre.

Contraintes : façade `src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable
uniquement ; invariants parole/mains libres d'AGENTS. Une simulation ne prouve pas le
rendu vocal : la recette d'écoute est la mienne.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne suit), avec cette même obligation.
