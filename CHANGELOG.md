# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [0.50.0] - 2026-07-30 — Streaming Avatar piloté par le texte Ava

### Ajouté
- Nouveau mode global **Avatar vidéo** dans **Admin → Technique**, avec l’onglet **Streaming Avatar Config** après **TTS Config** et les configurations non secrètes HeyGen/Tavus.
- Abstraction `ResponseOutput` et registre extensible : le parcours public choisit entre le TTS local, HeyGen LiveAvatar et Tavus sans modifier le pipeline STT/RAG/LLM.
- Chargement différé des SDK HeyGen et Daily/Tavus : le mode TTS par défaut n’embarque pas leur coût dans le chemin initial.
- HeyGen reçoit exclusivement le texte final via `avatar.speak_text` (wrapper SDK `repeat`) ; Tavus exige une persona `pipeline_mode=echo` et reçoit exclusivement `conversation.echo` en modalité texte. Les commandes conversationnelles fournisseur sont absentes.
- Flux vidéo distant plein écran, photo de Max pendant la connexion, HUD/PTT/sous-titres conservés au-dessus et session avatar maintenue silencieuse pendant les interludes.
- Edge Function Lovable Cloud `streaming-avatar-session` : identité anonyme et propriété de session obligatoires, quotas, jetons média éphémères, association vérifiée entre session Ava et session fournisseur, réponses `no-store`, fermeture idempotente et secrets uniquement côté serveur.
- Persistance du mode, du fournisseur, de l’identifiant externe, des latences connexion/première image/première parole et de la raison de repli.

### Fiabilité
- Préparation du fournisseur en parallèle de la sonnerie ; TTS conservé par défaut.
- Repli TTS sur indisponibilité ou échec avant la première parole. Une réponse partiellement prononcée n’est jamais répétée et les tours suivants passent en TTS.
- Découpage éventuel uniquement aux frontières de phrases, avec conservation caractère pour caractère du texte Ava.
- Nettoyage sur raccrochage, timeout, fin GM, redémarrage, démontage, fermeture de page et erreur fournisseur.

### Tests et exploitation
- Tests unitaires des commandes textuelles directes, de la sélection d’output, du découpage exact et du rendu vidéo ; 188 tests unitaires et build de production validés.
- **Activation Lovable Cloud requise** : migration `20260730160000_streaming_avatar_output.sql`, Edge Function `streaming-avatar-session`, puis secrets `LIVEAVATAR_API_KEY` et/ou `TAVUS_API_KEY`. Voir `docs/streaming-avatar-lovable-setup.md`.

## [0.49.0] - 2026-07-30 — Variante de prompt `rich_v2` pour Max

### Ajouté
- Nouvelle variante `MAX_PROMPT_VARIANT = "rich_v2"` (canary), à côté de `legacy` (défaut global inchangé) et `compact_v1`, sélectionnable dans **Admin → Game Master**.
- Compilation déterministe depuis `character_prompts` uniquement : `rich_v2` ne lit jamais `characters.system_prompt`.
- Découpe par sous-parties (`NOYAU`, `NUANCES`, `REPÈRES DE VOIX`, sinon paragraphes) : les nuances, contradictions psychologiques et repères de voix sont préservés au lieu d'être tronqués en milieu de phrase.
- Timeline priorisée : aujourd'hui/hier d'abord, puis le séjour de cinq jours, puis les pivots anciens.
- Profondeur : les quatre niveaux restent représentés, l'ancrage est choisi à partir du résumé de session (et non de l'avancement de l'appel).
- Contrat conversationnel dédié : une à trois phrases (quatre courtes au maximum), pas de narration, pas de rejeu de l'ouverture, pas de question deux tours de suite.
- Budgets `rich_v2` : plafond absolu 18 000 caractères, noyau statique 12 000, RAG 3 souvenirs × 900 caractères (2 700 max, sans métadonnées techniques).

### Observabilité
- La trace de tour expose désormais les sous-parties détectées/injectées, les motifs d'omission, les événements de timeline retenus et le niveau de profondeur ancré avec sa justification.
- **Admin → Personnages** : prévisualisation du noyau statique `rich_v2` (caractères par section, sous-parties incluses/omises, timeline, profondeur), en plus des prévisualisations existantes.
- Les anciennes traces sans bloc `budget` restent lisibles.

### Tests
- 17 nouveaux tests dédiés (compilateur `rich_v2`, agent, politique RAG par variante) ; 168 tests au vert et build de production validé.

## [0.48.2] - 2026-07-21 — Synthèse sémantique fiable et Laboratoire RAG fluide

### Corrigé
- La liste ne prend plus un échantillon des dernières sessions : tous les tours utilisateurs de toutes les sessions sont parcourus par pagination.
- Le regroupement lexical approximatif est remplacé par une analyse sémantique hiérarchique via OpenRouter/Gemini : chaque formulation reçoit une intention, les intentions équivalentes sont fusionnées, puis les vingt types les plus fréquents et les plus utiles sont reformulés en vraies questions autonomes.
- Le small talk, les tests micro, les remerciements, les questions sans contexte et les phrases manifestement tronquées sont exclus avant la synthèse puis contrôlés une seconde fois par le modèle.

### Performance
- Le navigateur ne télécharge plus les `conversation_log` et n’exécute plus de clustering quadratique sur le thread principal.
- Le corpus synthétique est calculé par l’Edge Function admin `rag-question-corpus`, conservé dans un cache Lovable Cloud et renvoyé immédiatement à l’interface.
- Toute modification d’une conversation ou d’une question épinglée invalide le cache par trigger. Une régénération se lance en arrière-plan au plus toutes les cinq minutes, avec bouton de régénération immédiate et suivi léger de l’état.
- Une erreur de synthèse conserve le dernier corpus valide au lieu de bloquer l’onglet.

### Observabilité et sécurité
- L’interface indique le nombre total de tours parcourus, les questions retenues, les bruits/fragments écartés, les sessions couvertes et l’état de l’analyse.
- Le corpus et sa fonction restent réservés aux administrateurs ; les secrets OpenRouter et l’historique complet ne sont jamais exposés au navigateur.
- **Déploiement Lovable Cloud requis** : migration `20260721233000_rag_lab_semantic_question_cache.sql` et Edge Function `rag-question-corpus`.

## [0.48.1] - 2026-07-21 — Corpus vivant de questions pour le Laboratoire RAG

### Ajouté
- Le Laboratoire RAG charge les questions réellement posées dans les 500 dernières sessions et présente jusqu’à 20 questions types avant la saisie manuelle.
- Les formulations proches sont regroupées localement et sans appel LLM ; la formulation réelle la plus centrale du groupe sert de question représentative. La fréquence, les variantes, les personnages concernés et la récence restent visibles.
- Détection des questions vocales sans point d’interrogation, actualisation automatique toutes les 60 secondes et bouton d’actualisation manuelle.
- Dans **Données → Sessions**, chaque question utilisateur possède une case **« Envoyer question dans le laboratoire RAG »**. Les questions ainsi épinglées remontent en priorité et peuvent être retirées avec la même case.
- Nouvelle table `rag_lab_pinned_questions`, réservée aux administrateurs par RLS et supprimée en cascade avec la session source.

### Confidentialité et performance
- Le regroupement est déterministe dans le navigateur : aucun historique supplémentaire n’est envoyé à OpenRouter ou Voyage.
- Le corpus est borné à 3 000 occurrences et 600 formulations uniques pour maintenir une actualisation fluide.

### Tests
- Couverture de la détection, de la similarité, du choix de la question représentative, du chargement UI et de l’épinglage depuis Sessions.
- Test PostgreSQL de refus participant, accès administrateur et suppression en cascade ; 140 tests unitaires et 9 tests RLS validés.
- **Migration requise dans Lovable Cloud** : `20260721210000_rag_lab_pinned_questions.sql`.

## [0.48.0] - 2026-07-21 — Laboratoire RAG par personnage

### Ajouté
- L’ancien onglet **Test Max** devient un laboratoire exclusivement consacré au RAG : choix du personnage, question, contexte récent, presets et paramètres expérimentaux isolés des réglages live.
- Visualisation du funnel complet : entrée réellement vectorisée → candidats pgvector → reranking Voyage → sélection des cinq chunks maximum injectés dans le prompt.
- Comparaison, pour chaque chunk, du rang et du score cosine avant reranking avec le rang et le score Voyage après reranking ; provenance personnage/partagé et identifiants sources conservés.
- Sélection manuelle de chunks pour prévisualiser le bloc RAG formaté et le contexte de connaissance exactement dérivé pour Max, avec copie et export JSON.
- Paramètres Voyage expérimentaux : activation du reranking, vivier `retrieve_k`, sortie `top_k`, seuil cosine, troncature et choix entre `rerank-2.5` et `rerank-2.5-lite`. Le modèle d’embedding reste verrouillé sur les vecteurs déjà indexés en 1024 dimensions.

### Simplifié
- Suppression de l’ancien pipeline UI artificiel GM → Max → validateur et de son service `maxTestPipeline`, désormais redondants avec les traces causales PRD4.
- Suppression du second écran **RAG Test** basique dans Contenu Notion : le laboratoire devient l’unique outil de test RAG.
- Conservation de l’identifiant d’URL historique `?tab=max-test` pour ne pas casser les liens existants.

### Backend et tests
- `query-rag` renvoie également le vivier vectoriel avant reranking, le rang initial, le modèle de reranking et son éventuelle erreur ; en cas d’échec Voyage, la sortie retombe proprement sur le top vectoriel demandé.
- Tests ciblés du contrat diagnostic et du parcours UI retrieval → reranking → injection ; build de production validé.
- **Déploiement requis** : redéployer l’Edge Function `query-rag` pour activer le vivier pré-reranking et le choix du modèle Voyage dans l’environnement distant.

## [0.47.1] - 2026-07-21 — Activation du diagnostic causal dans Lovable Cloud

### Déploiement
- Application effective de la migration `conversation_turn_traces` dans la base PostgreSQL Cloud de Lovable, avec `sessions.diagnostic_trace_enabled`, RLS, triggers et fonction de patch atomique.
- Redéploiement des Edge Functions `proxy-llm` et `query-rag` afin que les traces live reçoivent le payload OpenRouter exact et le `search_input` RAG effectif.
- Les sessions normales restent inchangées : aucune trace détaillée n’est écrite sans activation explicite par un administrateur.

### Validation
- L’API publiée reconnaît désormais la colonne, la table et la fonction de trace ; l’erreur `42703/PGRST204` n’est plus reproduite.
- Build de production et 26 tests ciblés (orchestrateur, prompt, RAG, mémoire et traces) validés.

## [0.47.0] - 2026-07-21 — Traçabilité causale des réponses de Max

### Ajouté
- Mode diagnostic PRD4 réservé aux administrateurs et verrouillé sur la session.
- Table RLS `conversation_turn_traces` et contrat versionné `ConversationTurnTraceV1` : mémoire injectée, RAG complet avec scores, prompt sourcé, payload OpenRouter exact, modèle/paramètres/tokens, réponse brute/diffusée, GM et latences.
- Inspecteur Admin persistant par session et tour, copie par section, export JSON et liens « Analyser ce tour » depuis Sessions.

### Fiabilité et sécurité
- Écriture causale attendue avant affichage/TTS ; un échec retire le message optimiste et permet de rejouer le même tour.
- Activation, lecture et écriture protégées côté base et proxy par le rôle admin ; suppression en cascade avec la session ; aucun secret ni en-tête d’authentification enregistré.
- Les compléments GM sont patchés atomiquement et distingués des causes de la réponse actuelle.

### Corrigé
- Sans query rewrite, le client RAG n’envoie plus un champ `query` artificiel : l’Edge Function combine réellement le message et le contexte récent et renvoie le `search_input` effectif.
- Les écrans Admin indiquent désormais que le GM pré-tour et le validateur appartiennent au simulateur et ne sont pas exécutés dans le PRD4 live.

### Tests
- Couverture orchestrateur, prompt, RAG, payload proxy, inspecteur UI et RLS PostgreSQL (non-admin, admin, cascade).

## [0.46.0] - 2026-07-20 — LLM Config : 12 modèles récents, coûts et fiches avantages/inconvénients

### Liste de modèles actualisée (`src/services/settingsService.ts`)
- Remplacement des modèles vieillissants par une sélection de 12 modèles récents et pertinents pour le voice-to-voice temps réel (Max) et l'analyse structurée (Game Master) :
  - **Fast** : Gemini 2.5 Flash, GPT-5 Mini, DeepSeek V3.1, Llama 4 Maverick.
  - **Balanced** : GPT-4o, Claude Sonnet 4, Grok 4, Grok 3, Mistral Large 2411.
  - **Premium** : Gemini 2.5 Pro, GPT-5, Claude Opus 4.1.
- Conservation des modèles effectivement utilisés jusqu'ici (Gemini 2.5 Flash, Gemini 2.5 Pro, GPT-4o, Claude Sonnet 4, Grok 3) ; les anciens modèles obsolètes (Qwen, Llama 3.1, GPT-4o Mini, Grok Mini, Grok 2, Mistral Large legacy) sont mappés vers les nouveaux équivalents via `DEPRECATED_OPENROUTER_MODELS`.
- Chaque modèle expose désormais : tier (`fast`/`balanced`/`premium`), coûts input/output au million de tokens, description et liste d'avantages/inconvénients.

### Interface Admin — cartes de modèles détaillées (`src/components/LLMConfigTab.tsx`)
- Remplacement des simples boutons de sélection par des `ModelCard` enrichies.
- Badge de tier visuel (Rapide / Équilibré / Premium) avec icône et couleur.
- Coûts input/output affichés en permanence sous chaque modèle.
- Toggle "Détails" par modèle qui déploie deux colonnes : avantages (✓) et inconvénients (✗), pour choisir le modèle en connaissance de cause.
- Sélection indépendante pour Max et pour le Game Master, avec un état d'expansion séparé pour chaque section.

### Compatibilité et corrections
- Mapping des anciens identifiants de modèles sauvegardés dans `admin_settings` et `localStorage` vers les nouveaux modèles, sans casser les réglages existants.
- Correction d'une erreur de build dans `src/services/tts/gradiumStreamPlayer.ts` : remplacement de `buffer.copyToChannel(samples, 0)` par `buffer.getChannelData(0).set(samples)` pour garantir la compatibilité TypeScript du lecteur streaming Gradium.

### Fichiers
- `src/services/settingsService.ts`, `src/components/LLMConfigTab.tsx`, `src/services/tts/gradiumStreamPlayer.ts`.

## [0.45.1] - 2026-07-17 — Latence Gradium : diagnostic streaming + découpage phrase-à-phrase

> Suite au test réel de la 0.45.0 : le streaming WebSocket ne s'activait jamais (encore ~7s). Cause : l'edge function `proxy-tts-gradium` n'avait pas été **redéployée**, donc le GET de mint de token tombait sur l'ancien chemin POST (`await req.json()` sur un body vide → `500 {"error":"Unexpected end of JSON input"}`) → fallback REST à chaque tour. **Action requise : redéployer `proxy-tts-gradium`.**

### Observabilité du WebSocket (`gradiumStreamPlayer.ts`)
- En cas d'échec WS *après* redeploy, la console indique désormais précisément la cause : `code`/`reason` du `onclose`, type du premier frame reçu (`ready`/`error`/`audio`), frame non-JSON — au lieu d'un « connection error » générique. Réduit le debug à un seul aller-retour.

### Découpage phrase-à-phrase spécifique Gradium
- `chunkTextForTTS(text, opts?)` accepte des seuils optionnels (`maxSingleChars`/`targetChars`) ; défauts inchangés (900/600) → **ElevenLabs et les autres providers strictement préservés**.
- `IndexPRD4` passe des seuils fins (~160) **uniquement quand Gradium est actif** : une réponse de plusieurs phrases démarre sur un 1er morceau court (REST ~2-3s, ou WS immédiat) pendant que la suite se génère (concurrence 2 déjà en place). Filet de latence même si le WS échoue.

### Tests
- Nouveau `textChunking.test.ts` (4 cas) : découpage fin Gradium, comportement par défaut préservé, réponses courtes non découpées. Suite complète 129 verts.

## [0.45.0] - 2026-07-17 — Latence TTS Gradium : streaming WebSocket + lecture progressive

> Audit : Gradium était ~2x plus lent qu'ElevenLabs parce que son proxy attendait la **totalité** de l'audio (`arrayBuffer()`) en **WAV non compressé** (~768 kbps), là où ElevenLabs streame du mp3 en chunked. Aucun fichier ElevenLabs n'est touché.

### Streaming WebSocket Gradium (lecture progressive)
- Le navigateur minte un token éphémère (GET `proxy-tts-gradium`, même pattern que le STT Gradium) et ouvre `wss://api.gradium.ai/api/speech/tts` en direct : les chunks PCM base64 sont décodés et planifiés sur l'AudioContext partagé — **la voix démarre au premier chunk** au lieu d'attendre la génération complète (`src/services/tts/gradiumStreamPlayer.ts`).
- Intégration `TTSQueue` via une capacité optionnelle `createStreamingPlayback` (gate de lecture : la phrase N+1 se génère/bufferise pendant que N joue, ordre strict préservé) ; providers sans streaming inchangés octet pour octet.
- **Fallback REST automatique** si le WS échoue avant le premier son (token, connexion, timeout) — jamais de re-lecture partielle après coup. Barge-in : l'AbortSignal ferme le WS et stoppe toutes les sources audio.
- Toggle admin « Streaming WebSocket » (actif par défaut) + format `pcm_24000`/`pcm_48000` + bouton « Tester streaming » dans TTS Config.
- Télémétrie inchangée côté dashboards (`audio_latency`), enrichie de `metadata.transport` (`websocket`/`rest_fallback`) pour comparer avant/après.

### Chemin REST accéléré (fallback + ligne d'ouverture)
- Le proxy `proxy-tts-gradium` pipe désormais `response.body` en chunked au lieu de bufferiser tout l'audio.
- Format par défaut `wav` → `opus` (~6x moins d'octets), migration `settingsVersion` des réglages stockés, bascule auto sur WAV si le navigateur ne lit pas l'Ogg/Opus (Safari < 18.4).

### Tests
- Nouveau test `TTSQueue` : lecture séquentielle des handles streaming (ouverture des gates dans l'ordre). Suite complète 125 verts.

## [0.44.1] - 2026-07-17 — Proposition éditoriale fiche Max + ajustement du bloc temporel

### Proposition — champs du master prompt de Max
- Nouveau document `docs/proposition-fiche-max.md`, basé sur l'export complet de la fiche Notion « Max Lorenzo » : diagnostic de 6 problèmes (chronologies contradictoires Timeline vs blocs RAG, incitation aux questions dans le champ des règles absolues, longueur « 2 à 6 phrases » vs plafond tokens, absence de drive, absence de règles de persistance, bloc RAG manquant pour la soirée du jour 3) et textes de remplacement prêts à coller, champ par champ, avec tableau de correction des ancres temporelles.

### Bloc temporel — formulation neutre
- Le libellé de début d'appel du bloc « OÙ EN EST L'APPEL » ne présume plus de la méfiance (« la méfiance est naturelle ») : la fiche de Max établit au contraire une confiance d'emblée. Nouveau libellé : « installe la relation conformément à ta fiche personnage » (`maxAgent.ts::buildTemporalContextBlock`).

### Fichiers
- `docs/proposition-fiche-max.md`, `src/agents/maxAgent.ts`, `docs/implementation-coherence-max.md`.

## [0.44.0] - 2026-07-17 — Cohérence de Max : mémoire réparée, présent temporel, Game Master actif léger

> Diagnostic complet : `docs/analyse-coherence-max.md`. Détail d'implémentation : `docs/implementation-coherence-max.md`.

### Mémoire de session réparée (bug RLS silencieux)
- La migration `20260712150404` réservait le SELECT sur `session_summaries` aux admins ; le joueur anonyme recevait 0 ligne **sans erreur**. Le bloc « SOUVENIRS DE LA SESSION » n'était donc jamais injecté dans le prompt de Max (amnésie au-delà des 10 derniers messages ≈ 5 échanges) et la re-summarisation LLM se déclenchait à chaque tour dès le tour 4.
- Correctif sans toucher à la sécurité : `summarize-session` renvoie déjà `{summary, last_turn}` — mise en cache mémoire côté client (`sessionMemoryService`), lue avant la BDD (fallback conservé pour l'admin/banc d'essai).

### Présent temporel de Max
- Nouveau bloc « OÙ EN EST L'APPEL » dans le system prompt : durée écoulée, numéro de tour, phase d'appel (début/milieu/fin) avec consigne d'usage implicite. Max n'avait jusqu'ici **aucun** repère temporel (seul le GM les recevait).

### Game Master actif léger (boucle GM→Max)
- Le `next_turn_guidance` produit par le GM post-tour (auparavant calculé puis jeté) est désormais rebouclé : mémorisé au tour N, injecté au tour N+1 via le bloc « CONSEIL DE MISE EN SCÈNE », avec le cumul dédupliqué des sujets déjà couverts. Consommation one-shot (une guidance périmée ne survit pas à son tour), fiche personnage explicitement prioritaire, zéro appel LLM supplémentaire.

### Règles de style unifiées
- Retrait des incitations aux questions (« poser une question de contrôle », « questions qui testent l'autre ») qui contredisaient la règle « ne pose pas systématiquement de questions » ; longueur harmonisée à 1-2 phrases / 45 mots partout (y compris le prompt de fallback). ⚠️ Nécessite un reset des clés `ava_max_prompt_control_settings` / `ava_gm_prompt_settings` dans l'admin si elles ont déjà été sauvegardées.

### Canon documentaire
- `CLAUDE.md` et `STORY.md` corrigés : Max est le **père** d'Ava (~55 ans, Lausanne, avec Emma) — le pitch initial « frère développeur 28 ans » est marqué comme archive. Nouvelles règles projet : piège des SELECT RLS silencieux pour le joueur anonyme, canon personnage dans Notion, défauts de prompts surchargés par `admin_settings`.

### Tests
- 16 nouveaux tests unitaires (cache de résumés, blocs temporel et guidance, transmission orchestrateur, non-re-summarisation) ; suite complète 119 verts.

### Fichiers
- `src/services/sessionMemoryService.ts`, `src/agents/maxAgent.ts`, `src/services/prd4Orchestrator.ts`, `src/pages/IndexPRD4.tsx`, `src/services/settingsService.ts`, `CLAUDE.md`, `STORY.md`, `docs/analyse-coherence-max.md`, `docs/implementation-coherence-max.md`.

## [0.43.3] - 2026-07-16 — Gradium STT en temps réel par WebSocket et parsing JSON Game Master renforcé

### Gradium STT — temps réel et latence réduite
- Passage du mode batch REST au streaming WebSocket natif (`wss://api.gradium.ai/api/speech/asr`).
- Le proxy Edge Function expose désormais un endpoint `GET` qui mint un token Gradium à usage unique et à durée courte, gardant la clé API côté serveur.
- Le provider navigateur ouvre un WebSocket, envoie la configuration `setup` (modèle `default`, format PCM, langue depuis les réglages STT Gradium), puis stream les chunks audio en PCM 16 bits mono depuis un `AudioContext` à 24 kHz.
- Les messages `text` partiels (`isFinal=false`) sont envoyés au fur et à mesure à l'orchestrateur, ce qui rend la transcription visible pendant que l'utilisateur parle. Le message final marque `isFinal=true`.
- Les segments `final` et `text` sont réassemblés avec gestion d'ordre ; les segments orphelins sont concaténés en fin de flux pour ne rien perdre.
- Les autres providers STT (Deepgram, Gamilab, Whisper, AssemblyAI) sont strictement préservés : les modifications sont isolées à Gradium.

### Game Master — extraction JSON robuste
- Les évaluations post-tour (`gameMasterPRD4.ts`) et l'extraction de labels (`gameMasterLabelPRD4.ts`) ajoutent un parseur `jsonObjectCandidates` qui balaie la réponse LLM pour trouver tous les objets JSON équilibrés, en ignorant le texte autour et les faux débuts de chaîne.
- Corrige les erreurs de parsing JSON intermittentes lorsque le LLM renvoie du JSON valide noyé dans des explications ou des fragments de markdown.

### Fichiers
- `src/services/stt/providers/gradiumSTT.ts`, `supabase/functions/proxy-stt-gradium/index.ts`, `src/agents/gameMasterPRD4.ts`, `src/agents/gameMasterLabelPRD4.ts`.

## [0.43.2] - 2026-07-16 — Valeurs par défaut du dictionnaire, ordre des tabs, tooltips TTS et conversion Gradium STT

### Dictionnaire STT
- Les valeurs par défaut du dictionnaire global sont désormais : Protogyne, Max, Emma, Léo, Ava, Mona, Peter, Anne, Agotha, Philippe, Karine.
- L'ordre des onglets dans Admin > Technique est ajusté : STT Config, LLM Config, TTS Config.

### TTS Config — tooltips et extrêmes explicites
- Ajout d'infobulles sur chaque réglage TTS pour expliquer l'effet produit et différencier les deux extrêmes du slider.
- ElevenLabs : stabilité (expressif ↔ stable), similarité boost (neutre ↔ proche du clone), style (naturel ↔ théâtral), vitesse, latence, speaker boost.
- Inworld : speaking rate, temperature, delivery mode (stable/balanced/creative).
- Hume : précisions sur le format audio et les codes langue.
- Gradium : temperature (déterministe ↔ très créatif), voice similarity (générique ↔ très fidèle), padding bonus (rapide ↔ lent) ; note explicative indiquant que `mp3` n'est pas supporté.

### STT Gradium — conversion WAV 16 kHz mono
- Gradium STT requiert un format audio `audio/wav`, `audio/pcm` ou `audio/ogg`, mais le navigateur enregistre en `webm/opus`. Le provider convertit désormais le blob enregistré en WAV 16 kHz mono 16 bits via `AudioContext` avant l'envoi au proxy.

### Fichiers
- `src/services/stt/dictionary.ts`, `src/pages/Admin.tsx`, `src/components/TTSConfigTab.tsx`, `src/services/stt/audioToWav.ts`, `src/services/stt/providers/gradiumSTT.ts`.

## [0.43.1] - 2026-07-16 — Dictionnaire STT, réglages par provider et correction Gradium TTS

### TTS Gradium
- Gradium retournait un corps vide pour le format `mp3`, ce qui provoquait `Audio playback failed` ; le format par défaut passe à `wav` et le proxy remplace `mp3` par `wav` côté serveur.
- L'ID de voix Max (`b5ioHAR7JuHVLskk`) est intégré au provider Gradium.

### STT — dictionnaire custom et réglages par provider
- Nouveau dictionnaire custom global (`ava_stt_dictionary`) pour privilégier les noms propres et le jargon de l'univers AVA (Max, Ava, Protogyny, MemoWays, etc.) lors de la transcription.
- Le dictionnaire est injecté automatiquement dans les providers compatibles : Deepgram (`keyterm`), AssemblyAI (`keyterms_prompt`), OpenAI Whisper (`prompt`). Gradium et Gamilab ne l'utilisent pas ; l'interface affiche explicitement ✓ ou ✗ par provider.
- Onglet Admin STT Config : le dictionnaire est désormais visible en haut de page avec un compteur de termes, une zone de saisie texte et une réinitialisation aux valeurs par défaut.
- Nouveaux réglages API par provider, persistés dans `admin_settings.ava_stt_provider_settings` et consommés par le runtime STT :
  - Deepgram : modèle, langue, smart formatting, ponctuation, résultats intermédiaires, VAD, endpointing, utterance end, filler words, numéraux.
  - AssemblyAI : format turns, silence de fin de tour et seuil de confiance.
  - OpenAI Whisper : modèle, langue, température.
  - Gradium : langue.
  - Gamilab : section grisée, non configurable.

### Fichiers
- `src/components/STTConfigTab.tsx`, `src/components/stt/ProviderSettingsPanel.tsx`, `src/services/stt/dictionary.ts`, `src/services/stt/providerSettings.ts`, `src/services/stt/registry.ts`, `src/services/stt/types.ts`, `src/services/deepgramSTT.ts`, `src/services/stt/providers/assemblyaiSTT.ts`, `src/services/stt/providers/openaiWhisperSTT.ts`, `src/services/stt/providers/gradiumSTT.ts`, `supabase/functions/proxy-stt-whisper/index.ts`, `supabase/functions/proxy-stt-gradium/index.ts`, `src/services/tts/providerSettings.ts`, `src/services/tts/providers/gradium.ts`, `supabase/functions/proxy-tts-gradium/index.ts`.

## [0.43.0] - 2026-07-16 — Qualité STT, finalisation sans coupure et vidéos toujours sonores

### STT Deepgram — qualité et réactivité (Lovable)
- Le proxy Deepgram utilise désormais `nova-3` par défaut et accepte `DEEPGRAM_MODEL` / `DEEPGRAM_LANGUAGE` pour surcharger le modèle et la langue sans modifier le frontend ; la télémétrie reflète ce nouveau défaut.
- Capture micro mono 48 kHz avec annulation d'écho, réduction de bruit et gain automatique pour améliorer la qualité du signal envoyé au STT.
- Le WebSocket active explicitement ponctuation, nombres, suppression des filler words, smart formatting et résultats intermédiaires.
- `MediaRecorder` envoie des blocs toutes les 150 ms au lieu de 250 ms, avec un débit cible de 128 kb/s, afin de réduire la latence du texte live sans dégrader la fin des mots.

### STT multi-provider — aucune queue de phrase abandonnée
- Le contrat commun `STTSession.flush()` est désormais asynchrone : le pipeline attend que le provider ait préservé la dernière donnée audio et la dernière révision de texte avant de lancer RAG/LLM/TTS.
- Deepgram demande le dernier bloc `MediaRecorder`, envoie le contrôle officiel `Finalize`, attend la réponse révisée puis combine la partie finalisée et la queue encore interim. Le précédent `fullTranscript || latestInterimTranscript` pouvait supprimer la fin de phrase.
- AssemblyAI conserve le transcript courant complet et envoie `ForceEndpoint`; Gamilab conserve à la fois `text_current` et `text_history` et utilise la version la plus complète.
- Gamilab ignore désormais ses placeholders d'activité composés uniquement de points/ellipses, reconstruit `text_history + text_current` et réémet le transcript complet à chaque amélioration dynamique au lieu de remplacer la parole par `« … … … »`.
- OpenAI Whisper et Gradium attendent le dernier événement `dataavailable`, figent l'enregistrement puis transcrivent le blob complet.
- Le mode manuel PTT empêche AssemblyAI et Gamilab d'envoyer prématurément un tour sur une détection de silence. Les écrans conversation, rôle et posture affichent un état de finalisation et bloquent un second clic ou une validation trop précoce.
- Le texte utilisateur reste visible en entier pendant la capture, la finalisation, la réflexion et la réponse de Max ; l'écran utilise le live cumulatif puis le dernier message utilisateur finalisé sans phase vide.
- La factory STT instancie maintenant réellement OpenAI Whisper et AssemblyAI lorsqu'ils sont sélectionnés et configurés ; auparavant ces choix retombaient silencieusement sur Deepgram.
- La métadonnée de l'overlay n'annonce plus l'ancien `nova-2` codé en dur : le proxy et le frontend partagent désormais la même source de vérité `nova-3` / `fr`, tout en respectant une surcharge serveur explicite. Le runtime journalise le modèle et la langue réellement demandés sans exposer le token temporaire.
- Le badge STT mesure la durée complète du geste de parole, du clic « Démarrer » à la finalisation ; il ne doit pas être interprété comme une latence réseau Deepgram. Les métriques persistées continuent de séparer la latence de service.

### Réponse Max — le STT n'est plus accusé à tort
- L'analyse de la capture Deepgram a montré que le WebSocket s'était connecté et fermé normalement ; le message « la ligne accroche » provenait du timeout LLM. Le budget global de 5 s laissait seulement ~2,8 s à Max après un RAG de 2 s.
- Max conserve désormais une fenêtre de génération de 8 s dans un budget de tour de 11 s. Un test simule un RAG bloqué pendant 2 s puis une réponse LLM en 3,5 s et interdit le fallback trompeur.

### Vidéos Gumlet — fin fiable et audio systématique
- Lovable a élargi la détection de fin Gumlet (`ended`, `complete`, `finish`) et ajouté un fallback temporel à moins de 0,4 seconde de la durée lorsque l'embed n'émet pas `ended`, garantissant le retour automatique à la conversation.
- L'investigation finale confirme que Gumlet force l'audio muet pour l'autoplay de son iframe et peut donc réafficher sa propre gate « Activer le son ». Le parcours ne rend désormais plus aucune iframe vidéo et la dépendance Player.js est retirée.
- Les URLs Gumlet `watch/embed` sont toutes converties en manifestes HLS directs. Safari utilise son décodage HLS natif ; Chrome et Firefox passent par `hls.js`.
- Un unique élément `<video>` est monté avant l'accueil puis conservé pendant toute l'expérience. Le clic initial « Commencer » applique synchroniquement `muted=false`, `volume=1` et `play()` avant l'authentification ; les interludes changent seulement la source de cet élément déjà autorisé et démarrent sans nouveau clic.
- Le lecteur garde `autoplay`, `playsInline` et aucun contrôle navigateur. Une remise en sourdine pendant une lecture active est immédiatement corrigée, sans écran ni bouton Play intermédiaire.
- Correctif post-publication : Chromium/Brave peut retourner `"maybe"` pour `canPlayType(application/vnd.apple.mpegurl)` tout en terminant avec `MediaError.code=4`. La sélection donne désormais la priorité à `Hls.isSupported()` ; le HLS natif n'est utilisé qu'en fallback. « Commencer » attend `MANIFEST_PARSED`, supprimant les appels `play()` sans source supportée.
- Le clic « Passer » effectue un hard-stop avant la transition : mute/pause/retour à zéro, destruction de l'instance HLS et suppression de la source. Un compteur de génération empêche une ancienne promesse `play()` de relancer le média après le skip.
- Les identifiants Gumlet doivent maintenant être des IDs hexadécimaux complets de 24 caractères ; une URL invalide ne peut plus être partiellement transformée en faux manifeste HLS.

### Compound engineering — gates anti-régression
- Nouveau contrat exécutable `docs/core_experience_regression_contract.md` pour les invariants STT, transcription visible, budget Max, autoplay audio et arrêt sur « Passer ».
- Nouvelles commandes `test:regression`, `test:unit` et `test:quality` ; la gate critique couvre séparément Deepgram, Gamilab, finalisation, métadonnées, orchestration, audio et vidéo.
- Workflow GitHub Actions sur chaque pull request et push `main` : installation reproductible, tests critiques et unitaires, build de production, puis six parcours Playwright. Les deux contrats média exigent désormais l'absence d'iframe, un unique nœud vidéo conservé du teaser à l'interlude, `playing=true/muted=false/volume=1` après démarrage et un arrêt observé avant la transition « Passer ».

### Dépendances
- `bun.lock` resynchronisé avec les dépendances déclarées : hCaptcha présent, PostHog résolu sur la branche récente compatible et ancienne chaîne OpenTelemetry/protobuf inutilisée retirée du lockfile.

### Validation
- 101 tests unitaires locaux verts, dont les cas de conservation préfixe finalisé + queue interim, absence de duplication d'un transcript cumulatif, isolation Gamilab/Deepgram, modèle Deepgram effectif et budget Max après RAG.
- 28 tests de régression critiques verts, six scénarios Chromium complets et quatre variantes média Firefox/WebKit vertes. Les parcours couvrent le même lecteur du teaser à l'interlude, l'autoplay sonore, l'arrêt sur skip et l'endurance 35 tours.
- Un smoke test supplémentaire sans mock sur le vrai manifeste Gumlet confirme sous Chromium `currentSrc=blob:`, `readyState=4`, durée 77 s, progression réelle, `muted=false`, volume `1` et aucune erreur média.
- Build Vite de production et lint ciblé des fichiers modifiés verts ; `git diff --check` sans erreur.
- Manifeste HLS du teaser vérifié en HTTP 200 avec piste audio AAC dédiée.

## [0.42.0] - 2026-07-15 — Sécurité, RAG Voyage et routage LLM unifié

### Sécurité
- Nouveau garde-fou `requireAdmin` (`supabase/functions/_shared/adminAuth.ts`) : `sync-notion` et `update-notion-video` exigent un JWT avec rôle `admin`. Les clients (services RAG, videoTrigger, Admin) transmettent désormais `Authorization: Bearer` systématiquement.
- `proxy-stt` génère un token Deepgram temporaire (TTL 60s) au lieu d'exposer la clé maîtresse ; `proxy-stt-config` ne renvoie plus le secret Gamilab.
- `proxy-llm` durci contre l'usage en proxy ouvert (allow-list de modèles, plafond 60 messages, 4000 tokens et 60k caractères).
- Migration DB : fonction `has_role` déplacée du schéma `public` vers `private`, retrait de la politique DELETE permissive sur `embeddings`, accès `admin_settings` restreint au rôle `admin` (les joueurs anonymes ne voient que les clés runtime `ava_%`).
- 20 findings de sécurité corrigés au total sur les deux passes de scan.

### RAG Voyage
- Correction de l'onglet Admin > RAG : la requête de test passait via `fetch` brut et échouait sur `Invalid game identity` ; elle utilise désormais `authenticatedFunctionFetch` (JWT admin). Le flux public utilisait déjà l'identité de jeu et n'était pas impacté.
- Refonte de `PipelineSchema` (Admin > Pipeline) pour refléter l'architecture réelle : STT multi-provider, rewrite → RAG (embed voyage-3 → pgvector → rerank rerank-2.5, fallback OpenAI), Max/GM/validateur, TTS multi-provider.

### Routage LLM unifié
- Migration de `rewrite-query` et `summarize-session` depuis Lovable AI Gateway vers OpenRouter (`google/gemini-2.5-flash`). 100% des appels LLM du prototype passent désormais par OpenRouter, ce qui unifie le suivi de coûts via `llm_usage`.
- Voyage reste indépendant pour les embeddings et le rerank.

### Déploiement
- Redéploiement des 17 Edge Functions à partir du commit `9a90300` sur Lovable Cloud (toutes ✅), puis redéploiement de `rewrite-query` et `summarize-session` après migration OpenRouter.

## [0.41.2] - 2026-07-13 — Télémétrie interne continue

### Modifié
- Le panneau d'information voix/analytics est masqué pendant les tests internes. Il reste versionné et se réactive pour l'expérience finale avec `VITE_PRIVACY_NOTICE_ENABLED=true` dans Lovable.
- En mode interne, PostHog et Grain démarrent automatiquement ; un ancien refus local ne peut plus désactiver les mesures de la campagne.
- Les événements déclenchés pendant le chargement asynchrone de PostHog sont mis en attente puis rejoués dans l'ordre, avec une limite mémoire de 200 opérations.
- `$pageview`, `$pageleave`, les événements PRD4, les latences, erreurs techniques et résultats de persistance restent mesurés. Les secrets sont caviardés et les transcriptions/réponses libres restent exclues.
- La session pseudonyme est utilisée comme identifiant PostHog après sa création, sans profil personne persistant, autocapture ni session replay.

### Corrigé
- Mise à jour ciblée de `posthog-js` de `1.372.1` à `1.399.4`, supprimant la chaîne OpenTelemetry vulnérable et évitant une file d'envoi bloquée après opt-in.

### Validation
- Tests dédiés des doubles écritures PostHog + Supabase pour `turn_latencies`, `audio_latencies`, `voice_turn_events` et `voice_error_events`.
- Parcours Playwright confirmant que le panneau est absent, que le bouton reste utilisable et qu'une requête PostHog quitte réellement le navigateur.

## [0.41.1] - 2026-07-13 — Résilience ElevenLabs 429

### Corrigé
- Les réponses ElevenLabs `429 system_busy`, `rate_limit_exceeded` et `concurrent_limit_exceeded` sont reconnues dans le payload imbriqué puis rejouées une seule fois après un délai court avec jitter.
- Les erreurs permanentes de crédits, droits ou paramètres ne sont jamais rejouées.
- La génération TTS est plafonnée à deux segments simultanés, tout en conservant l'ordre de lecture.
- Après l'échec du retry, le texte reste disponible et un message utilisateur explique que seule la voix est temporairement indisponible.

### Observabilité
- Les mesures TTS enregistrent `retry_count` et le code fournisseur structuré, sans recopier le corps d'erreur complet.

### Validation
- Tests unitaires du parsing `system_busy`, du retry unique, de l'absence de retry sur crédits et de la concurrence maximale.
- Parcours Playwright `429 → retry → audio` vert, ainsi que le TTS long et l'endurance de 35 tours.
- Aucun changement de secret, de durée admin, de voix active ou d'Edge Function.

## [0.41.0] - 2026-07-13 — Phase 4 protections pré-public

### Confidentialité
- Information vocale et conservation pseudonyme obligatoires avant le démarrage ; choix analytics distinct, facultatif et modifiable depuis `/confidentialite`.
- PostHog et Grain ne démarrent plus avant opt-in. Autocapture, replay, cookies persistants, profils et propriétés de texte libre sont exclus.
- Le SDK tiers Gamilab est chargé seulement après l'information obligatoire, puis préchauffé pendant le teaser pour ne pas dégrader le premier push-to-talk.

### Sécurité
- Intégration hCaptcha conditionnelle pour les identités Supabase anonymes ; l'absence de site key conserve le parcours interne actuel.
- Création publique de comptes admin retirée de `/auth` ; seuls les comptes sur invitation peuvent se connecter.
- Langue du document corrigée et politique `no-referrer` appliquée.

### Validation
- Tests unitaires du consentement, de l'opt-in/opt-out PostHog, du filtrage du texte libre et de la preuve CAPTCHA.
- Parcours Playwright adaptés à l'information vocale obligatoire.
- Runbook Lovable/Supabase avec ordre d'activation, rollback, rétention et headers.

### Sans changement
- La durée reste entièrement pilotée par `TIMEOUT_SECONDS` dans le slider admin.
- La release gate reste fermée jusqu'à l'activation et aux preuves externes du runbook.

## [0.40.0] - 2026-07-13 — Phase 3 canary interne

### Corrigé
- La durée de l'expérience n'est plus doublée par une constante de 15 minutes : le timer, la clôture Game Master et la persistance utilisent `TIMEOUT_SECONDS`, chargé depuis le slider admin avant la conversation.
- Le prompt Game Master et le résumé de session ne supposent plus une durée fixe.

### Ajouté
- Décision canary déterministe avec trois états : promotion, attente ou rollback.
- Seuils internes : 5 sessions, 30 tours, p95 premier son à 5 secondes, erreurs à 2 % et persistance à 99,5 %.
- Événement `prd4_persistence_result` couvrant les opérations critiques et runbook de canary/rollback.

### Confidentialité
- Autocapture et session replay PostHog désactivés ; les événements de performance explicitement conçus restent actifs.

### Activation restante
- Publier sur Lovable en restant privé, redéployer `summarize-session`, exécuter le canary interne et approuver le budget maximal par session.

## [0.39.1] - 2026-07-13 — Lecture TTS complète

### Corrigé
- Le watchdog de 15 secondes est arrêté dès que la première lecture audio démarre ; il ne coupe plus une réponse longue en cours de lecture.
- La fin normale du TTS est pilotée par l'événement média `ended`, y compris lorsque la réponse dépasse 15 ou 20 secondes.
- Un détecteur de stagnation distinct conserve la récupération automatique si la position de lecture n'avance plus pendant 15 secondes.

### Validation
- Test unitaire d'une lecture progressive simulée de 25 secondes, sans interruption.
- Test unitaire d'un média réellement figé, correctement arrêté après le délai de stagnation.
- Parcours Playwright reproduisant une réponse plus longue que le watchdog, lue entièrement sans appel à `pause()`.

---

## [0.39.0] - 2026-07-13 — Phase 2 fluidité et endurance 15 minutes

### Ajouté
- Contrat runtime centralisé : session de 15 minutes, clôture Game Master après 12 minutes minimum, budget de réponse de 5 secondes et watchdog de première voix de 15 secondes.
- Mémoire conversationnelle bornée à 10 messages récents, complétée par le résumé persistant de la session.
- Compte à rebours visible pendant la conversation et tests d'endurance orchestrateur/navigateur.

### Modifié
- RAG et résumé chargés en parallèle avec soft timeouts ; le LLM utilise uniquement le budget restant du tour.
- Chaque tour, appel LLM et génération TTS est annulable ; une réponse obsolète ne peut plus modifier l'interface.
- Le prompt de résumé de session est aligné sur une expérience de 15 minutes.

### Corrigé
- Course push-to-talk où la fermeture différée de l'ancien STT pouvait interrompre une nouvelle prise de parole.
- Croissance et duplication de l'historique OpenRouter au fil de la session.
- Blocage possible du bouton de parole après une panne RAG, LLM ou TTS.

### Validation
- TypeScript, build de production et suite Vitest complète verts.
- 30 sessions de 35 tours, soit 1 050 tours orchestrateur simulés, sans désordre ni contexte non borné.
- Deux parcours Playwright verts : 3 tours nominalement et 35 tours avec pannes RAG/LLM/TTS injectées.
- Lint des fichiers modifiés vert ; dette lint globale historique conservée hors périmètre.

### Activation restante
- Publier le frontend Lovable, redéployer `summarize-session`, puis effectuer une session réelle de 15 minutes avec relevé p50/p95.

---

## [0.38.0] - 2026-07-12 — Phase 1 sécurité sessions et fournisseurs

### Ajouté
- Identité Supabase anonyme transparente pour le parcours public, sans formulaire ni collecte de PII.
- Ownership RLS des sessions via `user_id = auth.uid()` et protection des champs administratifs.
- Quotas PostgreSQL atomiques par utilisateur pour STT, LLM, TTS, RAG, résumés et synchronisation Notion.
- Garde Edge partagée retournant `401`, `429` avec `Retry-After`, ou `503` en cas d'indisponibilité du contrôle.

### Modifié
- L'activation des JWT/quota Edge est contrôlée par `GAME_SECURITY_ENFORCED`; elle reste désactivée par défaut pour permettre un déploiement Lovable sans coupure.
- L'authentification frontend est contrôlée par `VITE_GAME_SECURITY_ENABLED` et s'active après la migration d'expansion.
- Tous les appels frontend correspondants transmettent le vrai access token Supabase ; la clé publique n'est plus utilisée comme faux Bearer token.
- Les résumés de session et questionnaires vérifient en plus l'appartenance de la session.
- Le passage de la vidéo d'introduction ouvre directement la sélection des quatre personnages ; l'écran de dictée préalable est retiré du parcours.

### Corrigé
- Le contrat Gamilab attendu par le SDK (`portalId` + token) est restauré en mode interne avec réponse `no-store`.
- L'échec Deepgram `403` est expliqué comme un manque de permission **Member** sur la clé utilisée pour générer les jetons temporaires.
- Le WebSocket Deepgram authentifie désormais ces jetons temporaires avec le schéma `Bearer` au lieu du schéma `Token` réservé aux clés API.
- La migration Phase 1 est divisée en étapes expansion/verrouillage afin d'éviter une interruption pendant le déploiement Lovable.

### Validation
- 59 tests Vitest verts, dont cinq preuves PostgreSQL RLS/ownership/quota.
- Build et TypeScript verts.
- Garde partagée incluse dans 17 Edge Functions redéployées sur Lovable Cloud.
- Parcours Playwright de trois tours vert localement et sur le bundle servi par `proto1.parle-a-ava.com` avec les fournisseurs simulés.
- Migration de verrouillage appliquée : clé publique seule `401`, identité anonyme `201`, quota atomique `429` après 60 appels.
- Smoke tests fournisseurs réels verts après enforcement : Deepgram, Gamilab, OpenRouter, RAG Voyage et ElevenLabs.

---

## [0.37.1] - 2026-07-12 — Phase 0 de stabilisation pré-public

### Ajouté
- **Release gate publique** — le projet est explicitement classé « interne uniquement » jusqu'à validation des critères de septembre 2026.
- **Test E2E Playwright** — parcours PRD4 complet avec onboarding vocal simulé et trois tours de conversation, sans appel fournisseur réel.
- **Test PostgreSQL RLS isolé** — reproduction PGlite des policies `sessions`, démontrant que `INSERT ... RETURNING` échoue et qu'un `UPDATE` anonyme touche zéro ligne sans policy `SELECT`.

### Corrigé
- **Baseline npm reproductible** — `package-lock.json` resynchronisé avec `@gumlet/player.js` et `hls.js`.
- **Suite Vitest** — attentes STT/TTS/Gumlet alignées avec le runtime actuel ; mocks de l'orchestrateur complétés pour éliminer les rejets asynchrones cachés.
- **Setup de tests** — compatible avec les environnements Vitest `jsdom` et `node`.

### Validation
- `npm run build` : OK.
- `npx tsc --noEmit` : OK.
- `npm test` : 47 tests unitaires verts avant ajout du test RLS.
- `npm run test:rls` : 2 preuves RLS vertes, confirmant le stop-ship persistance.
- `npm run test:e2e` : parcours de trois tours ajouté et exécuté localement avec Chromium.

### Stop-ship restant
- Le contrat de persistance anonyme `sessions` doit être redessiné en phase 1. Aucune policy `SELECT USING (true)` n'a été ajoutée pour masquer le problème.

---

## [0.37.0] - 2026-07-12 — Auth admin + hardening RLS

### Ajouté
- **Authentification admin (Supabase Auth)** — page `/auth` avec formulaire email/mot de passe. Seuls les utilisateurs possédant le rôle `admin` dans `public.user_roles` peuvent accéder à `/admin` (`AdminAuthGate` redirige les non-admins).
- **Rôles utilisateurs** — migration créant l'enum `app_role`, la table `user_roles`, et la fonction de sécurité `has_role(user_id, role)` (SECURITY DEFINER) utilisée par les policies RLS.
- **Admins initialisés** — `ulrich.fischer@memoways.com` et `romed@paradigmafilms.ch` ont été promus `admin`.

### Modifié
- **RLS hardening** — 10 policies trop permissives corrigées :
  - `sessions` : suppression des doublons anonymes `INSERT`/`UPDATE` ; `UPDATE` limité aux sessions récentes (< 4 h) ; `SELECT`/`DELETE` réservés aux admins.
  - `llm_usage` : `UPDATE` restreint aux 2 dernières heures ; suppression de la publication realtime `supabase_realtime` pour éviter l'exposition côté client.
  - `openrouter_cost_error_logs` : `UPDATE` restreint aux 2 dernières heures.
  - `admin_settings` : `SELECT` anonyme limité aux clés préfixées `ava_%` (runtime keys) ; les admins conservent l'accès complet.
  - `characters`, `audio_latencies`, `turn_latencies`, `session_summaries` : lectures/écritures réservées aux admins (les insertions anonymes de télémétrie/session restent autorisées là où c'était nécessaire).
- **`src/integrations/supabase/types.ts`** — types mis à jour avec `user_roles`, `app_role`, `has_role`.
- **`src/App.tsx`** — route `/auth` ajoutée ; `/admin` protégée par `AdminAuthGate`.

### Sécurité — reste à traiter
Les investigations ont identifié des travaux de hardening suivants, non inclus dans cette livraison :
- **`sync-notion`** : endpoint public (`verify_jwt = false`) capable d'effacer/réécrire personnages, vidéos et embeddings. Il faut y exiger un JWT admin via `has_role`.
- **`proxy-stt`** : retourne la vraie clé Deepgram permanente au client. À remplacer par des clés temporaires/scoped ou par un proxy websocket côté serveur.
- **`proxy-stt-config`** : retourne le token Gamilab brut. À ne plus exposer ; ne renvoyer que l'ID de portail et un flag `configured`.
- **`proxy-llm`** : proxy ouvert vers OpenRouter sans authentification ni liste de modèles autorisés. À restreindre aux modèles du jeu et lier à une session valide.
- **`update-notion-video`** : endpoint public permettant de modifier contenus Notion et vidéos. À protéger par JWT admin.
- **Fonctions `SECURITY DEFINER` exécutables par `anon`/`authenticated`** — à révoquer l'EXECUTE si elles ne sont pas censées être appelées par les clients.

### Validation
- Migration appliquée en base.
- Connexion admin fonctionnelle sur `/auth` ; redirection refusée pour utilisateurs sans rôle admin.
- Les 10 findings RLS spécifiés (`SUPA_rls_policy_always_true`, `admin_settings_public_rw`, `audio_latencies_public_rw`, `characters_public_rw`, `llm_usage_public_rw`, `openrouter_cost_error_logs_public_rw`, `realtime_llm_usage_exposure`, `session_summaries_public_rw`, `sessions_public_rw`, `turn_latencies_public_rw`) marqués résolus.

### Hors-scope
- Aucun changement de logique métier du jeu (pipeline STT/LLM/TTS, GM, vidéos) ; uniquement de la sécurité backend/admin.

---


## [0.36.0] - 2026-07-09 — Providers STT/TTS Gradium intégrés

### Ajouté
- **Edge Function `proxy-stt-gradium`** — proxy REST vers Gradium ASR. Accepte un fichier audio brut ou multipart, agrège le flux NDJSON de réponses `type: text` et retourne `{ text, provider, upstream_ms }`.
- **Edge Function `proxy-tts-gradium`** — proxy vers Gradium TTS (`api.post.speech.tts`, `only_audio=true`). Retourne le blob audio avec le `Content-Type` correspondant au format demandé (`mp3`, `wav`, `opus`, `pcm`).
- **Provider STT Gradium** — `src/services/stt/providers/gradiumSTT.ts` : enregistrement microphone via `MediaRecorder`, envoi batch vers `proxy-stt-gradium`, callback `onTranscript` final. Supporte `getTelemetryContext` pour la télémétrie latence.
- **Provider TTS Gradium** — `src/services/tts/providers/gradium.ts` : appel `proxy-tts-gradium` avec retry/timeout 12s, retour `blob + meta`.
- **Paramètres Gradium dans l'admin** — `providerSettings.ts` avec `GradiumSettings` (`voiceId`, `outputFormat`, `speed`, `temperature`, `language`) ; panneau dédié dans `TTSConfigTab`.
- **Sélection dans les menus Admin** — `gradium` ajouté à `STT_PROVIDER_LIST`, `runtimeConfig.ts`, au menu STT ; et à `TTSProviderId`, `TTS_PROVIDERS`, au menu TTS.
- **Coût TTS** — `VoiceUsageTab` affiche le tarif indicatif Gradium (~0.15/1k caractères).

### Modifié
- **`src/services/stt/registry.ts`** / **`runtimeConfig.ts`** / **`types.ts`** / **`index.ts`** — étendus pour le provider `gradium` (mode `batch`, secret attendu `GRADIUM_API_KEY`).
- **`src/services/tts/types.ts`** / **`registry.ts`** / **`providerSettings.ts`** — support du provider `gradium`.
- **`supabase/config.toml`** — `sb_verify_jwt = false` pour `proxy-stt-gradium` et `proxy-tts-gradium`, afin d'autoriser les appels directs client.
- **`proxy-stt-config`** — ajout de `GRADIUM_API_KEY` dans la liste des secrets détectés pour la config STT.

### Validation
- `npx tsc --noEmit` OK.
- Les menus Admin STT/TTS affichent « Gradium ».
- Test dès configuration de `GRADIUM_API_KEY` dans les secrets projet.

### Hors-scope / Non-régression
- Deepgram reste le provider STT par défaut, ElevenLabs le TTS par défaut.
- La façade STT/TTS reste le seul point d'entrée ; pas d'appel direct Deepgram/Gradium côté client.

---

## [0.35.0] - 2026-07-06 — Champ Timeline Notion : temporalité de la mémoire personnage

### Ajouté
- **Colonne `timeline` sur `character_prompts`** — migration SQL ajoutant `timeline text NOT NULL DEFAULT ''`, persistant le champ Notion dans la base pour chaque personnage.
- **Sync Notion du champ `Timeline`** — `sync-notion` reconnaît la propriété Notion `Timeline` (alias `Chronologie`, `Historique`) et l'écrit dans `p.timeline`.
- **Injection `timeline` dans le system prompt** — `buildCharacterPromptSections` ajoute un bloc `CHRONOLOGIE / MÉMOIRE HISTORIQUE` sous `SITUATION ACTUELLE` (avant `IDENTITÉ FONDAMENTALE`) pour ancrer le personnage dans son passé canonique.

### Modifié
- **`characterPromptService.ts`** — type `CharacterPrompt` étendu (`timeline`), valeur `EMPTY` mise à jour, mapping depuis la DB (`listCharactersWithPrompts` inclut `timeline`).
- **`src/integrations/supabase/types.ts`** — `Database` type mis à jour avec la nouvelle colonne.

### Validation
- Resync Notion lancée sur les personnages pour peupler `timeline`.
- La fiche personnage dans `CharacterPromptEditorPanel` affiche désormais le champ Timeline.

### Hors-scope
- Pas de changement du découpage RAG/chunking ; le RAG reste le mécanisme d'enrichissement complémentaire.

---

## [0.34.0] - 2026-06-22 — Max utilise enfin le RAG : fin des esquives "Lausanne"

### Corrigé (criticité 🔴)
- **Mismatch de nom de personnage `"Max"` vs `"Max Lorenzo"`** — la DB stocke `"Max Lorenzo"` mais l'orchestrateur appelle `simulateMaxResponse({ characterName: "Max" })`. Toutes les lookups (`getCharacterSystemPrompt`, `loadCharacterPromptByName`, `resolveCharacterIdByName`) faisaient un `.eq("name", "Max")` strict et retournaient `null`. Conséquences silencieuses : (a) le `system_prompt` de 4547 chars de Max n'était **jamais** injecté → fallback générique d'1 ligne, (b) **aucun champ Notion** n'était injecté (Identité, Qui tu es, Dynamique…), (c) `characterId = null` faisait retomber le RAG sur **tous les personnages** au lieu de cloisonner Max. Fix : cascade de lookup `exact → "Name %" → "Name%"` dans `characterPromptService.ts` (`findCharacterRowByName`) + même cascade dans `getCharacterSystemPrompt`.
- **`ragContext` brut jamais injecté en prod** — `buildMaxSystemPrompt` n'ajoutait le bloc « CONTEXTE NARRATIF — SOURCE DE VÉRITÉ » que si `!hasStructuredKnowledge`, condition jamais vraie dès qu'il y avait ≥1 match. Le RAG complet est désormais **toujours** injecté avec un préambule explicite *« ce sont des faits canoniques que tu peux énoncer librement »*.
- **Troncature destructrice à 300 caractères** — `MAX_KNOWLEDGE_ITEM_CHARS` 300 → **900**, `MAX_RAG_CONTEXT_CHARS` 420 → **1200**, top-3 → **top-5**. Les chunks Notion font ~1000 chars et le mot « Lausanne » tombait au milieu donc coupé.
- **Label « hypothèse » contre-productif** — tout match `similarity < 0.55` était injecté comme `[H1] Piste partielle seulement: …` + assertions bloquées par défaut (« Ne jamais inventer de lieu… »). Max recevait simultanément l'info correcte ET l'ordre de ne pas l'affirmer → esquive systématique. Branche `hypotheses` supprimée, `forbiddenTopics` vidé, `blockedAssertions` réduit à *« ne pas inventer de personnage/événement absent du contexte »*.

### Ajouté
- **`situation_summary` injecté dans le system prompt** — le résumé factuel 100-150 mots généré par la sync Notion (lieu, âge, famille, événements récents) est désormais en tête de la `FICHE PERSONNAGE` sous l'étiquette *« SITUATION ACTUELLE (canon — faits vrais que tu peux énoncer librement) »*.
- **`resolveCanonicalCharacterName(name)`** — utilitaire exporté pour récupérer le nom canonique DB depuis un prénom court.

### Hors-scope
- Pas de migration SQL, pas de modif de la sync Notion.
- Validateur anti-hallucination : déjà `off` par défaut depuis 0.33.0.

---

## [0.33.0] - 2026-06-22 — Cloisonnement RAG par personnage, sync Notion découpé, Max obéissant aux instructions, validateur optionnel


### Ajouté
- **Cloisonnement RAG par personnage** — `queryRAG` / `getRAGContext` propagent désormais `characterId` (résolu via `resolveCharacterIdByName` dans `characterPromptService.ts`). `match_embeddings_voyage` filtre côté SQL : impossible que des chunks d'Ava/Léo/Emma remontent dans le contexte de Max. L'onglet **RAG Test** (Admin) ajoute un sélecteur de personnage et affiche le `character_name` de chaque chunk retourné.
- **Modes de sync Notion découplés** — l'Edge Function `sync-notion` accepte `mode: "full" | "fields_only" | "rag_only"`. `fields_only` met à jour uniquement les champs `character_prompts` (Identité, Qui tu es, Qui t'appelle, Dynamique de la conversation…) **sans toucher aux embeddings**. `rag_only` re-chunk + ré-embed sans réécrire les champs. `full` (défaut) fait les deux.
- **Validateur anti-hallucination optionnel** — `AntiHallucinationValidatorSettings.mode` (`off | observe | enforce`) ajouté dans `settingsService.ts`, exposé via sélecteur dans l'onglet `🛡️ Validateur`. Défaut : `off` (latence -1 appel LLM/tour).

### Modifié
- **Bouton « ↻ Resync Notion »** (panneau personnage) — appelle désormais `sync-notion` en mode `fields_only`. Conséquence : éditer un champ dans Notion et resync n'efface plus jamais les embeddings.
- **UI Admin Sync** — sépare les actions « Sync RAG » (mode `rag_only`) et « Sync complète » (mode `full`).
- **`maxAgent.ts` — ordre de composition du system prompt** : les champs Notion sont injectés **AVANT** `GAMEPLAY_RULES`, avec un préambule explicite *« les instructions Notion sont prioritaires sur les règles techniques »*. La règle hardcodée « tu poses des questions pour juger la sincérité » est supprimée de `GAMEPLAY_RULES`, et `buildFastPreTurnBrief` n'ajoute plus « pose une question simple ». Max suit désormais ce que dit le champ *Dynamique de la conversation* de Notion.

### Corrigé
- **Pollution de contexte inter-personnages** — `processConversationTurn` / `prd4Orchestrator` ne transmettaient pas `characterId` à la couche RAG, donc Max pouvait recevoir des chunks Ava/Léo/Emma. Corrigé en bout de chaîne.
- **Max trop « assistant »** — Max posait une question à chaque tour malgré les instructions Notion contraires. Cause racine : règles hardcodées dans `GAMEPLAY_RULES` et `buildFastPreTurnBrief` qui surchargeaient Notion. Résolu par la réorganisation du prompt.

### Hors-scope / Non-régression
- Aucune migration SQL : `character_id` existait déjà sur la table `embeddings` et `match_embeddings_voyage` acceptait déjà le filtre.
- Pipeline STT/TTS, sonneries, onboarding, déclenchement vidéo : inchangés.
- Après déploiement, lancer **une** sync complète pour s'assurer que tous les embeddings existants sont taggés `character_id` (les nouveaux le sont automatiquement).

---


## [0.32.0] - 2026-06-18 — Cache audio d'ouverture, avatar Max, mapping Notion « Qui t'appelle », autoplay vidéo HLS

### Ajouté
- **Cache audio d'ouverture (`openingTTSCache.ts`)** — pré-génère et met en cache le TTS ElevenLabs de la phrase fixe de Max *« Hallo... à qui ai-je affaire ? »*. Au démarrage de la conversation, Max parle immédiatement sans attendre la génération TTS (latence ≈ 0 ms côté joueur).
- **Nouvel avatar Max** — image appliquée dans la vignette `CharacterSelect` (sélection de personnage) et en fond plein écran de `ConversationScreen`.
- **Player vidéo HLS natif (`GumletVideoPlayer`)** — détection automatique des URLs `.m3u8` et bascule sur `<video>` + `hls.js` avec `autoplay`, `muted=false`, `volume=1.0` forcés pour garantir l'audio activé par défaut. Les URLs iframe (`gumlet.tv/watch/{id}`, `play.gumlet.io/embed/{id}`) conservent le rendu via iframe Gumlet.

### Modifié
- **Renommage propriété Notion** — `Ce que tu sais de l'utilisateur` → `Qui t'appelle` dans la base *Base Caractères AVA*. Mises à jour alignées : `sync-notion` (extraction de propriété), `characterPromptService.ts` (champ `qui_t_appelle`), composition du system prompt Max, panneau admin `CharacterPromptEditorPanel`.
- **Vidéo d'intro** — revenue à l'embed iframe `https://play.gumlet.io/embed/6a188e39fdee17a44c1ea049` après que le décodage HLS natif a échoué dans l'environnement de preview (vidéo bloquée à 0:00). L'iframe Gumlet gère nativement l'autoplay + audio via le geste utilisateur du clic « Commencer ».

### Hors-scope / Non-régression
- **Aucune migration** des URLs Notion `gumlet.tv/watch/{id}` vers `https://video.gumlet.io/.../main.m3u8`. La base *Vidéos AVA* reste inchangée : le player iframe Gumlet supporte ces URLs nativement et le rendu in-game est stable.
- Pas de migration DB. Le renommage de la propriété Notion ne touche que la couche mapping côté code.

---

## [0.31.0] - 2026-06-17 — GM label pass parallèle, déclenchement vidéo déterministe

### Ajouté
- **GM Label Pass (`gameMasterLabelPRD4.ts`)** — agent LLM léger (mono-tâche, ≤120 tokens, timeout 4 s) qui extrait `labels: { themes, topics, intentions }` (max 4 au total) du dernier message utilisateur. Lancé EN PARALLÈLE de Max LLM par `processPRD4Turn`, donc les labels sont disponibles avant la fin du TTS de Max.
- **Matcher vidéo déterministe (`videoTriggerMatcher.ts`)** — remplace le matching LLM fragile par une logique client-side : normalisation des accents, tolérance aux coquilles (`patricarcat` → `patriarcat`), synonymes (`famille` ⊃ père/mère/sœur/enfance, `patriarcat` ⊃ viril/violence/machisme, `trahison` ⊃ mensonge/secret, `pandémie` ⊃ protogynie/virus). Un seul thème/synonyme commun entre les labels utilisateur et les `themes` d'une vidéo suffit pour déclencher. Priorité par `priority` ascendante.
- **Plan d'architecture** : `docs/plan_game_master_labels_videos.md` documente le flux parallèle (Max LLM + GM Label Pass) et le rôle du matcher déterministe.

### Modifié
- **`prd4Orchestrator.ts`** — `processPRD4Turn` expose désormais `labelPromise: Promise<PRD4LabelResult>` en plus de `postTurnPromise`. Le label pass est lancé en parallèle, sans impacter le chemin critique STT→LLM→TTS.
- **`IndexPRD4.tsx`** — consomme `labelPromise` pour :
  1. Attacher les labels au dernier message utilisateur dans `conversationRef` + persistance DB + `setLastUserLabels` (visible admin).
  2. Appeler `pickVideoForLabels(...)` dès que les labels sont résolus ; si match → `setActiveVideo` immédiatement (pendant ou juste après le TTS de Max).
  3. Traquer `prd4_gm_label` et `prd4_video_triggered` dans PostHog (source du match incluse).
- **Post-turn GM (`gameMasterPRD4.ts`)** — garde-fou conservé : si le label pass n'a déclenché aucune vidéo et que le post-turn retourne un `trigger_video_id`, celui-ci est joué en fallback. Les labels du post-turn servent aussi de fallback si le label pass a échoué (`ok: false`).

### Corrigé
- **Déclenchement vidéo fragile** — le GM post-turn évaluait à la fois labels, engagement, guidance et choix de vidéo dans un seul prompt lourd, ce qui causait des omissions fréquentes de `trigger_video_id` (ex. session « patriarcat/famille » sans vidéo « couteau »). Séparer le label pass (léger + parallèle) et le matcher déterministe (fiable) résout le problème.

### Hors-scope / Non-régression
- Aucune modification de l'UI joueur (`ConversationScreen` inchangé). Les labels restent visibles uniquement dans l'admin (`SessionsTab`).
- Pas de migration DB (les labels existent déjà dans `sessions.conversation_log[].labels`).
- Pipeline STT/TTS et agent Max inchangés.

---

## [0.30.0] - 2026-06-17 — Flux conversationnel stabilisé, STT/TTS fluides, sonneries d'appel

### Ajouté
- **Sonneries d'appel** (`CallingMaxScreen`) — 3 sonneries classiques (dual-tone 440/480 Hz, tremolo) via Web Audio API avant que Max décroche. Compteur `ring/3` affiché à l'écran.
- **Bouton PTT unique explicite** — un seul bouton « Démarrer / Arrêter » avec icônes `Mic`/`Square`, pulse rouge enregistrement, raccourci espace. Remplace le double bouton start/stop confus.

### Modifié
- **UI conversation rétablie** — suppression du HUD transcript scrollable et des sous-titres en overlay. Retour à l'affichage classique : phrase de Max en bas (texte blanc lisible), parole utilisateur en dessous. Remplacement par tour de parole, pas de cumul.
- **STT live — lisibilité et continuité** : texte utilisateur en blanc (`text-white/95`), pas de rouge. Pas d'animation `fade-in` ni de `key` dynamique qui provoquaient des flashs et des coupures. Le transcript live se met à jour en continu, corrige au fur et à mesure, sans jamais vider ou couper la phrase en cours.
- **TTS ElevenLabs — fluidité** : `stability: 0.50` (moins raide), `similarityBoost: 0.82`, `style: 0.18` (plus d'expressivité), `speed: 1.0` (pas de ralentissement artificiel). Moins de hachage, prononciation plus naturelle.
- **Flow onboarding hard-codé complet** : `Welcome → FilmQuestion → (Teaser si non vu) → PostureCapture → CharacterSelect → CallingMax → Conversation`. Retour de `CharacterSelect` avec vignettes (Max actif, 3 autres grisés).
- **Première phrase de Max** fixée à : *« Hallo... à qui ai-je affaire ? »*
- **Textes UX** : suppression du bouton « Me laisser surprendre » sur `PostureCaptureScreen`. Texte `PostureCaptureScreen` changé en *« Tu peux poser une question, exprimer une émotion ou partager une intention pour démarrer l'expérience. »* Suppression de la phrase *« Le film suit une famille... »* sur `CharacterSelect`.

### Corrigé
- **Bug STT — flashs et perte de texte** : le `key` dynamique et la classe `animate-fade-in` sur les messages provoquaient un remontage complet à chaque caractère intermédiaire. Remplacé par `transition-opacity duration-200` sur Max et texte statique sur l'utilisateur.
- **Bug TTS — Max mâchait ses mots** : les paramètres trop agressifs (`stability: 0.62`, `speed: 0.92`) et les chunks courts rendaient la voix saccadée. Corrigé par des paramètres plus neutres et des seuils de chunking plus élevés (portés en v0.29.0 et affinés ici).

---

## [0.29.0] - 2026-06-17 — Labels GM, déclenchement vidéo fiabilisé, diction TTS plus naturelle, suppression module GIFF

### Ajouté
- **Labels conversationnels GM** : nouveau champ `labels: { themes, topics, intentions }` (max 4 au total) sur `PRD4PostTurnEvaluation`, extrait du message utilisateur après chaque tour. Vide si rien d'évident (pas d'invention).
- **Affichage des labels** dans le HUD de conversation (`ConversationScreen`) — chips colorées sous chaque message utilisateur (thème = primary, sujet = ambre, intention = vert).
- **Affichage des labels dans l'admin** (`SessionsTab`) — chips sous chaque message utilisateur du détail de session.
- **Persistance des labels** sur `sessions.conversation_log` (re-save après l'évaluation GM).
- **HUD transcript** : `ConversationScreen` affiche désormais les 6 derniers messages dans un panneau scrollable, en plus du sous-titre live STT.

### Modifié
- **Game Master prompt** : étape 1 → extraire `labels` du message utilisateur ; étape 2 → matcher `labels.themes` aux `themes` des vidéos disponibles pour déclencher `trigger_video_id`. Synonymes tolérés (famille/sœur/père, patriarcat/patricarcat, etc.). Plus de trigger si `themes` est vide.
- **TTS ElevenLabs — diction plus fluide** : chunks plus longs (`MIN_SENTENCE_LEN: 25 → 80`, `CHUNK_TARGET_CHARS: 420 → 600`, `SINGLE_REQUEST_MAX_CHARS: 700 → 900`) pour éviter le hachage. Defaults voix Max ajustés (`stability: 0.62`, `similarityBoost: 0.88`, `style: 0.08`, `speed: 0.92`) pour une prononciation plus posée.
- **Flow d'onboarding hard-codé** : `Welcome → FilmQuestion → (Teaser si non vu) → PostureCapture → CharacterSelect → CallingMax → Conversation`. Plus de branchement conditionnel.

### Supprimé
- **Module « Démarrage GIFF »** : onglet admin, service `giffStartSettings`, composants `StartVariantFrame`, `TeaserRappelScreen`. Les réglages amenaient une complexité inutile au regard de la mécanique stabilisée.
- Props `settings` sur `WelcomeScreen`, `FilmQuestionScreen`, `PostureCaptureScreen`.



## [0.28.0] - 2026-06-16 — Démarrage GIFF (< 45 s, 3 variantes admin)

Implémente le **PRD « Démarrage AVA pour installation GIFF »** : nouveau parcours court entre l'écran d'accueil et le premier échange avec Max, configurable depuis l'admin avec 3 variantes testables. L'ancien flow long (création complète de personnage) reste accessible via flag.

### Ajouté
- **Nouveau flow GIFF** : `Welcome → FilmQuestion → (Rappel court si besoin) → PostureCapture → Transition → Conversation Max`. Cible : moins de 45 s entre « Commencer » et le premier mot de Max.
- **3 variantes de démarrage** (`gm_host`, `gm_invisible`, `voiceover_hybrid`) — chips/voix-off appliqués sur chaque écran via `StartVariantFrame`. Pas de TTS d'onboarding (texte uniquement).
- **Écrans `PostureCaptureScreen`** (PTT 1 phrase + bouton « Me laisser surprendre »), **`TeaserRappelScreen`** (rappel texte court), **`TransitionScreen`** (fondu 800 ms).
- **Admin — onglet « Démarrage GIFF »** (`Mécanique > giff-start`) : édition de la variante active, du flag `use_giff_flow`, de la durée cible et de tous les textes UX (accueil, promesse, rappel, posture, intro/handoff GM, voix off).
- **Service `giffStartSettings.ts`** — persistance via `admin_settings` (clé `ava_giff_start_settings`) + fallback localStorage.
- **Persistance onboarding sur `sessions`** — nouvelles colonnes `ava_start_variant`, `has_seen_film`, `teaser_shown`, `user_posture_raw`, `user_posture_mode`, `onboarding_started_at`, `first_max_response_at`, `onboarding_duration_ms`.
- **Événements PostHog** : `giff_onboarding_started`, `giff_film_answered`, `giff_posture_captured`, `giff_first_max_response` (avec `duration_ms` et `under_target`).
- **Type `UserPosture`** (`{ raw, mode }`) + champ `userPosture` sur `ExperienceState`. Phases supplémentaires : `posture_capture`, `transition_max`.

### Modifié
- **`IndexPRD4.tsx`** — branche le flow selon `giffSettings.use_giff_flow`. Chronomètre l'onboarding du clic « Commencer » au premier TTS de Max. `createPRD4Session` peut être appelée sans `userRoleProfile` lorsque le flow GIFF est actif.
- **`WelcomeScreen`, `FilmQuestionScreen`** — acceptent désormais `settings` et affichent textes/wrappers de variante en mode GIFF (rétro-compat préservée si pas de settings).
- **`prd4Session.ts`** — `createPRD4Session` accepte `userRole = null` + champs additionnels ; nouvelle helper `updatePRD4Onboarding(sessionId, payload)`.
- **Questionnaire technical** — ajoute `ava_start_variant`, `has_seen_film`, `user_posture_raw`, `user_posture_mode`, `onboarding_duration_ms` au payload sauvegardé.

## [0.27.0] - 2026-06-16 — Triggers vidéo Notion + cinématiques pilotées par le Game Master

Objectif : connecter la base Notion **« 🎬 Vidéos AVA »** au back-office, transformer le tab *Triggers vidéo* en éditeur bidirectionnel Notion ↔ Supabase, et faire en sorte que le **Game Master déclenche réellement des vidéos** intercalées dans la conversation avec Max (PRD4 + legacy), en fonction de la thématique de l'échange.

### Ajouté
- **Sync base « Vidéos AVA »** (`databases.videos` dans `sync-notion`) — upsert dans `video_triggers` mappé sur les propriétés Notion : `Titre de la vidéo`, `Contexte`, `Description`, `Priorité`, `Thèmes`, `Type`, `Style de transition`, `URL Gumlet`. Prune des lignes dont la page Notion a disparu, et purge des anciens triggers fakes (sans `notion_id`).
- **Edge function `update-notion-video`** — PATCH la page Notion (rich_text, multi_select, select, number, url, title) et miroir la modification dans Supabase. Messages d'erreur explicites en cas de 403/404 (intégration non partagée).
- **Service `videoTriggerService.ts`** — `listVideoTriggers`, `updateVideoTriggerOnNotion`, cache 30 s `getVideoTriggersCached` utilisé par les Game Masters pour décider d'un déclenchement vidéo.
- **Admin — onglet `Contenu Notion > Vidéos`** — liste épurée (titre + chips thèmes + lien Notion) avec bouton « Sync Notion ».
- **Colonnes `context` et `description`** sur `video_triggers` (migration `ALTER TABLE`).
- **Champ `trigger_video_id`** dans `PRD4PostTurnEvaluation` — le Game Master PRD4 reçoit la liste des vidéos disponibles + `already_triggered` et choisit éventuellement un id à jouer.
- **Lecture vidéo en plein écran pendant la conversation PRD4** — `GumletVideoPlayer` monté en overlay sur `ConversationScreen` quand le GM trigge une vidéo après le TTS de Max. À la fin (ou skip), le `Contexte` Notion est injecté dans Max au tour suivant via `postVideoContext`.

### Modifié
- **`VideoTriggersEditor`** — suppression des boutons *Ajouter* et *Supprimer* (la source de vérité est Notion). Ajout du champ **Description**. Renommage des labels (`Contexte`, `URL Gumlet`, `Style de transition`). « Sauvegarder » pousse vers Notion via `update-notion-video` puis re-synchronise la ligne.
- **`gameMasterAgent.ts`** (legacy) — injecte le bloc `## VIDÉOS DISPONIBLES` (id, titre, type, priorité, thèmes, description, `already_triggered`) dans le user prompt du GM.
- **`conversationOrchestrator.ts`** (legacy) — suppression du dict `DEMO_TRIGGERS`. Le mapping `trigger_video_id → VideoTrigger` se fait désormais à partir de `getVideoTriggersCached()`.
- **`AVA_NOTION_DATABASES`** — ajout de `videos: '478685a5b31e45b5bc534bcf905b9124'`. Le bouton « Sync Notion » envoie maintenant `characters + videos` en un seul appel.
- **Type `VideoTrigger`** — `placeholder_text` et `duration_seconds` deviennent optionnels ; ajout de `context`, `description`, `notion_id`.

### Corrigé
- **Bug STT — input vocal ignoré les premiers essais** (`deepgramSTT.ts`, `settings.json`, `ConversationScreen` legacy + PRD4) : ajustement du seuil de silence et de la logique de détection VAD pour éviter que la parole utilisateur ne nécessite 3–4 tentatives avant d'être prise en compte.
- **Bug 400 `databases.characters is required` sur `sync-notion`** : la version déployée de l'edge function était obsolète (pré-refactor `databases.videos`). Redéploiement forcé de `sync-notion` et `update-notion-video` pour synchroniser le code source avec l'environnement live.

### Vérifié
- Migration appliquée (colonnes `context`, `description` + purge des lignes sans `notion_id`).
- Edge functions `sync-notion` et `update-notion-video` déployées.
- Sync Notion Vidéos (back-office → Notion) fonctionnel après redeploy.


## [0.26.0] - 2026-06-09 — Refonte RAG & prompts : base unique « Caractères AVA »

Objectif de départ : recentrer toute la mémoire narrative et le cadrage éditorial des personnages sur **une seule base Notion** — la *Base Caractères AVA* — et abandonner les bases Storyworld AVA, Gameplay Steps et Video Triggers. La page Notion de chaque personnage devient la source unique du récit (RAG) et du cadrage éditorial (system prompt structuré en 7 champs), avec isolation stricte par personnage dans les embeddings et un résumé de situation généré pour le Game Master.

### Ajouté
- **Table `public.character_prompts`** — nouvelle table 1 ligne / personnage avec 7 champs éditoriaux (`identite_fondamentale`, `qui_tu_es`, `ce_que_tu_ne_fais_jamais`, `ce_que_tu_sais_utilisateur`, `dynamique_conversation`, `sujets_sensibles`, `profondeur_par_niveau`) + `situation_summary` générée automatiquement, FK `characters.id`, RLS + GRANTs.
- **Service `characterPromptService.ts`** — interface `CharacterPrompt`, lecture par `character_id` ou par nom, sauvegarde, liste jointe avec `characters`, cache mémoire simple avec invalidation.
- **Génération `situation_summary`** — dans `sync-notion`, résumé factuel 100–150 mots généré via OpenRouter (`google/gemini-2.0-flash-001`) à partir du corps de page tronqué, injecté dans le system prompt GM.
- **Admin — onglet `Personnages`** — nouveau `CharacterEditorTab` avec sélecteur de personnage, 7 textarea éditoriaux, `situation_summary` read-only + bouton « Régénérer », bouton « Resync depuis Notion », preview du system prompt final compilé.
- **Admin — onglet `Mécanique > Game Master`** — intégration des champs éditoriaux Notion du personnage « Game Master » (via `CharacterPromptEditorPanel`) sous le prompt principal du GM.
- **Admin — onglet `Mécanique > Triggers vidéo`** — extraction de l'éditeur de triggers vidéo dans un tab dédié, séparé du Game Master.
- **Composant réutilisable `CharacterPromptEditorPanel`** — panneau d'édition des 7 champs + situation_summary + preview, partagé entre `CharacterEditorTab` et `GameMasterConfigTab`.
- **Wipe complet par personnage** — `sync-notion` supprime et ré-insère les embeddings uniquement pour le `character_id` concerné, avec préfixe `Personnage: <nom> | Partie i/N`.

### Modifié
- **Edge function `sync-notion`** — payload réduit à `databases.characters` uniquement. Les bases Storyworld, Gameplay Steps et Video Triggers sont ignorées. Pour chaque page Caractère : upsert `characters`, extraction des 7 propriétés rich_text → `character_prompts`, génération `situation_summary`, wipe + rebuild embeddings du personnage. Réponse enrichie avec `chunks_created`, `summary_chars`, `prompt_fields_filled`.
- **`maxAgent.ts`** — `buildMaxSystemPrompt` charge `character_prompts` par nom et compose le prompt avec les 7 sections nommées exactes (`## IDENTITÉ FONDAMENTALE`, `## QUI TU ES`, `## CE QUE TU NE FAIS JAMAIS`, `## CE QUE TU SAIS DE L'UTILISATEUR`, `## DYNAMIQUE DE LA CONVERSATION`, `## SUJETS SENSIBLES`, `## PROFONDEUR PAR NIVEAU`). RAG forcé avec `characterId` non-null. `system_prompt` legacy sur `characters` non lu.
- **`gameMasterAgent.ts` + `gameMasterPRD4.ts`** — system prompt enrichi de `## SITUATION ACTUELLE DU PERSONNAGE (<nom>)`. Avant chaque évaluation : requête RAG scopée `characterId` (2 extraits) injectés dans le user prompt sous `## EXTRAITS NARRATIFS PERTINENTS`.
- **`ragService.ts`** — `AVA_NOTION_DATABASES` ne garde que `characters`. Retrait des IDs Storyworld, Gameplay Steps, Video Triggers.
- **Admin — réorganisation des tabs** — 5 groupes : `📊 Données`, `📚 Contenu Notion`, `🎭 Personnages`, `🎮 Mécanique` (Game Master, Validateur, Métriques hallu., Pipeline, Test Max, Latence, Triggers vidéo), `🔧 Technique`.
- **Filtre anti-section** — `sync-notion` et `CharacterEditorTab` ignorent silencieusement les entrées `Identité & Présentation` et `Game Master` dans la liste des personnages. Max est affiché en premier dans le sélecteur.

### Vérifié
- `npx tsc --noEmit` : OK.
- `npm test` : passants.
- Build Vite : OK.

### Notes
- Côté Notion, les 7 propriétés `rich_text` doivent exister sur la base *Caractères AVA* et être remplies pour Max. Le corps de page Max contient le récit complet (film + post-film) qui alimente le RAG.
- Hors scope (prochaine mise à jour) : donner plus de poids au Game Master pour orchestrer les niveaux à partir de `Profondeur par niveau` et déclencher des vidéos entre niveaux.

## [0.25.0] - 2026-05-24 — Sélecteur STT input multi-providers pour Lovable

Objectif de départ : préparer dans le repo l'ajout d'un sélecteur global de provider STT pour l'input vocal, conformément au PRD *Ajout sélection SST en input*, en gardant Deepgram fonctionnel par défaut, en ajoutant Gamilab comme provider prioritaire via Browser SDK, et en préparant OpenAI Whisper / AssemblyAI sans hardcoder de secrets ni casser le pipeline PRD4.

### Ajouté
- **Onglet admin `STT Config`** (`src/components/STTConfigTab.tsx`) dans la section Technique, à côté de `LLM Config`, `TTS Config`, `Consommation LLM` et `Consommation Voix`.
- **Catalogue STT multi-providers** (`src/services/stt/registry.ts`) avec les 4 providers demandés :
  - `deepgram` — baseline stable, streaming WebSocket basse latence, provider par défaut.
  - `gamilab` — provider stratégique, préparé pour ASR/STT live via Browser SDK.
  - `openai_whisper` — provider commercial préparé en mode minimal.
  - `assemblyai` — provider commercial préparé en mode minimal.
- **Configuration globale STT persistée** (`src/services/stt/settings.ts`) sous la clé `ava_stt_settings`, avec lecture locale rapide, hydratation Supabase `admin_settings`, cache runtime et fallback défensif sur `deepgram` si la valeur est absente ou invalide.
- **Façade STT runtime** (`src/services/stt/index.ts`) qui expose `createConfiguredSTT()` et isole le choix du provider actif sans refondre le pipeline vocal.
- **Provider Gamilab préparé** (`src/services/stt/providers/gamilabSTT.ts`) :
  - résolution du SDK via `window.gami` ou `window.Gamilab`;
  - flow `connect → use_portal → create_thread → start_recording`;
  - mapping `text_current` vers transcript partiel;
  - mapping `text_history` / `silence` / `flush` vers transcript final;
  - télémétrie STT minimale (`provider: "Gamilab"`, mode realtime, longueur transcript, latence approximative);
  - aucune utilisation de `struct_current` ni d'extraction structurée.
- **Edge function de statut de configuration** (`supabase/functions/proxy-stt-config`) qui renvoie uniquement les flags `configured` et le `gamilabPortalId`, jamais les clés API.
- **Tests unitaires STT** :
  - `settings.test.ts` vérifie le défaut Deepgram, la normalisation des providers inconnus et la sauvegarde locale.
  - `registry.test.ts` vérifie la présence des 4 providers PRD et le fallback Deepgram.

### Modifié
- `src/pages/Admin.tsx` intègre le nouvel onglet `STT Config`.
- `src/pages/IndexPRD4.tsx` n'instancie plus `DeepgramSTT` directement : le flux conversation Max passe par `createConfiguredSTT()`, avec pré-hydratation des settings et labels de latence basés sur le provider STT configuré.
- `src/components/prd4/RoleCaptureScreen.tsx` utilise aussi `createConfiguredSTT()` pour la capture du rôle joueur, afin que le même provider global s'applique à tout l'input vocal PRD4.
- `src/services/latencyServiceMetadata.ts` expose `getConfiguredSTTServiceInfo()` pour afficher le provider STT sélectionné dans l'overlay / instrumentation latence.

### Sécurité / Lovable
- Aucun secret n'est hardcodé dans le repo.
- Les secrets attendus côté Lovable / Supabase sont documentés dans l'admin : `DEEPGRAM_API_KEY`, `GAMILAB_PORTAL_ID`, `GAMILAB_API_KEY`, `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`.
- Les clés locales éventuelles ne sont pas transportées automatiquement vers Lovable : elles doivent être renseignées côté Lovable/Supabase secrets au déploiement.
- Si Gamilab n'est pas configuré ou si le SDK browser est absent, le runtime retombe sur Deepgram au lieu de bloquer la conversation.
- OpenAI Whisper et AssemblyAI sont visibles/préparés, mais restent en fallback Deepgram tant que leur intégration runtime n'est pas finalisée.

### Vérifié
- `npx tsc --noEmit` : OK.
- `npm test` : 41 tests passants.
- `npm run build` : OK (warnings existants : Browserslist obsolète et chunk Vite > 500 kB).
- Vérification navigateur locale tentée sur `/admin?tab=stt` : l'écran login admin s'affiche sans erreur console ; le backend Playwright s'est bloqué après authentification, donc la validation visuelle complète de l'onglet devra être refaite dans Lovable ou navigateur local humain.

### Notes
- Deepgram reste le chemin stable et le provider par défaut. Le comportement interne de `DeepgramSTT` n'a pas été réécrit.
- La vraie activation Gamilab dépend encore du chargement du Browser SDK et des secrets Lovable/Supabase.
- Cette version prépare le socle MVP demandé ; le benchmark WER/latence/prix reste hors scope.

## [0.24.0] - 2026-05-23 — Observabilité latence par service + évolution temporelle STT/LLM/TTS

Objectif de départ : enrichir l'onglet admin **Latence & blocage** sans casser l'existant, conserver les labels visibles (`RAG`, `GM pre-turn`, `Max LLM`, `Validateur`, `TTS`, `GM post-turn`, etc.), réutiliser les providers/models déjà connus quand ils existent, rester rétro-compatible si les anciennes sessions ne contiennent pas ces métadonnées, et aligner PostHog sur les mêmes segments sans envoyer de contenu sensible.

Demande complémentaire UI : dans `/admin?tab=latency`, ajouter pour **STT**, **LLM** et **TTS** une lecture temporelle des latences par session, en secondes avec 2 décimales, montrant min / médiane / max, filtrable par service, superposable entre services, lisible dans le temps, avec seulement les 8 dernières sessions affichées par défaut et des sessions numérotées sur l'axe horizontal.

### Ajouté
- **Enrichissement rétro-compatible des segments de latence** : nouveau module `src/services/latencySegments.ts` qui centralise la construction et l'enrichissement des segments avec champs optionnels `serviceProvider`, `serviceName`, `model`, `mode`, `endpointType` et `context`. Les anciennes données restent valides ; les valeurs manquantes tombent sur `Unknown` ou restent vides.
- **Métadonnées service/model dans le runtime voix** :
  - STT Deepgram remonte désormais `serviceProvider: "Deepgram"`, `model: "nova-2"`, `mode: "realtime"` et la langue quand disponible.
  - TTS remonte le provider actif (`ElevenLabs`, `Inworld`, `Hume` ou `Unknown`) et les métadonnées déjà disponibles dans le pipeline.
  - Max LLM / Avatar LLM réutilise le modèle OpenRouter déjà connu dans le pipeline quand il est présent.
  - Les segments GM, Validateur et RAG restent défensifs : provider/model si disponible, sinon `Unknown`.
- **PostHog aligné sur les segments admin** via l'initialisation existante et en no-op silencieux si PostHog n'est pas disponible :
  - `ava_turn_latency_summary` : résumé par tour (`session_id`, `turn_index`, `correlation_id`, `total_latency_ms`, `blocked`, `blockage_reason`, `segment_count`, providers/models STT/LLM/TTS).
  - `ava_latency_segment` : détail par segment (`segment_key`, `segment_label`, `duration_ms`, provider, service, model, mode, contexte non sensible).
- **Comparaison par segment et service** dans l'onglet **Latence & blocage** : regroupement par segment existant puis par provider/service/model, nombre de tours, P50, P95, moyenne, max, nombre et taux de blocages.
- **Switch P50 / P95** : P50 reste la métrique principale par défaut, avec bascule P95 pour inspecter les queues de latence.
- **Cas extrêmes** : top 5 des durées les plus longues par groupe et badge visuel pour les valeurs supérieures au P95.
- **Évolution temporelle par service** : trois visualisations dédiées **STT**, **Max LLM** et **TTS** avec axe vertical en secondes (2 décimales), axe horizontal numéroté par session, courbes min / médiane / max, filtre par service, mode superposition tous services, et détail indépendant par service.
- **Sélection de sessions plus lisible** : par défaut seules les 8 dernières sessions disponibles sont affichées ; les graphes n'affichent plus les noms longs des sessions, seulement `#1`, `#2`, etc. La liste sous chaque graphe permet de cliquer une session pour la localiser visuellement sur la courbe.
- **Tooltips enrichis** sur les segments existants : label inchangé, durée, provider/service, model, mode, tour/session et blocage éventuel, sans crash si les champs sont absents.

### Modifié
- `ConversationPipelineTimings` accepte maintenant des champs optionnels additionnels (`stt_ms`, `segmentServices`) sans modifier les contrats existants.
- `voiceTelemetry.ts` publie les nouveaux événements PostHog en plus du stockage interne existant, en filtrant les propriétés aux métadonnées non sensibles : pas de texte utilisateur complet, pas de réponse avatar complète, pas de prompt, pas de secret.
- L'admin explique explicitement pourquoi des services peuvent apparaître en `Unknown` : les sessions historiques ne contenaient pas encore `pipeline.segmentServices`; les nouveaux tours instrumentés renseignent ces champs progressivement.

### Vérifié
- `npx tsc --noEmit` : OK.
- `npm test` : 29 tests passants.
- `npm run build` : OK (warning de taille de chunk Vite existant uniquement).
- ESLint ciblé sur les fichiers modifiés : OK.
- Validation navigateur locale sur `http://127.0.0.1:8080/admin?tab=latency` : onglet rendu, 8 dernières sessions au maximum sélectionnées par défaut, graphes STT/Max LLM/TTS visibles, axe horizontal numéroté, clic sur une session de la liste reflété dans la visualisation.

### Notes
- Les anciennes sessions restent majoritairement en `Unknown` car elles n'ont pas été enregistrées avec les métadonnées `segmentServices`. C'est attendu et non bloquant.
- Le lint global du projet contient encore des erreurs préexistantes hors scope ; le lint ciblé des fichiers modifiés passe.

## [0.23.0] - 2026-05-22 — PRD4 : nouveau parcours post-film + rôle utilisateur + Max contextualisé

Refonte structurante (PRD4 §1–14, plan `docs/plan_prd4_implementation.md`) livrée en 6 phases dans la même journée. Remplacement de l'onboarding A/B par un parcours unique post-film, injection d'un rôle joueur libre dans Max, affichage des 4 protagonistes (Max actif, Emma/Ava/Léo grisés), bascule push-to-talk + sous-titres, suppression du GM pré-tour du chemin critique, GM post-turn async, questionnaire entièrement nouveau avec mapping Notion accentué.

### Ajouté
- **Phase 1 — State machine + écrans** : nouveau type `ExperiencePhase` (`welcome → film_question → teaser → role_capture → role_summary → character_select → calling_max → conversation_max → end_session → questionnaire → thanks`), hook `useExperienceState`, 9 écrans PRD4 (`WelcomeScreen`, `FilmQuestionScreen`, `TeaserScreen`, `RoleCaptureScreen`, `RoleSummaryScreen`, `CharacterSelectScreen`, `CallingMaxScreen`, `ConversationScreen`, `EndSessionScreen`, `QuestionnaireScreenPRD4`), 4 SVG placeholders personnages (`max`, `emma`, `ava`, `leo`).
- **Phase 2 — Création de rôle (PTT + résumé LLM)** : capture push-to-talk sur `role_capture`, edge function `summarize-role` (Gemini 2.5 Flash via OpenRouter) produisant un `UserRoleProfile` JSON (`raw_input`, `summary_for_user`, `summary_for_max`, `relationship_to_family`, `age`, `gender`, `proximity_level`, `intent`), service `roleProfileService.ts`, fallback robuste si LLM échoue, persistance dans `sessions.player_role`.
- **Phase 3 — Max contextualisé + GM post-turn async** : injection de `summary_for_max` + champs structurés en tête du system prompt Max (`maxAgent.ts`), nouvel agent `gameMasterPRD4.ts` produisant une évaluation post-tour structurée (`engagement_delta`, `confusion_detected`, `role_usage_quality`, `topics_covered`, `transition_recommended`, `cinematic_hint`, `next_turn_guidance`, `end_recommended`, `moderation_flag`), orchestrateur `prd4Orchestrator.ts` qui appelle Max sans GM pré-tour et déclenche le post-turn en `void`, persistance append-only dans `sessions.gm_post_turn_log` (jsonb), timer 3–5 min + `end_recommended` → `end_session`.
- **Phase 4 — Personnages grisés + appel Max** : grille 2×2 avec Max coloré et Emma/Ava/Léo grisés + cadenas + dialog « indisponible », écran `CallingMaxScreen` (2-3 sonneries ~3 s puis transition auto vers `conversation_max`).
- **Phase 5 — Nouveau questionnaire PRD4** : `QuestionnaireScreenPRD4.tsx` (10 questions PRD §14.2 + email + opt-ins updates/feedback), types `QuestionnairePRD4Answers` / `QuestionnairePRD4Technical` / `QuestionnairePRD4Data`, service `prd4Questionnaire.ts`, calcul automatique des métriques techniques (`duration_seconds`, `turn_count`, `avg_latency_ms`, `max_latency_ms`, `ptt_errors`, `role_profile`, `teaser_seen`, `teaser_skipped`, `transcript_available`), stockage dans `questionnaire_responses` au format `{ version: "prd4", answers, technical }`.
- **Phase 6 — Back-office PRD4** : `SessionsTab` admin enrichi avec une section « Rôle utilisateur » (résumés + JSON repliable) et une timeline `gm_post_turn_log` compacte (badges engagement, role usage quality, confusion, end, modération, latence, sujets, next_turn_guidance).
- **Sync Notion questionnaire PRD4** : `sync-questionnaire` détecte `version: "prd4"` et écrit dans les propriétés Notion exactes (avec accents) de la base *Questionnaire AVA* — `PRD4 A vu le film`, `PRD4 Teaser vu/skippé/utile score`, `PRD4 Rôle création clarté`, `PRD4 Résumé personnage justesse`, `PRD4 PTT clarté/frustration`, `PRD4 Max reconnaît rôle`, `PRD4 Max crédible personnage`, `PRD4 Envie autres personnages`, `PRD4 Personnage souhaité prochain`, `PRD4 Durée ressentie`, `PRD4 Rupture immersion`, `PRD4 Rôle JSON`, `PRD4 Personnage actif`, `PRD4 Durée réelle secondes`, `PRD4 Nb tours`, `PRD4 Latence moyenne/max ms`, `PRD4 Erreurs PTT`, `PRD4 Email contact`, `PRD4 Être tenu au courant`, `PRD4 Contact feedback détaillé`, etc. Filtrage automatique des propriétés absentes via `fetchDatabaseProperties()` (log `skipped_props` dans la réponse) pour éviter toute erreur Notion 400 si la base évolue.
- **Migration** : `sessions.gm_post_turn_log jsonb not null default '[]'`.
- **Events PostHog PRD4** : `role_created`, `character_locked_clicked`, `ptt_error`, `session_ended`.

### Modifié
- Route racine `/` désormais montée sur le parcours PRD4 (`IndexPRD4`). L'admin `/admin` est inchangé.
- `maxAgent.ts` accepte un `UserRoleProfile` en entrée et le préfixe au system prompt avant la persona.
- `conversationOrchestrator.ts` : suppression du GM pré-tour du chemin critique, GM post-turn déclenché en `void` (non bloquant), JSON conforme PRD §10.3.

### Supprimé
- Écrans legacy A/B et route `/legacy` : `OnboardingAScreen`, `OnboardingBScreen`, `ABChoiceScreen`, `OnboardingScreen`, `GateScreen`, `pages/Index.tsx`.
- Côté Notion PRD4, plus aucune écriture vers les anciens champs A/B (`Variante onboarding`, `Modalite voix`, `Duree secondes`, `Email contact`, `Opt-in updates`, `Opt-in feedback`) — uniquement vers les propriétés `PRD4 *` exactes.

### Notes de déploiement
- Les colonnes `PRD4 *` doivent exister dans la base Notion *Questionnaire AVA* (déjà créées côté éditorial). Toute propriété absente est silencieusement ignorée et listée dans `skipped_props`.
- Pipeline STT/TTS/RAG/cost-tracking inchangé : aucun impact attendu sur la latence hors le bénéfice de la suppression du GM pré-tour.
- Hors scope (volontairement reporté) : vraie vidéo teaser, images finales personnages, activation Emma/Ava/Léo, cinématiques, mémoire inter-personnages, split GM.

## [0.22.0] - 2026-05-22 — Robustesse voix multi-navigateurs + garde-fous anti-blocage

### Ajouté
- **Audit technique complet du pipeline vocal Max** : nouveau document `docs/audit_voice_conversation_max.md` couvrant STT, orchestration conversationnelle, TTS, lecture audio navigateur, causes probables Safari/Firefox/Brave/Chrome, budgets de latence et plan d'amélioration priorisé.
- **Utilitaires de robustesse transverses** :
  - `src/services/asyncUtils.ts` : `TimeoutError`, `withTimeout()` et `createTimeoutSignal()` pour limiter les opérations critiques.
  - `src/services/browserCapabilities.ts` : sélection MIME `MediaRecorder` par feature detection et diagnostic navigateur.
  - `src/services/audioPlayback.ts` : audio unlock via `AudioContext`, lecture blob avec timeout, classification `NotAllowedError` / `NotSupportedError` / `AbortError` / réseau.
- **Tests ciblés** :
  - `asyncUtils.test.ts` — timeouts labelisés.
  - `browserCapabilities.test.ts` — sélection MIME STT.
  - `audioPlayback.test.ts` — classification des erreurs de lecture.
  - `tts/queue.test.ts` — statut de drain joué / échoué.
- **Preset TTS basse latence** `realtime_conversation` dans `settingsService.ts` : `eleven_turbo_v2_5`, MP3 64 kbps, `optimizeStreamingLatency=1`, vitesse 1.02.
- **Observabilité voix unifiée PostHog + Supabase** :
  - nouveau service `src/services/voiceTelemetry.ts`;
  - événements PostHog `voice_turn_completed` et `voice_error`;
  - corrélation `turn_id` sur STT, TTS, queue TTS, GM post et erreurs orchestrateur;
  - nouvelles tables internes `voice_turn_events` et `voice_error_events`;
  - audit dédié `docs/posthog_latency_observability_audit.md`.

### Modifié
- **Optimisation latence du hot path Max** :
  - modèle Max live par défaut basculé de `qwen/qwen-2.5-72b-instruct` vers `google/gemini-2.0-flash-001`;
  - normalisation des anciens réglages locaux lents (`qwen 72B`, `llama 70B`, `gemini pro`) vers Gemini Flash pour le chemin live;
  - `LLM_MAX_TOKENS` plafonné à 220 et `top_p` plafonné à 0.9;
  - règle prompt Max resserrée : réponse orale temps réel en 1-2 phrases / 45 mots maximum;
  - RAG live réduit de `top_k=5 / retrieve_k=15` à `top_k=3 / retrieve_k=8`;
  - contexte RAG et `MaxTurnKnowledgeContext` compactés par extrait pour éviter de doubler des centaines de tokens.
- **GM pré-tour retiré du hot path live** : l'appel LLM `planGameMasterTurn()` timeoutait à 4 s et son brief n'était pas injecté dans la génération Max. Le chemin live utilise désormais un brief local instantané pour la trace pipeline ; le planner LLM détaillé reste disponible dans le banc d'essai admin.
- **STT Deepgram durci** (`src/services/deepgramSTT.ts`) :
  - suppression du forçage systématique `audio/webm;codecs=opus`;
  - sélection dynamique parmi `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus`, `audio/mp4`, puis fallback navigateur par défaut;
  - timeout token Deepgram (5 s), permission micro (10 s) et ouverture WebSocket (8 s);
  - callback `onError` avec contexte navigateur/MIME pour remonter les erreurs dans l'UI et PostHog;
  - fenêtre de silence réduite de 1500 ms à 900 ms pour améliorer la latence perçue.
- **Lecture TTS plus robuste** :
  - `playAudioBlob()` passe par `playAudioBlobRobust()` et enrichit les erreurs avec `playbackErrorType`.
  - `TTSQueue.drain()` retourne désormais `{ status, playedSegments, failedSegments, error }` au lieu d'un `void`, ce qui permet de distinguer succès, échec, annulation et skip.
  - `TTSQueue.cancel()` rejette explicitement les segments pending.
- **Pipeline conversationnel** (`src/pages/Index.tsx`) :
  - audio unlock déclenché au moment de répondre, d'activer le micro ou de presser le push-to-talk;
  - erreurs STT affichées en sous-titre et trackées via `stt_error`;
  - GM post-turn protégé par timeout 6 s et fallback neutre (`trust_delta: 0`, pas de trigger/game over);
  - résultat de queue TTS tracké via `tts_queue_result` si non joué;
  - émission en fin de tour de `voice_turn_completed` avec temps réponse prête, voix prête, end-to-end, navigateur, modèle Max, provider TTS, segments joués/échoués et bloqueur dominant.
- **Back-office latence** : l'onglet `Latences (PostHog)` lit désormais aussi `voice_turn_events` / `voice_error_events` pour afficher les p50/p95 agrégés et les erreurs voix récentes.
- **Timeouts réseau** :
  - OpenRouter `streamLLM()` et `callLLMWithUsage()` protégés par `AbortController` 18 s.
  - Providers TTS ElevenLabs, Hume et Inworld protégés par timeout fetch 12 s + timeout `response.blob()` 12 s.

### Vérifié
- `npm test` : 20 tests passants.
- `npx tsc --noEmit` : OK.
- `npm run build` : OK.
- ESLint ciblé sur les fichiers modifiés : OK.
- Validation navigateur locale via Browser plugin : `http://127.0.0.1:8080/` charge correctement, écran d'accueil rendu, interaction `Commencer` → vidéo/skip → choix A/B OK, sans overlay Vite ni erreur applicative. Warnings observés : uniquement les warnings React Router v7 existants.
- Après la capture de latence montrant `LLM total (Max streaming): 15911ms`, seconde passe appliquée pour retirer Qwen 72B du live, supprimer le GM pré-tour LLM du hot path et réduire le volume de prompt/RAG.
- Ajout de tests unitaires `voiceTelemetry.test.ts` pour le calcul de bloqueur, le payload agrégé et la double émission PostHog/Supabase.

### Notes
- Le fallback WebAudio PCM complet pour Safari n'est pas encore implémenté ; cette version réduit fortement le risque en évitant le forçage WebM/Opus, en ajoutant un fallback navigateur par défaut et en rendant les erreurs observables/récupérables.
- Le vrai streaming audio bas niveau via MediaSource/WebAudio chunks reste une étape ultérieure. Le proxy ElevenLabs stream toujours, mais la lecture front reste blob-based avec timeouts.

## [0.21.1] - 2026-05-16 — Fix audio Inworld + coûts $ dans « Consommation Voix »

### Corrigé
- **Inworld TTS — pas de son lors du test** : le bouton « Tester » d'Inworld retournait bien un MP3 mais celui-ci n'était pas joué par le `<audio>` (frames MP3 concaténées via NDJSON difficiles à décoder). Passage à `stream: false` côté provider (`src/services/tts/providers/inworld.ts`) pour récupérer un MP3 monolithique fiable côté navigateur. Le proxy edge function conserve le mode streaming activé pour de futurs usages temps réel.

### Ajouté
- **Coûts $ estimés dans « Consommation Voix »** (`src/components/admin/VoiceUsageTab.tsx`) :
  - Constantes tarifaires publiques par provider (`ElevenLabs $0.30/1k chars`, `Hume $0.20/1k chars`, `Inworld $0.005/1k chars`).
  - 2 nouvelles KPI cards en tête de page : **Caractères TTS** (total période) et **Coût estimé (succès)**.
  - Section coût par carte provider : caractères synthétisés + coût succès (en ambre), plus coût total incluant erreurs si différent.
  - 3 nouvelles colonnes dans le tableau comparatif : **Chars**, **Coût (succès)**, **Coût total**.
  - Note de bas de page rappelant les tarifs indicatifs utilisés.

## [0.21.0] - 2026-05-16 — TTS multi-providers (ElevenLabs / Inworld / Hume) + voix Alain (Inworld) + monitoring « Consommation Voix »

### Ajouté
- **Façade TTS multi-providers** (`src/services/tts/`) : nouvelle architecture découplée avec `types.ts` (interface `TTSProvider`), `registry.ts` (mapping `elevenlabs` / `inworld` / `hume`), `index.ts` (entrée unique `generateSpeech` / `speakText` + télémétrie de latence uniforme), `queue.ts` (file séquentielle provider-agnostique), `textPrep.ts` + `textChunking.ts` (logique partagée de nettoyage markdown et segmentation prosodique).
- **3 providers TTS** implémentés sous `src/services/tts/providers/` :
  - `elevenlabs.ts` — branché sur le proxy existant (voix custom Max).
  - `inworld.ts` — voix **« Alain »** via `inworld-tts-2`, streaming HTTP NDJSON, paramètres `deliveryMode` (STABLE / BALANCED / CREATIVE), `language`, `speakingRate`.
  - `hume.ts` — Hume AI Octave via nouveau proxy edge function.
- **Edge functions proxy** : `supabase/functions/proxy-tts-inworld` (endpoint `/voice:stream`, parsing NDJSON, pipe MP3 directement au client) et `supabase/functions/proxy-tts-hume`. `verify_jwt = false` ajouté dans `supabase/config.toml`.
- **Sélecteur de provider actif global** dans Admin → **TTS Config** (`src/components/TTSConfigTab.tsx`) : un seul provider actif à la fois, persisté en DB + LocalStorage via `src/services/tts/providerSettings.ts` (clés `ava_tts_active_provider`, `ava_tts_settings_<provider>`). Panneau de réglages par provider + bouton **🔊 Tester** par provider.
- **Dashboard monitoring unifié** « Consommation Voix » (`src/components/admin/VoiceUsageTab.tsx`) — agrégation depuis `audio_latencies.metadata_json` :
  - Compteurs requêtes + taux de succès par provider
  - Latences **p50 / p95** (first-byte et total) par provider
  - Distribution des **codes HTTP** (200, 401, 429, 5xx…)
  - Liste des **erreurs récentes** (avec `error_type` + `error_message` complets)
  - Vue comparative côte-à-côte des providers actifs
- **Secrets** : ajout de `INWORLD_API_KEY` et `HUME_API_KEY` côté backend.
- **Renommage onglet** : « Consommation » → **« Consommation LLM »** pour distinguer du nouveau « Consommation Voix ».

### Modifié
- `src/services/elevenLabsTTS.ts` : converti en **shim de compatibilité** vers la nouvelle façade — aucun import existant cassé.
- `src/pages/Admin.tsx` : nouvel onglet **TTS Config** (remplace `VoiceConfigTab`), nouvel onglet **Consommation Voix** sous la section Technical.
- Proxy Inworld : correction d'un **401** dû à un double encodage base64 de `INWORLD_API_KEY`.

### Supprimé
- `src/components/VoiceConfigTab.tsx` — remplacé par `TTSConfigTab` multi-providers.

### Notes
- Le pipeline real-time reste sur ElevenLabs par défaut ; bascule vers Inworld (Alain) ou Hume se fait sans redéploiement via Admin → TTS Config.
- Le monitoring se peuple automatiquement (pas de migration DB requise — `metadata_json` était déjà persisté).

## [0.20.1] - 2026-05-14 — Banc d'essai « Lancer le banc » + traçabilité du system prompt Max

### Ajouté
- **Bouton 🧪 « Lancer le banc »** dans `MaxPromptTestTab` : pré-remplit un scénario complet (historique multi-tours ambigu sur la disparition d'Ava + résumé de session compressé) et déclenche `handleRun` avec query rewrite + rerank + mémoire de session injectée. Permet de valider en un clic les trois leviers RAG v2.
- **Champ `sessionSummary`** (textarea) dans les inputs du banc d'essai pour injecter manuellement une mémoire de session arbitraire.
- **Affichage de la requête réécrite** dans la chronologie du banc (étape « 0. Query rewrite » : original → réécrite + flag `rewritten`).
- **Colonne `rerank_score` Voyage et badge `embedding_provider` par chunk** dans l'accordéon RAG du banc d'essai (en plus de `retrieval_similarity` brute et du score final).
- **Badge de traçabilité du system prompt** dans le panneau d'édition Admin (`/admin?tab=characters`) : affiche `🆔 character.id`, `🕒 updated_at` UTC, `# hash FNV-1a 32-bit` du prompt chargé en DB, et `✎ #hash` de l'édition courante (passe en ambre si différent du DB). Permet de vérifier visuellement que le prompt provient bien de la ligne DB attendue.
- **Vérification post-save** : après `update`, re-lecture de `system_prompt` + `updated_at` depuis la DB, comparaison stricte avec la valeur envoyée, propagation du nouveau `updated_at` à l'état local.
- **Mini-protocole de test** ajouté au `README` pour rejouer query rewrite + rerank + mémoire de session avec les toggles à activer.

### Modifié
- `maxAgent.ts` : `MaxAgentInput.sessionSummary` propagé aussi par `simulateMaxResponse` (pas seulement par `callMaxAgent`).
- `Admin.tsx` : query `characters` enrichie de `updated_at` ; helper `promptHash()` (FNV-1a 32-bit) ajouté pour fingerprint visuel.

### Vérifié (audit centralisation system prompt Max)
- **Write** : `Admin.tsx` → `update({ system_prompt }) on characters` + `clearSystemPromptCache()`.
- **Read** : `maxAgent.ts:getCharacterSystemPrompt()` lit `select system_prompt from characters where name = ?` (cache mémoire + preload). Utilisé par `callMaxAgent` (live) **et** `simulateMaxResponse` (banc d'essai) — donc les éditions admin sont propagées partout.
- **Protection sync Notion** : `sync-notion/index.ts:325` préserve `existingCharacter.system_prompt` à chaque upsert. Conforme à la règle « Never overwrite local system prompts via Notion sync ».
- **Limite connue** : le cache `cachedSystemPrompts` est par onglet/process. Une édition dans un onglet n'invalide pas un autre onglet déjà chargé tant qu'il n'est pas rechargé. Cross-tab invalidation (Supabase Realtime sur `characters` ou `BroadcastChannel`) à envisager si besoin.

## [0.20.0] - 2026-05-10 — RAG v2 : Voyage AI + query rewriting + mémoire de session compressée

### Ajouté
- **Embeddings Voyage AI (`voyage-3`, 1024 dim)** en parallèle d'OpenAI :
  - Nouvelle colonne `embedding_v vector(1024)` sur `embeddings` + `embedding_provider` (`openai` / `voyage`)
  - Re-sync complète des 4 bases Notion avec génération double-provider à la demande
  - Edge function `query-rag` enrichie : sélection du provider (`provider`) + override `retrieve_k`
- **Reranker Voyage `rerank-2.5`** appliqué après retrieval vectoriel :
  - Champs `retrieval_similarity` (cosinus brut) et `rerank_score` (score Voyage) exposés sur chaque `RAGMatch`
  - Toggle `RAG_RERANK_ENABLED` dans `settings.json`
- **Filtrage strict par personnage** : `character_id` propagé sur les chunks RAG ; les chunks scopés sont filtrés par personnage actif, les chunks partagés (`storyworld`, `rules`) restent visibles à tous.
- **Index HNSW** (`m=16, ef_construction=64`) sur `embedding` et `embedding_v` en remplacement des `ivfflat` — corrige le scoring quasi-nul observé sur petits datasets.
- **Query rewriting LLM** — nouvelle edge function `rewrite-query` (gemini-3-flash-preview) qui transforme « et toi ? » en requête autonome avant appel RAG. Gating via `RAG_QUERY_REWRITE_ENABLED`. Intégré dans `conversationOrchestrator` et exposé dans `MaxPromptTestTab`.
- **Mémoire de session compressée** :
  - Nouvelle table `session_summaries` (session_id, summary, last_turn)
  - Edge function `summarize-session` (gemini-3-flash-preview) : résumé en bullet points (Faits, Sujets, Promesses) déclenché tous les `RAG_SUMMARY_EVERY_N_TURNS` (4) tours en fire-and-forget
  - Service `sessionMemoryService.ts` (fetch + déclenchement asynchrone)
  - Injection automatique dans le prompt système Max sous `## SOUVENIRS DE LA SESSION`
- **Banc d'essai Max enrichi** :
  - Nouvelle étape « 0. Query rewrite » dans la chronologie (original → réécrite)
  - Badge `embedding_provider` (+ `rerank` si actif) sur l'accordéon RAG
  - Par chunk : badge `character_id` (ou `shared`), `rerank_score` Voyage, `retrieval_similarity` brute, score final

### Modifié
- `ragService.ts` : `RAGMatch` étendu (`retrieval_similarity`, `rerank_score`, `character_id`) ; `RAGQueryOptions` (provider, rerank, retrieveK, characterId, rewrittenQuery) ; nouvelle helper `rewriteRAGQuery()`.
- `maxAgent.ts` : `MaxAgentInput` accepte `sessionSummary` ; `buildMaxSystemPrompt` injecte le bloc « SOUVENIRS » avant l'historique récent.
- `conversationOrchestrator.ts` : pipeline étendu — rewrite optionnel → RAG (avec query réécrite) → summary fetch parallèle → résumé background tous les N tours.
- `supabase/config.toml` : déclaration des nouvelles edge functions `rewrite-query` et `summarize-session`.

### Migrations
- `20260510115532_*` — ajout `embedding_v`, `embedding_provider`, `character_id` + RPC `match_embeddings_v`
- `20260510121928_*` — remplacement des indexes `ivfflat` par HNSW

### Notes
- Aucun secret supplémentaire visible côté front (clés Voyage stockées en backend uniquement).
- Les anciennes fonctions et les chunks OpenAI restent fonctionnels en fallback transparent.
- **Bug majeur résolu en cours de route** : retrieval Voyage retournait quasi rien à cause d'un index `ivfflat lists=100` sur ~226 vecteurs (scoring quasi-aléatoire). Fix : passage en HNSW.

## [0.19.0] - 2026-05-08 — Banc d'essai complet « Test de réponse Max »


### Ajouté
- **Banc d'essai d'inspection du pipeline Max** — refonte complète de l'onglet `MaxPromptTestTab` en outil de fine-tuning éditorial qui rejoue un tour réel étape par étape :
  - **Inputs enrichis** : sélecteur de personnage (depuis la table `characters`), phrase utilisateur libre, historique simulé parsé (`USER: ... / MAX: ...`), paramètres avancés repliés (`RAG_TOP_K`, `RAG_THRESHOLD`, `currentTrustLevel`, `triggeredIds`, `timeElapsedSeconds`)
  - **Chronologie verticale du pipeline** — 5 étapes visuelles avec statut (`pending` → `running` → `ok/error/skipped`), durée en ms, modèle utilisé, tokens in/out/total : (1) RAG query, (2) Knowledge build, (3) GM pré-tour, (4) Max response, (5) Validateur. Totaux cumulés (latence + tokens) affichés en pied de chronologie.
  - **Détails RAG dépliables** — tableau des `RAGMatch` bruts avec `source_table`, `source_id`, extrait textuel et badge de similarité (couleur selon le score), plus message d'erreur explicite si le quota OpenAI embeddings est épuisé.
  - **Contexte injecté décomposé** — quatre blocs visuels : `allowed_facts`, `active_memories`, `hypotheses`, `forbidden_topics` / `blocked_assertions`, permettant d'auditer exactement ce qui est chargé dans le prompt.
  - **Brief GM pré-tour** — JSON formaté du `GameMasterTurnBrief` (`response_mode`, `openness_level`, `reveal_budget`, `style_instructions`, `trust_change`, `video_trigger_id`) avec badge fallback éventuel (timeout / no_json / llm_error).
  - **Prompt système final** — vue texte intégral du `systemPrompt` réellement envoyé à Max, avec compteur de caractères et estimation de tokens (`estimateTokens`).
  - **Réponse Max + diagnostic validateur** — texte généré, badge de conformité (vert/rouge/orange), liste explicite des `violations` et `safe_points`, tokens Max vs tokens validateur, bouton « Régénérer avec prudence ».
  - **Export JSON** — téléchargement du trace complet (inputs, résultats de chaque étape, prompts bruts, usages) pour analyse externe ou tickets.
  - **Presets rapides** — 3-4 scénarios pré-écrits accessibles en un clic pour tester des configurations typiques.
- **Instrumentation détaillée des appels LLM** (variantes additives, zéro régression sur le pipeline temps réel) :
  - `openRouterLLM.ts` : `callLLMWithUsage()` retourne `{ content, usage, generationId, model, latencyMs }`
  - `ragService.ts` : `queryRAGDetailed()` expose les matches bruts et la latence réelle de l'edge function
  - `maxAgent.ts` : `simulateMaxResponse()` retourne `{ response, systemPrompt, usage, latencyMs, model }` ; `validateMaxResponseDetailed()` retourne `{ result, usage, latencyMs, model, validatorPrompt }`
  - `gameMasterAgent.ts` : `planGameMasterTurnDetailed()` retourne `{ brief, usage, latencyMs, model, systemPrompt, userPrompt }` (sans timeout dur, pour mesurer la latence réelle en test)
- **Nouveau service `maxTestPipeline.ts`** — orchestrateur de test UI-only qui exécute séquentiellement les 5 étapes (RAG → Knowledge → GM Pre → Max → Validator) avec mise à jour incrémentale de l'état (`onUpdate`) pour rendu temps réel. Gestion du `skipRAG`, `skipGM`, `skipValidator`. Parseur d'historique libre (`parseHistory`).
- **Document de plan** : `docs/plan_max_test_inspector.md` — spécification complète du flux de simulation, des modifications backend et de la refonte UI.

### Modifié
- `MaxPromptTestTab.tsx` : refonte intégrale du simple simulateur de réponse en banc d'essai pipeline complet (voir Ajouté).
- `Admin.tsx` : raccordement du nouvel onglet avec le selecteur de personnage dynamique.

### Notes
- Aucune migration DB, aucune nouvelle edge function. Toutes les variantes détaillées (`*Detailed`) coexistent avec les fonctions prod existantes sans modifier `conversationOrchestrator.ts`.
- Le tracking des coûts LLM fonctionne pour les appels de test via la `feature_key` dédiée `max_prompt_test_full`.

## [0.18.0] - 2026-05-02 — Diagnostic latence enrichi + guide Game Master

### Ajouté
- **Analyse factuelle des latences au survol des segments** (`LatencyBlockingTab`) :
  - `STEP_BUDGET_MS` : cibles de référence par étape (RAG 250 ms, GM pre 400 ms, Max LLM 800 ms, TTS 600 ms, validateur 500 ms, GM post 400 ms)
  - `STEP_HYPOTHESES` : pistes d'optimisation actionnables par étape (streaming token-per-token, switch modèle, cache RAG, etc.)
  - `computeBaselines` (`useMemo`) : calcule moyenne, médiane et **p95** sur l'ensemble des sessions visibles pour donner un contexte comparatif
  - `analyzeStep` : produit une sévérité (`ok` / `high` / `critical`) basée sur le budget, un ratio vs médiane et un drapeau "outlier ≥ p95"
  - Tooltip Radix UI riche par segment avec badge de sévérité + diagnostic + hypothèses
- **Panneau latéral détaillé au clic sur un segment** (`SegmentDetailSheet` via Shadcn `Sheet`) :
  - Contexte tour/session, badge sévérité
  - Métriques : durée mesurée vs **budget cible**, **part du tour** en %
  - Benchmarking sur le dataset visible : médiane, p95, moyenne
  - Liste d'hypothèses techniques pour réduire la latence sur ce step précis
  - Sélection partagée via `SegmentSelection`, segments transformés en boutons accessibles (`aria-label`)
- **Filtre de sévérité minimum** dans le bandeau de comparaison :
  - Type `SeverityFilter` (`all` / `high` / `critical`) + `SEVERITY_RANK`
  - Dropdown "Sévérité min." avec options "Toutes", "Élevée et plus", "Critique uniquement"
  - Les segments sous le seuil sont visuellement atténués (opacité 25 % + grayscale) tout en restant cliquables
- **Guide Game Master** : nouveau document `documents/guide_game_master_contenus_et_tests.md` — tutoriel complet pour rédiger les prompts, variables et choix de gameplay du GM, avec hypothèses, variantes à tester (technique + UX) et paramètres-clés à arbitrer

### Modifié
- `LatencyBlockingTab` : `StackedRow` reçoit `onSelectSegment`, calcul `dimmed` selon le filtre actif, segments rendus comme `<button>` interactifs
- État de sélection de segment remonté à `LatencyVisualization`
- Calculs d'analyse 100 % côté client sur des données déjà chargées : aucune latence ajoutée au pipeline conversationnel

### Notes
- Aucune migration DB ni appel réseau supplémentaire pour l'analyse de latence (purement dérivé de `pipeline.*_ms` déjà persisté)

## [0.17.0] - 2026-04-25 — Visualisation comparative des latences réelles par session et par tour

### Ajouté
- **Comparaison visuelle multi-sessions dans "Latence & blocage"** :
  - Une barre empilée **par session sélectionnée** (RAG / GM pre-turn / Max / Validateur / TTS / GM post-turn) sur une échelle commune
  - **Barres dépliables par tour** : chaque session peut être ouverte via un chevron pour afficher une barre par tour individuel (`Tour #N`), avec le blocker du tour s'il y en a un
  - **Marqueur de cible 2 s** positionné de manière cohérente sur toutes les barres (session + tours)
  - **Indicateur de dispersion** par session : bracket min–max sur la barre + badge `[min – max] · σ` dans l'en-tête (écart-type sur le total des tours)
  - **Auto-dépliage** : cliquer sur une session dans la liste la coche, la focalise et déplie automatiquement ses barres de tours
  - **Répartition relative (moyenne)** activable via toggle, calculée sur les sessions cochées uniquement
- **Filtres de session** dans le panneau de gauche :
  - Période (Toutes / 24h / 7 jours / 30 jours / personnalisée avec dates)
  - Nombre minimum de tours Max
  - Filtre blocage (Toutes / Avec blocage / Sans blocage)
  - Bouton "Réinitialiser les filtres" + compteur `Sessions (n / total)`
- **Sélection multi-sessions** via cases à cocher + boutons "Tout" / "Aucune" (limités aux sessions visibles après filtres)
- **Mini-graphique GM fallback** (`SessionsTab`) : comparaison `elapsed_ms` vs `timeout_ms` sur les derniers fallbacks Game Master pour visualiser les dépassements

### Modifié
- `LatencyVisualization` refactorée : présente exclusivement les **données réelles** des sessions (plus d'estimations best/moyen/pire). Une seule barre par session, autant de lignes que de sessions cochées.
- `scaleMax` recalculé dynamiquement pour intégrer la plus longue valeur (moyenne session, max de dispersion, max d'un tour individuel ou cible 2 s).
- État `expandedIds` remonté au composant parent pour permettre l'auto-dépliage depuis la liste de sessions.

### Notes
- Aucune migration DB. Toutes les données viennent du `pipeline.*_ms` déjà persisté dans `conversation_log`.

## [0.16.0] - 2026-04-24 — Performance pipeline, panneau latence et accès admin protégé

### Ajouté
- **Panneau admin "Latence & blocage"** (`LatencyBlockingTab`) : visualisation du temps passé à chaque étape du pipeline conversationnel
  - Vue globale : moyenne et max par étape (RAG, GM pre-turn, Max, validateur, TTS, GM post-turn) sur les 50 dernières sessions
  - Vue détail par session : timeline tour par tour avec identification du **dernier point de blocage** (étape la plus lente au-dessus du seuil)
  - Seuils de détection : RAG > 1.5s, GM > 1.5s, Max > 3s, validateur > 2s, TTS > 4s
- **Instrumentation des timings du pipeline** :
  - Nouveau type `ConversationPipelineTimings` (rag_ms, gm_pre_ms, max_ms, validator_ms, tts_ms, gm_post_ms, total_ms)
  - Nouveau champ `pipeline` sur `ConversationMessage`, persisté dans `conversation_log`
  - L'orchestrateur mesure RAG / GM pre-turn / boucle Max+validateur (retries inclus)
  - `Index.tsx` mesure le TTS et calcule le total du tour
  - Utilitaire `pickBlocker` qui flagge l'étape la plus lente dépassant les seuils
- **Protection mot de passe pour `/admin`** :
  - Nouveau composant `AdminAuthGate` avec écran de login (utilisateur `game-master`, mot de passe `jesuisdieu`)
  - Persistance via `sessionStorage` (clé `admin_auth_ok`) — survit au rechargement de l'onglet
  - Bouton "Déconnexion" en haut à droite du dashboard admin
  - Sécurité légère : objectif = éviter les accès accidentels via URL connue, pas une protection forte

### Modifié
- **Orchestrateur de conversation** : parallélisation `planGameMasterTurn` (GM pre-turn) et `simulateMaxResponse` (Max) via `Promise.all` pour réduire la latence
  - Max consomme désormais le contexte RAG initial (rapide) et la validation post-génération s'appuie sur le brief GM
  - Économie typique : ~2-5s par tour selon le modèle LLM
- **Validateur anti-hallucination — fail-open** :
  - Timeout dur `VALIDATION_TIMEOUT_MS = 4000` : si la validation dépasse 4s, la réponse est libérée avec une trace `fail-open sur timeout`
  - Si le LLM validateur renvoie un JSON malformé ou erreur, l'agent retourne `compliant: true` au lieu de bloquer
  - Les bypass restent visibles dans `HallucinationMetricsTab` pour audit
- **`App.tsx`** : route `/admin` désormais wrappée dans `<AdminAuthGate>`
- **`Admin.tsx`** : ajout de l'onglet "Latence & blocage"

### Notes
- Le `pipeline` étant stocké dans `conversation_log` (jsonb), aucune migration DB nécessaire
- Le mot de passe est en clair dans le code — protection volontairement faible (anti-curieux, pas anti-attaquant)

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
