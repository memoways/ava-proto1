# Erreurs GitHub natives et accès alternatif vérifié — 28 octobre 2026

## Texte prêt à transmettre

Dans l'app desktop Codex pour macOS (bundle `com.openai.codex`, version
`26.1023.50603`, build `22391`, installée sous `/Applications/ChatGPT.app` ;
le bundle annonce aussi le nom d'affichage ChatGPT), le plugin GitHub est
annoncé installé et activé. Ses outils sont découverts dans la session, mais
les trois appels ci-dessous échouent avant de fournir une réponse GitHub.

Appels réellement exécutés :

```text
get_profile({})
get_repo({"repository_full_name":"memoways/ava-proto1"})
search_prs({"repository_full_name":"memoways/ava-proto1","query":"is:open"})
```

Erreurs exactes du connecteur :

```text
tool call error: tool call failed for `codex_apps/github.get_profile`

Caused by:
    Mcp error: -32001: Unknown tool({"name":"github.get_profile"})

tool call error: tool call failed for `codex_apps/github.get_repo`

Caused by:
    Mcp error: -32001: Unknown tool({"name":"github.get_repo"})

tool call error: tool call failed for `codex_apps/github.search_prs`

Caused by:
    Mcp error: -32001: Unknown tool({"name":"github.search_prs"})
```

L'inventaire natif `plugin_management.search_plugins({"query":"GitHub","limit":5})`
réussit : plugin `plugin_connector_1p_1a69035c238881919c4190932b2df699`,
`installed=true`, `status=ENABLED`. Une réapplication native du plugin a déjà
été tentée dans le diagnostic précédent, sans rétablissement confirmé de ces
trois appels. Le redémarrage effectif de l'app entre les essais n'est pas établi.

Le résultat attendu est l'exécution des trois outils exposés. La cause exacte
de `Unknown tool` reste à établir ; aucune preuve d'expiration OAuth.

## Solution utilisable maintenant

Ulrich autorise explicitement le test d'autres connexions le 28 octobre.
Depuis le contexte système autorisé, sans modifier les identifiants :

```sh
gh api user --jq '{login:.login,id:.id}'
gh api repos/memoways/ava-proto1 --jq '{full_name:.full_name,permissions:.permissions}'
gh pr list --repo memoways/ava-proto1 --state open --json number,title,headRefName,updatedAt,isDraft,url
git fetch --prune
git pull --ff-only
```

Ces cinq opérations réussissent. Identité : `Ulrfis`, ID `137000256` ; dépôt
exact vérifié, droits de lecture et push confirmés. Main à la reprise :
`c7df835446c7e4876b91a9c752062207e3a374bd`. Seule PR ouverte : #24, historique,
dernière modification le 11 octobre, préservée. Aucun login/refresh/logout.

`gh auth status` dans la sandbox avait annoncé « token invalid ». La requête
authentifiée réussie depuis le contexte système montre que ce premier résultat
ne prouvait pas l'expiration de la session. La cause précise de la différence
entre contextes n'a pas été isolée.

La GitHub App de livraison n'est pas configurée sur ce poste : son fichier de
configuration est absent. `git-ship` et ses helpers sont présents ; la livraison
doit cependant respecter l'attente des CI du dépôt avant fusion. Le script
ne doit pas être lancé aveuglément comme raccourci à cette attente.

Le correctif Emma peut donc avancer par `git`/`gh` authentifiés. Réparer le
connecteur natif est une amélioration de l'outillage, sans intervention utilisateur
nécessaire pour poursuivre ce lot. Aucun navigateur utilisé.
