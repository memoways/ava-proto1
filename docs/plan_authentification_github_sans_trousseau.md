# GitHub Ava — livraison indépendante du Trousseau

## Décision du 30 octobre 2026 — voie directe, 1Password en secours

Ulrich refuse les validations 1Password répétées : elles l’obligent à surveiller
chaque livraison. Il maintient l’interdiction du Trousseau. Cause constatée :
le lanceur partagé `github-delivery-exec` excluait explicitement Ava depuis le
28 octobre, alors que l’App locale `ulrich-local-git-ship` (clé fichier 0600,
configuration `~/.config/git-ship/apps/memoways/ava-proto1/github-app.env`)
restait valide pour Ava.

Changements appliqués avec l’accord d’Ulrich :

- exclusion Ava retirée du lanceur partagé (fichier local du poste) ;
- `.git/config` du checkout canonique : `credential.helper` remis à zéro, puis
  `github-app-exec` + `github-app-credential-helper` avec la configuration Ava,
  `credential.useHttpPath=true`. Les worktrees partagent cette configuration.

Vérifié le 30 octobre, sans aucune demande ni Trousseau : jeton émis, dépôt,
PR et runs lisibles, `git fetch` et `git push --dry-run` acceptés. Une trace Git
montre que seul le helper App est appelé, jamais `osxkeychain`.

Limite assumée : la clé fichier est lisible par tout programme lancé sous le
compte d’Ulrich, comme une clé SSH. Chaque jeton reste limité à une heure et au
seul dépôt Ava (Contents et Pull requests en écriture). Retour arrière : retirer
les trois réglages locaux et rétablir l’exclusion. La session 1Password
ci-dessous reste disponible en secours, sans changement.


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

Depuis le checkout canonique, ouvrir une seule session pour le lot :

```sh
bash .github/scripts/github-1password.sh session
```

Après le message JSON `ready`, envoyer une commande JSON par ligne dans le même
processus, et attendre son message `result` avant la suivante. Exemple :

```json
{"id":1,"command":"gh","args":["api","repos/memoways/ava-proto1"]}
{"id":2,"command":"git-ship","args":[]}
{"id":3,"command":"exit"}
```

La garde s’utilise avec `command: "node"`, le premier argument exact
`.github/scripts/ship-pr.mjs`, puis ses arguments PR/HEAD/merge habituels. Les
sorties sont des messages JSON `stdout`/`stderr` et un `result` avec code de retour.
Un échec de commande conserve la session pour le diagnostic ; `exit`, deux heures
écoulées ou un refus d’émission de jeton la ferment. Aucun accès au coffre dans
la boucle, renouvellement du jeton après 50 minutes depuis la clé déjà en mémoire ; avant
une garde/livraison longue, garantir au moins 40 minutes de validité restante.
Les enfants n’héritent pas de la clé. Askpass Git/SSH et le transport SSH sont
neutralisés pour ces processus HTTPS ; aucun dialogue personnel de secours. Pas de service système, socket partagée ou
modification des réglages de sécurité 1Password. Ne pas promettre zéro validation
initiale : sa nécessité dépend de 1Password ; ne jamais la relancer en série.

Le mode direct `git-ship` groupe aussi une livraison complète sous une seule
résolution de coffre. Les modes unitaires Git/gh restent compatibles mais ne sont
plus le workflow normal : ne pas les enchaîner. Les lectures publiques utiles
peuvent être anonymes, sans helper ni secret. La garde contrôle la CI au plus une
fois par minute ; aucune surveillance du statut ne doit relire 1Password.

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

`npm run test:delivery` : 35 tests déterministes (23 garde, 12 accès isolé/App/session),
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

## Correction après le retour d’Ulrich — session bornée, un accès au coffre

Ulrich signale trente demandes 1Password successives et interdit leur répétition.
La réutilisation de l’App ne suffit pas : appeler `op run` pour chaque commande
reprovoque des autorisations. Arrêt des sondes au coffre. Les lectures publiques
utiles ont été faites anonymement ; la passe groupée git-ship n’a résolu la clé
qu’une fois, puis a refusé la fusion de #111 après une CI E2E rouge.

Plan de correction autorisé : ajouter au lanceur un mode `session` App uniquement,
canal stdin/stdout structuré, clé et jeton en mémoire pour plusieurs commandes
Git/gh/garde. Aucune socket publique, daemon système ou nouvelle configuration
1Password. Un seul `op run` au démarrage ; renouvellement du jeton depuis la clé
en mémoire, aucune nouvelle lecture de coffre pendant la session. Session bornée
dans le temps ; un échec de commande reste diagnosticable dans cette session.
Expiration/refus de l’issuer : arrêt explicite, aucun retry d’authentification,
aucun repli personnel et aucune baisse des protections. Les commandes enfants
n’héritent jamais de la clé ; helpers Git/gh isolés jusqu’à la fermeture.

Validation avant accès réel : faux op compté, plusieurs commandes et erreur
intermédiaire, jeton stateless, renouvellement simulé, absence de clé dans les
enfants/sorties et nettoyage à la fermeture. Puis une seule ouverture réelle de
session pour diagnostics, push, PR/CI, garde et nettoyage. Ne pas présenter zéro
validation initiale comme garanti par 1Password ; interdire les demandes en série.

CI #111, run 40751731709 sur df25a6b : 111 E2E passent, seul AP2 Firefox échoue à
l’étape suivant l’écoute (bouton Essai absent). Fusion refusée. Local Firefox
ciblé passe en 6,1 s / 9,9 s total ; diagnostic Linux audio/autoplay/transition
restant. Aucun contrôle ni navigateur retiré pour obtenir le vert. Toute
correction changeant le HEAD impose la CI de ce nouveau HEAD, sans campagne main.


### Vérification locale de la correction

35/35 tests de livraison verts, dont lanceur réel avec faux op : une résolution,
cinq commandes GitHub sur le même jeton et la même configuration isolée,
nettoyage à la fermeture. Tests d’échec intermédiaire, de renouvellement sans
nouvel accès au coffre, d’expiration et de commandes interdites. Aucun secret réel
dans ces tests. Première ouverture réelle de session expirée pendant l’autorisation,
non relancée automatiquement. Après réponse « prêt » d’Ulrich, une seule ouverture
a abouti : message ready, téléchargement des traces CI puis fetch dans la même
session, sans nouvel appel au coffre. Aucun nouveau réglage 1Password.

Le parcours AP2 a reproduit exactement le bouton manquant sous Firefox strict :
NotAllowedError de lecture, maintien correct en étape 2. Sa fixture dépendait du
périphérique/politique audio du runner. Sortie audio du seul parcours entièrement
simulé rendue déterministe, ajout d’un refus explicite et maintien des assertions
zéro audio automatique/deux requêtes identiques sauf réglage, persistance/clavier/
390 px. Aucun test média existant ou navigateur retiré. Le test passe désormais
sur Chromium/Firefox/WebKit et dans le Firefox strict de reproduction. Les traces récupérées confirment `NS_ERROR_DOM_MEDIA_MEDIASINK_ERR` /
`OnMediaSinkAudioError` sur le runner : sortie audio indisponible, maintien en
étape 2 attendu. La fixture couvre explicitement ce cas et NotAllowedError.
