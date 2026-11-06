# Plan — Tavus parle avec la voix d'Ava (audio Echo)

Date : 6 novembre 2026. Solution B validée par Ulrich le 6 novembre 2026. Base : main `398768d`.

## Problème

Ava rend Tavus en Echo texte avec le PAL générique `pipecat0` : Tavus lit le texte avec sa voix
par défaut, d'où une diction française très mauvaise. Réglages lus dans Lovable `admin_settings`
(`ava_streaming_avatar_settings.tavus`) : `personaId: "pipecat0"`, `languages: ["fr"]`,
`emotion: "sadness"`, `echoEmotion: "dejected"`, `listeningEmotion: "neutral"`. Le Face lu lors de
l'essai réel était `r22b10d8b6eb`. Voix des personnages : Max ElevenLabs `VK9GO2Vntd9rcY7Tg6wl`,
Emma `VvTt1bgOXY0tQvrcSwqN`, moteur `eleven_v4_turbo`, fr.

Solution A écartée par Ulrich : un PAL Echo réglé sur ElevenLabs chez Tavus figerait les réglages
de voix chez Tavus, avec un PAL par voix. Il veut tout piloter depuis Ava, personnage par personnage.

## Décision

En mode Tavus, Ava synthétise chaque réplique avec son propre TTS (voix du personnage, moteur et
réglages actifs) et l'envoie à Tavus par `conversation.echo` audio. Tavus n'anime plus que le visage
et les lèvres (doc Tavus : l'audio Echo contourne toutes les couches sauf la Realtime Replica
Layer). Le même pont audio que LemonSlice (D3/AV3 du
[plan multi-fournisseurs](plan_avatar_streaming_multi_fournisseurs.md)) est partagé, pas dupliqué.
Nouveau réglage « Source de la voix : Ava (audio) / Tavus (PAL) », défaut Ava, surchargeable pour
Max et Emma ; la voie texte reste disponible.

## Étape 1 — essai réel du format (6 novembre 2026)

Conversation réelle, PAL `pipecat0` (`pipeline_mode: echo`), ouverte par l'Edge Function
`streaming-avatar-session` (session privée de test, comme « Tester l'avatar »), salle Daily rejointe
en réception seule depuis une page de sonde locale non versionnée, audio TTS ElevenLabs de Max.
Conversations `c1a340a8922b04b7`, `c2f0bb006362d433`, `cfcb52ddf46b04b9`, toutes fermées
(`end_conversation_endpoint_hit`), aucune conversation active restante.

| Question | Constat |
| --- | --- |
| Audio Echo accepté ? | Oui. `modality: "audio"`, `audio` = PCM16 little-endian mono en base64, `sample_rate` 24000 (16000 aussi accepté). |
| Voix entendue | L'audio envoyé, sur la piste audio de la salle (durées identiques à l'envoi). Aucune `conversation.utterance` pour l'audio. |
| Taille des messages | Un seul message de 364 Ko accepté ; morceaux de 100, 250 et 500 ms acceptés. |
| Délai avant le premier son | ≈ 1,2 s pour un message unique ; ≈ 0,6 s par morceaux (250/500 ms). Retenu : 250 ms. |
| `inference_id` / `done` | Morceaux d'une réplique sous un même `inference_id`, `done: true` sur le dernier. |
| Événements de parole | `conversation.started_speaking` / `stopped_speaking` arrivent (rôles `replica` et `pal`, plus des variantes `conversation.replica.*` / `pal.*`). Le stop porte `duration` et `interrupted`. |
| Fin de réplique | **Tavus émet `stopped_speaking` dès que sa file audio est vide, même avec `done: false`** ; un nouvel envoi relance `started_speaking` (~0,65 s). |
| Interruption | `conversation.interrupt` coupe l'audio en ≈ 0,45 s ; `stopped_speaking {interrupted: true}` suit ; la réplique suivante part propre. |
| Synchro labiale | Mouvement de la zone bouche ×3,5 pendant l'audio par rapport au silence (différence d'images). Jugement visuel humain à faire en recette. |
| `set_emotion` pendant l'audio | Accepté (aucune erreur) ; rendu visuel à juger en recette. |

Constat annexe, non corrigé ici : en Echo texte, `conversation.utterance` porte `properties.speech`
et non `text`, donc la télémétrie « transcript mismatch » de la voie texte ne reçoit rien.

## Étapes 2 à 4 — réalisation

- `src/services/streamingAvatar/avatarAudioBridge.ts` : pont commun extrait de LemonSlice
  (segmentation `chunkTextForTTS`, `generateSpeech` avec voix/moteur/intention du tour, décodage
  PCM brut ou conteneur, rééchantillonnage, morceaux, un segment d'avance, abandon sur
  interruption, échéance du premier segment). LemonSlice l'utilise sans changement de comportement.
- `providers/tavus.ts` : `renderText` choisit la voie selon `voiceSource` du personnage actif.
  Voie « Ava » : émotion de la réplique → morceaux audio 24 kHz/250 ms (`buildTavusEchoAudioCommand`)
  → début au premier `started_speaking` → fin seulement après le dernier morceau **et** quand
  l'audio envoyé a eu le temps d'être joué (tolérance 400 ms, pauses déduites) ; un stop plus tôt
  est une pause entre segments ; un stop `interrupted: true` est ignoré ; fin de secours 4 s après
  la durée attendue si aucun stop n'arrive. Repli TTS local (`AvatarRenderError(started: false)`) si
  le TTS échoue avant le premier morceau ou si Tavus ne commence pas à parler dans le délai (l'audio
  en file est alors coupé par `conversation.interrupt`). Interruption joueur : TTS en vol abandonné +
  `conversation.interrupt`. Télémétrie : premier son = premier `started_speaking`, durée, segments.
- `tavusEmotionCues.ts` : intention de jeu canonique → `set_emotion` (neutral → émotion réglée du
  personnage, tense/scared/urgent → fear, angry/accusatory → anger, sad/fragile → sadness,
  warm → neutral, sarcastic → contempt ; jamais `happiness`). Envoyée avant le premier morceau,
  l'émotion d'écoute revient à la fin. Tracée par réplique (`avatar_cue`, provider `tavus`) dans
  Admin → Sessions. La balise Echo texte ne s'applique pas à l'audio.
- Réglages : `TavusAvatarSettings.voiceSource` et `TavusCharacterOverride.voiceSource`
  (`ava` | `tavus`), défaut `ava` ; un ancien JSON sans le champ est relu sans perte et passe en
  voix Ava. Admin : sélecteur global et par personnage (vide = global).
- Rien à déployer côté Edge Function ni base : même PAL Echo, même création de conversation.

## Validations

- Tests : `tavusAudio.test.ts` (commandes audio, découpage, `done`, cycle de vie, pauses, stop
  tardif, fin de secours, émotion avant l'audio, replis, interruption, voix par personnage),
  `tavusEmotionCues.test.ts`, `settings.test.ts` (anciens JSON, surcharges), `protocolCommands.test.ts`.
  Tests Tavus texte et LemonSlice inchangés et verts.
- Essai réel de l'adaptateur final (conversation `cfcb52ddf46b04b9`, voix de Max) : réplique
  courte, premier son 1,4 s TTS compris ; réplique de 330 caractères, premier son 1,9 s, fin sur le
  vrai `stopped_speaking` (Tavus 25,95 s / audio envoyé 25,68 s) ; réplique de 1 050 caractères en
  2 segments, aucune pause entre eux, fin exacte (86,7 s / 85,8 s) mais premier son 3,7 s (premier
  segment ElevenLabs de ~600 caractères) ; interruption : réplique close aussitôt côté Ava, silence
  côté Tavus en ≈ 0,45 s.

## Recette humaine (Ulrich)

1. Après fusion et synchronisation Lovable, ouvrir l'admin → Avatar streaming → Tavus : « Source de
   la voix » = Ava (audio) en global, Max et Emma sur « Global ». Sauvegarder si besoin.
2. Panneau « Tester l'avatar » puis session réelle avec Max en Tavus : la voix doit être celle de
   Max (ElevenLabs), plus la voix Tavus.
3. Synchro labiale : lèvres calées sur la voix, pas de décalage perceptible, pas de bouche figée.
4. Émotion : une réplique tendue ou en colère doit montrer un visage cohérent (peur, colère), une
   réplique triste un visage triste ; trajectoire visible dans Admin → Sessions (« Émotion du visage (Tavus) »).
5. Interruption : parler pendant que Max parle ; il doit se taire vite et la réplique suivante doit
   partir propre.
6. Latence : comparer le délai avant le premier mot à la voie texte (« Tavus (PAL) » sur Max, même
   question). Attendu : voie audio ≈ TTS Ava + 0,6 s ; les très longues répliques démarrent plus tard
   (premier segment long).

Si la latence des longues répliques gêne : un premier segment plus court (comme Gradium, 320
caractères) pour les avatars audio est le levier identifié ; à décider après recette.

## Suite

Aucun nouveau lot de code. La recette ci-dessus est intégrée au
[prompt du lot 4 Tavus](prompt_reprise_tavus_face_emotion_lot_4.md) (recette réelle Tavus).
