# AVA — Reprise Tavus, écoute pilotée par le jeu, lot 1 : le visage d'écoute suit l'intention de jeu

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Lot de **code front seul** : aucune migration, aucun secret,
aucune Edge Function modifiée, aucun prompt (GM, personnage) modifié. Une action humaine à la fois.

## Problème

Depuis le 6 novembre (#161), quand Tavus parle avec la voix d'Ava (audio Echo), l'émotion du visage **en parlant** suit
l'intention de jeu de chaque réplique (`tavusEmotionCues.ts` : tense/scared/urgent → `fear`, angry/accusatory → `anger`,
sad/fragile → `sadness`, sarcastic → `contempt`, warm → `neutral`, jamais `happiness`). Mais **dès la fin de la réplique**,
le visage repasse à une émotion d'écoute **fixe** (`listeningEmotion`, défaut `neutral`, surchargeable par personnage) :

- `providers/tavus.ts` `finishSpeech` → `applyEmotion(this.active.listeningEmotion)` ;
- connexion, `switchCharacter`, fin de réplique texte (Echo PAL) → même valeur fixe ;
- minuterie de 5 s pendant l'écoute → ré-applique la valeur fixe (le visage dérive sinon vers l'assistant souriant).

Conséquence : Max peut finir une réplique effrayée ou en colère et écouter le joueur avec un visage neutre « reposé ».
Le jeu (états de parole du Game Master, intention de la dernière réplique) ne se voit plus pendant l'écoute, alors que
c'est le moment où le joueur regarde le plus le personnage.

## Objectif du lot 1

Le visage d'écoute prolonge l'état de jeu du personnage, **atténué**, au lieu d'une valeur fixe :

1. Une fonction pure `resolveTavusListeningEmotion(lastIntent, settings)` dans `tavusEmotionCues.ts` (ou voisin) :
   intention de la **dernière réplique livrée du personnage actif** → émotion d'écoute. Table d'écoute distincte de la
   table de parole, plus sobre (proposition à valider dans les tests et la recette : `fear` reste `fear`, `anger` →
   `anger` seulement si intensité forte sinon `neutral`, `sadness` → `sadness`, `contempt` → `neutral`). Jamais
   `happiness`. Sans intention (début de partie, réplique scriptée, voie sans intention) → `listeningEmotion` réglée.
2. Réglage « Écoute : fixe / suit le jeu » (global + par personnage Max/Emma, vide = global), **défaut « suit le jeu »**.
   Un ancien JSON sans le champ est relu sans perte (comme `voiceSource`). En mode « fixe », comportement actuel strict.
3. `providers/tavus.ts` : mémoriser l'émotion d'écoute courante par personnage ; l'appliquer en fin de réplique, sur la
   minuterie de 5 s et après `switchCharacter` (même Face). Réinitialiser à la valeur réglée quand le personnage change
   ou que la conversation est rouverte. Une réplique interrompue par le joueur garde aussi son état de jeu en écoute.
4. Voie texte (Source de la voix : Tavus PAL) : même règle si une intention est connue pour la réplique ; la balise Echo
   texte reste inchangée.
5. Télémétrie : tracer l'émotion d'écoute choisie (origine `intent` / `fallback`, émotion, intensité, état de parole
   tronqué à 60 caractères, jamais de texte prononcé) à côté de l'`avatar_cue` existante, visible dans Admin → Sessions
   (« Émotion du visage (Tavus) » : parole puis écoute).

Hors périmètre : Anam, LemonSlice, HeyGen (noter seulement si la même logique leur serait utile) ; table de parole
inchangée ; aucune posture/geste ; aucun entraînement de Face.

## État de départ à vérifier

- main contient `9e06483` (#161, voix d'Ava en audio Echo) ; lots Tavus 1, 2, 3, 3 bis fusionnés.
- Recette humaine du [lot 4](prompt_reprise_tavus_face_emotion_lot_4.md) (Face entraîné, voix Ava) peut être en cours ou
  pas faite : ce lot ne la bloque pas et n'en dépend pas ; si elle a eu lieu, lire ses constats sur l'écoute
  (`neutral` vs `sadness`) dans le [plan](plan_tavus_entrainement_face_emotion.md) et le CHANGELOG avant de fixer la table.
- Réglages réels (lecture seule, MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`) :
  `admin_settings` → `ava_streaming_avatar_settings.tavus` (`listeningEmotion`, `characters.max/emma`).

## Fichiers concernés

`src/services/streamingAvatar/tavusEmotionCues.ts` (+ test), `src/services/streamingAvatar/providers/tavus.ts`
(+ `tavus.test.ts`, `tavusAudio.test.ts`), `src/services/streamingAvatar/settings.ts` (+ `settings.test.ts`),
`src/services/streamingAvatar/types.ts`, l'onglet admin Tavus (sélecteur global et par personnage),
`voiceTurnTelemetryV2` et la vue Admin → Sessions si l'observation d'écoute exige un champ. Intention :
`src/services/tts/performanceIntent.ts` (`PerformanceIntent.emotion`, `intensity`, `speechState`), transmise par
`context.performance` (`types.ts`).

## Tests attendus

Table d'écoute (toutes les émotions canoniques, jamais `happiness`, repli sans intention) ; ancien JSON sans le champ ;
surcharge par personnage ; fin de réplique audio et texte → émotion d'écoute issue de la réplique ; minuterie 5 s qui
maintient cette émotion (pas la valeur fixe) ; interruption ; changement de personnage même Face et autre Face →
retour à la valeur réglée ; mode « fixe » identique à l'actuel ; télémétrie sans texte prononcé.

## Recette humaine (Ulrich, après fusion et synchronisation Lovable)

1. Admin → Avatar streaming → Tavus : « Écoute » = « suit le jeu » en global, Max sur « Global ». Sauvegarder si besoin.
2. Session réelle avec Max en Tavus (voix Ava) : provoquer une réplique tendue ou en colère, puis se taire quelques
   secondes : le visage d'écoute reste tendu, sans sourire, et ne dérive pas après 5, 10, 20 s.
3. Réplique neutre ou chaleureuse ensuite : le visage d'écoute revient au calme réglé.
4. Admin → Sessions : trajectoire parole puis écoute lisible par réplique.
5. Comparer une fois avec « Écoute : fixe » pour juger l'apport.

## Invariants

Secrets côté serveur ; base Caractères Notion en lecture seule (seules les tâches Notion se mettent à jour) ; aucun prompt
modifié ; Gami DigiDouble exclu ; invariants expérience/parole/mains libres d'AGENTS lus avant de toucher ces modules ;
façade `src/services/stt` intacte.

## Validations et livraison

`npm run test:quality` et `npm run test:delivery` verts ; mettre à jour CHANGELOG, `docs/etat_courant.md`, plan (section
« Exécution » dans [plan voix Ava](plan_tavus_voix_ava_audio.md) ou nouveau `docs/plan_tavus_ecoute_jeu.md`) dans la
branche ; commit, push, PR, CI `regression-gates` verte sur le HEAD exact contenant main à jour, fusion uniquement par
`node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu ; aucun Trousseau). Supprimer la branche,
actualiser main, vérifier la synchronisation Lovable. Fusion ≠ publication.

## Obligation de reprise

Avant le push de ce lot, préparer le prompt suivant (`docs/prompt_reprise_tavus_ecoute_jeu_lot_2.md`) : réglage de la
table d'écoute après recette, éventuelle extension à Anam, ou note de clôture si rien ne reste ; y reprendre cette
même obligation.

## Première action exécutable

`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire `providers/tavus.ts` (fin de réplique,
minuterie 5 s, `switchCharacter`) et `tavusEmotionCues.ts`.
