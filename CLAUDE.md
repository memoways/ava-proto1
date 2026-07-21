# CLAUDE.md — Ava Proto 1 ("Où est Ava ?")

> Lis d'abord : STORY.md, README.md
> Contexte MemoWays : ~/CodeProjects/_shared/agent-context/00-memoways-context.md

## Contexte projet

Expérience narrative interactive voice-to-voice. L'utilisateur parle avec "Max" (personnage fictif, **père d'Ava** qui a disparu — ~55 ans, vit à Lausanne avec Emma). Pipeline STT → LLM → TTS. Prototype technique pour valider la mécanique avant production vidéo complète.

- Statut : 🟡 En cours (session 23 — 2026-05-24)
- Équipe : Ulrich Fischer / Memoways
- Démarré : 2026-03-07

## Plateforme de build et publication (règle obligatoire)

**Lovable est la plateforme de référence et l'unique chaîne de livraison.** Lovable compile le code et publie le site ; Lovable Cloud, avec Supabase fourni par Lovable, héberge le backend, les données, les Edge Functions et les secrets.

Toute modification effectuée hors de Lovable doit rester compatible avec Lovable et y être ramenée avant validation ou publication. Ne pas mettre en place de build, de déploiement, de projet Supabase ou d'hébergement alternatif. Avant toute action sur le build, les variables d'environnement, les migrations, les Edge Functions ou la publication, vérifier qu'elle cible Lovable / Lovable Cloud. La règle complète commune à tous les agents est dans `AGENTS.md`.

## Stack

- Plateforme : Lovable (compilation et publication)
- Frontend : React + TypeScript + Tailwind + shadcn/ui
- Backend : Lovable Cloud avec Supabase fourni par Lovable (BDD, Edge Functions, pgvector)
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
- Le joueur est **anonyme** : toute table lue au runtime doit avoir une policy RLS lisible par `anon` — un SELECT bloqué par RLS renvoie 0 ligne **sans erreur** (piège : `session_summaries` a cassé la mémoire de Max en silence, cf. `docs/analyse-coherence-max.md`). Le résumé de session se lit via le cache mémoire de `sessionMemoryService`, pas en BDD
- Le canon du personnage vit dans **Notion** (tables `characters`/`character_prompts`), pas dans le repo — vérifier la fiche avant de modifier les prompts hardcodés
- Les défauts de prompts dans `settingsService.ts` sont surchargés par `admin_settings`/localStorage : modifier un défaut n'a d'effet qu'après reset de la clé concernée dans l'admin
- Voir STORY.md §Dernière session pour l'état courant exact
