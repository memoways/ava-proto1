# Instructions de plateforme — Ava Proto 1

## Chaîne de développement et de publication (obligatoire)

**Lovable est la plateforme de référence et l'unique chaîne de livraison de ce projet.**

- Lovable compile le code et publie le site.
- Le backend, la base de données, les Edge Functions et les secrets sont gérés dans **Lovable Cloud**, avec **Supabase fourni par Lovable**.
- Ne pas configurer ni substituer une chaîne de build, un hébergeur, un projet Supabase ou un déploiement externe (Vercel, Netlify, Supabase hors Lovable, etc.).
- Toute modification réalisée depuis un autre environnement doit rester compatible avec Lovable et être ramenée dans le projet Lovable avant validation ou publication. Elle ne constitue pas un déploiement autonome.
- Avant toute action qui touche au build, aux variables d'environnement, aux migrations, aux Edge Functions ou à la publication, vérifier qu'elle cible bien Lovable / Lovable Cloud.

Ces règles s'appliquent à toute personne, agent et outil intervenant sur ce dépôt.

## Dossier unique (obligatoire)

Le seul checkout Ava est `/Users/ulrich/CodeProjects/memoways/ava-proto1`.
Le seul dépôt distant est `https://github.com/memoways/ava-proto1`.

- Interdit de créer un dossier, un clone ou un worktree Git à côté de ce checkout
  (`ava-proto1-*`, `ava-proto1-worktrees`, ou tout autre chemin sous
  `~/CodeProjects`).
- Un checkout isolé n’est acceptable que s’il est déjà ouvert par l’outil dans
  `~/.cursor/worktrees/` ou `~/.codex/worktrees/`. Ne pas lancer `git worktree add`
  ni `mkdir` vers un autre chemin.
- À la fin du lot, le travail va sur GitHub par la branche et la PR. Le dossier
  visible du projet reste le checkout canonique.

## Fin de lot : tout va jusqu'au bout, zéro branche qui traîne (obligatoire)

Décision d'Ulrich, définitive, applicable à tout agent et tout outil (Claude, Codex,
Cursor, Lovable, autres). Ne jamais attendre qu'il la répète, ne jamais demander s'il faut
« nettoyer après ».

**Un lot n'est TERMINÉ que lorsque tout ceci est vrai et vérifié :**

1. Le code est dans `main` sur GitHub, par PR, après CI **verte sur le HEAD exact**
   de la PR. Interdit de fusionner tant que `regression-gates` est `queued`,
   `in_progress` ou rouge : attendre, ou relancer une fois ; ne jamais fusionner « en espérant ».
2. La CI de `main` est verte sur le commit de fusion (E2E compris). Si elle est rouge :
   corriger tout de suite ou revenir en arrière ; ne jamais laisser `main` cassé.
3. La branche du lot est supprimée (distante et locale) et sa PR est fermée ou fusionnée.
   Aucune branche, aucun brouillon, aucune PR ouverte ne reste après un lot.
4. Le compte rendu final dit, vérifié par lecture de GitHub : SHA de `main`, CI de `main`,
   liste des branches restantes (attendu : seulement `main`).

**Règles de conduite associées :**

- **Une seule branche par lot, créée depuis `main` à jour.** Avant de commencer, lister les
  branches et PR ouvertes (`git fetch --prune`, `gh pr list`) : terminer, absorber ou fermer
  l'existant avant d'ouvrir du neuf. Pas de travail parallèle sur les mêmes fichiers.
- **Ne jamais fermer une PR ni supprimer une branche qui contient du travail absent de
  `main`** sans l'avoir d'abord porté dans `main` (ou sans accord explicite d'Ulrich).
- **Ne jamais laisser une PR en brouillon « pour plus tard ».** Soit elle est finie et fusionnée,
  soit elle est fermée avec son travail porté ailleurs.
- **Autorisation durable :** fusionner dans `main` une PR dont la CI est verte sur le HEAD exact
  est autorisé sans redemander. Cela ne publie pas : la **publication de production via Lovable
  reste une étape distincte**, annoncée comme telle (local ≠ GitHub ≠ staging ≠ production).
- **Si une étape ne peut pas être faite** (droit refusé, CI bloquée, conflit non résolu) :
  le lot n'est PAS terminé. Le dire en tête du compte rendu, avec l'unique action précise
  que doit faire Ulrich. Ne jamais écrire « terminé » avec des branches ou PR qui restent.
- Filet automatique : `.github/workflows/prune-branches.yml` supprime les branches terminées
  à la fermeture de chaque PR et chaque lundi. Il ne remplace pas la règle : l'agent supprime
  lui-même sa branche et le vérifie.

## Documentation des plans (obligatoire)

- Tout plan produit ou approuvé pour ce dépôt doit être enregistré dans `docs/`
  dans le même tour, avant ou au moment de son implémentation.
- Utiliser un nom explicite de la forme `docs/plan_<sujet>.md`.
- Si un plan existant couvre déjà le sujet, le mettre à jour plutôt que créer un
  doublon.
- Le compte rendu final doit contenir un lien direct vers le plan sauvegardé.

- The shared experience frame (volunteer role, seen/unseen path, posture) is built only by `src/services/experienceFrame.ts` from the published orchestration config and injected identically into the character prompt and the GM prompt — why: no divergence between what GM and characters know.
- The initial film answer is factual session context shared through the experience frame regardless of editorial frame activation; intro replay must preserve it — why: watching the project introduction does not mean watching the film.
- Hands-free turn decisions stay in `src/services/handsFreeVoice.ts`: end-of-speech uses application timing; the approved barge-in target uses local acoustic candidates followed by recognized speech confirmation. STT providers supply signals and text, not turn decisions. Before changing capture or interruptions, follow [the latency plan, section 3](docs/plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2), including reversible candidate handling and the existing text strategy for rollback — why: fast reactions with consistent behaviour across providers.
