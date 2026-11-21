# Prompt de reprise — Décisions vidéo, lot 3 (corrections de sélection, mesurées)

À copier dans un nouvel agent (Cursor, Codex ou Claude) sur Ava. Contexte : [plan](plan_decisions_video.md)
(lot 3), [CHANGELOG](../CHANGELOG.md), [état courant](etat_courant.md),
[proposition Romed](proposition_vocabulaire_videos_romed.md).

---

**Objectif.** Corriger la sélection des cinématiques et des extraits, chaque correction derrière un réglage
désactivé par défaut, et mesurer avant / après dans l'onglet Décisions vidéo. Le lot 2 a préparé le
vocabulaire commun. Il n'a pas changé les gardes, le lien concret ni l'ordre des candidates.

**État vérifié après le lot 2.**

- Colonnes `video_triggers.emotions`, `stakes`, `on_screen` et table `video_label_vocabulary` :
  migration `supabase/migrations/20261121193000_video_triggers_label_vocabulary.sql`. Tant qu'Ulrich
  ne l'a pas collée dans le chat Lovable, la synchro retombe sans ces colonnes et sans la table.
  Après collage : resynchroniser le sandbox ; les colonnes se remplissent ; un terme ajouté dans
  Notion apparaît sans changement de code.
- `sync-notion` lit Émotion, Enjeu et À l'écran. Le vocabulaire exporté, c'est les options Notion,
  ou l'union des valeurs si la propriété n'a pas d'options. Propriété absente ou liste effacée →
  tableau vide, jamais une valeur périmée.
- Le post-turn reçoit la liste courante (thèmes, émotions, enjeux) en bloc ajouté. Le parseur
  garde `labels.emotions` et `labels.stakes`. Le plafond de 4 reste sur themes + topics + intentions.
  Une valeur hors liste est conservée. L'onglet la marque « hors liste ».
- Le Sankey peut passer en émotion ou en enjeu quand une de ces listes contient un terme. Sinon la
  vue thèmes du lot 1 reste celle par défaut. Depuis la relecture du 21 novembre soir, chaque thème,
  chaque vidéo et chaque lien affichent leur nombre et leur pourcentage, et la synthèse est triée
  du plus grand pourcentage au plus petit. Les flux sont des bandes à l'échelle du chiffre, sur toute
  la hauteur de la barre ; le nombre d'un flux n'est visible qu'au survol. L'évolution a une colonne
  par vidéo jouée, dans l'ordre de la session. Une session qui s'arrête ne dessine pas de bloc :
  seul le flux vers la vidéo suivante est tracé. Ne pas réintroduire « Superposition » ni « Game Master »
  comme filtres : le filtre est Cinématiques / Extraits. Les sessions utilisent le titre de
  Données session et sont fermées par défaut.
- `characters` = qui peut parler. `on_screen` = qui est visible. La sélection ne lit pas encore
  `on_screen`.
- Proposition à valider par Romed : [docs/proposition_vocabulaire_videos_romed.md](proposition_vocabulaire_videos_romed.md).
  Thèmes lus le 21 novembre : famille, disparition, confiance, pandémie, secrets, amitié, trahison,
  contexte, patricarcat, Contamination. Pas d'Émotion, d'Enjeu ni d'À l'écran dans Notion.
- Base Caractères : lecture seule. Aucune production. La relecture sandbox des 20 choix overlay du
  lot 1 peut encore être non faite : le dire, ne pas la considérer comme acquise.

**Avant de coder.** Lire `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six derniers
commits de main et le plan. Vérifier qu'aucun autre agent n'est actif sur Ava (branches et PR ouvertes)
et préserver la PR #24 et toute PR étrangère active. Repartir de main à jour. Vérifier si la migration
du lot 2 est appliquée (colonnes présentes) avant de mesurer.

**Périmètre.** Toutes les corrections passent par des réglages de `VideoTriggerSettings` ou
`ExtractSettings`, désactivés par défaut. On les active en sandbox et on compare dans l'onglet.

1. **Personnages à l'écran.** Écarter une vidéo dont un personnage à l'écran n'a aucun lien avec le
   tour. Le tour se lit par les prénoms cités dans la réplique et la question, et par les topics GM
   du tour précédent. Motif journalisé `on_screen_mismatch`. Déterministe, aucun appel en plus.
   Ne pas réutiliser `characters` pour ça.
2. **Thème, émotion et enjeu du tour comme critère.** Le GM étiquette après la réplique : utiliser
   les labels du **tour précédent**, et ceux du tour courant pour le chemin interrupt. Ces labels
   classent les candidates avant le plafond de 16, à la place de la priorité (aujourd'hui uniforme).
   Ils entrent dans le prompt du sélecteur comme ambiance du moment. Ils départagent. Ils ne
   remplacent jamais le lien concret.
3. **Lien plus strict** dans `checkOverlayLink` : exclure les mots génériques (parler, regarder,
   homme, femme, pull…). La description IA ne suffit plus seule : il faut un mot du contexte, de la
   description humaine ou de la transcription.
4. **Pool propre.** Exclure une vidéo de test ou sans contexte éditorial. Règle à confirmer avant
   de la figer : titre commençant par « test », ou champ Contexte vide.

**Mesure.** Sessions sandbox-ulrich comparables, réglage par réglage. Part des tours avec une vidéo,
diversité des lectures, relecture humaine d'environ 20 choix dans l'onglet. La simulation ne prouve
pas la qualité d'usage.

**Limites.**

- Base Caractères en lecture seule. Pas d'Edge Function qui écrit un personnage.
- Aucune production. Gami DigiDouble exclu.
- Ne pas changer le sens des réglages de fréquence déjà en jeu quand le nouveau réglage est désactivé.
- Lecture anon soumise aux RLS : zéro ligne sans erreur se signale, ce n'est pas « vide ».

**Validations.**

- Tests des quatre corrections, désactivées par défaut (comportement actuel inchangé) et activées.
- Lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.

**Livraison.**

- Branche de lot depuis main à jour, commit, push et PR.
- Fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, via
  `~/CodeProjects/_shared/scripts/github-delivery-exec` (jamais `gh` nu).
- Vérification du contenu sur origin/main, synchronisation locale et Lovable.
- Mise à jour de STORY, CHANGELOG et `docs/etat_courant.md`.
- Avant le push, écrire le prompt du lot suivant s'il y en a un, avec cette même obligation de
  clôture. S'il n'y en a pas, le dire. Joindre au compte rendu le SHA final, la preuve de livraison
  et ce qui n'est pas vérifié.

Cette passation ne lance pas le lot 3.
