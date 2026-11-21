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

### Mesure après T2 (session `d39b9221…`, 20 novembre, 20 tours : 12 Max puis 8 Emma, passage Max → Emma réussi)

- **Attente de passage corrigée** : `pre_turn_handoff_wait` entre 0,07 et 0,17 s aux 20 tours (médiane ≈ 0,09 s), `prior_write`
  ≈ 0 ms partout (max 62 ms). Plus aucun tour à 1,3–1,6 s. Écoute d'Ulrich : le passage Max → Emma s'est très bien fait.
- **Max audible (`output_estimated`, tours complétés)** : Max 3,85–4,18 s (médiane ≈ 4,1 s) ; Emma 2,75–3,90 s (médiane ≈ 3,5 s,
  sans attente vidéo, `output ≈ premier octet + 0,35 s`). Ulrich ressent bien Emma plus réactive : l'écart médian de ≈ 0,6 s (jusqu'à ≈ 1 s selon les tours) est
  l'attente vidéo Tavus (`video_wait_ms` 0,88–1,13 s, médiane ≈ 1,04 s).
- **Exceptions** : tour 1 (ouverture, 5,3 s) et tour 10 (6,4 s) : le tour 10 est la demande de passage vers Emma, dont la
  sortie est volontairement retenue jusqu'à la validation du GM (`tts_text_sent` 5,3 s pour une réponse LLM à 2,5 s) ; à ne pas
  toucher (garde de passage).
- **Interruptions** : 7 tours sur 20, mêmes signatures qu'avant : annulation 1,10–1,32 s après la décision (5 tours) et 2,1–2,2 s
  (2 tours), tous après la préparation du contexte (≈ 1,0 s), donc le joueur reprend la parole pendant l'appel LLM. Ce n'est pas Tavus.

### Où reste la latence (Max, médianes, depuis la décision de tour)

| Étape | Durée | Levier possible | Gain estimé |
|---|---|---|---|
| Transcript final → contexte prêt | ≈ 1,0 s (dont RAG 0,6–0,7 s : embedding 0,2 + vector 0,05 + rerank 0,2–0,26) | rerank en parallèle ou retiré, embedding sur le partiel | 0,2–0,3 s (qualité de retrieval à rejouer) |
| Appel LLM complet (`upstream_headers`, `http_batch`) | 1,8–2,1 s | LLM streamé, première phrase seulement | 0,5–0,9 s (estimé) |
| Premier octet audio ElevenLabs (flux PCM) | ≈ 0,35 s | rien d'évident | – |
| Attente vidéo Tavus (blob → lèvres) | ≈ 1,0 s | taille et cadence des premiers morceaux, pré-roll Tavus : à expérimenter | inconnu, seul levier propre à Tavus |
| Fin d'énoncé STT (avant la décision, **non comptée** par l'origine « décision de tour ») | silence 0,9 s + attente de fin | réglage `utteranceEndMs` | compromis avec les coupures |

### Lot T3 mesuré (20 novembre, session `2b984ce8…`, sandbox-ulrich, 12 tours)

Le correctif de `query-rag` (profil lu en parallèle du quota) n'était pas actif après la synchro GitHub : Lovable n'avait pas
redéployé la fonction (session sandbox-benoit `eb0448ed…` encore séquentielle). Redéploiement demandé à Lovable (21:29 UTC), puis mesure :

| Médiane (ms) | Avant T3 (`d39b9221…` / `eb0448ed…`) | Après T3 (`2b984ce8…`) |
|---|---|---|
| `rag_profile`, début de span | 51 (séquentiel) | **0** (chevauche `control_quota`) |
| `character_rag` côté client | 735 / 753 | 690 (n = 9, p90 1 177) |
| embedding | 214 | 217 |
| rerank | 208 / 204 | 206 |

Le chevauchement est confirmé. La baisse de `character_rag` (≈ 45–60 ms) correspond au gain attendu, mais reste dans le bruit :
9 tours, et le p90 de l'embedding (660 ms) vient de Voyage, pas de T3. Gain non établi statistiquement, comportement validé.
Restent embedding (≈ 215 ms) et rerank (≈ 205 ms) : voir [reprise T4](prompt_reprise_latence_tavus_lot_t4.md).

### Contrôle de non-régression RAG après T3 (21 novembre, lecture `voice_turn_events`)

Tours `voice_turn_completed` du 19 au 21 novembre, avant redéploiement (n = 103) et après (n = 9) : **0 erreur** de part et d'autre,
tours sans passage RAG 1 contre 0, `rag.matches_count` moyen 5,85 contre 6,00, `t_rag_total_ms` médian 740 → 690 ms, p90 1 184 → 1 177 ms.
Revue du code : la lecture du profil démarre avant le quota, son rejet est absorbé (`.catch`) quand la requête est refusée ou invalide,
et l'erreur de profil est relancée à l'`await` d'origine ; le contrat de réponse n'a pas changé. Aucun problème potentiel relevé ;
l'échantillon après T3 (9 tours) reste petit pour le p90. Le « blocker_step = rag » des tours critiques désigne l'étape la plus lente, pas une erreur.

### Décision attendue d'Ulrich (levier contexte restant, aucun code modifié)

| Option | Gain médian | Risque | Pré-requis |
|---|---|---|---|
| (a) rerank retiré ou conditionnel en voix (`RAG_RERANK_ENABLED`) | ≈ 0,2 s (rerank 206 ms) | ordre des 5 passages moins fin (retrieve_k 15 → top 5 par cosinus seul) | rejeu de qualité : laboratoire RAG + `evalJudge`, avant tout changement |
| (b) embedding lancé sur le transcript partiel | ≈ 0,2 s (embedding 217 ms, p90 660 ms) | requête fondée sur un texte incomplet, appels Voyage gaspillés, plus de code client | protocole d'abandon si le final diverge |

Recommandation : (a) d'abord, en mode conditionnel (rerank seulement si l'écart entre les cosinus du top 5 est faible), car sans effet sur le client et réversible par réglage ; (b) seulement si (a) ne suffit pas.

### Lot T5 : rejeu du rerank conditionnel (21 novembre, sandbox-ulrich, aucun changement de code)

Ulrich a choisi le rerank conditionnel. Rejeu de 20 questions réelles du laboratoire RAG sur les 2 personnages indexés (40 appels à `query-rag`,
rerank `rerank-2.5-lite`, `retrieve_k` 15, top 5 ; outil `npm run eval:rerank-replay`) : ordre par cosinus (`retrieval_matches`) contre top 5 reranké.
Sur les 38 appels qui ont remonté des passages :

- **Le rerank change l'ensemble servi** : recouvrement moyen du top 5 cosinus et du top 5 reranké = 2,4 / 5 (distribution 5 : 1, 4 : 6, 3 : 12, 2 : 10, 1 : 7, 0 : 2) ;
  le premier passage est identique dans 32 % des cas seulement ; le premier reranké est absent du top 5 cosinus dans 39 % des cas.
- **Aucun critère de cosinus ne désigne un cas sûr** : écart entre les rangs 5 et 6 ≥ 0,02 (4 cas) → recouvrement 2,25 ; ≥ 0,04 (3 cas) → 1,67 ;
  similarité du premier ≥ 0,5 (2 cas) → 2,5, aucun cas ≥ 0,55. Même quand la coupure cosinus est nette, le rerank réordonne l'ensemble.
- **Seul cas sans perte d'ensemble** : 5 appels sur 40 ont ≤ 5 passages (dont 2 sans résultat) ; 3 d'entre eux passent par le rerank pour un simple réordonnancement, soit ≈ 7 % des tours.

Conclusion : un rerank conditionnel sur le cosinus dégraderait ou changerait la sélection sans gain mesurable en moyenne (≈ 0,2 s sur ≈ 7 % des tours seulement).
Le rejeu mesure la divergence, pas la qualité : savoir si le rerank améliore réellement les réponses demande `evalJudge` avec et sans rerank. **Rien n'est modifié** (`RAG_RERANK_ENABLED` reste vrai).
Pistes restantes : `evalJudge` avec/sans rerank (décide du retrait pur), `retrieve_k` 15 → 10 (rerank moins long, qualité à rejouer), embedding sur transcript partiel (lot lourd), LLM streamé.

### Lot T6 : evalJudge avec et sans rerank (21 novembre, run `82195f92…`, sandbox-ulrich, aucun changement de code)

Même prompt (`optimized_v3`), même modèle (`openai/gpt-5.6-luna`, T = 1,4), seule différence `ragRerank` vrai (référence) / faux (candidat) ; 21 questions × 2 configurations × 3 passages = 126 tours, 0 erreur, juge `anthropic/claude-sonnet-5.5`, 3,03 $ mesurés.

| | Avec rerank | Sans rerank | Δ |
|---|---:|---:|---:|
| Note pondérée /10 | 4,54 | 4,58 | +0,03 (bruit entre passages ± 0,63) |
| Max / Emma | 4,48 / 4,62 | 4,61 / 4,54 | +0,13 / −0,09 |
| Canon et timeline (/5) | 2,24 | 2,08 | −0,16 |
| Interdits respectés / ton (/5) | 2,14 / 2,29 | 2,33 / 2,44 | +0,19 / +0,15 |

6 questions en hausse, 6 en baisse (|Δ| ≥ 0,3). Verdict du juge : le retrait du rerank **ne change rien de mesurable** à la qualité des réponses. Seul signal faible : `canon_timeline` −0,16 (dans le bruit), à surveiller si le retrait est décidé.
Limites : corpus de 21 questions et 2 personnages, juge bruité ; le rejeu T5 montre que le top 5 change fortement mais que, pour les réponses finales, l'effet n'est pas détectable.
Gain attendu du retrait : ≈ 0,2 s médian sur `character_rag` (rerank 206 ms), environ 5 % de la latence totale de Max audible. **Aucun réglage modifié** (`RAG_RERANK_ENABLED` reste vrai). **Décision d'Ulrich (21 novembre) : garder le rerank** ; restent `retrieve_k` 15 → 10, l'embedding sur transcript partiel et le LLM streamé.

La médiane de Max audible (≈ 4,1 s) ne peut plus baisser que par ces quatre leviers ; aucun n'est sans contrepartie. Le plus sûr
est le premier (contexte), le plus gros le LLM streamé, le seul spécifique à Tavus l'attente vidéo.
