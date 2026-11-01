# Prompt de reprise — sélection vidéos, lot 3 (choix au sens, pas au mot-clé)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique,
remote `https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six
   derniers commits de main et le début du CHANGELOG. Applique le contrat de
   livraison d'AGENTS sans redemander d'approbation : ce lot est approuvé.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes
   (PR historique #24 à préserver). Actualise main propre (`git pull --ff-only`),
   puis crée la branche `feat/video-selection-lot-3`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Décisions
   d'Ulrich », « Lot 2 — Exécution », « Lot 3 » et « Non-régression »).

## 2. État vérifié à la fin du lot 2 (2026-11-01)

- `video_triggers` porte `nature`, `characters`, `ai_description` (migration du
  lot 1 appliquée, vérifiée via le MCP Lovable Ava
  `1265958d-b74e-40f2-917d-182fe05163fc` ; Nature et Personnages remplis sur les
  15 vidéos). `ai_description` est encore vide (lot 4). `context` et
  `description` existent depuis l'origine ; Description est vide partout.
- `selectEligibleVideos` (`src/services/videoEligibility.ts`) filtre avant le GM :
  parcours seen/unseen, personnage en ligne, `intro` et déjà jouées exclues,
  seuil `MIN_EXTRACTS_BEFORE_CINEMATIC` (défaut 2). Le GM
  (`src/agents/gameMasterPRD4.ts`, `evaluatePostTurnPRD4`) ne reçoit que ces
  candidates ; le directeur bloque un id hors liste avec le motif `ineligible`.
- Bloc VIDÉOS DISPONIBLES : `buildUserPrompt` (même fichier) n'écrit que id,
  titre, type, priorité, thèmes et 160 caractères de Description. Contexte n'est
  jamais envoyé au GM ; il sert une fois après la vidéo, coupé à 500 caractères
  (`maxOptimizedPromptCompiler.ts`, hors périmètre : lot 5).
- Prompt GM du code : `EXPERIENCE_DIRECTOR_SYSTEM_PROMPT` (gameMasterPRD4.ts).
  La version publiée en admin (`systemPromptOverride`, configuration
  d'orchestration publiée ; fixture `gm-published-sandbox-v7` dans
  `src/agents/gameMasterPRD4.handoff.test.ts` et `tests/e2e/prd4-happy-path.spec.ts`)
  **remplace** celle du code : une règle absente de la version publiée reste
  sans effet en partie.
- `src/services/videoTriggerMatcher.ts` n'est appelé nulle part (code mort).

## 3. Périmètre du lot 3

- Bloc VIDÉOS DISPONIBLES : ajouter le texte factuel (Description si remplie,
  sinon Description IA) et le Contexte, chacun plafonné (environ 300 caractères),
  sans casser le format ligne par vidéo. Fonction pure testée pour cette ligne.
- Règle GM : rapprocher la vidéo de ce qui se joue (thèmes, sujets, intention du
  joueur) en s'appuyant d'abord sur Contexte ; les thèmes ne sont plus le seul
  critère. Contrat JSON inchangé (`trigger_video_id`, `action.cinematic`).
- Mettre la règle dans le prompt du code **et** préparer la version publiée :
  repérer la version publiée active via Lovable (lecture seule), rédiger le texte
  de remplacement dans `docs/` et le publier seulement par la voie admin prévue ;
  une publication qui touche la production exige l'accord explicite d'Ulrich
  (une seule action à lui donner).
- Décider du sort de `videoTriggerMatcher.ts` (filet de sécurité ou suppression),
  le noter dans le plan.
- Tests : ligne vidéo (Description prioritaire sur Description IA, plafonds,
  champs vides), prompt GM du code contenant la règle, non-régression des tests
  GM, directeur et synchronisation.

## 4. Invariants

- Le filtre d'éligibilité du lot 2 reste la seule source des candidates ; le
  lot 3 ne change que la manière de choisir parmi elles.
- Notion : lecture seule sur « 🎬 Vidéos AVA » et la base Caractères (interdiction
  formelle d'AGENTS). Aucune Edge Function qui écrit dans Notion. La saisie
  humaine de Description n'est jamais écrasée.
- Lovable unique chaîne ; secrets côté serveur ; façade STT intacte ; voix et
  mains libres inchangées. Aucun animal affiché, Gami DigiDouble exclu.
- Latence : le bloc vidéos allongé reste borné (plafonds) ; mesurer la taille du
  prompt GM avant/après sur le catalogue réel.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 3 livré).
3. Écris le prompt du lot 4, `docs/prompt_reprise_selection_videos_lot_4.md`
   (Description IA automatique : vérifier d'abord si la passerelle Lovable AI
   accepte une vidéo). Il doit être autonome, sur ce modèle, et inclure la même
   obligation de livraison et de prompt suivant. Si aucun lot ne suit, le dire
   explicitement.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise
   main, puis vérifie la synchronisation Lovable. Une fusion ne publie pas ;
   la recette humaine (une partie film vu, une partie film pas vu, vidéo
   pertinente au fil de la conversation) reste à Ulrich.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et
   lien du prompt du lot 4.

Si une étape exige l'intervention d'Ulrich (production, publication du prompt
GM), arrête-toi et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
