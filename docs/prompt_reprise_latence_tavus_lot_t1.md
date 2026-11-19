# Prompt de reprise — Latence Tavus, lot T1 (flux ElevenLabs PCM vers Tavus)

À copier dans un nouveau chat Ava. Analyse et plan : [analyse du 19 novembre](analyse_latence_tavus_20261119.md).

---

Objectif : réduire d'environ 1,2 à 1,8 s le délai de réponse de Max en vidéo Tavus « voix d'Ava », en envoyant à Tavus
l'audio ElevenLabs de la première ligne au fil de l'eau au lieu d'attendre le blob complet. Voix, texte, segmentation,
GM et réglages inchangés.

État vérifié (19 novembre 2026, `voice_turn_events` et `llm_usage` lus via Lovable Cloud) :
- Sessions Tavus de sandbox-ulrich `3251b70f…` et `c25ce8ce…` : Max audible à 5,4–6,0 s (médiane), dont attente vidéo
  2,2–2,6 s. Anam et TTS : 3,5–3,8 s.
- Lots GM A/C/B/D/E1 du 19 novembre : aucune latence ajoutée (TTS 3,66–3,76 s avant/après, prompt de Max 2,6–3,9 k
  tokens stable, GM post-tour hors du chemin critique).
- Cause : depuis #161 (6 novembre), `renderAvaAudio` (`src/services/streamingAvatar/providers/tavus.ts`) →
  `streamAvatarSpeech` (`src/services/streamingAvatar/avatarAudioBridge.ts`) → `generateSpeech` attend le blob complet
  ElevenLabs (1,6–2,2 s), puis Tavus démarre en 0,5–0,65 s. En TTS seul, le premier morceau arrive en ~0,3 s
  (`src/services/tts/elevenLabsStreamPlayer.ts`) ; `proxy-tts` relaie déjà `/stream` en morceaux.

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le
début du CHANGELOG, l'analyse ci-dessus, `avatarAudioBridge.ts`, `providers/tavus.ts`, `protocolCommands.ts`
(`TAVUS_ECHO_AUDIO_SAMPLE_RATE` 24 000, `TAVUS_ECHO_AUDIO_CHUNK_MS` 250), `src/services/tts/providers/elevenlabs.ts`
(`buildElevenLabsRequest`, `requestElevenLabsSpeech`), `supabase/functions/proxy-tts`, `IndexPRD4.tsx:1755-1785`.

Périmètre :
1. Première ligne ElevenLabs en flux : format forcé `pcm_24000`, lecture de `response.body`, morceaux PCM16 de 250 ms
   envoyés dès réception (octet impair conservé entre lectures), `final` sur le dernier. Lignes suivantes : chemin
   actuel préchargé (ou flux si simple).
2. Repli : échec avant le premier octet → `generateSpeech` actuel ; échec après envoi → comportement actuel
   (`sendInterrupt`, `AvatarRenderError`) ; abort du fetch au barge-in ; `avatarTtsDeadline` sur le premier morceau.
   Gradium, Anam, LemonSlice inchangés.
3. Vérifier que `proxy-tts` accepte `pcm_24000` sur `/stream` (sinon ajout minimal, redéployé par Lovable) et que
   `first_audio_chunk` est émis sur ce chemin.
4. Span client `pre_turn_handoff_wait` autour de l'attente de passage (`IndexPRD4.tsx` ~1762-1781) : 2 tours sur 9
   démarraient ~0,9 s plus tard, cause à confirmer.

Limites : pas de LLM streamé, pas de changement de première phrase, pas de retour à la voix Tavus, aucun réglage GM,
aucune migration, production non publiée, base Caractères Notion en lecture seule.

Validations : tests unitaires (découpage 250 ms aux frontières impaires, premier envoi avant la fin du corps, repli blob,
abort pendant le flux, `final`, autres fournisseurs inchangés), typecheck, lint, tests de garde, CI `regression-gates`
verte sur le HEAD exact. Après fusion et synchro Lovable : une session Tavus sandbox-ulrich, puis requête
`voice_turn_events` : `video_wait_ms` médian < 1,2 s, `output_estimated` < 4,5 s, aucun repli TTS local de plus ;
écoute d'Ulrich (lèvres, pas de coupure). Compléter l'analyse avec ces mesures.

Livraison : branche de lot depuis main à jour, commit, push, PR, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`,
vérification sur origin/main, sync locale et Lovable ; STORY/CHANGELOG/HANDOFF/`docs/etat_courant.md`. Avant push,
écrire le prompt de reprise du lot T2 (attente de passage, interruptions répétées pendant l'attente, LLM streamé à
évaluer), avec cette même obligation de clôture.
