# Audit du contexte de travail — 28 octobre 2026

## Conclusion

La lenteur est mesurable. Son premier facteur sur les derniers lots Ava est une
campagne navigateur séquentielle d'environ vingt minutes, répétée sur la PR et
sur main. S'y ajoutent les erreurs évitables avant push, les blocages mal
diagnostiqués des connecteurs et une accumulation de consignes peu proportionnées.
Le nombre d'unitaires n'est pas le premier poste d'attente.

Une CI verte garantit les assertions qu'elle exécute ; les simulations de réseau,
de LLM et de son ne prouvent pas la qualité narrative ou acoustique réelle.
Supprimer tous les tests aggraverait le problème. Réduire les répétitions et
rapprocher les vérifications du problème observé est la piste principale.

Audit uniquement : aucune modification de workflow, skill, préférence,
authentification, modèle, réglage Cloud ou publication.

## Périmètre et méthode

- Instructions personnelles et projet, adaptateur Claude, scripts de livraison,
  configuration Codex filtrée sans secrets, skills locaux et routage des outils.
- GitHub authentifié : dépôt public `memoways/ava-proto1`, identité existante
  `Ulrfis` vérifiée. Pagination des runs depuis le 14 octobre : 198 runs de tous
  workflows, dont 160 `Core experience quality`, jusqu'au 28 octobre au matin.
- Quatre jobs récents lus étape par étape ; état du dernier chat de développement
  et bilan F3 existant. Pas de benchmark comparatif contrôlé Claude/Codex.
- Notion : identité Gamilab `7e1a9a09-09cb-4deb-a306-83a29b831bc2` vérifiée via
  `notion_gamilab.get_self` ; identité personnelle
  `377e8583-7838-4c05-9f76-8833a450f304` vérifiée via le connecteur personnel,
  `fetch(self)`. Sources Ava lues exclusivement dans Gamilab.
- Le second chat Ava a été constaté actif, puis terminé avant toute écriture.
  Aucun travail étranger ni aucune branche historique n'a été modifié.

Ces mesures portent sur Ava. Elles n'établissent pas une régression générale du
service OpenAI ni une expiration récurrente de tous les identifiants.

## 1. Le délai de CI a réellement augmenté

Parmi les 160 runs de qualité : 129 réussis, 13 échoués, 18 annulés. Un run peut
avoir plusieurs tentatives : six portent `run_attempt > 1`. Ce ne sont donc ni
160 lots ni 160 campagnes complètes indépendantes. Les annulations ne sont pas
toutes inutiles : elles peuvent remplacer un HEAD devenu obsolète.

Durées médianes des runs réussis, entre `run_started_at` et `updated_at` :

- 14 octobre : 10,4 minutes, 21 runs.
- 22 octobre : 15,5 minutes, 21 runs.
- 27 octobre : 24,5 minutes, 10 runs.
- 28 octobre au matin : 23,4 minutes, deux runs.

La composition des lots varie ; ce n'est pas une comparaison à code identique.
En excluant les runs retentés, le 27 octobre reste à 24,7 minutes (neuf runs).
L'augmentation ne s'explique donc pas seulement par les relances.

### Exemple du correctif #104 ce matin : 46 min 42 s de jobs

- [PR, run 40658393339](https://github.com/memoways/ava-proto1/actions/runs/40658393339) :
  job 22 min 26 s ; qualité 1 min 28 s ; installation navigateurs 50 s ;
  E2E 19 min 50 s ; npm ci 8 s.
- [Main, run 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202) :
  job 24 min 16 s ; qualité 2 min 08 s ; installation navigateurs 1 min 07 s ;
  E2E 20 min 38 s ; npm ci 12 s.

Les E2E occupent 40 min 28 s, soit environ 87 % des deux jobs. L'étape qualité
inclut lint, typage, régressions, unitaires, intégrations et build : 3 min 36 s au
total. Optimiser npm ci ferait gagner des secondes, pas les dizaines de minutes
recherchées.

Le dernier tour du chat « Retester GitHub avant le correctif Emma » a duré
67 min 32 s (`durationMs=4051927`). Les deux jobs représentent environ 69 % de
cette durée. Cela ne signifie pas que chaque seconde de CI a été inactive, ni
que les 31 % restants seraient tous de l'écriture de code.

Le [bilan F3 existant](plan_changement_interlocuteur_manuel.md) documente déjà
75 min 49 s de CI pour #98, dont 64 min 47 s d'E2E : un premier échec évitable,
un passage corrigé, puis le second passage sur main.

## 2. Ce que les tests apportent, et ce qu'ils ne prouvent pas

`playwright.config.ts` impose `fullyParallel: false` et un worker en CI. Une large
partie des scénarios est dans `tests/e2e/prd4-happy-path.spec.ts`. Augmenter le
nombre de workers sans examiner les fichiers, les états et les fixtures ne
garantit donc pas une accélération.

Le workflow réexécute la même chaîne sur les événements PR et push main. Le
build est produit par `test:quality`, mais les E2E locaux de CI démarrent Vite en
mode développement : ce n'est pas une recette du build publié par Lovable.

Les E2E interceptent notamment `proxy-llm`, les requêtes de données et les TTS ;
certains sons sont des réponses synthétiques `e2e-audio`. Ils vérifient des
transitions, gardes, boutons et contrats déterministes. Ils ne vérifient pas la
réponse libre du fournisseur réel, la prosodie perçue, la cohérence du présent
narratif ou tous les réglages effectivement déployés.

Le correctif du présent canonique illustre cette limite : de nombreux tests
étaient verts alors que le prompt pouvait omettre une situation actuelle. Les
24 reproductions ajoutées pour #104 couvrent ce contrat précis. Une nouvelle
suite volumineuse sans assertion sur ce défaut ne l'aurait pas corrigé.

Les régressions sélectionnées dans `test:regression` sont aussi incluses dans
`test:unit`, qui exclut seulement `src/integration/**` : ce petit doublon existe,
mais il n'est pas la cause dominante des vingt minutes d'E2E.

Les tests ont aussi arrêté de vraies régressions de passage. Le bilan #98
reconnaît une détection trop restrictive et des assertions visuelles non adaptées
avant push. C'est une responsabilité d'implémentation et de préparation du lot,
pas un délai nécessaire à accepter au nom de la qualité.

## 3. Les consignes et les skills ajoutent de la friction

### Règles en tension

- Le point d'entrée personnel demande un seul passage de CI par lot. Le contrat
  Ava impose PR verte puis main verte. La règle spécifique Ava explique le
  comportement actuel ; elle ne rend pas ce doublon économiquement ou
  techniquement indispensable. Ava est public : le premier problème est le délai.
- L'adaptateur Claude recommande `git-ship`. Ce script crée une PR puis appelle
  directement la fusion, sans attendre lui-même la CI et sans attacher le SHA
  attendu à la requête de fusion. Le contrat Ava interdit précisément une fusion
  avant contrôle vert. Le script n'a pas été exécuté pendant cet audit.
- « Seulement main » à la clôture coexiste avec la protection du travail étranger.
  La PR #24 du 11 octobre reste ouverte et doit être préservée. Des branches
  historiques locales subsistent aussi. L'agent doit rapporter cette exception,
  pas supprimer ce travail pour satisfaire une formule de clôture.
- Le CHANGELOG doit citer le SHA de main après fusion, alors que toute la
  documentation est demandée avant le premier push. Cela favorise les secondes
  PR de clôture. Un commit ne peut pas normalement contenir son propre futur
  SHA Git ; l'état livré se référence plus simplement par PR et compte rendu.
- La consigne générale d'arrêt sur connecteur défaillant peut transformer une
  panne d'intégration en blocage du projet, alors que `git`/`gh` authentifiés
  fonctionnent. L'autorisation explicite d'Ulrich du 28 octobre a permis ce repli.

Ces règles répondent à des incidents réels. L'accumulation d'absolus crée
cependant des arbitrages et des boucles documentaires à chaque petit lot.

### Volume et portée

Mesures locales : point d'entrée Codex 8 638 caractères ; AGENTS Ava 12 569 ;
CHANGELOG environ 289 000 ; STORY 298 000 ; plan de changement d'interlocuteur
209 000 ; ancien prompt de finalisation lot 4 environ 44 700 caractères.
L'obligation de retrouver l'état est utile ; relire les historiques entiers à
chaque reprise ne l'est pas. Les détails historiques ne doivent pas concurrencer
une page courte d'état courant.

87 skills sont présents directement sous `~/.agents/skills` et 20 sous
`~/.codex/skills`, hors skills système et plugins. `visual-plan` existe dans les
deux emplacements. Le catalogue exposé à cette session contient 1 130 outils.
Cela ne signifie pas que tous les corps de skills sont chargés ou exécutés :
la documentation officielle décrit un chargement progressif par métadonnées.
Le problème est surtout leur sélection et la portée de leurs instructions.

Exemples lus, comme objets d'audit :

- `confidence-check` exige documentation officielle et exemple OSS pour toute
  implémentation. Sans ces deux critères, son score maximal est 65 %, inférieur
  au seuil de 90 %. Une petite correction interne peut donc être artificiellement
  bloquée. Les chiffres de précision annoncés ne sont pas une validation du workflow Ava.
- `canvas` prescrit un dossier et SDK Cursor pour les livrables analytiques,
  alors que cette session est dans l'app Codex. Le skill contient une exception
  pour le diagnostic ciblé, appliquée ici ; fabriquer un canvas Cursor n'aiderait
  pas à diagnostiquer ces délais.
- `visual-plan` existe en double et prescrit recherche, surface visuelle et
  approbation avant code ; `research` impose un sous-agent. Ces procédures doivent
  être choisies pour un besoin précis, pas se cumuler automatiquement.
- Les descriptions SEO, Supabase et les workflows de sites ont des déclencheurs
  larges. Ava possède pourtant des exceptions précises Lovable/Gamilab.

[Documentation officielle : activation et portée des skills](https://learn.chatgpt.com/docs/build-skills),
[chargement progressif et séparation AGENTS/skills](https://learn.chatgpt.com/docs/customization/overview).

### Réglages et différence avec Claude

Le défaut global Codex est `gpt-6.1-sol`, effort `high`. L'adaptateur Claude
demande une réflexion approfondie seulement si la tâche le justifie. C'est une
différence de configuration susceptible d'ajouter du temps, pas une mesure de
la vitesse effective des modèles dans les deux applications.

Les règles de projet imposent la double CI à Claude aussi. Les runs du
22 octobre de la branche `claude/ecstatic-rubin-nmv2fm` montrent un passage PR
et un passage main. Le ressenti de vitesse peut être valide ; cet audit ne
permet pas de l'attribuer au modèle seul ni d'affirmer que Claude livre un
résultat équivalent dans un temps inférieur à protocole identique.

Autre défaut de contexte : le serveur global `vexp` fixe son `cwd` et
`VEXP_WORKSPACE` sur `ulrfis/carte-chalet`, alors que le projet ouvert est Ava.
Risque de recherche sur le mauvais dépôt si l'agent utilise ce défaut ; aucun
résultat vexp incorrect n'a été reproduit pendant cet audit.

## 4. Les connexions : plusieurs pannes différentes, pas un seul login perdu

### GitHub : défaut d'outil exposé, authentification CLI valide

Reproduction dans cette session :

```text
github.get_user_login({})
Mcp error: -32001: Unknown tool({"name":"github.get_user_login"})
```

Le [diagnostic déjà livré](diagnostic_github_connecteur_2026-10-28.md) contient
trois autres outils présentant le même symptôme, la version de l'app et
l'inventaire plugin. Ici, l'inventaire offre l'outil mais son invocation échoue.
La cause interne de ce décalage n'est pas établie ; ce message ne prouve pas une
expiration OAuth et ne justifie pas une reconnexion GitHub.

`gh api user`, les lectures du dépôt et des runs réussissent depuis le contexte
système autorisé avec `Ulrfis`, sans changer les identifiants. Le diagnostic
antérieur avait un `gh auth status` négatif en sandbox et des requêtes réussies
hors sandbox. Il faut distinguer les droits du processus, l'accès au stockage et
l'authentification distante. La GitHub App de livraison n'est pas configurée sur
ce poste selon le diagnostic et la livraison relus.

### Notion : workspace, route et stockage sécurisé

Les deux workspaces répondent aujourd'hui via les routes effectivement testées.
Gamilab donne accès aux sources Ava. Le connecteur personnel donne accès à
About Ulrich, aux règles mémoire et à la tâche de configuration des outils.
Ce succès ne garantit pas la disponibilité des mêmes connexions dans tous les
clients ou chats futurs.

Le diagnostic natif du 26 octobre, conservé dans
`~/.codex/diagnostics/notion-native-20261026.json`, consigne un ancien échec de
stockage sécurisé macOS : « The user name or passphrase you entered is not
correct. » Gamilab avait ensuite été rétabli et testé sur deux démarrages ;
le natif personnel restait alors non authentifié. Ce document est historique,
pas le verdict du test actuel du connecteur personnel.

Les serveurs natifs personnels/Gamilab et le plugin Notion forment plusieurs
routes. Un outil absent d'un chat, un mauvais workspace, un refus de trousseau
et un véritable jeton expiré exigent des diagnostics distincts. `NOT_FOUND`
depuis Ulrich ne dit rien du partage d'une page Ava située dans Gamilab.

La configuration contient `mcp_oauth_refresh_coordination=true`, stockage
`keyring` et `mcp_optional_startup_grace_ms=0`. Leurs valeurs ont été lues,
mais leur responsabilité dans un nouvel incident n'est pas démontrée.
Pas de login/logout/refresh, extraction de secret, ni contournement navigateur.

## 5. Changements recommandés — proposés, non appliqués

Trois décisions distinctes permettraient de simplifier le travail :

1. **Ava : une campagne complète avant fusion.** Conserver la PR verte sur
   HEAD exact, vérifier la base à jour et l'arbre effectivement fusionné ; ne
   plus rejouer automatiquement toute la campagne sur main dans ce cas. Garder
   les contrôles de synchronisation Lovable et de production. C'est une réduction
   explicite d'un contrôle redondant : elle demande un changement de contrat,
   workflow et ADR, pas un contournement silencieux. Gain illustratif : le second
   job du 28 octobre représente 24 min 16 s, hors tests locaux et recette réelle.
2. **Contexte et skills proportionnés.** État courant court, historique consulté
   à la demande, un seul workflow sélectionné. Retirer le doublon visual-plan,
   limiter l'activation implicite des procédures lourdes, remplacer le score
   arbitraire de confiance par des vérifications adaptées et corriger la cible
   vexp. Proposer les modifications des préférences avant de les appliquer.
3. **Connexions : diagnostic borné et repli autorisé.** Une sonde d'identité et
   une lecture de la ressource ; ensuite classer précisément l'erreur. Réutiliser
   `git`/`gh` pour GitHub lorsque leur cible et leur identité sont vérifiées et le
   repli autorisé. Notion reste sur le connecteur natif du bon workspace. Une
   panne d'outil ne doit pas redéclencher une réinstallation ou un OAuth répété.

Dans les lots fonctionnels : reproduction ciblée avant correction, vérifications
locales liées au périmètre, campagne CI une fois selon le contrat approuvé, puis
recette réelle courte du comportement modifié. Garder les tests de sécurité,
droits et séparation des environnements. Isoler les tests asynchrones instables
et leurs causes ; une relance verte ne suffit pas à qualifier leur fiabilité.

Répartir les E2E indépendants peut ensuite réduire la durée restante, mais il
faut mesurer l'isolation et la stabilité avant de promettre un facteur deux.
La réduction des doublons est une première économie plus certaine.

## Sources et suite

- [Plan de cet audit](plan_audit_contexte_travail.md).
- [Prompt de mise en conformité proposé, lot CT1](prompt_reprise_contexte_travail_lot_ct1.md).
- [Règle personnelle CI](https://app.notion.com/p/402511682fc3813a9750d10f42d18b7e).
- [Tâche Ava, workspace Gamilab](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f).
- [Configuration des outils, workspace personnel](https://app.notion.com/p/1dec14bb56ec497e866a17dcc85d0d5f).
- Sources locales : AGENTS.md, CLAUDE.md, package.json, playwright.config.ts,
  `.github/workflows/core-experience-quality.yml`, skills et scripts cités.

Les propositions ne deviennent pas des préférences approuvées par leur présence
dans ce rapport. Le prochain lot n'est pas lancé. Publication et recette F4 Ava
restent séparées de cet audit.
