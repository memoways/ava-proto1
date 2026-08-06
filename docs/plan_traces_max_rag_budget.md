# Plan — Erreurs RAG lisibles et budget de payload maîtrisé (Traces Max)

Statut : **appliqué** (2026-08-06)
Périmètre : Lovable / Lovable Cloud uniquement.

## 1. Constat

Analyse de la session tracée `b00b827b…`, tour 3, onglet Admin « Trace exacte
des réponses de Max ».

### 1.1 Erreur RAG

- Message de trace : `prd4_rag timed out after 2000ms`.
- Le RAG n'a pas échoué côté serveur : il a été **coupé par la garde client**
  (`RAG_DEGRADED_MODE_DEADLINE_MS = 2000 ms`) alors que la requête Voyage était
  encore en vol (durée réelle observée : 2 803 ms).
- Statistiques `turn_latencies` (n = 94) : p50 = 1 207 ms, p90 = 2 441 ms,
  max = 12 605 ms — **~33 % des tours dépassaient 2 000 ms**. La coupure était
  donc structurelle, pas accidentelle.
- L'interface affichait seulement le badge `error`, sans raison : impossible de
  distinguer une coupure de délai d'un vrai échec serveur.

### 1.2 Dépassement de budget

- La variante active `legacy` injecte la fiche personnage **brute et non
  tronquée** (32 407 caractères pour les seuls champs de fiche, 39 070
  caractères de payload total).
- Le rapport de budget affichait pourtant les plafonds de `compact_v1`
  (7 000 statiques / 12 000 système), d'où un « Budget dépassé » permanent et
  non actionnable.
- Coût mesuré : ~9 625 tokens d'entrée par tour (GPT-5.6 Luna).

## 2. Changements appliqués

### 2.1 Raisons d'erreur visibles

- `PipelineTraceTab.tsx` : chaque étape de la chronologie accepte un `detail` et
  affiche une infobulle au survol, doublée d'un texte court (le survol n'est pas
  fiable sur tablette).
- Traduction des messages techniques : un `timed out after N ms` devient
  « RAG interrompu après N ms (délai de dégradation) : la requête Voyage était
  encore en vol, le tour a continué sans contexte narratif », un `HTTP 5xx`
  devient un échec serveur `query-rag` explicite.
- Étapes couvertes : RAG, assemblage du prompt, Max LLM, mise en file locale,
  GM labels, GM post-tour.
- `conversationTrace.ts` : nouveaux champs `errorKind`
  (`rag_timeout` | `rag_http_error` | `rag_client_error` | `rerank_failed`) et
  `rerankError`, renseignés par `prd4Orchestrator.ts`, pour séparer une coupure
  d'un vrai échec dans les analyses ultérieures.

### 2.2 RAG fiabilisé

- `RAG_DEGRADED_MODE_DEADLINE_MS` : 2 000 → **3 500 ms** (couvre le p90 observé
  de 2 441 ms avec marge).
- `RAG_DEFAULT_RETRIEVE_K` = **10** (au lieu de 15/16) pour compenser
  l'allongement du délai : moins de documents à reranker, donc une latence
  serveur plus basse. Appliqué dans `prd4Orchestrator.ts` et `ragService.ts`.
- `serverLatencyMs` et `rerankError` remontés dans la trace pour distinguer la
  lenteur du fournisseur des aléas réseau.

### 2.3 Budget legacy borné et honnête

- Nouveaux plafonds propres à la variante dans `maxPromptCompiler.ts` :
  `LEGACY_STATIC_PROMPT_CHARS = 20 000`, `LEGACY_SYSTEM_PROMPT_CHARS = 24 000`.
  Plus larges que `compact_v1` (legacy assume un prompt riche) mais bornés.
- `maxAgent.ts`, branche `legacy` : la fiche personnage est tronquée à la
  frontière de phrase la plus proche selon le budget statique restant, avec
  report dans la trace (`truncated`, `omissionReason: budget_statique_epuise`).
- Le rapport de budget compare désormais aux plafonds *legacy* et non à ceux de
  `compact_v1`, et l'UI affiche une **« économie potentielle »** en caractères
  lorsque le plafond est dépassé.

## 3. Suites possibles

- Comparer coût/qualité `legacy` tronqué vs `optimized_v3` (cible ~3 000 tokens
  d'entrée) sur des sessions tracées, puis envisager le changement de défaut.
- Router embeddings et rerank Voyage derrière un proxy unique pour réduire le
  nombre d'allers-retours réseau et rapprocher le p90 du p50.

## 4. Validation

- `bunx vitest run src/components/PipelineTraceTab.test.tsx src/agents` :
  7 fichiers, 46 tests au vert.
