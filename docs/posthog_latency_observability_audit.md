# Audit observabilité latence — Max voice-to-voice + PostHog

Date: 2026-05-22
Projet PostHog: `137897`
Host PostHog: `https://eu.i.posthog.com`
Project API key frontend: déjà configurée dans `src/services/posthogService.ts`

## Objectif

Comprendre finement les latences, frictions et blocages du pipeline conversationnel avec Max:

1. STT navigateur + Deepgram.
2. Orchestration RAG / knowledge / Max LLM / validateur.
3. TTS provider + lecture audio navigateur.
4. GameMaster post-turn.
5. Frictions UX: audio unlock, micro, push-to-talk, erreurs navigateur, timeouts, blocages.

Les données doivent être exploitables à deux endroits:

- Back-office interne, via Supabase et les onglets admin.
- PostHog, via dashboards, session replay, funnels et alertes.

## Ce qui est déjà en place

### PostHog

`src/services/posthogService.ts` initialise `posthog-js` avec:

- `capture_pageview: true`
- `capture_pageleave: true`
- `autocapture: true`
- `session_recording.maskAllInputs: false`
- `api_host: https://eu.i.posthog.com`

`src/main.tsx` appelle `initPostHog()` au démarrage.

`identifyUser(sessionId)` est appelé après création de session, ce qui attache ensuite les événements au `session_id` Supabase.

### Télémétrie latence interne + PostHog

`src/services/latencyTelemetry.ts` est la bonne abstraction centrale:

- `createTurnTimer().emit()` envoie `turn_latency` vers PostHog et insère une ligne dans `turn_latencies`.
- `recordAudioLatency()` envoie `audio_latency` vers PostHog et insère une ligne dans `audio_latencies`.
- Les appels sont fire-and-forget et ne bloquent pas le hot path.

Tables Supabase existantes:

- `turn_latencies`: latences RAG, GM pre, Max LLM, validateur, total, modèles, fallback, metadata.
- `audio_latencies`: STT, TTS first-byte, TTS total, playback, tailles texte, metadata.

### Back-office interne

Les vues suivantes consomment déjà ces données:

- `LatencyTelemetryTab`: p50/p95 global, derniers tours, détails par segment.
- `LatencyBlockingTab`: analyse depuis `conversation_log.pipeline`, bloqueur dominant, comparaison aux budgets.
- `VoiceUsageTab`: suivi TTS par provider, p50/p95, erreurs, coûts estimés.
- `PipelineTraceTab` / `MaxPromptTestTab`: inspection qualitative du pipeline.

### Événements PostHog déjà utiles

Jeu et funnel:

- `game_started`
- `ab_choice_made`
- `voice_modality_assigned`
- `phase_changed`
- `character_selected`
- `intro_video_completed`
- `video_trigger_activated`
- `game_over`
- `questionnaire_submitted`

Latence et erreurs:

- `turn_latency`
- `turn_latency_post`
- `audio_latency`
- `stt_error`
- `tts_error`
- `tts_queue_result`
- `audio_unlock_result`
- `gm_post_fallback`

## Lacunes critiques

### 1. Schéma fragmenté

Les événements existent mais ne forment pas encore une chronologie complète du tour. Exemple: `turn_latency` ne contient pas la latence TTS ni la latence GM post réelle, car ces mesures arrivent après la réponse de Max. Le back-office reconstruit une partie via `conversation_log.pipeline`, mais PostHog reçoit plusieurs événements séparés.

Conséquence: dans PostHog, il est difficile de répondre à une question simple comme:

> Sur les tours où l'utilisateur ressent un blocage, quelle étape exacte domine la latence end-to-end?

### 2. Pas de `turn_id`

Les événements ont `session_id` et parfois `turn_index`, mais pas d'identifiant stable de tour. Cela complique la corrélation PostHog entre:

- `audio_latency` STT entrant.
- `turn_latency` Max/RAG/validateur.
- `audio_latency` TTS sortant.
- `turn_latency_post` GM post.
- `tts_error`, `stt_error`, `tts_queue_result`.

### 3. `audio_latency` ne reçoit pas toujours `session_id` / `turn_index`

`recordAudioLatency()` supporte ces champs, mais les appels STT/TTS ne les renseignent pas systématiquement depuis `Index.tsx` / `TTSQueue`.

Conséquence: le dashboard provider TTS fonctionne, mais l'analyse par session/tour est fragile.

### 4. Mesure STT incomplète

La mesure actuelle capture surtout le temps après silence. Elle ne capture pas encore toute la mécanique utilisateur:

- clic micro / press PTT;
- permission micro;
- ouverture WebSocket Deepgram;
- premier interim transcript;
- premier final transcript;
- finalisation par silence ou `flush()`;
- redémarrage après TTS;
- interruption ou fermeture WebSocket.

Pour comprendre Safari/Firefox/Brave, il faut ces jalons.

### 5. Mesure TTS incomplète côté playback

Le TTS mesure génération first-byte/total via provider, mais la lecture navigateur doit remonter davantage:

- audio unlock déjà fait ou non;
- délai entre blob reçu et `audio.play()` résolu;
- erreur `NotAllowedError`, `NotSupportedError`, `AbortError`;
- durée réelle de playback;
- annulation de queue;
- nombre de segments générés, joués, échoués.

### 6. Pas de taxonomie de blocage unifiée

Il existe `pickBlocker()` côté UI conversation, mais pas encore comme propriété standard PostHog.

Il faut normaliser:

- `blocker_step`: `stt`, `rag`, `max_llm`, `validator`, `tts_generation`, `audio_playback`, `gm_post`, `browser_audio_unlock`, `unknown`.
- `blocker_reason`: `timeout`, `provider_error`, `browser_policy`, `network`, `quota`, `slow_model`, `empty_transcript`, `processing_guard`, etc.
- `severity`: `ok`, `slow`, `critical`, `failed`.

### 7. Logs console non persistés

Les logs console montrent des informations importantes (`[Perf]`, `[Deepgram]`, `[GameMaster]`), mais ils ne sont pas tous structurés ni persistés dans Supabase/PostHog.

PostHog Session Replay peut capturer des erreurs console selon configuration, mais il ne faut pas dépendre de logs texte pour les dashboards. Les événements structurés doivent être la source de vérité.

### 8. Dashboards PostHog pas encore matérialisés dans le projet

`docs/posthog-setup-guide.md` décrit déjà les insights à créer, mais le repo ne contient pas encore de spécification de dashboard versionnée ou de script d'installation.

Important: la clé `phc_...` est une clé publique de capture frontend. Elle permet d'envoyer des événements, pas d'administrer PostHog. Pour créer automatiquement dashboards/insights via API, il faut une Personal API Key PostHog avec permissions sur le projet `137897`.

## Schéma cible recommandé

### Événement `voice_turn_completed`

Émettre un événement unique en fin de tour, après TTS et GM post, en plus des événements détaillés existants.

Propriétés recommandées:

```json
{
  "session_id": "uuid",
  "turn_id": "uuid-or-session-turn-index",
  "turn_index": 3,
  "character": "max",
  "variant": "A",
  "voice_modality": "micro_ouvert",
  "browser_name": "Chrome",
  "browser_family": "Chromium",
  "is_mobile": false,
  "media_recorder_mime": "audio/webm;codecs=opus",
  "audio_unlocked": true,
  "stt_trigger": "silence",
  "tts_provider": "elevenlabs",
  "tts_model": "eleven_turbo_v2_5",
  "max_model": "google/gemini-2.0-flash-001",
  "t_stt_total_ms": 840,
  "t_rag_rewrite_ms": 0,
  "t_rag_query_ms": 180,
  "t_rag_total_ms": 240,
  "t_knowledge_build_ms": 5,
  "t_gm_pre_ms": 0,
  "t_max_llm_ms": 920,
  "t_validator_ms": 120,
  "t_tts_first_byte_ms": 420,
  "t_tts_total_ms": 780,
  "t_audio_playback_start_ms": 35,
  "t_audio_playback_total_ms": 2600,
  "t_gm_post_ms": 700,
  "t_turn_response_ready_ms": 1280,
  "t_turn_voice_ready_ms": 2060,
  "t_turn_end_to_end_ms": 4660,
  "rag_matches_count": 3,
  "rag_top_similarity": 0.74,
  "max_response_len": 180,
  "tts_segments_count": 2,
  "tts_segments_played": 2,
  "tts_segments_failed": 0,
  "had_fallback": false,
  "had_error": false,
  "blocker_step": "audio_playback",
  "blocker_reason": "long_audio_duration",
  "severity": "slow"
}
```

Définitions utiles:

- `t_turn_response_ready_ms`: STT final -> texte Max prêt.
- `t_turn_voice_ready_ms`: STT final -> premier audio prêt à jouer.
- `t_turn_end_to_end_ms`: début interaction utilisateur -> fin playback TTS.
- `blocker_step`: étape dominante calculée par ratios vs budgets.

### Événement `voice_turn_step`

Émettre pour chaque étape si l'on veut un niveau de détail maximal:

```json
{
  "session_id": "uuid",
  "turn_id": "uuid-or-session-turn-index",
  "turn_index": 3,
  "step": "max_llm",
  "status": "success",
  "duration_ms": 920,
  "provider": "openrouter",
  "model": "google/gemini-2.0-flash-001",
  "error_type": null,
  "error_message": null
}
```

Étapes:

- `mic_start`
- `stt_token`
- `stt_ws_open`
- `stt_first_interim`
- `stt_final`
- `rag_rewrite`
- `rag_query`
- `knowledge_build`
- `max_llm`
- `validator`
- `tts_generation`
- `audio_playback`
- `gm_post`

### Événements d'erreur

Créer un événement unifié `voice_error`, au lieu de dépendre uniquement de `stt_error`, `tts_error`, `gm_post_fallback`.

Propriétés:

```json
{
  "session_id": "uuid",
  "turn_id": "uuid-or-null",
  "turn_index": 3,
  "component": "tts",
  "provider": "elevenlabs",
  "error_type": "quota",
  "error_message": "quota_exceeded",
  "recoverable": true,
  "fallback_used": "text_only",
  "browser_name": "Safari"
}
```

Les événements spécifiques existants peuvent rester pour compatibilité, mais `voice_error` doit devenir la vue transverse.

## Dashboard PostHog recommandé

Nom: `Ava Proto1 — Latence voix Max`

Filtres globaux:

- `character = max`
- environnement production si une propriété `env` est ajoutée
- période 24h / 7j / 30j

### 1. KPI overview

Cartes:

- Nombre de tours: count `voice_turn_completed`.
- p50/p95 `t_turn_response_ready_ms`.
- p50/p95 `t_turn_voice_ready_ms`.
- p50/p95 `t_turn_end_to_end_ms`.
- Taux de tours `severity = critical`.
- Taux de tours `had_error = true`.

### 2. Décomposition latence

Insight Trends multi-séries:

- event `voice_turn_completed`
- math median + p95
- propriétés:
  - `t_stt_total_ms`
  - `t_rag_total_ms`
  - `t_max_llm_ms`
  - `t_validator_ms`
  - `t_tts_total_ms`
  - `t_audio_playback_start_ms`
  - `t_gm_post_ms`

Breakdowns utiles:

- `max_model`
- `tts_provider`
- `voice_modality`
- `browser_family`

### 3. Top blockers

Insight:

- event `voice_turn_completed`
- count
- breakdown `blocker_step`
- filtre `severity != ok`

Variante: breakdown secondaire manuel par `blocker_reason`.

### 4. LLM Max

Insights:

- p50/p95 `t_max_llm_ms` par `max_model`.
- p50/p95 `t_max_llm_ms` par `max_response_len` bucket si des buckets sont ajoutés.
- count des `had_fallback = true`.

### 5. STT navigateur

Insights:

- p50/p95 `t_stt_total_ms` par `browser_family`.
- count `voice_error` avec `component = stt`, breakdown `error_type`.
- p50 `stt_ws_open_ms` si ajouté.
- p50 `stt_finalization_ms` par `stt_trigger` (`silence`, `ptt_flush`).

### 6. TTS provider + playback

Insights:

- p50/p95 `t_tts_first_byte_ms`, `t_tts_total_ms` par `tts_provider`.
- count `voice_error` avec `component = tts`, breakdown `provider` et `error_type`.
- p50/p95 `t_audio_playback_start_ms` par `browser_family`.
- count `tts_segments_failed > 0`.

### 7. Fluidité UX

Insights:

- count `audio_unlock_result` par `ok` et `trigger`.
- funnel:
  1. `phase_changed` où `phase = conversation`
  2. `audio_unlock_result` où `ok = true`
  3. `voice_turn_completed`
  4. second `voice_turn_completed`
- breakdown par `voice_modality`.

### 8. Session Replay ciblé

Playlists PostHog:

- Sessions avec `voice_error`.
- Sessions avec `voice_turn_completed.severity = critical`.
- Sessions avec `blocker_step = audio_playback`.
- Sessions Safari/Firefox.

## Plan d'implémentation recommandé

### Phase 1 — Unifier les identifiants

Ajouter un `turn_id` généré dans `Index.tsx` à chaque `processUserMessage`.

Propager `session_id`, `turn_id`, `turn_index` à:

- `processConversationTurn`.
- `recordAudioLatency` STT.
- `TTSQueue`.
- `generateSpeech`.
- `playAudioBlobRobust`.
- événements `tts_error`, `tts_queue_result`, `gm_post_fallback`.

### Phase 2 — Émettre `voice_turn_completed`

Créer un agrégateur local dans `Index.tsx` ou un service dédié `voiceTelemetry.ts`.

Il collecte:

- timings orchestrateur déjà retournés;
- timings STT du dernier transcript;
- timings TTS/queue/playback;
- timings GM post;
- contexte navigateur;
- provider/model;
- statut final.

Émettre:

- `trackEvent("voice_turn_completed", payload)`;
- insert Supabase optionnel dans une nouvelle table `voice_turns`, ou stockage dans `turn_latencies.metadata_json` si l'on veut éviter une migration immédiate.

### Phase 3 — Standardiser les erreurs

Créer `recordVoiceError()`.

Chaque composant appelle cette fonction avec:

- `component`;
- `error_type`;
- `provider`;
- `recoverable`;
- `fallback_used`;
- contexte navigateur.

Elle envoie:

- `voice_error` PostHog;
- insert Supabase, idéalement table `voice_errors`.

### Phase 4 — Enrichir STT

Mesures à ajouter:

- `t_mic_permission_ms`
- `t_stt_token_ms`
- `t_stt_ws_open_ms`
- `t_stt_first_interim_ms`
- `t_stt_final_ms`
- `stt_trigger`
- `selected_mime_type`
- `media_recorder_supported`

### Phase 5 — Enrichir TTS/playback

Mesures à ajouter:

- `tts_segments_count`
- `tts_segments_played`
- `tts_segments_failed`
- `t_audio_playback_start_ms`
- `t_audio_playback_total_ms`
- `playback_error_type`
- `audio_unlocked_before_play`

### Phase 6 — Dashboard PostHog

Créer le dashboard manuellement depuis `docs/posthog-setup-guide.md` ou automatiquement via API.

Pour automatiser, il faut une Personal API Key PostHog, pas la clé publique `phc_...`.

## Priorité

Priorité immédiate:

1. `turn_id` partout.
2. `voice_turn_completed` agrégé.
3. `voice_error` unifié.
4. Propagation `session_id` / `turn_index` dans `audio_latency`.
5. Dashboard PostHog `Ava Proto1 — Latence voix Max`.

Priorité ensuite:

1. Jalons STT détaillés.
2. Jalons playback audio détaillés.
3. Table Supabase `voice_errors`.
4. Script d'installation PostHog avec Personal API Key.

## Critère de réussite

Après une session de test, on doit pouvoir répondre dans PostHog, sans lire la console:

- Quel est le p95 de `t_turn_response_ready_ms`?
- Quel est le p95 de `t_turn_voice_ready_ms`?
- Quel navigateur a le plus d'erreurs audio?
- Quel provider TTS a le plus mauvais p95?
- Quelle étape est le bloqueur dominant?
- Les sessions lentes sont-elles liées au modèle Max, au RAG, au TTS, au playback ou au STT?
- Les erreurs récupèrent-elles proprement avec fallback texte ou reprise micro?

## Implémentation livrée

Implémenté le 2026-05-22:

- Service `src/services/voiceTelemetry.ts` avec:
  - `createVoiceTurnId()`;
  - `buildVoiceTurnCompletedPayload()`;
  - `pickVoiceTurnBlocker()`;
  - `recordVoiceTurnCompleted()`;
  - `recordVoiceError()`.
- Nouveaux événements PostHog:
  - `voice_turn_completed`;
  - `voice_error`.
- Nouvelles tables internes Supabase:
  - `voice_turn_events`;
  - `voice_error_events`.
- Propagation `session_id`, `turn_id`, `turn_index` dans:
  - STT Deepgram;
  - TTS generation;
  - queue TTS;
  - erreurs TTS;
  - fallback GM post;
  - erreurs orchestrateur.
- Back-office:
  - `LatencyTelemetryTab` affiche désormais les statistiques agrégées `voice_turn_events` et les dernières erreurs `voice_error_events`.
- Tests:
  - `src/services/voiceTelemetry.test.ts`.
