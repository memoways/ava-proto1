# Où est Ava ? — Development Story

> **Status**: 🟡 In Progress  
> **Creator**: Ulrich Fischer / Memoways  
> **Started**: 2026-03-07  
> **Last Updated**: 2026-05-22 (session 21 — PRD4 livré en 6 phases : nouveau parcours unique post-film, capture de rôle joueur en push-to-talk + résumé LLM, Max contextualisé par le rôle, 4 personnages avec Emma/Ava/Léo grisés, GM pré-tour retiré et GM post-turn async, nouveau questionnaire 10 questions, mapping Notion avec accents exacts, suppression des écrans A/B et de la route `/legacy`, back-office enrichi d'une section rôle utilisateur et d'une timeline GM post-turn)

---

## Genesis Block

### The Friction

```
Les expériences narratives interactives restent coincées entre le jeu vidéo scripté 
et le chatbot sans âme. Personne ne propose une vraie conversation voice-to-voice 
avec un personnage fictif, pilotée par IA, avec une mise en scène cinématique 
et des triggers vidéo dynamiques. Le potentiel du voice-to-voice LLM pour 
la narration interactive est inexploré.
```

### The Conviction

```
Memoways a l'expertise narrative et audiovisuelle. Les LLMs sont enfin assez bons 
pour tenir un personnage en français. Le pipeline STT→LLM→TTS est techniquement 
possible avec Deepgram + OpenRouter + ElevenLabs. C'est le moment de valider 
la mécanique complète avec un prototype fonctionnel avant d'investir dans 
la production vidéo et le contenu éditorial complet.
```

### Initial Vision

```
Application web voice-to-voice avec Max, un développeur de 28 ans dont la sœur 
Ava a disparu dans le contexte d'une pandémie mondiale. L'utilisateur parle 
avec Max en visioconférence. Un Game Master IA orchestre l'expérience : 
confiance, triggers vidéo, game over. Prototype 1 = valider le pipeline technique.
```

### Target Human

```
Joueur/spectateur curieux, 20-40 ans, francophone
Context: Seul devant son ordinateur, casque, navigateur Chrome
Struggle: Veut une expérience narrative immersive et interactive, pas un film passif ni un jeu à choix multiples
Success: Se sentir "dans l'histoire", avoir eu une vraie conversation avec un personnage fictif
How this helps: Voice-to-voice crée une connexion émotionnelle impossible avec du texte
```

### Tools Arsenal

| Tool | Role |
|------|------|
| Lovable | Frontend React + déploiement + vibe coding |
| Lovable Cloud (Supabase) | Backend, BDD, Edge Functions, pgvector |
| OpenRouter (Multi-modèles) | LLM pour Max et Game Master (Qwen, Claude, Grok, Llama, Gemini) |
| Deepgram | STT streaming avec VAD |
| ElevenLabs | TTS voix custom de Max (paramètres ajustables) |
| OpenAI | Embeddings text-embedding-3-small (1536 dim) |
| Notion | Source de vérité éditoriale (contenus, personnages, règles) |

---

## Feature Chronicle

### 2026-05-22 — PRD4 : nouveau parcours post-film + rôle utilisateur + Max contextualisé (6 phases) 🔷

**Intent**: Le PRD4 redéfinit complètement l'expérience joueur. L'onboarding A/B (variantes co-création vs narrateur omniscient) ne servait plus le scénario produit. Le nouveau parcours pose une seule mise en situation : *« Tu viens de voir le film *Où est Ava ?*. Tu veux appeler quelqu'un de la famille. Choisis ton rôle, choisis ton interlocuteur. »* Cela suppose un rôle joueur libre (capturé à la voix puis résumé par un LLM), un Max conscient de qui l'appelle, 4 personnages affichés dont 3 grisés (Emma, Ava, Léo) pour signaler le périmètre du prototype, un push-to-talk avec sous-titres, et un questionnaire entièrement nouveau aligné sur les apprentissages voulus côté éditorial.

**Tool**: Lovable (6 phases enchaînées dans la même session)

**Outcome**:
1. **Phase 1 — State machine + écrans statiques** : nouveau type `ExperiencePhase` (11 états) coexistant avec `GamePhase` historique le temps de la bascule, hook `useExperienceState`, 9 écrans PRD4 (`Welcome`, `FilmQuestion`, `Teaser`, `RoleCapture`, `RoleSummary`, `CharacterSelect`, `CallingMax`, `Conversation`, `EndSession`, `QuestionnaireScreenPRD4`), 4 SVG placeholders personnages. Le flow complet est cliquable sans STT/LLM/TTS.
2. **Phase 2 — Création de rôle PTT + résumé LLM** : push-to-talk sur `role_capture` (réutilise `usePushToTalk` + Deepgram), edge function `summarize-role` (Gemini 2.5 Flash via OpenRouter) qui retourne un `UserRoleProfile` JSON structuré (`raw_input`, `summary_for_user`, `summary_for_max`, `relationship_to_family`, `age`, `gender`, `proximity_level`, `intent`), service `roleProfileService.ts`, fallback robuste (rôle par défaut si LLM échoue), persistance dans `sessions.player_role` (colonne existante).
3. **Phase 3 — Max contextualisé + GM post-turn async** : injection du résumé rôle + champs structurés en tête du system prompt de Max (`maxAgent.ts`), nouvel agent `gameMasterPRD4.ts` qui produit une évaluation post-tour structurée (`engagement_delta`, `confusion_detected`, `role_usage_quality`, `topics_covered`, `transition_recommended`, `cinematic_hint`, `next_turn_guidance`, `end_recommended`, `moderation_flag`), orchestrateur `prd4Orchestrator.ts` qui appelle Max **sans GM pré-tour** et déclenche le post-turn en `void` (non bloquant), migration `sessions.gm_post_turn_log jsonb not null default '[]'`, timer 3-5 min ou `end_recommended` → `end_session`.
4. **Phase 4 — Personnages grisés + appel Max** : grille 2×2 avec Max coloré et Emma/Ava/Léo grisés + cadenas + dialog *« Bientôt disponible »*. Écran `CallingMaxScreen` qui joue 2-3 sonneries (~3 s) puis bascule automatiquement vers `conversation_max`.
5. **Phase 5 — Nouveau questionnaire PRD4** : `QuestionnaireScreenPRD4.tsx` (10 questions PRD §14.2 — film vu, teaser utile, clarté création rôle, justesse résumé, clarté PTT, Max reconnaît rôle, Max crédible, envie autres personnages, prochain personnage souhaité, durée ressentie, feedback ouvert + email + 2 opt-ins). Types `QuestionnairePRD4Answers/Technical/Data`. Données techniques calculées automatiquement (`duration_seconds`, `turn_count`, `avg_latency_ms`, `max_latency_ms`, `ptt_errors`, `role_profile`, `teaser_seen/skipped`, `transcript_available`). Stockage `questionnaire_responses` au format `{ version: "prd4", answers, technical }`.
6. **Phase 6 — Back-office + nettoyage** : `SessionsTab` enrichi avec une section *« Rôle utilisateur »* (résumés joueur/Max + JSON repliable) et une timeline `gm_post_turn_log` compacte (badges engagement, role usage quality, confusion, end, modération, latence ms, sujets couverts, next_turn_guidance). Suppression définitive des écrans A/B (`OnboardingAScreen/BScreen`, `ABChoiceScreen`, `OnboardingScreen`, `GateScreen`) et de `pages/Index.tsx`. La route `/` pointe désormais directement sur `IndexPRD4` ; `/legacy` retirée.
7. **Sync Notion PRD4 fiabilisée** : `sync-questionnaire` détecte `version: "prd4"` et écrit dans les propriétés Notion **exactes (avec accents)** de la base *Questionnaire AVA* — `PRD4 Rôle création clarté`, `PRD4 Résumé personnage justesse`, `PRD4 Max reconnaît rôle`, `PRD4 Personnage souhaité prochain`, `PRD4 Durée ressentie`, `PRD4 Rôle JSON`, `PRD4 Être tenu au courant`, `PRD4 Contact feedback détaillé`, etc. Ajout d'un `fetchDatabaseProperties()` qui lit le schéma Notion et filtre côté serveur les propriétés absentes (log `skipped_props`) pour éviter toute erreur 400 si la base évolue.
8. **Events PostHog PRD4** : `role_created`, `character_locked_clicked`, `ptt_error`, `session_ended`.

**Ce que ça change** : le prototype passe d'une expérience A/B « démo techno » à un parcours produit cohérent avec le scénario *« j'ai vu le film, j'appelle quelqu'un »*. Max devient sensible à qui parle (un proche, un journaliste, un policier, un inconnu menaçant…), ce qui rend les sessions immédiatement plus narratives. Le retrait du GM pré-tour du hot path consolide le travail de latence de la session 20. Les 3 personnages grisés cadrent les attentes du joueur sans casser l'illusion. Côté éditorial, les feedbacks remontent enfin sur les bonnes dimensions (clarté du rôle, crédibilité de Max sous l'angle du rôle, envie de continuer avec un autre personnage), et le mapping Notion respecte la nomenclature accentuée de la base.

**Validation**:
- `npx tsc --noEmit` : OK.
- `npm run build` : OK.
- Browser local : flow complet jouable `/` → film question → teaser → role capture (PTT + résumé) → role summary → character select (Max actif, autres grisés cliquables avec dialog) → calling Max → conversation → end → questionnaire → thanks.
- `/admin` → onglet Sessions : sélection d'une session PRD4 affiche bien le rôle joueur et la timeline GM post-turn.

**Time**: ~4h (plan d'implémentation détaillé puis 6 phases enchaînées + correctifs mapping Notion).

---



### 2026-05-22 — Robustesse voix multi-navigateurs + optimisation latence live + observabilité 🔷

**Intent**: Les sessions vocales récentes montraient des pannes difficiles à diagnostiquer : Safari et Firefox ne démarraient pas toujours le STT, Brave/Chrome perdaient parfois le TTS, et certains tours restaient bloqués sans reprise claire. L'audit a montré que le pipeline était fonctionnel mais trop optimiste pour le web réel : `MediaRecorder` forçait `audio/webm;codecs=opus`, la lecture audio dépendait d'un `audio.play()` tardif soumis aux politiques autoplay, plusieurs opérations réseau n'avaient pas de timeout dur, et la queue TTS ne distinguait pas explicitement succès, erreur, annulation ou skip.

**Tool**: Codex

**Outcome**:
1. **Audit documenté** — `docs/audit_voice_conversation_max.md` formalise le diagnostic : compatibilité STT navigateur, streaming TTS non exploité côté blob, risques autoplay, blocages via `Promise.all`, timeouts manquants, objectifs p50/p95 et plan de correction par phases.
2. **STT Deepgram durci** — `deepgramSTT.ts` ne force plus WebM/Opus. Il choisit le premier MIME supporté (`audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`) ou laisse le navigateur décider si aucun candidat ne passe. Ajout de timeouts token (5 s), micro (10 s), WebSocket open (8 s), callback `onError` avec contexte navigateur/MIME, et réduction de la fenêtre de silence de 1500 ms à 900 ms.
3. **Audio unlock + lecture robuste** — nouveau `audioPlayback.ts` : `AudioContext` réveillé sur geste utilisateur, lecture blob encapsulée avec timeout, classification des erreurs (`not_allowed`, `not_supported`, `aborted`, `network`, `unknown`). `playAudioBlob()` passe par ce service et enrichit les erreurs avec `playbackErrorType`.
4. **Queue TTS observable** — `TTSQueue.drain()` retourne maintenant un statut (`played`, `failed`, `cancelled`, `skipped`) + compteurs de segments. Les erreurs ne sont plus seulement loggées : le pipeline peut les tracker via `tts_queue_result` et reprendre proprement.
5. **Anti-blocage pipeline** — `Index.tsx` déclenche l'audio unlock au moment de répondre, d'activer le micro ou de presser le PTT. Le GM post-turn est protégé par timeout 6 s et fallback neutre. Les erreurs STT affichent un sous-titre utilisateur et remontent via `stt_error`.
6. **Timeouts réseau critiques** — `openRouterLLM.ts` ajoute `AbortController` 18 s sur les appels LLM. Les providers TTS ElevenLabs, Hume et Inworld ont maintenant un timeout fetch 12 s et un timeout `response.blob()` 12 s.
7. **Mode conversation rapide** — preset `realtime_conversation` : ElevenLabs Turbo v2.5, MP3 64 kbps, `optimizeStreamingLatency=1`, vitesse 1.02. Objectif : permettre des tests voice-to-voice plus nerveux sans sacrifier le preset qualité existant.
8. **Observabilité PostHog + admin** — ajout d'une corrélation `turn_id`, d'un événement agrégé `voice_turn_completed` et d'une erreur unifiée `voice_error`. Les mêmes données sont stockées en interne dans `voice_turn_events` / `voice_error_events`, et l'onglet admin des latences affiche les p50/p95 end-to-end ainsi que les erreurs voix récentes.
8. **Hot path Max allégé** — après une capture montrant `LLM total (Max streaming): 15911ms`, le live abandonne `qwen/qwen-2.5-72b-instruct` comme modèle par défaut au profit de `google/gemini-2.0-flash-001`, plafonne les réponses à 220 tokens, force une réponse orale 1-2 phrases, réduit le RAG (`top_k=3`, `retrieve_k=8`) et compacte les extraits injectés.
9. **GM pré-tour LLM retiré du chemin temps réel** — le pre-turn timeoutait à 4 s et son brief n'était pas injecté dans Max. Le live utilise désormais un brief local instantané pour la trace ; le planner LLM reste disponible dans le banc d'essai.
10. **Tests de robustesse** — nouveaux tests unitaires pour les timeouts, la sélection MIME, la classification audio et les statuts de queue TTS.

**Ce que ça change** : le pipeline voix passe d'un prototype orienté "happy path Chrome" à un runtime beaucoup plus défensif et plus nerveux. Les erreurs navigateur deviennent observables, les opérations critiques ont des limites temporelles, l'audio est préparé sur geste utilisateur, et le tour live ne dépend plus d'un GM pré-tour LLM ni d'un modèle 72B trop lent. Cette version ne prétend pas résoudre tout Safari (le fallback PCM WebAudio complet reste à faire), mais elle élimine les causes les plus probables de casse immédiate et attaque le principal goulet visible : la génération Max à ~16 s.

**Validation**:
- `npm test` : 20 tests passants.
- `npx tsc --noEmit` : OK.
- `npm run build` : OK.
- ESLint ciblé sur les fichiers modifiés : OK.
- Browser local : accueil → `Commencer` → vidéo/skip → choix A/B, sans overlay ni erreur applicative.

**Time**: ~3h (audit → plan docs → TDD utilitaires → intégration STT/TTS/pipeline → tests/build → QA navigateur locale).

---

### 2026-05-16 — TTS multi-providers (ElevenLabs / Inworld / Hume) + voix Alain + monitoring « Consommation Voix » 🔷

**Intent**: Le TTS reposait sur un seul provider (ElevenLabs) câblé en dur dans `elevenLabsTTS.ts`, ce qui empêchait de tester d'autres voix (notamment **« Alain »** sur Inworld en attendant le clone vocal de Max) et de comparer empiriquement coût / latence / qualité. En parallèle, aucun monitoring dédié ne permettait de voir les taux d'erreur HTTP ou les percentiles de latence par provider — les incidents (ex. 401 Inworld dû à un double encodage base64) étaient invisibles tant qu'on ne lisait pas les logs Edge Functions.

**Tool**: Lovable

**Outcome**:
1. **Façade TTS unifiée** (`src/services/tts/`) — interface `TTSProvider` + `registry` qui mappe les IDs (`elevenlabs` / `inworld` / `hume`) vers leurs implémentations. Le code applicatif appelle `generateSpeech()` / `speakText()` sans connaître le provider. Logique partagée extraite : nettoyage markdown (`textPrep`), segmentation prosodique (`textChunking`), file séquentielle (`queue`), télémétrie de latence uniforme.
2. **3 providers branchés** : ElevenLabs (existant), **Inworld `inworld-tts-2`** (voix Alain, streaming HTTP NDJSON décodé en MP3 piped client-side, paramètres `deliveryMode` STABLE/BALANCED/CREATIVE + `language` + `speakingRate`), **Hume AI Octave**. Edge functions proxy dédiées (`proxy-tts-inworld`, `proxy-tts-hume`) avec `verify_jwt = false`. Secrets `INWORLD_API_KEY` et `HUME_API_KEY` ajoutés.
3. **Sélecteur global dans l'Admin** (`TTSConfigTab`) — un seul provider actif à la fois, persisté DB + LocalStorage (`ava_tts_active_provider`, `ava_tts_settings_<provider>`). Panneau de réglages par provider + bouton **🔊 Tester** par provider pour A/B en un clic, sans redéploiement.
4. **Dashboard « Consommation Voix »** (`VoiceUsageTab`) — agrégation depuis `audio_latencies.metadata_json` (aucune migration DB requise) : compteurs requêtes, taux de succès, latences **p50 / p95** (first-byte + total) par provider, distribution des **codes HTTP** (200/401/429/5xx…), liste des **erreurs récentes** avec `error_type` + `error_message` complets, et vue comparative côte-à-côte.
5. **Compatibilité préservée** : `elevenLabsTTS.ts` converti en shim vers la nouvelle façade — zéro régression sur le pipeline temps réel. Ancien `VoiceConfigTab` supprimé, onglet « Consommation » renommé **« Consommation LLM »** pour cohabiter avec « Consommation Voix ».
6. **Bug fix Inworld 401** — diagnostiqué via le proxy : la clé était re-encodée en base64 alors qu'elle l'est déjà côté Inworld. Corrigé en envoyant le header `Authorization: Basic <key>` brut.

**Ce que ça change** : le TTS devient un **point de bascule éditorial** plutôt qu'un câblage figé — l'équipe peut comparer ElevenLabs, Inworld (Alain) et Hume sur le même contenu sans toucher au code, et le monitoring rend visibles les pannes silencieuses (429 = quota, 401 = clé invalide, p95 qui dérive). Prépare le terrain pour le clone vocal de Max (qui sera un 4ᵉ provider ou une voix custom dans ElevenLabs).

**Time**: ~3h (façade → providers → proxy Inworld streaming → debug 401 → dashboard monitoring → cleanup VoiceConfigTab).

---

### 2026-05-10 — RAG v2 : Voyage AI + reranker + query rewriting + mémoire de session compressée 🔷

**Intent**: Le RAG v1 reposait uniquement sur OpenAI `text-embedding-3-small` (1536 dim) avec scoring par cosinus brut, sans filtrage par personnage et sans reformulation de requête. Conséquences observées : (1) chunks d'autres personnages remontaient dans le contexte de Max, (2) les questions implicites (« et toi ? », « pourquoi ? ») produisaient des matches faibles car la requête manquait de contexte, (3) la mémoire au-delà de quelques tours se perdait dans le prompt système. Cible : un pipeline RAG capable de tenir une conversation de 10 minutes en restant éditorialement précis.

**Tool**: Lovable

**Outcome**:
1. **Embeddings Voyage AI `voyage-3` (1024 dim)** en double-stack avec OpenAI — nouvelle colonne `embedding_v vector(1024)` + `embedding_provider`. Re-sync complète des 4 bases Notion. RPC `match_embeddings_v` dédiée. Le provider est sélectionnable par requête.
2. **Reranker Voyage `rerank-2.5`** appliqué après le retrieval vectoriel — chaque `RAGMatch` expose désormais `retrieval_similarity` (cosinus brut) et `rerank_score` (Voyage). Toggle `RAG_RERANK_ENABLED` dans `settings.json`. Effet observé en test : un chunk pertinent passe de 0.47 (cosinus) à 0.81 (rerank) et remonte en tête.
3. **Filtrage strict par `character_id`** — colonne ajoutée sur `embeddings`, propagée via `query-rag`. Les chunks scopés sont filtrés par personnage actif, les chunks partagés (`storyworld`, `rules`) restent visibles à tous. Plus de fuites de persona.
4. **Indexes HNSW (`m=16, ef_construction=64`)** en remplacement des `ivfflat lists=100` — ces derniers, sur ~226 vecteurs, créaient des sous-listes de ~2 vecteurs et avec `probes=1` par défaut le retrieval Voyage retournait quasi rien (et le système retombait silencieusement sur OpenAI). Bug majeur identifié et corrigé en cours de chantier.
5. **Query rewriting LLM** — edge function `rewrite-query` (gemini-3-flash-preview) qui transforme « et toi ? » en requête autonome basée sur les 4 derniers tours, avant l'appel RAG. Gating via `RAG_QUERY_REWRITE_ENABLED`. Intégré dans `conversationOrchestrator` et exposé en étape « 0 » dans le banc d'essai.
6. **Mémoire de session compressée** — table `session_summaries` (1 ligne par session) + edge function `summarize-session` (gemini-3-flash-preview) qui produit un résumé bullet-points (Faits / Sujets / Promesses) tous les `RAG_SUMMARY_EVERY_N_TURNS` (4) tours en fire-and-forget. Service `sessionMemoryService.ts`. Injection automatique dans le prompt Max sous `## SOUVENIRS DE LA SESSION`, fetch en parallèle du RAG pour ne pas alourdir la latence.
7. **Banc d'essai Max enrichi** :
   - Étape « 0. Query rewrite » dans la chronologie (original → réécrite, ou « inchangée »)
   - Badge `embedding_provider` (+ `rerank` si actif) sur l'accordéon RAG
   - Par chunk : badge `character_id` (ou `shared`), `rerank_score` Voyage, similarité de retrieval brute, score final
8. **Configuration** — `supabase/config.toml` mis à jour pour les 2 nouvelles edge functions, secret `VOYAGE_API_KEY` ajouté côté backend.

**Ce que ça change** : le RAG passe d'un retrieval cosinus naïf et global à un **pipeline éditorialement scopé et auto-réflexif** — la requête est reformulée si elle est trop pauvre, les chunks sont filtrés par personnage, le scoring est affiné par un reranker dédié, et la conversation entière conserve une mémoire compressée injectée dans le prompt. Le banc d'essai expose chaque étape pour permettre le fine-tuning éditorial sans devinette. Effet attendu : diminution mesurable des hallucinations « hors-périmètre » et meilleure cohérence sur des sessions longues.

**Time**: ~4h sur plusieurs itérations (plan → migration double-stack → re-sync → debug HNSW → rewrite + summarize → UI banc d'essai).

---

### 2026-05-02 — Diagnostic factuel des latences (survol + panneau latéral + filtre sévérité) + guide Game Master 🔷

**Intent**: Le panneau "Latence & blocage" montrait *quelles* sessions et *quels* tours étaient lents, mais pas *pourquoi*. L'équipe avait besoin d'un diagnostic factuel directement attaché aux segments des barres, sans rajouter de latence au pipeline conversationnel. En parallèle, structurer un guide pour rédiger les prompts et choix de gameplay du Game Master à partir du contexte projet Notion.

**Tool**: Lovable

**Outcome**:
1. **Budgets cibles + hypothèses par étape** — `STEP_BUDGET_MS` (RAG 250 ms, GM pre 400 ms, Max LLM 800 ms, TTS 600 ms, validateur 500 ms, GM post 400 ms) et `STEP_HYPOTHESES` (pistes d'optimisation : streaming token-per-token, switch modèle, cache RAG, voice presets plus rapides, etc.) donnent un référentiel commun.
2. **Analyse asynchrone côté client** — `computeBaselines` (`useMemo`) calcule moyenne, médiane et **p95** sur l'ensemble des segments visibles. `analyzeStep` produit ensuite, pour chaque segment : une sévérité (`ok` / `high` / `critical`) selon le budget, un ratio vs médiane (ex. "1.4× la médiane"), et un drapeau "outlier ≥ p95". Tout est dérivé de `pipeline.*_ms` déjà persisté — **aucune latence ajoutée** au tour de jeu.
3. **Tooltips riches au survol** — `StackedRow` utilise désormais `Tooltip` (Radix) au lieu d'un simple `title`. Au survol, on voit la sévérité, le diagnostic comparatif et les hypothèses applicables.
4. **Panneau latéral au clic** — `SegmentDetailSheet` (Shadcn `Sheet`) ouvre un audit structuré : contexte tour/session, métriques (durée mesurée vs **budget cible**, **part du tour** en %), benchmarking dataset (médiane / p95 / moyenne), et liste d'hypothèses techniques. Les segments sont transformés en boutons accessibles (`aria-label`), la sélection est lift-up via `SegmentSelection` à `LatencyVisualization`.
5. **Filtre de sévérité minimum** — type `SeverityFilter` (`all` / `high` / `critical`) + `SEVERITY_RANK`, dropdown "Sévérité min." (Toutes / Élevée et plus / Critique uniquement). Les segments sous le seuil sont atténués (opacité 25 % + grayscale) mais restent cliquables, ce qui permet d'isoler visuellement les problèmes sans perdre le contexte.
6. **Guide Game Master** — `documents/guide_game_master_contenus_et_tests.md` : tutoriel pour rédiger l'ensemble des prompts, variables et choix de gameplay du GM à partir du contexte projet Notion, avec hypothèses de design, variantes techniques et UX à tester, et paramètres-clés à arbitrer.

**Ce que ça change** : on passe d'un tableau de bord descriptif ("le tour 4 a un TTS à 5,2 s") à un **outil de root-cause analysis** ("ce TTS est à 5,2 s soit 8.6× le budget de 600 ms et au-delà du p95 du dataset — pistes : preset voix plus rapide, streaming sentence-level"). Et l'équipe éditoriale dispose enfin d'un guide structuré pour remplir les paramètres du Game Master au lieu d'improviser.

**Time**: ~2h sur plusieurs itérations (hover analysis → side panel → severity filter → guide GM).

---

### 2026-05-08 — Banc d'essai complet « Test de réponse Max » : inspection du pipeline conversationnel étape par étape 🔷

**Intent**: L'onglet `MaxPromptTestTab` existant permettait de simuler une réponse de Max à partir d'un contexte RAG statique, mais ne montrait pas *ce qui se passait réellement* dans les coulisses. L'équipe éditoriale avait besoin d'un outil qui, à partir d'une simple phrase utilisateur, rejoue un tour complet en exposant chaque brique du pipeline : quels chunks RAG remontent, comment ils sont transformés en contexte injecté, quel brief le GM pré-tour génère, quel prompt système final est envoyé à Max, et comment le validateur juge la conformité — le tout avec des métriques de tokens et de latence pour chaque étape.

**Tool**: Lovable

**Outcome**:
1. **Instrumentation détaillée des appels LLM** — variantes additives sans régression sur le pipeline temps réel :
   - `openRouterLLM.ts` : `callLLMWithUsage()` retourne désormais `{ content, usage, generationId, model, latencyMs }`.
   - `ragService.ts` : `queryRAGDetailed()` expose les `RAGMatch` bruts et la latence réelle de l'edge function.
   - `maxAgent.ts` : `simulateMaxResponse()` retourne `{ response, systemPrompt, usage, latencyMs, model }` ; `validateMaxResponseDetailed()` retourne `{ result, usage, latencyMs, model, validatorPrompt }`.
   - `gameMasterAgent.ts` : `planGameMasterTurnDetailed()` retourne `{ brief, usage, latencyMs, model, systemPrompt, userPrompt }` (sans timeout dur, pour mesurer la latence réelle en test).
2. **Nouveau service `maxTestPipeline.ts`** — orchestrateur UI-only qui exécute séquentiellement les 5 étapes (RAG → Knowledge build → GM Pre-turn → Max response → Validator) avec `onUpdate` incrémental pour rendu temps réel. Gestion des skips (`skipRAG`, `skipGM`, `skipValidator`) et parseur d'historique libre (`parseHistory`) pour simuler des conversations complexes.
3. **Refonte UI complète de `MaxPromptTestTab.tsx`** :
   - **Inputs enrichis** : sélecteur de personnage dynamique (depuis la table `characters`), phrase utilisateur libre, historique simulé parsé (`USER: ... / MAX: ...`), paramètres avancés repliés (`RAG_TOP_K`, `RAG_THRESHOLD`, `currentTrustLevel`, `triggeredIds`, `timeElapsedSeconds`).
   - **Chronologie verticale** — 5 étapes visuelles avec statuts animés (`pending` → `running` → `ok/error/skipped`), durée ms, modèle, tokens in/out/total. Totaux cumulés (latence + tokens) en pied de page.
   - **Détails RAG dépliables** — tableau des matches avec `source_table`, `source_id`, extrait, badge de similarité coloré, et message d'erreur explicite (ex. quota OpenAI embeddings épuisé).
   - **Contexte injecté décomposé** — 4 blocs : `allowed_facts`, `active_memories`, `hypotheses`, `forbidden_topics` / `blocked_assertions`, permettant d'auditer exactement ce qui nourrit le prompt.
   - **Brief GM pré-tour** — JSON formaté du `GameMasterTurnBrief` avec badge fallback éventuel (timeout / no_json / llm_error).
   - **Prompt système final** — texte intégral du `systemPrompt` envoyé à Max, avec compteur de caractères et estimation tokens (`estimateTokens`).
   - **Réponse Max + diagnostic validateur** — texte généré, badge conformité (vert/rouge/orange), liste `violations` et `safe_points`, tokens par agent, bouton « Régénérer avec prudence ».
   - **Export JSON** — téléchargement du trace complet (inputs, résultats, prompts bruts, usages) pour analyse externe.
   - **Presets rapides** — 3-4 scénarios pré-écrits pour tester des configurations typiques en un clic.
4. **Document de plan** : `docs/plan_max_test_inspector.md` — spécification complète du flux, des modifications backend et de la refonte UI, rédigé avant l'implémentation pour aligner l'équipe.

**Ce que ça change** : on passe d'un simulateur de réponse isolée à un **banc d'essai d'intégration** où chaque paramètre éditorial (personnage, RAG, contexte, brief GM, prompt, validateur) est testable et inspectable individuellement. L'équipe peut désormais fine-tuner le RAG (threshold, top_k), le contexte injecté, le brief GM et le prompt système avec un retour immédiat sur les tokens et la latence. C'est le passage du "devine et espère" au "change une variable, mesure l'impact".

**Time**: ~2h30 (plan → instrumentation backend → orchestrateur → refonte UI → presets + export).

---

### 2026-04-25 — Visualisation comparative des latences réelles, par session et par tour 🔷

**Intent**: Le panneau "Latence & blocage" donnait des moyennes globales mais ne permettait pas de comprendre **ce qui s'est vraiment passé** dans une session donnée. L'équipe avait besoin de voir, sur une même échelle, comment chaque session se compare, où elle dépasse la cible 2 s, et tour par tour quelle étape coûte combien — sans estimations ni scénarios fictifs.

**Tool**: Lovable + Lovable Cloud

**Outcome**:
1. **Une barre par session, données 100 % réelles** — `LatencyVisualization` a été refondue pour afficher exclusivement la moyenne réelle des tours de chaque session sélectionnée. Les anciennes variantes "best case / moyen / pire" ont été supprimées : elles induisaient en erreur en mélangeant données mesurées et extrapolations.
2. **Sélection multi-sessions + filtres** — checkboxes dans la liste, boutons "Tout / Aucune", et trois filtres complémentaires (période 24h/7j/30j/personnalisée, nombre minimum de tours Max, présence ou absence de blocage). Le compteur `Sessions (n / total)` et la sync automatique (les sélections invalidées par un filtre sont retirées) gardent la comparaison cohérente.
3. **Marqueur de cible 2 s commun** — toutes les barres (session + tours) partagent le même `scaleMax`, recalculé pour intégrer la plus longue moyenne, le plus haut max de dispersion et la cible. Le trait rouge des 2 s est donc positionné de manière cohérente partout, ce qui rend les dépassements immédiatement lisibles.
4. **Indicateur de dispersion** — bracket min–max sur la barre + badge `[min – max] · σ` dans l'en-tête de chaque session, calculé à partir du `total_ms` réel de chaque tour (écart-type d'échantillon, n-1). Une session avec une moyenne basse mais un max très haut (ex : un tour bloqué par TTS) saute aux yeux.
5. **Détail par tour dépliable** — chaque session a un chevron ▸ qui révèle, en dessous de la barre de moyenne, **une barre par tour individuel** (`Tour #N`), avec mention du blocker si le tour en a un. Les tours sont peints sur la même échelle que la session, donc la cible 2 s reste alignée.
6. **Auto-dépliage au focus** — cliquer sur une session dans la liste de gauche la coche automatiquement (si nécessaire), la place en focus et déplie ses barres de tours dans la comparaison. Plus besoin d'un double-clic mental "je sélectionne puis je déplie" : un seul geste révèle tout.
7. **Bonus diagnostic GM** — un mini-graphique `elapsed_ms` vs `timeout_ms` a été ajouté dans `SessionsTab` pour visualiser de combien les derniers fallbacks Game Master ont dépassé leur seuil.

**Ce que ça change** : on passe d'un dashboard statistique (moyennes agrégées) à un **outil d'enquête** où chaque session est inspectable. L'équipe peut isoler 3 sessions "lentes" depuis hier, les afficher côte à côte, ouvrir celle qui paraît la pire et voir directement quel tour exactement dépasse la cible et sur quelle étape. C'est le passage du "il y a un problème de latence" au "le tour 4 de la session abc12345 a un TTS à 5,2 s".

**Time**: ~2h30 sur plusieurs itérations rapprochées (refonte → comparaison → filtres → données réelles uniquement → dispersion → barres par tour → auto-dépliage).

---

### 2026-04-24 — Performance pipeline + panneau latence + admin protégé 🔷


**Intent**: Suite à un test live où Max ne répondait qu'une seule fois puis restait silencieux, identifier la cause de la latence/du blocage, refondre le pipeline pour qu'il soit non-bloquant, donner à l'équipe un outil de diagnostic permanent, et empêcher que n'importe qui avec l'URL `/admin` puisse casser des choses.

**Tool**: Lovable + Lovable Cloud

**Outcome**:
1. **Diagnostic** — chaque tour enchaînait 3 appels LLM séquentiels (GM pre-turn → Max → Validateur) avant que le TTS ne puisse démarrer, soit 5 à 15s de latence. En plus, un JSON malformé du validateur ou un faux négatif déclenchait des régénérations inutiles voire un blocage silencieux.
2. **Parallélisation** — `conversationOrchestrator.ts` exécute désormais `planGameMasterTurn` (GM pre-turn) et `simulateMaxResponse` (Max) en parallèle via `Promise.all`. Max consomme directement le contexte RAG initial ; le brief GM sert à la validation post-génération. Économie typique : 2-5s par tour.
3. **Validateur fail-open** — `VALIDATION_TIMEOUT_MS = 4000` : au-delà, la réponse est libérée avec une trace `fail-open sur timeout`. Côté `maxAgent.ts`, si le LLM validateur renvoie un JSON malformé ou erreur, l'agent retourne `compliant: true` au lieu de bloquer. Les bypass restent visibles dans `HallucinationMetricsTab` pour audit éditorial.
4. **Panneau admin "Latence & blocage"** (`LatencyBlockingTab`) — instrumentation complète : nouveau type `ConversationPipelineTimings` (rag_ms, gm_pre_ms, max_ms, validator_ms, tts_ms, gm_post_ms, total_ms) attaché à chaque message Max et persisté dans `conversation_log`. Le panneau affiche : (a) moyenne et max par étape sur 50 sessions, (b) timeline tour par tour, (c) **dernier point de blocage** identifié via `pickBlocker` selon des seuils (RAG > 1.5s, Max > 3s, validateur > 2s, TTS > 4s).
5. **Accès `/admin` protégé** — `AdminAuthGate` ajoute un écran de login devant le dashboard. Identifiants : `game-master` / `jesuisdieu`, persistance via `sessionStorage`. Bouton "Déconnexion" en haut à droite. Sécurité légère assumée : objectif anti-curieux, pas anti-attaquant.

**Ce que ça change** : le pipeline conversationnel passe de séquentiel-bloquant à parallèle-résilient. L'équipe a maintenant un outil de diagnostic permanent pour identifier où le temps part et où ça se bloque, plutôt que de deviner à chaque incident. Le `/admin` n'est plus une porte ouverte sur l'URL publique.

**Time**: ~3h

---

### 2026-04-24 — Validateur anti-hallucination + métriques + finitions plan Max/GM 🔷

**Intent**: Boucler les phases 4 et 5 du plan Max/GM : empêcher Max d'affirmer des faits non autorisés, donner à l'équipe éditoriale une vue lisible de ce qui est réellement transmis au validateur, et mesurer le comportement réel du système sur les sessions passées.

**Tool**: Lovable + Lovable Cloud

**Outcome**:
1. **Validateur anti-hallucination pré-TTS** — `conversationOrchestrator` exécute désormais une étape de validation entre la génération de Max et le TTS, qui compare la réponse aux faits autorisés globaux + au contexte autorisé du tour. Logique en deux temps : **retry** d'abord, **fallback** ensuite si le retry échoue toujours.
2. **Aperçu admin de la fusion** — nouvel onglet `AntiHallucinationValidatorTab` qui montre comment le validateur combine faits globaux et contexte du tour avant l'appel. Composants `PreviewColumn` et `MiniList` rendent la fusion lisible côté éditorial. Test `AntiHallucinationValidatorTab.test.tsx` qui échoue si l'un des deux composants disparaît.
3. **Persistance de la trace de validation par message** — `ConversationMessage` reçoit un champ optionnel `validation: ConversationValidationTrace`. La page `Index` attache la trace renvoyée par l'orchestrateur au message Max avant push dans l'historique et mise à jour de `conversation_log`. Pas de migration : le champ étant `jsonb`, le stockage est transparent.
4. **Métriques admin** — nouvel onglet `HallucinationMetricsTab` qui calcule les taux de régénération et de fallback sur les 50 dernières sessions à partir des traces persistées. Première mesure réelle du comportement du validateur en prod.
5. **Catalogue formel des modes de parole** — `src/services/speechModes.ts` définit 6 styles éditoriaux (`ferme_mefiant`, `fragile`, `revelateur_partiel`, etc.) exposés dans `GameMasterConfigTab`. Aligne `response_mode` du brief GM sur un vocabulaire stable.
6. **Schéma visuel du pipeline** — `PipelineSchema` intégré à l'onglet Pipeline : séquence en 8 étapes (User → STT → RAG → GM pre-turn → Max → Validateur → TTS → GM post-turn) avec glossaire interactif.
7. **Tests automatisés** — `conversationOrchestrator.test.ts` (retry puis fallback), `speechModes.test.ts`, `PipelineSchema.test.tsx`. 9/9 verts.

**Ce que ça change** : le pipeline Max/GM passe d'un système "fais confiance au LLM" à un système "vérifie puis publie", avec mesure réelle du taux d'invention. Le contrôle éditorial est maintenant outillé de bout en bout (config → simulation → validation → métriques).

**Reporté** : la politique de vérité à 4 niveaux (certain / probable / inconnu / interdit) — elle demande un refactor structurel de `MaxTurnKnowledgeContext` et du prompt du validateur, traité dans une session dédiée.

**Time**: ~3h

---

### 2026-04-24 — Contrôle éditorial de Max + simulation admin + trace pipeline 🔷

**Intent**: Suivre le plan d'implémentation Max/GM pour mieux contrôler ce que Max sait, ce qu'il peut affirmer, et rendre ce contrôle testable par l'équipe éditoriale depuis `/admin`.

**Tool**: Lovable

**Outcome**:
1. **Système de prompt structuré pour Max** — `maxAgent.ts`, `settingsService.ts` et `types/index.ts` ont été étendus pour séparer les briques de contrôle : persona, objectifs, historique/contextes injectés, et consignes négatives sur ce que Max ne doit pas affirmer sans source.
2. **Onglet admin `MaxPromptControlTab`** — panneau dédié pour éditer et persister ces nouvelles couches de prompt, afin de piloter finement le comportement narratif sans modifier le code.
3. **Onglet admin `MaxPromptTestTab`** — écran de test permettant de simuler une réponse de Max à partir d'un exemple de contexte RAG et d'afficher explicitement si les contraintes d'interdiction d'affirmation semblent respectées.
4. **Trace pipeline `PipelineTraceTab`** — visualisation du dernier tour avec entrée utilisateur, contexte RAG, brief pré-tour du Game Master et artefacts de pilotage, première matérialisation concrète de la "Phase 1 — rendre visible la mécanique" du plan.
5. **Pré-turn planner Game Master** — `gameMasterAgent.ts` et `conversationOrchestrator.ts` ont été refactorés pour introduire un objet `GameMasterTurnBrief` avant la génération de Max (`response_mode`, `openness_level`, `reveal_budget`, `style_instructions`), conformément à la phase 2 du plan.

**Ce que ça change** : le Game Master n'est plus seulement un arbitre post-réponse ; il commence à devenir un directeur éditorial de tour. Le contrôle est encore incomplet, mais l'architecture a basculé vers un modèle GM pre-turn → Max contraint → GM post-turn.

**Time**: ~2h

---

### 2026-04-24 — Fix robustesse OpenRouter generation lookup 🔹

**Intent**: Corriger le crash runtime provoqué par les réponses `404 Generation not found` de l'API OpenRouter lors de la récupération différée des coûts, qui faisait tomber l'app sur un blank screen.

**Tool**: Lovable Cloud

**Outcome**:
- `proxy-llm/index.ts` : l'action `get_generation_cost` renvoie désormais une réponse structurée non bloquante quand la génération n'est pas encore indexée (`available: false`, `retryable`, `error_type`) au lieu de propager une erreur fatale.
- `llmUsageTracker.ts` : le client interprète ces cas comme un coût temporairement indisponible et poursuit le flux sans casser le runtime.
- Validation faite en simulant un `generation_id` introuvable : plus de 404 fatal remonté au frontend, donc plus d'écran blanc lié à ce scénario.

**Pourquoi c'était subtil** : OpenRouter peut accepter une génération puis ne pas la rendre consultable immédiatement côté lookup. Traiter ce délai d'indexation comme une erreur fatale cassait une fonctionnalité non critique (la collecte de coût) et contaminait toute l'expérience.

**Time**: ~30min

---

### 2026-05-14 — Banc d'essai « Lancer le banc » + traçabilité du system prompt Max 🔷

**Intent**: Pouvoir valider en un clic les trois leviers RAG v2 (query rewrite + rerank + mémoire de session) sur un scénario calibré, et vérifier visuellement que le system prompt Max édité dans l'admin provient bien de la ligne DB attendue (et non d'un cache obsolète ou d'un fallback).

**Tool**: Lovable

**Outcome**:

1. **Bouton 🧪 « Lancer le banc »** dans `MaxPromptTestTab` — pré-remplit historique multi-tours ambigu sur la disparition d'Ava + résumé de session compressé (`FULL_BENCH_SCENARIO`), puis déclenche `handleRun` avec query rewrite ON, rerank ON, et `sessionSummary` injecté. Nouveau champ textarea `sessionSummary` exposé dans les inputs pour scénarios manuels.
2. **Affichage de la requête réécrite** dans la chronologie du banc (étape « 0. Query rewrite » : original → réécrite + flag `rewritten`).
3. **Colonne `rerank_score` Voyage et badge `embedding_provider`** ajoutés par chunk dans l'accordéon RAG (en plus du score final et de `retrieval_similarity`).
4. **Audit complet du flux system prompt** — vérifié que :
   - Admin écrit dans `characters.system_prompt` via `update({ system_prompt })` puis appelle `clearSystemPromptCache()`.
   - `maxAgent.ts:getCharacterSystemPrompt()` lit toujours depuis `characters` filtré par `name`, avec cache mémoire et preload pendant l'intro vidéo.
   - Le même `simulateMaxResponse` du banc d'essai utilise le même `buildMaxSystemPrompt` que `callMaxAgent` live → édition admin propagée partout.
   - `sync-notion` préserve `existingCharacter.system_prompt` à chaque upsert (règle « Never overwrite local system prompts via Notion sync » respectée).
5. **Badge de traçabilité dans l'Admin** (`/admin?tab=characters`) — nouveau badge dashed dans le header du panneau d'édition affichant `🆔 character.id`, `🕒 updated_at` UTC, `# hash FNV-1a 32-bit` du prompt chargé en DB, et `✎ #hash` de l'édition courante (passe en ambre si différent du DB). Permet de capter visuellement un cache obsolète ou une divergence DB↔UI.
6. **Vérification post-save** — après `update`, re-lecture stricte de `system_prompt` + `updated_at` depuis la DB et comparaison à la valeur envoyée. Le nouveau `updated_at` est propagé à `editingChar` et à la liste.

**Difficultés rencontrées**:
- Le cache `cachedSystemPrompts` est par onglet/process : `clearSystemPromptCache()` n'invalide que l'onglet qui sauvegarde. Documenté comme limite connue (cross-tab invalidation via Realtime ou `BroadcastChannel` à envisager si plusieurs éditeurs simultanés).
- `simulateMaxResponse` n'acceptait pas `sessionSummary` au départ — il fallait le propager dans `MaxAgentInput` côté simulation pour que le banc reflète exactement le runtime live.

**Time**: ~1h30 (banc + badge + audit + docs)

---

### 2026-04-17 — Phase 1 PRD : A/B onboarding + PTT + questionnaire enrichi 🔷

**Intent**: Implémenter la Phase 1 du PRD : valider en parallèle deux variantes d'onboarding (co-création vs narrateur omniscient) et deux modalités vocales (micro ouvert vs push-to-talk), avec sélection de personnage, et collecter des retours quali/quanti riches via un questionnaire en 8 blocs.

**Tool**: Lovable

**Outcome (5 commits)**:

1. **Refactor data model** — Extension de `GamePhase` (ajout `ab_choice`, `onboarding_a/b`, `character_select`, `ringing`), ajout dans `useGameState` des champs `variant: "A"|"B"`, `voiceModality: "micro_ouvert"|"push_to_talk"`, `character`. Persistance dans `sessions` (colonnes `variante_onboarding`, `modalite_voix`, `personnage_appele`).
2. **`ABChoiceScreen` + nouveau routing** — Écran d'entrée présentant les 2 variantes ; à la sélection, assignation aléatoire 50/50 de la modalité voix, création de session, tracking PostHog (`ab_choice_made`, `voice_modality_assigned`), routing vers `OnboardingAScreen` ou `OnboardingBScreen` (textes différenciés selon le cadrage testé).
3. **`CharacterSelectScreen` + `RingingScreen` + boutons Hang Up** — Écran de sélection de personnage (Max actif, Emma/Léo/Ava en coming soon), écran d'appel entrant avec sonnerie animée et bouton Répondre/Raccrocher, bouton "Raccrocher" (PhoneOff) ajouté aussi dans `ConversationScreen` (game over `hang_up`).
4. **Questionnaire enrichi + sync Notion** — `QuestionnaireData` étendu à ~50 champs sur 8 blocs (Global, GM, Variante A/B, Voix & modalité, Latence, Immersion legacy, Valeur, Contact). `QuestionnaireScreen` réécrit en formulaire paginé avec barre de progression et logique conditionnelle (affichage des blocs A/B et PTT selon le contexte de la session). Edge Function `sync-questionnaire` mise à jour avec mapping `SELECT_MAPS`. **15 colonnes créées dans la base Notion** (GM clarte, A cocreation engage, B narrateur immersif, PTT relachement, Latence percue, etc.) via l'API Notion.
5. **Push-to-Talk** — Nouveau hook `usePushToTalk` (binding global barre Espace + pointer events avec pointer capture, ignore les inputs/textareas, release sur blur). Nouvelle méthode `DeepgramSTT.flush()` qui force la finalisation du transcript en cours sur relâchement (au lieu d'attendre le silence de 1.5s). Bouton PTT dédié dans `ConversationScreen` (taille 80px vs 64px en micro ouvert). Auto-reprise du micro **désactivée** en mode PTT après une réponse de Max ou une cinématique vidéo.

**Bonus** — Indicateur audio temps réel : nouveau hook `useAudioLevel` (Web Audio API, AnalyserNode, RMS lissé avec low-pass filter) ; deux halos concentriques animés autour du bouton micro/PTT réagissent au volume capté. `DeepgramSTT.getStream()` ajouté pour exposer le `MediaStream` au composant.

**Difficultés rencontrées**:
- Mapping Notion : 15 colonnes manquantes dans la base Questionnaire ont dû être créées via DDL (`ADD COLUMN`) avant que la sync ne fonctionne sur les nouveaux champs.
- Closure dans le pipeline conversationnel : il fallait ajouter `state.voiceModality` aux dépendances du `useCallback` de `processUserMessage` pour que la condition d'auto-reprise du micro voie bien la valeur courante.
- PTT vs silence detection : `pause()` seul ne suffisait pas (il *jette* le buffer). Une nouvelle méthode `flush()` était nécessaire pour émettre `(text, isFinal=true)` sur relâchement.

**Time**: ~3h (5 commits + audit Notion + visualizer audio)

---

### 2026-03-07 — Setup initial + Design system 🔷

**Intent**: Poser les fondations du projet avec un design cinématique dark theme.

**Tool**: Lovable

**Outcome**: 
- Projet React + Vite + Tailwind + TypeScript créé
- Design tokens HSL dans index.css (background, foreground, primary, accent, trust, timer-warning, cinema-glow)
- Animations custom (fade-in, pulse-mic, typing dots, cinema vignette/gradient)
- Structure de fichiers alignée avec le PRD

**Time**: ~30min

---

### 2026-03-07 — Tous les écrans UI 🔷

**Intent**: Créer tous les écrans du flow utilisateur (onboarding → conversation → game over → questionnaire → thanks).

**Tool**: Lovable

**Outcome**: 
- `OnboardingScreen` — contexte narratif + bouton commencer/passer
- `VideoPlaceholder` — écran noir + texte descriptif + barre de progression + skip
- `ConversationScreen` — portrait Max, micro toggle, sous-titres, timer, trust level, indicateur d'état audio
- `SubtitleOverlay` — sous-titres utilisateur (gris) et Max (blanc) avec animations
- `GameOverScreen` — raison du game over + restart + questionnaire
- `GateScreen` — gate de confiance (Max propose Léo/Emma)
- `QuestionnaireScreen` — formulaire complet (expérience, immersion, mécanique, narration, valeur perçue)
- `ThanksScreen` — remerciement + restart

**Time**: ~1h

---

### 2026-03-07 — Schema Supabase + Types 🔷

**Intent**: Créer toutes les tables de la base de données conformément au PRD.

**Tool**: Lovable Cloud

**Outcome**: 
- Tables : characters, storyworld, video_triggers, gameplay_steps, rules, sessions, embeddings
- Extension pgvector activée
- Fonction SQL `match_embeddings` pour recherche sémantique (cosine similarity)
- Types TypeScript partagés dans `types/index.ts`

**Time**: ~20min

---

### 2026-03-07 — State machine + Timer 🔷

**Intent**: Implémenter la gestion d'état complète du jeu.

**Tool**: Lovable

**Outcome**: 
- `useGameState` hook — phases (onboarding→intro_video→conversation→video_trigger→gate→game_over→questionnaire→thanks), trust level, triggered IDs, audio state, conversation log
- `useTimer` hook — countdown 4 minutes, warning à 30s, formatted display
- State machine dans `Index.tsx` avec switch/case sur les phases

**Time**: ~30min

---

### 2026-03-08 — Edge Functions proxy (STT, LLM, TTS) 🔷

**Intent**: Créer les proxy sécurisés pour ne jamais exposer les clés API côté client.

**Tool**: Lovable Cloud

**Outcome**: 
- `proxy-stt` — retourne un token Deepgram temporaire pour connexion WebSocket client
- `proxy-llm` — proxy streaming vers OpenRouter API, supporte tous les modèles
- `proxy-tts` — proxy vers ElevenLabs API, retourne audio blob
- Toutes les clés dans Supabase Secrets (OPENROUTER_API_KEY, DEEPGRAM_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)

**Time**: ~45min

---

### 2026-03-08 — Pipeline STT Deepgram 🔷

**Intent**: Implémenter le speech-to-text streaming avec détection de fin de parole.

**Tool**: Lovable

**Outcome**: 
- `deepgramSTT.ts` — classe DeepgramSTT avec WebSocket streaming
- VAD (Voice Activity Detection) intégré via Deepgram
- Double passe : interim (sous-titres temps réel) + final (input LLM)
- Langue française configurée

**Time**: ~30min

---

### 2026-03-08 — Agents Max + Game Master 🔷

**Intent**: Implémenter les deux agents LLM qui pilotent la conversation.

**Tool**: Lovable

**Outcome**: 
- `maxAgent.ts` — prompt système Max (personnalité, règles, contexte), support RAG + post-video context
- `gameMasterAgent.ts` — prompt système Game Master, retourne JSON structuré (trust_delta, trigger_video_id, game_over, gate_reached, moderation_flag)
- `conversationOrchestrator.ts` — coordonne Max (streaming) + Game Master (JSON), gère les triggers vidéo
- 3 triggers démo : famille, secret, disparition
- Modèle : qwen/qwen-2.5-72b-instruct via OpenRouter

**Time**: ~45min

---

### 2026-03-08 — TTS ElevenLabs intégré 🔷

**Intent**: Faire parler Max avec sa voix ElevenLabs après chaque réponse LLM.

**Tool**: Lovable

**Outcome**: 
- `elevenLabsTTS.ts` — generateSpeech(), playAudioBlob(), speakText()
- Intégration dans Index.tsx : après réponse Max, génère audio et le joue
- Fallback gracieux : si TTS échoue, sous-titres toujours affichés
- Audio state géré (max_speaking pendant lecture)

**Time**: ~20min

---

### 2026-03-08 — Background cinématique 🔹

**Intent**: Ajouter une image de fond immersive à l'écran de conversation.

**Tool**: Lovable

**Outcome**: 
- Image "Max devant chalet" en background plein écran
- Overlay noir semi-transparent (bg-black/40) pour lisibilité
- Parallaxe (backgroundAttachment: fixed)
- Vignette cinématique conservée

**Time**: ~5min

---

### 2026-03-08 — Documentation projet 🔹

**Intent**: Ajouter PRD, README, CHANGELOG et STORY à la codebase.

**Tool**: Lovable

**Outcome**: 
- `documents/PRD_Prototype_1.md` — PRD complet
- `README.md` — README projet Memoways
- `CHANGELOG.md` — historique versionné
- `STORY.md` — journal de développement

**Time**: ~15min

---

### 2026-03-08 — Pipeline RAG + Sync Notion 🔷

**Intent**: Connecter Notion comme source de vérité éditoriale, synchroniser les données dans Supabase et enrichir les conversations de Max avec du contexte narratif pertinent via RAG.

**Tool**: Lovable Cloud + Notion MCP

**Outcome**: 
- Edge Function `sync-notion` — synchronise 4 bases Notion vers Supabase :
  - **Characters** (DB `30362322e59580bbb7b8dd49d516b341`) : `Nom du caractère`, `Résumé`, `Genre`, `Archétype narratif`, `Type MBTI` + contenu de page (backstory complet via blocks API)
  - **Storyworld** (DB `30362322e595806e9ef2fc62b7819980`) : `Nom`, `Résumé`, `Type`, `Tags`
  - **Gameplay** (DB `73282ee05a414cee8307ae98ff48546d`) : `Nom de l'étape`, `Type`, `Ordre`, `Condition de déclenchement`, `Description`
  - **Vidéos** (DB `478685a5b31e45b5bc534bcf905b9124`) : `Titre de la vidéo`, `Type`, `Thèmes`, `URL Gumlet`, `Description`, `Priorité`, `Style de transition`, `Contexte post-vidéo`
- Edge Function `query-rag` — recherche sémantique pgvector via `match_embeddings`
- Service client `ragService.ts` avec `queryRAG()`, `getRAGContext()`, `syncNotion()`, `AVA_NOTION_DATABASES`
- Injection RAG automatique dans `conversationOrchestrator.ts`
- Migration SQL : contraintes UNIQUE `notion_id` + RLS policies

**Test end-to-end** ✅ :
- Sync : 4 characters + 38 storyworld synchronisés
- 42 embeddings générés (OpenAI text-embedding-3-small)
- Query "Qui est Max et sa relation avec Ava ?" → Max (0.55), Ava (0.52), secret familial (0.50)
- Gameplay : base Notion vide (0 étapes)
- Vidéos : 1 page sans titre → ignorée

**Time**: ~1h

### 2026-03-08 — Sauvegarde session + Sync questionnaire Notion 🔷

**Intent**: Persister les sessions de jeu et synchroniser les réponses du questionnaire vers Notion pour analyse.

**Tool**: Lovable Cloud + Notion MCP

**Outcome**:
- `sessionService.ts` : `createSession()`, `updateSession()`, `endSession()`, `saveQuestionnaire()`, `syncQuestionnaireToNotion()`
- Edge Function `sync-questionnaire` : envoie 18 champs vers la base Notion "Questionnaire prototype 1 AVA"
- Durée augmentée à 600s (10 min)
- Conversation log, trust level, triggers activés, durée persistés en temps réel

**Time**: ~30min

---

### 2026-03-08 — Dashboard admin complet 🔷

**Intent**: Permettre la visualisation des sessions, des questionnaires et l'édition des system prompts depuis /admin.

**Tool**: Lovable

**Outcome**:
- Onglet **Sessions** avec détail conversation + questionnaire formaté
- Onglet **Questionnaires** : tableau récapitulatif (NPS, immersion, écoute, prix, feedback)
- Onglet **Personnages** : édition et sauvegarde du system prompt avec cache invalidation
- Fix RLS sur `characters` pour permettre l'update depuis le prototype

**Time**: ~30min

---

### 2026-03-08 — Micro persistant continu 🔷

**Intent**: Garder le micro ouvert en permanence pendant la conversation, sans que l'utilisateur ait à cliquer après chaque tour.

**Tool**: Lovable

**Outcome**:
- `DeepgramSTT` refactorisé : ajout `pause()`, `resume()`, propriété `isActive`
- La connexion WebSocket Deepgram reste ouverte pendant toute la session
- Pendant que Max répond (TTS), le micro est en pause (ignore les transcripts) mais la connexion reste active
- Après la réponse de Max, `resume()` réactive l'écoute instantanément
- Fallback : si la connexion WebSocket est perdue, reconnexion automatique
- Le `fullTranscript` est réinitialisé après chaque segment finalisé (2s silence)

**Time**: ~15min

---

### 2026-03-08 — Config LLM dynamique + Multi-modèles 🔷

**Intent**: Permettre de changer le modèle LLM de Max et du Game Master depuis l'admin, et tester différents modèles (Qwen, Claude, Grok, Llama, Gemini).

**Tool**: Lovable

**Outcome**:
- `settingsService.ts` : ajout `OPENROUTER_MODELS` avec 8 modèles (Qwen 72B, Claude Sonnet 4, Claude Haiku 3.5, Llama 4 Scout, Gemini 2.5 Flash, Grok 3 Mini, Grok 3, Grok 2)
- Onglet **LLM Config** dans `/admin` : sélection modèle Max et Game Master indépendamment, réglage température/tokens/top_p
- Les réglages sont persistés en localStorage et appliqués au runtime

**Time**: ~20min

---

### 2026-03-08 — Config voix ElevenLabs 🔷

**Intent**: Permettre d'ajuster finement la voix de Max (diction, stabilité, vitesse) depuis l'admin pour améliorer la qualité vocale.

**Tool**: Lovable

**Outcome**:
- `VoiceConfigTab.tsx` : panneau complet avec sliders (stability 0-1, similarity_boost 0-1, style 0-1, speed 0.7-1.2) + toggle speaker_boost
- 5 presets rapides : Défaut, Claire et articulé (speed 0.92), Calme et mesuré (speed 0.85), Expressif (style 0.8), Rapide et naturel (speed 1.1)
- Bouton **Tester la voix** : génère un sample audio avec les réglages courants
- `elevenLabsTTS.ts` : récupère dynamiquement les voice_settings depuis settingsService
- `proxy-tts/index.ts` : accepte et transmet les `voice_settings` complets à l'API ElevenLabs

**Time**: ~25min

---

### 2026-03-08 — HUD conversationnel + Info modale + Questionnaire anticipé 🔷

**Intent**: Améliorer l'UX de l'écran de conversation : regrouper les indicateurs, expliquer le projet, permettre l'accès au questionnaire plus tôt.

**Tool**: Lovable

**Outcome**:
- **Cartouche HUD** en haut à gauche : timer + jauge de confiance regroupés dans un conteneur sobre avec séparateur vertical
- **Tooltip hover** sur la cartouche : explication du timer (10 min) et de la mécanique de confiance (sincérité → jauge monte → déblocage narratif)
- **Bouton info (i)** déplacé en haut à droite, plus grand et visible (h-9 w-9), ouvre une modale détaillée
- **Modale info** : concept, pipeline technique (STT→LLM→TTS + Game Master), objectifs du prototype, limitations connues, explication des indicateurs en jeu
- **Questionnaire anticipé** : bouton discret en bas à droite après 4 minutes (`EARLY_QUESTIONNAIRE_DELAY = 240`)
- Jauge de confiance avec barre de progression colorée (gris → trust → primary selon le niveau)

**Time**: ~20min

---
### 2026-03-08 — LLM Cost Tracker 🔷

**Intent**: Suivre précisément la consommation LLM (tokens + coûts USD) pour chaque appel OpenRouter, et offrir une vue admin exploitable pour piloter les coûts de l'expérience.

**Tool**: Lovable Cloud

**Outcome**:
- Table `llm_usage` avec index sur `created_at`, `model`, `feature_key`, `session_id`
- `llmUsageTracker.ts` : pipeline de collecte automatique — log initial avec tokens, puis récupération asynchrone du coût USD via l'API OpenRouter generation detail (3s delay)
- `proxy-llm/index.ts` : action `get_generation_cost` ajoutée, données d'usage incluses dans les réponses streaming
- `openRouterLLM.ts` : intégration transparente — chaque appel est automatiquement loggé avec `feature_key` (chat/game_master) et `session_id`
- Onglet **Consommation** dans `/admin` → Technique : KPI cards (coût total, 30j, aujourd'hui, requêtes, tokens), graphiques (par jour/modèle/feature), tableau filtrable des 100 dernières requêtes
- Gestion d'erreurs : appel échoué, generation_id absent, endpoint coût indisponible

**Ce que ça permet** : Comprendre ce qui coûte le plus (quel modèle, quelle feature), comparer les coûts entre modèles pour le même usage, préparer l'ajout futur d'alertes de budget et de fallback automatique vers un modèle moins cher.

**Time**: ~40min

---

### 2026-03-08 — Persistance des réglages admin en base 🔷

**Intent**: Garantir que tous les réglages faits dans /admin (modèle LLM, paramètres voix, gameplay, GM) survivent au rechargement de page et au changement de navigateur.

**Tool**: Lovable Cloud

**Outcome**:
- Table `admin_settings` (clé/valeur JSONB) pour stocker durablement les configurations
- `settingsService.ts` refactorisé : double couche localStorage (rapide) + DB (persistant), `hydrateAllSettings()` au montage admin
- Boutons **Sauvegarder** explicites dans les onglets LLM Config et Voix
- Vérification post-sauvegarde du system prompt (relecture DB + invalidation cache mémoire)

**Ce que ça permet** : Itérer sur le fine-tuning de l'expérience sans perdre ses réglages — changer de modèle, ajuster la température, modifier les presets voix, tout est conservé entre les sessions de travail. Le system prompt de Max ne peut plus se "perdre" silencieusement.

**Time**: ~25min

---

### 2026-03-08 — Rapport de sync Notion détaillé 🔷

**Intent**: Rendre visible et compréhensible ce qui se passe lors d'une synchronisation Notion → Supabase, au lieu d'afficher un JSON brut.

**Tool**: Lovable Cloud

**Outcome**:
- `sync-notion/index.ts` : tracking des stats d'embedding par table (`chunks_created`, `chars_embedded`), comptage du total d'embeddings en base après sync
- Admin UI : affichage structuré post-sync avec cards par table (entrées synchronisées, chunks RAG créés, caractères/tokens estimés pour les embeddings, total embeddings en base)

**Ce que ça permet** : Savoir exactement quel contenu narratif alimente le RAG, combien de chunks sont générés par personnage ou élément de storyworld, et combien de tokens OpenAI sont consommés pour les embeddings. Essentiel pour optimiser le contenu Notion et comprendre la qualité du RAG.

**Time**: ~15min

---

### 2026-03-08 — Protection du system prompt au sync Notion 🔹

**Intent**: Empêcher la synchronisation Notion d'écraser le system prompt personnalisé de Max, qui était perdu à chaque sync.

**Tool**: Lovable Cloud

**Outcome**:
- `sync-notion/index.ts` : vérifie si un `system_prompt` custom existe déjà en base avant upsert
- Si un prompt personnalisé existe → il est préservé, le résumé Notion n'écrase plus
- Résout le bug récurrent de perte du prompt de Max après sync

**Time**: ~10min

---

### 2026-03-08 — Fix récupération des coûts OpenRouter 🔹

**Intent**: Corriger la récupération des coûts USD qui échouait pour la plupart des appels LLM (404 ou coût à 0).

**Tool**: Lovable Cloud

**Outcome**:
- `llmUsageTracker.ts` : ajout headers auth manquants, retry robuste à 15s/30s/60s (l'API OpenRouter a un délai d'indexation)
- Bouton **"Recalculer coûts manquants"** dans l'onglet Consommation pour relancer manuellement la récupération sur les entrées `cost_fetch_failed`
- `proxy-llm/index.ts` : amélioration du parsing des données de génération + logs détaillés

**Ce que ça permet** : Avoir enfin les coûts USD réels pour chaque appel, même quand OpenRouter met du temps à indexer la génération.

**Time**: ~20min

---

### 2026-03-08 — Champs contact dans le questionnaire 🔷

**Intent**: Permettre aux testeurs de laisser leur nom et email pour être recontactés (feedback complémentaire ou suivi du projet).

**Tool**: Lovable + Notion MCP

**Outcome**:
- `QuestionnaireScreen.tsx` : section "Rester en contact" avec champ nom, email, 2 checkboxes (opt-in feedback, opt-in suivi)
- `types/index.ts` : 4 nouveaux champs dans `QuestionnaireData`
- `sync-questionnaire/index.ts` : envoi des 4 champs vers Notion (rich_text, email, checkbox x2)
- Notion : colonnes "Nom contact", "Email contact", "Opt-in feedback", "Opt-in updates" créées via MCP

**Time**: ~15min

---

### 2026-03-08 — Optimisation latence première réplique 🔷

**Intent**: Réduire drastiquement le délai entre la première question de l'utilisateur et la première réplique audio de Max.

**Tool**: Lovable + Lovable Cloud

**Outcome**:
- **Preload system prompt** : `preloadSystemPrompt()` appelé au clic "Commencer", pendant la cinématique d'intro — le prompt est déjà en cache quand le 1er message arrive
- **Warm-up Edge Functions** : requêtes OPTIONS fire-and-forget sur proxy-llm, proxy-tts, query-rag pendant l'intro (évite le cold start Deno)
- **RAG allégé** : 5 → 3 matches (moins de données à chercher/transférer, embedding toujours pertinent)
- **TTS optimisé** : `mp3_22050_32` au lieu de `mp3_44100_128` (~4x plus léger à transférer) + `optimize_streaming_latency=4` (ElevenLabs renvoie l'audio dès que possible)
- **Sentence splitting agressif** : seuil abaissé de 5 à 3 caractères pour enqueue le TTS plus tôt
- **Parallélisme** : RAG fetch et system prompt preload s'exécutent en parallèle

**Ce que ça permet** : La première réplique de Max arrive significativement plus vite. Les répliques suivantes bénéficient aussi du cache system prompt et du warm-up des connexions.

**Time**: ~20min

---

### 2026-03-08 — Persistance des réglages de jeu 🔹

**Intent**: Empêcher la perte des réglages Gameplay (sliders trust threshold, timeout, etc.) au rechargement de la page admin.

**Tool**: Lovable Cloud

**Outcome**:
- `GameMasterConfigTab.tsx` : bouton **Sauvegarder** dans la section Mécanique, indicateur visuel de modifications non sauvegardées
- Chargement des valeurs depuis `admin_settings` au montage, comparaison d'état pour activer/désactiver le bouton

**Time**: ~10min

---

### 2026-03-08 — Player vidéo Gumlet 🔷

**Intent**: Remplacer les écrans placeholder texte par de vraies vidéos hébergées sur Gumlet, en commençant par la cinématique d'introduction.

**Tool**: Lovable

**Outcome**:
- `GumletVideoPlayer.tsx` : composant iframe embed Gumlet plein écran responsive
  - Extraction automatique de l'asset ID depuis différents formats d'URL Gumlet
  - Paramètres embed : `autoplay=true`, `preload=true`
  - Écoute des événements `postMessage` pour détecter la fin de vidéo
  - Slot `children` pour injecter des overlays (HUD) par-dessus la vidéo
  - Bouton "Passer →" toujours visible en overlay
- `types/index.ts` : champ `video_url` optionnel ajouté à `VideoTrigger`
- `Index.tsx` : 
  - Intro video utilise `GumletVideoPlayer` avec la vidéo `67a281cac82041cdc3714c0c`
  - Video triggers mid-conversation : si `video_url` existe → Gumlet player avec HUD (timer + confiance) sans micro ; sinon → fallback `VideoPlaceholder`

**Ce que ça permet** : Les cinématiques sont enfin de vraies vidéos. Le mode responsive plein écran avec overlays maintient l'immersion. Le fallback vers VideoPlaceholder garantit la compatibilité avec les triggers qui n'ont pas encore de vidéo assignée.

**Time**: ~25min

---

### 2026-03-08 — Debug Panel 🔷

**Intent**: Créer un outil de diagnostic pour visualiser en temps réel tous les appels API sortants de l'application, sans impacter les performances en production.

**Tool**: Lovable

**Outcome**:
- `debugLogger.ts` : service singleton activé par `?debug` dans l'URL, avec `log()`, `logFetch()`, `logResponse()`, `logError()` — chaque méthode fait un early return si désactivé (zero overhead)
- `DebugPanel.tsx` : panneau latéral droit (w-96, fixed, z-50) avec filtres par service/niveau, entrées expansibles, copie, auto-scroll
- Intégration dans 7 services : `openRouterLLM`, `elevenLabsTTS`, `deepgramSTT`, `ragService`, `sessionService`, `gameMasterAgent`, `maxAgent`, `conversationOrchestrator`
- Monté conditionnellement dans `App.tsx` : `{debugLogger.enabled && <DebugPanel />}`

**Ce que ça permet** : Diagnostiquer en direct les problèmes de pipeline (latence, erreurs, payloads malformés) sans ouvrir la console navigateur.

**Time**: ~30min

---

### 2026-03-08 — Correction hint micro 🔹

**Intent**: Le message "Cliquez sur le micro pour parler à Max" restait affiché même après avoir utilisé le micro.

**Tool**: Lovable

**Outcome**:
- `Index.tsx` : ajout d'un state `micEverStarted` passant à true à la première activation
- `ConversationScreen.tsx` : hint conditionné à `micEverStarted === false`

**Time**: ~5min

---

### 2026-03-12 — Intégration PostHog Analytics 🔷

**Intent**: Comprendre les usages des utilisateurs à travers l'application avec du tracking d'événements et du session recording.

**Tool**: Lovable

**Outcome**:
- `posthogService.ts` : service centralisé d'analytics (init, trackEvent, identifyUser) avec PostHog EU (`eu.i.posthog.com`)
- `main.tsx` : initialisation PostHog au lancement de l'app
- `Index.tsx` : tracking des étapes clés du tunnel — `game_started`, `phase_changed`, `intro_video_completed`, `video_trigger_activated`, `game_over`, `questionnaire_submitted`
- Session recording et autocapture activés par défaut

**Ce que ça permet** : Visualiser le parcours utilisateur complet, identifier les points d'abandon, mesurer les durées de session et les raisons de game over.

**Time**: ~15min

---

### 2026-03-12 — Fix sync Notion "Failed to fetch" 🔹

**Intent**: La sync Notion échouait avec "Failed to fetch" car toutes les tables étaient traitées en un seul appel, dépassant le timeout de 60s des Edge Functions.

**Tool**: Lovable

**Outcome**:
- `Admin.tsx` : refactoring de `triggerSync` pour itérer table par table avec `AbortController` (timeout 120s par appel)
- Toast de feedback en temps réel par table (succès/échec individuel)
- Résumé final avec compteur de tables synchronisées vs échouées

**Ce que ça permet** : La sync Notion fonctionne même avec des bases volumineuses, et l'utilisateur voit la progression en temps réel.

**Time**: ~10min

---

### 2026-03-12 — Fix closure stale `isProcessing` 🔹

**Intent**: Après le premier échange, Max "réfléchit" mais ne répond plus — les tours suivants étaient silencieusement bloqués par un guard `isProcessing` capturé dans une closure stale.

**Tool**: Lovable

**Outcome**:
- `Index.tsx` : ajout de `isProcessingRef` (useRef) en parallèle du state `isProcessing`
  - Le ref est lu/écrit immédiatement (pas de batching React)
  - Le state est conservé pour le rendu UI si nécessaire
  - Le guard dans `processUserMessage` utilise `isProcessingRef.current` au lieu du state
- Suppression de `isProcessing` des dépendances du `useCallback`

**Pourquoi ça cassait** : `isProcessing` est un state React utilisé dans un `useCallback`. Quand il passe à `true`, le callback est recréé avec cette valeur en closure. Même après le `setIsProcessing(false)` du `finally`, le re-render + mise à jour du ref pouvait arriver trop tard si le STT renvoyait un transcript entre-temps.

**Time**: ~10min

---

- **2026-03-08**: La persistance des réglages en localStorage seul est fragile — la double couche localStorage + DB (table admin_settings) garantit que les réglages survivent à tout contexte.
- **2026-03-08**: Le suivi des coûts LLM doit être automatique et transparent — si l'intégrateur doit penser à logguer, il oubliera. L'intégration dans openRouterLLM.ts rend le tracking invisible pour le reste du code.
- **2026-03-08**: Afficher le JSON brut de sync Notion était inutile pour le pilotage — un rapport visuel par table avec les métriques RAG (chunks, tokens) permet de comprendre instantanément l'état du contenu narratif.
- **2026-03-08**: L'API OpenRouter Generation met parfois 15-60s à indexer les coûts — un mécanisme de retry progressif est indispensable pour récupérer les vrais coûts.
- **2026-03-08**: Les environnements test et live ont des bases de données séparées — les réglages admin doivent être configurés indépendamment dans chaque environnement.
- **2026-03-08**: Le preload des caches et le warm-up des Edge Functions pendant les cinématiques est une stratégie clé — l'utilisateur ne remarque pas le chargement car il regarde la vidéo.
- **2026-03-08**: L'intégration Gumlet via iframe est la plus simple et la plus fiable — pas besoin de SDK JS custom, le player est entièrement géré côté Gumlet. Le slot `children` permet d'injecter n'importe quel overlay (HUD) sans toucher au player.

- **2026-03-12**: Les closures stales sur des states React dans des `useCallback` sont un piège classique — pour tout guard critique (comme `isProcessing`), utiliser un ref en plus du state pour garantir une lecture synchrone.
- **2026-03-12**: PostHog en mode EU (`eu.i.posthog.com`) avec session recording permet de comprendre les parcours utilisateurs sans infrastructure analytics custom.
- **2026-03-12**: Découper les opérations longues (sync multi-tables) en appels individuels avec feedback progressif est toujours préférable à un appel monolithique qui risque de timeout.
- **2026-04-24**: Pour contrôler un personnage IA, il faut séparer identité, connaissances autorisées, objectifs de tour et interdictions d'affirmation — un seul prompt monolithique donne trop de latitude au modèle.
- **2026-04-24**: Une vue de trace admin devient essentielle dès qu'on introduit plusieurs couches de pilotage (RAG, brief GM, contraintes Max) — sinon il devient impossible d'expliquer pourquoi Max a répondu d'une certaine manière.
- **2026-04-24**: Une erreur de lookup de coût OpenRouter ne doit jamais avoir d'impact UX sur la conversation — la télémétrie doit être dégradée gracieusement, jamais critique-path.

*Aucun pivot majeur pour le moment — le PRD est clair et le développement suit le plan.*

---

## Pulse Checks

*À remplir après les prochaines sessions.*

---

## Insights Vault

- **2026-03-08**: Le vibe coding avec Lovable permet de construire un prototype voice-to-voice complet en ~2 jours. La clé : un PRD détaillé qui sert de prompt initial.
- **2026-03-08**: Les Edge Functions Supabase sont parfaites comme proxy API — zéro clé exposée côté client, déploiement automatique.
- **2026-03-08**: Le Notion MCP permet d'inspecter directement les schémas des bases Notion et de mapper précisément les noms de propriétés français. Critique pour éviter les erreurs de mapping dans sync-notion.
- **2026-03-08**: Le fetch du contenu de page (blocks API) pour les characters est essentiel — les propriétés Notion ne contiennent qu'un résumé, le backstory détaillé est dans le body de la page.
- **2026-03-08**: Le micro persistant (pause/resume) est bien plus fluide que stop/start — évite la latence de reconnexion WebSocket et la re-demande de permission micro à chaque tour.
- **2026-03-08**: Le system prompt de Max doit être éditable depuis /admin, pas hardcodé — permet d'itérer rapidement sur le comportement du personnage sans toucher au code.
- **2026-03-08**: La diction ElevenLabs en français dépend fortement des paramètres stability et speed — le preset "Claire et articulé" (stability 0.6, speed 0.92) donne de bien meilleurs résultats que les défauts.
- **2026-03-08**: Multi-modèles via OpenRouter est crucial pour le prototypage — pouvoir switcher entre Qwen, Claude, Grok sans changer de code permet de trouver le meilleur modèle pour le roleplay en français.

---

## Artifact Links

| Date | Type | Link/Location | Note |
|------|------|---------------|------|
| 2026-03-08 | URL | https://ava-proto1.lovable.app | App publiée |
| 2026-03-08 | Screenshot | public/assets/max-bg.jpg | Background conversation |
| 2026-03-08 | Doc | documents/PRD_Prototype_1.md | PRD complet |

---

## Narrative Seeds

- "Ta voix est ta seule arme" — le pitch de l'onboarding qui résume tout
- Le moment où Max parle pour la première fois avec sa voix ElevenLabs — la magie du voice-to-voice
- Construire un pipeline STT→LLM→TTS complet en un weekend avec du vibe coding
- Le RAG qui retourne "Décision du grand-père (secret de Max)" quand on demande la relation Max/Ava — la narration émerge des données
- Pouvoir switcher entre Grok et Claude pour le même personnage et sentir la différence de "personnalité" — chaque LLM a son propre style de roleplay

---

## Open Windows 🪟

| Date | Description | Impact | Plan de fix |
|------|-------------|--------|-------------|
| 2026-03-08 | Video triggers hardcodés (DEMO_TRIGGERS) au lieu de dynamiques depuis DB | Moyen | Prochaine étape |
| 2026-03-08 | Gameplay steps vide dans Notion (0 étapes) | Moyen | Remplir dans Notion |
| 2026-03-08 | 1 video trigger sans titre dans Notion → ignoré au sync | Bas | Corriger dans Notion |
| 2026-03-08 | Pas de test end-to-end du pipeline voice-to-voice complet avec testeurs externes | Haut | Prochaine session |
| 2026-03-08 | Diction ElevenLabs parfois bizarre en français — nécessite fine-tuning des paramètres voix | Moyen | Tester presets dans /admin > Voix |
| 2026-04-24 | ~~Validation anti-hallucination pré-TTS pas encore intégrée au runtime~~ ✅ Résolu en session 11 (retry + fallback + métriques) | — | Fait |
| 2026-04-24 | Bible factuelle / sujets verrouillés non encore modélisés explicitement | Haut | Phase 3 étendue : politique de vérité à 4 niveaux |
| 2026-04-24 | Politique de vérité à 4 niveaux (certain/probable/inconnu/interdit) reportée | Moyen | Refactor `MaxTurnKnowledgeContext` + prompt validateur |
| 2026-04-24 | Bible factuelle pas encore éditable depuis l'admin | Moyen | UI dédiée pour les faits autorisés globaux |

---

## Contrats de session (DBC)

### Dernière session

**Préconditions vérifiées au départ :**
- [x] Build passait au démarrage
- [x] Aucune branche ouverte non terminée
- [x] STORY.md lu et contexte compris
- [x] Open Windows revues

**Postconditions au départ :**
- [x] Build passe
- [x] Tout commité et pushé
- [x] STORY.md mis à jour
- [x] Open Windows mis à jour

---

## AI Instructions

*These instructions are for the AI assistant helping build this project:*

```
STORY.md MAINTENANCE PROTOCOL — Pragmatic Edition

1. AFTER EACH FEATURE (Finish What You Start):
   - Add entry to "Feature Chronicle" immediately
   - 🔷 Major = new capability, significant UI change, integration, architecture shift
   - 🔹 Minor = bug fix, tweak, small improvement, logging enhancement
   - Verify feature is truly complete before marking done — no half-open features

2. ON ERRORS/PIVOTS (Crash Early):
   - Add entry to "Pivots & Breakages" immediately when discovered
   - Capture technical details AND emotional context
   - Document what was learned
   - If a broken window is found but NOT fixed this session → add to "Open Windows"

3. ON BROKEN WINDOWS (Tip 5):
   - Any known bug, tech debt, or undocumented TODO → "Open Windows" table
   - Never leave a broken window undocumented
   - At session start, review Open Windows and decide: fix now or document why not

4. EVERY 3-5 FEATURES:
   - Trigger Pulse Check: Ask creator ONE question
   - Record answer in "Pulse Checks" section
   - Update "Last Updated" date

5. ON INSIGHTS:
   - When creator expresses a learning, add to "Insights Vault" with date

6. ON ARTIFACTS:
   - When screenshots/links are shared, add to "Artifact Links"

7. AT SESSION START (DBC — préconditions):
   - Review "Contrats de session" — update checklist
   - Review "Open Windows" from last session

8. AT SESSION END (DBC — postconditions):
   - Update "Contrats de session" postconditions checklist
   - Update Open Windows table
   - Verify build passes before closing

9. ALWAYS:
   - Update "Last Updated" date at top of file after changes
   - Preserve exact technical details in Feature Chronicle
   - Don't sanitize failures or confusion—that's the learning gold
   - Include Time estimate for each feature for future planning

10. FORMAT:
   - Use ISO date format [YYYY-MM-DD] consistently
   - Include 🔷 (major) and 🔹 (minor) emojis for feature categorization
   - Maintain markdown structure for readability
   - Keep prose concise but specific—avoid fluff
```
