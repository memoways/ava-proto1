# Prompt de reprise — Anam, lot AN2 (émotion par réplique pilotée par le Game Master)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

> AN1 doit être fusionné avant AN2 (vérifier sur main la section « Exécution AN1 » du plan).
> **Exécuté le 5 novembre 2026** : voir « Exécution AN2 » dans le plan. Aucun lot ne suit.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS : **aller au bout
   sans rien demander** (commit, push, PR, CI, mise à jour sur main, fusion squash par la garde,
   nettoyage, Lovable synchronisé).
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver ; aucune PR ouverte ne doit toucher `src/services/streamingAvatar/`,
   `src/services/tts/performanceIntent.ts`, `StreamingAvatar*.tsx`, `src/agents/gameMasterPRD4.ts`
   ni `supabase/functions/_shared/streamingAvatarRequest.ts`, sinon demander à Ulrich).
   Actualise main propre (`git pull --ff-only`), puis crée `feat/anam-an2-evolving-emotion`.
3. Lis dans `docs/plan_avatar_streaming_multi_fournisseurs.md` la section « Suite Anam —
   expressivité, émotion évolutive et synchro » et « Exécution AN1 ».

## Apports d'AN1 (5 novembre 2026)

- Défaut `cara-4.1-express` ; une valeur enregistrée est conservée. Vérifier dans l'admin le
  modèle réellement enregistré pour Max avant la recette AN2 (Director Notes lues par Cara 4 seul).
- Métriques client Anam actives : la page Sessions de Lab (`lab.anam.ai/sessions`) sert de
  contrôle de performance pendant la recette.
- Diagnostic `warm_up` (une fois par session) : préchauffage, flux stable, chemin réseau
  (`localCandidateType`, `remoteCandidateType`, `transportProtocol`, `relayProtocol`,
  `roundTripTimeMs`, `incomingBitrateKbps`, `requestedRegion`), affiché dans « Tester l'avatar »
  (`describeWarmUp` dans `src/services/streamingAvatar/networkPath.ts`). Modèle à suivre pour le
  diagnostic par tour d'AN2 : champs plats, listes blanches, aucun texte. Attention :
  `IndexPRD4.tsx` étale tout le diagnostic dans `trackEvent("prd4_streaming_avatar_media")`.
- Voix : champs envoyés par moteur conformes à la documentation Anam ; depuis le 3 novembre, une
  voix ElevenLabs intégrée sans modèle fixé parle en `eleven_v4_turbo`. Balises en ligne
  toujours exclues du texte.
- Désynchronisation de la première réplique (image en avance de 1 à 2 s) : pas corrigée par
  AN1 ; le chemin réseau relevé en recette (direct ou repli TURN) oriente la suite. Hors
  périmètre d'AN2 sauf demande d'Ulrich.

## 2. Demande d'Ulrich (5 novembre 2026)

Max doit évoluer dans son jeu et son registre au fil de la session, pas tenir une seule émotion.
C'est le Game Master qui indique, pour le tour suivant, si l'émotion évolue ; la conduite des
émotions se met à jour pendant la conversation.

## 3. Chaîne existante (vérifiée le 5 novembre)

- Le Game Master (`src/agents/gameMasterPRD4.ts`) renvoie après chaque tour `next_speech_state`
  (état de parole de la fiche du personnage pour le tour suivant) et
  `memory_after.relationship.emotionalState`. `IndexPRD4.tsx` les garde
  (`pendingSpeechStateRef`, consommé une fois ; `pendingEmotionalStateRef`).
- `derivePerformanceIntent` (`src/services/tts/performanceIntent.ts`) produit à chaque réplique
  une intention : émotion canonique (`neutral`, `tense`, `angry`, `sad`, `scared`, `fragile`,
  `warm`, `accusatory`, `sarcastic`, `urgent`), intensité 0–2, source (`speech_state`,
  `gm_memory`, `lexicon`, `manual`), état de parole, garde de tempérament (`tempered`).
  **L'état de parole ne pilote l'émotion que si** les réglages de jeu vocal sont actifs, qu'une
  correspondance existe pour cet état et ce personnage, et que la rugosité est > 0 ; sinon
  l'émotion vient de `emotionalState` (mémoire du Game Master) ou du lexique.
- Cette intention arrive déjà dans `ResponseOutputTurnContext.performance` passé à
  `renderText` des avatars streaming. `providers/anam.ts` l'ignore et envoie
  `settings.speakingCue` (fixe, `sad` par défaut) par `sendDirectorNoteCue(cue, { atSeconds: 0 })`.

## 4. Diagnostic avant code (lecture seule, sans demander)

Par le MCP Lovable Ava (`1265958d-b74e-40f2-917d-182fe05163fc`, lectures SQL), sur les sessions
récentes de Max : les états de parole reçus par le Game Master, la fréquence des
`next_speech_state` non nuls et leur variété, la source des intentions (`prd4_tts_performance` :
`speech_state` / `gm_memory` / `lexicon`), la rugosité et l'activation du jeu vocal. Conclusion
attendue : l'émotion de Max évolue-t-elle déjà côté voix ?

- **Oui** → coder AN2 tel que décrit, sans toucher au Game Master.
- **Non** (aucun état de parole, rugosité 0, Game Master figé) → **une seule question à
  Ulrich** avant de coder : (a) régler ce qui existe (rugosité, correspondances d'états,
  recommandé) ; (b) ajouter au JSON du Game Master un champ explicite d'évolution émotionnelle
  pour le tour suivant. Si (b), vérifier d'abord si le prompt du Game Master est surchargé
  par les réglages admin ou Notion (prompts éditoriaux), pour modifier la bonne source.
  Base Caractères Notion : lecture seule, jamais modifiée.

## 5. Périmètre AN2

- **Correspondance pure** `anamCueForPerformance(intent, mapping)` dans le module partagé :
  émotion canonique → balise Anam (`none`, `sad`, `distressed`, `concerned`, `angry`,
  `surprised`, `curious`, `supportive`, `warm`, `playful`, `happy`, `laughter`). Défauts pour
  Max, jamais souriants : `neutral` → aucune balise (style de base), `tense` → `concerned`,
  `angry` et `accusatory` → `angry`, `sad` et `fragile` → `sad`, `scared` et `urgent` →
  `distressed`, `warm` → `concerned`, `sarcastic` → aucune balise. `happy`, `playful` et
  `laughter` ne sont jamais des défauts.
- **Réglages Anam** : mode `evolving` (défaut) ou `fixed` (comportement actuel) ; table de
  correspondance éditable par personnage dans la carte Anam de l'admin ; anciens réglages relus
  sans perte. En mode `evolving`, sans intention, repli sur la balise fixe.
- **Fournisseur** : `renderText` envoie la balise issue de `context.performance` ; envoi
  inchangé (canal de données, `atSeconds: 0`, visage seul, jamais dans le texte), échec d'envoi
  = réplique dite sans balise.
- **Diagnostic par tour** (`onMediaDiagnostics` ou télémétrie existante) : balise envoyée,
  émotion, intensité, source, état de parole, `tempered`. **Aucun texte prononcé.** La
  trajectoire de la session (balise par tour) est lisible dans l'admin (trace de session).
- **Tests** : correspondance (tous les cas, défauts sans sourire), mode fixe inchangé, repli
  sans intention, échec d'envoi, évolution sur une suite d'intentions (au moins deux balises
  différentes dans une même session simulée), anciens réglages. Anam (accueil, synchro, tampon),
  HeyGen, Tavus et LemonSlice intacts.
- **Docs** : plan (section « Exécution AN2 »), CHANGELOG, état courant. Prompt suivant : **aucun
  lot ne suit AN2 par défaut** ; le dire explicitement dans le plan et le compte rendu. La même
  traduction pour Tavus ne s'ouvre que sur demande d'Ulrich.

## 6. Invariants

- Ava garde micro, STT, LLM ; Anam n'ouvre jamais le micro ; le Game Master reste après la voix
  et ne la retarde jamais ; aucun nouvel appel LLM pour l'émotion.
- Pas de balise dans le texte envoyé à Anam (la voix expressive crierait les premiers mots).
- Pour Emma, aucun état évoquant le suicide (règle existante du Game Master) ; Max ne sourit pas.
- Edge Function : redéploiement uniquement par Lovable si le module partagé change ; aucune
  publication production sans autorisation ; Base Caractères Notion en lecture seule.

## 7. Validation et livraison — jusqu'au bout

- `npm run test:quality` et `npm run test:delivery` verts ; tout commité avant le premier push.
- PR, CI sur le HEAD exact contenant main, job `regression-gates` vert, puis fusion squash
  uniquement par
  `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`
  (lancée en arrière-plan). Vérifier arbre et parent sur main, supprimer notre branche, main
  local à jour.
- **Lovable** : projet Ava synchronisé sur le commit de main ; Edge Function
  `streaming-avatar-session` redéployée par Lovable si le module partagé a changé. Publication
  du site : une seule action d'Ulrich, distincte.
- Recette humaine d'Ulrich : une session Anam d'une dizaine d'échanges avec Max (aveu,
  provocation, promesse de guérison, retour au calme) ; le visage change de registre quand la
  conversation évolue, sans sourire ; la voix ne crie pas en début de réplique ; trajectoire
  lisible dans l'admin.
- Clôture : compte rendu avec SHA de main, CI PR/HEAD, arbre vérifié, et la mention explicite
  qu'aucun lot ne suit (ou le lien du prompt suivant si Ulrich en demande un).

## 8. Première action exécutable

`git status && git fetch --prune origin && git log --oneline -6 origin/main`, puis
`~/CodeProjects/_shared/scripts/github-delivery-exec gh pr list --repo memoways/ava-proto1`.
