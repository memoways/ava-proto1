# GitHub Ava — livraison indépendante du Trousseau

Décision explicite d’Ulrich du 28 octobre 2026 : aucun recours à l’app Trousseaux
d’accès ni aux commandes/API qui lisent, déverrouillent, réparent ou modifient ce
stockage. Aucune reconnexion GitHub personnelle. Ulrich rapporte des perturbations
d’Outlook ; leur causalité technique n’est pas établie ici. Cette décision prime
sur les anciennes consignes de diagnostic et doit survivre aux reprises.

## Voie installée et vérifiée

- Compte 1Password : Fischers, `fischer-geneve.1password.com`, coffre Privé.
- CLI officielle 2.41.0 installée via Homebrew ; seule intégration CLI activée
  après accord explicite, options SDK et MCP désactivées.
- App privée `ava-delivery`, propriétaire `memoways`, ID `5515307`.
- [Installation 176291841](https://github.com/organizations/memoways/settings/installations/176291841) :
  **seul dépôt `memoways/ava-proto1`**, Contents/Pull requests write,
  Actions/Metadata read. Aucun droit compte/organisation, secret Actions,
  facturation, webhook actif ou OAuth utilisateur.
- Clé de l’App enregistrée dans l’élément dédié « Ava delivery GitHub App » de
  1Password. La configuration locale ne contient qu’une référence op://, les
  deux identifiants App/installation et le compte 1Password.
- Accès réel authentifié vérifié : création du jeton acceptée (201), permissions
  exactes, puis `installation/repositories` retourne un seul dépôt, Ava (200).
  La copie PEM temporaire a été supprimée après cette vérification.

Ulrich a explicitement autorisé la création/installation et le stockage de cette
clé dans 1Password. Son autorisation d’interface GitHub porte sur cette seule
mise en place, pas sur la gestion courante des PR ou fusions par navigateur.
Le push et la livraison AP2 se vérifient séparément dans le reçu PR/Notion.

## Réutilisation entre sessions

Depuis le checkout canonique, pour toute commande authentifiée :

```sh
bash .github/scripts/github-1password.sh gh api installation/repositories
bash .github/scripts/github-1password.sh git fetch --prune origin
bash .github/scripts/github-1password.sh node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge
```

Le lanceur lit `~/.config/git-ship/ava-1password.env` comme données, sans `source`.
Champs : `AVA_GITHUB_APP_ID`, `AVA_GITHUB_APP_INSTALLATION_ID`,
`AVA_GITHUB_APP_KEY_REFERENCE`, `OP_ACCOUNT`. Ce fichier non secret est en 0600 ;
aucun PEM/jeton dedans. Ne pas recréer une App/clé par session, agent ou worktree.

Le lanceur vérifie le remote HTTPS Ava avant l’accès au coffre, remet à zéro les
helpers Git pour le seul processus, ajoute son helper limité au chemin Ava,
interdit les prompts Git et les commandes `gh auth`, puis crée une configuration
gh temporaire vide. Aucun alias ou profil personnel modifié. Le broker reçoit
la clé par `op run`, signe le JWT en mémoire, retire la clé de l’environnement
du processus enfant et demande un jeton limité au seul dépôt et aux droits utiles.
Les jetons durent au plus une heure ; aucune réponse de jeton sur disque.

Une configuration absente/invalide, un coffre indisponible, un refus distant ou
un périmètre de dépôt différent provoque un échec explicite. Aucun retour
silencieux vers les comptes personnels. Le mode PAT préparé n’a pas été provisionné
et n’est pas nécessaire à cette installation. Ne jamais importer l’ancien jeton
depuis le Trousseau ni lire le login personnel GitHub pour livrer Ava.

## Diagnostic borné et vérifications

GitHub natif : `Unknown tool` constaté, sans nouvelle sonde identique. Repli
Git/gh autorisé avec le lanceur ci-dessus. Un refus de stockage ou un contexte
sandbox ne démontre pas une expiration ; ne pas lancer login/refresh/logout.
1Password peut demander Touch ID : une validation n’est pas une nouvelle
reconnexion GitHub. Après une attente expirée, ne pas multiplier les demandes.

Pendant la mise en place, une lecture de modèle vide en sous-processus est restée
en attente. L’élément a ensuite été créé directement par JSON sur stdin, sans
secret dans les arguments ou la sortie. Une validation de jeton trop stricte a
refusé le format stateless actuel contenant des points : correction pour traiter
le jeton comme opaque, conserver le préfixe/type et refuser les contrôles/espaces,
avec vérification indépendante du dépôt retourné. Aucun décodage de son JWT.

`npm run test:delivery` : 31 tests déterministes (23 garde, 8 accès isolé/App),
clés RSA/jetons fictifs. Couverture : configuration absente, mauvais remote,
coffre indisponible, helper limité à Ava et sans stockage, nettoyage du processus,
absence de clé dans l’enfant, signature JWT, demande minimale de droits, refus
API/périmètre élargi, format stateless long et valeurs de jeton malformées.
Aucun contrôle CI retiré.

## Limites conservées

Deux clés ont été générées : le premier téléchargement a été bloqué par Brave ;
le second, via l’événement de téléchargement prévu, a remis la clé stockée dans
1Password. **Ne pas générer de troisième clé.** La première clé non récupérée
reste enregistrée côté GitHub ; sa révocation éventuelle nécessite une
confirmation distincte avant suppression irréversible. Aucun secret de cette
première clé n’est connu du mécanisme de livraison.

Les scripts partagés `github-auth-check` et `git-ship` n’ont pas été modifiés.
Une protection globale préparée/testée a été refusée par la vérification
automatique pour son impact sur les autres projets ; elle n’a pas été appliquée.
Ne pas exécuter directement leurs anciens replis. Le lanceur Ava peut fournir
l’identité App à git-ship, mais la fusion Ava reste exclusivement la garde versionnée.
Aucun réglage d’Outlook ni changement d’authentification macOS réalisé.

## Livraison et reprise

Attendre run et job `regression-gates` success sur le HEAD exact contenant main à
jour, fusionner uniquement via la garde, vérifier arbre et parent puis nettoyer
notre seule branche. Aucune seconde campagne complète main. Vérifier Lovable
synchronisé et la preview authentifiée ; une fusion ne publie pas la production.
[Reprise AP2](prompt_reprise_atelier_parole_lot_ap2_livraison.md).

## Sources

- [Authentification comme installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).
- [Jetons stateless déployés — GitHub, 2 octobre 2026](https://github.blog/changelog/2026-10-02-stateless-github-app-installation-tokens-rolled-out/).
- [Création d’un élément 1Password via JSON/stdin](https://www.1password.dev/cli/reference/management-commands/item).
- [Secrets transmis aux processus par op run](https://www.1password.dev/cli/secrets-scripts).
- Accords directs d’Ulrich et contrôles réels du 28 octobre 2026 ; aucun secret conservé dans cette documentation.
