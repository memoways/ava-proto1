# Où est Ava ? — Prototype 1

> **Statut**: 🟡 En cours  
> **Type**: 🧪 Prototype  
> **Créé avec**: Lovable  
> **Démarré**: 2026-03-07  

> **Mise à jour récente (2026-05-10) — RAG v2 (Voyage AI + reranker + query rewriting + mémoire de session)** : ajout des embeddings **Voyage AI `voyage-3` (1024 dim)** en double-stack avec OpenAI, reranker **`rerank-2.5`** appliqué après retrieval (champs `retrieval_similarity` + `rerank_score`), filtrage strict par `character_id` (chunks scopés vs partagés), passage des indexes pgvector en **HNSW** pour fiabilité sur petits datasets. Nouvelles edge functions `rewrite-query` (reformulation de la question utilisateur en requête autonome avant RAG) et `summarize-session` (résumé compressé tous les N tours, injecté dans le prompt Max sous « SOUVENIRS DE LA SESSION »). Le banc d'essai `MaxPromptTestTab` affiche désormais l'étape « Query rewrite », le provider d'embedding par requête, et par chunk : `character_id`, `rerank_score`, similarité de retrieval brute. Détails complets dans `CHANGELOG.md` et `STORY.md`.

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
- [x] Vue admin de trace pipeline conversationnelle (input, RAG, brief GM, décision)
- [x] Pré-turn planner Game Master avant génération de Max
- [x] Robustesse du tracking de coûts OpenRouter en cas de génération introuvable temporairement
- [x] Validation anti-hallucination pré-TTS avec retry + fallback automatique
- [x] Aperçu admin de la fusion faits globaux + contexte autorisé du tour avant validation
- [x] Persistance des traces de validation par message dans `conversation_log`
- [x] Métriques admin de hallucinations (taux régénération + fallback sur 50 dernières sessions)
- [x] Catalogue formel des modes de parole de Max (6 styles éditoriaux)
- [x] Schéma visuel du pipeline conversationnel (8 étapes + glossaire)
- [x] Tests automatisés orchestrateur + validateur + composants admin
- [x] Pipeline parallélisé (GM pre-turn + Max simultanés via `Promise.all`) pour réduire la latence
- [x] Validateur anti-hallucination en mode fail-open (timeout 4s + résilience aux JSON malformés)
- [x] Panneau admin "Latence & blocage" : timings par étape (RAG/GM/Max/validateur/TTS) + détection du point de blocage
- [x] Accès `/admin` protégé par mot de passe (anti-accès accidentel)
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
- [x] Filtrage strict par personnage (`character_id`) sur les chunks RAG (chunks scopés vs partagés)
- [x] Indexes pgvector HNSW (m=16) — fix scoring quasi-nul sur petits datasets vs ivfflat
- [x] Query rewriting LLM (`rewrite-query` edge function) — reformulation autonome avant RAG
- [x] Mémoire de session compressée (`summarize-session` + table `session_summaries`) injectée dans le prompt Max
- [x] Affichage banc d'essai : étape Query rewrite, badge provider d'embedding, par chunk `character_id`/`rerank_score`/retrieval brut
- [ ] Video triggers dynamiques (depuis DB au lieu de hardcodés)
- [ ] Politique de vérité à 4 niveaux (certain / probable / inconnu / interdit)
- [ ] Bible factuelle éditable et gestion explicite des sujets verrouillés/déverrouillés
- [ ] Alertes de budget LLM + fallback modèle

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React + Vite + Tailwind + TypeScript (Lovable) |
| Backend | Lovable Cloud (Supabase Postgres + pgvector) |
| Edge Functions | proxy-llm, proxy-stt, proxy-tts, sync-notion, query-rag, sync-questionnaire, **rewrite-query**, **summarize-session** |
| Video | Gumlet (hébergement + embed player) |
| Cost Tracking | OpenRouter generation API (tokens + USD per call) |
| LLM | OpenRouter API — Multi-modèles (Qwen, Claude, Grok, Llama, Gemini, GPT-5) |
| STT | Deepgram (WebSocket streaming + VAD) |
| TTS | ElevenLabs (voix custom Max, paramètres ajustables) |
| Embeddings | **Voyage AI `voyage-3` (1024 dim, défaut)** + OpenAI text-embedding-3-small (1536 dim, fallback) |
| Reranker | **Voyage `rerank-2.5`** (toggle via `RAG_RERANK_ENABLED`) |
| Données | Notion (source de vérité) → Supabase (miroir + embeddings double-stack) |
| RAG | query-rag Edge Function + pgvector HNSW + filtrage `character_id` + query rewrite + session summary |

## 🧭 Avancement du plan Max / GM

Le plan initial visait 5 phases pour réduire les inventions de Max et rendre son comportement éditorialement pilotable.

### Déjà implémenté
- **Phase 1 — Visibilité** : `PipelineTraceTab` + schéma visuel `PipelineSchema` (8 étapes) avec glossaire.
- **Phase 2 — Contrat GM → Max** : brief pré-tour structuré généré par le Game Master avant l'appel à Max + catalogue formel de 6 modes de parole.
- **Phase 3 — Contrôle de connaissance** : prompt structuré Max (persona, objectifs, contextes, interdictions).
- **Phase 4 — Validation pré-TTS** : validateur anti-hallucination avec retry + fallback, aperçu admin de la fusion faits globaux + contexte autorisé du tour, et persistance des traces par message dans `conversation_log`.
- **Phase 5 — Outils éditoriaux** : `MaxPromptControlTab`, `MaxPromptTestTab`, `AntiHallucinationValidatorTab`, `HallucinationMetricsTab` (taux régénération/fallback sur 50 sessions).

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
