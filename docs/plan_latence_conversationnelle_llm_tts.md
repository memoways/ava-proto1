# Plan — Réduire la latence conversationnelle d'Ava (LLM, TTS, orchestration)

Tâche Notion : [Réduire la latence conversationnelle AVA — LLM, TTS et orchestration](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab, 🔥🔥🔥🔥).
Statut (26 novembre 2026) : **lot 1 livré (code), mesure après synchro Lovable à faire par Ulrich ; lot 2 livré (outils de mesure), runs payants à lancer par Ulrich, puis choix du modèle (lot 3).** Rapport : [banc LLM latence](eval/banc_llm_latence_20261126.md). Reprise : [prompt du lot 3](prompt_reprise_latence_conversationnelle_lot_3.md).
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
- Tests : `llmLatencyBench.test.ts` (13), `llmRecallScenario.test.ts` (6), `proxyLLMPayload.test.ts` (+2).

### Lot 3 — Adoption du LLM et du routage (selon la décision d'Ulrich sur le lot 2)

- Réglage sandbox du modèle retenu (`LLM_MODEL`) et préférence de fournisseur OpenRouter dans `proxy-llm/payload.ts`. On n'active que ce que le lot 2 a mesuré.
- Ajouter à `llm_usage` la latence et les tokens en cache, pour suivre l'effet en usage réel.
- Correctif mémoire : en `optimized_v3`, garder au moins le dernier échange, tronqué, plutôt qu'aucun historique (`conversationMemory.ts`), avec un test.
- Mesure : au moins 20 tours en sandbox (voix seule puis Tavus), `eval:judge` avec le modèle choisi, test de rappel long, écoute d'Ulrich.

### Lot 4 — LLM streamé sur toutes les sorties

- Généraliser le chemin `streamPRD4Turn` + `AvatarLineFeed` (T7/T8) à la voix seule ElevenLabs, à Anam et aux autres sorties, derrière un réglage par sortie (défaut faux pendant la mesure).
- Gardes inchangées : salvage en flux (T8), retenue de passage (`heldOutput`) en lot, une phrase dite n'est jamais remplacée.
- Mesure : au moins 10 tours activé puis au moins 10 désactivé, par sortie. Critère : gain médian > 0,5 s, 0 relance d'intent, 0 phrase retirée, interruption vérifiée. Si le critère est rempli, le défaut passe à vrai, sur accord d'Ulrich.

### Lot 5 — Fin de parole plus courte (essai)

- Réglage admin `endOfSpeechMs` à 600-700 ms en sandbox ; vérifier aussi l'attente `Finalize` de Deepgram (jusqu'à 1,5 s).
- Mesure : délai de décision, tours re-décidés ou annulés (signature « annulation 1,1-1,5 s après la décision »), coupures ressenties. Adoption seulement si les coupures n'augmentent pas.

### Bilan final

Tableau avant/après par segment et par sortie, compromis qualité, coût et limites. Mise à jour de la tâche Notion et de `docs/etat_courant.md`.

## Livraison de chaque lot

Branche du lot depuis main à jour. Commit, push, PR. CI complète sur PR (`regression-gates` vert). Fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (`gh` via `github-delivery-exec`). Vérification sur origin/main et synchronisation Lovable ; Edge Functions redéployées via Lovable si elles changent. `etat_courant`, CHANGELOG, HANDOFF et le prompt de reprise du lot suivant sont mis à jour dans la branche. Production non publiée.

## Vérification

- Typecheck, lint et tests de garde (`npm run typecheck`, tests listés par lot) ; CI de la PR verte.
- Requêtes en lecture seule sur `voice_turn_events` et `llm_usage` (Lovable Cloud) avant et après, mêmes indicateurs que le tableau de référence.
- Interruption testée à la main sur chaque sortie touchée. Écoute d'Ulrich pour la voix, les coupures et le naturel.
