# Où est Ava ? — Prototype 1

> **Statut**: 🟡 En cours  
> **Type**: 🧪 Prototype  
> **Créé avec**: Lovable  
> **Démarré**: 2026-03-07  

> **Mise à jour récente (2026-05-22) — Robustesse voix multi-navigateurs + optimisation latence live + observabilité PostHog** : audit détaillé du pipeline vocal Max (`docs/audit_voice_conversation_max.md`) puis durcissement du runtime voix : sélection MIME STT, timeouts critiques, audio unlock, lecture TTS robuste, preset **Conversation temps réel**, silence STT réduit à 900 ms. Deuxième passe latence : **Gemini 2.0 Flash**, réponses limitées à 220 tokens / 1-2 phrases, RAG compacté, suppression du GM pré-tour LLM du hot path. Troisième passe observabilité : `turn_id`, événements PostHog `voice_turn_completed` / `voice_error`, tables internes `voice_turn_events` / `voice_error_events`, et stats back-office end-to-end.

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
- [x] **TTS multi-providers** : façade `src/services/tts/` + providers ElevenLabs / Inworld (`inworld-tts-2`, voix « Alain », streaming NDJSON) / Hume AI Octave, sélection d'un provider actif global depuis Admin → TTS Config
- [x] **Dashboard « Consommation Voix »** : compteurs, taux de succès, latences p50/p95 (first-byte + total), codes HTTP et erreurs récentes par provider
- [x] **Robustesse voix multi-navigateurs** : sélection MIME STT à l'exécution, timeouts critiques, audio unlock, erreurs TTS/STT trackées et état conversationnel récupérable
- [x] **Preset voix basse latence** : réglage `realtime_conversation` pour tests voice-to-voice rapides (`eleven_turbo_v2_5`, MP3 64 kbps, `optimizeStreamingLatency=1`)
- [x] **Optimisation latence live Max** : modèle live rapide par défaut, contexte RAG compacté, GM pré-tour LLM retiré du chemin temps réel, réponses orales bornées à 1-2 phrases
- [x] **Observabilité latence voix PostHog + admin** : événement agrégé `voice_turn_completed`, erreur unifiée `voice_error`, corrélation `turn_id`, stockage Supabase `voice_turn_events` / `voice_error_events`, dashboard cible documenté
- [ ] Video triggers dynamiques (depuis DB au lieu de hardcodés)
- [ ] Politique de vérité à 4 niveaux (certain / probable / inconnu / interdit)
- [ ] Bible factuelle éditable et gestion explicite des sujets verrouillés/déverrouillés
- [ ] Alertes de budget LLM + fallback modèle

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React + Vite + Tailwind + TypeScript (Lovable) |
| Backend | Lovable Cloud (Supabase Postgres + pgvector) |
| Edge Functions | proxy-llm, proxy-stt, proxy-tts, **proxy-tts-inworld**, **proxy-tts-hume**, sync-notion, query-rag, sync-questionnaire, rewrite-query, summarize-session |
| Video | Gumlet (hébergement + embed player) |
| Cost Tracking | OpenRouter generation API (tokens + USD per call) |
| LLM | OpenRouter API — Multi-modèles. Chemin live optimisé sur **Gemini 2.0 Flash** par défaut ; modèles plus lourds réservés aux tests/qualité depuis l'admin. |
| STT | Deepgram (WebSocket streaming + VAD) avec sélection MIME `MediaRecorder` à l'exécution et timeouts token/micro/WebSocket |
| TTS | **Multi-providers** via façade `src/services/tts/` — ElevenLabs (voix custom Max), **Inworld `inworld-tts-2`** (voix « Alain », streaming NDJSON), **Hume AI Octave**. Provider actif sélectionné dans Admin → TTS Config. Lecture audio robuste avec audio unlock et classification des erreurs navigateur. |
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

## 🧪 Protocole de test RAG v2 (banc d'essai Max)

Prérequis : secret `VOYAGE_API_KEY` configuré dans Lovable Cloud, et données Notion synchronisées (`sync-notion` → `embedding_v` rempli).

### 1. Activer les toggles (`src/config/settings.json`)

```json
{
  "RAG_EMBEDDING_PROVIDER": "voyage",
  "RAG_RERANK_ENABLED": true,
  "RAG_QUERY_REWRITE_ENABLED": true,
  "RAG_TOP_K": 5,
  "RAG_RETRIEVE_K": 15
}
```

### 2. Lancer le banc d'essai

Aller sur `/admin` → onglet **Test de réponse Max**.

### 3. Points de contrôle attendus

| Étape | Contrôle | Détail |
|---|---|---|
| **0. Query rewrite** | Message ambigu (ex. *"Et toi ?"*) | Vérifier que la requête est réécrite en phrase autonome dans l'accordéon |
| **1. RAG** | Provider badge | Doit afficher **voyage** (pas openai) |
| **1. RAG** | `rerankUsed` | Badge présent si `RAG_RERANK_ENABLED=true` |
| **1. RAG** | Par chunk | Vérifier `character_id` (scopé ou "shared"), `retrieval_similarity` (cosine brute), `rerank_score` (Voyage rerank-2.5) |
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
