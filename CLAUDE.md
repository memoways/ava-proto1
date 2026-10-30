# CLAUDE.md — Ava Proto 1

Lire `AGENTS.md` (contrat commun), `docs/etat_courant.md`, `git status`, les six
commits récents de main et le début du CHANGELOG. STORY, README et les grands
plans se consultent uniquement pour le domaine touché, pas en entier à chaque reprise.

## Livraison

Un seul agent actif sur Ava ; checkout canonique uniquement, remote
`https://github.com/memoways/ava-proto1`. Vérifier activité/chats, branches et PR,
puis actualiser main propre avant une branche du lot. Préserver PR #24 et travail
étranger ; les détails de coordination d'AGENTS s'appliquent.

CI complète **une fois sur PR**, HEAD exact contenant main à jour. Tout commiter
avant push ; qualité locale et tests de garde verts. Attendre le run et le job
`regression-gates` verts, puis passer obligatoirement par :
`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
Le git-ship personnel délègue à cette garde pour Ava. Elle bloque avant CI verte,
protège le HEAD attendu et vérifie arbre/parent après squash. Aucun second passage
complet sur main ; [ADR](docs/adr_ci_complete_sur_pr.md). Supprimer notre branche
seulement, actualiser main, vérifier GitHub et la synchronisation Lovable.
SHA final et preuve de livraison dans le compte rendu/Notion ; pas de PR de clôture
pour réinscrire ce SHA dans le CHANGELOG. Préparer la reprise suivante avant push.

## Plateforme et sources

Lovable est l'unique chaîne de livraison. Backend/SQL/Edge/secrets via MCP Lovable
Ava `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
`5glbtPltldwz9tgNwIi4` ; aucun Supabase direct ni hébergement alternatif.
Production distincte et soumise à autorisation. Notion Ava : Gamilab natif,
get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2` ; autres IDs dans AGENTS.
Gami DigiDouble exclu, aucun animal affiché.

GitHub : voie directe sans demande, App locale à clé fichier (décision
« GitHub — accès direct » d’AGENTS). `git` nu fonctionne dans Ava ; `gh` et la
garde passent par `~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais
`gh` nu. 1Password seulement en secours, une session par lot. Aucun accès au
Trousseau, aucune demande de déverrouillage ou reconnexion personnelle. Notion reste natif.

## Invariants utiles au développement

- React/TypeScript ; façade `src/services/stt` seule entrée STT.
- Secrets côté serveur uniquement. L'accès anon dépend des RLS ; un SELECT bloqué
  peut rendre zéro ligne sans erreur. Résumé via cache de `sessionMemoryService`.
- Prompts éditoriaux dans Notion ; défauts de `settingsService.ts` peuvent être
  surchargés par admin_settings/localStorage. Vérifier les sources avant changement.
- Activation Gamilab STT en production à valider avec Nicolas Goy.
- Invariants expérience/parole/mains libres/export : fin d'AGENTS ; les lire avant
  de toucher ces modules. Les scripts disponibles sont dans package.json.

Skills lourds seulement sur invocation pertinente ; une demande d'implémentation
déjà approuvée ne recrée pas une étape d'approbation du plan. Plans dans docs et
passation selon AGENTS. Référence équipe au besoin :
`~/CodeProjects/_shared/agent-context/00-memoways-context.md`.
