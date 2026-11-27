# Prompt de reprise — Latence conversationnelle, lot 4 (LLM streamé sur toutes les sorties)

À copier dans un nouveau chat Ava. Plan : [plan_latence_conversationnelle_llm_tts.md](plan_latence_conversationnelle_llm_tts.md), sections « Lot 3 » (résultat) et « Lot 4 ». Rapport du banc : [banc_llm_latence_20261126.md](eval/banc_llm_latence_20261126.md). Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

---

**Objectif** : faire partir la parole dès la première phrase sûre du LLM sur toutes les sorties (voix seule ElevenLabs, Anam, autres avatars), comme c'est déjà le cas pour Gradium (sortie incrémentale) et Tavus avec l'audio d'Ava (lots T7/T8). Derrière un réglage par sortie, **défaut faux** pendant la mesure. Ce lot seulement ; ne pas commencer le lot 5 (fin de parole plus courte).

**Précondition (à vérifier en premier)** : le lot 3 est fusionné sur origin/main (`git log origin/main --grep "latency lot 3"`), la migration `llm_usage` (`latency_ms`, `cached_tokens`) est appliquée (requête `information_schema.columns` en lecture via le MCP Lovable), et les mesures du lot 3 sont écrites dans le plan (au moins 20 tours avec le routage `sort: latency`, médianes depuis `voice_turn_events` et `llm_usage`). Si la mesure manque, ne rien coder : dire à Ulrich quelle mesure manque (une seule action), puis s'arrêter.

**État vérifié (27 novembre 2026, fin du lot 3)**

- Lot 3 livré : interrupteur admin `LLM_CHARACTER_PROVIDER` (Réglages › LLM › Agent Max) qui envoie `provider.sort: "latency"` avec l'appel du personnage (`simulateMaxResponse`, lot et flux) ; `llm_usage.latency_ms` (premier token en flux, appel entier en lot, `metadata_json.latency_kind`), `cached_tokens`, `effective_provider` ; correctif mémoire `optimized_v3` (dernier échange gardé tronqué). Vérifier le SHA de fusion avec `git log origin/main`.
- Banc du lot 2 : à modèle égal, la réponse entière arrive ≈ 0,7 s après la première phrase sûre (luna : 1re phrase 1,25 s par défaut, 0,82 s avec `sort: latency` ; fin ≈ 1,9 s). C'est le gain visé par ce lot.
- Chemin streamé existant : `streamPRD4Turn` (src/services/prd4Orchestrator.ts) et, dans src/pages/IndexPRD4.tsx, deux puits : `prepareStreamedVoiceTurn` (voix, seulement si `incrementalOutputEnabledRef` et TTS Gradium) et `createAvatarLineFeed` (src/services/streamingAvatar/avatarAudioBridge.ts, seulement `streaming_avatar` avec `canStreamText()`, c'est-à-dire Tavus audio d'Ava). Toutes les autres sorties passent par `processPRD4Turn` (lot, réponse entière).
- Gardes en place à conserver : salvage d'un en-tête privé raté en fin de flux (T8, `salvageBatchSpeech`), retenue de passage (`heldOutput`, `needsHandoffPreparation`) qui garde les segments en lot, une phrase dite n'est jamais remplacée.
- Voix seule ElevenLabs : lecture en flux MP3 (MediaSource) ou PCM (Web Audio, iPhone) depuis les lots 1 et 1 bis, mais à partir de la réponse entière.

**Sources à lire**

- Plan, sections « Lot 3 » (résultat et mesures) et « Lot 4 ».
- src/pages/IndexPRD4.tsx (choix entre `streamPRD4Turn` et `processPRD4Turn`, `streamedVoice`, `avatarStream`, `heldOutput`).
- src/services/prd4Orchestrator.ts (`streamPRD4Turn`, événements `segment`) ; src/services/responseIntentStream.ts (`ResponseIntentParser`).
- src/services/streamingAvatar/avatarAudioBridge.ts ; le service de voix streamée (`prepareStreamedVoiceTurn`) ; le lecteur ElevenLabs en flux (lots 1 et 1 bis).
- Invariants d'interruption, de passage de personnage et de cinématiques en fin d'AGENTS.md.

**Périmètre**

1. Réglage par sortie (voix seule ElevenLabs, Anam, autres avatars qui acceptent du texte ou de l'audio en continu), défaut faux, lu au début du tour.
2. Voix seule ElevenLabs : alimenter la synthèse phrase par phrase depuis les segments de `streamPRD4Turn`, en gardant le transport en flux (MP3 ou PCM) choisi par les lots 1 et 1 bis.
3. Anam (et toute sortie avatar qui le permet) : même principe que le flux Tavus (`AvatarLineFeed`).
4. Gardes inchangées : salvage T8, `heldOutput` en lot, interruption, une phrase dite jamais remplacée, aucune relance d'intent.
5. Télémétrie : le transport (`sse` ou `http_batch`) et le délai à la première phrase dite par sortie dans `voice_turn_events`.
6. Mesure : au moins 10 tours activé puis au moins 10 désactivé, par sortie. Critère : gain médian > 0,5 s, 0 relance d'intent, 0 phrase retirée, interruption vérifiée. Si le critère est rempli, le défaut passe à vrai, **sur accord d'Ulrich**.

**Hors périmètre** : fin de parole (lot 5), changement de modèle ou de routage, cache (déplacement du contrat de flux), TTS hors chemin de livraison, production.

**Invariants et limites d'autorisation**

- Sandbox uniquement. La production n'est pas publiée. Aucune migration attendue ; si une colonne est nécessaire, elle passe par Lovable et reste additive.
- Base Caractères Notion en lecture seule. Gami DigiDouble exclu.
- Interruption, passage de personnage et cinématiques inchangés.
- Appels payants bornés et annoncés ; Ulrich lance les runs complets. Limite serveur : 3 ouvertures de salle avatar par 10 minutes.

**Validations**

- Tests : réglage absent = chemin actuel (lot) ; segments transmis dans l'ordre à chaque sortie activée ; `heldOutput` garde le lot ; interruption pendant le flux ; salvage T8 sur une sortie nouvellement streamée.
- `npm run typecheck`, lint, `npm run test:quality` et `npm run test:delivery` verts avant le push. CI de la PR verte, avec `regression-gates`. Si `PeriodCostLines.test.tsx` échoue localement sur « 1'500 », c'est la locale ICU de Node ; la CI fait foi.

**Livraison** : branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, puis fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier sur origin/main (arbre et parent), supprimer notre branche, synchroniser en local et sur Lovable. Mettre à jour docs/etat_courant.md, le CHANGELOG et le plan (section lot 4 : mesures, statut).

**Première action exécutable** : vérifier la précondition (fusion du lot 3, colonnes `llm_usage`, mesures du lot 3 dans le plan). Si elle est remplie, lire dans IndexPRD4.tsx la condition qui choisit `streamPRD4Turn` et lister les sorties qui en sont exclues.

**Clôture obligatoire** : avant le push, écrire docs/prompt_reprise_latence_conversationnelle_lot_5.md (fin de parole plus courte, section « Lot 5 » du plan). Il contient l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture. Donner le lien direct dans le compte rendu. Ne pas lancer le lot 5.
