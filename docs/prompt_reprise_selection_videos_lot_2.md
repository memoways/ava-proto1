# Prompt de reprise — sélection vidéos, lot 2 (filtre d'éligibilité déterministe)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique,
remote `https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six
   derniers commits de main et le début du CHANGELOG. Applique le contrat de
   livraison d'AGENTS sans redemander d'approbation : ce lot est approuvé.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes
   (PR historique #24 à préserver). Actualise main propre (`git pull --ff-only`),
   puis crée la branche `feat/video-selection-lot-2`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Décisions
   d'Ulrich », « Lot 2 » et « Non-régression »). Il est déjà sur main.

## 2. État vérifié à la fin du lot 1 (2026-11-01)

- `video_triggers` porte `nature` (`extract` | `transformed`), `characters`
  (text[], identifiants `max`, `emma`, `ava`, `leo` ou `['all']`) et
  `ai_description`, remplis par `sync-notion` depuis Notion « 🎬 Vidéos AVA »
  (Gamilab, `collection://009ca428-f888-43f4-a1ef-6c8dbefd6967`). Défauts :
  Nature vide → `transformed`, Personnages vide → `['all']`. Mapping pur et testé
  dans `supabase/functions/_shared/videoMetadata.ts`.
- Avant toute chose, vérifie via le MCP Lovable Ava
  (`1265958d-b74e-40f2-917d-182fe05163fc`, jamais Supabase direct) que la
  migration `20261101120000_video_triggers_selection_metadata.sql` est appliquée
  et qu'une synchro vidéos a renvoyé `video_metadata_synced: true`. Sinon, le
  filtre doit traiter une colonne absente ou `null` comme la valeur par défaut.
- `VideoTriggerRow` (`src/services/videoTriggerService.ts`) expose `nature?`,
  `characters?`, `ai_description?` ; lecture `select("*")`, cache de 30 s.
- Le GM (`src/agents/gameMasterPRD4.ts`, `buildUserPrompt`, ~ligne 265) reçoit
  toutes les vidéos de `getVideoTriggersCached()` et ne lit que id, titre, type,
  priorité, thèmes, 160 caractères de Description. `IndexPRD4.tsx` (~ligne 1991)
  charge aussi les vidéos pour le directeur.
- Garde-fous existants : `validateDirectorDecision` dans
  `src/services/experienceDirector.ts` (cinématique : activée, disponible, jamais
  rejouée, délai, max par session). Réglages vidéo : `VideoTriggerSettings` dans
  `src/services/settingsService.ts` (`ENABLED`, `MIN_TURNS_BEFORE_FIRST`,
  `MIN_TURNS_BETWEEN`, `MAX_PER_SESSION`, `MIN_LABELS_REQUIRED`).
- Parcours film : `experiencePathFromFilmAnswer` dans
  `src/services/experienceFrame.ts` (`vu`/`rappel` → seen, `pas_vu` → unseen).
- Le prompt GM publié (`systemPromptOverride`) remplace celui du code : ce lot
  ne touche pas aux prompts (c'est le lot 3), seulement aux candidates fournies.
- Les champs Nature et Personnages sont peut-être encore vides dans Notion :
  avec les défauts, le comportement doit rester celui d'aujourd'hui.

## 3. Périmètre du lot 2

- Fonction pure `selectEligibleVideos` (nouveau module, par exemple
  `src/services/videoEligibility.ts`) prenant les vidéos, le parcours
  (`seen` | `unseen` | inconnu), le personnage en ligne, les ids déjà joués, le
  nombre d'extraits déjà montrés et le réglage minimal. Règles :
  - parcours seen : `nature = transformed` uniquement ;
  - parcours unseen : extraits d'abord ; vidéos transformées autorisées quand
    `extraitsMontrés >= MIN_EXTRACTS_BEFORE_CINEMATIC` ; s'il n'existe aucun
    extrait éligible en ligne, comportement actuel conservé (transformées
    autorisées) ;
  - parcours inconnu : comportement actuel (aucun filtre de nature) ;
  - personnage en ligne ∈ `characters`, ou `characters` contient `all`, est vide
    ou absent ;
  - Type `intro` exclu de la conversation ;
  - déjà jouées exclues ; aucun ordre chronologique imposé.
- Nouveau réglage `MIN_EXTRACTS_BEFORE_CINEMATIC` dans `VideoTriggerSettings`
  (défaut 2), éditable là où les autres réglages vidéo le sont.
- Le GM ne reçoit que les candidates éligibles (filtrer avant `buildUserPrompt`
  et `validIds`). `validateDirectorDecision` refait le contrôle : nouveau motif
  `ineligible` (ajouter au type `DirectorBlockReason`, au libellé admin s'il en
  existe un) quand l'id cité n'est pas éligible. Passer l'information nécessaire
  par `DirectorGuardContext` (par exemple `eligibleVideoIds`).
- Le compte des extraits montrés vient des vidéos réellement jouées dans la
  session (ids joués croisés avec `nature`).
- Tests unitaires sur toutes les combinaisons (seen/unseen/inconnu, extraits
  présents ou non, seuil atteint ou non, personnage listé/`all`/vide/absent,
  intro, déjà jouée) et sur le motif `ineligible`.

## 4. Invariants

- Aucune modification des prompts GM (code ou publié), du contrat JSON du GM ni
  des Descriptions : lot 3.
- Notion : lecture seule sur « 🎬 Vidéos AVA » et la base Caractères (interdiction
  formelle d'AGENTS). Aucune Edge Function qui écrit dans Notion.
- Lovable unique chaîne ; secrets côté serveur ; façade STT intacte ; voix et
  mains libres inchangées. Aucun animal affiché, Gami DigiDouble exclu.
- Non-régression : Nature vide → transformée et Personnages vide → tous donnent
  le comportement actuel, sauf l'exclusion `intro`.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local ; tests
   existants du GM, du directeur et de la synchronisation verts.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 2 livré).
3. Écris le prompt du lot 3, `docs/prompt_reprise_selection_videos_lot_3.md`
   (choix au sens : Description/Description IA et Contexte dans le bloc vidéos,
   règle GM dans le prompt du code et dans la version publiée). Il doit être
   autonome, sur ce modèle, et inclure la même obligation de livraison et de
   prompt suivant. Si aucun lot ne suit, le dire explicitement.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise
   main, puis vérifie la synchronisation Lovable. Une fusion ne publie pas ;
   la recette humaine (une partie film vu, une partie film pas vu) reste à Ulrich.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et
   lien du prompt du lot 3.

Si une étape exige l'intervention d'Ulrich (production, publication), arrête-toi
et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
