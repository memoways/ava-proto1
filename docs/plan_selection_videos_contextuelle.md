# Plan — sélection contextuelle des vidéos

Date : 2026-11-01. Statut : lots 1 (données) et 2 (filtre d'éligibilité) livrés, lot 3 à
démarrer ([prompt lot 3](prompt_reprise_selection_videos_lot_3.md)).
Source : analyse de la mécanique vidéo (session du 2026-11-01) et décisions d'Ulrich.

## État actuel (résumé)

- Le Game Master PRD4 choisit seul la vidéo après chaque tour. Il compare
  uniquement `labels.themes` aux Thèmes Notion et voit : id, titre, type,
  priorité, thèmes, 160 caractères de Description.
- Contexte n'est pas envoyé au GM. Il sert une seule fois après la vidéo, coupé
  à 500 caractères (`maxOptimizedPromptCompiler.ts`).
- Type, Priorité, Style de transition, Étape Gameplay : sans effet sur le choix.
  Description vide partout. Aucun filtre par personnage ni par parcours film.
- Garde-fous existants (`experienceDirector.ts`) : activé, URL présente, jamais
  rejouée, délai avant la première vidéo et entre deux vidéos, maximum par session.
- `videoTriggerMatcher.ts` n'est appelé nulle part (code mort).
- Le prompt GM publié (`systemPromptOverride`, fixture `gm-published-sandbox-v7`)
  remplace le prompt du code : toute règle vidéo doit aussi passer dans la
  version publiée, sinon elle reste sans effet.

## Décisions d'Ulrich (2026-11-01)

1. **Deux natures de vidéo** : « Extrait du film » et « Vidéo transformée »
   (transformée par l'IA, onirique).
2. **Parcours film** (`experiencePathFromFilmAnswer`, `vu`/`rappel` → seen,
   `pas_vu` → unseen) :
   - film vu : uniquement des vidéos transformées, jamais d'extrait ;
   - film pas vu : d'abord des extraits ; une vidéo transformée n'est possible
     qu'après un nombre minimum d'extraits montrés (réglage admin).
3. **Pas d'ordre chronologique** imposé aux extraits : choix au fil de la conversation.
4. **Personnages** : multi-select Max, Emma, Ava, Léo, Tous. Une vidéo n'est
   proposée que si le personnage en ligne en fait partie. Valeur « Tous » ou
   champ vide : vidéo disponible pour tous.
5. **Contexte ≠ Description** :
   - Contexte = contexte narratif éditorial, subjectif, écrit par Ulrich ;
     il porte les intentions et sert à rapprocher la vidéo de la conversation ;
   - Description = description factuelle et objective de la séquence.
6. **Description automatisée** : une IA analyse la vidéo et remplit un champ
   séparé « Description IA ». Le GM lit Description si elle est remplie, sinon
   Description IA. La saisie humaine n'est jamais écrasée.

## Changements Notion (base 🎬 Vidéos AVA)

Nature, Personnages et Description IA ont été créés le 2026-11-01 (accord
d'Ulrich), vides sur toutes les vidéos. Nettoyage des Thèmes et Priorités : à
faire par Ulrich. La base Caractères n'est pas concernée et reste en lecture seule.

| Champ | Type | Valeurs / rôle |
|---|---|---|
| Nature | select | Extrait du film, Vidéo transformée |
| Personnages | multi-select | Max, Emma, Ava, Léo, Tous |
| Description IA | texte | rempli par l'analyse automatique |
| Thèmes | multi-select existant | corriger « patricarcat », harmoniser « Contamination », retirer « contexte » |
| Priorité | nombre existant | à remplir (plus petit = prioritaire) |

Valeurs par défaut à la synchronisation : Nature vide → Vidéo transformée (les
vidéos actuelles le sont) ; Personnages vide → Tous.

## Lots

### Lot 1 — Données et synchronisation

- Migration `video_triggers` via Lovable : colonnes `nature`, `characters`
  (text[]), `ai_description`.
- `sync-notion` : mapper Nature, Personnages, Description IA avec les défauts
  ci-dessus. `VideoTriggerRow` étendu.
- Tests : mapping et défauts.

**Exécution (2026-11-01).** Champs Notion vérifiés par `notion-gamilab`
(get-self Gamilab `7e1a9a09…`), aucune vidéo modifiée.

- Migration additive `20261101120000_video_triggers_selection_metadata.sql`
  (`nature`, `characters` text[], `ai_description`, nullables, sans backfill).
- Mapping pur `supabase/functions/_shared/videoMetadata.ts` :
  `mapVideoNature` (Extrait du film → `extract`, vide ou inconnu →
  `transformed`, casse/accents tolérés) et `mapVideoCharacters` (noms →
  identifiants sans accent, Léo → `leo`, « Tous » ou vide → `['all']`,
  doublons retirés, valeurs inconnues gardées normalisées).
- `sync-notion` écrit les trois champs ; si la migration n'est pas encore
  appliquée (`PGRST204`/`42703` sur ces colonnes), il resynchronise les
  colonnes historiques sans échec et renvoie `video_metadata_synced: false`.
- `VideoTriggerRow` étendu (champs optionnels) ; lecture `select("*")` pour
  rester valide avant et après la migration. Types Supabase étendus.
- Éditeur admin : Nature et Personnages affichés en lecture seule.
- Aucune règle de sélection modifiée : le GM lit toujours les mêmes champs.
- Tests : `src/services/videoMetadata.test.ts` (défauts, inconnus, accents,
  détection de colonne absente).

### Lot 2 — Filtre d'éligibilité déterministe

Nouvelle fonction pure (par exemple `selectEligibleVideos`) appelée avant le GM :

- parcours seen : `nature = transformée` seulement ;
- parcours unseen : extraits d'abord ; vidéos transformées autorisées quand
  `extraitsMontrés >= MIN_EXTRACTS_BEFORE_CINEMATIC` (nouveau réglage, défaut 2).
  S'il n'existe aucun extrait en ligne, le comportement actuel est conservé ;
- personnage actif ∈ `characters`, ou `Tous` ;
- Type `intro` exclu de la conversation ;
- déjà jouées exclues (règle existante).

Le GM ne reçoit que les candidates éligibles. `validateDirectorDecision` refait
le même contrôle (nouveau motif de blocage `ineligible`) au cas où le GM
citerait un id hors liste. Tests unitaires sur toutes les combinaisons.

**Exécution (2026-11-01).** Lot 1 vérifié via Lovable : colonnes présentes, Nature et
Personnages remplis sur les 15 vidéos (extraits et transformées, Max/Emma/Léo).

- `src/services/videoEligibility.ts` : `selectEligibleVideos`, `countPlayedExtracts`,
  `videoAvailableForCharacter`. Nature absente → transformée ; Personnages absent, vide ou
  `all` → tous. « Aucun extrait éligible » s'entend après filtres personnage, intro et déjà
  jouées : extraits tous joués ou réservés à un autre personnage → transformées autorisées.
- GM (`evaluatePostTurnPRD4`) : filtre la liste avant `buildUserPrompt` et `validIds`.
  Entrées `experiencePath` (depuis `experiencePathFromFilmAnswer`) et
  `minExtractsBeforeCinematic` transmises par l'orchestrateur ; absentes (tests admin) →
  parcours inconnu, seuil 2.
- Directeur : `DirectorGuardContext.eligibleVideoIds` et motif `ineligible`, contrôlé après
  `cinematic_already_played`. `IndexPRD4` calcule la même liste au moment de la décision.
  Aucun libellé admin des motifs n'existait : rien à ajouter.
- Réglage `MIN_EXTRACTS_BEFORE_CINEMATIC` (défaut 2) dans `VideoTriggerSettings` et
  l'éditeur vidéo admin ; fusion avec les défauts pour les réglages déjà enregistrés.
- Tests : `videoEligibility.test.ts`, `gameMasterPRD4.videos.test.ts`, motif `ineligible`
  dans `experienceDirector.test.ts`.

### Lot 3 — Choix au sens, pas au mot-clé

- Bloc VIDÉOS DISPONIBLES : ajouter Description (ou Description IA) et Contexte,
  plafonnés (par exemple 300 caractères chacun).
- Règle GM : rapprocher la vidéo de ce qui se joue (thèmes, sujets, intention du
  joueur) en s'appuyant sur Contexte ; thèmes ne sont plus le seul critère.
  Contrat JSON inchangé.
- Mettre à jour le prompt du code **et** la version publiée en admin.
- Décider du sort de `videoTriggerMatcher.ts` : filet de sécurité ou suppression.

### Lot 4 — Description IA automatique

- Fonction edge `describe-video` : analyse la vidéo et écrit « Description IA »
  dans Notion (ce seul champ).
- Déclenchement : bouton « Analyser » par vidéo et « Analyser les vidéos sans
  description » dans l'éditeur vidéo admin.
- Point technique à vérifier d'abord : la passerelle Lovable AI (Gemini 2.5
  Flash déjà utilisé) accepte-t-elle une vidéo ? Sinon, images extraites
  (vignettes Gumlet) ou rendu MP4 au lieu du flux HLS.
- Consigne de l'analyse : décrire objectivement ce qu'on voit (personnages,
  lieu, actions, ambiance), sans interprétation narrative.

### Lot 5 — Lecture et mémoire

- Vérifier sur une trace de session si la vidéo coupe la voix ; si oui,
  attendre la fin de la réplique avant de lancer la vidéo.
- Contexte post-vidéo : relever la limite de 500 caractères.
- Mémoire : garder dans la session les vidéos vues et ce qu'elles montrent,
  pour le GM et le personnage au-delà d'un tour.

## Non-régression

- Parcours film vu : avec Nature vide → transformée et Personnages vide →
  Tous, le comportement actuel est inchangé, à l'exception de l'exclusion `intro`.
- Parcours pas vu sans extrait en ligne : comportement actuel conservé.
- Tests existants du GM, du directeur et de la synchronisation verts à chaque lot.

## Questions encore ouvertes

- Réglage `MIN_EXTRACTS_BEFORE_CINEMATIC` : la valeur 2 convient-elle ?
- Ava et Léo ne sont pas encore appelables : les vidéos où ils figurent seuls
  devront être tagguées « Tous » pour être jouées.
- Signification exacte de Type `interlude` face à `mid_conversation`.
