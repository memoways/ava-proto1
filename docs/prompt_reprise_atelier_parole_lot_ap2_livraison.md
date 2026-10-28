# Ava — reprise exacte AP2, livraison restant à faire

AP2 est implémenté et validé localement ; il n’est pas livré sur GitHub/Lovable.
Ne pas recommencer son implémentation ni restaurer main. Un agent, aucun sous-agent,
checkout `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote unique
`https://github.com/memoways/ava-proto1`. Préserver #24 et toutes les branches
historiques ; aucun clone/worktree adjacent, `.vexp/` local non versionné.

Première action : `git status --short --branch`, puis lire AGENTS, état courant,
CHANGELOG, bilan AP2 du plan et `docs/plan_authentification_github_sans_trousseau.md`.
**Aucun accès au Trousseau**, ni app, ni commande/API, ni demande de déverrouillage,
ni reconnexion GitHub personnelle. Ne pas exécuter gh/git authentifiés avec leurs
helpers personnels implicites. La voie dédiée doit être établie d’abord.

État : branche `codex/ap2-atelier-unique-variantes`. Premier commit AP2
`6e3e50ed2a3c2bb1bfe5bbe487d6923f6da65360` ; finitions de contexte et ce point de
reprise committés ensuite avant tout premier push réussi. Lire le HEAD réel.
Aucun push réussi, aucune PR AP2, aucune campagne CI AP2 ni fusion ; main reste
`54e7bfa818f7db04b61be7068e145535e412d695`. Aucun changement produit dans la preview,
aucune publication production. Les autres PR/branches sont préservées.

Fait : un atelier unique ; TTS Config sans génération ; parcours quatre étapes,
options avancées repliées, comparaisons/avis nommés persistants, clé admin hors
`ava_`, CAS/readback exact, reprise en brouillon, exports, aucune activation live.
Dernière qualité locale : 71 régressions, 1 131 unitaires, 42 intégrations,
lint/typage/build verts ; garde 23/23. E2E ciblé final vert 5,1 s / 6,6 s avec
serveur, audio/données simulés, clavier et 390 px. Test supplémentaire de changement
d’environnement pendant une sauvegarde vert : ancien résultat ignoré, nouveau
contexte réinitialisé. Le plan précise les limites ; aucune écoute réelle ni
compréhension humaine acceptée. Tests après modifications supplémentaires si besoin.

Accès : Gamilab natif vérifié `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, tâche
https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d ; aucun Notion navigateur.
Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways
`5glbtPltldwz9tgNwIi4`, seule chaîne Cloud/SQL/build/preview. Aucune connexion
Supabase directe. Gami DigiDouble exclu, aucun animal affiché.

Reste : établir l’identité GitHub indépendante prévue dans le plan d’accès,
puis pousser tout le lot, créer et attacher sa PR, attendre run et regression-gates
success sur HEAD contenant main à jour, fusionner uniquement par
`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`, vérifier
arbre/parent, nettoyer seulement notre branche après actualisation du main propre.
Aucune seconde campagne complète main. Ne déléguer aucune attente CI à Ulrich.
Vérifier Lovable synchronisé et l’écran effectivement servi sur la preview
admin authentifiée, desktop/mobile/clavier. Un ready/SHA seul ne garantit pas
la reconstruction. Toute recette Cloud utilise des documents dédiés ; aucun
réglage du jeu modifié et aucun audio fournisseur lancé automatiquement.

Notion : relire la tâche avant édition, conserver Source/historique, Last updated
by : Codex, relire chaque écriture. Donner bilan PR/SHA/CI/arbre/parent, branches,
local/GitHub/preview/production et durées CT2 travail/attente distinctes.

Le prompt AP3 est déjà enregistré dans
`docs/prompt_reprise_atelier_parole_lot_ap3.md` : il prépare la première écoute
accompagnée Max sans la lancer. **Donner son lien direct à la clôture AP2**.
En cas de nouveau blocage, actualiser cette reprise exacte dans le même tour.
Chaque clôture d’un lot futur doit enregistrer et lier son prompt suivant.


Mise à jour accès : CLI officielle 1Password 2.41.0 installée, seule intégration CLI
activée après accord explicite ; compte Fischers confirmé. Lanceur Ava et broker
App sont préparés, 30 tests de livraison verts. App privée créée ID 5515307 et installation 176291841 vérifiée sur le seul
dépôt Ava, permissions exactes approuvées. Clé téléchargée temporairement, 0600 ;
stockage 1Password en attente de validation Touch ID, aucun token API réel vérifié.
Ne pas recréer l’App ni générer de nouvelle clé ; lire la borne du plan d’accès. Ulrich a autorisé la création
et l’installation de l’App privée limitée à Ava (Contents/PR write, Actions read)
et sa clé dans 1Password, ainsi que cette seule opération d’interface GitHub.
Les scripts partagés n’ont pas été modifiés : revue automatique défavorable
à l’impact sur les autres projets. Ne pas utiliser leurs anciens replis.
Qualité complète répétée après ajout des scripts : une passe a rencontré des
hooks Postgres dépassant 10 s ; les 42 intégrations sont revenues vertes sans
modification, puis qualité complète à nouveau verte. Aucun contrôle retiré.

Dernier E2E ciblé final : 5,8 s / 8,5 s avec serveur, sans retry. Le dernier
commit local inclut les cinq scripts/tests 1Password et la documentation de
l’activation CLI autorisée. Vérifier son SHA par git rev-parse HEAD.
