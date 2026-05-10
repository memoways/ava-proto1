
# Optimisation RAG / mémoire / cohérence persona

Objectif : tirer le maximum du pipeline existant (Notion → pgvector → Max) sans le refondre. On reste sur Supabase + pgvector. On ajoute Voyage AI (embeddings + reranker), un filtrage strict par personnage, et une mémoire intra-session compressée. Pas de Mem0/Letta/Qdrant/GraphRAG dans cette itération.

---

## Diagnostic actuel (rappel)

- Embeddings : OpenAI `text-embedding-3-small` (1536 dim)
- Chunking : sections par `## `, max 1500 chars, sans overlap, sans contexte parent injecté
- Retrieval : `match_embeddings` global (pas de filtre source/personnage), `top_k=5`, seuil `0.3`
- Knowledge context : tranchage figé (top3 facts / top2 memories / `<0.55` = hypothèses), aucune trace du personnage actif
- Mémoire intra-session : aucune — uniquement les 6 derniers tours bruts envoyés au LLM
- Pas de reranking, pas de query rewriting, pas de hybrid search

Résultat observé : chunks d'autres personnages qui remontent, hypothèses arbitraires basées sur un seuil dur, RAG souvent "à côté" quand l'utilisateur parle vaguement.

---

## Plan en 5 chantiers (ordonnés par ratio impact / effort)

### Chantier 1 — Filtrage strict par personnage (impact immédiat, 0 coût)

**Pourquoi** : aujourd'hui quand on parle à Ava, des chunks "characters/Max" peuvent gagner le top-K et polluer le contexte.

**Quoi** :
1. Migration : nouvelle colonne `embeddings.character_id uuid NULL` + index. Pour les chunks issus de `source_table='characters'`, on remplit avec l'id du personnage. Pour `storyworld` / `gameplay_steps` / `video_triggers`, on laisse `NULL` (= partagé).
2. Migration : nouvelle fonction `match_embeddings_scoped(query_embedding, match_count, match_threshold, p_character_id uuid)` qui ne retourne que les chunks où `character_id IS NULL OR character_id = p_character_id`.
3. `sync-notion` : remplir `character_id` lors de l'insertion des chunks `characters`.
4. `query-rag` (edge function) : accepter un nouveau body field `character_id` et appeler la nouvelle RPC.
5. Côté front : `queryRAG` / `queryRAGDetailed` reçoivent `characterId` ; `conversationOrchestrator` et `maxTestPipeline` le passent à partir du personnage actif (Admin → sélection ; en jeu → personnage de la session).

### Chantier 2 — Voyage AI : embeddings + reranker (qualité retrieval)

**Pourquoi** : voyage-3 surpasse OpenAI 3-small sur BEIR, et le reranker `rerank-2.5` permet de récupérer top 15-20 puis reclasser en top 5 ultra-pertinents — exactement ce qui manque aujourd'hui.

**Quoi** :
1. Ajout du secret `VOYAGE_API_KEY` (action utilisateur via `add_secret`).
2. Migration : nouvelle colonne `embeddings.embedding_v voyage(1024)` ou plus simplement `embedding_v vector(1024)` + index ivfflat dédié, en gardant l'ancienne colonne pendant la transition. Rebuild des embeddings au prochain sync. Nouvelle RPC `match_embeddings_v` qui interroge cette colonne. *Alternative plus simple : on remplace l'ancienne colonne après recalcul complet — choix à valider en début d'implémentation selon volume.*
3. `sync-notion` : appel Voyage `voyage-3` (input_type=`document`) à la place d'OpenAI pour générer les embeddings.
4. `query-rag` : appel Voyage `voyage-3` (input_type=`query`), récupère `match_count` élargi (15), puis appelle `voyage-rerank-2.5` avec les contenus pour reclasser, garde top N (= `RAG_TOP_K` actuel, défaut 5).
5. Réglage : `RAG_TOP_K` reste à 5 ; on ajoute deux paramètres dans `settings.json` : `RAG_RETRIEVE_K=15` et `RAG_RERANK_ENABLED=true` (pour pouvoir débrancher).
6. Surface admin : on expose ces deux nouveaux réglages dans l'onglet RAG existant + le score de rerank (différent de la similarité cosinus) est affiché dans le test "Max Response Test".

### Chantier 3 — Chunking enrichi avec contexte parent (Anthropic-style contextual chunks, sans le coût LLM)

**Pourquoi** : aujourd'hui un chunk "## Enfance" perd la référence "Personnage Ava" sauf si le titre est dans le chunk. Voyage embeddings gèrent mieux ce contexte si on le préfixe.

**Quoi** : modifier `chunkText` dans `sync-notion` :
1. Préfixer chaque chunk par un header structuré : `Personnage: <nom> | Section: <h2> | Type: <archétype>` (ou pour storyworld : `Sujet: <titre> | Catégorie: <type>`).
2. Ajouter un overlap de 150 chars entre chunks consécutifs (paragraphe de fin recopié au chunk suivant) pour éviter les coupures sèches.
3. Réduire `maxChunkSize` à 1000 (Voyage est meilleur sur des chunks plus courts et le rerank compensera).

Pas de contextualisation LLM (trop coûteux/lent à l'ingestion), mais on capture 80% du gain.

### Chantier 4 — Query rewriting léger (mémoire intra-session activée)

**Pourquoi** : aujourd'hui on envoie au RAG le message brut + 6 derniers messages concaténés. Quand l'utilisateur dit "et toi, ça t'est arrivé ?", la requête vectorielle est inutile. Un mini-LLM peut reformuler.

**Quoi** :
1. Avant le RAG, appel rapide `gemini-3-flash-preview` (déjà dispo via Lovable AI) avec un prompt court : "Reformule la dernière question de l'utilisateur en une requête de recherche autonome en français, en réutilisant les références implicites de l'historique. Réponds uniquement par la requête."
2. Cette requête reformulée alimente Voyage embeddings + rerank. Le message brut reste celui envoyé à Max.
3. Toggle dans settings : `RAG_QUERY_REWRITE_ENABLED=true` (débrayable).
4. Surface dans Max Response Test : nouvelle ligne "Requête réécrite" entre l'input et l'étape RAG.

### Chantier 5 — Mémoire intra-session compressée (cohérence sur 10 min)

**Pourquoi** : sur un tour 8/10, Max ne "voit" pas ce qui s'est dit au tour 1. Pas besoin de Mem0 pour 10 min, on peut faire un résumé glissant.

**Quoi** :
1. Nouvelle table `session_summaries (session_id uuid, summary text, last_turn int, updated_at)`.
2. Tous les 4 tours, edge function `summarize-session` (gemini-3-flash-preview) génère un résumé bullet-point (faits saillants sur l'utilisateur, sujets déjà abordés, promesses faites par Max).
3. Ce résumé est injecté dans le system prompt de Max sous une nouvelle section `## SOUVENIRS DE LA SESSION` — alimente aussi `knowledgeContext.activeMemories`.
4. Reset à la fin de session (déjà géré par `session_id`).

---

## Inspecteur Max Test — extensions

Le bench existant (`MaxPromptTestTab` + `maxTestPipeline`) gagne 4 lignes :
- "Requête réécrite" (chantier 4)
- "Embedding model" + "Rerank model" + scores rerank par chunk (chantier 2)
- Badge `character_id` filtré sur chaque match (chantier 1)
- Bloc "Résumé de session injecté" (chantier 5, si simulé)

Aucune logique métier à dupliquer : on enrichit juste les types `RAGMatch` et `RAGQueryDetailed`.

---

## Détails techniques

### Nouveaux secrets
- `VOYAGE_API_KEY` (à ajouter)

### Migrations DB
1. `ALTER TABLE embeddings ADD COLUMN character_id uuid NULL REFERENCES characters(id) ON DELETE CASCADE;` + index
2. `ALTER TABLE embeddings ADD COLUMN embedding_v vector(1024) NULL;` + index ivfflat
3. Nouvelle RPC `match_embeddings_scoped_v(query_embedding vector(1024), match_count int, match_threshold float, p_character_id uuid)`
4. Nouvelle table `session_summaries`

### Nouveaux paramètres `settings.json`
- `RAG_RETRIEVE_K: 15`
- `RAG_RERANK_ENABLED: true`
- `RAG_QUERY_REWRITE_ENABLED: true`
- `RAG_EMBEDDING_PROVIDER: "voyage"` (`"openai"` reste possible en fallback)
- `RAG_SUMMARY_EVERY_N_TURNS: 4`

### Edge functions touchées
- `sync-notion` (chunking enrichi + Voyage embeddings + character_id)
- `query-rag` (filtrage personnage + Voyage embed query + rerank)
- nouvelle `summarize-session`
- (optionnel) nouvelle `rewrite-query` ou inliné dans `conversationOrchestrator` via Lovable AI Gateway

### Front / services
- `ragService.queryRAG(userMessage, recentContext, topK, threshold, characterId)` — signature étendue
- `conversationOrchestrator` : passe le `characterId` actif + appelle `rewrite-query` avant `queryRAG` + injecte le summary courant
- `maxTestPipeline` : ajoute étape "rewrite" + champs rerank dans la trace
- `Admin RAG tab` : nouveaux toggles et affichage du provider d'embedding

---

## Roadmap d'exécution suggérée

```text
Sprint 1 (rapide, gros gain visible)
  └ Chantier 1 : filtrage strict par personnage
  └ Chantier 3 : chunking enrichi (préfixes + overlap)
  → Re-sync Notion complet

Sprint 2 (qualité retrieval)
  └ Chantier 2 : Voyage embeddings + rerank
  → Re-sync Notion complet sur la colonne v

Sprint 3 (intelligence du tour)
  └ Chantier 4 : query rewriting
  └ Chantier 5 : mémoire intra-session compressée
```

Chaque chantier est isolé par un toggle, donc on peut désactiver indépendamment en cas de régression.

---

## Hors scope volontaire

ID-RAG/PersonaRAG/Mem0/Zep/LoRA/RAFT/GraphRAG : intéressants mais disproportionnés pour un proto de session 10 min — à reconsidérer si l'app évolue vers du multi-session persistant par utilisateur.
