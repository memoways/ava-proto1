# Latence de Max en vidéo Tavus — analyse du 19 novembre 2026 et plan du lot T1

## Contexte

Le 19 novembre au soir, Ulrich a testé Max en vidéo Tavus (sandbox-ulrich, sessions `3251b70f…` 20:45 UTC et
`c25ce8ce…` 20:54 UTC). Max répond avec un retard nettement perçu. Question : est-ce que les lots GM du jour (A, C, B, D,
E1) ajoutent de la latence, et comment la réduire sans régression ?

## Constat mesuré (voice_turn_events + llm_usage, Lovable Cloud, lecture seule)

Médianes par session, en ms depuis la décision de tour (push-to-talk), tours terminés :

| Session (19 nov.) | Sortie | Contexte prêt | Réponse LLM | Attente vidéo | Max audible |
|---|---|---|---|---|---|
| 07:41 (avant lots) | Anam | 1033 | 3132 | 526 | **3665** |
| 12:05 (avant lots) | Anam | 1006 | 3012 | 530 | **3532** |
| 12:11 / 13:49 (avant lots) | TTS | 1080 / 1070 | 3389 / 3319 | – | **3763 / 3662** |
| 20:43 (après lot D) | TTS | 1421 | 3400 | – | **3747** |
| 20:45 (après lot D) | Tavus | 1364 | 3349 | **2562** | **5973** |
| 20:54 (après lot D) | Tavus | 1144 | 3092 | **2213** | **5374** |
| 1er nov. (Tavus voix Tavus) | Tavus | ~1200–1800 | ~3200–4500 | **~700–800** | ~3900–5400 |
| 6 nov. (Tavus voix Ava) | Tavus | 1053 | 3410 | **2976** | 6405 |

**Les lots GM du jour n'ajoutent pas de latence mesurable** :
- TTS avant/après les lots : 3,66–3,76 s, identique ; réponse LLM de Max stable (~3,0–3,4 s).
- Prompt de Max (`prd4_chat`, gpt-5.6-luna) : 2,6–3,9 k tokens avant comme après.
- GM post-tour (gemini-2.5-flash) : 9,7–11,5 k tokens, stable, et hors du chemin critique (après la réponse).

**La cause est la sortie Tavus « voix d'Ava » (#161, 6 novembre)**, ~1,7 à 2,2 s de plus qu'Anam :
- `renderAvaAudio` → `streamAvatarSpeech` → `generateSpeech` attend le **blob complet** ElevenLabs de la première
  phrase (REST, eleven_v4_turbo), puis décode, puis envoie à Tavus. Mesuré : texte envoyé → blob prêt **1,6–2,2 s**,
  puis blob → Tavus parle **0,5–0,65 s**.
- En mode TTS seul, le même ElevenLabs démarre en **~0,3 s** car il est lu en flux (`elevenLabsStreamPlayer`,
  `first_audio_chunk`). `proxy-tts` relaie déjà le corps `/stream` en morceaux : le flux existe, Tavus ne l'utilise pas.
- Avant #161 (voix propre de Tavus, Echo texte), l'attente vidéo était ~0,7–0,8 s.

Constats secondaires (non bloquants pour T1) :
- 2 tours sur 9 démarrent le pipeline personnage ~1,25 s après la décision au lieu de ~0,35 s : attente probable
  de l'écriture de passage (`handoffWriteRef`, `IndexPRD4.tsx:1762`) quand le GM post-tour du tour précédent
  n'a pas fini. Non instrumenté aujourd'hui.
- Session 20:54 : 7 tours interrompus sur 10, dont 4 avant l'appel LLM (Ulrich reprend la parole pendant l'attente ?
  boucle « Max ne répond pas → je reparle → tour annulé »). À confirmer à l'écoute.
- LLM de Max en `http_batch` (non streamé) : 1,4–2,6 s ; levier distinct, plus risqué (validation, salvage).

## Lot T1 recommandé : flux ElevenLabs PCM vers Tavus

Objectif : premier morceau audio à Tavus dès les premiers octets ElevenLabs. Gain attendu ~1,2–1,8 s par tour
(attente vidéo ~0,8–1,0 s, Max audible ~4 s au lieu de ~5,5–6 s). Voix d'Ava, texte, segmentation et GM inchangés.

1. `src/services/streamingAvatar/avatarAudioBridge.ts` : pour la **première ligne** quand le fournisseur est
   ElevenLabs, synthèse en flux : requête via `buildElevenLabsRequest` + `requestElevenLabsSpeech`
   (`src/services/tts/providers/elevenlabs.ts`) avec format forcé `pcm_24000` (= `TAVUS_ECHO_AUDIO_SAMPLE_RATE`,
   pas de rééchantillonnage), lecture de `response.body` et envoi de morceaux PCM16 de
   `TAVUS_ECHO_AUDIO_CHUNK_MS` (250 ms) au fil de l'eau ; reste d'octet impair conservé entre lectures.
   Lignes suivantes : chemin blob actuel (déjà préchargées), ou flux si simple.
2. Repli sans régression : échec avant le premier octet → chemin `generateSpeech` actuel ; échec après envoi →
   comportement actuel (`sendInterrupt` + `AvatarRenderError`). Annulation/barge-in : `abort` du fetch.
   Délai `avatarTtsDeadline` appliqué au premier morceau. Gradium et autres fournisseurs : inchangés.
3. Prérequis à vérifier en codant : `proxy-tts` accepte `output_format=pcm_24000` sur `/stream` (sinon ajout
   minimal côté proxy, redéployé par Lovable) ; `onVoiceObservation` émet `first_audio_chunk` sur ce chemin pour
   que la mesure apparaisse dans Qualité → Latence.
4. Instrumentation légère (même lot) : span client `pre_turn_handoff_wait` autour de l'attente
   `IndexPRD4.tsx:1762-1781`, pour trancher le constat secondaire n°1 sur les prochaines sessions.
5. Ce rapport (`docs/analyse_latence_tavus_20261119.md`) reste la référence ; compléter avec les mesures après T1,
   entrée `docs/etat_courant.md`, CHANGELOG, et prompt de reprise du lot suivant (T2 : attente de passage /
   interruptions, et éventuel LLM streamé).

Hors périmètre : streaming du LLM, réduction de la première phrase, retour à la voix Tavus (perd la voix d'Ava),
changements GM ou de réglages, production.

## Vérification

- Tests unitaires `avatarAudioBridge` / `tavus.test.ts` : flux PCM découpé en 250 ms (frontières d'octets
  impairs), premier envoi avant la fin du corps, repli blob si le flux échoue avant le premier octet, abort pendant
  le flux, `final` sur le dernier morceau, Gradium inchangé.
- `npm run typecheck`, lint, tests de garde du dépôt ; CI de la PR verte avec `regression-gates`.
- Après fusion et synchro Lovable : une session Tavus sandbox-ulrich, puis requête sur `voice_turn_events` :
  `video_wait_ms` médian visé < 1,2 s et `output_estimated` < 4,5 s, sans tour de repli TTS local supplémentaire ;
  écoute d'Ulrich (lèvres synchronisées, pas de coupure entre morceaux).

## Livraison

Branche du lot depuis main à jour, commit, push, PR, CI complète sur PR, fusion via
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (gh via `github-delivery-exec`), vérification sur
origin/main et synchro Lovable. Production non publiée.

Reprise : [prompt du lot T1](prompt_reprise_latence_tavus_lot_t1.md).

## Lot T1 livré (code) — mesures à compléter

Flux PCM de la première ligne vers Tavus implémenté (PR du lot T1). Mesure sur une session Tavus sandbox-ulrich après
synchro Lovable : **à renseigner** (`video_wait_ms` médian, `output_estimated`, tours en repli, span
`pre_turn_handoff_wait`, écoute d'Ulrich).
