# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

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
