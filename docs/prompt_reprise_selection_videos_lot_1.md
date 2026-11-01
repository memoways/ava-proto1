# Prompt de reprise — sélection vidéos, lot 1 (données et synchronisation)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique,
remote `https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six
   derniers commits de main et le début du CHANGELOG. Applique le contrat de
   livraison d'AGENTS sans redemander d'approbation : ce lot est approuvé.
2. Vérifie qu'aucun autre agent n'est actif, et note les branches et PR ouvertes.
   Préserve le travail étranger. Actualise main propre, puis crée la branche
   `feat/video-selection-lot-1`.
3. Récupère le plan et ce prompt. Ils ont été écrits hors de main, dans le
   worktree `~/CodeProjects/memoways/ava-proto1/.claude/worktrees/video-selection-mechanics-37ec02/docs/` :
   - `plan_selection_videos_contextuelle.md`
   - `prompt_reprise_selection_videos_lot_1.md`

   Copie-les dans `docs/` de ta branche ; ils sont commités avec le lot. Si le
   worktree n'existe plus, recrée le plan à partir de la section 2 ci-dessous.

## 2. Contexte vérifié (2026-11-01)

- Notion « 🎬 Vidéos AVA » (Gamilab, data source
  `collection://009ca428-f888-43f4-a1ef-6c8dbefd6967`). Ces champs existent déjà
  et sont vides sur les 11 vidéos en ligne :
  - **Nature** : select, valeurs « Extrait du film » et « Vidéo transformée » ;
  - **Personnages** : multi-select, valeurs Max, Emma, Ava, Léo et Tous ;
  - **Description IA** : texte.

  Vérifie leur présence avec `notion-gamilab` (get-self
  `7e1a9a09-09cb-4deb-a306-83a29b831bc2`). Ne modifie aucune vidéo ni la base
  Caractères.
- Chaîne actuelle : `supabase/functions/sync-notion/index.ts`, table
  `video_triggers`, `src/services/videoTriggerService.ts` (`VideoTriggerRow`,
  cache de 30 s). L'éditeur admin s'appelle `VideoTriggersEditor.tsx`.
- Décisions d'Ulrich pour les lots suivants (à ne pas coder ici) :
  - film vu : uniquement des vidéos transformées ;
  - film pas vu : d'abord des extraits ; une vidéo transformée seulement après N
    extraits montrés (réglage, défaut 2) ;
  - pas d'ordre chronologique des extraits ;
  - filtre par personnage en ligne, « Tous » ou vide signifiant tout le monde ;
  - Contexte (éditorial) et Description (factuelle) envoyés au GM ;
  - Description IA générée automatiquement, sans jamais écraser Description.

## 3. Périmètre du lot 1

- Migration **additive** de `video_triggers` :
  - `nature` text, nullable ;
  - `characters` text[], nullable ;
  - `ai_description` text, nullable.

  Aucune suppression ni réécriture de données. Elle passe par Lovable / Lovable
  Cloud (MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`), jamais par
  Supabase direct. Si appliquer la migration ou déployer la fonction touche la
  production au sens d'AGENTS, arrête-toi et donne à Ulrich une seule action.
- `sync-notion` : mapper Nature → `nature` (`extract` | `transformed`, vide →
  `transformed`), Personnages → `characters` (vide → `['all']`, Léo → `leo`) et
  Description IA → `ai_description`.
- `VideoTriggerRow`, ainsi que les types Supabase générés si le dépôt les
  maintient, sont étendus. Aucun changement de sélection ou de comportement à
  l'exécution dans ce lot.
- Éditeur admin : afficher Nature et Personnages en lecture seule, si c'est
  simple. Sinon, reporter au lot 2.
- Tests : mapping et valeurs par défaut (vide, valeurs inconnues, accents) ;
  tests existants du GM, du directeur et de la synchronisation verts.

## 4. Invariants

Le parcours actuel doit rester identique, car aucune règle de sélection ne
change. Secrets côté serveur. Façade STT intacte. Aucun animal affiché, Gami
DigiDouble exclu.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, HANDOFF et `docs/etat_courant.md` si
   nécessaire, puis le plan (lot 1 livré).
3. Écris le prompt du lot 2, `docs/prompt_reprise_selection_videos_lot_2.md` :
   filtre d'éligibilité déterministe et garde `ineligible` dans
   `validateDirectorDecision`. Il doit être autonome, sur ce modèle, et inclure
   la même obligation de livraison et de prompt suivant.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `… github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise
   main, puis vérifie la synchronisation Lovable. Une fusion ne publie pas.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et
   lien du prompt du lot 2.

Première action : lire `AGENTS.md` et `git status`.
