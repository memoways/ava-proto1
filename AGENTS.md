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

## Démarrage et contexte courant

Lire `docs/etat_courant.md`, `git status`, les six derniers commits de
`origin/main` et le début du CHANGELOG. Consulter STORY et les plans historiques
seulement pour le domaine touché. Un seul workflow pertinent par tâche ; charger
un skill lourd sur demande ou si son livrable est réellement nécessaire.

Un seul agent actif sur Ava. Avant d'écrire : vérifier les chats actifs, le remote
unique, les branches et PR ouvertes, `git fetch --prune`, puis main propre par
`git pull --ff-only`. Une branche du lot depuis ce main. Préserver les PR/branches
étrangères ; si elles ont bougé depuis moins de 24 h, demander à Ulrich avant toute
intervention. Aucun recouvrement de fichiers avec une PR ouverte. La PR historique
#24 et les branches locales antérieures sont des exceptions à signaler, pas à purger.

## Livraison — CI complète sur PR une fois

Décision approuvée par Ulrich le 28 octobre 2026 ; justification et limites :
[ADR CT1](docs/adr_ci_complete_sur_pr.md). Cette règle remplace explicitement
l'obligation précédente de rejouer les E2E sur main après chaque fusion.

1. Reproduction ciblée et validations locales adaptées ; pour un lot de code,
   `npm run test:quality` et `npm run test:delivery` verts avant push. Tout le lot
   (code, tests, plan, prompts, CHANGELOG) est commité avant le premier push.
2. La CI `Core experience quality` teste le HEAD exact de la PR, contenant main
   à jour. Attendre run **et** job `regression-gates` verts, jamais queued,
   in_progress, skipped ou rouge. Une relance bornée est permise après diagnostic ;
   si le code ou la base change, obtenir la CI du nouveau HEAD.
3. Fusion squash autorisée sans redemander, uniquement via la garde versionnée :
   `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
   Elle attend la CI, revérifie HEAD/base, fournit le SHA attendu à GitHub et
   compare arbre et parent du commit fusionné. `git-ship` doit déléguer à cette
   garde sur Ava ; aucun merge direct ni auto-merge qui saute ces vérifications.
4. Après fusion, vérifier main sur GitHub : arbre identique au HEAD testé et
   parent égal à la base vérifiée. **Aucune seconde campagne complète sur main.**
   Un arbre/parent différent laisse le lot ouvert : diagnostiquer et corriger ou
   revenir au dernier état validé avant de conclure. La garde ne protège pas le
   serveur contre un merge manuel qui la contourne ; ne pas la présenter ainsi.
5. Supprimer notre seule branche distante puis locale après mise à jour du
   checkout main. Vérifier sa PR fusionnée, main propre et branches restantes.
   Ne jamais fermer une PR ni supprimer du travail absent de main sans accord.
6. Vérifier Lovable Ava/Memoways synchronisé ; séparer livraison GitHub,
   preview/staging et production. Une fusion ne publie pas : publication Lovable
   sur autorisation distincte. Si une étape bloque, annoncer le lot incomplet
   avec l'unique action d'Ulrich indispensable, sans lui déléguer l'attente de CI.

Le CHANGELOG décrit le lot avant push et référence la PR une fois connue dans le
compte rendu ; le SHA final de main et le reçu de la garde sont dans ce compte
rendu et Notion. Aucune seconde PR documentaire pour inscrire un futur SHA dans
son propre contenu. Le bilan donne SHA main, CI PR/HEAD, arbre vérifié, absence
attendue de campagne main, branches restantes et ce qui reste à valider.

## Connexions — diagnostic borné

Une sonde d'identité puis une lecture de ressource suffisent au premier diagnostic.
Classer : outil absent/Unknown tool, réseau/sandbox, stockage sécurisé, mauvais
workspace ou refus distant. Un échec isolé ne prouve pas une expiration OAuth.
GitHub natif en priorité ; si son outil est indisponible, repli `git`/`gh` autorisé
par Ulrich, identité existante et remote exact vérifiés depuis le contexte système
autorisé. Ne pas répéter les sondes identiques ni réinstaller/réauthentifier.
Notion reste sur le connecteur natif du workspace voulu ; si indisponible, signaler
les lectures/écritures non faites, poursuivre les travaux indépendants autorisés,
sans navigateur ni transfert de sources. Détails d'identité dans le routage ci-dessus.

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
vérifier que le code est inchangé et citer sa dernière CI verte. Les lots de code suivent le contrôle PR/HEAD exact et la comparaison de l’arbre
fusionné décrits ci-dessus, sans seconde campagne complète sur main.

- The shared experience frame (volunteer role, seen/unseen path, posture) is built only by `src/services/experienceFrame.ts` from the published orchestration config and injected identically into the character prompt and the GM prompt — why: no divergence between what GM and characters know.
- The initial film answer is factual session context shared through the experience frame regardless of editorial frame activation; intro replay must preserve it — why: watching the project introduction does not mean watching the film.
- Character speech runtime is resolved by the session-scoped authorized RPC; orchestration uses uncached neutral styling on a bounded lookup failure, records its unavailable/timeout status without inventing a settings version, and retries next turn; every prompt compiler selects the character's own speaking field, and only delivered, validated states enter the GM log — why: optional styling must not silence characters or misrepresent authorized snapshots.
- Speech-state prosody is an environment-scoped deterministic TTS mapping, configured before incremental setup; auditions use isolated provider voices and Gradium emotional tags remain capability-gated off — why: audible character states without extra LLM calls, production changes or speculative vendor tags.
- Hands-free turn decisions stay in `src/services/handsFreeVoice.ts`: end-of-speech uses application timing; the approved barge-in target uses local acoustic candidates followed by recognized speech confirmation. STT providers supply signals and text, not turn decisions. Before changing capture or interruptions, follow [the latency plan, section 3](docs/plan_optimisation_latence_voice_to_voice.md#3-écoute-libre-et-interruptions--p2), including reversible candidate handling and the existing text strategy for rollback — why: fast reactions with consistent behaviour across providers.

<!-- LOVABLE:BEGIN -->
- Admin Markdown exports use a pure report formatter and a separate authorized paginated reader/download helper, with explicit missing-diagnostic warnings and no full prompt traces — why: exports remain testable and private without changing the conversation pipeline or conflating latency sources.
<!-- LOVABLE:END -->
