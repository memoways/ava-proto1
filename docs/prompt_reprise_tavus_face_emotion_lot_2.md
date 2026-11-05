# AVA — Reprise autonome Tavus Face & émotion, lot 2 seulement

Travaille dans le dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`), en français. Aucun clone ni worktree ajouté par
l'agent (si l'outil ouvre la session dans `.claude/worktrees/…` et bloque l'écriture dans le
checkout canonique, travailler sur la branche du lot dans ce worktree de session et laisser le
canonique propre sur main, comme au lot 1). Lovable / Lovable Cloud est l'unique chaîne de
compilation et de publication. Cette demande autorise uniquement le **lot 2 — Backend
d'entraînement d'un Face Tavus** (migration de stockage, Edge Function, client API). Ne lance
aucun autre lot, et **aucun entraînement réel** de Face (coût et quota Tavus) : seulement le
code et ses tests.

## État vérifié (5 novembre 2026)

- Lot 1 livré (PR `feat/tavus-expressivite-personnage`, voir CHANGELOG « Tavus lot 1 ») :
  balise Echo réglable (11 valeurs, défaut `dejected`), surcharges par personnage
  `tavus.characters.{max,emma}` (`faceId`, `echoEmotion`, `emotion`, `listeningEmotion`),
  `resolveTavusCharacterSettings`, Face recréé seulement s'il change. Front seul.
- Le Face ID attribué à Max s'écrira dans `tavus.characters.max.faceId` (réglage
  `ava_streaming_avatar_settings`, admin_settings) ; c'est le lot 3 qui ajoutera l'interface.
- Edge `supabase/functions/streaming-avatar-session/index.ts` : actions `start`, `end`,
  `check`, `control` ; `check` et les sondes `?probe=…` passent par `requireAdmin`
  (`_shared/adminAuth.ts`). Sonde `tavus-catalog` existante (liste faces/pals).
- Modèle de politiques de stockage admin-only :
  `supabase/migrations/20260807112433_301506c5-318c-41a5-ad27-b41bdbb943a2.sql`
  (`bucket_id = '…' AND private.has_role(auth.uid(), 'admin')`).
- Doc Tavus lue le 5 nov. 2026 (à relire au démarrage) : `POST /v2/faces` (`face_name`,
  `model_name: "phoenix-4.5"`, `train_video_url` publique ≥ 24 h, pas de `consent_video_url`) ;
  `GET /v2/faces/{face_id}` (`status` started/completed/error, `training_progress`,
  `finetune_status`). Vidéo mp4/webm ≥ 1080p, ≥ 25 ips, ≤ 750 Mo.

## Vérifier l'état réel avant toute modification

1. Lire `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, le début du CHANGELOG et
   **`docs/plan_tavus_entrainement_face_emotion.md`** (sections Lot 2 et « Exécution lot 1 »).
2. `git status`, branche, `git fetch --prune`, main local/distant, PR ouvertes. Préserver
   PR #24 et tout travail étranger. Créer `feat/tavus-face-training-backend` depuis main à jour.
3. GitHub : `git` nu ; `gh` et la garde via
   `~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu. Aucun Trousseau.
4. Relire la doc Tavus « video-to-face » / `POST /v2/faces` / `GET /v2/faces/{id}` (champs
   exacts, limites), et noter la date de lecture dans le plan.

## Ce que le lot 2 doit livrer (détail dans le plan, section Lot 2)

- Migration `supabase/migrations/<horodatage>_tavus_training_videos.sql` : bucket privé
  `tavus-training-videos` (limite 750 Mo, types `video/mp4`, `video/webm`) et politiques
  select/insert/update/delete admin-only calquées sur la migration de référence. **Appliquée
  par Ulrich dans le chat Lovable** (une fusion GitHub ne l'applique pas) : préparer le SQL
  exact à coller, et vérifier ensuite par lecture via le MCP Lovable Ava
  (`1265958d-b74e-40f2-917d-182fe05163fc`), jamais par Supabase direct.
- `supabase/functions/_shared/streamingAvatarRequest.ts` : builder pur
  `buildTavusFaceTrainingRequest({ faceName, videoUrl })` → `face_name` (borné, nettoyé),
  `model_name: "phoenix-4.5"`, `train_video_url` (https obligatoire) ; liste blanche stricte,
  jamais `callback_url`, voix ni `consent_video_url` ; `normalizeTavusFace(json)` pour la
  réponse (id, nom, statut, progression, affinage, erreur, modèle).
- `streaming-avatar-session/index.ts` : actions admin (`requireAdmin`) :
  - `train-face` : `storagePath` (préfixe du bucket vérifié, lien signé 48 h par service
    role) **ou** `videoUrl` https ; `POST /v2/faces` avec `TAVUS_API_KEY` ; renvoie
    `face_id`, `status`. Erreurs Tavus résumées, jamais la clé ni l'URL signée dans les logs.
  - `face-status` : `GET /v2/faces/{id}` normalisé.
  - Sonde `tavus-catalog` enrichie du statut/progression des faces.
- `src/services/streamingAvatar/api.ts` : `trainTavusFace`, `getTavusFaceStatus` (typés).
- Tests : `src/services/streamingAvatar/streamingAvatarRequest.test.ts` (builder, refus
  d'URL non https, champs interdits absents, nom borné, normalisation de la réponse) et tests
  du client API. Aucun appel réseau réel dans les tests.

## Invariants

- Secrets côté serveur uniquement (`TAVUS_API_KEY` déjà présent pour Tavus) ; aucune URL
  signée ni clé dans les réponses au navigateur ou les logs.
- Base Caractères Notion en lecture seule ; aucun prompt modifié.
- Aucun appel d'écriture vers Tavus pendant le développement ou les tests.
- Module partagé modifié → l'Edge Function `streaming-avatar-session` est à redéployer par
  Lovable après fusion.

## Livraison

`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`
et compte rendu « Exécution lot 2 » dans le plan ; prompt du lot 3
(`docs/prompt_reprise_tavus_face_emotion_lot_3.md`) préparé avant push, avec cette même
obligation de prompt de reprise. Commit, push, PR, CI `regression-gates` verte, fusion
uniquement par `node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`
(autorisation permanente, sans demander). Supprimer la branche, actualiser main, vérifier la
synchronisation Lovable. Fusion ≠ publication.

Actions d'Ulrich après livraison, une à la fois : appliquer la migration dans le chat Lovable,
puis vérifier le redéploiement de l'Edge Function. Recette humaine : lot 4.

## Première action exécutable

`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire le plan.
