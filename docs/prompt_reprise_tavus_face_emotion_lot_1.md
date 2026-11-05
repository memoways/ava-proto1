# AVA — Reprise autonome Tavus Face & émotion, lot 1 seulement

Travaille uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote
`https://github.com/memoways/ava-proto1`, en français. Aucun clone ni worktree ajouté.
Lovable / Lovable Cloud est l'unique chaîne de compilation et de publication.
Cette demande autorise uniquement le **lot 1 — Expressivité Tavus par personnage**
(front seul, aucune migration, aucun appel d'écriture vers Tavus). Ne lance aucun autre lot.

## Vérifier l'état réel avant toute modification

1. Lire `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, le début du CHANGELOG
   (entrées Tavus/émotion) et **`docs/plan_tavus_entrainement_face_emotion.md`** en entier.
2. `git status`, branche, fetch, main local/distant, PR ouvertes. Préserver PR #24 et tout
   travail étranger. Créer `feat/tavus-expressivite-personnage` depuis main à jour, puis y
   reprendre le plan et ce prompt depuis la branche de préparation :
   `git checkout origin/claude/tavus-avatar-training-emotion-f67050 -- docs/plan_tavus_entrainement_face_emotion.md docs/prompt_reprise_tavus_face_emotion_lot_1.md`.
   Supprimer cette branche distante de préparation à la clôture du lot (elle n'a pas de PR).
3. GitHub : `git` nu ; `gh` et la garde via
   `~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu. Aucun Trousseau.

## Ce que le lot 1 doit livrer (détail dans le plan)

- Contexte clé : le PAL Tavus est en `pipeline_mode: "echo"` ; le LLM Tavus ne sert pas.
  La balise `<emotion value="…"/>` est déjà préfixée par `buildTavusEchoCommand`
  (`src/services/streamingAvatar/protocolCommands.ts`) et `conversation.set_emotion`
  tient l'émotion en parlant/écoutant (`providers/tavus.ts`). On ne touche à aucun prompt
  (prompts éditoriaux dans Notion, base Caractères en lecture seule).
- Balise Echo réglable directement parmi les 11 valeurs Tavus (`neutral`, `angry`,
  `excited`, `elated`, `content`, `sad`, `dejected`, `scared`, `contempt`, `disgusted`,
  `surprised`), défaut `dejected`, découplée du réglage `set_emotion` (8 valeurs).
  Rétrocompatibilité : réglage absent → dérivé de `emotion` via `TAVUS_ECHO_EMOTION_TAGS`.
- Surcharges par personnage dans `ava_streaming_avatar_settings.tavus.characters`
  (`max`, `emma`) : `faceId`, `echoEmotion`, `emotion`, `listeningEmotion` ; vide = global.
  Helper pur `resolveTavusCharacterSettings`. Face fixé à la création de la conversation :
  au changement de personnage avec un Face différent, recréer la conversation Tavus ;
  sinon n'appliquer que les émotions.
- Défense : retirer `<emotion …/>` dans `prepareTextForTTS` (`src/services/tts/textPrep.ts`)
  et sur le chemin sous-titres (réutiliser `stripTavusEmotionTags`).
- Admin `TavusFields` (`src/components/StreamingAvatarConfigTab.tsx`) : sélecteur « Balise
  Echo en parlant » avec aide (« dejected retire le mieux le sourire, peut paraître un peu
  triste ; à tester ») et bloc « Par personnage ».
- Tests unitaires : protocolCommands, tavus, settings (normalisation, résolution,
  rétrocompatibilité), textPrep.

## Livraison

`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`,
HANDOFF et compte rendu du lot 1 dans le plan ; prompt de reprise du lot 2
(`docs/prompt_reprise_tavus_face_emotion_lot_2.md`) préparé avant push. Commit, push, PR,
CI `regression-gates` verte, fusion uniquement par
`node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (autorisation
permanente, sans demander). Supprimer la branche, actualiser main, vérifier la
synchronisation Lovable. Fusion ≠ publication. Recette visuelle Tavus réelle : lot 4.
