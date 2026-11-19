# Plan — cinématiques : interruption ou superposition à la parole

Date : 2026-11-19. Statut : **lot 1 livré techniquement** (code, tests unitaires et E2E Chromium) ; recette humaine
Ulrich + Romed à faire en sandbox ; aucune publication production.
Tâche Notion : [Comparer les cinématiques en interruption et en superposition à la parole](https://app.notion.com/p/ef162322e59583b7ae03818368ce9008).
Sources : [plan de sélection contextuelle](plan_selection_videos_contextuelle.md) (lots 3 et 3b), `AGENTS.md` (invariant
cinématiques).

## Objectif

Comparer deux façons d'intégrer une cinématique dans la conversation, au choix dans
**Backoffice → Expérience → Cinématiques → Intégration dans la conversation** :

1. **Interrompre la conversation** (défaut, comportement du lot 3b, inchangé) : la réplique se termine, fondu au noir,
   la vidéo seule avec « Passer », retour au personnage, micro rendu.
2. **Superposer à la réponse** : la vidéo remplace l'image du personnage *pendant* la réplique qu'elle illustre, son de
   la vidéo atténué sous la voix, puis retour à l'image du personnage. La conversation n'est jamais retenue.

## Constat dans le code (avant de choisir la solution)

- Le Game Master post-tour ne démarre qu'à la **réception de livraison** de la réplique (`handoffDelivery` /
  `streamControl.delivery`, `prd4Orchestrator.runPostTurn`) : il juge ce qui a été entendu. Sa décision cinématique
  arrive donc **toujours après la fin du son** (déjà noté au lot 3b). Elle convient à l'interruption, pas à la
  superposition : appliquée telle quelle, la vidéo illustrerait la réplique *suivante*, sans rapport garanti.
- Garde-fous existants (`experienceDirector.validateDirectorDecision`) : configuration publiée, `allowCinematics`,
  vidéo disponible et jamais jouée, éligibilité (parcours film, personnage, extraits avant vidéo transformée), tours
  avant la 1re vidéo, **tours min. entre deux vidéos**, maximum par session. Le runtime directeur publié est connu
  avant la réplique (instantané épinglé du tour), désormais exposé par `PRD4TurnResult.director`.
- Un seul `<video>` persistant (`GumletVideoPlayer`), béni par le geste « Commencer ». Il imposait volume 1 et son actif.

## Choix de sélection (superposition)

Une **sélection dédiée et bornée**, lancée dès que le texte de la réplique existe (la voix démarre en parallèle) :

1. Mêmes garde-fous qu'en interruption, appliqués **avant** tout appel : seules les vidéos que
   `validateDirectorDecision` accepterait maintenant sont candidates. Si aucune → aucun appel, aucune vidéo.
2. Assez de réplique à couvrir : estimation à 15 caractères/s depuis le début du son ; il faut ≥ 2,5 s + 0,4 s de
   fondu restant, avant et après la sélection (`overlayHasTimeToShow`). Sinon `overlay_reply_too_short` /
   `overlay_reply_over`.
3. Un appel LLM court (`overlayVideoSelector.ts`, modèle GM, température 0, 160 tokens, **échéance 2 s**) : la réplique,
   la phrase du joueur et les lignes candidates **partagées avec le GM** (`formatVideoCandidateLine` : contexte, puis
   description, puis thèmes ; 12 candidates max, par priorité). JSON strict ; id inconnu, confiance < 0,6, `null`,
   délai dépassé ou erreur → pas de vidéo.
4. Média : le lecteur charge et lit la vidéo **muette et cachée** ; elle n'apparaît qu'une fois réellement en lecture
   et la voix audible. Échéance 2,5 s depuis la décision, sinon abandon (`start_deadline`).
5. La décision cinématique du GM post-tour est **ignorée** en mode superposition (elle arrive après la réplique).

Fréquence : **le même compteur** dans les deux modes (`triggeredVideoIdsRef`, `lastVideoTurnRef`, réservés à la décision,
rendus si la vidéo n'a jamais été montrée). Aucune nouvelle règle de fréquence.

## Lecture et retour

Machine pure `cinematicTransition.ts`, branche superposition :
`idle → overlay_waiting → overlay_showing → overlay_closing (600 ms) → idle`.

- Fin de la réplique, interruption par le joueur (barge-in), nouveau tour, fin ou erreur du média → fondu de retour
  vers le personnage. Changement de personnage, fin d'expérience, réinitialisation → `cancel` (inchangé).
- Jamais de retenue de l'entrée joueur, pas de voile noir, pas de « Passer » ni de « Plein écran », micro mains libres
  maintenu. Le flux avatar reste monté (opacité 0) : sa voix continue.
- Écran : `ConversationScreen` devient transparent au-dessus de la vidéo, image du personnage masquée (photo, flux
  avatar, portrait rond de l'écran d'appel smartphone), commandes et sous-titres conservés.
- Mémoire : la vidéo vue est mémorisée (`watchedVideos`, partielle si coupée) ; pas de « contexte post-vidéo » (la
  réplique l'a déjà portée).

## Son

Réglage `OVERLAY_VIDEO_GAIN_DB` (défaut **−15 dB**, valeur d'essai, non validée artistiquement) → volume 0,178.
iPhone/iPad ignorent `volume` : détecté, la vidéo y reste **muette** plutôt que de couvrir la voix.

## Réglages (`ava_video_trigger_settings`)

| Champ | Défaut | Rôle |
|---|---|---|
| `PRESENTATION` | `interrupt` | `interrupt` ou `overlay` ; absent ou inconnu → `interrupt` (configurations existantes préservées) |
| `OVERLAY_VIDEO_GAIN_DB` | −15 | atténuation du son vidéo en superposition, [−60, 0] dB |

Réglage par environnement (production / sandbox), comme les autres règles de déclenchement.

## Télémétrie (comparaison)

`experience_events` : `cinematic_recommended` (`presentation`, `source` = `game_master` ou `overlay_selector`,
`selectionMs`), `cinematic_played` (`presentation`, `decisionToStartMs`), `cinematic_completed` (`outcome`
`reply_ended`/`completed`, `visibleMs`), `cinematic_blocked` (`overlay_reply_too_short`, `overlay_reply_over`,
`overlay_selection_none|low_confidence|invalid|timeout|error`, `transition_cancelled`). PostHog : mêmes événements avec
`presentation`.

## Tests livrés

- Unitaires : machine d'états (superposition, abandons, retour, mode interruption inchangé), conversion dB, estimation
  de durée, sélecteur (prompt, parsing strict, échéance, annulation), lecteur (muet caché, atténuation, repli iOS,
  pas de plein écran), écran (desktop/tablette et appel smartphone), réglages (défaut et restauration).
- E2E Chromium : superposition jouée pendant la réplique (son 0,178, rien de retenu, retour et micro rendus, aucune
  coupure de la voix) ; réplique trop courte → aucune sélection ; sélection sans vidéo pertinente → réplique normale
  malgré la recommandation GM ; les trois E2E du lot 3b (interruption) inchangés et verts.

## Limites connues

- Pertinence : jugée sur la réplique écrite, pas sur le timing mot à mot ; la vidéo couvre la fin de la réplique, pas
  forcément la phrase qui l'évoque.
- Estimation de durée par nombre de caractères (approximative selon la voix et la vitesse).
- Un appel LLM supplémentaire par tour éligible (seulement quand la fréquence l'autorise).
- Mains libres : le son atténué de la vidéo peut être capté par le micro ; la confirmation par parole reconnue limite
  les faux barge-in, à vérifier en recette.
- iOS : vidéo muette en superposition (pas d'atténuation possible sans Web Audio).
- Annulation (changement de personnage) pendant l'affichage : retour immédiat, sans événement `cinematic_completed`.

## Protocole de recette humaine (Ulrich, Romed — sandbox)

Livraison technique ≠ validation artistique. Pour chaque mode, mêmes situations, mêmes vidéos, environnement sandbox :

1. Backoffice sandbox → Expérience → Cinématiques : choisir le mode, enregistrer, recharger la page, vérifier la
   restauration du choix et du dB.
2. Fréquences : « tours min. entre 2 vidéos » = 1 puis 3 ; vérifier l'espacement identique dans les deux modes.
3. Situations : sujet qui appelle clairement une vidéo (souvenir, lieu) ; sujet sans vidéo pertinente ; réplique courte ;
   réplique longue ; joueur qui interrompt (mains libres) ; changement de personnage et « Terminer » pendant la vidéo ;
   réseau lent (média en retard).
4. Appareils : desktop, tablette, smartphone en mode audio (écran d'appel), iPhone (vidéo muette attendue).
5. Noter pour chaque cinématique : pertinence image/parole (0–3), intelligibilité de la voix (0–3), fluidité (0–3),
   double lecture ou son résiduel (oui/non), préférence de mode. Ajuster ensuite le dB si besoin.

## Recette du 19 novembre (Ulrich, sandbox)

Une seule cinématique sur deux sessions de 14–15 tours, sans lien avec la discussion. Événements : 20 sélections
`overlay_selection_timeout` sur 22 (le modèle GM `google/gemini-2.5-flash` répond au-delà de 2 s ; le proxy ne
désactive pas sa réflexion), 1 réussite (944 ms, choisie sur le prénom « Emma » seul). Tours écartés par les
garde-fous non journalisés. Traitement : lot 2.

## Suite

[Prompt de reprise — lot 2](prompt_reprise_cinematiques_superposition_lot_2.md) : après la recette, ajuster les
paramètres et traiter ses constats.
