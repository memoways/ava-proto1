# Plan — LLM as judge : pipeline lisible, pilotable et exploitable

## Où on en est vraiment

Vérifié dans le code et les données :

- La base Notion **existe** avec les 11 bonnes colonnes, mais elle est **quasi vide** : 1 seule ligne synchronisée.
- Le moteur est **déjà écrit** (`evalJudgePipeline.ts`) : pipeline texte réel RAG → Game Master → Max → validateur, puis notation par un LLM juge, comparaison de configurations (modèle / sampling / RAG), 3 passages par question, classement et détection du facteur le plus influent.
- **Aucun run n'a jamais été lancé** (0 run, 0 résultat en base).
- L'onglet actuel est cryptique parce qu'il affiche un mode d'emploi de création de base Notion, sans jamais dire : est-ce que ma base est saine ? qu'est-ce qui est testé ? comment la note est calculée ? qu'est-ce que je dois changer après le test ?

Le chantier n'est donc pas de construire le moteur, mais de le rendre compréhensible et actionnable.

## Ce qu'on construit

L'onglet devient un parcours en 4 étapes, dans cet ordre à l'écran.

### Étape 1 — Corpus : vérifier la base Notion

Remplacer le pavé de définition des colonnes par un **diagnostic** :

- Lien direct vers la base Notion, date du dernier sync, nombre de questions actives.
- Contrôle de santé par ligne : question vide, réponse visée manquante, aucun « must include », catégorie ou ton absent, longueur max non renseignée. Badge vert / orange / rouge et message en clair (« 4 questions sur 5 n'ont pas de must include : le juge ne pourra pas les noter correctement »).
- Répartition par catégorie (factuel / piège / émotion / lore) avec un avertissement si une catégorie est vide.
- Un bloc replié « Comment remplir une ligne » avec un exemple complet rédigé, puisque tu écris le corpus toi-même dans Notion.
- Verrou : le bouton de lancement reste désactivé tant qu'il n'y a pas au moins 5 questions actives valides.

### Étape 2 — Variables : ce qui est testé et où le changer

Une carte « Ce que le test utilise » qui affiche les réglages réellement en vigueur dans **ta sandbox**, avec pour chacun le nom de la page admin où le modifier (LLM Config, RAG Config, Réglages GM, Réglages personnages) : modèle Max, température, top-p, tokens max, variante de prompt, RAG (k, seuil, rerank, modèle de rerank).

Puis les **leviers de comparaison** (inchangés dans leur logique, clarifiés dans leur formulation) : la référence est toujours ta config live, et tu coches les variantes à comparer — autres modèles, température 0 / 0.8, RAG conservateur / généreux. Chaque case indique en une phrase ce que la variante cherche à prouver.

Enfin l'estimation avant lancement : nombre de tours, appels LLM, coût estimé, durée estimée.

### Étape 3 — Scoring : une grille pondérée et ajustable

Six critères notés par le juge : fidélité à la réponse visée, must include, must not, ton, longueur, voix du personnage.

- Chaque critère reçoit un **poids réglable** (curseur), avec sa définition en une phrase et un poids par défaut proposé (les interdits « must not » et la voix du personnage pèsent plus lourd que la fidélité littérale).
- La note finale est **recalculée à partir des critères stockés**, donc changer les poids met à jour le classement **sans relancer aucun test ni dépenser un centime**.
- Les poids sont enregistrés par sandbox (comme les autres réglages) et la valeur utilisée est mémorisée avec le run, pour que deux runs restent comparables.
- Un encart explique la grille en français simple, avec un exemple de calcul.

### Étape 4 — Résultats : analyse et recommandations calculées

- **Classement des configurations** : note moyenne, écart vs la référence, dispersion entre les 3 passages, latence médiane, coût. Une variante instable (forte dispersion) est signalée comme non concluante.
- **Points faibles** : note moyenne par critère et par catégorie de question, pour voir si le problème est le lore, les pièges ou le ton.
- **Recommandations** en phrases claires, déduites de règles simples et sans appel LLM. Exemples de formulations produites : « Passer la température à 0 gagne 0,8 point sans coût supplémentaire : recommandé », « Le modèle X gagne 0,4 point mais coûte 3× plus cher : non prioritaire », « RAG k=8 n'apporte rien (+0,05, dans le bruit) : garder k=3 », « Les 4 questions “piège” sont les plus faibles : le prompt doit renforcer le refus de spoiler ».
- Chaque recommandation nomme la **page admin** où appliquer le changement. Pas d'application automatique.
- Détail par question au clic, et export JSON du run conservé.

## Détails techniques

- Aucune migration : les six sous-notes sont déjà stockées dans `eval_results.judge_json`, la note pondérée est donc recalculable côté client. Les poids vont dans `admin_settings` via `loadEnvironmentSetting` / `saveEnvironmentSetting` (clé `ava_eval_score_weights`), donc isolés par sandbox.
- `evalJudgePipeline.ts` : ajout de `DEFAULT_SCORE_WEIGHTS`, `weightedScore(judge, weights)`, `auditEvalCorpus(items)`, `analyseEvalResults(...)` retournant classement + faiblesses + recommandations typées. `rankConfigs` prend les poids en entrée.
- `EvalJudgeTab.tsx` découpé en quatre sous-composants (`EvalCorpusPanel`, `EvalLeversPanel`, `EvalScoringPanel`, `EvalResultsPanel`) pour rester lisible.
- Le prompt du juge reste inchangé et non éditable dans ce lot. Prompts Max / GM / validateur, STT et TTS : non touchés.
- Tests unitaires sur `weightedScore`, `auditEvalCorpus` et la génération de recommandations, plus mise à jour de `EvalJudgeTab.test.tsx`.
- Documentation mise à jour dans `docs/plan_llm_as_judge.md` (lot 2).

## Hors périmètre

Mini-scénarios multi-tours (mémoire, continuité), édition du prompt du juge, application en un clic des réglages gagnants, rédaction du corpus par l'agent.
