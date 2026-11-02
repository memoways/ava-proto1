# Prompt de reprise — avatars streaming, lot AV3 (LemonSlice en mode audio)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver ; aucune PR ouverte ne doit toucher `src/services/streamingAvatar/`,
   `StreamingAvatar*.tsx`, `src/services/tts/` ni l'Edge Function `streaming-avatar-session`,
   sinon demander à Ulrich). Actualise main propre (`git pull --ff-only`), puis crée
   `feat/avatar-streaming-av3`.
3. Lis `docs/plan_avatar_streaming_multi_fournisseurs.md` en entier, surtout « LemonSlice »
   (section 3), D1 (section 4), « Exécution AV1 » et « Exécution AV2 ».
4. **Avant tout code, une seule décision d'Ulrich : D1, la salle vidéo LemonSlice.** (a) compte
   Daily, secret `DAILY_API_KEY`, salle privée créée par l'Edge Function — recommandé,
   `@daily-co/daily-js` est déjà utilisé pour Tavus ; (b) LiveKit Cloud (nouveau SDK) ;
   (c) écarter LemonSlice. Une question, deux ou trois choix, attendre la réponse.
5. Puis une seule action d'Ulrich à la fois : saisir `LEMONSLICE_API_KEY` dans les secrets
   Lovable Cloud du projet Ava (et `DAILY_API_KEY` ensuite si D1a). Une action, un endroit,
   « réponds fait ». Le code peut avancer en parallèle ; la recette en a besoin.

## 2. État vérifié à la fin d'AV2 (2 novembre 2026)

- Module pur partagé `supabase/functions/_shared/streamingAvatarRequest.ts` : fournisseurs
  connus `heygen | tavus | anam | lemonslice`, sélectionnables `heygen | tavus | anam`, bornes
  `STREAMING_AVATAR_BOUNDS`, constructeurs HeyGen, Tavus et Anam testés hors Deno
  (`src/services/streamingAvatar/streamingAvatarRequest.test.ts`).
- Anam (`providers/anam.ts`, SDK `@anam-ai/js-sdk` 4.29.1) : talk stream par réplique, balise de
  jeu, `interruptPersona`, micro jamais ouvert, fin de parole lue sur `endOfSpeech`.
- Migration `20261102120000_streaming_avatar_provider_anam.sql` : la contrainte
  `sessions.streaming_avatar_provider` accepte déjà `lemonslice` ; **aucune nouvelle migration
  n'est prévue en AV3**. Vérifie au démarrage qu'elle est appliquée (lecture `pg_constraint` par
  le MCP Lovable Ava), sans la rejouer.
- Vérifie aussi si la recette humaine AV2 a été faite (session Anam en français, synchro labiale,
  aucun sourire, interruption, repli TTS) et si l'Edge Function a été déployée par Lovable ; ne
  la refais pas, intègre ses retours s'il y en a.
- `proxy-tts` accepte `outputFormat` (ElevenLabs `pcm_16000`/`pcm_24000`) ; Gradium sort du
  `pcm_24000`. Ce sont les briques du pont audio.

## 3. Périmètre AV3

- **Socle** : rendre `lemonslice` sélectionnable, fabrique `providers/lemonslice.ts`, réglages
  `lemonslice` dans le même JSON (normalisation tolérante, bornes partagées, anciens réglages
  relus sans perte).
- **Edge Function** : `startLemonSlice` → `POST /api/liveai/sessions` avec `LEMONSLICE_API_KEY`,
  corps construit par un helper pur du module partagé (liste blanche) ; transport
  `websocket-daily` (ou LiveKit selon D1) ; selon D1a, création d'une salle Daily privée et d'un
  jeton par l'Edge Function. Liaison `sessions.streaming_avatar_provider = "lemonslice"`, fin de
  session (`terminate`, fermeture de salle), statut `configured.lemonslice`, sonde admin.
  L'adresse WebSocket porte la capacité : jamais journalisée, jamais dans les diagnostics.
- **Pont audio** (le cœur du lot) : la voix du personnage d'Ava (TTS actuel, ElevenLabs ou
  Gradium) produit du PCM16 mono ; rééchantillonnage vers `audio_sample_rate` (16 000 ou
  24 000), morceaux de 80–100 ms en base64 (`audio`), `audio_end` par réplique, `interrupt`,
  `heartbeat` ; `playback_finished` marque la fin de réplique. Lire la doc WebSocket officielle
  (`https://lemonslice.com/docs/websocket/index.md`) et vérifier les noms exacts avant de coder.
  Le son sort par la vidéo LemonSlice, pas en double par le lecteur TTS local.
- **Réglages** : `agent_id` **ou** `agent_image_url`, `model` (défaut, `flash`, `pro`, `cwm-1`,
  `cwm-1-lite`, `cartoon` ; CWM-1 selon l'offre), `agent_prompt` (attitude en parlant, défaut
  abattu, jamais souriant), `agent_idle_prompt` (repos fermé), `idle_timeout`,
  `response_done_timeout`, `audio_sample_rate`, `aspect_ratio`, `edit_image` +
  `edit_image_variant`. N'envoyer que les champs lus par le modèle choisi.
- **En session** (`/control`) : `update-agent-prompt`, `update-idle-prompt`, actions CWM-1
  (`listen` pendant que le joueur parle) seulement si l'offre le permet.
- **Admin** : carte LemonSlice, « Essentiel » + « Avancé », panneau de test inchangé dans sa forme.
- **Tests** : corps de session (liste blanche, bornes, champs non lus non envoyés), anciens
  réglages relus sans perte, pont audio (découpage, rééchantillonnage, `audio_end`,
  interruption), cycle de vie avec WebSocket et salle simulés (prêt, parole, fin sur
  `playback_finished`, interruption, micro jamais publié).
- **Docs** : plan (section « Exécution AV3 »), CHANGELOG, état courant ; prompt de reprise du lot
  suivant préparé avant push : AV4 « Anam passthrough » si Ulrich choisit D2b, sinon dire
  explicitement qu'aucun lot ne suit.

## 4. Invariants

- Ava garde micro, STT, LLM et voix des personnages ; LemonSlice n'anime que l'audio d'Ava.
  Micro jamais publié vers un fournisseur. Repli TTS local inchangé si LemonSlice échoue.
  HeyGen, Tavus (émotions tenues, interruption, écoute) et Anam intacts.
- Aucune URL de salle, adresse WebSocket, jeton ou texte prononcé dans les diagnostics ni les
  journaux.
- Edge Function : déploiement uniquement par Lovable (MCP Ava
  `1265958d-b74e-40f2-917d-182fe05163fc`) ; aucun Supabase direct, aucune publication
  production. Secrets saisis par Ulrich uniquement. Base Caractères Notion en lecture seule.

## 5. Validation et livraison

- `npm run test:quality` et `npm run test:delivery` verts, tout commité avant le premier push ;
  CI PR/HEAD exact contenant main, job `regression-gates` vert ; fusion uniquement par
  `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
- Recette humaine d'Ulrich après déploiement Lovable : une session LemonSlice avec la voix de
  Max, synchro labiale, aucun sourire, interruption en cours de réplique, repli TTS si LemonSlice
  échoue.
- Clôture : prompt du lot suivant dans `docs/` (ou mention explicite qu'aucun lot ne suit), lien
  dans le compte rendu. Cette obligation est à reprendre dans le prompt suivant.

## 6. Première action exécutable

`git status && git fetch --prune origin && git log --oneline -6 origin/main`, puis la liste des
PR ouvertes par `~/CodeProjects/_shared/scripts/github-delivery-exec gh pr list --repo memoways/ava-proto1`.
