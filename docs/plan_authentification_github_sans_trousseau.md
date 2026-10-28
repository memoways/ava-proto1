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
chargée ; arrêt de la sonde en attente. CLI `op` absent. Ne pas répéter les
sondes. La GitHub App de livraison n’est pas configurée : fichier attendu
`~/.config/git-ship/github-app.env` absent. Ne pas annoncer cette voie disponible.

## Cible préparée — pas encore provisionnée

GitHub App privée dédiée à Ava, installée uniquement sur
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
