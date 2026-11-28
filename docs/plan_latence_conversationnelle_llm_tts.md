# Plan — Réduire la latence conversationnelle d'Ava (LLM, TTS, orchestration)

Tâche Notion : [Réduire la latence conversationnelle AVA — LLM, TTS et orchestration](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab, 🔥🔥🔥🔥).
Statut (27 novembre 2026) : **lot 1 et lot 1 bis (iPhone) livrés (code), mesure iPhone après synchro Lovable à faire par Ulrich ; lot 2 terminé, recommandation : garder gpt-5.6-luna avec le routage `provider.sort: "latency"` ([rapport](eval/banc_llm_latence_20261126.md)). Décision d'Ulrich (27 nov.) : oui au routage ; lot 3 à lancer.** Reprise : [prompt du lot 3](prompt_reprise_latence_conversationnelle_lot_3.md).
Règle : **un lot à la fois**. Chaque lot est livré selon le contrat d'Ava, puis s'arrête avec le prompt de reprise du lot suivant ; le lot suivant ne commence que sur nouvelle demande d'Ulrich.
Historique utile : [analyse Tavus T1-T9](analyse_latence_tavus_20261119.md), [évaluation du LLM streamé](evaluation_llm_streame_vers_tts.md).

## Contexte

Ulrich ressent encore une attente trop longue entre la fin de sa parole et la réponse de l'avatar. Les lots T1 à T9 (19-21 nov.) ont déjà traité le flux PCM vers Tavus, l'attente de passage, le RAG en parallèle et le rerank (conservé). Le levier « LLM streamé » existe pour Tavus (`streamedLlm`), il est désactivé par défaut et n'a jamais été mesuré correctement.

### Référence mesurée (voice_turn_events, 7 derniers jours, tours complétés, médianes depuis le transcript final)

| Sortie | n | RAG | LLM (gpt-5.6-luna) | Réponse prête | Premier son | p90 premier son |
|---|---|---|---|---|---|---|
| Voix seule (ElevenLabs `eleven_v4_turbo`) | 120 | 0,71 s | 2,06 s | 3,27 s | **5,26 s** | 6,46 s |
| Tavus (voix d'Ava, PCM) | 113 | 0,73 s | 1,95 s | 3,24 s | **3,96 s** | 5,82 s |
| Anam | 4 | 1,32 s | 2,04 s | 3,67 s | 4,17 s | – |

Le chronomètre ne compte pas la fin de parole avant la décision : 0,9 s de silence (1,6 s si la phrase semble inachevée), plus la finalisation Deepgram.

### Constats

1. **Anomalie en voix seule : 2,0 s entre la réponse prête et le premier son** (contre ≈ 0,35 s de premier octet mesuré en flux PCM pour Tavus). La voix seule est plus lente que la vidéo. C'est probablement un blob REST ou une réponse entière synthétisée avant lecture (`chunkTextForTTS` envoie jusqu'à 900 car. en une requête). C'est le plus gros gain, le plus sûr.
2. **LLM : 2,0 s pour 2,8 k tokens en entrée et 58 en sortie.** C'est presque entièrement du délai avant le premier token, pas du débit. Points relevés : appel non streamé par défaut (`http_batch`), aucune préférence de fournisseur OpenRouter (`provider.sort`), aucun cache de prompt utilisé ni mesuré (`llm_usage` n'enregistre ni latence ni tokens en cache).
3. **Préfixe du prompt** (`optimized_v3`) : le contrat et le noyau protégé viennent en tête, plus de 2 k tokens probablement stables. Mais certains fragments du noyau sont choisis selon la question, et le contrat de flux est ajouté en fin. Le cache implicite OpenAI/Gemini est donc à vérifier et à mesurer, pas à supposer.
4. **Mémoire longue** : en `optimized_v3`, l'historique gardé mot pour mot est de 1 200 car. (≈ 2 échanges), complété par la mémoire structurée du GM (1 200 car.). Si le dernier échange dépasse 1 200 car., aucun historique n'est envoyé (`conversationMemory.ts:36-56`). Le résumé de session n'est pas injecté en `optimized_v3`. Tout changement de LLM doit passer un test de rappel en conversation longue.
5. **Interruption** : l'interruption acoustique réversible n'existe que pour Gradium incrémental. Ailleurs, c'est la stratégie « texte » qui s'applique. Chaque fournisseur vidéo a sa commande d'interruption, et l'appel LLM est annulé par signal. Le flux LLM ne doit rien changer à ce comportement.
6. GM post-tour, résumé et validation sont hors du chemin critique, sauf sur un tour de passage (garde voulue, à ne pas toucher).

### Décisions d'Ulrich (26 nov.)

- Optimiser toutes les sorties, la voix seule d'abord.
- Banc d'essai ouvert à tous les LLM d'OpenRouter : Gemini Flash et Flash-Lite, fournisseurs ultra-rapides (Cerebras, Groq), Claude Haiku et GPT-5 mini, Mistral. Signaler tout fournisseur hors OpenRouter nettement meilleur en latence.
- LLM streamé activable par défaut sur toutes les sorties si la mesure le justifie : gain > 0,5 s sans phrase retirée ni relance, réversible par réglage.
- Fin de parole plus courte (0,6-0,7 s) en essai sandbox, réversible.

## Garde-fous communs à tous les lots

- Pas de régression : interruption (barge-in) intacte sur chaque sortie, pas de coupure ni d'artefact dans le flux, passage de personnage inchangé, cinématiques inchangées (invariants de fin d'AGENTS).
- Qualité : fidélité aux personnages et factualité au juge (`eval:judge`, bruit ≈ 0,6-1,4 pt). Aucun gain n'est déclaré sans mesure comparable. Écoute humaine d'Ulrich avant toute validation artistique.
- Mémoire : test de rappel en conversation longue (≈ 15 min, ≈ 40 tours) avant tout changement de modèle.
- Fiches personnages (Base Caractères Notion) en lecture seule, corpus intact. Coordination avec la tâche « Supprimer la coupure des prompts » : on ne modifie pas l'ordre ni le contenu des sections sans mesure de qualité.
- Sandbox uniquement (sandbox-ulrich). Production : validation distincte. Les appels payants restent bornés : on annonce le coût estimé d'un run avant de le lancer.
- Les commandes `eval:*` utilisent `.env.eval.local` : l'agent prépare et vérifie les scripts, Ulrich lance les runs payants et l'agent lit les résultats.

## Lots

### Lot 1 — Voix seule : supprimer les 2 s entre la réponse et le premier son (à faire en premier)

1. Diagnostic sur `voice_turn_events` et le code : `tts_text_sent`, `first_audio_chunk`, `audio_blob_ready` et `audio_scheduled` des tours en voix seule ; chemin réellement pris dans `LocalTTSOutput.renderText` → `TTSQueue` → `generateSpeech` / `tryCreateStreamingPlayback` (`src/services/tts/index.ts`, `queue.ts`, `elevenLabsStreamPlayer.ts`, `textChunking.ts`). Il s'agit de savoir si on attend un blob complet, une réponse entière de 900 car. ou un repli MediaSource.
2. Correction : la première ligne part en flux comme pour Tavus en T1. On réutilise `elevenLabsPcmStream.ts` (`pcm_24000`, déjà éprouvé) ou le flux MP3 MediaSource existant. La réponse est découpée en phrases pour que la première phrase parte seule, en réutilisant `chunkTextForTTS` avec une première tranche courte. Les lignes suivantes sont préchargées. Repli sur le chemin actuel si le flux échoue avant le premier octet. `abort` en cas d'interruption.
3. Tests : flux et repli, interruption pendant le flux, ordre des lignes, Gradium et autres fournisseurs inchangés (`tts/queue.test.ts`, `elevenLabsStreamPlayer.test.ts`, `textChunking.test.ts`, `localTtsOutput`).
4. Mesure sandbox-ulrich, au moins 10 tours en voix seule. Visé : écart réponse → son ≤ 0,6 s, premier son médian ≤ 3,8 s, aucun repli supplémentaire, écoute d'Ulrich (pas de coupure entre phrases).

**Résultat du lot 1 (26 nov., livré en code, mesure réelle à faire)**

Diagnostic (`voice_turn_events`, 7 jours, 120 tours voix seule complétés, écart = `output_estimated` − `llm_response`) :

| Environnement, appareil | Transport TTS | n | Écart réponse → son | Premier son |
|---|---|---|---|---|
| sandbox-ulrich, ordinateur | `http_stream` (MP3 MediaSource) | 22 | 0,42 s | 3,47 s |
| sandbox-benoit, ordinateur | `http_stream` | 10 | 0,43 s | 3,34 s |
| sandbox-romed, ordinateur | `rest` (blob complet) | 70 | **2,35 s** | 5,34 s |
| sandbox-ulrich, iPhone | `rest_fallback` (blob complet) | 18 | **1,94 s** | 5,00 s |

- Le flux MP3 MediaSource (L1.1) marche déjà où il est possible : 0,42 s d'écart, premier octet à 0,37 s. La médiane de 2,0 s venait de deux cas où il ne l'est pas : un navigateur sans MediaSource MP3 (`createStreamingPlayback` rend null, donc blob REST), et l'iPhone une fois `<audio>` refusé hors geste (le blob passe par Web Audio après la réception complète).
- Correctif : `src/services/tts/elevenLabsPcmPlayer.ts` lit le flux `pcm_24000` de T1 (`openElevenLabsPcmStream`) et le programme sur l'AudioContext partagé au fil de l'arrivée (pré-tampon 200 ms, re-tampon 120 ms, tranches de 100 ms contiguës). `providers/elevenlabs.ts` le choisit seulement quand le MP3 MediaSource n'est pas utilisable ; ailleurs, rien ne change. Aucun troisième mécanisme réseau : même flux PCM que Tavus.
- Repli : échec avant tout son (requête, flux coupé, flux vide), alors une requête REST et la lecture du blob actuel ; AudioContext refusé, alors le PCM reçu est lu en un WAV. Après le premier son, une coupure est signalée, jamais rejouée. `cancel()` abandonne le fetch et arrête les sources (barge-in, `TTSQueue.cancel`).
- Télémétrie : `first_audio_chunk`, `audio_scheduled`, `audio_blob_ready` et transport `http_stream_pcm` (service et `audio_latency`), visibles dans Qualité › Latence.
- Première tranche courte **non appliquée** : avec le flux, le premier son ne dépend pas de la longueur de la ligne (0,42 s mesuré en MSE avec les lignes actuelles jusqu'à 900 car.). Couper davantage aurait changé la prosodie et l'enchaînement sans gain mesurable.
- Tests : `elevenLabsPcmPlayer.test.ts` (11 cas : flux contigu, pré-tampon, ouverture différée, repli avant premier octet, pas de repli sur erreur client, coupure après le son, annulation, signal parent, contexte suspendu, flux vide) et `providers/elevenlabs.streaming.test.ts` (choix MSE ou PCM ou blob).
- À mesurer après fusion et synchro Lovable (Ulrich) : au moins 10 tours voix seule sur iPhone (sandbox-ulrich) et sur le poste de sandbox-romed. Visé : transport `http_stream_pcm`, écart ≤ 0,6 s, premier son médian ≤ 3,8 s, aucun repli supplémentaire, aucune coupure entendue entre phrases.

**Lot 1 bis (26 nov., iPhone encore lent, correctif livré en code)**

- Mesure d'Ulrich après fusion (sandbox-ulrich, iPhone, mains libres, 19:16-19:24 UTC, 16 tours) : transport `rest_fallback` sur tous les tours, aucun `http_stream_pcm`, écart 2,27 s.
- Lecture SQL (`audio_latencies`, `voice_turn_events`, session `91680ea9…`) : le premier octet du flux MP3 arrive ≈ 0,35 s après `llm_response`, le MP3 complet ≈ 2 s ; `audio_scheduled` suit `audio_blob_ready` de ≈ 40 ms à chaque tour. Le handle MP3 MediaSource a donc échoué vite et avant tout son (le délai de blocage est de 15 s), puis a lu le blob complet. Ce n'est pas un refus de lecture `NotAllowedError` : il aurait basculé les tours suivants en PCM. Même essai sur ordinateur (session `122d6a1a…`, 19:27) : son ≈ 25 ms après le premier octet, `http_stream`.
- Hypothèse d'un ancien bundle : non nécessaire. Le code du lot 1 donne exactement ce résultat, car sa condition (pas de MediaSource MP3, ou `<audio>` refusé) n'était jamais vraie sur cet iPhone, qui expose ManagedMediaSource. `code_version` est une constante et ne permet pas de dater le bundle.
- La cause exacte de l'échec MSE (erreur `<audio>`, SourceBuffer, `appendBuffer` ou `play()`) n'était pas enregistrée : elle l'est maintenant dans `audio_latencies.metadata_json.fallback_reason` (`mse: …`, `request: …`, `pcm: …`, `no_readable_body`).
- Correctif (`elevenLabsStreamPlayer.ts`, `providers/elevenlabs.ts`) : le PCM est choisi d'emblée quand seul ManagedMediaSource lit le MP3 (iPhone ; Safari macOS et iPad gardent MediaSource). Un échec MSE avant tout son est mémorisé pour la page, et les lignes suivantes passent en PCM. Le chemin MSE des ordinateurs reste inchangé. Le lecteur PCM garde son propre repli REST.
- Tests : routage après échec MSE et sur moteur ManagedMediaSource seul, mémoire d'échec non déclenchée par un flux qui joue ni par une panne réseau, raison du repli (MP3 et PCM), détection du moteur.
- À mesurer (Ulrich, après synchro Lovable) : au moins 10 tours voix seule sur iPhone. Visé : transport `http_stream_pcm`, écart ≤ 0,6 s, aucune coupure entendue. Si le PCM lui-même se replie, `fallback_reason` dira pourquoi.

### Lot 2 — Banc d'essai LLM (mesure seule, aucun changement de réglage)

1. Nouveau script `npm run eval:llm-latency` (sous `scripts/eval-judge/`, comme les autres) :
   - il rejoue de vrais prompts de Max et Emma (assemblés par le vrai compilateur `optimized_v3` à partir des questions du corpus de `eval:judge`) en flux via `proxy-llm` ;
   - il mesure le délai au premier token, à la première phrase sûre (`ResponseIntentParser`) et à la fin, le taux d'en-tête d'intent valide, les tokens en cache (`usage.prompt_tokens_details.cached_tokens` d'OpenRouter) et le coût ;
   - 3 répétitions par modèle, médiane et p90.
2. Candidats :
   - `gpt-5.6-luna` (référence), avec et sans `provider.sort: "latency"` ;
   - Gemini 2.5 Flash et Flash-Lite, raisonnement coupé (le chemin personnage n'envoie pas aujourd'hui `disable_reasoning`) ;
   - gpt-oss-120b et Llama 4 sur Cerebras et Groq ;
   - Claude Haiku, GPT-5 mini, Mistral (Small et Medium) ;
   - au besoin, d'autres modèles de la liste OpenRouter vérifiée au moment du lot.
   - Élargir `ALLOWED_MODEL_PREFIXES` de `proxy-llm` seulement si un candidat l'exige.
3. Cache : mesurer le taux de tokens en cache par modèle. Vérifier ce qui casse la stabilité du préfixe : sélection des fragments du noyau, contrat de flux ajouté en fin.
4. Fournisseurs hors OpenRouter : comparer l'appel direct, par exemple Cerebras, Groq ou Gemini en direct, pour mesurer le surcoût OpenRouter (≈ 30-100 ms attendus). Signaler seulement, pas d'intégration.
5. Qualité : `eval:judge --candidate-json` sur les 2 à 3 meilleurs en latence. Coût annoncé avant lancement (≈ 3 $ par run de 126 tours). S'y ajoute le nouveau test de rappel en conversation longue : un scénario scripté de ≈ 40 tours avec des faits donnés tôt et redemandés tard. Il est rejoué par modèle avec la vraie mémoire structurée.
6. Livrable : rapport `docs/eval/banc_llm_latence_<date>.md` avec une recommandation chiffrée (latence, qualité, mémoire, coût).

**Résultat du lot 2 (26 nov., outils livrés, runs complets à faire par Ulrich)** — [rapport](eval/banc_llm_latence_20261126.md)

- `npm run eval:llm-latency` : `--compile-only` assemble les vrais prompts (chaîne `processPRD4Turn`, appel au personnage intercepté avant l'envoi, RAG seul), puis `--prompts @…` les rejoue en flux via `proxy-llm` pour 14 candidats : premier token, première phrase sûre (`ResponseIntentParser`), fin, intent valide, cache, raisonnement, coût facturé ; médiane et p90. ≈ 0,5 $ le run complet.
- `npm run eval:llm-recall` : scénario de 40 tours par personnage ([rappel_long_v1.json](eval/rappel_long_v1.json)), 7 faits donnés aux tours 1-9 et redemandés aux tours 30-40, chaîne réelle avec la mémoire structurée. Notation lexicale. ≈ 0,15 $ par modèle et par personnage.
- `proxy-llm` accepte un champ `provider` filtré (`sort`, `only`, `order`, `allow_fallbacks`), envoyé par le banc seulement. Le payload d'Ava est inchangé. Il est actif après redéploiement par Lovable.
- Échantillon réel (4 prompts, gpt-5.6-luna en flux) : 1er token 0,77 s, **1re phrase sûre 1,28 s**, fin 1,91 s, intent 100 %. Prompts réels de 4,6 à 5,5 k tokens (et non 2,8 k).
- Préfixe : commun sur 2,7 k tokens (Max, le noyau choisit « VOIX ET POSTURE » selon la question) et 3,6 k tokens (Emma, directive relationnelle du tour). Le contrat de flux est en fin, donc jamais en cache. 0 token en cache sur l'échantillon. Rien n'a été modifié.
- Constats : Llama 4 n'est plus sur Cerebras ni Groq ; `LLM_TEMPERATURE = 1,4` est ignoré par luna mais s'appliquerait à un autre modèle (le banc envoie 0,8 / 0,95) ; gpt-oss et Gemini 3.x réfléchissent par défaut via le proxy.
- Appel de contrôle après fusion : gpt-oss-120b via le proxy rendait 4 réponses vides sur 4 (tokens de sortie épuisés à réfléchir), servi par Google faute de redéploiement. Correctif : `reasoning_effort` facultatif (banc seulement), et l'alerte de routage compte aussi les appels en erreur.
- Banc complet (run d'Ulrich, 434 appels, 0 erreur, 0,71 $) : 1re phrase sûre en médiane, gpt-5.6-luna 1,25 s ; **même modèle avec `provider.sort: "latency"` 0,82 s** ; gpt-oss-120b sur Cerebras 0,60 s ; Gemini 2.5 Flash 0,78 s. Gemini 2.5 Flash-Lite est écarté (intent valide 13 %). Restent à mesurer : la qualité (`eval:judge`) et le rappel long sur les finalistes.
- **Conclusion du lot 2 (27 nov.)** : qualité au juge, gpt-oss-120b − 0,52 (écarté), Gemini 2.5 Flash + 0,04 (équivalent). Rappel long : 4/14 pour luna et Gemini (Emma refuse sous Gemini), 8/14 pour gpt-oss, qui invente. La mémoire ne garde que le prénom et le rôle. **Recommandation : garder luna avec `provider.sort: "latency"`** (1re phrase 1,25 → 0,82 s, même modèle et même coût). Coût des mesures ≈ 8,2 $.
- Tests : `llmLatencyBench.test.ts` (13), `llmRecallScenario.test.ts` (6), `proxyLLMPayload.test.ts` (+2).

### Lot 3 — Adoption du LLM et du routage (selon la décision d'Ulrich sur le lot 2)

- Réglage sandbox du modèle retenu (`LLM_MODEL`) et préférence de fournisseur OpenRouter dans `proxy-llm/payload.ts`. On n'active que ce que le lot 2 a mesuré.
- Ajouter à `llm_usage` la latence et les tokens en cache, pour suivre l'effet en usage réel.
- Correctif mémoire : en `optimized_v3`, garder au moins le dernier échange, tronqué, plutôt qu'aucun historique (`conversationMemory.ts`), avec un test.
- Mesure : au moins 20 tours en sandbox (voix seule puis Tavus), `eval:judge` avec le modèle choisi, test de rappel long, écoute d'Ulrich.

**Résultat du lot 3 (27 nov., code livré, mesure en usage réel à faire)**

- Décision appliquée : gpt-5.6-luna gardé, défauts du code inchangés. La température n'est pas touchée (luna l'ignore, retirée avant l'envoi).
- Nouveau réglage admin `LLM_CHARACTER_PROVIDER` (Réglages › LLM › Agent Max, interrupteur « Routage OpenRouter : fournisseur le plus rapide »). Défaut vide : aucun `provider` envoyé, comportement actuel. Activé : `{ sort: "latency" }` part avec l'appel du personnage (`simulateMaxResponse`, en lot comme en flux) vers `proxy-llm`. Seule la valeur mesurée au banc est acceptée ; une préférence d'évaluation (`llmOverrides.provider`) reste prioritaire. La trace du tour (`requestedSettings.provider`) dit ce qui est parti.
- `llm_usage` : colonnes additives `latency_ms` (premier token en flux, appel entier en lot) et `cached_tokens` (`prompt_tokens_details.cached_tokens`). `metadata_json` ajoute `latency_kind`, `duration_ms`, `effective_provider` (fournisseur qui a servi) et `provider_preference`. Tant que la migration n'est pas appliquée, la ligne est écrite sans ces colonnes (aucune perte de suivi).
- Mémoire `optimized_v3` : si le dernier échange dépasse seul 1 200 car., il est gardé, chaque message coupé en proportion (terminé par « … »), au lieu d'aucun historique. Le reste du prompt est inchangé.
- Tests : `conversationMemory.test.ts` (+4), `llmUsageLatency.test.ts` (5), `characterProviderSetting.test.ts` (3), `maxAgent.identity.test.ts` (+3).
- Fait le 27 nov. : migration appliquée par Lovable (`2f59b2f5`), réglage activé sur `sandbox-ulrich` seulement.
- **Mesure réelle (27 nov., `sandbox-ulrich`, 24 tours complétés : 16 voix seule, 4 Tavus, 4 Anam ; médianes depuis le transcript final, `voice_turn_events`)** :

  | Sortie | LLM avant → après | Réponse prête avant → après | Premier son avant → après |
  |---|---|---|---|
  | Voix seule | 1,97 → **1,23 s** | 3,32 → 2,47 s | 5,25 → **2,88 s** (p90 5,95 → 3,64) |
  | Tavus | 2,02 → **1,30 s** | 3,70 → 2,52 s | 4,17 → **3,19 s** |
  | Anam | 2,04 → **1,20 s** | 3,67 → 2,47 s | 4,17 → **3,01 s** |

  « Avant » = les 7 jours précédents sur `sandbox-ulrich` (45 tours voix, 34 Tavus, 4 Anam). Le gain du LLM (≈ − 0,75 s) vient du routage ; celui du premier son en voix seule cumule les lots 1, 1 bis et 3. Petits échantillons Tavus et Anam (4 tours chacun).
- `llm_usage` (appel du personnage, 26 appels) : servi par **Amazon Bedrock** à chaque fois ; en lot (voix seule), appel entier médian 1,18 s (p90 1,46) ; en flux (Tavus), premier token 0,74 s, fin 0,94 s. 0 token en cache sur les prompts du personnage (≈ 5,2 k tokens) ; le Game Master, lui, en reçoit (Google AI Studio). 3 appels annulés par une coupure du tour, attendus.
- Écoute d'Ulrich : plus rapide, plus réactif, aucun artefact entendu. **Constat hors latence** : Max s'emporte un tour sur deux ou trois (colère, cris), sans gradation d'un tour à l'autre. Chantier séparé : [reprise émotions de Max](prompt_reprise_emotions_max_gradation_lot_1.md).
- Reste, facultatif et payant (lancé par Ulrich) : `eval:judge` avec `luna-latency` et `eval:llm-recall` pour mesurer l'effet du correctif mémoire. Ils ne bloquent pas le lot 4.
- **Statut : lot 3 terminé.**

### Lot 4 — LLM streamé sur toutes les sorties

- Généraliser le chemin `streamPRD4Turn` + `AvatarLineFeed` (T7/T8) à la voix seule ElevenLabs, à Anam et aux autres sorties, derrière un réglage par sortie (défaut faux pendant la mesure).
- Gardes inchangées : salvage en flux (T8), retenue de passage (`heldOutput`) en lot, une phrase dite n'est jamais remplacée.
- Mesure : au moins 10 tours activé puis au moins 10 désactivé, par sortie. Critère : gain médian > 0,5 s, 0 relance d'intent, 0 phrase retirée, interruption vérifiée. Si le critère est rempli, le défaut passe à vrai, sur accord d'Ulrich.

**Résultat du lot 4 (27 nov., code livré, mesure en usage réel à faire)**

- Sorties exclues du flux avant ce lot : voix seule hors Gradium progressif (ElevenLabs, Fish, Cartesia, Inworld, OpenAI), Anam, Tavus avec la voix du PAL, HeyGen, LemonSlice, Nuance. Seuls Gradium (`VOICE_INCREMENTAL_OUTPUT`) et Tavus avec l'audio d'Ava (`streamedLlm`) parlaient pendant la génération.
- Deux nouveaux réglages, défaut faux, lus au début de chaque tour :
  - **Voix seule** : `VOICE_STREAMED_LLM` (Réglages › Game Master, « Voix seule : réponse parlée en cours de génération »). `LocalTTSOutput.renderTextStream` découpe et met en file chaque phrase sûre dès qu'elle arrive, avec le même transport que le lot (flux MP3 MediaSource ou PCM Web Audio pour ElevenLabs, lots 1 et 1 bis). Gradium progressif reste prioritaire quand il est actif.
  - **Anam** : `anam.streamedLlm` (Réglages › Avatar vidéo › Anam). Un seul flux `talk` alimenté phrase par phrase, chaque morceau part sans être retenu, le flux est fermé par `endMessage` à la fin de la génération.
  - Tavus inchangé (`streamedLlm`, audio d'Ava). HeyGen, LemonSlice, Nuance et Tavus voix PAL restent en lot : ils ne savent pas encore recevoir une réplique en cours (hors périmètre).
- Code commun : le puits du flux (T7) est sorti d'`IndexPRD4` dans `src/services/streamedOutputSink.ts` (`chooseOutputStreamMode`, `createStreamedOutputSink`) et sert à toutes les sorties. Gardes inchangées : demande de passage ouverte → lot (`held_batch`), segment demandant une préparation de passage → retenu (`heldOutput`), une phrase dite n'est jamais remplacée après un `reset`, en-tête privé raté → aucun segment en flux, la réponse récupérée (T8) part en lot. Un échec de génération n'est pas compté comme une panne de voix (pas de toast ni de repli TTS).
- Télémétrie : `voice_turn_events.metadata_json.output_stream` = `{ output, mode, llm_transport }` (`output` : `tts` ou le fournisseur avatar ; `mode` : `feed`, `batch`, `held_batch`, `gradium_incremental` ; `llm_transport` : `sse` ou `http_batch`). Le délai à la première phrase dite est `durations.origin_to_output_estimated_ms`. Aucune migration (JSON). Projection MCP mise à jour.
- Tests : `streamedOutputSink.test.ts` (8 : réglage absent = lot, `held_batch`, ordre des segments, phrase dite jamais remplacée, salvage T8 en lot, échec), `localTtsOutput.test.ts` (+4 : interrupteur, ordre, échec, interruption), `anam.test.ts` (+4 : interrupteur, un flux fermé par `endMessage`, échec après début, interruption pendant le flux), `voiceTurnTelemetryV2.test.ts` (+1).
- **Mesure à faire par Ulrich** (`sandbox-ulrich`, aucune dépense automatique) : par sortie (voix seule ElevenLabs, Anam), au moins 10 tours interrupteur activé puis au moins 10 désactivé. Critère : gain médian du premier son > 0,5 s, 0 relance d'intent, 0 phrase retirée, une interruption vérifiée pendant le flux. Lecture : `voice_turn_events` filtré sur `output_stream.mode`. Anam : 3 ouvertures de salle par 10 minutes.
- Fusionné : `2a7de836` (PR #296, CI verte, garde vérifiée).
- **Premier essai d'Ulrich (27 nov., 9 h 59-10 h 04, `sandbox-ulrich`) : pas exploitable pour la voix seule.** Les 15 tours sont partis sur Tavus (`output_stream = tavus / feed`, 10 tours complétés, premier son médian 2,97 s) : le lien vidéo de Max vers Tavus passe avant l'interrupteur global « Voix ». Tavus parlait déjà en flux (T7) : ce n'est pas une comparaison du lot 4. Référence « désactivé » voix seule disponible : 16 tours du matin (8 h 39-8 h 45, ElevenLabs `http_stream`, LLM `http_batch`), premier son médian 2,88 s. Reste : 10 tours voix seule interrupteur activé, après avoir retiré le lien vidéo de Max (ou après le lot réglages). Suite des réglages : [reprise](prompt_reprise_reglages_tests_et_video_personnage_lot_1.md).
- **Statut : code livré, mesure en attente.** Le défaut ne passe à vrai qu'après la mesure et l'accord d'Ulrich.

**Mesure du lot 4, voix seule (27 nov., `sandbox-ulrich`, ElevenLabs ; remplace le statut ci-dessus pour la voix seule)**

| `voice_turn_events` | Désactivé (7 h 39-7 h 45 UTC) | Activé (9 h 58 et 13 h 41-13 h 44 UTC) | Écart |
|---|---:|---:|---:|
| Tours ayant produit un son (`voice_turn_completed`), premier son médian / p90 | 16 : 2,88 / 3,64 s | 11 : 2,65 / 2,96 s | − 0,23 / − 0,68 s |
| Tours menés au bout (`voice_turn_finished` ou GM, statut `completed`), médiane | 13 : 2,68 s | 9 : 2,58 s | − 0,09 s |
| Réponse prête → voix (médiane) | 0,37 s | 0,21 s | − 0,15 s |

- Critère du plan (gain médian > 0,5 s) : **non atteint**. Le défaut reste faux. Le − 0,6 s tiré des 4 premiers tours ne se confirme pas.
- Aucun span de relance ou de rattrapage dans les tours activés. Écoute d'Ulrich : réactif, fluide.
- Limites : petits échantillons, questions différentes ; les tours de l'après-midi suivent la fusion #302 (voix émotionnelle), synchronisation Lovable à cette heure non vérifiée.
- Interruption pendant le flux, vérifiée : la voix s'arrête, mais **net** (retour d'Ulrich : « comme si on lui enlevait la prise », puis un silence). Lot séparé : [interruption douce](prompt_reprise_interruption_douce_lot_1.md).
- Restent à mesurer : Anam (aucun tour activé), et le lot 1 sur iPhone et sur le poste de Romed. Le lot 5 attend la mesure Anam, ou la décision d'Ulrich de s'en passer.

**Mesure iPhone (27 nov., 14 h 02-14 h 05 UTC, `sandbox-ulrich`, Safari, mains libres, voix seule en flux, session `0cd6f1f5…`)**

- 10 tours : 8 avec son (menés au bout), 2 annulés avant tout son. Écoute d'Ulrich : plutôt réactif, avec des moments plus longs.
- Lot 1 bis confirmé : les 22 segments des tours sont en `http_stream_pcm`, aucun motif de repli ; réponse du LLM → son ≤ 0,54 s (médiane 0,24 s) contre 1,94-2,27 s avant ; premier son médian depuis le transcript final 3,28 s contre 5,00 s le 26 novembre. La cible (≤ 3,8 s, écart ≤ 0,6 s) est atteinte, sur 8 tours avec son au lieu des 10 demandés. Le flux du lot 4 était actif : la comparaison cumule les deux.
- Tours lents : 7, 8 et 10 (premier son 3,9, 4,2 et 4,6 s) attendent d'abord l'écriture du tour précédent (`pre_turn_handoff_prior_write` 1,18, 1,76 et 1,97 s). Tour 4 (3,8 s) : LLM 1,7 s et embedding 0,7 s. Lot proposé : [attente de passage](prompt_reprise_attente_passage_lot_1.md).

### Lot 5 — Fin de parole plus courte (essai)

- Réglage admin `endOfSpeechMs` à 600-700 ms en sandbox ; vérifier aussi l'attente `Finalize` de Deepgram (jusqu'à 1,5 s).
- Mesure : délai de décision, tours re-décidés ou annulés (signature « annulation 1,1-1,5 s après la décision »), coupures ressenties. Adoption seulement si les coupures n'augmentent pas.

### Attente de passage, lot 1 (27 novembre, code)

Diagnostic sur `voice_turn_finished` (21–27 novembre) : 14 attentes `pre_turn_handoff_prior_write` de plus de 0,5 s sur 574 tours mesurés (médiane 1,45 s, max 3,10 s). Au tour précédent, l'autre personnage était nommé dans la réplique seule (11), par le joueur seul (2) ou les deux (1) ; aucune demande, offre ni accord ; `handoff_assessment` nul sur les 14 (GM 2,3 à 5,9 s).

Règle (`handoffFinalizationMode`) : `blocking` comme avant pour une demande ouverte, une offre préparée, une offre ou un accord dans la réplique, ou une parole de contact du joueur avec l'autre nommé ; `background` pour un simple nom (écrit si le GM répond avant le tour suivant, sinon abandonné et noté `late_after_next_turn`) ; `skip` sinon. Rejouée sur le code : les 14 tours lents passent en `background`, les 10 décisions de passage relevées depuis le 15 novembre restent `blocking`. Réglage de retour : `VOICE_HANDOFF_WAIT_ON_NAME`.

Limite : un passage accordé sur un simple nom, sans mot de contact ni offre, est perdu si le joueur reparle avant la réponse du GM. Aucun cas observé, échantillon petit.

### Attente de passage, mesure après lot 1 (27 novembre, aucun code)

Sessions `ab76a0c9` (18 tentatives) et `9e2ba88c` (13), `sandbox-ulrich`, voix seule, après la fusion de la PR #305 (17:32 UTC). Lecture seule : `voice_turn_events`, `experience_events`, `sessions`.

- **Attente** : `pre_turn_handoff_prior_write` vaut 0 ms sur les 31 tentatives ; l'attente totale avant le tour est de 79 à 343 ms. La demande Max → Emma aboutit (`ab76a0c9` : `handoff_validated`, clic, `handoff_executed`).
- **Cas probants** : 3, soit un tour précédent qui nomme l'autre sans le demander et un tour suivant parti pendant le Game Master (`9e2ba88c` tours 5 et 8, `ab76a0c9` tour 13). L'ancien code aurait attendu ; le nouveau n'attend pas, donc il était bien actif. Un quatrième est à la limite (`ab76a0c9` tour 7, GM fini 50 ms après).
- **Défaut trouvé** : dans ces 3 cas, le post-tour du Game Master est **abandonné** (span `gm_persistence` ou `gm_generation` en échec environ 40 ms après le début du tour suivant) et le tour **manque dans `gm_post_turn_log`**. Cause lue dans le code : `postTurnSignal` est le signal du bail de passage (`IndexPRD4.tsx`), et le tour suivant le relie à un nouveau `requestId` (`advanceHandoffTurn`), ce qui annule l'ancien. Sont perdus pour ce tour : mémoire structurée, guidage et état de parole proposés, recommandation de cinématique, journal. Avant le lot 1, ces tours attendaient et le GM aboutissait.
- **Compteur muet** : `late_after_next_turn` vaut 0, mais ce zéro ne prouve rien. L'évaluation annulée ne peut accorder aucun passage, donc la perte n'est presque jamais notée. La limite acceptée (« abandonné et noté ») n'est pas tenue.
- **Antérieur au lot 1** : un tour qui ne nomme personne n'attendait déjà pas ; son GM est annulé de la même façon (`ab76a0c9` tour 15). Tous motifs confondus, 38 observations GM sur 288 sont en échec du 21 novembre à la fusion.
- **Conclusion** : mécanisme confirmé ; gain en secondes **non mesurable** (le GM annulé ne dit pas combien l'ancien code aurait attendu) et passages perdus **non mesurables**. Refaire un appel avant correction n'apporterait rien. Retour possible sans code : activer « Passage : attendre même sur un simple nom » (le GM est conservé sur ces tours, l'attente revient). Suite : [lot 1 bis](prompt_reprise_attente_passage_lot_1_bis.md).

### Attente de passage, lot 1 bis (27 novembre, code)

Deux durées de vie dans `HandoffCoordinator` : le **bail de passage** (dépassé par la demande suivante, comme avant) et le signal du **post-tour**, lié à l'appel. Le post-tour d'un tour ordinaire, avec ou sans nom, va au bout et s'enregistre quand le tour suivant démarre. Il est annulé par la fin d'appel, le redémarrage, le clic d'acceptation et le changement de personnage, d'appel ou de session. Refuser un passage ne l'annule plus. La préparation d'un passage (`character_handoff_preparation`) suit toujours le bail. Aucune attente ajoutée avant la réponse.

Effets d'une évaluation arrivée tard, vérifiés dans le code :

| Effet | Conduite |
|---|---|
| Journal `gm_post_turn_log` | écrit, inséré dans l'ordre des tours (la reprise le rejoue dans l'ordre) |
| Mémoire, `memory_last_turn` | fusionnée si aucun tour plus récent n'est écrit ; sinon seul le journal est complété |
| Conseil, état de parole, état du personnage, sujets, libellés, fin de scène | ignorés en direct (`isCurrentTurn`) |
| Cinématique du Game Master | ignorée (`isCurrentTurn`) |
| Passage | jamais écrit ; `late_after_next_turn` si le Game Master l'avait accordé sur un simple nom |
| Tour dépassé dont rien n'a été entendu | aucun post-tour : le tour suivant peut reprendre son numéro |

Limites : une réplique lue en bloc puis interrompue n'a rien de confirmé et reste sans post-tour, comme avant. Un tour lent écrit après un plus récent perd sa mémoire (pas son journal). Deux écritures au même instant et sans changement de mémoire pourraient encore se recouvrir dans le journal (non observé).

Tests : reproduction `postTurnSurvival.test.ts` (rouge avant correction), orchestrateur (tour dépassé entendu ou non), ordre du journal sur la vraie fonction SQL. Mesure sur appel réel : [lot de mesure](prompt_reprise_attente_passage_mesure_lot_1_bis.md).

### Attente de passage, lot 1 bis : mesure (27 novembre, aucun code)

Session `8cd27ab0` (`sandbox-ulrich`, voix seule, mains libres, 19:12–19:16 UTC, après synchro Lovable de la PR #309). Voix `feed` (`output_stream`), `llm_transport: sse`. Lecture seule : `sessions`, `voice_turn_events`, `experience_events`. Une session, 12 tours : recette un peu courte (9 tours nomment Emma sans demande formelle, dont 2 parlent de lui parler, au lieu de 10 simples noms).

- **Survie du post-tour : confirmée.** Tours 1 à 11 présents une fois chacun, dans l'ordre, tous `executed`, sans `parent_aborted` ; `memory_last_turn` = 11 ; spans `gm_*` tous `ok`. Dans 4 cas (tours 1, 5, 6 et 7), le tour suivant a démarré pendant le Game Master : tous enregistrés. La tentative du tour 8 jamais entendue est absente, et le tour 8 n'a qu'une entrée. Tour 12 absent : raccroché pendant la réplique, attendu.
- **Attente** : `pre_turn_handoff_prior_write` = 0 sur toutes les tentatives sauf une (1,57 s) après « parler avec Emma » au tour 7, cas bloquant voulu.
- **Rien de périmé appliqué** : aucun conseil ni état de parole d'un ancien tour injecté, aucune cinématique d'un ancien tour jouée.
- **Passages** : `late_after_next_turn` = 0 (aucun passage accordé sur un simple nom, donc le compteur n'a pas été éprouvé). Demande Max → Emma : `handoff_prepared`, `handoff_validated`, `handoff_accepted`, `handoff_executed`.
- **Défaut : réplique interrompue évaluée en entier** (tours 7 et 9). Reçus `cancelled`, `delivered` vide, mais le post-tour est enregistré et sa mémoire reprend la fin des répliques ; confidence `sourceTurn: 9` « il l'a déjà blessée ainsi », tirée de la dernière phrase, probablement non entendue (coupure à 12,9 s de lecture). Cause lue dans le code : en voix `feed`, `streamControl.delivery` est le texte **généré** complet (`streamedOutputSink.ts`, résolu à `complete`) ; à l'interruption, l'écouteur `abort` d'`IndexPRD4.tsx` résout `handoffDelivery` avant tout reçu (`undefined`), et `runPostTurn` (`prd4Orchestrator.ts`) retombe sur ce texte. Antérieur au lot 1 bis quand le Game Master finissait avant le tour suivant ; le lot 1 bis le rend systématique. La mesure attendue « partie entendue évaluée » ne vaut que pour la voix progressive Gradium (lu dans le code, non mesuré ici).
- **À savoir** : 6 répliques sur les 11 suivantes (tours 2, 6 à 10) sont parties sans conseil du Game Master. Tours 2, 6 et 7 : tour suivant parti avant sa réponse ; tour 9 : léger chevauchement ; tours 8 et 10 : la réplique précédente avait été interrompue, et le conseil, pourtant arrivé avant, est écarté (`isCurrentTurn`). Conforme au code, non corrigé ici.
- **Hors lot** : après une tentative abandonnée, la télémétrie voix numérote le tour 8 en 9 (`turn_id` en double) ; tours 3 et 4, préparation de passage refusée (`assessment_missing`), la réplique du tour 3 étant remplacée par une question d'attente.

Suite : [lot 1 ter](prompt_reprise_attente_passage_lot_1_ter.md).

### Attente de passage, lot 1 ter : réplique interrompue (27 novembre, code)

**Décision d'Ulrich** : aucune sortie `feed` (voix seule, Tavus, Anam) ne fournit un préfixe entendu fiable (voix seule : compte de morceaux sans texte, morceau coupé possible dans le compte ; Tavus et Anam : segments envoyés, pas entendus). Une réplique coupée n'a donc **aucun post-tour**, comme la voix lue en bloc.

- `streamedOutputSink.ts` : `delivery` ne se résout plus à la fin de la génération mais sur `confirmHeard(reçu.delivered)` ; l'interruption du tour avant confirmation, ou un reçu sans rien d'entendu, la rejette. Même contrat que la voix progressive Gradium (texte entendu).
- `IndexPRD4.tsx` : la sortie reçoit le signal du tour et la confirmation après le reçu.
- Même contrat pour le résumé de session : en `feed`, il attend la fin de la lecture et n'inclut jamais une réplique coupée (avant : texte généré, dès la fin de la génération). L'historique des tours suivants l'écartait déjà.

| Cas | Post-tour |
|---|---|
| `feed`, réplique lue en entier, même si le joueur reparle pendant le Game Master | enregistré (survie du lot 1 bis inchangée) |
| `feed`, réplique coupée, génération finie ou non | aucun : ni journal, ni mémoire, ni confidence, ni passage |
| `feed`, voix en échec | aucun, comme avant |
| Voix lue en bloc, Gradium progressif, préparation de passage | inchangés |

Coût accepté : le tour coupé manque au journal et ce que le joueur a dit à ce tour n'est pas analysé (il reste dans l'historique).

Tests : reproduction orchestrateur (rouge avant correction, Game Master et résumé), réplique confirmée créditée, contrat de la sortie. Le câblage dans `IndexPRD4.tsx` n'a pas de test propre ; aucun appel réel essayé.

Restes lus dans le code, non corrigés : la voix lue en bloc (et `held_batch`) résume encore la réplique avant sa lecture ; un préfixe entendu fiable demanderait une instrumentation par sortie.

**Recette d'Ulrich** (`sandbox-ulrich`, voix seule, mains libres, après synchro Lovable) : environ 10 tours avec Max ; laisser finir au moins 4 répliques ; en couper au moins 3 au milieu d'une phrase qui contient une information ; reparler aussitôt après au moins 2 répliques finies ; terminer par une demande Max → Emma. Attendu à l'oreille : Max ne fait jamais référence à ce qu'il n'a pas eu le temps de dire comme à une chose dite. [Mesure](prompt_reprise_attente_passage_mesure_lot_1_ter.md).

### Attente de passage, lot 1 ter : mesure (28 novembre, aucun code)

Recette d'Ulrich : session `f89abea8` (`sandbox-ulrich`, voix seule, mains libres, 07:44–07:49 UTC, après la PR #311). 12 tours : 9 répliques `completed` (1, 2, 3, 7 à 12), 3 coupées (4, 5, 6 : reçus `cancelled`, `delivered` vide, après environ 4,2 s, 6,6 s et 13,2 s de lecture), puis Max → Emma. Voix `feed`, sauf le tour 10 (`held_batch`, tour du passage). Lecture seule : `sessions`, `session_summaries`, `voice_turn_events`, `experience_events`.

- **Tour coupé jamais crédité : confirmé.** Tours 4, 5 et 6 absents de `gm_post_turn_log` ; aucune confidence ni sujet de `conversation_memory` ne vient d'eux (sources 1, 7, 8 pour les confidences, 7 et 8 pour les sujets) ; les résumés (Max jusqu'au tour 7, Emma jusqu'au tour 11) ne contiennent aucun élément propre à ces répliques. Aucun appel du Game Master pour eux.
- **Tours entendus : 8 sur 9 au journal**, une fois chacun, dans l'ordre ; `memory_last_turn` = 11. Le tour 7, dont le Game Master a répondu après la prise de parole suivante, est bien enregistré (seul cas net de cet appel ; la recette en visait deux).
- **Tour 12 absent : raccrochage.** Réplique entendue en entier, Game Master interrompu à 1,4 s (`gm_generation` `failed`), `call_closed` 0,1 s plus tard. Cause lue dans le code : la fin d'appel annule les post-tours en attente (`HandoffCoordinator.endCall`). Conforme à la conception, mais sa mémoire manque à une reprise de session.
- **Passage** : `handoff_prepared`, `handoff_validated`, `handoff_proposed`, `handoff_accepted`, `handoff_executed` ; aucun `late_after_next_turn`, aucun événement ni message d'échec après les interruptions.
- **Hors lot, mémoire perdue sur des tours entendus** : aux tours 2 et 3, la relation proposée est refusée (`relationship_invalid`) et tout `memory_delta` est jeté, confidences comprises (au tour 3, Max venait de dire avoir tué une protogyne). Comportement voulu et testé (`gameMasterPRD4.memory.test.ts`) ; 32 tours sur 196 depuis le 24 novembre (23 sessions, `relationship_invalid`, tous sans mémoire). Motifs : sujet inconnu, preuve montante absente, métadonnées recopiées du tour précédent.
- **À savoir** : après les coupures, Max a redit presque la même chose aux tours 5 et 6. Cause probable, non vérifiée : la réplique coupée est écartée de l'historique, il ignore donc l'avoir commencée. La télémétrie voix a numéroté deux tentatives « 2 » après un premier essai abandonné (déjà connu).

Le lot 1 ter est clos. Suite proposée, sur décision d'Ulrich : [mémoire gardée quand la relation est refusée](prompt_reprise_memoire_relation_refusee_lot_1.md).

### Mémoire gardée quand la relation est refusée, lot 1 : diagnostic, règle et correctif (28 novembre, code)

**Cause (historique Git).** Au 11 septembre (`cb7e7fd9`), un refus gardait le delta et remettait la relation précédente. Le 14 octobre (#41, `75ef4d9a`), un refus est devenu une évaluation `invalid`, et rien d'une évaluation non exécutée n'était mémorisé : d'où `memory_delta: null`. F1 (#88, 26 octobre) a rétabli `executed` (« Reject this mutation only ») en laissant ce `null` en place.

**Mesure (lecture seule, depuis le 24 novembre).** 32 refus sur 196 tours : 19 pour sujet inconnu seul, 6 avec un écart de métadonnées.

**Fiabilité du reste.** Sujet, preuve montante et sauts de palier ne concernent que la relation. Les trois écarts de métadonnées arrivent le plus souvent ensemble : probablement des champs absents plutôt que recopiés d'un autre tour (non vérifiable, aucune trace conservée). La réponse du Game Master est celle de cet appel, et le tour comme le personnage sont attribués par l'application.

**Règle approuvée par Ulrich (28 novembre) et codée.**
1. Relation refusée : aucun de ses champs n'est appliqué ; le reste de la mémoire du tour entendu est gardé.
2. Exception : si la relation nomme explicitement l'autre personnage, tout le delta reste jeté (jamais observé).
3. Sans relation dans le delta (absente ou refusée), la relation précédente reste identique. Avant ce lot, la fusion pouvait remettre `trust` à « neutre » et avançait `sourceTurn`.
4. Motifs journalisés, `relationship_invalid` et passage inchangés.

**Défaut distinct trouvé.** L'identifiant d'un sujet coupé à 72 caractères se termine par un tiret ; la validation le retire et ne le reconnaît plus. Présent dans 17 refus, seule cause pour 15. Quatre autres refus viennent d'identifiants de mémoire (`max-topic-…`) donnés comme sujets sensibles. Hors de ce lot : [reprise lot 2](prompt_reprise_memoire_relation_refusee_lot_2.md).

**Livré.** `gameMasterPRD4.ts` retire la seule relation refusée (delta entier jeté si elle nomme l'autre personnage) ; `mergeConversationMemory` laisse la relation stockée intacte sans proposition. Reproduction rouge (12 tests) puis verte ; `test:quality` et `test:delivery` verts. Aucune migration, aucun réglage ni prompt modifié, aucun appel réel essayé, rien en production. Recette : après synchro Lovable, un appel sur `sandbox-ulrich` ; sur un tour `relationship_invalid`, `conversation_memory` doit contenir les faits et confidences du tour, relation inchangée.

### Mémoire et relation, lot 2 : sujets sensibles reconnus (28 novembre, code)

**Reproduction.** Test rouge : sujet dont la coupe à 72 caractères tombe sur un séparateur. La politique donnait un identifiant finissant par un tiret, que le second passage de `slug` (validation, normalisation) retirait : `unknown_topic`.

**Fiches actuelles (lecture seule, `prod`).** Max : 4 sujets sur 12 touchés (introduction, Ava, « tu ne sais pas comment lui en parler », Léo). Emma : 2 sur 12 (introduction, Ava). 15 refus sur 32 depuis le 24 novembre n'avaient que cette cause, 11 au palier « contact », 4 au palier « lien ».

**Effet en jeu, approuvé par Ulrich avant le code.** Ces relations pourront passer et ces sujets s'ouvrir. Les autres règles restent (pas de saut de palier, preuve montante exigée, pas d'ouverture avant « lien ») : un tour auparavant refusé peut encore l'être ; les propositions refusées n'étant pas conservées, aucun rejeu possible.

**Livré.** `slug` retire le tiret laissé par la coupe. Les identifiants sont stables d'un passage à l'autre. États stockés vérifiés en lecture seule : 229 clés de sujet sur 61 sessions, aucune ne finit par un tiret ; rien à reprendre. `test:quality` et `test:delivery` verts. Aucune migration, écriture, réglage ni prompt modifié ; aucun appel réel essayé.

**Constaté, non corrigé** ([reprise lot 3](prompt_reprise_memoire_relation_refusee_lot_3.md)) :
- `cleanList` coupe la fiche à chaque ligne et chaque point-virgule, 12 morceaux au plus : l'introduction et des bouts de phrases deviennent des sujets, « Les morts » et « L'après » manquent pour Max, « L'après » pour Emma.
- Les mots-clés gardent tout mot de 3 lettres (« est », « pas », « les ») : d'après le code, la directive demande de se retenir dès qu'un sujet ainsi reconnu est fermé.
- 4 refus pour identifiants de mémoire (`max-topic-…`, `emma-topic-…`) proposés comme sujets sensibles.

### Bilan final

Tableau avant/après par segment et par sortie, compromis qualité, coût et limites. Mise à jour de la tâche Notion et de `docs/etat_courant.md`.

## Livraison de chaque lot

Branche du lot depuis main à jour. Commit, push, PR. CI complète sur PR (`regression-gates` vert). Fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (`gh` via `github-delivery-exec`). Vérification sur origin/main et synchronisation Lovable ; Edge Functions redéployées via Lovable si elles changent. `etat_courant`, CHANGELOG, HANDOFF et le prompt de reprise du lot suivant sont mis à jour dans la branche. Production non publiée.

## Vérification

- Typecheck, lint et tests de garde (`npm run typecheck`, tests listés par lot) ; CI de la PR verte.
- Requêtes en lecture seule sur `voice_turn_events` et `llm_usage` (Lovable Cloud) avant et après, mêmes indicateurs que le tableau de référence.
- Interruption testée à la main sur chaque sortie touchée. Écoute d'Ulrich pour la voix, les coupures et le naturel.
