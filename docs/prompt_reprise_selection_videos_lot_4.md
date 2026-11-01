# Prompt de reprise — sélection vidéos, lot 4 (Description IA automatique)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique,
remote `https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six
   derniers commits de main et le début du CHANGELOG. Applique le contrat de
   livraison d'AGENTS sans redemander d'approbation : ce lot est approuvé, sous
   réserve du point de décision de la section 3 (faisabilité).
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes
   (PR historique #24 à préserver). Actualise main propre (`git pull --ff-only`),
   puis crée la branche `feat/video-selection-lot-4`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Décisions
   d'Ulrich », « Lot 3 — Exécution », « Lot 4 » et « Non-régression »).

## 2. État vérifié à la fin du lot 3 (2026-11-01)

À lancer après le lot 3b (transition cinématique, `docs/prompt_reprise_selection_videos_lot_3b.md`) ;
relis son compte rendu et le plan pour l'état à jour.


- `video_triggers` : 17 vidéos, `nature` et `characters` remplis ; `context` de 28
  à 600 caractères ; `description` et `ai_description` **vides partout** (chaînes
  vides, pas null). Lecture via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`.
  `video_url` : liens Gumlet `https://gumlet.tv/watch/<id>` (page de lecture, pas un
  fichier vidéo).
- `sync-notion` lit déjà « Description IA » (Notion « 🎬 Vidéos AVA ») vers `ai_description`.
- Le GM reçoit pour chaque candidate `contexte` puis `description` :
  `formatVideoCandidateLine` (`src/services/videoCandidateLine.ts`) prend Description
  si elle est remplie, sinon Description IA, plafonnée à 300 caractères. Dès qu'une
  Description IA existe, elle atteint le GM sans autre changement de code.
- Règle GM « choix au sens » dans le prompt du code. Prompt publié
  (sandbox-ulrich v7, prod v8, sandbox-julien v9) : procédure (nouveau brouillon généré depuis le code) dans
  `docs/prompt_gm_publie_regle_videos_lot_3.md`, publication admin à la main
  d'Ulrich. Vérifie par Lovable (lecture seule) s'il l'a publié ; ne publie rien.
- Modèle « Gemini 2.5 Flash » : les Edge Functions l'appellent **via OpenRouter**
  (`google/gemini-2.5-flash`, `OPENROUTER_API_KEY` côté serveur, par exemple
  `summarize-session`, `sync-notion`), pas par une passerelle Lovable AI dédiée.
- `update-notion-video` écrit déjà dans Notion (champs éditoriaux, admin seulement) :
  ne pas l'utiliser pour ce lot et ne pas l'étendre à Description.

## 3. Périmètre du lot 4

**Étape 0 — faisabilité, avant tout code.** Établir avec preuve :
- si le modèle joignable côté serveur (OpenRouter Gemini 2.5 Flash, ou la passerelle
  Lovable AI si elle est réellement disponible pour ce projet) accepte une vidéo en
  entrée, et sous quelle forme (URL, fichier, taille et durée maximales) ;
- ce que Gumlet fournit pour une vidéo : flux HLS, rendu MP4, vignettes ou images
  extraites, et si c'est accessible depuis une Edge Function ;
- coût et latence d'une analyse sur une vidéo réelle.
Si aucune voie n'est sûre, s'arrêter, consigner le constat et les options dans le
plan, et donner à Ulrich une seule décision à prendre.

**Ensuite, si faisable :**
- Edge Function `describe-video` (admin seulement, `requireAdmin`) : analyse une
  vidéo et écrit **uniquement** la propriété « Description IA » de sa page dans
  « 🎬 Vidéos AVA », puis met à jour `ai_description` (ou relance la synchronisation).
  Ne lit ni n'écrit jamais Description humaine, ni aucun autre champ.
- Consigne d'analyse : décrire objectivement ce qu'on voit (personnages, lieu,
  actions, ambiance), en français, sans interprétation narrative, environ 300
  caractères au plus.
- Éditeur vidéo admin : bouton « Analyser » par vidéo et « Analyser les vidéos sans
  description » (seulement celles dont Description **et** Description IA sont vides,
  sauf demande explicite de réanalyse).
- Tests : construction de la requête, consigne, champ écrit unique, refus si non
  admin, sélection des vidéos à analyser, garde « jamais Description ».

## 4. Invariants

- Filtre d'éligibilité (lot 2) et règle « choix au sens » (lot 3) inchangés.
- Notion : seule « Description IA » de « 🎬 Vidéos AVA » peut être écrite, par
  `describe-video` déclenché par un admin. **Base Caractères : lecture seule,
  interdiction formelle d'AGENTS.** La saisie humaine de Description n'est jamais
  écrasée. Aucune écriture Notion automatique en partie.
- Lovable unique chaîne ; secrets côté serveur uniquement ; façade STT intacte ;
  voix et mains libres inchangées. Aucun animal affiché, Gami DigiDouble exclu.
- Toute analyse réelle lancée sur le catalogue est une écriture Notion : la faire
  sur une seule vidéo de test, relire le résultat, puis sur le reste seulement si
  le résultat est correct ; signaler les vidéos analysées dans le compte rendu.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 4 livré, ou
   constat de faisabilité si arrêt à l'étape 0).
3. Écris le prompt du lot 5, `docs/prompt_reprise_selection_videos_lot_5.md`
   (lecture et mémoire : vidéo qui coupe la voix, contexte post-vidéo au-delà de
   500 caractères, mémoire des vidéos vues). Il doit être autonome, sur ce modèle,
   et inclure la même obligation de livraison et de prompt suivant. Si aucun lot ne
   suit, le dire explicitement.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise main,
   puis vérifie la synchronisation Lovable. Une fusion ne publie pas ; un déploiement
   d'Edge Function ou une publication touchant la production exige l'accord d'Ulrich.
   Recette humaine à Ulrich : relire les Descriptions IA produites, puis une partie
   où la vidéo choisie colle à la conversation.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et lien
   du prompt du lot 5.

Si une étape exige l'intervention d'Ulrich (production, publication, choix d'une
voie d'analyse), arrête-toi et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
