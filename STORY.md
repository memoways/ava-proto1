# Où est Ava ? — Development Story

> **Status**: 🟡 In Progress  
> **Creator**: Ulrich Fischer / Memoways  
> **Started**: 2026-03-07  
> **Last Updated**: 2026-03-08 (session 7)  

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

- **2026-03-08**: La persistance des réglages en localStorage seul est fragile — la double couche localStorage + DB (table admin_settings) garantit que les réglages survivent à tout contexte.
- **2026-03-08**: Le suivi des coûts LLM doit être automatique et transparent — si l'intégrateur doit penser à logguer, il oubliera. L'intégration dans openRouterLLM.ts rend le tracking invisible pour le reste du code.
- **2026-03-08**: Afficher le JSON brut de sync Notion était inutile pour le pilotage — un rapport visuel par table avec les métriques RAG (chunks, tokens) permet de comprendre instantanément l'état du contenu narratif.
- **2026-03-08**: L'API OpenRouter Generation met parfois 15-60s à indexer les coûts — un mécanisme de retry progressif est indispensable pour récupérer les vrais coûts.
- **2026-03-08**: Les environnements test et live ont des bases de données séparées — les réglages admin doivent être configurés indépendamment dans chaque environnement.
- **2026-03-08**: Le preload des caches et le warm-up des Edge Functions pendant les cinématiques est une stratégie clé — l'utilisateur ne remarque pas le chargement car il regarde la vidéo.
- **2026-03-08**: L'intégration Gumlet via iframe est la plus simple et la plus fiable — pas besoin de SDK JS custom, le player est entièrement géré côté Gumlet. Le slot `children` permet d'injecter n'importe quel overlay (HUD) sans toucher au player.

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
