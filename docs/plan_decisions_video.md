# Décisions vidéo : comprendre puis améliorer la sélection (cinématiques et extraits)

## Contexte

Dans Admin › Expérience › Cinématiques et › Extraits, la section « Historique des décisions » n'est pas lisible.
Elle affiche les 40 derniers événements bruts (`event_type` plus un UUID de vidéo). Elle ne permet donc pas de
comprendre pourquoi une vidéo a été choisie. Ulrich a l'impression qu'environ la moitié des choix sont faits au hasard.

Diagnostic sur les données réelles (Lovable, lecture seule, 30 derniers jours) :
- **La confiance ne trie rien** : 19 choix du sélecteur « superposer » sur 20 ont une confiance de 0,8.
- **Des liens trop lâches sont acceptés** par `checkOverlayLink` (`src/services/overlayVideoSelector.ts`).
  Les verbes courants (« parler » ↔ « parle ») et les descriptions IA génériques (« un homme barbu au pull
  sombre ») suffisent. « Depuis le chalet » ↔ « devant le chalet » a fait jouer la vidéo de test
  « test slowly-turning-on-himself ».
- **Une vidéo écrase les autres** : « Max, Emma et Leo suspendus » a été choisie 8 fois sur 20 et jouée dans
  17 sessions. Trois vidéos n'ont jamais été jouées.
- **Elle montre Léo** alors que la conversation parle d'Ava ou d'Emma. Le champ `characters` sert aujourd'hui à
  savoir quel personnage peut parler pendant la vidéo (`videoAvailableForCharacter`), pas qui est à l'écran.
- **La priorité ne départage rien** : les 17 vidéos sont en priorité 1, alors que `orderOverlayCandidates` trie
  d'abord par priorité.
- **Les thèmes ne se parlent pas.** Le GM étiquette chaque tour avec des thèmes libres (« famille », « amour »),
  stockés dans `sessions.gm_post_turn_log[].labels`. Les vidéos ont leurs thèmes Notion (« Contamination »,
  « patricarcat »). Le sélecteur ignore les thèmes par construction.
- **Le journal `experience_events`** ne garde ni les vidéos candidates écartées, ni la réplique, ni les thèmes du
  tour. Le tour se retrouve dans `gm_post_turn_log` par `session_id` et `turn_index`.

Décisions d'Ulrich (21 novembre) :
- d'abord l'outil, puis les corrections, mesurées avec cet outil ;
- un onglet partagé « Décisions vidéo » ;
- une liste de thèmes commune mais évolutive (termes et nombre ajustables aux vidéos) ;
- de nouvelles catégories « Émotion » et « Enjeu », à valider en testant ;
- des personnages à l'écran qui correspondent à la conversation ;
- le thème du tour comme critère de sélection.

---

## Lot 1 — Outil « Décisions vidéo » (lecture seule, sans changement de jeu)

**Livré.** Onglet Admin › Expérience › Décisions vidéo, journal enrichi sur les trois chemins, compteur de lectures. Les événements antérieurs s'affichent sans les nouveaux champs. La relecture sandbox des sessions du 19 au 21 novembre reste à faire dans l'onglet. Suite : [lot 2](prompt_reprise_decisions_video_lot_2.md).

### 1a. Journal enrichi (payload jsonb, sans migration)
Dans `src/pages/IndexPRD4.tsx`, compléter les payloads `cinematic_recommended` et `cinematic_blocked`. Cela
concerne le chemin overlay (≈ l. 2360-2465), le chemin extraits (≈ l. 2470-2580) et le chemin GM interrupt
(≈ l. 2318-2350).
- `mechanism` : `overlay` | `extract` | `game_master`, toujours présent.
- `candidates` : liste courte `[{ id, title }]` dans l'ordre envoyé, au lieu du simple compte.
- `excluded` : `{ reason → [videoId] }`, tiré de `guardVideo(...).blockedReason` (déjà calculé pour `guardReasons`).
- `replyExcerpt` : 300 caractères au plus, et `userExcerpt` : 200 caractères au plus.
- `linkDetail` pour `weak_link` (`name_only`, `cue_not_in_video`, `no_shared_word`), qui existe déjà dans
  `selection.detail`.

Les **thèmes du tour** ne sont pas dupliqués : on les lit dans `gm_post_turn_log` par jointure. Ils arrivent après
la décision en mode overlay ; on les affiche donc comme « thèmes GM du tour ».

### 1b. Service de lecture pur et testé
Nouveau `src/services/videoDecisionLog.ts` :
- `loadVideoDecisions({ sinceDays, sessionId?, mechanism? })` lit `experience_events` (types `cinematic_*`),
  `video_triggers` (titres, thèmes, personnages) et `sessions.gm_post_turn_log` pour les sessions concernées.
- `groupBySession(...)` produit une suite de tours. Pour chaque tour : réplique ou question → décision (jouée,
  écartée avec un motif en clair) → vidéo → lien cité « réplique ↔ vidéo » → candidates écartées par motif → thèmes
  GM du tour.
- `playCounts(...)` compte par vidéo les lectures, les sessions distinctes et la dernière lecture (à partir de
  `cinematic_played`).
- `themeFlows(...)` produit les liens thème GM du tour → vidéo jouée et thème du tour N → thème du tour N+1, avec
  le compte de chaque lien.
- Libellés en français pour tous les `blockedReason` (`cinematic_cooldown`, `overlay_no_allowed_video`,
  `overlay_selection_weak_link`…), réunis dans une table unique et testée.

### 1c. Onglet « Décisions vidéo » (Admin › Expérience)
Nouveau composant `src/components/VideoDecisionsTab.tsx`, monté dans `src/pages/Admin.tsx` à côté de
Cinématiques et Extraits. Les deux sections « Historique des décisions » actuelles de `VideoTriggersEditor.tsx`
(l. 909-918, et la requête l. 479-487) sont remplacées par un lien vers l'onglet.

En-tête : filtres période (7 ou 30 jours), mécanisme (tous, cinématiques, extraits) et session.
La lecture du 21 novembre soir aligne l'onglet là-dessus : sessions repliées, titre humain de Données session,
nombre de vidéos jouées, comptes et pourcentages sur le Sankey, synthèse triée du plus grand pourcentage
au plus petit. Cinématique regroupe la lecture pendant la réplique et l'interruption. Extrait reste à part.

Trois vues, avec seulement l'information nécessaire :
1. **Par session** : une session repliée, avec son titre et le nombre de vidéos jouées. Ouverte, une ligne par tour où une vidéo était envisageable. On y voit le tour, le personnage, les
   thèmes GM, puis l'issue :
   - vidéo jouée, avec la vidéo et la citation « réplique ↔ vidéo » ;
   - aucune vidéo, avec le motif en clair (« espacement : 2 tours depuis la dernière », « lien trop faible :
     prénom seul »…).

   Un dépliant par tour montre les candidates, les écartées par motif et l'extrait de réplique.
2. **Par thèmes** : diagramme Sankey en SVG maison, sans dépendance nouvelle (il faudrait sinon valider
   `d3-sankey`). Colonnes : thème GM du tour → vidéo jouée, ou « aucune vidéo » avec son motif principal. Une
   seconde bascule montre l'évolution des thèmes au fil des tours (thème N → N+1, agrégé). Au survol, on voit les
   comptes et des exemples de citations.
3. **Synthèse critères** : part des tours en vidéo jouée ou écartée, par motif ; distribution de la confiance ;
   types de lien acceptés.

**Compteur de lectures** dans la liste des vidéos (`VideoTriggersEditor.tsx`, carte de chaque vidéo) : badge
« N lectures · M sessions » et date de la dernière lecture, triable par le plus joué. Les vidéos jamais jouées sont
signalées.

### 1d. Tests et livraison du lot 1
- Tests unitaires de `videoDecisionLog.ts` (regroupement, comptes, flux Sankey, libellés), sur des fixtures tirées
  des payloads réels anonymisés.
- Test jsdom de l'onglet : rendu des trois vues, état vide et compteur de lectures.
- Livraison selon AGENTS (CI sur la PR, garde `ship-pr.mjs`), sans migration et sans changement de jeu.
- Ulrich relit ensuite deux ou trois sessions réelles dans l'onglet : c'est la base de mesure du lot 2.

---

## Lot 2 — Vocabulaire commun : Thèmes, Émotion, Enjeu, Personnages à l'écran (Notion + synchro)

**Code livré.** La sélection ne change pas. Migration à coller par Ulrich, propriétés Notion et valeurs à créer par Ulrich ou Romed : [proposition](proposition_vocabulaire_videos_romed.md). Suite : [lot 3](prompt_reprise_decisions_video_lot_3.md).

La source unique et évolutive est la base Notion « Vidéos AVA ». Cette base n'est **pas** la base Caractères,
qui reste en lecture seule ; on y a déjà créé des propriétés au lot 1 des extraits.
- **Thèmes** : on garde la multi-sélection existante, avec un nettoyage proposé à Romed (`patricarcat`, doublons
  `Contamination`/`pandémie`).
- Nouvelles multi-sélections **Émotion** (ex. peur, culpabilité, tendresse, colère, déni) et **Enjeu**
  (ex. protéger, dire la vérité, perdre, trahir). Les valeurs de départ sont proposées dans un document de
  proposition pour Romed, puis remplies par lui.
- Nouvelle multi-sélection **À l'écran** : qui est visible dans la vidéo (max, emma, ava, leo, peter…). Elle reste
  distincte de `characters`, qui garde son sens actuel (qui peut parler pendant la vidéo).
- `sync-notion` lit ces propriétés vers de nouvelles colonnes `video_triggers` (`emotions text[]`,
  `stakes text[]`, `on_screen text[]`). La synchro exporte aussi le **vocabulaire courant** : options Notion, ou à
  défaut union des valeurs. On peut ainsi ajouter, renommer ou retirer un terme dans Notion puis resynchroniser,
  sans toucher au code.
- **Migration** à coller dans le chat Lovable : c'est une action d'Ulrich, à faire en une seule fois.
- **Étiquetage GM fermé mais souple.** Le bloc injecté au GM post-turn reçoit la liste courante des thèmes,
  émotions et enjeux, et retourne `labels.themes`, `labels.emotions` et `labels.stakes` choisis dans ces listes.
  Une valeur hors liste est gardée telle quelle et marquée « hors liste » dans l'onglet : on voit ainsi les termes
  à ajouter. Le prompt éditorial reste dans Notion ; seul le bloc de liste généré par le code est ajouté. Avant de
  coder, il faut retrouver le point exact où le format `labels` est demandé (prompt Notion GM + parseur du
  post-turn dans `prd4Orchestrator.ts`).
- L'onglet du lot 1 utilise ces listes. Le Sankey peut alors choisir sa dimension : thème, émotion ou enjeu.

## Lot 3 — Corrections de la sélection, derrière des réglages mesurés avec l'onglet

Toutes les corrections passent par des réglages de `VideoTriggerSettings` ou `ExtractSettings`, désactivés par
défaut. On les active en sandbox et on compare avant et après dans l'onglet.
1. **Personnages à l'écran** : on écarte une vidéo dont un personnage à l'écran n'a aucun lien avec le tour. Le
   tour se lit par les prénoms cités dans la réplique et la question, et par les topics GM du tour précédent. Le
   motif est journalisé `on_screen_mismatch`. C'est déterministe et ne coûte aucun appel.
2. **Thème, émotion et enjeu du tour comme critère.** Le GM étiquette après la réplique ; on utilise donc les
   labels du **tour précédent**, et ceux du tour courant pour le chemin interrupt. Ces labels classent les
   candidates avant le plafond de 16, à la place de la priorité, qui est uniforme. Ils entrent aussi dans le prompt
   du sélecteur comme « ambiance du moment ». Ils servent à départager, et ne remplacent jamais le lien concret.
3. **Lien plus strict** dans `checkOverlayLink` : liste de mots génériques exclus (parler, regarder, homme,
   femme, pull…). La description IA ne suffit plus seule : il faut un mot du contexte, de la description humaine ou
   de la transcription.
4. **Pool propre** : une vidéo de test ou sans contexte éditorial est exclue. Règle explicite à confirmer : titre
   commençant par « test » ou champ Contexte vide.

Pour chaque correction, la mesure se fait sur des sessions sandbox-ulrich comparables. On regarde la part des
tours avec une vidéo, la diversité (lectures par vidéo) et la relecture humaine de 20 choix dans l'onglet. La
qualité d'usage n'est pas prouvée par la simulation : la recette se fait sur une session réelle.

---

## Fichiers critiques
- `src/pages/IndexPRD4.tsx` (payloads d'événements, trois chemins de décision)
- `src/services/overlayVideoSelector.ts`, `src/services/extractSelection.ts`, `src/services/videoEligibility.ts`,
  `src/services/videoCandidateLine.ts` (lot 3)
- `src/components/VideoTriggersEditor.tsx` (retrait de l'historique, compteur de lectures)
- nouveaux : `src/services/videoDecisionLog.ts`, `src/components/VideoDecisionsTab.tsx`
- `src/pages/Admin.tsx` (onglet)
- `supabase/functions/sync-notion/index.ts` et migration `video_triggers` (lot 2)
- docs : `docs/plan_decisions_video.md` (ce plan), `docs/etat_courant.md`, CHANGELOG, prompts de reprise par lot

## Vérification
- Lot 1 : `npm test` (nouveaux tests du service et de l'onglet), lint et typecheck. Lecture de l'onglet sur
  sandbox avec les sessions réelles du 19 au 21 novembre : les 20 choix overlay connus doivent apparaître avec
  leur citation, et « Max, Emma et Leo suspendus » doit arriver en tête des lectures (17).
- Lot 2 : resynchro sandbox. Les nouvelles colonnes sont remplies, le GM étiquette dans la liste, et un terme
  ajouté dans Notion apparaît après resynchro sans changement de code.
- Lot 3 : réglage par réglage en sandbox-ulrich, comparaison avant et après dans l'onglet, relecture humaine.

## Hors périmètre
Production, base Caractères, choix des termes définitifs (Romed), nouvelle dépendance de graphe.
