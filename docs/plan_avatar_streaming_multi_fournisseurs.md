# Plan — avatars streaming : Anam, LemonSlice et réglages API complets

Date : 2 novembre 2026. Demande d'Ulrich : ajouter [Anam](https://lab.anam.ai/) et
[LemonSlice](https://lemonslice.com/) à côté de Tavus et HeyGen, et exposer pour les quatre
services tous les réglages qui pilotent l'avatar par l'API.

Diagnostic en lecture seule (code + documentation officielle des quatre services, consultée le
2 novembre 2026). Aucun code modifié.

## 1. Existant

- Socle propre et extensible : `ResponseOutput` (`src/services/streamingAvatar/types.ts`),
  registre de fabriques (`registry.ts`), un fichier par fournisseur (`providers/heygen.ts`,
  `providers/tavus.ts`), commandes isolées (`protocolCommands.ts`).
- Une seule Edge Function `streaming-avatar-session` : `start`/`end`, liaison à la session Ava
  (`sessions.streaming_avatar_provider`, `streaming_avatar_session_id`), sondes admin, secrets
  `LIVEAVATAR_API_KEY` et `TAVUS_API_KEY`. Le type `Provider` y est fermé à `heygen | tavus`.
- Réglages dans `admin_settings` (`ava_streaming_avatar_settings`, par environnement),
  normalisés par `normalizeStreamingAvatarSettings` ; aucune migration nécessaire pour ajouter
  des champs (JSON). Admin : `StreamingAvatarConfigTab.tsx` + `StreamingAvatarTestPanel.tsx`.
- Principe à garder : **Ava garde son micro, son STT et son LLM**. L'avatar ne fait que dire le
  texte d'Ava (HeyGen `avatar.speak_text`, Tavus `conversation.echo` en mode Echo).
- Réglages exposés aujourd'hui : HeyGen 6 (avatar, voix, contexte, langue, qualité, sandbox),
  Tavus 5 (face, PAL, langue, durée max, émotion).

## 2. Deux familles de fournisseurs

| Famille | Fournisseurs | Ava envoie | Voix |
|---|---|---|---|
| Texte → avatar | HeyGen, Tavus, Anam (`talk`) | le texte de la réplique | TTS du fournisseur |
| Audio → avatar | LemonSlice, Anam (passthrough) | l'audio PCM produit par le TTS d'Ava | **voix des personnages d'Ava** (ElevenLabs, Gradium…) |

`proxy-tts` accepte déjà `outputFormat` (ElevenLabs `pcm_16000`/`pcm_24000`) et Gradium sort du
`pcm_24000` : la famille audio peut réutiliser les voix de Max et Emma, ce que ne permet aucun
des deux fournisseurs actuels sans recréer la voix chez eux.

## 3. Inventaire des réglages API pertinents

Hors périmètre partout : LLM, STT, perception, outils, mémoire et RAG des fournisseurs (Ava les
porte), enregistrement vers nos buckets, intégrations Zoom/Meet/Agora.

### HeyGen LiveAvatar (FULL, `POST /v1/sessions/token`)

Manquent aujourd'hui :
- `video_settings.quality` : ajouter `very_high` ; `video_settings.encoding` `VP8 | H264`.
- `max_session_duration` (s, plafonné par l'offre).
- `avatar_persona.voice_settings`, par moteur :
  ElevenLabs (`model` flash v2.5, multilingual v2, v3, v3 conversational, v4 turbo ; `speed`
  0,8–1,2 ; `stability`, `similarity_boost`, `style` 0–1 ; `use_speaker_boost`) — v3 conv. et
  v4 turbo ne lisent que `stability` ; Fish (`model`, `speed`, `latency_mode`) ; Cartesia
  (`model` sonic, `speed` 0,6–1,5).
- Commandes en cours de session : `avatar.interrupt` (déjà utilisable pour l'interruption),
  `avatar.start_listening` / `stop_listening` (posture d'écoute pendant que le joueur parle).
- Pas de contrôle d'émotion faciale documenté (inchangé).

### Tavus (`POST /v2/conversations`, PAL en mode Echo)

Manquent aujourd'hui :
- `properties.languages` (tableau ; `language` est déprécié et encore envoyé par le code).
- `properties.participant_absent_timeout`, `participant_left_timeout` (codés en dur 120/30).
- `properties.enable_closed_captions`, `apply_greenscreen` (sans effet sur Phoenix-4.5),
  `test_mode` (création sans démarrage, utile au panneau de test).
- `policy: "eu"` (réglages `auto` résolus selon l'AI Act).
- En session : `conversation.interrupt` ; `conversation.set_emotion` déjà fait ; balise d'émotion
  Echo déjà faite.
- Voix : portée par le **PAL** (`layers.tts` : `tts_engine` tavus-auto/cartesia/elevenlabs,
  `voice_id` ou `external_voice_id`, `tts_model_name`, `voice_settings` speed, stability,
  similarity_boost, style, use_speaker_boost ; Cartesia speed/emotion). Ces réglages ne se
  passent pas par conversation : les modifier = mettre à jour le PAL (global à ce PAL). Décision
  D3.

### Anam (`POST /v1/auth/session-token`, SDK `@anam-ai/js-sdk`)

Forcés par Ava : `llmId: "CUSTOMER_CLIENT_V1"` (LLM Anam coupé), `skipGreeting: true`, micro
désactivé côté SDK. Réglables :
- `avatarId`, `avatarModel` (`cara-3`, `cara-4`, `cara-4.1-express`, `cara-4-latest`), `voiceId`,
  `languageCode`, `maxSessionLengthSeconds`.
- `directorNotes` (Cara 4) : `presetStyle` (neutral, happy, warm, playful, supportive, **sad**,
  angry, **distressed**) **ou** `customStylePrompt` (2 000 car.) + `customIdlingStylePrompt`
  (attitude au repos) ; `expressivity` 0–1. Balises de jeu en tête de réplique : `[sad]`,
  `[distressed]`, `[concerned]`… (équivalent de la balise Echo de Tavus) — levier direct contre le
  sourire, pertinent pour Max.
- `voiceGenerationOptions` selon la voix : ElevenLabs (stability, similarityBoost, style,
  useSpeakerBoost, speed 0,7–1,2, model), Cartesia Sonic-3 (volume, speed, emotion neutral/calm/
  angry/content/sad/scared), Fish (volume, speed) ; modifiables en session par
  `sendDataMessage({ message_type: "persona_config" })`.
- `sessionOptions` : `videoQuality` (high/auto), `region` (eu/us) + `regionPolicy`,
  `videoWidth`/`videoHeight`, `dataRetention` (recording, transcripts), `showAIAvatarDisclosure`.
- Pilotage : `talk()` / `createTalkMessageStream()` ; fin de parole et interruption à vérifier
  dans le SDK au lot (événements de flux, `interruptPersona()`).
- Mode passthrough (`enableAudioPassthrough`) : `createAgentAudioInputStream`, `sendAudioChunk`
  (PCM16 mono, 24 kHz natif), `endSequence`, `interruptPersona` ; 480 ms d'audio tamponnés avant
  la première image. Décision D2.

### LemonSlice (`POST /api/liveai/sessions`, audio → avatar)

LemonSlice n'a ni LLM ni TTS dans l'API temps réel : il anime une image à partir de l'audio
qu'on lui envoie.
- Transport retenu pour Ava : `websocket-daily` (ou `websocket-livekit`). Le navigateur envoie
  `audio` (PCM16 base64, 16 kHz, morceaux de 80–100 ms), `audio_end`, `interrupt`, `heartbeat`,
  `terminate` ; reçoit `playback_finished`. **La vidéo est publiée dans une salle Daily ou
  LiveKit qu'il faut fournir** (URL + jeton) : Ava n'en possède pas aujourd'hui (les salles Tavus
  sont créées par Tavus). Décision D1.
- Réglages : `agent_id` **ou** `agent_image_url` (368×560), `model` (défaut, `flash`, `pro`,
  `cwm-1`, `cwm-1-lite`, `cartoon` ; CWM-1 : offre Ultra/Entreprise), `agent_prompt` (attitude en
  parlant), `agent_idle_prompt` (au repos), `idle_timeout`, `response_done_timeout`,
  `audio_sample_rate` (16 000/24 000), `aspect_ratio` (2x3, 9x16, 1x1), `edit_image` +
  `edit_image_variant` (standing, bust, sitting, portrait).
- En session (`/control`) : `update-agent-prompt`, `update-idle-prompt`, `update-image`,
  `action` (CWM-1 : 43 gestes, dont `listen`, `deep_breath`, `rub_eye`, `glance_down`…),
  `terminate`.
- Sécurité : l'adresse WebSocket n'a pas d'authentification propre (capacité portée par l'URL) ;
  la clé `LEMONSLICE_API_KEY` reste dans l'Edge Function ; l'adresse n'est jamais journalisée.

## 4. Décisions d'Ulrich (avant AV2/AV3, pas avant AV1)

- **D1 — salle vidéo LemonSlice** : (a) compte Daily, secret `DAILY_API_KEY`, salle privée créée
  par l'Edge Function — recommandé, `@daily-co/daily-js` est déjà utilisé pour Tavus ;
  (b) LiveKit Cloud (nouveau SDK) ; (c) écarter LemonSlice.
- **D2 — voix Anam** : (a) `talk` avec une voix Anam/ElevenLabs choisie chez Anam (simple, comme
  Tavus) ; (b) passthrough avec la voix du personnage d'Ava (cohérent avec la voix du jeu, plus de
  latence et de code partagé avec LemonSlice). Recommandé : (a) en AV2, (b) en option après AV3
  qui construit le pont audio.
- **D3 — voix Tavus** : autoriser l'admin à modifier le PAL (`PATCH /v2/pals/{id}`, effet global
  sur ce PAL) ou rester en lecture seule avec lien vers le tableau de bord Tavus. Recommandé :
  lecture + affichage des réglages effectifs, écriture seulement sur confirmation explicite.
- **Comptes et secrets** : `ANAM_API_KEY`, `LEMONSLICE_API_KEY` (et `DAILY_API_KEY` si D1a) à
  saisir par Ulrich dans les secrets Lovable Cloud ; une action à la fois au moment du lot.

## 5. Lots

- **AV1 — socle multi-fournisseurs et réglages complets HeyGen + Tavus.** Type fournisseur
  ouvert à `anam | lemonslice` sans les activer ; réglages par fournisseur dans le même JSON
  (normalisation tolérante, anciens réglages relus sans perte) ; liste blanche stricte de chaque
  champ dans l'Edge Function ; admin par fournisseur : « Essentiel » + « Avancé » repliable, avec
  bornes et aide courte ; Tavus `languages`, timeouts, sous-titres, greenscreen, `test_mode`,
  `policy`, `conversation.interrupt` ; HeyGen `very_high`, encodage, durée max, `voice_settings`
  par moteur, `avatar.interrupt`, écoute. Aucun secret, aucune migration.
- **AV2 — Anam en mode texte.** SDK, jeton de session côté Edge Function (`ANAM_API_KEY`), fournisseur
  `providers/anam.ts`, Director Notes + balise de jeu par réplique (défaut `sad` pour Max et Emma,
  même logique que l'émotion Tavus), `voiceGenerationOptions`, `sessionOptions`, sonde admin,
  panneau de test. Recette humaine : aucun sourire, synchro labiale en français.
- **AV3 — LemonSlice en mode audio.** Selon D1 : salle Daily, pont audio TTS d'Ava → PCM16 16 kHz
  → WebSocket, `audio_end` par réplique, `interrupt`, `playback_finished` comme fin de réplique,
  prompts parler/repos, actions CWM-1 si l'offre le permet. Recette humaine avec la voix de Max.
- **AV4 (option) — Anam passthrough** sur le pont audio d'AV3, si D2b.

## 6. Non-régression

Sortie TTS locale, repli TTS quand l'avatar échoue, mains libres, interruption joueur, liaison
session/ownership de l'Edge Function, émotion Tavus tenue (lots #137–#139), micro jamais publié
vers un fournisseur, aucune URL de salle, jeton ou texte prononcé dans les diagnostics.

## Exécution AV1 — 2 novembre 2026

Branche `feat/avatar-streaming-av1`, depuis main `91ccff5` (PR #140, émotion d'écoute Tavus
séparée, fusionnée avant le lot avec l'accord d'Ulrich : elle touchait les mêmes fichiers).

- **Socle.** Module pur partagé `supabase/functions/_shared/streamingAvatarRequest.ts`, lu par
  l'Edge Function et par le client : liste des fournisseurs connus (`heygen | tavus | anam |
  lemonslice`), fournisseurs sélectionnables (`heygen | tavus`), listes de valeurs, bornes, et
  construction des corps HeyGen et Tavus. Côté client, `StreamingAvatarProviderId` reste
  `heygen | tavus` ; `KnownStreamingAvatarProviderId` couvre les quatre. Un réglage enregistré
  avec `anam` ou `lemonslice` retombe sur HeyGen ; l'Edge Function les refuse (400). Aucune
  fabrique, aucun secret.
- **Normalisation tolérante.** Même JSON `ava_streaming_avatar_settings`. Ancien Tavus
  `language: "French"` → `languages: ["fr"]` ; nouveaux champs à leur défaut ; valeur inconnue
  ou hors bornes → défaut (elle n'est plus ramenée à la borne). Aucune migration.
- **Liste blanche Edge.** Seuls les champs construits par le module partent chez le
  fournisseur ; `interactivity_type` (PUSH_TO_TALK), `mode` (FULL), `require_auth`,
  `max_participants` restent forcés ; un `callback_url`, `custom_greeting`, `llm_configuration_id`
  ou `enable_recording` envoyé par le client est ignoré (tests).
- **HeyGen.** `quality` + `very_high`, `encoding` H264/VP8, `max_session_duration` (0 = limite de
  l'offre, sinon 60–3 600), `avatar_persona.voice_settings` par moteur : défaut (rien envoyé,
  comportement actuel), ElevenLabs (Flash v2.5 et Multilingual v2 : tous les champs ; v3,
  v3 conversationnel, v4 Turbo : `stability` seule, conformément à la doc LiveAvatar), Fish
  (`model`, `speed`, `latency_mode`), Cartesia (`model`, `speed`). `avatar.interrupt` était déjà
  envoyé par `session.interrupt()` du SDK. **Écoute :** le SDK 0.0.19 expose
  `startListening()`/`stopListening()` (`avatar.start_listening`/`stop_listening`) ; la page de
  jeu les appelle quand l'état audio passe à `user_speaking`/`user_finalizing`, et l'avatar
  repasse hors écoute avant chaque réplique. Posture seulement : le chat vocal du SDK reste muet,
  aucun son du micro n'est publié.
- **Tavus.** `properties.languages` (défaut `["fr"]`, `language` déprécié n'est plus envoyé),
  `participant_absent_timeout` (10–3 600, défaut 120) et `participant_left_timeout` (0–3 600,
  défaut 30) réglables, `enable_closed_captions`, `apply_greenscreen`, `policy: "eu"` envoyés
  seulement s'ils sont activés. `conversation.interrupt` passe par
  `buildTavusInterruptCommand`. **`test_mode` :** action admin `check` (bouton « Vérifier » de
  l'onglet Tavus, bloc Avancé) : conversation créée déjà terminée, le PAL ne rejoint pas, aucune
  salle ni liaison de session ; affiche la voix du PAL (`layers.tts`) en lecture seule. D3 non
  tranchée : aucune écriture du PAL.
- **Admin.** Par fournisseur, bloc « Essentiel » puis « Avancé » repliable ; bornes et aide d'une
  ligne sous chaque champ ; les champs ElevenLabs non lus par le modèle choisi sont désactivés
  (« Non lu par ce modèle : non envoyé »).
- **Tests.** `streamingAvatarRequest.test.ts` (17 : corps HeyGen/Tavus, bornes, champs non
  supportés jamais envoyés, liste blanche, voix du PAL), `settings.test.ts` (5 : anciens JSON,
  bornes, valeurs inconnues, fournisseurs non sélectionnables), commandes `interrupt` et écoute
  (`protocolCommands.test.ts`, `tavus.test.ts`). Qualité locale : 74 régressions, 1 339
  unitaires, 42 intégrations, lint, typage, build ; 35 tests de livraison.
- **Non vérifié localement.** Deno absent du poste : l'Edge Function n'a pas été vérifiée par
  `deno check` (le module partagé passe le typage strict) ; aucun appel réel HeyGen ni Tavus.
  Déploiement de l'Edge Function par Lovable seulement, puis recette humaine d'Ulrich : une
  session HeyGen et une Tavus en sandbox avec un réglage avancé changé, et une interruption en
  cours de réplique.

Suite : [prompt AV2 « Anam en mode texte »](prompt_reprise_avatar_streaming_lot_av2.md).

## Exécution AV2 — 2 novembre 2026

Branche `feat/avatar-streaming-av2`, depuis main `a939b35` (PR #141). D2 : option (a), `talk`
avec une voix choisie chez Anam (recommandation, aucune décision contraire d'Ulrich).

- **Écart découvert et tranché.** La base Lovable (lecture `pg_constraint` par le MCP Ava)
  limitait `sessions.streaming_avatar_provider` à `heygen | tavus` : une session Anam ne pouvait
  être ni créée ni liée. Ulrich a choisi la migration minimale
  `20261102120000_streaming_avatar_provider_anam.sql` (contrainte élargie à `anam` et
  `lemonslice`, aucune donnée touchée). Elle doit être appliquée par Lovable avant de
  sélectionner Anam.
- **SDK.** `@anam-ai/js-sdk` 4.29.1, dernière version publiée depuis au moins deux semaines
  (19 octobre 2026), noms vérifiés dans le paquet installé et la doc : `createClient(token,
  { disableInputAudio })`, `stream()`, `createTalkMessageStream()` / `streamMessageChunk`,
  `interruptPersona()`, événements `MESSAGE_STREAM_EVENT_RECEIVED` (`role`, `endOfSpeech`,
  `interrupted`), `TALK_STREAM_INTERRUPTED`, `MESSAGE_DELIVERY_FAILED`, `CONNECTION_CLOSED`.
  Télémétrie client Anam coupée (`disableClientMetrics`).
- **Parole.** Une talk stream par réplique ; découpage `splitAvatarText` inchangé, balise de jeu
  sur le premier morceau. Début de parole = première transcription du persona, fin = `endOfSpeech`
  (Anam diffuse ces transcriptions au rythme de la parole ; à confirmer à la recette). Pas de
  posture d'écoute à piloter : l'attitude au repos vient des Director Notes.
- **Émotion.** Défaut pour Max et Emma, comme Tavus (#137–#140) : style personnalisé abattu en
  parlant, attitude fermée au repos (`customIdlingStylePrompt`), expressivité 0,4, balise `[sad]`
  par réplique. Anam interdit de combiner `presetStyle` et prompt personnalisé : en mode préréglé,
  aucune attitude au repos n'est envoyée. Cara 3 ne reçoit aucune Director Note.
- **Voix.** `voiceGenerationOptions` selon le moteur déclaré dans l'admin : ElevenLabs v2
  (tous les champs), v3 (stabilité), v4 (stabilité, similarité) ; Cartesia (volume, vitesse,
  émotion, défaut `sad`) ; Fish (volume, vitesse). « Réglages de la voix dans Anam » n'envoie rien.
- **Session.** `videoQuality`, `region` + `regionPolicy` (politique envoyée seulement avec une
  région), `dataRetention` enregistrement et transcriptions désactivés par défaut.
- **Edge Function.** `startAnam`, liaison et fin comme HeyGen/Tavus (fin : aucun appel Anam, le
  client ferme le flux et le jeton est à usage unique), `configured.anam`, sonde `probe=1`,
  action admin `check`. Le jeton n'apparaît dans aucun journal.
- **Tests.** Corps de session (forçages, liste blanche, UUID, Director Notes, voix par modèle,
  région), réglages anciens relus sans perte, cycle de vie avec SDK simulé (micro jamais ouvert,
  pistes audio + vidéo, balise, fin de parole, interruption, échec de remise, déconnexion, lecture
  bloquée). Qualité locale : 74 régressions, 1 357 unitaires, 42 intégrations, lint, typage,
  build ; 35 tests de livraison.
- **Non vérifié localement.** Deno absent : Edge Function non passée à `deno check` ; aucun appel
  réel à Anam. À faire : secret `ANAM_API_KEY` (Ulrich), application de la migration et
  déploiement de l'Edge Function par Lovable, puis recette d'Ulrich : session Anam en français,
  synchro labiale, aucun sourire, interruption en cours de réplique, repli TTS si Anam échoue.

Suite : [prompt AV3 « LemonSlice en mode audio »](prompt_reprise_avatar_streaming_lot_av3.md).
