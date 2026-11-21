# Prompt de reprise — Décisions vidéo, lot 2 (vocabulaire commun Thèmes / Émotion / Enjeu / À l'écran)

À copier dans un nouvel agent (Cursor, Codex ou Claude) sur Ava. Contexte : [plan](plan_decisions_video.md)
(lots 2 et 3), [CHANGELOG](../CHANGELOG.md), [état courant](etat_courant.md).

---

**Objectif.** Donner aux vidéos et au Game Master le même vocabulaire, évolutif depuis Notion « Vidéos AVA » :
Thèmes (déjà là), Émotion, Enjeu, et À l'écran (qui est visible, distinct de qui peut parler). Le lot 1 a livré
l'outil de lecture. Ce lot ne change pas encore les règles de sélection (lot 3). Il prépare les listes que le
Sankey et le sélecteur pourront utiliser.

**État vérifié après le lot 1.**
- Onglet Admin › Expérience › Décisions vidéo (`src/components/VideoDecisionsTab.tsx`), service
  `src/services/videoDecisionLog.ts`. Les thèmes GM viennent de `sessions.gm_post_turn_log[].labels`
  (`themes`, `topics`, `intentions`), joints par `session_id` et `turn_index`.
- Le journal enrichi (`mechanism`, `candidates`, `excluded`, `replyExcerpt`, `userExcerpt`, `linkDetail`) est
  écrit dans `src/pages/IndexPRD4.tsx` sur `cinematic_recommended` et `cinematic_blocked`, trois chemins
  (Game Master, superposition, extraits). Les événements plus anciens s'affichent en mode dégradé.
- Les thèmes des vidéos sont la multi-sélection Notion existante, lue dans `video_triggers.themes`.
  Pas de colonnes `emotions`, `stakes`, `on_screen`.
- Le format `labels` est demandé dans le prompt GM de `src/agents/gameMasterPRD4.ts` (schéma JSON vers la
  ligne des `themes`, consigne « MAX 4 labels ») et parsé dans `evaluatePostTurnPRD4` (`cleanList` sur
  `labels.themes`, `topics`, `intentions`, plafond de 4). Le prompt éditorial Notion reste la source ;
  seul un bloc de liste généré par le code doit s'ajouter.
- Base Caractères : lecture seule. La base Vidéos AVA n'est pas la base Caractères ; des propriétés y ont
  déjà été créées au lot 1 des extraits. Toute nouvelle propriété se propose d'abord ; Ulrich ou Romed
  l'applique. Aucune production.

**Avant de coder.** Lire `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six derniers
commits de main et le plan. Vérifier qu'aucun autre agent n'est actif sur Ava (branches et PR ouvertes) et
préserver la PR #24 et toute PR étrangère active. Repartir de main à jour.

**Périmètre.**
1. **Proposition** dans `docs/` des valeurs de départ pour Émotion (peur, culpabilité, tendresse, colère,
   déni…) et Enjeu (protéger, dire la vérité, perdre, trahir…), et le nettoyage des thèmes (`patricarcat`,
   doublons Contamination / pandémie), à valider par Romed. Ne pas écrire ces valeurs dans Notion depuis ici
   sans demande explicite.
2. **Migration** additive `video_triggers` : `emotions text[]`, `stakes text[]`, `on_screen text[]`. À coller
   dans le chat Lovable : c'est l'action d'Ulrich, une seule fois. Tant qu'elle n'est pas appliquée, la
   synchro ne doit pas échouer.
3. **`sync-notion`** lit les nouvelles multi-sélections de Vidéos AVA et exporte le vocabulaire courant
   (options Notion, ou à défaut l'union des valeurs). Ajouter, renommer ou retirer un terme dans Notion puis
   resynchroniser ne demande aucun changement de code. Absent ou effacé → tableau vide, jamais une valeur
   périmée conservée.
4. **Étiquetage GM** fermé mais souple. Le bloc injecté au post-turn reçoit les listes courantes (thèmes,
   émotions, enjeux). Le GM retourne `labels.themes`, `labels.emotions` et `labels.stakes` choisis dans ces
   listes. Une valeur hors liste est gardée telle quelle. L'onglet du lot 1 la marque « hors liste ». Le
   plafond et le parseur existants restent la référence : les étendre sans casser `topics` et `intentions`.
5. **Onglet** : le Sankey peut choisir sa dimension (thème, émotion ou enjeu) quand les colonnes sont
   remplies. Sans elles, la vue thèmes du lot 1 reste celle par défaut.

**Limites.**
- Aucune modification de la sélection, des gardes ou du lien concret (lot 3).
- Base Caractères en lecture seule. Pas d'Edge Function qui écrit un personnage.
- `characters` garde son sens : qui peut parler pendant la vidéo. À l'écran est un autre champ.
- Aucune production. Gami DigiDouble exclu.
- Lecture anon soumise aux RLS : zéro ligne sans erreur se signale, ce n'est pas « vide ».

**Validations.**
- Tests de synchro (valeur absente, valeur hors liste, vocabulaire exporté) et du parseur GM.
- Lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
- Après la migration collée par Ulrich : resynchro sandbox, les nouvelles colonnes se remplissent, un terme
  ajouté dans Notion apparaît sans changement de code.

**Livraison.**
- Branche de lot depuis main à jour, commit, push et PR.
- Fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, via
  `~/CodeProjects/_shared/scripts/github-delivery-exec` (jamais `gh` nu).
- Vérification du contenu sur origin/main, synchronisation locale et Lovable.
- Mise à jour de STORY, CHANGELOG et `docs/etat_courant.md`.
- Avant le push, écrire le prompt du lot 3 (corrections de sélection mesurées avec l'onglet, voir le plan)
  avec cette même obligation de clôture. Joindre au compte rendu le SHA final, la preuve de livraison et
  ce qui n'est pas vérifié.
