# AVA — Reprise autonome Tavus Face & émotion, lot 3 seulement

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Cette demande autorise uniquement le lot 3 —
Admin : téléverser, suivre, attribuer. Aucun entraînement réel de Face sans action explicite d'Ulrich
(coût et quota Tavus). Pas de lot 4.

## État vérifié (5 novembre 2026)
- Lot 1 livré (balise Echo, surcharges `tavus.characters.{max,emma}`). Lot 2 livré (voir CHANGELOG « Tavus lot 2 »,
  plan section « Exécution lot 2 ») : bucket `tavus-training-videos` (migration à appliquer par Ulrich dans le chat
  Lovable — vérifier qu'elle l'est via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`), Edge actions admin
  `train-face` (`storagePath` ou `videoUrl`) et `face-status`, client `trainTavusFace` / `getTavusFaceStatus`
  (`src/services/streamingAvatar/api.ts`), type `TavusFace` (étapes `training/preview/ready/tuning_failed/error`).
- Edge Function à redéployer par Lovable après le lot 2 : le vérifier avant tout test réel.

## Périmètre (plan, section Lot 3)
Dans `TavusFields` (`StreamingAvatarConfigTab.tsx`) : bloc « Entraîner un Face (vidéo) » (exigences vidéo, nom par défaut
« Max — <date> », personnage cible, upload derrière un bouton, barre de progression, contrôle type/taille ≤ 750 Mo,
champ « ou URL publique »), upload résumable (TUS, `tus-js-client`) avec message clair si la limite de Lovable Cloud bloque,
liste des Faces (statut, progression, aperçu filigrané / affinage, rafraîchissement manuel + polling 30 s tant que
`started`), bouton « Attribuer à Max » qui écrit `tavus.characters.max.faceId`. Pas de suppression de Face.

## Invariants
Secrets côté serveur ; base Caractères Notion en lecture seule ; aucun prompt modifié ; aucun appel d'écriture Tavus en
test ; nouvelle dépendance justifiée au CHANGELOG.

## Validations et livraison
`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`, compte rendu « Exécution lot 3 »
dans le plan. Commit, push, PR, CI `regression-gates` verte, fusion uniquement par
`node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via `~/CodeProjects/_shared/scripts/github-delivery-exec`,
jamais `gh` nu ; aucun Trousseau). Supprimer la branche, actualiser main, vérifier Lovable. Fusion ≠ publication.
Préparer `docs/prompt_reprise_tavus_face_emotion_lot_4.md` (recette humaine) avant le push, et inclure dans ce prompt la même
obligation de prompt de reprise.

## Première action exécutable
`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire le plan (sections Lot 3 et « Exécution lot 2 »).
