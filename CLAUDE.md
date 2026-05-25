# CLAUDE.md — Ava Proto 1 ("Où est Ava ?")

> Lis d'abord : STORY.md, README.md
> Contexte MemoWays : ~/CodeProjects/_shared/agent-context/00-memoways-context.md

## Contexte projet

Expérience narrative interactive voice-to-voice. L'utilisateur parle avec "Max" (personnage fictif dont la sœur Ava a disparu). Pipeline STT → LLM → TTS. Prototype technique pour valider la mécanique avant production vidéo complète.

- Statut : 🟡 En cours (session 23 — 2026-05-24)
- Équipe : Ulrich Fischer / Memoways
- Démarré : 2026-03-07

## Stack

- Outil d'origine : Lovable
- Frontend : React + TypeScript + Tailwind + shadcn/ui
- Backend : Supabase via Lovable Cloud (BDD, Edge Functions, pgvector)
- STT : Deepgram (provider par défaut + VAD) — façade multi-providers dans `src/services/stt`
- LLM : OpenRouter (multi-modèles : Qwen, Claude, Grok, Llama, Gemini)
- TTS : ElevenLabs (voix custom de Max)
- STT alternatif : Gamilab Browser SDK (préparé, pas actif), Whisper/AssemblyAI (préparés)
- Déploiement : Lovable (hébergement intégré)

## Architecture clé

- Game Master IA orchestre l'expérience (confiance, triggers vidéo, game over)
- Config STT globale persistée via `ava_stt_settings` (onglet Admin `STT Config`)
- Façade STT dans `src/services/stt` — ne pas bypass pour appels directs Deepgram
- Secrets STT exposés via Edge Function de statut uniquement (pas côté client)
- Gamilab Provider préparé via Browser SDK — coordonner avec Nicolas (CTO Gamilab) avant activation

## Règles projet

- La façade `src/services/stt` est le seul point d'entrée STT — ne jamais appeler Deepgram directement depuis les composants
- Les secrets API ne s'exposent jamais côté client — passer par les Edge Functions Supabase
- Avant d'activer Gamilab STT en prod, valider avec Nicolas Goy (kuon)
- Voir STORY.md §Dernière session pour l'état courant exact
