# Plan — Tavus : entraîner le Face de Max par vidéo + expressivité par personnage

## Contexte

Max sourit encore à l'écran : un Face Tavus stock garde sa gestuelle propre. Ulrich veut
(1) entraîner un Face Tavus à partir d'une vidéo préparée (doc « video-to-face »), depuis
l'admin d'Ava, et l'attribuer à Max ; (2) régler l'expressivité (balise
`<emotion value="dejected"/>`, air sérieux sans sourire, y compris en écoute).

Constats qui orientent le plan :
- Le PAL Tavus est en `pipeline_mode: "echo"` : le LLM Tavus n'est jamais utilisé, Ava écrit
  chaque réplique. La consigne Tavus « demande à ton PAL de commencer par une balise » est donc
  **déjà appliquée de façon déterministe** par le code : `buildTavusEchoCommand`
  (`src/services/streamingAvatar/protocolCommands.ts:37`) préfixe chaque réplique, et
  `conversation.set_emotion` maintient l'émotion en parlant/écoutant
  (`providers/tavus.ts:117-155, 297`). Aucune consigne LLM à ajouter (et les prompts restent
  dans Notion).
- Limite actuelle : la balise Echo est dérivée du réglage `set_emotion` (8 valeurs, table
  `TAVUS_ECHO_EMOTION_TAGS`) ; on ne peut pas choisir directement parmi les 11 valeurs Echo
  (`dejected`, `content`, `excited`…). Réglages globaux, pas par personnage.
- Le Face ID (`tavus.replicaId`) est global dans `admin_settings` (`ava_streaming_avatar_settings`).
- Doc Tavus (lue le 5 nov. 2026) : `POST /v2/faces` (`face_name`, `model_name: "phoenix-4.5"`,
  `train_video_url` publique valable ≥ 24 h, pas de `consent_video_url`), suivi par
  `GET /v2/faces/{face_id}` (`status` started/completed/error, `training_progress`,
  `finetune_status`). Vidéo : mp4/webm, ≥ 1080p, ≥ 25 ips, ≤ 750 Mo, 30 s parlé puis 30 s
  immobile lèvres fermées. Phoenix‑4.5 : aperçu en minutes (filigrane), affinage quelques heures.
  Contrôle d'émotion : Phoenix‑4/4.5 seulement. Faces custom : plans Starter/Growth/Enterprise.

Choix validés par Ulrich : upload dans l'app **et** URL de secours ; Phoenix‑4.5 ; Face et
expressivité **par personnage**.

## Lots

### Lot 1 — Expressivité par personnage (front seul, aucune migration)
- `types.ts` / `settings.ts` : ajouter `TAVUS_ECHO_EMOTIONS` (11 valeurs Echo) et dans
  `tavus` : `echoEmotion` (défaut `dejected`) + `characters: Record<string, { faceId?,
  echoEmotion?, emotion?, listeningEmotion? }>` (surcharges, `max` pré-rempli vide).
  Normalisation rétrocompatible : `echoEmotion` absent → dérivé de `emotion` via
  `TAVUS_ECHO_EMOTION_TAGS` ; valeurs inconnues → défaut (réutiliser `pickEnum`).
- `protocolCommands.ts` : `buildTavusEchoCommand` reçoit directement la valeur Echo ;
  `EMOTION_TAG_PATTERN` déjà générique.
- `providers/tavus.ts` : résoudre `faceId`/émotions effectifs selon le personnage
  (`context.characterKey` des tours ; personnage actif à `prepare`). Helper pur
  `resolveTavusCharacterSettings(settings, characterKey)` dans `settings.ts`.
  Face fixé à la création de la conversation : si le personnage actif change et que son Face
  diffère, fermer puis recréer la conversation Tavus au changement (`IndexPRD4.tsx:952/1037`),
  sinon garder la conversation et n'appliquer que les émotions.
- Défense : `prepareTextForTTS` (`src/services/tts/textPrep.ts:13`) et le chemin sous-titres
  retirent `<emotion …/>` via `stripTavusEmotionTags` (aujourd'hui seul `>` est supprimé).
- Admin `TavusFields` (`StreamingAvatarConfigTab.tsx:341`) : sélecteur « Balise Echo en
  parlant » (11 valeurs, aide : « dejected supprime le mieux le sourire, peut paraître un peu
  triste »), puis bloc « Par personnage » (Max, Emma) : Face ID + 3 émotions, vide = global.
- Tests : `protocolCommands.test.ts`, `tavus.test.ts`, `settings.test.ts` (normalisation,
  résolution par personnage, rétrocompatibilité), test textPrep.

### Lot 2 — Backend d'entraînement (Edge + stockage)
- Migration (appliquée via le chat Lovable, cf. mémoire) : bucket privé
  `tavus-training-videos` (limite 750 Mo, types `video/mp4`, `video/webm`) + politiques
  admin-only calquées sur `20260807112433_…sql` (`private.has_role(auth.uid(),'admin')`).
- `supabase/functions/_shared/streamingAvatarRequest.ts` : builder pur
  `buildTavusFaceTrainingRequest({ faceName, storagePath?|videoUrl? })` → `face_name`,
  `model_name: "phoenix-4.5"`, `train_video_url` ; whitelist stricte (jamais `callback_url`,
  voix, `consent_video_url`), URL https obligatoire, nom borné ; + `normalizeTavusFace(json)`.
- `streaming-avatar-session/index.ts` : nouvelles actions admin (`requireAdmin`, comme `check`) :
  - `train-face` : si `storagePath`, vérifier préfixe du bucket, créer un lien signé 48 h
    (service role), puis `POST /v2/faces` avec `TAVUS_API_KEY` ; renvoie `face_id`, `status`.
  - `face-status` : `GET /v2/faces/{id}` → `status`, `training_progress`, `finetune_status`,
    `error_message`, `model_name`.
  - Étendre la sonde `tavus-catalog` (`index.ts:52`) avec statut/progression des faces.
- `src/services/streamingAvatar/api.ts` : `trainTavusFace`, `getTavusFaceStatus`.
- Tests : `streamingAvatarRequest.test.ts` (builder, refus d'URL non https, champs interdits).
- Action Ulrich : appliquer la migration dans le chat Lovable ; vérifier le déploiement Edge.

### Lot 3 — Admin : téléverser, suivre, attribuer
- Dans `TavusFields`, bloc « Entraîner un Face (vidéo) » : rappel des exigences vidéo,
  nom du Face (défaut « Max — <date> »), personnage cible, upload (input fichier caché derrière
  un bouton, motif `CharacterRuntimeSettingsTab.tsx:224-237`), barre de progression, contrôle
  côté client (type, taille ≤ 750 Mo) ; champ « ou URL publique » en secours.
- Upload résumable (TUS Supabase via `tus-js-client`, nouvelle dépendance) pour les gros
  fichiers ; message clair si la limite Lovable Cloud bloque → utiliser l'URL.
- Liste des Faces entraînés (depuis Tavus) avec statut, progression, filigrane aperçu/affinage,
  rafraîchissement manuel + polling 30 s tant que `started` ; bouton « Attribuer à Max »
  qui écrit `tavus.characters.max.faceId` (puis Enregistrer habituel).
- Pas de suppression de Face depuis l'app (hors périmètre).

### Lot 4 — Recette réelle (Ulrich + agent)
- Ulrich tourne la vidéo de Max (30 s parlé, 30 s immobile, sérieux, sans sourire en
  écoute — levier le plus fort déjà noté au CHANGELOG), l'upload, attend `completed`.
- Vérifier avec le panneau test (`StreamingAvatarTestPanel.tsx`) puis une session réelle :
  pas de sourire en parlant ni en écoute ; essayer `dejected` vs `neutral` en écoute.
- Point à vérifier : la voix utilisée reste celle du PAL (ElevenLabs de Max) et non le
  `default_voice_id` créé depuis l'audio de la vidéo (bouton « Vérifier » + écoute).

## Livraison (contrat Ava)
- Chaque lot = une branche/PR ; plan copié en `docs/plan_tavus_entrainement_face_emotion.md`
  au lot 1, `docs/prompt_reprise_…` à la clôture ; CHANGELOG/HANDOFF/etat_courant à jour.
- Avant push : `npm run test:quality` et `npm run test:delivery` ; PR ; CI `regression-gates`
  verte ; fusion uniquement via `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`
  (gh via `github-delivery-exec`). Fusion ≠ publication.
- Checkout : AGENTS interdit les worktrees hors checkout canonique. Constat du lot 1 : l'outil
  Claude Code ouvre chaque session dans `.claude/worktrees/…` et bloque toute écriture dans le
  checkout canonique depuis cette session ; le lot 1 a donc été fait sur la branche
  `feat/tavus-expressivite-personnage` du worktree de session, checkout canonique laissé
  propre sur main. Aucun worktree créé par l'agent.

## Exécution lot 1 — 5 novembre 2026

Livré (front seul, aucune migration, Edge Function inchangée, aucun appel d'écriture Tavus) :
- `types.ts` : `TAVUS_ECHO_EMOTIONS` (11 valeurs), `TavusEchoEmotion`,
  `TAVUS_AVATAR_CHARACTERS` (`max`, `emma`), `TavusCharacterOverride`,
  `ResolvedTavusCharacterSettings` ; `tavus.echoEmotion` et `tavus.characters` ;
  `ResponseOutputPrepareContext.characterKey`.
- `settings.ts` : défaut `echoEmotion: "dejected"`, `characters: { max: {}, emma: {} }`.
  Normalisation : `echoEmotion` absent → dérivé de `emotion` par `TAVUS_ECHO_EMOTION_TAGS`
  (comportement d'avant), valeur inconnue → `dejected` ; surcharges filtrées (clé
  `[a-z][a-z0-9_-]{0,31}`, Face ID ≤ 128 caractères rogné, émotions dans leurs listes, champs
  vides retirés). `resolveTavusCharacterSettings(settings, characterKey?)` : chaque champ de
  surcharge renseigné l'emporte, sinon global ; sans personnage ou inconnu → global.
- `protocolCommands.ts` : `buildTavusEchoCommand` reçoit la valeur Echo et n'écrit la balise
  que pour une des 11 valeurs ; `isTavusEchoEmotion` ; `stripTavusEmotionTags` tolère
  guillemets simples, casse, espaces et barre absente.
- `providers/tavus.ts` : Face et émotions résolus pour le personnage de `prepare`
  (`IndexPRD4` passe le personnage de départ) ; l'Edge reçoit le Face résolu sans la table.
  Au tour d'un autre personnage (`context.characterKey`) : même Face → émotions seules ;
  autre Face → fermeture (salle quittée, conversation terminée) puis nouvelle conversation
  avec ce Face avant la réplique. Les événements de l'ancienne salle sont ignorés.
  Note : aujourd'hui l'avatar ne sert qu'à Max au départ (`IndexPRD4` repasse en TTS pour
  Emma et pour un appel depuis la grille) ; la recréation est en place pour le jour où un
  second personnage passera par Tavus.
- Défense : `prepareTextForTTS` retire la balise avant tout autre nettoyage ;
  `SubtitleOverlay` l'enlève du texte affiché.
- Admin `TavusFields` : « Balise Echo en parlant » (11 valeurs, aide « dejected retire le
  mieux le sourire, peut paraître un peu triste ; à tester »), bloc « Par personnage » (Max,
  Emma : Face ID, balise, émotion en parlant, en écoutant ; « Global (valeur) » par défaut).
- Tests : `protocolCommands.test.ts` (11 valeurs, refus hors liste, table héritée, motif
  tolérant), `settings.test.ts` (défauts, rétrocompatibilité, normalisation, résolution),
  `providers/tavus.test.ts` (Face à l'ouverture, global sans personnage, même Face, Face
  différent → recréation sans fausse déconnexion), `textPrep.test.ts`.

Reste : lot 2 (backend d'entraînement, migration appliquée par Ulrich dans le chat Lovable),
lot 3 (admin d'upload), lot 4 (recette réelle). Réglage à faire par Ulrich en sandbox s'il le
souhaite : renseigner le Face de Max dans le bloc « Par personnage » une fois entraîné.
[Prompt lot 2](prompt_reprise_tavus_face_emotion_lot_2.md).

## Exécution lot 2 — 5 novembre 2026

Doc Tavus relue le 5 novembre 2026 (« Video to Face », Create Face, Get Face, Phoenix‑4.5
Preview and Status, Video Requirements) : champs et limites inchangés (`face_name`,
`model_name`, `train_video_url` ; `consent_video_url` déprécié ; `status` started/completed/error,
`training_progress`, `finetune_status`, `error_message` ; mp4/webm ≥ 1080p, ≥ 25 ips, ≤ 750 Mo).

Livré (code et tests seulement ; aucun entraînement réel, aucun appel d'écriture vers Tavus) :
- Migration `20261105120000_tavus_training_videos.sql` : bucket privé `tavus-training-videos`
  (750 Mo, `video/mp4`, `video/webm`) + 4 politiques admin-only. **À appliquer par Ulrich dans le
  chat Lovable** (le SQL est le fichier tel quel), puis vérification par lecture via le MCP Lovable Ava.
- `_shared/streamingAvatarRequest.ts` : `buildTavusFaceTrainingRequest` (3 champs seulement, https
  public obligatoire, nom nettoyé ≤ 80), `parseTavusTrainingStoragePath`, `checkTavusTrainingObject`,
  `normalizeTavusFace` (statut, progression %, affinage, étape `training/preview/ready/tuning_failed/error`,
  erreur sans lien), `normalizeTavusFaceList`, `redactTavusText`.
- Edge `streaming-avatar-session` : actions admin `train-face` (`storagePath` → vérification de
  l'objet puis lien signé 48 h au service role, ou `videoUrl` ; une seule des deux) et `face-status` ;
  réponse `{ provider, face }` (camelCase, pas de lien ni de clé) ; erreurs Tavus sans lien, corps jamais
  journalisé. Sonde `tavus-catalog` : `faceStatuses` normalisés ajoutés.
- Client `api.ts` : `trainTavusFace`, `getTavusFaceStatus`. Tests : `streamingAvatarRequest.test.ts`,
  `api.test.ts` (aucun réseau).
- Limite connue : la taille maximale d'objet de Lovable Cloud peut être inférieure à 750 Mo (lot 3 :
  message clair + repli URL).

Reste : lot 3 (admin), lot 4 (recette). [Prompt lot 3](prompt_reprise_tavus_face_emotion_lot_3.md).

## Exécution lot 3 — 5 novembre 2026

Vérifié avant le code (MCP Lovable Ava, lecture seule) : le bucket `tavus-training-videos` existe, privé,
limite 786 432 000 octets, et les 4 politiques admin-only sont en place (commit Lovable « Créé bucket et appliqué
polices », migration `0015`). Le code de l'Edge Function avec `train-face` / `face-status` est dans le dépôt
Lovable ; son déploiement n'a pas été éprouvé par un appel (aucun appel réel autorisé) : il se confirme au
premier « Rafraîchir » ou « Vérifier » de la recette (lot 4).

Livré (front seul, aucune migration, Edge Function inchangée, aucun appel d'écriture Tavus) :
- `src/components/TavusFaceTrainer.tsx`, inséré dans `TavusFields` sous « Par personnage » : bloc repliable ;
  exigences vidéo ; nom (défaut « Max — date », suit le personnage cible tant qu'on ne l'a pas modifié) ;
  personnage cible ; étape 1 « Téléverser » (input fichier caché derrière un bouton, progression, annulation,
  reprise) ; champ « ou URL publique » (https obligatoire, une seule source) ; étape 2 « Lancer l'entraînement »
  avec boîte de confirmation (coût/quota Tavus) ; liste des Faces, « Rafraîchir », suivi 30 s tant que `started`
  et bloc ouvert ; « Attribuer à Max/Emma » (actif seulement si `completed`), badge « Attribué à … ».
- `tavusFaceUpload.ts` : `checkTavusTrainingFile` (mp4/webm, > 0, ≤ 750 Mo), `buildTavusTrainingObjectPath`
  (`<personnage>/<horodatage>-<nom>.mp4`, accepté par `parseTavusTrainingStoragePath`),
  `describeTavusUploadError` (413 / « maximum allowed size » → message vers l'URL publique ; 401/403 ; bucket
  absent), `uploadTavusTrainingVideo` (tus-js-client, endpoint `/storage/v1/upload/resumable`, 6 Mo, jeton admin
  rafraîchi à chaque requête, `x-upsert: false`).
- `tavusFaceAdmin.ts` : libellés d'étape, règles d'attribution, fusion de liste, `assignTavusFace`.
- `api.ts` : `listTavusFaces` (sonde `tavus-catalog` existante : une lecture GET, `faceStatuses`).
- Dépendance `tus-js-client` 4.3.1 (justification au CHANGELOG) ; `package-lock.json` mis à jour.
- Tests : voir CHANGELOG ; aucune requête réseau, aucun entraînement.

Limites connues : la liste vient de `GET /v2/faces?limit=25` (limite 25 Faces, ordre rendu par Tavus ; la sonde fait aussi les lectures
PAL/personas/replicas, lecture seule) ; la taille d'objet maximale de Lovable Cloud reste à éprouver en recette
(repli URL prêt) ; `bun.lock` / `bun.lockb` non régénérés.

Reste : lot 4 (recette réelle, Ulrich). [Prompt lot 4](prompt_reprise_tavus_face_emotion_lot_4.md).

## Vérification
- Unitaires ciblés : `npx vitest run src/services/streamingAvatar supabase/functions/_shared`.
- Qualité complète : `npm run test:quality`, `npm run test:delivery`.
- Edge : action `train-face` avec une vidéo de test conforme → `face_id` + `started` ;
  `face-status` jusqu'à `completed`.
- Visuel : panneau test avatar en admin, Face attribué à Max, balise Echo `dejected`.
