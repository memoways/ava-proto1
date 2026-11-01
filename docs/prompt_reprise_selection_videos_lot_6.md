# Prompt de reprise — sélection vidéos, lot 6 (consigne d'analyse)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS sans redemander
   d'approbation : ce lot est approuvé, sous réserve des points de décision de la section 3.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver). Actualise main propre (`git pull --ff-only`), puis crée la branche
   `feat/video-selection-lot-6`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Décisions d'Ulrich »,
   « Lot 4 » avec son constat d'analyse réelle, « Lot 5 », « Lot 6 » et « Non-régression »).

## 2. État vérifié à la fin du lot 5 (2026-11-01)

- Lots 1 à 5 livrés sur main (SHA final du lot 5 dans son compte rendu). Lot 5 : contexte
  post-vidéo entier + « ce que la vidéo montrait » (`src/services/watchedVideoMemory.ts`), mémoire
  des trois dernières vidéos vues, bloc identique pour le GM et le personnage. Ce lot 6 ne modifie
  ni la mémoire, ni la transition, ni le lecteur, ni la voix, ni le filtre d'éligibilité (lot 2),
  ni la règle « choix au sens » (lot 3).
- Les 17 vidéos ont une Description IA (201 à 299 caractères, lecture Lovable) ; Descriptions
  humaines vides et intactes. Relecture : « couteau » et « Ava dans les bras de Emma » finissent
  par « … » (Gemini a dépassé 300 caractères, `normalizeAiDescription` coupe au mot) ;
  « Max lampe perdu dans la neige » et « test slowly-turning-on-himself » ont presque le même
  texte (homme roux, lanterne, neige, nuit) : le GM ne peut pas les distinguer.
- Consigne : `VIDEO_DESCRIPTION_PROMPT` dans `supabase/functions/_shared/videoDescription.ts`,
  utilisée par l'Edge Function `describe-video` (admin seulement). Le titre et le Contexte ne sont
  volontairement pas envoyés à Gemini (ils orienteraient l'analyse).
- Prompt GM publié : sandbox-ulrich v11, prod v8, sandbox-julien v9. Ne publie rien.

## 3. Périmètre du lot 6

Étape 0 — avant code : relis les 17 Descriptions IA (Lovable, lecture seule, MCP Ava
`1265958d-b74e-40f2-917d-182fe05163fc`) ; compte celles coupées par « … » et les paires trop
proches ; demande-toi si Ulrich a déjà rempli des Descriptions humaines depuis (elles priment).

Ensuite :

- **Consigne** : viser 260 caractères au plus, phrases complètes, pour qu'aucune coupure ne
  survienne sous le plafond de 300 ; demander le geste, l'objet ou le mouvement de caméra qui
  distingue la séquence (par exemple le couteau tenu, le tour sur lui-même), sans interprétation
  narrative ni nom propre deviné. Garde la sortie en une ou deux phrases, au présent, en français.
- Option à juger à l'étape 0 : envoyer à Gemini le titre seul comme indice (jamais le Contexte),
  si les paires restent indiscernables. Si tu la retiens, documente pourquoi ; sinon, écarte-la.
- Ne relance **aucune** analyse toi-même (écriture Notion). Ulrich réanalyse en admin les vidéos
  concernées (bouton « Analyser » ou interrupteur « Réanalyser les Descriptions IA existantes »).
- Tests : consigne (longueur visée, distinction demandée, absence du Contexte), `normalizeAiDescription`
  inchangé, garde `assertOnlyAiDescription` intacte.
- Nettoyage Thèmes/Priorités Notion : reste à Ulrich ; ne le fais pas.

## 4. Invariants

- Filtre d'éligibilité (lot 2), règle « choix au sens » (lot 3), transition cinématique (lot 3b),
  mémoire des vidéos vues (lot 5) inchangés ; `describe-video` n'écrit toujours que
  « Description IA ».
- Notion : aucune écriture dans ce lot. Base Caractères : lecture seule, interdiction formelle
  d'AGENTS. Ne déclenche ni `describe-video` ni `update-notion-video`.
- Lovable unique chaîne ; secrets côté serveur uniquement ; façade STT intacte ; voix et mains
  libres inchangées. Aucun animal affiché, Gami DigiDouble exclu.
- Une Edge Function modifiée n'est active qu'après déploiement par Ulrich via Lovable : dis-le
  dans le compte rendu.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 6 livré, ou constat si
   arrêt à l'étape 0).
3. Prompt suivant : si un lot suit, écris `docs/prompt_reprise_selection_videos_lot_7.md`,
   autonome, sur ce modèle, avec la même obligation de livraison et de prompt suivant. Si aucun
   lot ne suit, dis-le explicitement dans le plan et le compte rendu.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise main, puis vérifie
   la synchronisation Lovable. Une fusion ne publie pas ; le déploiement de `describe-video` et
   toute publication touchant la production exigent l'accord d'Ulrich. Recette humaine à Ulrich :
   réanalyse de « couteau », « Ava dans les bras de Emma » et des deux vidéos jumelles, puis
   relecture.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et lien du prompt
   suivant (ou mention explicite qu'aucun lot ne suit).

Si une étape exige l'intervention d'Ulrich (production, déploiement, publication, analyse
réelle), arrête-toi et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
