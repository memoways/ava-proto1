# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

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
