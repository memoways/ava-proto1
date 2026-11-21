# Prompt de reprise — Décisions vidéo, lot 1 (outil de lecture des décisions + compteur de lectures)

À copier dans un nouvel agent (Cursor, Codex ou Claude) sur Ava. Contexte : [plan](plan_decisions_video.md)
(diagnostic chiffré et lots 2-3), [CHANGELOG](../CHANGELOG.md), [état courant](etat_courant.md).

---

**Objectif.** Le lot remplace les deux sections illisibles « Historique des décisions » (Admin › Expérience ›
Cinématiques et › Extraits) par **un onglet partagé « Décisions vidéo »**. Il doit permettre de comprendre pourquoi
chaque vidéo a été choisie ou écartée. Il ajoute aussi un **compteur de lectures** par vidéo dans la liste des
vidéos. Le lot est **en lecture seule** : il ne change rien en jeu, ni à la sélection (lot 3), ni au vocabulaire
de thèmes (lot 2). L'interface doit rester lisible et ne montrer que l'information nécessaire.

**État vérifié (21 novembre, lecture de la base via Lovable, 30 jours).**
- Le journal `experience_events` contient les événements `cinematic_recommended`, `cinematic_played`,
  `cinematic_completed`, `cinematic_blocked` et `cinematic_skipped`.
- 20 recommandations viennent du sélecteur overlay (`payload.source = "overlay_selector"`, avec `replyCue`,
  `videoCue`, `confidence` et `candidates` en nombre). 44 anciennes viennent du GM (source nulle).
- Les blocages se répartissent ainsi : `cinematic_cooldown` 95, `overlay_no_allowed_video` 26,
  `overlay_selection_weak_link` 25, `overlay_selection_timeout` 18, `none` 6, `invalid` 5.
- Les lectures se lisent par `payload.videoId`. En tête : « Max, Emma et Leo suspendus, tension » (17 lectures,
  17 sessions). Trois vidéos ne sont jamais jouées : « Max pris dans le brouillard », « Max lampe perdu dans la
  neige » et « Emma cherche reception avec brouillard ».
- Les thèmes GM de chaque tour sont dans `sessions.gm_post_turn_log` : tableau d'objets
  `{ turn_index, labels: { themes, topics, intentions }, action, created_at… }`. On les joint par `session_id` et
  `turn_index`. **Aucune migration n'est nécessaire.**
- L'actuelle requête de l'historique est dans `src/components/VideoTriggersEditor.tsx` (`useEffect` sur
  `experience_events`, `limit(40)`) et son rendu dans la section « Historique des décisions » en fin de fichier.
- Les événements sont écrits dans `src/pages/IndexPRD4.tsx` par `appendExperienceEvent`
  (`src/services/experienceDirector.ts`). Trois chemins écrivent :
  - GM interrupt : `reserveCinematic` et `logDirectorBlocked` ;
  - overlay : `logOverlaySkip` et `selectOverlayVideo` ;
  - extraits : `logExtractSkip` et `selectExtractCandidates`.
- Main contient le lot 3 des extraits (#240, sélecteur à 400 tokens). Repartir de main à jour et relire ces
  passages, car les numéros de ligne ont pu bouger.

**Avant de coder.** Lire `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six derniers commits de
main et le plan. Vérifier qu'aucun autre agent n'est actif sur Ava (branches et PR ouvertes) et préserver la PR #24.

**Périmètre.**
1. **Journal enrichi** (payload jsonb seulement), dans les trois chemins de `IndexPRD4.tsx`, sur
   `cinematic_recommended` et `cinematic_blocked` :
   - `mechanism` (`overlay` | `extract` | `game_master`), toujours présent ;
   - `candidates: [{ id, title }]` dans l'ordre envoyé au sélecteur (garder aussi `candidateCount`) ;
   - `excluded: { [blockedReason]: videoId[] }`, à partir des `guardVideo(...).blockedReason` déjà calculés ;
   - `replyExcerpt` (300 car. au plus) et `userExcerpt` (200 car. au plus) ;
   - `linkDetail` quand la sélection est `weak_link` (`selection.detail`).

   Le comportement de jeu ne change pas. La taille reste bornée : 16 candidates au plus, titres coupés à 80 car.
2. **Service pur** `src/services/videoDecisionLog.ts`, testé :
   - chargement (`experience_events` `cinematic_*`, `video_triggers`, `sessions.gm_post_turn_log` des sessions
     concernées), avec filtres période, mécanisme et session ;
   - `groupBySession` : une suite de tours, chacun avec issue (jouée ou écartée), motif en clair, vidéo, citation
     « réplique ↔ vidéo », candidates, écartées par motif et thèmes GM du tour ;
   - `playCounts` : lectures, sessions distinctes et dernière lecture, par vidéo ;
   - `themeFlows` : thème GM → vidéo jouée ou « aucune vidéo (motif) », et thème du tour N → tour N+1 ;
   - une **table unique de libellés français** pour tous les `blockedReason` et `linkDetail` existants. Les
     relever par recherche dans `IndexPRD4.tsx`, `experienceDirector.ts`, `overlayVideoSelector.ts` et
     `extractSelection.ts`. Un motif inconnu s'affiche tel quel, sans erreur.

   Les anciens événements sans les nouveaux champs doivent s'afficher proprement, en mode dégradé.
3. **Onglet `src/components/VideoDecisionsTab.tsx`**, monté dans `src/pages/Admin.tsx` à côté de Cinématiques et
   Extraits. Filtres : 7 ou 30 jours, mécanisme, session. Trois vues :
   - **Par session** : une ligne par tour, avec dépliant (candidates, écartées, extrait de réplique) ;
   - **Par thèmes** : Sankey en **SVG maison**, sans nouvelle dépendance, avec une bascule « thèmes → vidéos » ou
     « évolution des thèmes » et le compte au survol ;
   - **Synthèse critères** : part jouée ou écartée par motif, distribution de la confiance.

   Réutiliser les composants shadcn existants (`Badge`, `Tabs`, `Select`…) et les tokens de thème, avec un
   affichage correct en clair et en sombre.
4. **Compteur de lectures** dans les cartes vidéo de `VideoTriggersEditor.tsx` : badge « N lectures · M sessions »
   et dernière lecture, mention « jamais jouée », tri « les plus jouées ». Retirer les deux sections « Historique
   des décisions » et leur requête, et les remplacer par un lien vers l'onglet.

**Limites.**
- Aucune migration, aucune Edge Function, aucun changement de sélection, de garde ou de prompt.
- Lecture anon soumise aux RLS : si un SELECT renvoie zéro ligne sans erreur, le signaler au lieu de conclure
  « vide ». Vérifier avec le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, en lecture seule.
- Base Caractères Notion en lecture seule. Aucune production. Gami DigiDouble exclu.
- Pas de régression sur les onglets Cinématiques et Extraits, ni sur `VideoTriggersEditor.extracts.test.tsx`.

**Validations.**
- Tests unitaires du service, avec fixtures inspirées des payloads réels, sans identifiant de session réel.
- Test jsdom de l'onglet (trois vues, état vide, motif inconnu) et test du compteur.
- Lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
- Contrôle manuel sur sandbox : les 20 choix overlay du 19 au 21 novembre apparaissent avec leur citation, et
  « Max, Emma et Leo suspendus » est en tête des lectures.

**Livraison.**
- Branche de lot depuis main à jour, commit, push et PR.
- Fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, via
  `~/CodeProjects/_shared/scripts/github-delivery-exec` (jamais `gh` nu).
- Vérification du contenu sur origin/main, synchronisation locale et Lovable.
- Mise à jour de STORY, CHANGELOG et `docs/etat_courant.md`.
- Avant le push, écrire `docs/prompt_reprise_decisions_video_lot_2.md` (vocabulaire commun Thèmes / Émotion /
  Enjeu / À l'écran, voir le plan) avec cette même clôture. Joindre au compte rendu le SHA final, la preuve de
  livraison et ce qui n'est pas vérifié.
