# Reprise proposée — contexte de travail, lot CT1

Ce prompt prépare une suite ; il ne vaut pas acceptation des changements de
préférences, de skills ou de contrôle CI. Demander à Ulrich de choisir les trois
décisions du rapport si son message de reprise ne le fait pas déjà. Une demande
explicite de les appliquer constitue cette validation : ne pas la redemander.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, lire `git status`, l'activité
des autres chats Ava et les branches/PR via GitHub ou le repli `git`/`gh`
authentifié déjà autorisé ; vérifier le remote unique
`https://github.com/memoways/ava-proto1`. Si aucun autre agent ne développe,
faire `git fetch --prune`, lire `git log origin/main -6`, puis actualiser main
propre par `git pull --ff-only`. Aucun clone ni worktree adjacent.

## État et sources

Lire AGENTS.md, le début du CHANGELOG,
`docs/audit_contexte_travail_2026-10-28.md` et
`docs/plan_audit_contexte_travail.md` ; ne pas recharger tous les historiques.
Le rapport a mesuré 160 runs qualité du 14 au 28 octobre, dont 129 réussis,
13 rouges et 18 annulés. Deux jobs successifs de #104 : 46 min 42 s,
dont 40 min 28 s d'E2E. Pas un benchmark de vitesse Claude/Codex.

Notion Ava : natif Gamilab, get-self attendu
`7e1a9a09-09cb-4deb-a306-83a29b831bc2` ; tâche
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f.
Contexte personnel : ID `377e8583-7838-4c05-9f76-8833a450f304`, tâche
https://app.notion.com/p/1dec14bb56ec497e866a17dcc85d0d5f.
Vérifier chaque cible avant lecture/écriture ; aucune source Ava dans Ulrich.
Gami DigiDouble exclu. Aucun animal affiché.

GitHub natif a renvoyé `Unknown tool` ; le CLI fonctionne avec `Ulrfis` depuis
le contexte système autorisé. Réutiliser cette identité, sans login/refresh/logout.
Ne pas confondre sandbox/trousseau et expiration OAuth.

## Périmètre proposé, à confirmer depuis la demande de reprise

1. Ava : proposer puis appliquer le contrat « CI complète sur PR une fois »,
   avec HEAD exact, base à jour, vérification de l'arbre fusionné, ADR et garde
   de livraison adaptée. Retrait du second passage complet sur main annoncé
   explicitement ; ne pas supprimer la CI avant fusion. Adapter AGENTS et CLAUDE
   ensemble. Ne pas lancer le `git-ship` actuel qui n'attend pas la CI.
2. Contexte : état courant court, skills lourds sur invocation pertinente,
   doublon visual-plan, seuil arbitraire confidence-check et cible globale vexp.
   Toute modification hors du dépôt doit respecter les permissions système et
   le périmètre choisi ; ne pas appliquer une préférence nouvelle sans accord.
3. Connexions : rendre explicite un diagnostic court et le repli GitHub autorisé.
   Pour Notion, conserver le connecteur natif et les IDs workspace. Corriger le
   routage ou l'exposition d'outil ; ne pas remplacer les secrets.

## Invariants et validations

Un seul agent sur Ava. Préserver PR #24 et branches étrangères. Ne modifier
ni comportement vocal, prompts personnages, réglages Cloud, données ni production.
Lovable reste l'unique chaîne de livraison ; tout accès Cloud/SQL passe par
son MCP Ava `1265958d-b74e-40f2-917d-182fe05163fc`.

Reproduction ciblée des défauts de procédure ; vérifier les conditions de
déclenchement et l'attente de CI par des cas pertinents. Mesurer avant/après sur
un lot comparable ; ne pas promettre un gain de parallélisme sans preuve.
Pas de campagne vocale réelle pour une correction du contexte de développement.
La recette fonctionnelle F4 Max/Emma demeure un chantier distinct.

## Livraison attendue

Une branche depuis main à jour, toutes les modifications et documents avant
le premier push, PR puis contrôles conformes au contrat applicable et fusion,
suppression de notre branche seulement. Distinguer local, GitHub, staging et
production ; citer le SHA main vérifié, les contrôles et les branches restantes.
Mettre à jour les faits durables dans les bonnes entrées Notion et relire les
écritures. Actualiser le plan et livrer dans le même tour un prompt autonome du
lot suivant dans docs/, ou dire explicitement qu'aucun lot ne suit. Ne pas lancer
automatiquement la suite.
