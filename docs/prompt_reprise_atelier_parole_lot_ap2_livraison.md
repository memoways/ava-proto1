# Ava — reprise de livraison AP2

Ce document est committé avant la livraison. **Lire d’abord le reçu réel dans la
PR AP2 et la tâche Gamilab** : si fusion, arbre/parent et preview sont vérifiés,
ne pas recréer de branche, PR ou campagne CI. Passer au prompt AP3 uniquement
sur demande d’Ulrich. En cas d’étape incomplète, reprendre celle-ci ci-dessous.

## Première action et sources

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, `git status --short --branch`,
lire AGENTS, état courant, CHANGELOG, bilan AP2 du plan et
`docs/plan_authentification_github_sans_trousseau.md`. Vérifier un seul chat actif.
Remote unique `https://github.com/memoways/ava-proto1` ; préserver #24 et les 16
branches historiques, aucun clone/worktree adjacent, aucun sous-agent.
Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

Branche de réalisation : `codex/ap2-atelier-unique-variantes`, premier commit
`6e3e50ed2a3c2bb1bfe5bbe487d6923f6da65360`. Lire le HEAD et le statut réels ;
les finitions et l’accès dédié sont committés ensuite. Base vérifiée avant push :
`54e7bfa818f7db04b61be7068e145535e412d695`, ancêtre du HEAD.
Aucune future valeur de squash n’est inventée dans ce document pré-livraison.

## État vérifié

Atelier unique ; TTS Config sans génération ; quatre étapes ; options expertes
repliées ; comparaisons/avis persistants admin/sandbox, clé hors `ava_`, CAS et
relecture exacte, reprise en brouillon, export, aucune activation live. Contexte
réinitialisé au changement de sandbox et résultats tardifs ignorés.

Qualité complète locale finale verte : 71 régressions, 1 131 unitaires,
42 intégrations, lint/typage/build. Livraison 35/35, dont format stateless GitHub.
E2E ciblé final vert, 5,8 s / 8,5 s avec serveur, sans retry, clavier et 390 px,
audio/données simulés. Aucune écoute réelle ni compréhension humaine acceptée.

App privée `ava-delivery` ID 5515307, installation 176291841 sur le seul dépôt
Ava, Contents/PR write et Actions/Metadata read. Clé dans 1Password Privé Fischers ;
API réelle vérifiée, copie PEM temporaire supprimée. Configuration de références
non secrètes `~/.config/git-ship/ava-1password.env`. **Ouvrir une seule session**
`bash .github/scripts/github-1password.sh session` puis y transmettre les commandes
JSON, pour Git/gh et la garde. Ne pas résoudre le coffre commande par commande. Aucun Trousseau, reconnexion personnelle ou helper partagé direct.
Ne pas recréer l’App ni générer une clé. Une clé initiale non récupérée reste
côté GitHub ; révocation distincte non effectuée, voir plan d’accès.

## Finir uniquement les étapes manquantes

1. Lire les PR et actualiser origin par le lanceur dédié. Vérifier main ancêtre
   du HEAD et absence de recouvrement avec #24. Tout le lot est committé avant
   le premier push réussi ; ne pas publier un état intermédiaire.
2. Pousser notre branche, créer/attacher la PR, attendre run ET regression-gates
   success sur le HEAD exact contenant main à jour ; ne pas déléguer cette attente.
3. Fusionner uniquement par le lanceur et
   `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`.
   Conserver le reçu arbre/parent, SHA main, base, HEAD et run. Aucun second
   passage complet sur main. Si la base a bougé, adapter et obtenir la CI du HEAD.
4. Actualiser main propre par fetch/pull ff-only, supprimer uniquement notre
   branche distante puis locale après vérification. Préserver tout travail étranger.
5. Vérifier Lovable synchronisé et l’écran réellement servi dans la preview admin
   authentifiée, desktop/mobile/clavier. Un ready/SHA seul ne garantit pas le rendu.
   Aucun audio fournisseur automatique ni réglage live ; documents dédiés si recette.
6. Relire/actualiser la tâche Gamilab, conserver Source/historique et Last updated
   by Codex, relire l’écriture. Donner PR/SHA/CI/arbre/parent, branches restantes,
   local/GitHub/preview/production et durées CT2 travail/attente distinctes.

Notion Ava Gamilab natif : get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, tâche
https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d. Aucun navigateur Notion.
Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways `5glbtPltldwz9tgNwIi4`,
seule chaîne SQL/Cloud/build/preview. Aucun Supabase direct, Gami DigiDouble exclu,
aucun animal affiché. Production sur autorisation distincte, aucune publication ici.

Le [prompt AP3](prompt_reprise_atelier_parole_lot_ap3.md) prépare la première écoute
accompagnée Max sans la lancer. **Donner son lien direct à la clôture AP2.**
Chaque prochain lot doit enregistrer et lier son propre prompt suivant dans le même
tour. En cas de blocage, actualiser cette reprise exacte et le plan d’accès.


Borne de diagnostic après le premier run : #111 non fusionnée, CI 40751731709
rouge (AP2 Firefox, 111 autres E2E verts). Fixture audio locale corrigée, trois
navigateurs et Firefox strict verts ; session de livraison ajoutée/testée avec un
faux coffre compté une seule fois pour cinq commandes. Suivi CI à une minute.
Lire le HEAD/statut réels : ces finitions sont à committer avant le prochain push.
La première ouverture réelle a expiré, sans relance. Après réponse « prêt »
d’Ulrich, une session a abouti, traces CI et fetch sur la même clé en mémoire.
Ne pas créer une rafale d’autorisations ; réutiliser la session tant qu’elle est
active. Si elle est terminée, une seule ouverture quand Ulrich est disponible.
Après autorisation, réutiliser cette session pour diagnostic/PR/CI/garde/nettoyage,
sans nouvel op par commande. Faire valider le nouveau HEAD par CI avant fusion.
