# Instructions de plateforme — Ava Proto 1

## Notion Ava : workspace Gamilab (obligatoire)

**Pour le projet Ava, le workspace Notion est TOUJOURS Gamilab.** Décision
explicite d'Ulrich du 25 octobre 2026, à réutiliser entre sessions sans lui
redemander ce choix. Cette règle de projet prime sur le routage personnel vers
Ulrich / Ulrich Fischer (`377e8583-7838-4c05-9f76-8833a450f304`), qui concerne
sa mémoire personnelle et ne valide pas l'accès aux sources Ava.

- Base éditoriale Caractères AVA :
  https://app.notion.com/p/gamilab-prov/30362322e59580bbb7b8dd49d516b341.
  Max actif : `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9` ;
  Emma active : `dfcc15f8-9d37-45f7-8c84-d0c24a4288cf`.
  Vérifiés le 26 octobre 2026 : statut « En cours », copies Lovable concordantes.
  Les anciennes pages `3f762322-e595-81ba-8241-c7f6b28f31fd` et
  `3f762322-e595-81f9-880f-e309adec7075` sont des Backup depuis le 25 octobre.
  Rapport éditorial : https://app.notion.com/p/40462322e59580ca98a4d6148d8ce406.
- Utiliser une connexion MCP native Notion ciblant Gamilab pour les lectures,
  recherches et écritures des sources projet. Vérifier sa cible avant d'agir ;
  l'ID confirmé par `get-self` le 26 octobre 2026 est
  **`7e1a9a09-09cb-4deb-a306-83a29b831bc2`**. La connexion native
  `notion_gamilab` est rétablie ; Max et Emma ont été lus par ce connecteur.
  Comparer l'ID retourné à cette référence, sans le déduire d'une page ou base.
- Si la connexion exposée annonce Ulrich, identifier un mauvais routage pour
  Ava. Un NOT_FOUND obtenu dans ce contexte ne prouve ni une expiration du
  connecteur, ni un défaut de partage des pages, ni un retard de synchronisation.
  Utiliser la connexion Gamilab si elle est exploitable ; sinon distinguer sa
  configuration de sa disponibilité dans la session, sans demander à nouveau quel workspace choisir
  ni faire transférer les sources dans Ulrich. Aucun contournement navigateur.
- Réutiliser les connexions Notion et identifiants OAuth déjà enregistrés.
  Avant de demander une réautorisation, vérifier la configuration et le client
  actifs, le stockage OAuth depuis un contexte système autorisé et le démarrage
  du MCP natif. Un statut inconnu en sandbox ou « OAuth authorization required »
  dans un seul contexte ne démontre pas une expiration. Ne pas relancer
  login/logout, supprimer ou remplacer les identifiants pour contourner un
  problème d'accès au trousseau ou de routage de session.
- Notion porte les prompts éditoriaux des personnages ; l'app en règle et
  réalise le rendu. Les propositions de changement des champs Notion restent
  séparées des réglages de l'app. Ulrich confirme leur synchronisation à jour
  au 25 octobre 2026 ; ne pas diagnostiquer un retard depuis un refus d'accès.

## Chaîne de développement et de publication (obligatoire)

**Lovable est la plateforme de référence et l'unique chaîne de livraison de ce projet.**

- Lovable compile le code et publie le site.
- Le backend, la base de données, les Edge Functions et les secrets sont gérés dans **Lovable Cloud**, avec **Supabase fourni par Lovable**.
- **Accès à la base : passer par le connecteur MCP Lovable du projet Ava** (`1265958d-b74e-40f2-917d-182fe05163fc`), y compris pour les lectures SQL et le diagnostic. Il n'existe pas de connexion Supabase directe pour ce projet : ne pas le chercher dans le connecteur Supabase générique et ne pas demander de reconnexion Supabase. Cette exception de projet prime sur la règle personnelle générale de routage Supabase (confirmation d'Ulrich, 23 octobre 2026).
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

- **Un seul agent actif à la fois sur ce dépôt** (Codex, Claude, Cursor, Lovable ou autre).
  Avant toute action, regarder l'activité récente : `git fetch --prune`, derniers commits de
  `main`, PR et branches ouvertes. Si une branche ou une PR d'un autre agent a bougé depuis
  moins de 24 h, ne pas la fusionner, la fermer, la modifier ni la supprimer : demander à Ulrich.
  Ne jamais ouvrir un lot qui touche les mêmes fichiers qu'une PR ouverte. Chaque agent fusionne
  et nettoie uniquement ses propres PR et branches.
- **Après chaque fusion dans `main`, rendre l'état lisible pour l'agent suivant** : entrée au
  CHANGELOG avec le SHA de `main`, et ce qui reste à valider (recette humaine, publication Lovable).
  Un agent qui reprend lit d'abord `git log origin/main` et le CHANGELOG, puis met son checkout à jour
  (`git fetch --prune`, `git pull`) avant d'écrire une ligne.
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
- **Pousser jusqu'à `main` avant de rendre la main (Ulrich, 27 octobre 2026).** À la fin
  d'un développement, l'agent pousse, attend lui-même la CI dans la même session et
  fusionne dans `main` dès qu'elle est verte. Il ne livre jamais à Ulrich ni à Lovable
  un prompt, un test ou une action qui dépend d'une PR non fusionnée : un prompt Lovable
  cite le SHA de `main` qui contient le correctif. Tout ce que le lot doit contenir
  (code, tests, plan, prompts) est commité **avant** le premier push : un commit ajouté
  pendant que la CI tourne la relance et retarde la livraison d'environ 20 minutes.
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

## Prompt de reprise à chaque clôture (obligatoire)

- Lorsqu'un prochain lot est identifié, livrer son prompt autonome dans le même
  tour que la clôture : `docs/prompt_reprise_<sujet>_lot_<id>.md`.
- Le prompt contient l'état vérifié, les sources, le périmètre, les invariants,
  les validations, la livraison attendue et la première action exécutable.
  Distinguer livraison technique et recette humaine ; actualiser le plan existant.
- Donner le lien direct du prompt dans le compte rendu final. Un simple nom de
  prochain lot ou une proposition de le préparer plus tard ne suffit pas.
- Inclure cette même obligation dans le prompt transmis. Si aucun lot ne suit,
  le dire explicitement. Cette passation ne lance pas le lot suivant.

Les corrections strictement documentaires appliquent l'exception CI personnelle
« ignorer les lots purement documentaires » : relire contenu, liens et diff,
vérifier que le code est inchangé et citer sa dernière CI verte. Les contrôles
CI sur le HEAD exact et sur main restent obligatoires pour les lots de code.

- The shared experience frame (volunteer role, seen/unseen path, posture) is built only by `src/services/experienceFrame.ts` from the published orchestration config and injected identically into the character prompt and the GM prompt — why: no divergence between what GM and characters know.
- The initial film answer is factual session context shared through the experience frame regardless of editorial frame activation; intro replay must preserve it — why: watching the project introduction does not mean watching the film.
- Character speech runtime is resolved by the session-scoped authorized RPC; orchestration uses uncached neutral styling on a bounded lookup failure, records its unavailable/timeout status without inventing a settings version, and retries next turn; every prompt compiler selects the character's own speaking field, and only delivered, validated states enter the GM log — why: optional styling must not silence characters or misrepresent authorized snapshots.
- Speech-state prosody is an environment-scoped deterministic TTS mapping, configured before incremental setup; auditions use isolated provider voices and Gradium emotional tags remain capability-gated off — why: audible character states without extra LLM calls, production changes or speculative vendor tags.
- Hands-free turn decisions stay in `src/services/handsFreeVoice.ts`: end-of-speech uses application timing; the approved barge-in target uses local acoustic candidates followed by recognized speech confirmation. STT providers supply signals and text, not turn decisions. Before changing capture or interruptions, follow [the latency plan, section 3](docs/plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2), including reversible candidate handling and the existing text strategy for rollback — why: fast reactions with consistent behaviour across providers.
