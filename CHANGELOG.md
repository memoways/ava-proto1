# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [0.22.0] - 2026-05-22 — Robustesse voix multi-navigateurs + garde-fous anti-blocage

### Ajouté
- **Audit technique complet du pipeline vocal Max** : nouveau document `docs/audit_voice_conversation_max.md` couvrant STT, orchestration conversationnelle, TTS, lecture audio navigateur, causes probables Safari/Firefox/Brave/Chrome, budgets de latence et plan d'amélioration priorisé.
- **Utilitaires de robustesse transverses** :
  - `src/services/asyncUtils.ts` : `TimeoutError`, `withTimeout()` et `createTimeoutSignal()` pour limiter les opérations critiques.
  - `src/services/browserCapabilities.ts` : sélection MIME `MediaRecorder` par feature detection et diagnostic navigateur.
  - `src/services/audioPlayback.ts` : audio unlock via `AudioContext`, lecture blob avec timeout, classification `NotAllowedError` / `NotSupportedError` / `AbortError` / réseau.
- **Tests ciblés** :
  - `asyncUtils.test.ts` — timeouts labelisés.
  - `browserCapabilities.test.ts` — sélection MIME STT.
  - `audioPlayback.test.ts` — classification des erreurs de lecture.
  - `tts/queue.test.ts` — statut de drain joué / échoué.
- **Preset TTS basse latence** `realtime_conversation` dans `settingsService.ts` : `eleven_turbo_v2_5`, MP3 64 kbps, `optimizeStreamingLatency=1`, vitesse 1.02.

### Modifié
- **STT Deepgram durci** (`src/services/deepgramSTT.ts`) :
  - suppression du forçage systématique `audio/webm;codecs=opus`;
  - sélection dynamique parmi `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`, puis fallback navigateur par défaut;
  - timeout token Deepgram (5 s), permission micro (10 s) et ouverture WebSocket (8 s);
  - callback `onError` avec contexte navigateur/MIME pour remonter les erreurs dans l'UI et PostHog;
  - fenêtre de silence réduite de 1500 ms à 900 ms pour améliorer la latence perçue.
- **Lecture TTS plus robuste** :
  - `playAudioBlob()` passe par `playAudioBlobRobust()` et enrichit les erreurs avec `playbackErrorType`.
  - `TTSQueue.drain()` retourne désormais `{ status, playedSegments, failedSegments, error }` au lieu d'un `void`, ce qui permet de distinguer succès, échec, annulation et skip.
  - `TTSQueue.cancel()` rejette explicitement les segments pending.
- **Pipeline conversationnel** (`src/pages/Index.tsx`) :
  - audio unlock déclenché au moment de répondre, d'activer le micro ou de presser le push-to-talk;
  - erreurs STT affichées en sous-titre et trackées via `stt_error`;
  - GM post-turn protégé par timeout 6 s et fallback neutre (`trust_delta: 0`, pas de trigger/game over);
  - résultat de queue TTS tracké via `tts_queue_result` si non joué.
- **Timeouts réseau** :
  - OpenRouter `streamLLM()` et `callLLMWithUsage()` protégés par `AbortController` 18 s.
  - Providers TTS ElevenLabs, Hume et Inworld protégés par timeout fetch 12 s + timeout `response.blob()` 12 s.

### Vérifié
- `npm test` : 20 tests passants.
- `npx tsc --noEmit` : OK.
- `npm run build` : OK.
- ESLint ciblé sur les fichiers modifiés : OK.
- Validation navigateur locale via Browser plugin : `http://127.0.0.1:8080/` charge correctement, écran d'accueil rendu, interaction `Commencer` → vidéo/skip → choix A/B OK, sans overlay Vite ni erreur applicative. Warnings observés : uniquement les warnings React Router v7 existants.

### Notes
- Le fallback WebAudio PCM complet pour Safari n'est pas encore implémenté ; cette version réduit fortement le risque en évitant le forçage WebM/Opus, en ajoutant un fallback navigateur par défaut et en rendant les erreurs observables/récupérables.
- Le vrai streaming audio bas niveau via MediaSource/WebAudio chunks reste une étape ultérieure. Le proxy ElevenLabs stream toujours, mais la lecture front reste blob-based avec timeouts.

## [0.21.1] - 2026-05-16 — Fix audio Inworld + coûts $ dans « Consommation Voix »

### Corrigé
- **Inworld TTS — pas de son lors du test** : le bouton « Tester » d'Inworld retournait bien un MP3 mais celui-ci n'était pas joué par le `<audio>` (frames MP3 concaténées via NDJSON difficiles à décoder). Passage à `stream: false` côté provider (`src/services/tts/providers/inworld.ts`) pour récupérer un MP3 monolithique fiable côté navigateur. Le proxy edge function conserve le mode streaming activé pour de futurs usages temps réel.

### Ajouté
- **Coûts $ estimés dans « Consommation Voix »** (`src/components/admin/VoiceUsageTab.tsx`) :
  - Constantes tarifaires publiques par provider (`ElevenLabs $0.30/1k chars`, `Hume $0.20/1k chars`, `Inworld $0.005/1k chars`).
  - 2 nouvelles KPI cards en tête de page : **Caractères TTS** (total période) et **Coût estimé (succès)**.
  - Section coût par carte provider : caractères synthétisés + coût succès (en ambre), plus coût total incluant erreurs si différent.
  - 3 nouvelles colonnes dans le tableau comparatif : **Chars**, **Coût (succès)**, **Coût total**.
  - Note de bas de page rappelant les tarifs indicatifs utilisés.

## [0.21.0] - 2026-05-16 — TTS multi-providers (ElevenLabs / Inworld / Hume) + voix Alain (Inworld) + monitoring « Consommation Voix »

### Ajouté
- **Façade TTS multi-providers** (`src/services/tts/`) : nouvelle architecture découplée avec `types.ts` (interface `TTSProvider`), `registry.ts` (mapping `elevenlabs` / `inworld` / `hume`), `index.ts` (entrée unique `generateSpeech` / `speakText` + télémétrie de latence uniforme), `queue.ts` (file séquentielle provider-agnostique), `textPrep.ts` + `textChunking.ts` (logique partagée de nettoyage markdown et segmentation prosodique).
- **3 providers TTS** implémentés sous `src/services/tts/providers/` :
  - `elevenlabs.ts` — branché sur le proxy existant (voix custom Max).
  - `inworld.ts` — voix **« Alain »** via `inworld-tts-2`, streaming HTTP NDJSON, paramètres `deliveryMode` (STABLE / BALANCED / CREATIVE), `language`, `speakingRate`.
  - `hume.ts` — Hume AI Octave via nouveau proxy edge function.
- **Edge functions proxy** : `supabase/functions/proxy-tts-inworld` (endpoint `/voice:stream`, parsing NDJSON, pipe MP3 directement au client) et `supabase/functions/proxy-tts-hume`. `verify_jwt = false` ajouté dans `supabase/config.toml`.
- **Sélecteur de provider actif global** dans Admin → **TTS Config** (`src/components/TTSConfigTab.tsx`) : un seul provider actif à la fois, persisté en DB + LocalStorage via `src/services/tts/providerSettings.ts` (clés `ava_tts_active_provider`, `ava_tts_settings_<provider>`). Panneau de réglages par provider + bouton **🔊 Tester** par provider.
- **Dashboard monitoring unifié** « Consommation Voix » (`src/components/admin/VoiceUsageTab.tsx`) — agrégation depuis `audio_latencies.metadata_json` :
  - Compteurs requêtes + taux de succès par provider
  - Latences **p50 / p95** (first-byte et total) par provider
  - Distribution des **codes HTTP** (200, 401, 429, 5xx…)
  - Liste des **erreurs récentes** (avec `error_type` + `error_message` complets)
  - Vue comparative côte-à-côte des providers actifs
- **Secrets** : ajout de `INWORLD_API_KEY` et `HUME_API_KEY` côté backend.
- **Renommage onglet** : « Consommation » → **« Consommation LLM »** pour distinguer du nouveau « Consommation Voix ».

### Modifié
- `src/services/elevenLabsTTS.ts` : converti en **shim de compatibilité** vers la nouvelle façade — aucun import existant cassé.
- `src/pages/Admin.tsx` : nouvel onglet **TTS Config** (remplace `VoiceConfigTab`), nouvel onglet **Consommation Voix** sous la section Technical.
- Proxy Inworld : correction d'un **401** dû à un double encodage base64 de `INWORLD_API_KEY`.

### Supprimé
- `src/components/VoiceConfigTab.tsx` — remplacé par `TTSConfigTab` multi-providers.

### Notes
- Le pipeline real-time reste sur ElevenLabs par défaut ; bascule vers Inworld (Alain) ou Hume se fait sans redéploiement via Admin → TTS Config.
- Le monitoring se peuple automatiquement (pas de migration DB requise — `metadata_json` était déjà persisté).

## [0.20.1] - 2026-05-14 — Banc d'essai « Lancer le banc » + traçabilité du system prompt Max

### Ajouté
- **Bouton 🧪 « Lancer le banc »** dans `MaxPromptTestTab` : pré-remplit un scénario complet (historique multi-tours ambigu sur la disparition d'Ava + résumé de session compressé) et déclenche `handleRun` avec query rewrite + rerank + mémoire de session injectée. Permet de valider en un clic les trois leviers RAG v2.
- **Champ `sessionSummary`** (textarea) dans les inputs du banc d'essai pour injecter manuellement une mémoire de session arbitraire.
- **Affichage de la requête réécrite** dans la chronologie du banc (étape « 0. Query rewrite » : original → réécrite + flag `rewritten`).
- **Colonne `rerank_score` Voyage et badge `embedding_provider` par chunk** dans l'accordéon RAG du banc d'essai (en plus de `retrieval_similarity` brute et du score final).
- **Badge de traçabilité du system prompt** dans le panneau d'édition Admin (`/admin?tab=characters`) : affiche `🆔 character.id`, `🕒 updated_at` UTC, `# hash FNV-1a 32-bit` du prompt chargé en DB, et `✎ #hash` de l'édition courante (passe en ambre si différent du DB). Permet de vérifier visuellement que le prompt provient bien de la ligne DB attendue.
- **Vérification post-save** : après `update`, re-lecture de `system_prompt` + `updated_at` depuis la DB, comparaison stricte avec la valeur envoyée, propagation du nouveau `updated_at` à l'état local.
- **Mini-protocole de test** ajouté au `README` pour rejouer query rewrite + rerank + mémoire de session avec les toggles à activer.

### Modifié
- `maxAgent.ts` : `MaxAgentInput.sessionSummary` propagé aussi par `simulateMaxResponse` (pas seulement par `callMaxAgent`).
- `Admin.tsx` : query `characters` enrichie de `updated_at` ; helper `promptHash()` (FNV-1a 32-bit) ajouté pour fingerprint visuel.

### Vérifié (audit centralisation system prompt Max)
- **Write** : `Admin.tsx` → `update({ system_prompt }) on characters` + `clearSystemPromptCache()`.
- **Read** : `maxAgent.ts:getCharacterSystemPrompt()` lit `select system_prompt from characters where name = ?` (cache mémoire + preload). Utilisé par `callMaxAgent` (live) **et** `simulateMaxResponse` (banc d'essai) — donc les éditions admin sont propagées partout.
- **Protection sync Notion** : `sync-notion/index.ts:325` préserve `existingCharacter.system_prompt` à chaque upsert. Conforme à la règle « Never overwrite local system prompts via Notion sync ».
- **Limite connue** : le cache `cachedSystemPrompts` est par onglet/process. Une édition dans un onglet n'invalide pas un autre onglet déjà chargé tant qu'il n'est pas rechargé. Cross-tab invalidation (Supabase Realtime sur `characters` ou `BroadcastChannel`) à envisager si besoin.

## [0.20.0] - 2026-05-10 — RAG v2 : Voyage AI + query rewriting + mémoire de session compressée

### Ajouté
- **Embeddings Voyage AI (`voyage-3`, 1024 dim)** en parallèle d'OpenAI :
  - Nouvelle colonne `embedding_v vector(1024)` sur `embeddings` + `embedding_provider` (`openai` / `voyage`)
  - Re-sync complète des 4 bases Notion avec génération double-provider à la demande
  - Edge function `query-rag` enrichie : sélection du provider (`provider`) + override `retrieve_k`
- **Reranker Voyage `rerank-2.5`** appliqué après retrieval vectoriel :
  - Champs `retrieval_similarity` (cosinus brut) et `rerank_score` (score Voyage) exposés sur chaque `RAGMatch`
  - Toggle `RAG_RERANK_ENABLED` dans `settings.json`
- **Filtrage strict par personnage** : `character_id` propagé sur les chunks RAG ; les chunks scopés sont filtrés par personnage actif, les chunks partagés (`storyworld`, `rules`) restent visibles à tous.
- **Index HNSW** (`m=16, ef_construction=64`) sur `embedding` et `embedding_v` en remplacement des `ivfflat` — corrige le scoring quasi-nul observé sur petits datasets.
- **Query rewriting LLM** — nouvelle edge function `rewrite-query` (gemini-3-flash-preview) qui transforme « et toi ? » en requête autonome avant appel RAG. Gating via `RAG_QUERY_REWRITE_ENABLED`. Intégré dans `conversationOrchestrator` et exposé dans `MaxPromptTestTab`.
- **Mémoire de session compressée** :
  - Nouvelle table `session_summaries` (session_id, summary, last_turn)
  - Edge function `summarize-session` (gemini-3-flash-preview) : résumé en bullet points (Faits, Sujets, Promesses) déclenché tous les `RAG_SUMMARY_EVERY_N_TURNS` (4) tours en fire-and-forget
  - Service `sessionMemoryService.ts` (fetch + déclenchement asynchrone)
  - Injection automatique dans le prompt système Max sous `## SOUVENIRS DE LA SESSION`
- **Banc d'essai Max enrichi** :
  - Nouvelle étape « 0. Query rewrite » dans la chronologie (original → réécrite)
  - Badge `embedding_provider` (+ `rerank` si actif) sur l'accordéon RAG
  - Par chunk : badge `character_id` (ou `shared`), `rerank_score` Voyage, `retrieval_similarity` brute, score final

### Modifié
- `ragService.ts` : `RAGMatch` étendu (`retrieval_similarity`, `rerank_score`, `character_id`) ; `RAGQueryOptions` (provider, rerank, retrieveK, characterId, rewrittenQuery) ; nouvelle helper `rewriteRAGQuery()`.
- `maxAgent.ts` : `MaxAgentInput` accepte `sessionSummary` ; `buildMaxSystemPrompt` injecte le bloc « SOUVENIRS » avant l'historique récent.
- `conversationOrchestrator.ts` : pipeline étendu — rewrite optionnel → RAG (avec query réécrite) → summary fetch parallèle → résumé background tous les N tours.
- `supabase/config.toml` : déclaration des nouvelles edge functions `rewrite-query` et `summarize-session`.

### Migrations
- `20260510115532_*` — ajout `embedding_v`, `embedding_provider`, `character_id` + RPC `match_embeddings_v`
- `20260510121928_*` — remplacement des indexes `ivfflat` par HNSW

### Notes
- Aucun secret supplémentaire visible côté front (clés Voyage stockées en backend uniquement).
- Les anciennes fonctions et les chunks OpenAI restent fonctionnels en fallback transparent.
- **Bug majeur résolu en cours de route** : retrieval Voyage retournait quasi rien à cause d'un index `ivfflat lists=100` sur ~226 vecteurs (scoring quasi-aléatoire). Fix : passage en HNSW.

## [0.19.0] - 2026-05-08 — Banc d'essai complet « Test de réponse Max »


### Ajouté
- **Banc d'essai d'inspection du pipeline Max** — refonte complète de l'onglet `MaxPromptTestTab` en outil de fine-tuning éditorial qui rejoue un tour réel étape par étape :
  - **Inputs enrichis** : sélecteur de personnage (depuis la table `characters`), phrase utilisateur libre, historique simulé parsé (`USER: ... / MAX: ...`), paramètres avancés repliés (`RAG_TOP_K`, `RAG_THRESHOLD`, `currentTrustLevel`, `triggeredIds`, `timeElapsedSeconds`)
  - **Chronologie verticale du pipeline** — 5 étapes visuelles avec statut (`pending` → `running` → `ok/error/skipped`), durée en ms, modèle utilisé, tokens in/out/total : (1) RAG query, (2) Knowledge build, (3) GM pré-tour, (4) Max response, (5) Validateur. Totaux cumulés (latence + tokens) affichés en pied de chronologie.
  - **Détails RAG dépliables** — tableau des `RAGMatch` bruts avec `source_table`, `source_id`, extrait textuel et badge de similarité (couleur selon le score), plus message d'erreur explicite si le quota OpenAI embeddings est épuisé.
  - **Contexte injecté décomposé** — quatre blocs visuels : `allowed_facts`, `active_memories`, `hypotheses`, `forbidden_topics` / `blocked_assertions`, permettant d'auditer exactement ce qui est chargé dans le prompt.
  - **Brief GM pré-tour** — JSON formaté du `GameMasterTurnBrief` (`response_mode`, `openness_level`, `reveal_budget`, `style_instructions`, `trust_change`, `video_trigger_id`) avec badge fallback éventuel (timeout / no_json / llm_error).
  - **Prompt système final** — vue texte intégral du `systemPrompt` réellement envoyé à Max, avec compteur de caractères et estimation de tokens (`estimateTokens`).
  - **Réponse Max + diagnostic validateur** — texte généré, badge de conformité (vert/rouge/orange), liste explicite des `violations` et `safe_points`, tokens Max vs tokens validateur, bouton « Régénérer avec prudence ».
  - **Export JSON** — téléchargement du trace complet (inputs, résultats de chaque étape, prompts bruts, usages) pour analyse externe ou tickets.
  - **Presets rapides** — 3-4 scénarios pré-écrits accessibles en un clic pour tester des configurations typiques.
- **Instrumentation détaillée des appels LLM** (variantes additives, zéro régression sur le pipeline temps réel) :
  - `openRouterLLM.ts` : `callLLMWithUsage()` retourne `{ content, usage, generationId, model, latencyMs }`
  - `ragService.ts` : `queryRAGDetailed()` expose les matches bruts et la latence réelle de l'edge function
  - `maxAgent.ts` : `simulateMaxResponse()` retourne `{ response, systemPrompt, usage, latencyMs, model }` ; `validateMaxResponseDetailed()` retourne `{ result, usage, latencyMs, model, validatorPrompt }`
  - `gameMasterAgent.ts` : `planGameMasterTurnDetailed()` retourne `{ brief, usage, latencyMs, model, systemPrompt, userPrompt }` (sans timeout dur, pour mesurer la latence réelle en test)
- **Nouveau service `maxTestPipeline.ts`** — orchestrateur de test UI-only qui exécute séquentiellement les 5 étapes (RAG → Knowledge → GM Pre → Max → Validator) avec mise à jour incrémentale de l'état (`onUpdate`) pour rendu temps réel. Gestion du `skipRAG`, `skipGM`, `skipValidator`. Parseur d'historique libre (`parseHistory`).
- **Document de plan** : `docs/plan_max_test_inspector.md` — spécification complète du flux de simulation, des modifications backend et de la refonte UI.

### Modifié
- `MaxPromptTestTab.tsx` : refonte intégrale du simple simulateur de réponse en banc d'essai pipeline complet (voir Ajouté).
- `Admin.tsx` : raccordement du nouvel onglet avec le selecteur de personnage dynamique.

### Notes
- Aucune migration DB, aucune nouvelle edge function. Toutes les variantes détaillées (`*Detailed`) coexistent avec les fonctions prod existantes sans modifier `conversationOrchestrator.ts`.
- Le tracking des coûts LLM fonctionne pour les appels de test via la `feature_key` dédiée `max_prompt_test_full`.

## [0.18.0] - 2026-05-02 — Diagnostic latence enrichi + guide Game Master

### Ajouté
- **Analyse factuelle des latences au survol des segments** (`LatencyBlockingTab`) :
  - `STEP_BUDGET_MS` : cibles de référence par étape (RAG 250 ms, GM pre 400 ms, Max LLM 800 ms, TTS 600 ms, validateur 500 ms, GM post 400 ms)
  - `STEP_HYPOTHESES` : pistes d'optimisation actionnables par étape (streaming token-per-token, switch modèle, cache RAG, etc.)
  - `computeBaselines` (`useMemo`) : calcule moyenne, médiane et **p95** sur l'ensemble des sessions visibles pour donner un contexte comparatif
  - `analyzeStep` : produit une sévérité (`ok` / `high` / `critical`) basée sur le budget, un ratio vs médiane et un drapeau "outlier ≥ p95"
  - Tooltip Radix UI riche par segment avec badge de sévérité + diagnostic + hypothèses
- **Panneau latéral détaillé au clic sur un segment** (`SegmentDetailSheet` via Shadcn `Sheet`) :
  - Contexte tour/session, badge sévérité
  - Métriques : durée mesurée vs **budget cible**, **part du tour** en %
  - Benchmarking sur le dataset visible : médiane, p95, moyenne
  - Liste d'hypothèses techniques pour réduire la latence sur ce step précis
  - Sélection partagée via `SegmentSelection`, segments transformés en boutons accessibles (`aria-label`)
- **Filtre de sévérité minimum** dans le bandeau de comparaison :
  - Type `SeverityFilter` (`all` / `high` / `critical`) + `SEVERITY_RANK`
  - Dropdown "Sévérité min." avec options "Toutes", "Élevée et plus", "Critique uniquement"
  - Les segments sous le seuil sont visuellement atténués (opacité 25 % + grayscale) tout en restant cliquables
- **Guide Game Master** : nouveau document `documents/guide_game_master_contenus_et_tests.md` — tutoriel complet pour rédiger les prompts, variables et choix de gameplay du GM, avec hypothèses, variantes à tester (technique + UX) et paramètres-clés à arbitrer

### Modifié
- `LatencyBlockingTab` : `StackedRow` reçoit `onSelectSegment`, calcul `dimmed` selon le filtre actif, segments rendus comme `<button>` interactifs
- État de sélection de segment remonté à `LatencyVisualization`
- Calculs d'analyse 100 % côté client sur des données déjà chargées : aucune latence ajoutée au pipeline conversationnel

### Notes
- Aucune migration DB ni appel réseau supplémentaire pour l'analyse de latence (purement dérivé de `pipeline.*_ms` déjà persisté)

## [0.17.0] - 2026-04-25 — Visualisation comparative des latences réelles par session et par tour

### Ajouté
- **Comparaison visuelle multi-sessions dans "Latence & blocage"** :
  - Une barre empilée **par session sélectionnée** (RAG / GM pre-turn / Max / Validateur / TTS / GM post-turn) sur une échelle commune
  - **Barres dépliables par tour** : chaque session peut être ouverte via un chevron pour afficher une barre par tour individuel (`Tour #N`), avec le blocker du tour s'il y en a un
  - **Marqueur de cible 2 s** positionné de manière cohérente sur toutes les barres (session + tours)
  - **Indicateur de dispersion** par session : bracket min–max sur la barre + badge `[min – max] · σ` dans l'en-tête (écart-type sur le total des tours)
  - **Auto-dépliage** : cliquer sur une session dans la liste la coche, la focalise et déplie automatiquement ses barres de tours
  - **Répartition relative (moyenne)** activable via toggle, calculée sur les sessions cochées uniquement
- **Filtres de session** dans le panneau de gauche :
  - Période (Toutes / 24h / 7 jours / 30 jours / personnalisée avec dates)
  - Nombre minimum de tours Max
  - Filtre blocage (Toutes / Avec blocage / Sans blocage)
  - Bouton "Réinitialiser les filtres" + compteur `Sessions (n / total)`
- **Sélection multi-sessions** via cases à cocher + boutons "Tout" / "Aucune" (limités aux sessions visibles après filtres)
- **Mini-graphique GM fallback** (`SessionsTab`) : comparaison `elapsed_ms` vs `timeout_ms` sur les derniers fallbacks Game Master pour visualiser les dépassements

### Modifié
- `LatencyVisualization` refactorée : présente exclusivement les **données réelles** des sessions (plus d'estimations best/moyen/pire). Une seule barre par session, autant de lignes que de sessions cochées.
- `scaleMax` recalculé dynamiquement pour intégrer la plus longue valeur (moyenne session, max de dispersion, max d'un tour individuel ou cible 2 s).
- État `expandedIds` remonté au composant parent pour permettre l'auto-dépliage depuis la liste de sessions.

### Notes
- Aucune migration DB. Toutes les données viennent du `pipeline.*_ms` déjà persisté dans `conversation_log`.

## [0.16.0] - 2026-04-24 — Performance pipeline, panneau latence et accès admin protégé

### Ajouté
- **Panneau admin "Latence & blocage"** (`LatencyBlockingTab`) : visualisation du temps passé à chaque étape du pipeline conversationnel
  - Vue globale : moyenne et max par étape (RAG, GM pre-turn, Max, validateur, TTS, GM post-turn) sur les 50 dernières sessions
  - Vue détail par session : timeline tour par tour avec identification du **dernier point de blocage** (étape la plus lente au-dessus du seuil)
  - Seuils de détection : RAG > 1.5s, GM > 1.5s, Max > 3s, validateur > 2s, TTS > 4s
- **Instrumentation des timings du pipeline** :
  - Nouveau type `ConversationPipelineTimings` (rag_ms, gm_pre_ms, max_ms, validator_ms, tts_ms, gm_post_ms, total_ms)
  - Nouveau champ `pipeline` sur `ConversationMessage`, persisté dans `conversation_log`
  - L'orchestrateur mesure RAG / GM pre-turn / boucle Max+validateur (retries inclus)
  - `Index.tsx` mesure le TTS et calcule le total du tour
  - Utilitaire `pickBlocker` qui flagge l'étape la plus lente dépassant les seuils
- **Protection mot de passe pour `/admin`** :
  - Nouveau composant `AdminAuthGate` avec écran de login (utilisateur `game-master`, mot de passe `jesuisdieu`)
  - Persistance via `sessionStorage` (clé `admin_auth_ok`) — survit au rechargement de l'onglet
  - Bouton "Déconnexion" en haut à droite du dashboard admin
  - Sécurité légère : objectif = éviter les accès accidentels via URL connue, pas une protection forte

### Modifié
- **Orchestrateur de conversation** : parallélisation `planGameMasterTurn` (GM pre-turn) et `simulateMaxResponse` (Max) via `Promise.all` pour réduire la latence
  - Max consomme désormais le contexte RAG initial (rapide) et la validation post-génération s'appuie sur le brief GM
  - Économie typique : ~2-5s par tour selon le modèle LLM
- **Validateur anti-hallucination — fail-open** :
  - Timeout dur `VALIDATION_TIMEOUT_MS = 4000` : si la validation dépasse 4s, la réponse est libérée avec une trace `fail-open sur timeout`
  - Si le LLM validateur renvoie un JSON malformé ou erreur, l'agent retourne `compliant: true` au lieu de bloquer
  - Les bypass restent visibles dans `HallucinationMetricsTab` pour audit
- **`App.tsx`** : route `/admin` désormais wrappée dans `<AdminAuthGate>`
- **`Admin.tsx`** : ajout de l'onglet "Latence & blocage"

### Notes
- Le `pipeline` étant stocké dans `conversation_log` (jsonb), aucune migration DB nécessaire
- Le mot de passe est en clair dans le code — protection volontairement faible (anti-curieux, pas anti-attaquant)

## [0.15.0] - 2026-04-24 — Validateur anti-hallucination, métriques et finitions du plan Max/GM

### Ajouté
- **Validateur anti-hallucination pré-TTS** : avant la synthèse vocale, la réponse de Max est validée contre les faits autorisés globaux + le contexte autorisé du tour
  - Logique de **retry** puis **fallback** quand une hallucination est détectée
  - Onglet admin `AntiHallucinationValidatorTab` avec aperçu de la fusion (faits globaux + contexte du tour) avant validation et TTS
  - Colonnes "Preview" et "MiniList" dans l'aperçu pour visualiser ce qui est réellement transmis au validateur
- **Persistance de la trace de validation par message** : chaque message de Max stocke sa `ConversationValidationTrace` dans `conversation_log` (jsonb)
  - Nouveau champ optionnel `validation` sur `ConversationMessage`
  - L'orchestrateur attache la trace renvoyée par le validateur au message Max avant push dans l'historique
- **Onglet admin `HallucinationMetricsTab`** : taux de régénération et de fallback agrégés sur les 50 dernières sessions à partir des traces persistées
- **Catalogue formel de modes de parole** (`src/services/speechModes.ts`) : 6 styles éditoriaux (`ferme_mefiant`, `fragile`, `revelateur_partiel`, etc.) exposés dans `GameMasterConfigTab`
- **Schéma visuel du pipeline** (`PipelineSchema`) intégré à l'onglet Pipeline : séquence en 8 étapes (User → STT → RAG → GM pre-turn → Max → Validateur → TTS → GM post-turn) avec glossaire interactif
- **Tests automatisés** :
  - `conversationOrchestrator.test.ts` : vérifie la logique "retry puis fallback" quand le validateur détecte une hallucination
  - `speechModes.test.ts` : valide le catalogue de modes
  - `PipelineSchema.test.tsx` : vérifie le rendu du schéma pipeline
  - `AntiHallucinationValidatorTab.test.tsx` : garantit la présence des composants `PreviewColumn` et `MiniList`

### Modifié
- **Orchestrateur de conversation** : intègre l'étape de validation entre la génération Max et le TTS, avec stratégie retry/fallback
- **Page `Index`** : la boucle conversationnelle attache la trace de validation au message Max avant la mise à jour de la session
- **`PipelineTraceTab`** : enrichi du schéma pipeline et du glossaire des étapes
- **`Admin.tsx`** : nouvel onglet "Métriques hallucinations" et raccordement du catalogue de modes au config GM

### Notes
- Aucune migration de schéma : `conversation_log` étant `jsonb`, la trace de validation y est stockée sans changement de structure
- La politique de vérité à 4 niveaux (certain / probable / inconnu / interdit) reste à implémenter — elle nécessite un refactor structurel de `MaxTurnKnowledgeContext` et du prompt LLM du validateur

## [0.14.0] - 2026-04-24 — Contrôle éditorial de Max, simulation et robustesse OpenRouter

### Ajouté
- **Contrôle structuré du prompt de Max** : nouveau système de pilotage séparant la persona, les objectifs, l'historique injecté et les garde-fous d'affirmation
  - Nouvel onglet admin `MaxPromptControlTab`
  - Paramètres persistés via `settingsService` pour cadrer ce que Max sait, ce qu'il peut dire et ce qu'il doit refuser d'affirmer
- **Écran de test de conformité** : nouvel onglet `MaxPromptTestTab` pour simuler une réponse de Max à partir d'un exemple de contexte RAG
  - Visualisation du contexte injecté
  - Vérification explicite du respect des contraintes d'interdiction d'affirmation
  - Retour lisible pour l'équipe éditoriale avant test en conversation réelle
- **Pipeline conversationnel visible dans l'admin** : nouvel onglet `PipelineTraceTab`
  - Affiche l'entrée utilisateur, le contexte RAG, le brief pré-tour du GM et la trace du dernier tour
  - Première matérialisation de la Phase 1 du plan d'implémentation Max/GM
- **Pré-turn planner GM** : introduction d'un brief structuré `GameMasterTurnBrief` généré avant la réponse de Max
  - Champs de direction éditoriale : `response_mode`, `openness_level`, `reveal_budget`, `style_instructions`
  - Prompt dédié éditable depuis l'admin via `preTurnPlannerPrompt`

### Modifié
- **Orchestrateur de conversation** : `processConversationTurn()` suit maintenant une logique en deux temps
  - préparation du tour par le Game Master
  - génération de Max sous contraintes
  - post-analyse légère pour la progression narrative
- **Agent Max** : prise en compte du nouveau contrat de contrôle éditorial (persona + contexte + contraintes du tour)
- **Services RAG et settings** : alignés pour exposer et persister les nouvelles briques de contrôle, de simulation et de traçabilité

### Corrigé
- **Lookup OpenRouter non bloquant** : correction du crash provoqué par les réponses 404/5xx lors de la récupération différée des coûts de génération
  - `proxy-llm` renvoie désormais une réponse structurée non fatale pour `get_generation_cost` quand la génération n'est pas encore disponible
  - `llmUsageTracker` traite ces cas comme "coût indisponible pour l'instant" au lieu de faire échouer le runtime
  - Élimine le blank screen lié au message `Generation lookup failed: 404`

## [0.13.0] - 2026-04-17 — Phase 1 PRD : A/B onboarding, PTT, sélection personnage, questionnaire enrichi

### Ajouté
- **Flow A/B testing onboarding** : nouvel écran `ABChoiceScreen` à l'entrée de l'app
  - Variante **A — Co-création** : le joueur définit lui-même son rôle/intention dans l'enquête (`OnboardingAScreen`)
  - Variante **B — Narrateur omniscient** : cadrage classique imposé par le Game Master (`OnboardingBScreen`)
  - Variante stockée dans la session (`variante_onboarding`) et trackée PostHog (`ab_choice_made`)
- **Sélection de personnage** : nouvel écran `CharacterSelectScreen` après l'onboarding
  - Choix entre Max / Emma / Léo / Ava (Max actif, autres en *coming soon*)
  - Personnage persisté dans `sessions.personnage_appele` + event `character_selected`
- **Écran d'appel entrant** : nouveau `RingingScreen` avec sonnerie animée, boutons Répondre / Raccrocher
- **Push-to-Talk (PTT)** : modalité voix assignée aléatoirement 50/50 par session
  - Nouveau hook `usePushToTalk` : binding global barre Espace + pointer events (mouse/touch) avec pointer capture et release sur blur
  - Nouvelle méthode `DeepgramSTT.flush()` qui force la finalisation du transcript courant au relâchement du bouton
  - Bouton PTT dédié dans `ConversationScreen` activé selon `voiceModality`
  - Auto-reprise du micro désactivée en mode PTT après réponse de Max ou cinématique
  - Modalité stockée dans `sessions.modalite_voix` + events `voice_modality_assigned`
- **Indicateur audio temps réel** : nouveau hook `useAudioLevel` (Web Audio API, RMS lissé)
  - Halos concentriques animés autour du bouton micro/PTT, réagissant au volume capté
  - `DeepgramSTT.getStream()` exposé pour permettre la visualisation
- **Bouton "Raccrocher"** présent dans `RingingScreen` et `ConversationScreen` (déclenche game over `hang_up`)
- **Bouton "Questionnaire"** apparaît après 4 minutes en bas à droite (sortie anticipée)
- **Questionnaire enrichi paginé** (~50 champs sur 8 blocs) :
  - Bloc 1 — Global (NPS, rating, mot-clé)
  - Bloc 2 — Game Master / onboarding (clarté, rôle compris, immersion)
  - Bloc 3A/3B — Variante reçue (co-création vs narrateur, freeform)
  - Bloc 4 — Voix & modalité (naturalité Max/GM, confort modalité, sous-bloc PTT conditionnel)
  - Bloc 5 — Latence détaillée (perçue + moments)
  - Bloc 6 — Immersion / mécanique (legacy)
  - Bloc 7 — Valeur perçue (paiement, prix, format)
  - Bloc 8 — Contact (opt-in feedback / updates)
  - Barre de progression + navigation Précédent/Suivant + logique conditionnelle (variant + modality)
- **Sync Notion étendu** : 15 nouvelles colonnes créées dans la base Questionnaire (GM clarte, A cocreation engage, B narrateur immersif, PTT relachement, Latence percue, etc.) avec mapping `SELECT_MAPS` côté Edge Function

### Modifié
- **Routing global** : nouveau `GamePhase` étendu (`ab_choice`, `onboarding_a`, `onboarding_b`, `character_select`, `ringing`, …)
- **`useGameState`** : ajout de `variant`, `voiceModality`, `character` + setters dédiés
- **`Index.tsx`** : remplacement de l'OnboardingScreen unique par le flow A/B + sélection perso + ringing
- **`syncQuestionnaireToNotion`** : signature étendue avec `variant` et `voiceModality`

---

## [0.12.0] - 2026-03-12

### Corrigé
- **Closure stale `isProcessing`** : remplacement du state React par un `useRef` pour le guard anti-double-processing, éliminant les blocages silencieux des tours de conversation suivants
- **Sync Notion "Failed to fetch"** : refactoring de la sync pour traiter les bases table par table avec timeout 120s par appel, au lieu d'un seul appel global qui dépassait le timeout des Edge Functions

### Ajouté
- **PostHog Analytics** : intégration complète du tracking utilisateur avec session recording
  - Événements trackés : `game_started`, `phase_changed`, `intro_video_completed`, `video_trigger_activated`, `game_over`, `questionnaire_submitted`
  - Identification des sessions pour le suivi longitudinal
  - Autocapture et session replay activés

---

## [0.10.0] - 2026-03-08

### Ajouté
- **Debug Panel** : panneau de diagnostic latéral activé via `?debug` dans l'URL
  - Capture tous les appels sortants (LLM, TTS, STT, RAG, Notion, Session, Game Master) avec payload, durée, status
  - Filtrage par service et par niveau (info/success/warn/error)
  - Entrées expansibles avec détail URL + payload tronqué (2000 chars)
  - Copie individuelle ou globale des logs
  - Auto-scroll avec bouton "scroll to bottom"
  - Colorisation par service (badges) et par niveau (indicateurs)
  - Zero impact en production : simple test booléen si `?debug` absent

### Corrigé
- **Hint micro** : le message "Cliquez sur le micro pour parler à Max" ne s'affiche plus après la première activation du micro (tracking `micEverStarted`)

---

## [0.9.0] - 2026-03-08

### Ajouté
- **Player vidéo Gumlet** : intégration du player Gumlet via iframe embed (`GumletVideoPlayer.tsx`) pour jouer de vraies vidéos au lieu des placeholders texte
  - Contrôles : play/pause + volume uniquement (configurable dans le dashboard Gumlet)
  - Mode responsive plein écran avec overlays (HUD timer/confiance sur les vidéos mid-conversation, sans micro)
  - Bouton "Passer →" superposé sur la vidéo
  - Détection de fin de vidéo via `postMessage` events
  - Fallback automatique vers `VideoPlaceholder` si aucun `video_url` n'est défini sur un trigger
- **Vidéo d'intro** : cinématique d'introduction (`67a281cac82041cdc3714c0c`) jouée via Gumlet entre l'onboarding et la conversation
- Champ `video_url` optionnel ajouté au type `VideoTrigger`

### Ajouté (v0.8.0)
- **Persistance des réglages de jeu** : bouton Sauvegarder dans l'onglet Mécanique de /admin, avec indicateur de modifications non enregistrées

---

## [0.8.0] - 2026-03-08

### Ajouté
- **Champs contact dans le questionnaire** : nom/prénom, email, et 2 cases à cocher (opt-in feedback, opt-in suivi du projet) — synchronisés dans la base de données et dans Notion (colonnes "Nom contact", "Email contact", "Opt-in feedback", "Opt-in updates")

### Optimisé
- **Latence première réplique** : 6 optimisations pour réduire drastiquement le temps de réponse initial de Max :
  - Preload du system prompt pendant la cinématique d'intro
  - Warm-up des Edge Functions (OPTIONS preflight sur proxy-llm, proxy-tts, query-rag)
  - RAG réduit de 5 à 3 matches
  - TTS : format `mp3_22050_32` (~4x plus léger) + `optimize_streaming_latency=4`
  - Seuil de phrase TTS abaissé (enqueue plus tôt)
  - RAG fetch parallélisé avec le preload du system prompt

---

## [0.7.1] - 2026-03-08

### Corrigé
- **Récupération des coûts OpenRouter** : ajout des headers d'authentification manquants (`apikey`, `Authorization`) dans `fetchGenerationCost`, mécanisme de retry robuste (15s → 30s → 60s) pour pallier le délai d'indexation de l'API OpenRouter
- **Protection du system prompt au sync Notion** : `sync-notion/index.ts` vérifie maintenant si un prompt custom existe en base avant d'écraser avec les données Notion — le prompt personnalisé de Max est préservé
- **Bouton "Recalculer coûts manquants"** dans l'onglet Consommation pour relancer la récupération des coûts sur les entrées en `cost_fetch_failed`

---

## [0.7.0] - 2026-03-08

### Ajouté
- **LLM Cost Tracker** : module complet de suivi des coûts OpenRouter dans `/admin` → Technique → Consommation
  - KPI cards : coût total, coût 30 jours, coût aujourd'hui, requêtes totales, tokens totaux
  - Graphiques : coût par jour, par modèle, par feature
  - Tableau filtrable des 100 dernières requêtes (date, feature, model, tokens, cost, status)
  - Pipeline de collecte : chaque appel OpenRouter est loggé automatiquement avec tokens + generation_id, puis le coût USD exact est récupéré via l'API OpenRouter
- **Persistance des réglages admin en base** : tous les réglages LLM, Voix, Gameplay et Game Master sont maintenant stockés dans la table `admin_settings` (clé/valeur JSONB) au lieu de localStorage seul
  - Boutons **Sauvegarder** explicites dans les onglets LLM Config et Voix
  - Hydratation automatique des réglages au chargement de la page admin
  - Les choix de modèle, température, voix, presets survivent au rechargement et au changement de navigateur
- **Vérification du system prompt** : relecture de contrôle en base après sauvegarde, invalidation forcée du cache mémoire
- **Rapport de sync Notion détaillé** : après chaque synchronisation, affichage structuré par table avec :
  - Nombre d'entrées synchronisées / total
  - Chunks RAG créés par table
  - Caractères et tokens estimés pour les embeddings
  - Total d'embeddings en base
- Table `admin_settings` créée avec RLS ouverte (prototype)
- Table `llm_usage` créée avec index sur `created_at`, `model`, `feature_key`, `session_id`

### Modifié
- `openRouterLLM.ts` : intégration du tracking automatique (log initial + récupération coût async via generation_id)
- `proxy-llm/index.ts` : action `get_generation_cost` ajoutée, données d'usage incluses dans le stream
- `settingsService.ts` : refonte avec couche de persistance DB (`loadFromDB`, `saveToDB`, `hydrateAllSettings`)
- `sync-notion/index.ts` : retourne maintenant `embedding_stats` et `total_embeddings_in_db` dans la réponse
- `Admin.tsx` : sync Notion affiche un rapport visuel au lieu du JSON brut
- `maxAgent.ts`, `gameMasterAgent.ts`, `conversationOrchestrator.ts` : propagation du `session_id` et `feature_key` pour le tracking

---

## [0.6.0] - 2026-03-08

### Ajouté
- **Config LLM dynamique** dans `/admin` — onglet dédié pour sélectionner le modèle LLM de Max et du Game Master indépendamment, avec température, max tokens et top_p ajustables
- **Multi-modèles** : Qwen 2.5 72B, Claude Sonnet 4, Claude Haiku 3.5, Llama 4 Scout, Gemini 2.5 Flash, Grok 3 Mini, Grok 3, Grok 2
- **Config voix ElevenLabs** dans `/admin` — onglet Voix avec sliders pour stability, similarity boost, style, speed et speaker boost
- **5 presets vocaux** : Défaut, Claire et articulé, Calme et mesuré, Expressif, Rapide et naturel
- **Bouton test voix** dans la config pour pré-écouter les réglages avant une conversation
- **HUD conversationnel** : timer + jauge de confiance regroupés dans une cartouche sobre en haut à gauche avec tooltip explicatif au hover
- **Bouton info (i)** en haut à droite, plus visible, ouvrant une modale détaillée sur le projet (concept, pipeline technique, objectifs, limitations, indicateurs)
- **Onglet questionnaire anticipé** : bouton discret en bas à droite après 4 minutes d'expérience pour accéder au questionnaire sans attendre la fin
- **Explication des indicateurs** ajoutée dans la modale info (timer + confiance)

### Modifié
- `settingsService.ts` : ajout `OPENROUTER_MODELS` (8 modèles), gestion des settings LLM et TTS séparés par personnage
- `elevenLabsTTS.ts` : récupération dynamique des voice_settings depuis settingsService avant chaque appel TTS
- `proxy-tts/index.ts` : accepte et transmet les `voice_settings` complets à l'API ElevenLabs
- `ConversationScreen.tsx` : refonte du layout HUD (cartouche timer+trust en haut gauche, bouton i en haut droite, tooltip hover)
- `Admin.tsx` : ajout onglets LLM Config et Voix

---

## [0.5.0] - 2026-03-08

### Ajouté
- Micro persistant en mode continu : la connexion Deepgram reste ouverte pendant toute la conversation, le micro est mis en pause/reprise sans reconnexion
- Méthodes `pause()` et `resume()` sur `DeepgramSTT` pour gérer le mute sans couper le WebSocket
- Onglet **Questionnaires** dans `/admin` avec tableau récapitulatif de toutes les réponses (NPS, immersion, écoute, prix, etc.)
- Edge Function `sync-questionnaire` — synchronise les réponses du questionnaire vers Notion (18 champs)
- Sauvegarde de session complète (conversation log, trust level, triggers activés, durée, game over reason)
- Édition du system prompt des personnages dans `/admin` avec sauvegarde en base
- Durée de l'expérience augmentée à 10 minutes (600s)

### Modifié
- `deepgramSTT.ts` : refactorisé en mode persistant (pause/resume au lieu de stop/start)
- `Index.tsx` : le micro se relance automatiquement après chaque réponse de Max ou cinématique, sans action utilisateur
- `Admin.tsx` : ajout onglets Questionnaires + édition system prompt fonctionnelle
- Politiques RLS sur `characters` ouvertes pour permettre l'édition depuis le prototype (anon + authenticated)

### Corrigé
- Sauvegarde du system prompt dans `/admin` qui ne persistait pas (problème RLS)

---

## [0.4.0] - 2026-03-08

### Ajouté
- Pipeline RAG complet : Notion → Supabase → embeddings → prompt enrichi
- Edge Function `sync-notion` — synchronise 4 bases Notion (Characters, Storyworld, Gameplay, Vidéos) vers Supabase avec génération d'embeddings OpenAI
- Edge Function `query-rag` — recherche sémantique pgvector via `match_embeddings`
- Service client `ragService.ts` avec `queryRAG()`, `getRAGContext()`, `syncNotion()`
- IDs des bases Notion AVA intégrés dans `ragService.ts` (`AVA_NOTION_DATABASES`)
- Fetch du contenu de page Notion (blocks) pour les characters (backstory complet)
- Injection automatique du contexte RAG dans l'orchestrateur de conversation
- Migration SQL : contraintes UNIQUE `notion_id` sur tables narratives + politiques RLS

### Modifié
- `conversationOrchestrator.ts` : intégration RAG automatique avant chaque réponse de Max
- `supabase/config.toml` : ajout des entrées sync-notion et query-rag (verify_jwt = false)

### Résultats du premier sync
- 4 characters synchronisés (Max, Ava, Emma, +1)
- 38 éléments storyworld synchronisés
- 42 embeddings générés (text-embedding-3-small, 1536 dim)
- 0 gameplay steps (base Notion vide)
- 0/1 video triggers (page sans titre)

---

## [0.3.0] - 2026-03-08

### Ajouté
- Intégration TTS ElevenLabs dans le flux conversationnel (Max parle avec sa voix)
- Edge Function `proxy-tts` pour proxy sécurisé vers ElevenLabs API
- Service client `elevenLabsTTS.ts` avec `generateSpeech()`, `playAudioBlob()`, `speakText()`
- Image de fond cinématique pour l'écran de conversation (Max devant chalet)
- Overlay semi-transparent + vignette pour lisibilité des sous-titres sur le background
- Documents projet : PRD, CHANGELOG, STORY, README

### Modifié
- `ConversationScreen.tsx` : background image plein écran avec parallaxe
- `Index.tsx` : intégration TTS après réponse LLM de Max, avec fallback gracieux si TTS échoue

---

## [0.2.0] - 2026-03-08

### Ajouté
- Edge Function `proxy-stt` pour fournir token Deepgram au client
- Service client `deepgramSTT.ts` avec WebSocket streaming + VAD
- Edge Function `proxy-llm` pour proxy vers OpenRouter API
- Service client `openRouterLLM.ts` avec streaming LLM (`streamLLM`) et appel simple (`callLLM`)
- Agent Max (`maxAgent.ts`) — personnage conversationnel, prompt système français
- Agent Game Master (`gameMasterAgent.ts`) — orchestrateur JSON, évaluation trust/triggers/game_over
- Orchestrateur de conversation (`conversationOrchestrator.ts`) — coordonne Max + Game Master + triggers vidéo
- Système de triggers vidéo mid-conversation (3 démo : famille, secret, disparition)
- Hook `useGameState.ts` — state machine complète (phases, trust, triggers, audio)
- Hook `useTimer.ts` — countdown 4 minutes avec warning
- Fichier `settings.json` — variables configurables centralisées

---

## [0.1.0] - 2026-03-07

### Ajouté
- Setup initial du projet React + Vite + Tailwind + TypeScript via Lovable
- Design system dark/cinématique (index.css tokens, couleurs HSL)
- Écran d'onboarding skippable ("Où est Ava ?")
- Écran placeholder vidéo (écran noir + texte descriptif + barre de progression + skip)
- Écran de conversation principal avec portrait Max, micro, sous-titres, timer, trust
- Composant SubtitleOverlay (sous-titres utilisateur + Max)
- Écran Game Over avec raison + boutons restart/questionnaire
- Écran Gate de confiance
- Écran Questionnaire de fin intégré (expérience, immersion, mécanique, narration, valeur)
- Écran de remerciement
- Types TypeScript partagés (`types/index.ts`)
- Schema Supabase : tables characters, storyworld, video_triggers, gameplay_steps, rules, sessions, embeddings + pgvector
- Fonction SQL `match_embeddings` pour recherche sémantique

---

<!-- 
GUIDE RAPIDE:
- "Ajouté" pour les nouvelles fonctionnalités
- "Modifié" pour les changements de fonctionnalités existantes  
- "Déprécié" pour les fonctionnalités qui seront supprimées
- "Supprimé" pour les fonctionnalités supprimées
- "Corrigé" pour les corrections de bugs
- "Sécurité" pour les vulnérabilités corrigées

VERSIONING:
- 0.x.x = prototype/dev
- 1.0.0 = première release stable
- x.Y.x = nouvelle fonctionnalité
- x.x.Z = correction de bug
-->
