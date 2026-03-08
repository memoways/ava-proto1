# Où est Ava ? — Prototype 1

> **Statut**: 🟡 En cours  
> **Type**: 🧪 Prototype  
> **Créé avec**: Lovable  
> **Démarré**: 2026-03-07  

## En une phrase

Expérience narrative interactive voice-to-voice avec Max, un personnage fictif piloté par IA, dans l'univers de "Où est Ava ?".

## 📋 Source de vérité

- **PRD**: [`documents/PRD_Prototype_1.md`](documents/PRD_Prototype_1.md)
- **Notion**: Bases éditoriales AVA (Characters, Storyworld, Gameplay, Vidéos)
- **Dernière sync**: 2026-03-08

## 🎯 Objectif projet

Valider le pipeline technique complet d'une conversation voice-to-voice avec un personnage IA : STT (Deepgram) → LLM (OpenRouter/Qwen) → TTS (ElevenLabs), orchestré par un Game Master autonome qui gère la confiance, les triggers vidéo et le game over, enrichi par un pipeline RAG connecté à Notion.

## ✅ Livrables

- [x] Pipeline voice-to-voice complet (STT → LLM → TTS)
- [x] Agent Max conversationnel (prompt système, streaming)
- [x] Agent Game Master orchestrateur (JSON structuré)
- [x] Système de triggers vidéo (mode placeholder)
- [x] State machine complète (7 phases)
- [x] UI dark theme cinématique
- [x] Questionnaire de fin intégré
- [x] Pipeline RAG (Notion → Supabase → embeddings → prompt enrichi)
- [x] Sync Notion → Supabase (4 bases : Characters, Storyworld, Gameplay, Vidéos)
- [x] Embeddings OpenAI (text-embedding-3-small, 1536 dim) + pgvector
- [x] Query RAG sémantique (match_embeddings)
- [ ] Sauvegarde de session
- [ ] Chunking TTS par phrase
- [ ] Video triggers dynamiques (depuis DB au lieu de hardcodés)

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | React + Vite + Tailwind + TypeScript (Lovable) |
| Backend | Lovable Cloud (Supabase Postgres + pgvector) |
| Edge Functions | proxy-llm, proxy-stt, proxy-tts, sync-notion, query-rag |
| LLM | OpenRouter API — Qwen 2.5 72B Instruct |
| STT | Deepgram (WebSocket streaming + VAD) |
| TTS | ElevenLabs (voix custom Max) |
| Embeddings | OpenAI text-embedding-3-small (1536 dim) |
| Données | Notion (source de vérité) → Supabase (miroir + embeddings) |
| RAG | query-rag Edge Function + match_embeddings SQL |

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
│   ├── services/           # deepgramSTT, elevenLabsTTS, openRouterLLM, orchestrator, ragService
│   └── types/              # Types TypeScript partagés
├── public/assets/          # Background images
├── supabase/functions/     # Edge Functions (proxy-llm, proxy-stt, proxy-tts, sync-notion, query-rag)
├── CHANGELOG.md            # Historique versionné
├── STORY.md                # Journal de développement
└── README.md               # Ce fichier
```

## 📝 Notes

- **Secrets requis** (dans Lovable Cloud) : `OPENROUTER_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `OPENAI_API_KEY`, `NOTION_API_KEY`
- Desktop only, Chrome recommandé
- Pas d'authentification — session locale
- Vidéos en mode placeholder (écran noir + texte)
- Sync Notion : 4 characters + 38 storyworld synchronisés, 42 embeddings générés

---

*Projet Memoways — Storygami*
