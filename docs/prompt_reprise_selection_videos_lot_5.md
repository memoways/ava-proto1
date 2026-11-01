# Prompt de reprise — sélection vidéos, lot 5 (lecture et mémoire)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS sans redemander
   d'approbation : ce lot est approuvé, sous réserve des points de décision de la section 3.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver). Actualise main propre (`git pull --ff-only`), puis crée la branche
   `feat/video-selection-lot-5`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Décisions d'Ulrich »,
   « Lot 3b — Exécution », « Lot 4 », « Lot 5 » et « Non-régression »).

## 2. État vérifié à la fin du lot 4 (2026-11-01)

- Lots 1, 2, 3, 3b et 4 livrés sur main (SHA final du lot 4 dans son compte rendu et dans
  Notion). La vidéo ne coupe plus ni la réplique ni le joueur (lot 3b,
  `src/services/cinematicTransition.ts`). Ce lot 5 ne modifie ni la transition, ni le lecteur,
  ni la voix, ni le filtre d'éligibilité (lot 2), ni la règle « choix au sens » (lot 3).
- Lot 4 : Edge Function `describe-video` (admin seulement) ; Gemini 2.5 Flash regarde le rendu
  360p Gumlet et écrit seulement « Description IA » (Notion puis `video_triggers.ai_description`).
  Boutons « Analyser » et « Analyser les vidéos sans description » dans l'éditeur vidéo admin.
  À la livraison du lot 4, **aucune analyse réelle n'était lancée** : vérifie par Lovable
  (lecture seule, MCP Ava `1265958d-b74e-40f2-917d-182fe05163fc`) combien de vidéos ont une
  `ai_description` non vide et si Ulrich a relu les premières. Ne lance aucune analyse toi-même.
- `formatVideoCandidateLine` (`src/services/videoCandidateLine.ts`) envoie au GM `contexte`
  puis `description` (Description, sinon Description IA), 300 caractères chacun.
- Contexte post-vidéo : après une vidéo, `IndexPRD4.tsx` garde `pendingPostVideoContextRef`
  (Contexte de la vidéo jouée) et le transmet une seule fois au tour suivant
  (`postVideoContext`) ; `src/agents/maxOptimizedPromptCompiler.ts` le coupe à **500
  caractères** (`append("post_video", "CONTEXTE POST-VIDÉO", …, 500, "runtime")`). Le
  Contexte réel va jusqu'à 600 caractères. Producteurs : `prd4Orchestrator.ts`, `maxAgent.ts`.
- Aucune mémoire des vidéos vues au-delà de ce tour : le GM sait seulement lesquelles sont déjà
  jouées (exclusion du lot 2), ni le personnage ni le GM ne savent ce qu'elles montraient.
- Prompt GM publié : sandbox-ulrich v11 porte la règle « choix au sens » ; prod v8 et
  sandbox-julien v9 inchangés (lu le 2026-11-01). Ne publie rien.

## 3. Périmètre du lot 5

Étape 0 — mesure avant code : budget du prompt personnage (`maxOptimizedPromptCompiler`,
`staticChars` et plafonds runtime) et taille réelle des Contextes et Descriptions (IA) du
catalogue ; propose le nouveau plafond chiffré. Si l'ajout dépasse nettement le budget, consigne
les options dans le plan et donne à Ulrich une seule décision.

Ensuite :

- **Contexte post-vidéo** : relever la limite de 500 caractères pour que le Contexte entier
  (jusqu'à 600, avec marge) atteigne le personnage ; coupe au mot, jamais au milieu d'un mot.
  Ajouter ce que la vidéo montrait (Description, sinon Description IA, 300 caractères).
- **Mémoire des vidéos vues** : garder dans la session la liste ordonnée des vidéos jouées
  (id, titre, ce qu'elles montrent, tour) ; la transmettre au GM et au personnage au-delà d'un
  tour, compacte (par exemple les trois dernières), pour qu'une référence ultérieure
  (« la scène du feu ») soit comprise. Une vidéo « Ignorée » ou passée avant d'être vue n'entre
  pas en mémoire ; une vidéo « Passée » en cours de lecture : décide et documente.
- Persistance : réutilise l'existant (état de session, `experience_events`) ; aucune nouvelle
  table sans nécessité démontrée (migration via Lovable seulement, accord d'Ulrich).
- Tests : plafond et coupe au mot, contenu post-vidéo, mémoire (ordre, compactage, vidéos
  ignorées exclues), identité du bloc entre GM et personnage s'il est partagé.

## 4. Invariants

- Filtre d'éligibilité (lot 2), règle « choix au sens » (lot 3), transition cinématique (lot 3b)
  et `describe-video` (lot 4) inchangés.
- Notion : aucune écriture dans ce lot. Base Caractères : lecture seule, interdiction formelle
  d'AGENTS. Ne déclenche ni `describe-video` ni `update-notion-video`.
- Lovable unique chaîne ; secrets côté serveur uniquement ; façade STT intacte ; voix et mains
  libres inchangées. Aucun animal affiché, Gami DigiDouble exclu.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 5 livré, ou constat si
   arrêt à l'étape 0).
3. Prompt suivant : si un lot suit (par exemple nettoyage Thèmes/Priorités ou ajustement de la
   consigne d'analyse après relecture d'Ulrich), écris
   `docs/prompt_reprise_selection_videos_lot_6.md`, autonome, sur ce modèle, avec la même
   obligation de livraison et de prompt suivant. Si aucun lot ne suit, dis-le explicitement
   dans le plan et le compte rendu.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise main, puis vérifie
   la synchronisation Lovable. Une fusion ne publie pas ; toute publication touchant la
   production exige l'accord d'Ulrich. Recette humaine à Ulrich : une partie où une vidéo est
   jouée, puis une référence à cette scène deux ou trois tours plus tard.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et lien du prompt
   suivant (ou mention explicite qu'aucun lot ne suit).

Si une étape exige l'intervention d'Ulrich (production, publication, migration, choix de
plafond), arrête-toi et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
