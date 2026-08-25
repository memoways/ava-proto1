# Où est Ava ? — Prototype 1

> **Statut**: 🟡 En cours  
> **Type**: 🧪 Prototype  
> **Diffusion**: 🔒 Interne uniquement — non public, tests utilisateurs prévus en septembre 2026
> **Créé avec**: Lovable  
> **Démarré**: 2026-03-07  

## Plateforme de référence

**Lovable compile le code et publie le site.** Le backend, la base de données, les Edge Functions et les secrets passent par **Lovable Cloud**, avec **Supabase fourni par Lovable**. Il ne faut pas remplacer cette chaîne par un build, un déploiement, un hébergeur ou un projet Supabase externe.

Les développements réalisés depuis un autre environnement doivent rester compatibles avec Lovable et être ramenés dans le projet Lovable avant toute validation ou publication. Les instructions obligatoires destinées à tous les agents et outils du dépôt sont dans [`AGENTS.md`](AGENTS.md).

La mise en public est bloquée par la [release gate](docs/public_release_gate.md). Un aperçu interne peut être utilisé pour le développement, mais aucun lien ne doit être diffusé à des testeurs externes avant validation des critères de sécurité, persistance et endurance.

> **Mise à jour récente (2026-08-21) — environnements de réglages et accès nominatifs** : le runtime public reste verrouillé sur `prod`, tandis que les membres authentifiés disposent de trois sandboxes isolées. Le portail public est vérifié côté Lovable Cloud et les sessions sont attribuées par compte, environnement, contexte et campagne. Plan d'activation et checklist : [`docs/plan_environnements_sandbox_auth.md`](docs/plan_environnements_sandbox_auth.md).

> **Mise à jour récente (2026-08-05) — RAG Voyage 4 versionné** : le profil temps réel recommandé indexe les documents avec `voyage-4-large` et les interroge avec `voyage-4-lite` dans leur espace vectoriel partagé. Les profils sont construits en parallèle puis activés atomiquement ; le dashboard RAG affiche l’index effectif, les modèles, le chunking, les volumes et les p50/p95 live. `voyage-context-4` est disponible en canary, sans overlap. Analyse, plan et trajectoire mémoire/payload : [`docs/design/DESIGN-001-rag-voyage4-memoire-payload.md`](docs/design/DESIGN-001-rag-voyage4-memoire-payload.md).

> **Mise à jour récente (2026-07-30) — Streaming Avatar piloté par Ava** : l’output public peut rendre le texte final inchangé de Max avec le TTS local, HeyGen LiveAvatar ou Tavus. Les fournisseurs avatar ne participent ni au STT, ni au RAG, ni au raisonnement. L’activation reste en canary, avec TTS par défaut. Procédure Lovable Cloud : [`docs/streaming-avatar-lovable-setup.md`](docs/streaming-avatar-lovable-setup.md).

> **Mise à jour récente (2026-07-21) — traces causales de Max** : les administrateurs peuvent lancer une session PRD4 explicitement tracée et inspecter chaque tour (mémoire, RAG et scores, prompt assemblé, payload OpenRouter exact, modèle, réponse et latences). La trace causale est enregistrée avant l’affichage et le TTS ; en cas d’échec d’écriture, le tour n’est pas diffusé et peut être rejoué. Détails : [`docs/max-causal-tracing.md`](docs/max-causal-tracing.md).

> **Mise à jour récente (2026-07-13) — télémétrie des tests internes** : le panneau voix/analytics est temporairement masqué et les événements techniques PostHog/Grain sont actifs par défaut. Le panneau final reste disponible avec `VITE_PRIVACY_NOTICE_ENABLED=true`. Autocapture, replay, profils persistants et texte libre restent exclus. Détails : [`docs/phase4_privacy_prepublic_runbook.md`](docs/phase4_privacy_prepublic_runbook.md).

> **Mise à jour précédente (2026-07-13) — Phase 3 : canary interne** : la durée est pilotée uniquement par `TIMEOUT_SECONDS` dans le slider admin ; le timer et le Game Master suivent cette valeur. Les seuils de promotion/rollback sont codifiés, la persistance devient observable et PostHog n'utilise plus autocapture ni session replay. Détails : [`docs/phase3_internal_canary_runbook.md`](docs/phase3_internal_canary_runbook.md).

> **Mise à jour précédente (2026-07-13) — Phase 2 : fluidité et endurance configurable** : contexte LLM borné, résumé persistant, RAG fail-soft et annulation des tours obsolètes. Le watchdog protège l'attente de la première voix sans limiter la durée d'une lecture TTS en cours. Les tests couvrent 1 050 tours orchestrateur, un soak navigateur de 35 tours et une réponse audio dépassant le watchdog. Détails : [`docs/phase2_fluidity_endurance_report.md`](docs/phase2_fluidity_endurance_report.md).

> **Mise à jour récente (2026-05-22) — PRD4 : nouveau parcours post-film + rôle utilisateur + Max contextualisé** : refonte structurante livrée en 6 phases. L'onboarding A/B est supprimé au profit d'un parcours unique *« tu viens de voir le film, tu appelles quelqu'un »*. Le joueur définit son rôle à la voix (push-to-talk + résumé Gemini Flash), Max reçoit ce rôle dans son system prompt, 4 personnages s'affichent (Max actif, Emma/Ava/Léo grisés), le GM pré-tour est retiré du chemin temps réel et le GM post-turn tourne en async (`sessions.gm_post_turn_log`). Nouveau questionnaire 10 questions + mapping Notion avec accents exacts. Back-office enrichi (rôle utilisateur + timeline GM post-turn). Détails : `CHANGELOG.md`, `STORY.md`, `docs/plan_prd4_implementation.md`, PRD `documents/PRD_4_prototype_mai_2026.md`.

> **Mise à jour précédente (2026-05-22) — Robustesse voix multi-navigateurs + optimisation latence live + observabilité PostHog** : audit détaillé du pipeline vocal Max (`docs/audit_voice_conversation_max.md`) puis durcissement du runtime voix : sélection MIME STT, timeouts critiques, audio unlock, lecture TTS robuste, preset **Conversation temps réel**, silence STT réduit à 900 ms. Deuxième passe latence : **Gemini 2.0 Flash**, réponses limitées à 220 tokens / 1-2 phrases, RAG compacté, suppression du GM pré-tour LLM du hot path. Troisième passe observabilité : `turn_id`, événements PostHog `voice_turn_completed` / `voice_error`, tables internes `voice_turn_events` / `voice_error_events`, et stats back-office end-to-end.

> **Mise à jour précédente (2026-05-16) — TTS multi-providers + voix Alain (Inworld) + monitoring « Consommation Voix »** : refonte du TTS en **façade découplée** (`src/services/tts/`) avec 3 providers branchés — **ElevenLabs**, **Inworld `inworld-tts-2`** (voix « Alain » en streaming NDJSON, deliveryMode STABLE/BALANCED/CREATIVE) et **Hume AI Octave**. Sélection d'un seul provider actif **global** depuis Admin → **TTS Config**, sans redéploiement, avec bouton 🔊 Tester par provider. Nouveau dashboard **« Consommation Voix »** : compteurs, taux de succès, latences **p50/p95** (first-byte + total), distribution des **codes HTTP** et erreurs récentes par provider. Secrets `INWORLD_API_KEY` et `HUME_API_KEY` ajoutés. Détails dans `CHANGELOG.md` et `STORY.md`.

> **Mise à jour précédente (2026-05-10) — RAG v2 (Voyage AI + reranker + query rewriting + mémoire de session)** : embeddings **Voyage AI `voyage-3` (1024 dim)** en double-stack avec OpenAI, reranker **`rerank-2.5`**, filtrage strict par `character_id`, indexes pgvector **HNSW**, edge functions `rewrite-query` et `summarize-session`.

> **Mise à jour précédente**: banc d'essai complet « Test de réponse Max » — refonte de l'onglet en **outil d'inspection du pipeline conversationnel** étape par étape (RAG → Knowledge → GM pré-tour → Max → Validateur). Document de plan : `docs/plan_max_test_inspector.md`.

## En une phrase

Expérience narrative interactive voice-to-voice avec Max, un personnage fictif piloté par IA, dans l'univers de "Où est Ava ?".

## 📋 Source de vérité

- **PRD**: [`documents/PRD_Prototype_1.md`](documents/PRD_Prototype_1.md)
- **Notion**: Bases éditoriales AVA (Characters, Storyworld, Gameplay, Vidéos)
- **Dernière sync**: 2026-03-08

## 🎯 Objectif projet

Valider le pipeline technique complet d'une conversation voice-to-voice avec un personnage IA : STT (Deepgram) → LLM (OpenRouter/multi-modèles) → TTS (ElevenLabs), orchestré par un Game Master autonome qui gère la confiance, les triggers vidéo et le game over, enrichi par un pipeline RAG connecté à Notion.

Le chantier en cours suit le plan `documents/plan_implementation_max.md` pour mieux séparer l'identité de Max, les connaissances autorisées, les contraintes de révélation et la supervision éditoriale du Game Master.

## ✅ Livrables

- [x] Pipeline voice-to-voice complet (STT → LLM → TTS)
- [x] Agent Max conversationnel (prompt système, streaming)
- [x] Agent Game Master orchestrateur (JSON structuré)
- [x] Système de triggers vidéo (Gumlet player + fallback placeholder)
- [x] Cinématique d'intro vidéo Gumlet
- [x] UI dark theme cinématique
- [x] Questionnaire de fin intégré
- [x] Pipeline RAG (Notion → Supabase → embeddings → prompt enrichi)
- [x] Sync Notion → Supabase (4 bases : Characters, Storyworld, Gameplay, Vidéos)
- [x] Embeddings OpenAI (text-embedding-3-small, 1536 dim) + pgvector
- [x] Query RAG sémantique (match_embeddings)
- [x] Sauvegarde de session complète
- [x] Micro persistant continu (pause/resume sans reconnexion)
- [x] Sync questionnaire → Notion
- [x] Dashboard admin (sessions, questionnaires, édition system prompt)
- [x] Pipeline TTS par phrase (sentence-level streaming)
- [x] Config LLM dynamique (multi-modèles : Qwen, Claude, Grok, Llama, Gemini)
- [x] Config voix ElevenLabs (stability, similarity, style, speed, presets)
- [x] HUD conversationnel (timer + jauge confiance + tooltips explicatifs)
- [x] Accès questionnaire anticipé (après 4 min)
- [x] Modal info projet (détail concept, pipeline, objectifs)
- [x] LLM Cost Tracker (tracking automatique tokens + coûts USD par appel OpenRouter)
- [x] Persistance des réglages admin en base (LLM, Voix, Gameplay, GM)
- [x] Rapport de sync Notion détaillé (entrées, chunks RAG, tokens par table)
- [x] Player vidéo Gumlet (iframe embed responsive plein écran)
- [x] Contrôle éditorial structuré de Max (persona, objectifs, historique, interdictions d'affirmation)
- [x] Simulateur admin de réponse Max avec contexte RAG de test
- [x] Inspecteur admin persistant des traces PRD4 live, par session et par tour
- [x] Pré-turn planner Game Master disponible dans le simulateur (non exécuté en PRD4 live)
- [x] Robustesse du tracking de coûts OpenRouter en cas de génération introuvable temporairement
- [x] Validation anti-hallucination avec retry + fallback dans le simulateur (non exécutée en PRD4 live)
- [x] Aperçu admin de la fusion faits globaux + contexte autorisé du tour avant validation
- [x] Persistance des traces de validation par message dans `conversation_log`
- [x] Métriques admin de hallucinations (taux régénération + fallback sur 50 dernières sessions)
- [x] Catalogue formel des modes de parole de Max (6 styles éditoriaux)
- [x] Schéma visuel du pipeline conversationnel (8 étapes + glossaire)
- [x] Tests automatisés orchestrateur + validateur + composants admin
- [x] Pipeline PRD4 parallélisé (labels GM en parallèle de Max, GM post-tour destiné au tour suivant)
- [x] Validateur du simulateur en mode fail-open (timeout 4s + résilience aux JSON malformés)
- [x] Panneau admin "Latence & blocage" : timings par étape (RAG/GM/Max/validateur/TTS) + détection du point de blocage
- [x] Accès `/admin` protégé par Supabase Auth et comptes nominatifs `admin_users`
- [x] Visualisation comparative multi-sessions des latences réelles (barres empilées par session)
- [x] Détail par tour dépliable depuis chaque barre de session, avec marqueur de cible 2 s commun
- [x] Indicateur de dispersion par session (bracket min–max + écart-type σ sur le total des tours)
- [x] Filtres sessions (période, nombre min de tours, présence de blocage) + auto-dépliage au focus
- [x] Mini-graphique GM fallback (`elapsed_ms` vs `timeout_ms`) dans l'onglet Sessions
- [x] Diagnostic factuel des latences au survol des segments (budget cible, ratio vs médiane, p95, hypothèses d'optimisation)
- [x] Panneau latéral détaillé (`SegmentDetailSheet`) au clic sur un segment de latence
- [x] Filtre "Sévérité min." dans la vue latence (atténuation visuelle des segments sous le seuil)
- [x] Guide Game Master (`documents/guide_game_master_contenus_et_tests.md`) — prompts, variables, hypothèses, variantes à tester
- [x] Banc d'essai complet d'inspection du pipeline Max (RAG → Knowledge → GM Pre → Max → Validator) avec chronologie, tokens, latences, contexte injecté décomposé, brief GM JSON, prompt système final, diagnostic validateur, export JSON et presets rapides
- [x] Embeddings Voyage AI `voyage-3` (1024 dim) en double-stack avec OpenAI + reranker `rerank-2.5` appliqué après retrieval
- [x] Profils RAG versionnés : Voyage 4 temps réel (`voyage-4-large` documents → `voyage-4-lite` questions), Context 4 canary et activation atomique après rebuild complet
- [x] Filtrage strict par personnage (`character_id`) sur les chunks RAG (chunks scopés vs partagés)
- [x] Indexes pgvector HNSW (m=16) — fix scoring quasi-nul sur petits datasets vs ivfflat
- [x] Query rewriting LLM (`rewrite-query` edge function) — reformulation autonome avant RAG
- [x] Mémoire de session compressée (`summarize-session` + table `session_summaries`) injectée dans le prompt Max
- [x] Affichage banc d'essai : étape Query rewrite, badge provider d'embedding, par chunk `character_id`/`rerank_score`/retrieval brut
- [x] **TTS multi-providers** : façade `src/services/tts/` + providers ElevenLabs / Inworld (`inworld-tts-2`, voix « Alain », streaming NDJSON) / Hume AI Octave, sélection d'un provider par environnement depuis Admin → TTS Config
- [x] **Dashboard « Consommation Voix »** : compteurs, taux de succès, latences p50/p95 (first-byte + total), codes HTTP et erreurs récentes par provider
- [x] **Robustesse voix multi-navigateurs** : sélection MIME STT à l'exécution, timeouts critiques, audio unlock, erreurs TTS/STT trackées et état conversationnel récupérable
- [x] **Preset voix basse latence** : réglage `realtime_conversation` pour tests voice-to-voice rapides (`eleven_turbo_v2_5`, MP3 64 kbps, `optimizeStreamingLatency=1`)
- [x] **Optimisation latence live Max** : modèle live rapide par défaut, contexte RAG compacté, GM pré-tour LLM retiré du chemin temps réel, réponses orales bornées à 1-2 phrases
- [x] **Observabilité latence voix PostHog + admin** : événement agrégé `voice_turn_completed`, erreur unifiée `voice_error`, corrélation `turn_id`, stockage Supabase `voice_turn_events` / `voice_error_events`, dashboard cible documenté
- [x] **PRD4 — Parcours unique post-film** : `ExperiencePhase` à 11 états (`welcome → film_question → teaser → role_capture → role_summary → character_select → calling_max → conversation_max → end_session → questionnaire → thanks`), 9 écrans dédiés (`src/components/prd4/*`), entrée racine `/` directement sur `IndexPRD4`
- [x] **PRD4 — Rôle joueur libre** : capture push-to-talk + edge function `summarize-role` (Gemini 2.5 Flash) qui produit un `UserRoleProfile` JSON (`summary_for_user`, `summary_for_max`, `relationship_to_family`, `age`, `gender`, `proximity_level`, `intent`), persistance `sessions.player_role`
- [x] **PRD4 — Max contextualisé par le rôle** : résumé `summary_for_max` injecté en tête du system prompt de Max avant la persona
- [x] **PRD4 — GM post-turn async** : agent `gameMasterPRD4.ts` évalue chaque tour (engagement_delta, role_usage_quality, confusion, topics, end_recommended, next_turn_guidance), persistance append-only dans `sessions.gm_post_turn_log`, GM pré-tour retiré du chemin temps réel
- [x] **PRD4 — 4 personnages dont 3 grisés** : grille 2×2, Max actif coloré, Emma/Ava/Léo grisés + cadenas + dialog d'indisponibilité, écran `CallingMaxScreen` (sonneries ~3 s) avant la conversation
- [x] **PRD4 — Nouveau questionnaire (10 questions)** : film vu, teaser utile, clarté création rôle, justesse résumé, clarté/frustration PTT, Max reconnaît rôle, Max crédible, envie autres personnages, prochain personnage souhaité, durée ressentie, feedback ouvert + email + 2 opt-ins ; métriques techniques calculées automatiquement
- [x] **PRD4 — Sync Notion avec noms exacts (accents)** : `sync-questionnaire` détecte `version: "prd4"` et écrit dans les propriétés Notion accentuées (`PRD4 Rôle création clarté`, `PRD4 Résumé personnage justesse`, `PRD4 Max reconnaît rôle`, `PRD4 Personnage souhaité prochain`, `PRD4 Durée ressentie`, `PRD4 Rôle JSON`, `PRD4 Être tenu au courant`, `PRD4 Contact feedback détaillé`…), filtrage côté serveur des propriétés absentes via `fetchDatabaseProperties()` (`skipped_props` logué)
- [x] **PRD4 — Back-office enrichi** : `SessionsTab` admin affiche le rôle joueur (résumés + JSON repliable) et une timeline `gm_post_turn_log` compacte (engagement, role usage, confusion, end, modération, latence ms, sujets, next_turn_guidance)
- [x] **PRD4 — Nettoyage legacy** : suppression de `OnboardingAScreen`, `OnboardingBScreen`, `ABChoiceScreen`, `OnboardingScreen`, `GateScreen`, `pages/Index.tsx` et de la route `/legacy`
- [x] **LLM as judge (lot 1)** : onglet Qualité `/admin/qualite/llm-as-judge`, corpus Notion, OFAT texte-only (modèle / sampling / RAG), juge LLM, classement vs live. Continuité d'expérience = lot 2.
- [ ] Video triggers dynamiques (depuis DB au lieu de hardcodés)
- [ ] Politique de vérité à 4 niveaux (certain / probable / inconnu / interdit)
- [ ] Bible factuelle éditable et gestion explicite des sujets verrouillés/déverrouillés
- [ ] Alertes de budget LLM + fallback modèle

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React + Vite + Tailwind + TypeScript (Lovable) |
| Backend | Lovable Cloud (Supabase Postgres + pgvector) |
| Edge Functions | proxy-llm, proxy-stt, proxy-tts, **proxy-tts-inworld**, **proxy-tts-hume**, sync-notion, **sync-eval-items**, query-rag, sync-questionnaire, rewrite-query, summarize-session |
| Video | Gumlet (hébergement + embed player) |
| Cost Tracking | OpenRouter generation API (tokens + USD per call) |
| LLM | OpenRouter API — Multi-modèles. Chemin live optimisé sur **Gemini 2.0 Flash** par défaut ; modèles plus lourds réservés aux tests/qualité depuis l'admin. |
| STT | Deepgram (WebSocket streaming + VAD) avec sélection MIME `MediaRecorder` à l'exécution et timeouts token/micro/WebSocket |
| TTS | **Multi-providers** via façade `src/services/tts/` — ElevenLabs (voix custom Max), **Inworld `inworld-tts-2`** (voix « Alain », streaming NDJSON), **Hume AI Octave**. Provider actif sélectionné dans Admin → TTS Config. Lecture audio robuste avec audio unlock et classification des erreurs navigateur. |
| Embeddings | Profils versionnés : **Voyage `voyage-4-large` → `voyage-4-lite` (1024D recommandé)**, `voyage-context-4` canary, Voyage 3/OpenAI legacy explicites |
| Reranker | **Voyage `rerank-2.5-lite`** par défaut live ; `rerank-2.5` pour les comparaisons qualité |
| Données | Notion (source de vérité) → Supabase fourni par Lovable (miroir + index parallèles) |
| RAG | query-rag Edge Function + pgvector HNSW + profil actif serveur + filtrage `character_id` + reranking contextualisé |

## 🧭 Avancement du plan Max / GM

Le plan initial visait 5 phases pour réduire les inventions de Max et rendre son comportement éditorialement pilotable.

### Déjà implémenté
- **PRD4 live** : Max reçoit mémoire bornée, résumé de session, RAG, contexte temporel, profil joueur et éventuelle guidance GM du tour précédent.
- **Traçabilité** : `PipelineTraceTab` relie chaque réponse diffusée à son entrée, son prompt, son payload OpenRouter exact, ses chunks RAG, ses réglages et ses latences.
- **Game Master live** : labels en parallèle et évaluation post-tour ; ces traitements sont séparés des causes de la réponse actuelle.
- **Outils de simulation** : GM pré-tour et validateur restent disponibles dans `MaxPromptTestTab`, mais ne sont pas exécutés dans le PRD4 live.
- **Outils éditoriaux** : `MaxPromptControlTab`, `MaxPromptTestTab`, `AntiHallucinationValidatorTab`, `HallucinationMetricsTab`.

### Reste à développer
- **Politique de vérité à 4 niveaux** (certain / probable / inconnu / interdit) — refactor structurel de `MaxTurnKnowledgeContext` et du prompt validateur.
- **Bible factuelle éditable** : interface admin pour gérer les faits autorisés globaux.
- **Gestion d'unlocked/locked subjects** : pilotage fin des sujets révélables selon l'état narratif.

## 🚀 Démarrage rapide

```bash
# Cloner
git clone <YOUR_GIT_URL>

# Installer
npm install

# Lancer
npm run dev
```

Ou directement via [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID).

## 🧪 Protocole de test RAG versionné

Prérequis : migration `20260805120000_rag_embedding_profiles.sql` appliquée via Lovable Cloud, secret `VOYAGE_API_KEY` configuré et données Notion accessibles.

### 1. Construire le profil

Dans `/admin` → **🔎 Configuration RAG**, sélectionner **Voyage 4 · temps réel**, puis **Construire et activer**. Le profil courant reste actif jusqu’au succès complet.

### 2. Lancer le banc d'essai

Aller sur `/admin` → **Mécanique → Laboratoire RAG**.

### 3. Points de contrôle attendus

| Étape | Contrôle | Détail |
|---|---|---|
| **Index** | Profil actif | `voyage-4-realtime`, documents `voyage-4-large`, questions `voyage-4-lite` |
| **1. RAG** | Profil et modèle | Doit afficher le profil actif réellement lu côté serveur |
| **1. RAG** | `rerankUsed` | Badge présent si `RAG_RERANK_ENABLED=true` |
| **1. RAG** | Par chunk | Vérifier `character_id` (scopé ou "shared"), `retrieval_similarity` (cosine brute), `rerank_score` (Voyage rerank 2.5) |
| **4. Max** | Réponse | Doit s'appuyer sur les chunks rerankés, pas inventer hors contexte |
| **5. Mémoire session** | Historique de 4+ tours | Après 4 tours utilisateur, un résumé est généré et réinjecté dans le prompt (visible dans le contexte final de Max sous *SOUVENIRS DE LA SESSION*) |

### 4. Test rapide d'ambiguïté

Saisir un historique avec un message ambigu (antécédent manquant) et vérifier que le pipeline affiche la requête réécrite avant le RAG. Sans rewrite, le RAG retourne des chunks incohérents ; avec rewrite, les chunks doivent revenir cohérents avec le sujet rétabli.

## 🔗 Liens

- **URL de prod**: https://ava-proto1.lovable.app
- **URL de preview**: https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app

## 📁 Structure

```
/
├── documents/              # PRD et documentation projet
├── src/
│   ├── agents/             # maxAgent.ts, gameMasterAgent.ts
│   ├── assets/             # Images (portrait Max)
│   ├── components/         # Écrans UI (Onboarding, Conversation, GameOver, etc.)
│   ├── config/             # settings.json (variables configurables)
│   ├── hooks/              # useGameState, useTimer
│   ├── services/           # deepgramSTT, elevenLabsTTS, openRouterLLM, orchestrator, ragService, settingsService, llmUsageTracker, sessionService
│   └── types/              # Types TypeScript partagés
├── public/assets/          # Background images
├── supabase/functions/     # Edge Functions (proxy-llm, proxy-stt, proxy-tts, sync-notion, query-rag, sync-questionnaire)
├── CHANGELOG.md            # Historique versionné
├── STORY.md                # Journal de développement
└── README.md               # Ce fichier
```

## 📝 Notes

- **Secrets requis** (dans Lovable Cloud) : `OPENROUTER_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `OPENAI_API_KEY`, `NOTION_API_KEY`, **`VOYAGE_API_KEY`**
- Desktop only, Chrome recommandé
- Pas d'authentification — session locale
- Vidéos servies via Gumlet (intro fonctionnelle, triggers en cours de configuration)
- Sync Notion : 4 characters + 38 storyworld synchronisés, 42 embeddings générés
- **Admin** : `/admin` pour gérer sessions, prompts, config LLM/voix, suivi des coûts LLM, sync Notion détaillée
- **Admin** : `/admin` inclut désormais des onglets de contrôle du prompt de Max, de test éditorial et de trace pipeline Max/GM
- Les réglages admin sont persistés en base (survivent au rechargement et changement de navigateur)
- Le tracking de coûts OpenRouter est tolérant aux délais d'indexation et aux `generation_id` temporairement introuvables

---

*Projet Memoways — Storygami*
