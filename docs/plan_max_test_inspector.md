# Plan — Banc d'essai complet « Test de réponse Max »

> Statut : en cours d'implémentation
> Objectif : transformer l'onglet `MaxPromptTestTab` en un véritable outil de fine-tuning capable de **rejouer un tour réel** à partir d'une simple phrase utilisateur, et d'exposer **toute la mécanique interne** (RAG → contexte injecté → brief GM pré-tour → prompt final → réponse → validateur → tokens & latences).

---

## 1. Nouveau flux de simulation

Mini-orchestrateur de test (UI-only, ne touche pas `conversationOrchestrator.ts` de prod). Étapes séquentielles, chacune horodatée et avec ses tokens :

1. **Sélection du personnage** (par défaut « Max ») → chargement du `system_prompt` depuis la table `characters`.
2. **Requête RAG** réelle via `queryRAG(userMessage, recentContext, top_k, threshold)` → renvoie les `RAGMatch[]` bruts.
3. **Construction du `MaxTurnKnowledgeContext`** via `buildKnowledgeContextFromRAG`.
4. **GM pré-tour** via `planGameMasterTurnDetailed(...)` → `GameMasterTurnBrief` + tokens.
5. **Réponse Max** via `simulateMaxResponse` → texte + `systemPrompt` exact + tokens.
6. **Validation conformité** via `validateMaxResponseConstraints` → diagnostic + tokens.

UI séquentielle non bloquante : `setState` après chaque `await`, chronologie qui se remplit en direct.

---

## 2. Modifications backend / services

Aucune migration DB. Aucune nouvelle edge function. Variantes additives qui n'altèrent pas le pipeline temps réel.

- **`src/services/openRouterLLM.ts`** : ajout `callLLMWithUsage(messages, options)` → `{ content, usage, generationId, model, latencyMs }`. `callLLM` continue d'exister.
- **`src/agents/maxAgent.ts`** :
  - `simulateMaxResponse` retourne désormais `{ response, systemPrompt, usage, latencyMs, model }`.
  - `validateMaxResponseConstraints` retourne `{ result, usage, latencyMs, model, validatorPrompt }`.
- **`src/agents/gameMasterAgent.ts`** : ajout `planGameMasterTurnDetailed(input)` → `{ brief, usage, latencyMs, model, systemPrompt, userPrompt }` (sans timeout dur, pour mesurer la latence réelle en test).
- **`src/services/ragService.ts`** : ajout `queryRAGDetailed(...)` → `{ matches, latencyMs, error? }`.

---

## 3. Refonte UI de `MaxPromptTestTab.tsx`

### a) Inputs (haut)
- Sélecteur **Personnage** (liste depuis `characters`).
- **Phrase utilisateur** (textarea).
- **Historique simulé** (textarea libre, `USER: ... / MAX: ...`).
- Paramètres avancés repliés : `RAG_TOP_K`, `RAG_THRESHOLD`, `currentTrustLevel`, `triggeredIds`, `timeElapsedSeconds`.
- Bouton **« Lancer la simulation complète »** + bouton **« Rejouer uniquement Max »**.

### b) Pipeline trace (chronologie verticale)
Chaque étape : statut, durée ms, modèle, tokens (in / out / total).

```
[1] RAG query                312 ms   5 matches
[2] Knowledge build            2 ms   3 facts / 1 hyp
[3] GM pré-tour              840 ms   gemini-2.0-flash   in 412 / out 168
[4] Max response            1240 ms   gpt-4o-mini        in 2104 / out 187
[5] Validateur               610 ms   gemini-2.0-flash   in 1820 / out 92
TOTAL                       3004 ms   ≈ 4783 tokens
```

### c) Détails RAG (accordéon)
Tableau matches : `source_table`, `similarity`, extrait, similarité (badge).

### d) Contexte injecté (accordéon)
Quatre blocs : `allowed_facts`, `active_memories`, `hypotheses`, `forbidden_topics` / `blocked_assertions`.

### e) Brief GM pré-tour (accordéon)
JSON formaté + badge fallback éventuel (timeout / no_json / llm_error).

### f) Prompt système final envoyé à Max (accordéon)
- Vue **« texte intégral »** (le `systemPrompt` retourné).
- Compteur de caractères / tokens estimés.

### g) Réponse Max + diagnostic validateur (déplié par défaut)
- Texte de la réponse.
- Badge conformité (vert/rouge) + résumé.
- Liste violations / safe_points.
- Tokens utilisés par Max + par validateur.

### h) Barre d'actions
- « Exporter JSON » du trace complet (téléchargement).
- « Charger un preset » (3-4 cas pré-écrits).

---

## 4. Exigences non fonctionnelles

- **Async non bloquant** : étapes séquentielles avec mise à jour incrémentale de l'UI.
- **Aucune régression prod** : `conversationOrchestrator.ts` inchangé.
- **Robustesse** : try/catch indépendant par étape ; un échec RAG continue avec contexte vide et badge rouge.
- **Tracking** : `feature_key` dédié `max_prompt_test_full` pour pouvoir filtrer dans `LLMUsageTab`.

---

## 5. Fichiers touchés

- `src/services/openRouterLLM.ts` — `callLLMWithUsage`.
- `src/services/ragService.ts` — `queryRAGDetailed`.
- `src/agents/maxAgent.ts` — `simulateMaxResponse` + `validateMaxResponseConstraints` enrichies.
- `src/agents/gameMasterAgent.ts` — `planGameMasterTurnDetailed`.
- `src/services/maxTestPipeline.ts` — *(nouveau)* mini-orchestrateur.
- `src/components/MaxPromptTestTab.tsx` — refonte complète.
- `docs/plan_max_test_inspector.md` — ce document.

---

## 6. Hors périmètre

- Édition en ligne du `system_prompt` du personnage (déjà géré ailleurs).
- Modification du flux temps réel (orchestrateur prod).
- Persistance en DB (localStorage suffisant).
