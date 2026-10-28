# Reprise CT2 — mesurer la livraison simplifiée sur un lot comparable

Ce prompt prépare la suite ; il ne la lance pas. CT1 a été autorisé par Ulrich
le 28 octobre 2026 (« Appliquer les trois »). Ne pas redemander cet accord.
CT2 mesure un prochain lot fonctionnel choisi par Ulrich ; il n'en invente pas un
et n'ouvre pas de campagne vocale réelle pour tester le contexte de développement.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, lire `git status` et le remote
unique `https://github.com/memoways/ava-proto1`. Vérifier activité des chats et PR
via GitHub natif, sinon git/gh avec l'identité existante vérifiée (repli autorisé).
S'il n'y a pas d'autre agent, `git fetch --prune`, `git log origin/main -6`, puis
main propre par `git pull --ff-only`. Préserver PR #24 et branches historiques.
Aucun clone/worktree adjacent et aucun recouvrement avec une PR ouverte.

## État et sources à lire

Lire AGENTS, le début du CHANGELOG, `docs/etat_courant.md`,
`docs/plan_audit_contexte_travail.md`, `docs/adr_ci_complete_sur_pr.md` et
`docs/livraison_contexte_travail_ct1.md`. Les historiques se consultent seulement
pour le domaine du lot choisi. Retrouver le SHA réel de CT1 dans le log GitHub et
sa PR ; le reçu de livraison et la note Notion portent le SHA final, pas une PR
documentaire ajoutée pour le réinscrire dans son propre contenu.

État vérifié lors de l'écriture avant le premier push CT1 : base main
`a9f5c72d357d09daedb0d09b0801a7eb766623b5`, checkout du lot
`codex/context-workflow-ct1`, 23 tests de garde, 1 115 unitaires, 42 intégrations,
71 régressions, lint/typage/build verts. Le compte rendu final doit confirmer
PR/CI/fusion/nettoyage/synchronisation avant de présenter ce prompt comme livré.
Lire main actuel, ne pas restaurer cette ancienne base.

Notion Ava : Gamilab natif get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, tâche
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f.
Personnel : `377e8583-7838-4c05-9f76-8833a450f304`, tâche
https://app.notion.com/p/1dec14bb56ec497e866a17dcc85d0d5f.
Vérifier chaque cible avant lecture/écriture ; aucune source Ava dans Ulrich.
Gami DigiDouble exclu, aucun animal affiché, aucun navigateur en repli Notion.

## Périmètre

1. Dans un nouveau chat, confirmer que l'état court et le routage sont chargés,
   que visual-plan n'apparaît plus en double et que les skills lourds ne sont pas
   choisis sur une correction ordinaire. Leur invocation explicite reste possible.
   Confirmer vexp Ava par la config résolue avant usage, sans index d'autre dépôt.
2. Sur le lot fonctionnel demandé, noter durée jusqu'au premier push, run qualité,
   job, qualité, installation navigateurs, E2E, éventuels retries/annulations et
   durée jusqu'à la fusion. Distinguer attente et travail, pas de moyenne de lots
   hétérogènes ni de promesse de parallélisme.
3. Comparer prudemment à #104 : PR 22 min 26 s, main 24 min 16 s, total 46 min 42 s
   de jobs dont 40 min 28 s d'E2E. La suppression d'un passage n'est pas une preuve
   de vitesse du modèle. Si la campagne restante demeure longue, proposer une
   exploration d'isolation E2E séparée, sans paralléliser ici.

## Invariants et livraison

CI complète une fois sur PR/HEAD exact contenant main. Tout commiter avant push,
qualité locale puis `npm run test:delivery`. Attendre la garde :
`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
Ne jamais appeler un merge direct ; après squash, arbre/parent vérifiés et main
relus, notre branche supprimée. Absence de campagne complète main attendue.

Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways `5glbtPltldwz9tgNwIi4`
reste l'unique chaîne ; SQL/Cloud uniquement par ce MCP. Aucun changement Cloud,
secrets, publication, prompts personnages ou réglages vocaux pour une mesure CI.
F4 Max/Emma reste une recette humaine distincte, à choisir séparément.

Le bilan distingue local, GitHub, staging et production ; cite SHA main, CI/HEAD,
arbre vérifié et branches restantes. Actualiser le plan existant et les faits
durables dans les bonnes entrées Notion, avec relecture des écritures, Source
préservée et Last updated by. À la clôture, livrer dans le même tour le prompt
autonome du prochain lot identifié dans docs avec lien direct, ou dire qu'aucun
lot ne suit. Cette obligation reste incluse dans ce prochain prompt. Ne pas lancer
automatiquement la suite.
