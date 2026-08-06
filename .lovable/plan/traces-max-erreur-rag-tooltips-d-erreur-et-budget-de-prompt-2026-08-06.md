# Traces Max — erreur RAG, tooltips d'erreur et budget de prompt

## Ce que dit la trace analysée

Session `b00b827b…` tour 3, lue en base :

- **Erreur RAG** : `prd4_rag timed out after 2000ms`. Le RAG n'a pas échoué côté Voyage : il a été **coupé par le délai côté client** (`RAG_DEGRADED_MODE_DEADLINE_MS = 2 000 ms` dans `src/config/experienceRuntime.ts`). L'étape a duré 2 803 ms, donc la requête était encore en vol. Résultat : 0 match, section « CONTEXTE NARRATIF » vide, Max répond sans RAG.
- **Ce délai est trop court par nature** : sur les 94 tours mesurés dans `turn_latencies`, la médiane RAG est 1 207 ms, le p90 2 441 ms et 31 tours (33 %) dépassent 2 000 ms. Le timeout se déclenche donc sur un tour sur trois. La cause structurelle : `query-rag` enchaîne embedding Voyage (query) + `match_embeddings_voyage` + rerank Voyage sur `retrieveK = 16` — deux allers-retours réseau vers Voyage.
- **Budget dépassé** : variante `legacy`, prompt système 38 170 car. dont 32 407 car. pour « Fiche personnage », contre `limitChars = 12 000` / `staticLimitChars = 7 000`. Deux problèmes distincts :
  1. La branche `legacy` de `src/agents/maxAgent.ts` **n'applique aucune troncature** : elle concatène la fiche complète puis rapporte `withinBudget: false` sans rien réduire.
  2. Elle rapporte les plafonds de `compact_v1` (12 000 / 7 000), qui ne correspondent pas à ce que `legacy` est censé envoyer — l'indicateur est donc rouge en permanence et peu informatif.
- Coût observé : 9 625 tokens d'entrée par tour (gpt-5.6-luna), presque entièrement dus à la fiche personnage.

## Ce que je propose de faire

### 1. Tooltips d'explication sur les étapes en erreur
- Dans `PipelineTraceTab.tsx`, le composant `Step` reçoit un `detail` optionnel ; le badge `error`/`pending` devient survolable (`Tooltip` shadcn déjà présent) et affiche le message exact de la trace.
- Sources câblées : `trace.rag.error`, `trace.rag.rerankError`, l'erreur GM post-tour, l'erreur LLM, et pour `pending` la raison « étape non instrumentée / trace antérieure ».
- Le message est aussi rendu en texte sous l'étape sur écran tactile (tablette : pas de hover fiable), tronqué à 2 lignes.
- Ajout d'une traduction lisible pour les cas connus : timeout → « RAG interrompu après X ms (délai de dégradation) », HTTP 4xx/5xx → code + extrait, rerank → « rerank Voyage indisponible, matches vectoriels conservés ».

### 2. Fiabiliser le RAG sans allonger la voix
- Passer le délai de dégradation RAG de 2 000 ms à **3 500 ms** (couvre le p90 mesuré) tout en gardant l'appel non bloquant : la réponse de Max reste émise même si le RAG échoue.
- Réduire le travail serveur pour rester sous ce délai : `retrieveK` par défaut ramené de 16 à 10 (paramétrable dans l'onglet RAG Config, déjà existant), et le rerank conservé.
- Renseigner dans la trace la latence serveur (`serverLatencyMs`, aujourd'hui `null` car non remontée) afin de distinguer « lenteur Voyage » de « lenteur réseau client ».
- Distinguer dans le badge un RAG **coupé** (timeout, dégradé) d'un RAG **en échec** (erreur HTTP), pour ne pas afficher un rouge identique dans les deux cas.

### 3. Réduire le budget du prompt
- Corriger la branche `legacy` : rapporter ses propres plafonds et surtout **appliquer une troncature bornée** de la fiche personnage (coupe à la frontière de phrase), pour que le prompt système envoyé ne dépasse plus le plafond annoncé.
- Recommandation affichée dans le panneau : la vraie réduction vient du passage de la variante à `optimized_v3` (compilateur déjà en place, plafonds ~7 000 car. statiques), ce qui ferait passer les ~9 600 tokens d'entrée à un ordre de grandeur de 2 500–3 000 tokens par tour.
- Le panneau « Analyse compacte du payload » gagne une ligne « économie potentielle » comparant le total courant au plafond de la variante recommandée, pour objectiver le gain.
- Aucun changement du réglage global `MAX_PROMPT_VARIANT` sans ta validation : la bascule reste une décision explicite dans l'admin.

## Détails techniques

- `src/config/experienceRuntime.ts` : `RAG_DEGRADED_MODE_DEADLINE_MS` 2 000 → 3 500.
- `src/services/prd4Orchestrator.ts` : propagation d'un motif d'erreur typé (`rag_timeout` / `rag_http_error` / `rerank_failed`) dans la trace, et `retrieveK` par défaut abaissé.
- `src/types/conversationTrace.ts` : champ optionnel `errorKind` sur le bloc RAG (rétrocompatible, les traces antérieures restent lisibles).
- `src/components/PipelineTraceTab.tsx` : `Step` avec `detail` + `Tooltip`, mapping des messages, ligne « économie potentielle » dans le bloc budget.
- `src/agents/maxAgent.ts` : branche `legacy` — plafonds propres + troncature bornée de la fiche.
- Tests : extension de `PipelineTraceTab.test.tsx` (tooltip d'erreur rendu, message timeout traduit) et d'un test de budget legacy (prompt tronqué ≤ plafond).
- Plan sauvegardé dans `docs/plan_traces_max_rag_budget.md` au moment de l'implémentation.

## Hors périmètre

- Pas de migration SQL, pas de changement de secret, pas de bascule de variante en production.
