# Prompt de reprise — sélection vidéos, lot 3b (transition cinématique)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique,
remote `https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md` (y compris les invariants voix/mains libres en fin de
   fichier), `docs/etat_courant.md`, `git status`, les six derniers commits de main et le
   début du CHANGELOG. Applique le contrat de livraison d'AGENTS sans redemander
   d'approbation : ce lot est approuvé par Ulrich (1er novembre 2026).
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR
   historique #24 à préserver). Actualise main propre (`git pull --ff-only`), puis crée la
   branche `feat/video-selection-lot-3b`.
3. Lis le plan `docs/plan_selection_videos_contextuelle.md` (sections « Lot 3 —
   Exécution », « Recette d'Ulrich », « Lot 3b » et « Non-régression »), puis
   [le plan de latence, section 3](plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2)
   avant de toucher à l'écoute.

## 2. État vérifié (2026-11-01, main `83baa4e`)

- Lots 1 à 3 livrés (#128, #129, #130, #131). Le GM choisit parmi les candidates éligibles
  en s'appuyant d'abord sur Contexte. Règle publiée en `sandbox-ulrich` (v11
  « Test prov — brouillon », 13:56 UTC) et validée par Ulrich ; `prod` (v8) et
  `sandbox-julien` (v9) gardent l'ancienne règle ; Lovable synchronisé.
- Recette d'Ulrich : la cinématique arrive alors qu'il a commencé à répondre à la
  réplique du personnage ; rien ne signale qu'il ne sert plus à rien de parler.
- Code actuel (`src/pages/IndexPRD4.tsx`) : à la décision validée du directeur
  (`guarded.action.type === "cinematic"`), `setActiveVideo(video)` est appelé aussitôt ;
  un effet « Narrative interludes… » appelle `responseOutputRef.current?.interrupt()`, ce
  qui coupe la réplique en cours. `interludeActive` = phase `conversation_max` + vidéo
  active ; `finishActiveVideo(skipped)` clôt la vidéo et prépare le contexte post-vidéo.
  L'écoute mains libres (`handsFreeListening*`, `src/services/handsFreeVoice.ts`,
  `handsFreeRecovery.ts`) n'est pas suspendue à l'annonce. `GumletVideoPlayer` n'a qu'un
  fondu d'opacité de 200 ms. Événements existants : `cinematic_played`,
  `cinematic_completed`, `cinematic_skipped`, `prd4_video_triggered`.

## 3. Périmètre du lot 3b

Comportement voulu par Ulrich :

1. Décision cinématique connue pendant la réplique : la vidéo passe **en attente**. La
   réplique du personnage n'est jamais coupée.
2. Dès l'annonce, l'écoute du joueur est suspendue (aucun nouveau tour, aucune
   interruption acceptée), avec un signe visuel discret qu'une séquence arrive.
3. Fin de la réplique (son réellement terminé) → fondu au noir du personnage → vidéo →
   fondu au noir → retour en fondu sur le personnage → écoute rouverte. Durées de fondu
   en constantes nommées (ordre de grandeur 600–800 ms), à ajuster en recette.
4. Décision arrivée après la fin de la réplique : si le joueur ne parle pas, enchaîner
   tout de suite (étape 3) ; s'il parle déjà, ne pas lui couper la parole et reporter la
   vidéo à la fin de la réplique suivante. Une vidéo en attente reste soumise aux gardes
   du directeur (jamais rejouée, délai entre vidéos).
5. « Passer », fin de partie, passage à l'autre personnage, abandon de tour ou erreur de
   lecture : la vidéo en attente est annulée proprement, écoute et visuel restaurés.

Mise en œuvre attendue : une petite machine d'état pure et testée (par exemple
`idle → pending → fading_out → playing → fading_in → idle`) dans `src/services/`, pilotée
par `IndexPRD4` ; aucun changement du GM, de la règle de choix, du filtre d'éligibilité ni
du contrat JSON. Instrumenter le délai décision → début vidéo et les reports
(événements ou spans existants, sans nouvelle table).

Tests : machine d'état (toutes transitions, annulations, report quand le joueur parle),
non-interruption de la réplique, écoute suspendue puis rouverte, E2E du parcours
cinématique dans `tests/e2e/prd4-happy-path.spec.ts` ou un spec dédié ; non-régression
GM, directeur, mains libres et passage de personnage.

## 4. Invariants

- Voix et mains libres : décisions de tour dans `handsFreeVoice.ts` ; aucun changement
  des délais de fin de parole ni de la stratégie d'interruption hors cinématique. La
  suspension d'écoute est un état explicite, réversible, testé ; aucun micro perdu après
  la vidéo (vérifier la reprise par `handsFreeRecovery`).
- Façade STT `src/services/stt` intacte ; secrets côté serveur ; Lovable unique chaîne.
- Notion : lecture seule (base Caractères : interdiction formelle d'AGENTS ; « 🎬 Vidéos
  AVA » non modifiée). Aucun animal affiché, Gami DigiDouble exclu.
- Le choix des vidéos (lots 2 et 3) ne change pas.

## 5. Livraison, jusqu'au bout

1. `npm run test:quality` et `npm run test:delivery` verts en local.
2. Mets à jour CHANGELOG, STORY, `docs/etat_courant.md` et le plan (lot 3b livré).
3. Mets à jour le prompt du lot suivant, `docs/prompt_reprise_selection_videos_lot_4.md`
   (Description IA automatique) : état vérifié après le lot 3b. Il doit rester autonome
   et inclure la même obligation de livraison et de prompt suivant. Si aucun lot ne
   suit, le dire explicitement.
4. Commite tout avant le premier push, puis ouvre la PR via
   `~/CodeProjects/_shared/scripts/github-delivery-exec gh …` (jamais `gh` nu).
5. Attends que le run CI et le job `regression-gates` soient verts sur le HEAD exact.
6. Fusionne en squash uniquement via :
   `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge`.
7. Vérifie main sur GitHub (arbre et parent), supprime ta branche, actualise main, puis
   vérifie la synchronisation Lovable. Une fusion ne publie pas : la publication Lovable
   du site (qui touche la production) exige l'accord explicite d'Ulrich. Recette humaine
   à Ulrich : en sandbox, une cinématique annoncée pendant une réplique, une annoncée
   pendant qu'il parle déjà, et « passer » ; il juge la fluidité des fondus.
8. Compte rendu : SHA final, reçu de la garde, lien de la PR, lien du plan et lien du
   prompt du lot 4.

Si une étape exige l'intervention d'Ulrich (production, publication, décision sur le
report), arrête-toi et donne-lui une seule action.

Première action : lire `AGENTS.md` et `git status`.
