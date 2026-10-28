# GitHub Ava — voie de livraison indépendante du Trousseau

Décision explicite d’Ulrich, 28 octobre 2026, pendant AP2 : aucun recours à
l’app Trousseaux d’accès ni aux commandes/API qui lisent, déverrouillent,
réparent ou modifient le Trousseau macOS. Ulrich signale des perturbations
récurrentes d’Outlook et d’autres connexions ; la causalité technique précise
n’est pas établie ici. Aucune reconnexion personnelle demandée pour livrer Ava.
Cette décision remplace les anciennes pistes de diagnostic et doit survivre
aux reprises. Source canonique de projet : section GitHub d’AGENTS.

## État observé et borne

Connecteur GitHub natif : Unknown tool. GitHub répond sur le réseau.
La session personnelle a été accessible au début d’AP2, puis son accès a été
refusé pendant le push. L’existence d’un identifiant n’est pas une preuve que
le processus peut l’utiliser ; le refus ne prouve pas une expiration.
Aucun login/refresh/logout, déverrouillage, suppression ou remplacement
d’identifiant effectué. Aucun réglage d’Outlook modifié.

La configuration SSH existante cible l’agent 1Password. Une sonde avec
`UseKeychain=no`, `AddKeysToAgent=no` et `BatchMode=yes` n’a trouvé aucune identité
chargée ; arrêt de la sonde en attente. CLI `op` absente lors de cette sonde, puis version officielle 2.41.0 installée
via Homebrew dans ce lot, sans changement du Trousseau ni de la configuration gh. Ne pas répéter les
sondes. La GitHub App de livraison n’est pas configurée : fichier attendu
`~/.config/git-ship/github-app.env` absent. Ne pas annoncer cette voie disponible.

## Intégration 1Password demandée ensuite par Ulrich

Ulrich confirme que 1Password peut servir de voie indépendante pour GitHub.
App 1Password « Fischers » ouverte par Ulrich ; option CLI observée désactivée.
Son activation est un nouvel accès aux secrets : validation explicite demandée
sur cette seule option, avant tout clic ; SDK/MCP restent désactivés. Aucun
élément secret GitHub encore sélectionné ou lu à ce stade.

La CLI officielle 2.41.0 est installée. Lanceur local préparé :
`.github/scripts/github-1password.sh`, avec référence non secrète fournie dans
`AVA_GITHUB_TOKEN_REFERENCE`. Exemple générique, à remplacer par la référence
exacte d’un identifiant GitHub existant et autorisé :

```sh
AVA_GITHUB_TOKEN_REFERENCE='op://COFFRE/ELEMENT/CHAMP' \
  bash .github/scripts/github-1password.sh gh api user --jq .login
```

Le lanceur remet à zéro les helpers Git pour ce seul processus, utilise son helper
limité au chemin HTTPS exact Ava, crée une configuration gh temporaire vide,
la nettoie à la sortie et demande à `op run` de transmettre le jeton en mémoire.
La référence reste une référence, jamais une copie du secret. Aucun alias, login,
refresh, logout ou configuration utilisateur globale modifié. Un identifiant absent,
1Password indisponible, un mauvais remote ou un secret qui n’est pas un jeton
arrête l’exécution ; aucun repli implicite. Le lanceur refuse les commandes `gh auth`.

Quatre tests déterministes passent avec un faux `op`, un faux `gh` et des secrets
fictifs : refus initial, coffre indisponible/secret invalide, isolation et nettoyage
du processus, helper Git limité au seul dépôt et sans stockage. `test:delivery`
exécute ces tests en plus des 23 tests de garde. Aucun jeton réel utilisé dans
ces tests. L’intégration n’est opérationnelle qu’après autorisation CLI, sélection
d’un identifiant adapté, identité/dépôt vérifiés et un push réussi.

Réutiliser d’abord un identifiant GitHub adapté déjà présent dans 1Password.
Le plugin GitHub officiel utilise un jeton d’accès, pas le mot de passe du compte.
Ne pas importer l’ancien identifiant depuis le Trousseau. Si seul un mot de passe
ou une clé SSH est présent, cela ne suffit pas à l’API PR/CI : déclarer ce prérequis,
ne pas fabriquer une réussite. Une nouvelle autorisation GitHub exige des droits
limités et une validation explicite de leur portée.

## Option dédiée GitHub App — pas encore provisionnée

Option de livraison durable : GitHub App privée dédiée à Ava, installée uniquement sur
`memoways/ava-proto1`. Permissions nécessaires à valider à l’installation :
Contents lecture/écriture pour Git, Pull requests lecture/écriture pour la PR et
la fusion, Actions lecture pour attendre les runs/jobs ; Metadata lecture implicite.
Aucun accès aux autres dépôts, aux secrets Actions, à la facturation ou aux
paramètres de compte. Pas d’autorisation OAuth personnelle pour l’exécution.

Clé privée hors du dépôt et hors Trousseau, fichier appartenant à Ulrich,
permissions 0600, emplacement dédié. Les jetons d’installation sont limités au
seul dépôt et aux droits utiles, durent au plus une heure et restent dans la
mémoire du processus. Ni clé ni jeton dans un chat, log, URL Git, commit ou
fichier temporaire persistant.

Les helpers existants dans `_shared/scripts/` sont une base, pas une voie
validée. Avant utilisation, vérifier notamment : permission Actions lecture
dans la demande du jeton, absence de réponse de jeton laissée sur disque à la
sortie via `exec`, absence de repli personnel et neutralisation des helpers Git
implicites. Tester ces propriétés avec des données fictives avant un appel réel.
Ne pas lancer `git-ship` ni `github-auth-check` sans cette protection : leur
repli actuel peut consulter le stockage personnel.

## Étape humaine incompressible

L’accès administratif GitHub nécessaire à créer/installer l’App n’est pas exposé
par un outil natif exploitable dans cette session. Une installation accorde un
nouvel accès : présenter le dépôt et les trois permissions ci-dessus avant cette
validation humaine. Ne pas créer de PAT personnel en solution silencieuse et ne
pas demander de secret dans le chat. L’interface GitHub n’est pas un repli autorisé
aux agents dans Ava ; une intervention sur cette interface doit être explicitement
autorisée ou réalisée par Ulrich. Ne pas confondre préparation et installation.

## Reprise et critère de réussite

Après installation de la seule App dédiée et configuration sécurisée hors dépôt :
1. Vérifier l’identité App et le dépôt exact avec un jeton éphémère, sans /user
   (endpoint inadapté aux jetons d’installation), sans accès au Trousseau.
2. Vérifier lecture de la PR et Actions, puis pousser AP2 sur le remote canonique.
3. Ouvrir/attacher la PR, attendre la campagne complète du HEAD à jour et utiliser
   uniquement la garde versionnée de fusion. Arbre/parent puis Lovable vérifiés.
4. Confirmer que l’exécution sans identité dédiée échoue immédiatement, sans
   solliciter les comptes personnels. Le test simulé de refus doit précéder la
   validation réelle. Aucun changement d’Outlook ni de configuration macOS.

La livraison n’est débloquée qu’après une requête App authentifiée et un push
réussis, pas après l’existence d’un fichier de configuration.

## Sources officielles

- [Permissions minimales d’une GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).
- [Authentification comme installation et jetons limités](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).
- [Reprise exacte AP2](prompt_reprise_atelier_parole_lot_ap2_livraison.md).

- [CLI 1Password, installation officielle](https://www.1password.dev/cli/get-started).
- [Secrets transmis aux processus par op run](https://www.1password.dev/cli/secrets-scripts).
- [Intégration GitHub officielle et nécessité d’un jeton](https://www.1password.dev/cli/shell-plugins/github).


## Activation autorisée et préparation de l’App

Ulrich a autorisé puis fait vérifier l’activation de la seule option CLI dans
1Password. SDK et MCP restent désactivés. Le compte desktop Fischers correspond
au compte CLI fischer-geneve.1password.com. Session CLI autorisée ; les recherches
restent ciblées sur GitHub. Une lecture de métadonnées large et une lecture JSON
complète d’un login ont été refusées par la vérification automatique, sans
contournement ; aucun mot de passe, passkey ou code de secours n’est nécessaire
au mécanisme de livraison préparé.

Ulrich autorise ensuite explicitement la création/installation dans son navigateur
de l’App privée Ava delivery, pour le seul dépôt Ava, avec Contents/Pull requests
write et Actions read, clé conservée dans 1Password. Cette exception navigateur
porte uniquement sur la mise en place de l’accès, pas sur les opérations GitHub
courantes. GitHub a confirmé l’identité Ulrfis et demandé une confirmation sudo
via GitHub Mobile ; aucune authentification macOS n’est lancée.

Le broker `.github/scripts/github-1password-app.mjs` est préparé/testé avec une clé
RSA fictive. La clé réelle serait résolue par `op run`, signée en mémoire pour le
JWT, puis retirée de l’environnement des commandes Git/gh. Jeton d’installation
limité à Ava et aux permissions minimales ; aucune réponse de jeton sur disque.
Deux tests supplémentaires vérifient signature/limitation et les refus d’accès.
`test:delivery` comprend désormais 30 tests. Aucun nouveau contrôle CI supprimé.

Configuration locale non secrète prévue :
`~/.config/git-ship/ava-1password.env`, champs App ID, installation ID, référence
op:// de la clé et compte 1Password. Aucun jeton/PEM dans ce fichier. Le lanceur
la charge comme données, sans l’exécuter comme script. Aucun fallback personnel.
Ne déclarer l’App opérationnelle qu’après token/référentiel/push réels vérifiés.


## Borne actuelle et limites de portée

La demande GitHub Mobile n’a pas été reçue par Ulrich et a expiré. L’onglet
GitHub Confirm access du compte Ulrfis est passé sur la confirmation par mot de
passe avec l’extension 1Password disponible. Remplissage/confirmation directement
par Ulrich demandés ; aucun mot de passe dans le chat. L’App n’est toujours pas
créée et aucun identifiant de livraison réel n’a été installé.

Une protection des scripts partagés github-auth-check et git-ship a été préparée
hors dépôt et testée sur six scénarios simulés. Son application a été refusée
par la vérification automatique, car sa portée aurait affecté les autres projets.
**Aucun de ces deux scripts partagés n’a été modifié.** Leur changement exige une
autorisation explicite de cette portée globale et reste hors de l’intégration Ava
actuelle. Les sauvegardes et patches prévus n’ont pas été appliqués. Pour Ava,
utiliser uniquement le lanceur du dépôt ; ne pas exécuter directement les anciens
helpers. Avec l’App fournie par ce lanceur, les marqueurs App évitent le repli
personnel du helper existant. Les autres projets doivent suivre l’interdiction
générale du Trousseau enregistrée dans la mémoire personnelle.
