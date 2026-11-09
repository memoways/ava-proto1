# Plan — LLM as judge, tours isolés (lot 1)

> Statut : lots 1, 2, J1 et J2 implémentés — base Notion créée, option Emma ajoutée, juge lançable sans navigateur
> Objectif : banc d’essai texte (sans STT/TTS) dans Qualité, pour classer
> l’effet du **modèle Max**, de l’**échantillonnage** et du **RAG** sur la
> qualité d’une réponse, jugée par un LLM contre une cible Notion
> (texte d’or + grille).

## Décisions

- Unité : tours isolés (pas de mémoire entre questions). Continuité = lot 2.
- Cible : texte d’or + grille (must include / must not / ton / longueur).
- Runner : pipeline texte réel (RAG live → brief GM → Max → validateur).
- Leviers V1 : modèle Max, sampling, RAG. GM, validateur et prompt figés.
- Catalogue Max = **le même** que Technique → LLM Config (`listLlmConfigModels` /
  `OPENROUTER_MODELS`). Qualité ne tient pas de liste parallèle.
- Design : un facteur à la fois (OFAT), 3 passages par couple question × config.
- Corpus : rédigé dans Notion par l’équipe ; l’app sync et exécute.

## Architecture

- Sync Notion → `eval_items` via Edge Function `sync-eval-items` (admin).
- Orchestration du run **côté admin** (un tour après l’autre, persisté tout
  de suite) : un run OFAT ne tient pas dans une Edge Function.
- Overrides **en mémoire** uniquement — jamais `admin_settings`.
- `feature_key` `llm_as_judge` pour filtrer dans Consommation LLM.

## Base Notion

URL : [AVA LLM-as-judge — corpus Max](https://app.notion.com/p/gamilab-prov/746db7ce482d410ca45bb35f316c89a9?v=169e0f6c94324bd8870c37e656b1802a)
ID : `746db7ce482d410ca45bb35f316c89a9` (espace gamilab-prov, page Storygami Home).
Intégration AVA partagée sur la base (secret Lovable `NOTION_API_KEY`).

Colonnes : Question (title), Reponse visee, Must include, Must not, Ton
(select : retenu / ouvert / defle / factuel), Longueur max (number = phrases),
Categorie (select : factuel / piege / emotion / lore), Actif (checkbox),
Personnage (select, V1 = Max), Ordre (number), Notes juge.

L’ID est dans `AVA_NOTION_DATABASES.eval_items`. Surcharge possible dans
Qualité (`admin_settings.ava_eval_notion_database_id`).

## Hors périmètre lot 1

Session scriptée, variantes de system prompt / GM / validateur, STT/TTS,
grille cartésienne, rédaction des 15 questions par l’agent.

## Lot 2 — Banc d'essai lisible et pilotable (implémenté)

Objectif : rendre la pipeline compréhensible et exploitable, sans changer les
prompts Max / GM / validateur.

Onglet `Qualité → LLM as judge` en quatre étapes :

1. **Corpus Notion** (`EvalCorpusPanel`) — lien direct vers la base, bouton
   Synchroniser, date du dernier import, compteurs importées / actives /
   complètes, répartition par catégorie, tableau ligne par ligne avec l'état
   (complète / incomplète / inutilisable) et le détail de ce qui manque.
   Le lancement est verrouillé sous 5 questions complètes (`EVAL_MIN_ITEMS`).
2. **Leviers** (`EvalLeversPanel`) — rappel des réglages réellement utilisés et
   de la page où les changer, choix des modèles Max comparés (même catalogue que
   LLM Config), variantes température et RAG en cases à cocher explicites,
   modèle juge, estimation tours / appels / coût / durée, lancement, pause,
   reprise.
3. **Grille de notation** (`EvalScoringPanel`) — six critères pondérables
   (0-5, pas de 0.5), poids par défaut : must_not 3, character_voice 2.5,
   must_include 2, tone 1.5, gold_fidelity 1, length 1. Persistés par
   environnement (`ava_eval_score_weights`).
4. **Résultats** (`EvalResultsPanel`) — classement des configurations avec note
   pondérée, écart entre les 3 passages, Δ vs configuration actuelle, latence
   médiane, coût, marquage « instable » au-delà de 1.5 d'écart-type ; points
   faibles par critère et par catégorie ; recommandations calculées sans appel
   LLM (seuil de bruit 0.15, écart significatif 0.3) avec la page où appliquer
   le changement ; drill-down par question ; export JSON.

Moteur : `src/services/evalJudgeScoring.ts` (`auditEvalCorpus`,
`weightedScore`, `analyseEvalResults`, poids par défaut et seuils).

Hors périmètre lot 2 : rédaction du corpus (équipe), sessions scriptées,
variantes de prompt, STT/TTS.

## Lot J1 — mesurer le jeu de Max et Emma (implémenté, 9 novembre 2026)

Feuille de route : [feuille_de_route_jeu_personnages.md](feuille_de_route_jeu_personnages.md).
Question visée : « le prompt candidat fait-il mieux jouer Max et Emma que la référence ? »

- **Grille** (`evalJudgePipeline.ts`, `evalJudgeScoring.ts`) : onze critères. Ajouts J1, 0-5 :
  `not_meta` (pas de narrateur), `lived_impact` (les faits passent par leur effet sur sa vie et sa famille),
  `canon_timeline` (fiche, timeline, présent ; souvenir J−2 ≠ appartement), `distinct_voice` (Max ≠ Emma).
  `speech_quality` = moyenne des cinq sous-critères de parole incarnée, pondérée. Poids par défaut :
  must_not 3, canon_timeline 3, not_meta 2.5, lived_impact 2.5, must_include 2, character_voice 2,
  tone 1.5, speech_quality 1.5, distinct_voice 1.5, gold_fidelity 1, length 1.
- **Repère canon** : `runIsolatedEvalTurn` lit la fiche synchronisée du personnage (lecture seule, cache) et
  `buildJudgeCanonReference` en donne au juge la situation, la manière de parler et un extrait de timeline
  (`judgeTimelineExcerpt`) : titres de périodes, lignes sur Mona, puis les derniers jours en entier (J−2 → aujourd'hui,
  ~4 400 caractères). Un premier essai coupé en tête privait le juge du carnage : il jugeait « hors canon » le fusil
  braqué d'hier.
- **Juge par défaut** : `anthropic/claude-sonnet-5.5` (`listEvalJudgeModels`, en tête de liste). `claude-sonnet-4`
  n'est plus servi par OpenRouter (vérifié le 9 novembre) ; le catalogue LLM Config des personnages est inchangé.
- **Compatibilité** : `readJudgeSubScores` rend `null` pour un critère absent ; `weightedScore` l'exclut du
  dénominateur. Les poids stockés sont complétés par les défauts (`loadScoreWeights`).
- **Personnage** : `evalCharacterKey` (Max/Emma) ; l'audit du corpus bloque les autres valeurs ; filtre au lancement.
- **Référence vs candidat** : `buildReferenceCandidateConfigs` produit exactement deux configurations
  (`baseline`, `candidate`) depuis le snapshot live ; `parseSnapshotOverrides` lit un instantané JSON
  (model, temperature, topP, maxTokens, ragTopK, ragRetrieveK, ragRerank, ragThreshold, promptVariant) et bloque
  le lancement s'il est invalide. La variante est transmise par `evaluationOverrides.promptVariant` →
  `simulateMaxResponse` → `buildMaxSystemPrompt` ; elle sert aussi au RAG et à l'historique `optimized_v3` du tour.
  Rien n'est écrit dans `admin_settings`. `compareReferenceCandidate` calcule le verdict et les Δ par critère,
  par question et par personnage (seuils du lot 2 : bruit 0.15, écart significatif 0.3, instable 1.5).
- **Fidélité RAG** : en jeu, `optimized_v3` récupère au moins 6 souvenirs avant déduplication ; le rejeu forçait
  jusqu'ici le `RAG_TOP_K` réglé (4 en sandbox). `characterRagTopKForVariant` (`src/services/characterRagTopK.ts`)
  est désormais partagé par l'orchestrateur et le rejeu : une référence `optimized_v3` reproduit le tour réel.
- **Run** : `ofat_config` stocke aussi `mode` et `characterFilter` (reprise fidèle).
- **Corpus v1** : [corpus_llm_juge_v1.md](corpus_llm_juge_v1.md), 20 lignes à valider avant saisie Notion.

- **Estimation de coût** recalée sur le run réel (personnage, GM, juge au coût mesuré) ; l'ancienne estimation
  donnait 0,197 $ pour un run qui a coûté 2,10 $.
- **Bruit** : verdict et badge « instable » mesurent l'écart entre les passages *d'une même question*
  (`repeatSpread`), plus l'écart entre questions différentes, qui est le corpus et non du bruit. Le verdict
  compte aussi les questions en hausse et en baisse (|Δ| ≥ 0,3).

### Premier lancement réel (sandbox-ulrich, 9 novembre 2026)

Run `690eaf20-4e1c-44b2-99f3-4ea23817a9d4`, app locale sur sandbox-ulrich, session admin d'Ulrich. Référence
`optimized_v3` actuel (plancher RAG 6 appliqué), candidat `rich_v2`, mêmes réglages (`openai/gpt-5.6-luna`,
température 1,4, 360 tokens). 21 questions (corpus v1 + ligne d'exemple) × 2 × 3 passages = 126 tours en 21 min,
0 erreur. Juge `anthropic/claude-sonnet-5.5`.

- **Coût réel** (`llm_usage`, 15:19–15:41 UTC) : 2,10 $ — juge 1,71 $ (126 appels), GM post-tour 0,33 $
  (Gemini 2.5 Flash), personnages 0,07 $.
- **Verdict** : `rich_v2` ne fait pas mieux jouer Max et Emma que `optimized_v3` : 5,10 → 4,95 /10 (Δ −0,15,
  bruit entre passages ± 0,56) ; 6 questions en hausse, 8 en baisse. Emma +0,07, Max −0,32. Canon et timeline
  −0,62 (/5) pour `rich_v2`, impact vécu −0,24.
- **Ce que le juge voit** (référence `optimized_v3`) :
  - « Qu'est-ce qui s'est passé à la montagne ? » : Max énumère encore (« Peter a été tué, Agotha et Philippe
    aussi… j'ai ligoté un homme… ») — `not_meta` 2, `lived_impact` 2. Le défaut d'Ulrich persiste après C1.
  - « Et Peter ? » : « Peter a été tué il y a deux jours » — `canon_timeline` 0. Cohérent avec l'erreur du
    résumé PRÉSENT généré pour Max (voir le corpus, point 1) : piste directe pour le lot P.
  - Critère le plus faible : longueur (0,2/5) — presque toutes les réponses dépassent la longueur visée.
- **Lecture** : la grille distingue les deux variantes question par question ; le résultat global n'est pas
  une raison de changer de prompt. Il donne une base de mesure pour le lot P (générateur PRÉSENT).

Hors périmètre J1 : plusieurs tours (J3), exécution sans navigateur (J2), fiches et prompts, STT/TTS.
Suite : [prompt J2](prompt_reprise_llm_juge_lot_j2.md).

## Lot J2 — lancer le juge sans navigateur (implémenté, 9 novembre 2026)

Question visée : mesurer référence contre candidat avant chaque lot P et J3, à la main, sur une sandbox,
sans ouvrir l'admin. Même grille, même pipeline, mêmes tables que l'onglet Qualité.

### Dépendances navigateur relevées

- `evalJudgePipeline.ts` ne touche le navigateur qu'à travers ses imports : réglages (`settingsService` →
  `localStorage` par environnement, hydratés depuis `admin_settings`), `processPRD4Turn` (Edge Functions avec le
  JWT de session), `callLLMWithUsage` (`proxy-llm`, même JWT), `performance.now`.
- `evalJudgeStore.ts` : client Supabase (`import.meta.env.VITE_SUPABASE_*`, stockage de session
  `localStorage`), `getCachedSession` pour `created_by`, `authenticatedFunctionFetch`.
- Constat : chargé par `vite-node` (mêmes alias et `import.meta.env` que Vite, `.env` public du dépôt), le module
  se charge dans Node 22+ avec un simple `localStorage` en mémoire. Aucune duplication nécessaire.

### Authentification : voie existante, rien à créer côté serveur

La voie admin existe déjà : connexion Supabase Auth de Lovable Cloud par e-mail et mot de passe (page `/auth`),
appartenance vérifiée par `admin_users`, RLS « Admins manage eval items/runs/results », Edge Functions appelées
avec le JWT court de la session. Le script fait exactement la même chose :

- identifiants lus dans l'environnement du processus (`AVA_EVAL_EMAIL`, `AVA_EVAL_PASSWORD`), localement depuis
  `.env.eval.local` (ignoré par `*.local`), dans GitHub depuis deux secrets du dépôt ; jamais dans le dépôt ;
- refus si le compte n'est pas dans `admin_users` ; environnement = celui demandé si le compte peut changer
  d'environnement (même règle que l'admin), sinon son environnement par défaut ; **`prod` toujours refusé** ;
- session en mémoire (aucun fichier de session écrit), déconnexion locale en fin de run.

Aucune migration, aucune Edge Function nouvelle, aucun Supabase direct : la clé publique et l'URL Lovable Cloud
du `.env` versionné suffisent, comme pour le site. Recommandation : un compte admin dédié à l'évaluation, défaut
`sandbox-ulrich`, plutôt que le compte personnel dans les secrets GitHub.

### Garde-fous

- **Overrides en mémoire** : le script installe un filtre `fetch` qui refuse toute écriture
  (`POST/PATCH/PUT/DELETE`) vers `admin_settings` ; les tentatives sont comptées et listées dans le rapport.
  Les réglages sont hydratés en lecture seule (`hydrateAllSettings({ readOnly: true })`).
- **Plafond de coût** (`--max-cost-usd`, défaut 3 $) : refus au départ si l'estimation dépasse le plafond ;
  pendant le run, coût engagé = max(estimation calibrée J1 par tour, coût réel `llm_usage` relu tous les 10 tours) ;
  arrêt propre avant le tour qui ferait dépasser, run marqué `paused` avec la raison, reprenable (`--resume RUN_ID`).
- Rejeu identique à l'admin : boucle commune `executeEvalRun` (`src/services/evalJudgeRunner.ts`), utilisée par
  l'onglet et par le script ; sélection du corpus commune (`selectRunnableEvalItems`), configurations communes
  (`buildCompareConfigs`).

### Exécution

- Local : `npm run eval:judge -- --reference optimized_v3 --candidate rich_v2 --character all --repeats 3`
  (options : `--env`, `--judge-model`, `--max-cost-usd`, `--reference-json`, `--candidate-json`, `--out`,
  `--resume`, `--dry-run`). Sortie : rapport Markdown des Δ (verdict, critères, personnages, questions, coût
  estimé et réel, lien du run), écrit dans `output/eval-judge/` et sur la sortie standard.
- Identifiants locaux : `.env.eval.local` dans le dossier de lancement ou à la racine du checkout canonique
  (cherché aussi depuis un worktree), deux lignes `AVA_EVAL_EMAIL=` / `AVA_EVAL_PASSWORD=`.
- GitHub : workflow `LLM judge (manual)` (`.github/workflows/llm-judge-manual.yml`), `workflow_dispatch` seulement
  (candidat, référence, filtre personnage, passages, plafond, sandbox) ; aucun déclencheur PR/push, la CI
  `Core experience quality` est inchangée. Un run payant n'est jamais annulé par un lancement suivant (file
  d'attente). Rapport dans le résumé du job ; pas d'artefact. Secrets requis : `AVA_EVAL_EMAIL`, `AVA_EVAL_PASSWORD`.

### Lancement réel sans navigateur (sandbox-ulrich, 9 novembre 2026)

Run `b12b2d34-5d57-44bf-aaab-e6798aeb0fcd`, `npm run eval:judge -- --reference optimized_v3 --candidate rich_v2
--character all --repeats 3`, compte admin d'Ulrich. Même corpus (21 questions actives : 12 Max, 9 Emma, vérifiées
dans la base corpus), mêmes variantes et réglages que le run J1 (`openai/gpt-5.6-luna`, T 1,4, 360 tokens, juge
Claude Sonnet 5.5). 126/126 tours en 21 min, 1 tour en erreur (timeout du personnage, réponse de repli).
[Rapport complet](rapport_llm_juge_j2_sandbox_20261109.md).

| | J1 (admin, run `690eaf20`) | J2 (Node, run `b12b2d34`) |
|---|---:|---:|
| Référence `optimized_v3` /10 | 5,10 | 5,02 |
| Candidat `rich_v2` /10 | 4,95 | 4,96 |
| Δ | −0,15 | −0,06 |
| Bruit entre passages | ± 0,56 | ± 0,57 |
| Canon et timeline Δ (/5) | −0,62 | −0,65 |
| Coût réel | 2,10 $ | 2,13 $ |

- **Écart dans le bruit** : notes à ±0,1 de J1 pour un bruit de ±0,57 ; même lecture (rich_v2 ne bat pas
  optimized_v3, recul net sur le canon et la timeline). Les mêmes questions faibles côté Max (« Et Peter… »,
  « … à la montagne ? », accueil de la cellule) restent sous 3/10 en référence. La longueur reste le critère le
  plus faible (0,56/5).
- **Coût** : 2,13 $ mesurés (juge 1,73 $, GM 0,33 $, personnages 0,07 $), estimation 2,10 $.
- **Défaut trouvé et corrigé pendant le lot** : la relève des prix OpenRouter (`fetchGenerationCost`) appelait
  `window.setTimeout`, absent de Node ; les 381 lignes `llm_usage` du run restaient à 0 $ et le rapport affichait
  « 0.00 $ mesurés ». Correctif : `globalThis.setTimeout` (aucun effet dans le navigateur) ; un coût à 0 est
  désormais compté « en attente » jusqu'à ce que la relève abandonne, et le script attend les prix (jusqu'à
  2 min 30) avant d'écrire le rapport. Les prix du run ont été récupérés depuis OpenRouter
  (`retryCostForRow`, l'action de l'admin) ; 5 appels personnage en timeout n'ont pas de génération facturée.
  Effet de bord : ~1 000 lignes de diagnostic « window is not defined » dans le journal des erreurs de coût
  (sandbox, 9 novembre 19 h 09 – 19 h 35 UTC).
- **Vérifications après correctif** : run court `7418d466-5cd7-4486-871a-3a3d60f322f4` (Emma, 1 passage, 18 tours,
  3 min) : 0,30 $ mesurés pendant le run pour 0,30 $ estimés, sortie standard réduite au rapport. Plafond : la
  même commande avec `--max-cost-usd 0.15` est refusée au départ (sortie 2, aucun run créé).
- **Limites connues** : OpenRouter limite le débit de la relève des prix (429 observés lors du rattrapage) ;
  la relève réessaie à 15, 30 et 60 s, puis le rapport signale les appels « sans prix disponible ». Avec un seul
  passage, le bruit n'est pas mesuré : le rapport le signale et le verdict reste indicatif.
- Workflow GitHub : livré, non lancé (secrets `AVA_EVAL_EMAIL` / `AVA_EVAL_PASSWORD` à créer par Ulrich).

Hors périmètre J2 : plusieurs tours (J3), changement de grille, fiches et prompts, STT/TTS, production.
Suite : [prompt du lot P](prompt_reprise_parole_lot_p.md) (feuille de route : P, puis J3).
