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

## Lot T1 livré et mesuré (19 novembre, session sandbox-ulrich `c293829f…`)

Flux PCM de la première ligne vers Tavus fusionné (#214, `7d8fce7`). Session après synchro, 7 tours complétés :

| | Avant (`3251b70f…`, `c25ce8ce…`) | Après T1 |
|---|---|---|
| `video_wait_ms` médian | 2,2–2,6 s | **0,996 s** (883–1104 ms) |
| `output_estimated` médian | 5,4–6,0 s | **3,93 s** (3,65–5,60 s) |
| Transport TTS | `rest` | `http_stream_pcm`, aucun repli |

Cibles atteintes (< 1,2 s et < 4,5 s en médiane). Deux tours sur sept restent à 5,2 et 5,6 s : ce sont ceux dont le span
`pre_turn_handoff_wait` dure 1,3 s (tour 7) et 1,6 s (tour 3), contre ~0,1 s pour les autres. Cause du retard de
~0,9 s confirmée : l'attente du passage avant le tour. Écoute d'Ulrich (lèvres, coupures) : à confirmer par lui.
Suite : lot T2.

## Lot T2 (19 novembre) : attente de passage, interruptions, LLM streamé

### Mesure T1 complétée (session `c293829f…`, 9 tours, 7 complétés, aucun repli TTS local)

`pre_turn_handoff_wait` sur les 9 tours (ms) : 93, 98, **1615**, 116, 101, 110, **1296**, 89, 111 ; médiane 110 ms.
Les deux tours lents sont ceux de `output_estimated` 5,2 et 5,6 s ; les sept autres sont à 3,65–3,93 s. Écoute d'Ulrich
(lèvres, coupures) : non faite par l'agent, à confirmer par Ulrich.

### Cause du retard de 1,3–1,6 s : établie

Le tour suivant attend `handoffWriteRef`, qui pointe sur la finalisation du passage du tour précédent ; celle-ci attend le
GM post-tour (gemini-2.5-flash, 2,2–4,1 s après la fin du tour) puis écrit. Recoupement `llm_usage` (heure de fin des
appels `prd4_gm_post_turn`) et spans `character_*` : au tour 3, le GM du tour 2 finit à 21:45:38,4 (persisté 38,6) et
le pipeline du tour 3 démarre à ≈ 38,9 ; au tour 7, le GM du tour 6 finit à 21:47:04,07 (persisté 04,2) et le pipeline
démarre à ≈ 04,4. Aux sept autres tours, le GM précédent était fini avant la décision (wait ≈ 0,1 s = l'écriture propre
du tour). Quand Ulrich enchaîne vite, il paie donc le reste du GM du tour d'avant. Cette attente ne sert à rien quand aucun passage de personnage n'est plausible : la finalisation n'écrit alors qu'une
révision neuve d'un état `none`. Attention : le GM peut valider un passage sur le tour courant sans demande ouverte (la
preuve de consentement exige le nom de la cible dans une citation du joueur ou de la réponse) ; le raccourci ci-dessous
garde donc l'attente dès que l'autre personnage est nommé ou que la réponse ressemble à un transfert.

### Correction

- `handoffFinalizationWritesSnapshot(state, texte joueur, réponse, personnage)` (`handoffCoordinator.ts`) : vrai pour une
  demande ouverte ou une offre préparée, ou si l'autre personnage est nommé (joueur ou réponse) ou si la réponse lit comme
  un transfert ou un consentement ; faux sinon et pour une offre déjà `available`.
- `IndexPRD4.tsx` : sans passage plausible, la finalisation ne s'enregistre plus dans `handoffWriteRef` et n'écrit plus ; l'événement
  `handoff_blocked` d'un `action: handoff` du GM sans demande reste journalisé. Le transcript est persisté par le reçu de
  livraison et par l'écriture du tour suivant. Tour avec passage plausible : comportement inchangé (attente conservée). Limite : un passage que le
  GM validerait sans que ni le joueur ni la réponse ne nomme l'autre personnage ne peut pas passer la validation de preuve.
- Span découpé (nouveaux noms autorisés) : `pre_turn_handoff_prior_write`, `pre_turn_handoff_read`,
  `pre_turn_handoff_own_write`, en plus du total `pre_turn_handoff_wait`.
- **Non mesuré après correction** : il faut une session sandbox-ulrich Tavus (Ulrich) ; attendu : `pre_turn_handoff_wait`
  ≈ 0,1 s à tous les tours hors passage, donc plus de tour à 5,2–5,6 s.

### Interruptions répétées : cause probable, non corrigée

Sessions du 19 novembre, tours interrompus : 2/10, 4/6, 1/14, 6/19, 2/8 (Anam, TTS et Tavus) ; `c25ce8ce` 7/11 ;
`c293829f` 2/9. Les coupures **avant l'appel LLM** tombent toutes à 1,28–1,52 s après la décision (1311, 1317, 1280,
1518 ms ; 1332 sur `c293829f`), sans premier octet audio, sans `acoustic_candidate` ni `interruption_confirmed` : ni Tavus
ni le détecteur d'interruption acoustique n'interviennent. Signature d'un tour re-décidé quand le joueur reprend la parole
après une pause (mains libres, STT Deepgram : silence 900 ms, `utteranceEndMs` 1500). Ce n'est pas propre à Tavus ; le
pic de `c25ce8ce` coïncide avec l'attente vidéo de 2,2 s, la session `c293829f` (attente 1,0 s) revient au niveau Anam.
Aucune correction : régler la fin d'énoncé est un compromis latence / coupure à décider par Ulrich.

### LLM streamé

Note séparée : [évaluation](evaluation_llm_streame_vers_tts.md). Aucun code.
