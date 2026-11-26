# Prompt de reprise — Latence conversationnelle, lot 1 (voix seule : supprimer les 2 s entre la réponse et le premier son)

À copier dans un nouveau chat Ava. Plan : [plan_latence_conversationnelle_llm_tts.md](plan_latence_conversationnelle_llm_tts.md). Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

---

Objectif : en sortie voix seule (sans vidéo), faire partir la première phrase du personnage en flux dès que la réponse est prête, pour ramener l'écart « réponse prête → premier son » de ≈ 2,0 s à ≤ 0,6 s. Le texte, la voix (ElevenLabs `eleven_v4_turbo`), la segmentation, le GM et la mémoire restent inchangés. Ce lot seulement ; ne pas commencer le lot 2.

État vérifié (26 novembre 2026, `voice_turn_events`, 7 jours, tours complétés, médianes depuis le transcript final) :
- Voix seule, 120 tours : RAG 0,71 s, LLM `gpt-5.6-luna` 2,06 s, réponse prête 3,27 s, **premier son 5,26 s** (p90 6,46 s). Écart réponse prête → premier son : **2,04 s**.
- Tavus, 113 tours : réponse prête 3,24 s, premier son 3,96 s. La première ligne part en flux PCM (`elevenLabsPcmStream.ts`, lot T1), avec ≈ 0,35 s jusqu'aux premiers octets.
- La voix seule est donc plus lente que la vidéo. Hypothèse à vérifier : blob REST complet, ou réponse entière (jusqu'à 900 car., `SINGLE_REQUEST_MAX_CHARS`) synthétisée en une requête avant la lecture, ou repli MediaSource.
- main au moment du plan : `a2ca9f3b` + le commit de ce plan. Vérifier `git log origin/main` avant de commencer.

Première action exécutable :
1. Lire en SQL, en lecture seule (MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`), les `milestones` des tours voix seule récents : `tts_text_sent`, `first_audio_chunk`, `audio_blob_ready`, `audio_scheduled`, `output_estimated`, ainsi que la longueur de réponse. Le but est de situer les 2 s.
2. Suivre le chemin réellement pris : `LocalTTSOutput.renderText` (`src/services/streamingAvatar/localTtsOutput.ts`) → `chunkTextForTTS` (`src/services/tts/textChunking.ts`) → `TTSQueue` (`src/services/tts/queue.ts`) → `generateSpeech` / `tryCreateStreamingPlayback` (`src/services/tts/index.ts`) → `elevenLabsStreamPlayer.ts`.

Périmètre :
- Première ligne en flux. Réutiliser le flux PCM de T1 (`elevenLabsPcmStream.ts`, `pcm_24000`) ou le flux MP3 MediaSource existant ; ne pas créer un troisième mécanisme.
- Première tranche courte, une phrase complète, via `chunkTextForTTS` ; les lignes suivantes sont préchargées.
- Repli sur le chemin actuel si le flux échoue avant le premier octet. `abort` du fetch sur interruption ou barge-in. Délai de premier son respecté.
- Instrumentation : `first_audio_chunk` émis sur ce chemin pour que la mesure apparaisse dans Qualité › Latence.
- Hors périmètre : changement de modèle LLM, LLM streamé (lot 4), Gradium, Cartesia, Inworld, Fish, Tavus, Anam (inchangés), fin de parole STT (lot 5).

Invariants : interruption intacte (stratégie « texte », `interruptCharacter`, `TTSQueue.cancel`), pas de coupure ni d'artefact entre phrases, passage de personnage et cinématiques inchangés (invariants de fin d'AGENTS). Une recherche du runtime de parole qui échoue ne doit jamais rendre un personnage muet. Production non publiée. Base Caractères Notion en lecture seule. Gami DigiDouble exclu. Aucune migration.

Validations :
- Tests ciblés : flux et repli avant premier octet, interruption pendant le flux, ordre des lignes, autres fournisseurs inchangés (`tts/queue.test.ts`, `tts/elevenLabsStreamPlayer.test.ts`, `tts/textChunking.test.ts`, tests de `localTtsOutput`).
- `npm run typecheck`, lint, `npm run test:quality`, `npm run test:delivery` verts avant push ; CI de la PR verte avec `regression-gates`.
- Mesure après fusion et synchro Lovable (sandbox-ulrich, au moins 10 tours en voix seule, réalisés par Ulrich) : écart réponse prête → premier son ≤ 0,6 s, premier son médian ≤ 3,8 s, aucun repli supplémentaire. L'écoute d'Ulrich (pas de coupure entre phrases) est une recette humaine distincte de la livraison technique.

Livraison : branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, vérification sur origin/main (arbre et parent), suppression de notre branche, synchro locale et Lovable. Mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan (section lot 1 : mesures, statut).

Clôture obligatoire : avant le push, écrire `docs/prompt_reprise_latence_conversationnelle_lot_2.md` (banc d'essai LLM, section « Lot 2 » du plan) avec l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison et la première action exécutable, ainsi que cette même obligation de clôture. Donner le lien direct dans le compte rendu. Ne pas lancer le lot 2.
