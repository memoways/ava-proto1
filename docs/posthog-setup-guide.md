# Guide PostHog — Configurer le projet pour récupérer toutes les données de l'app

Ce document décrit **ce que l'application envoie à PostHog** (événements, propriétés, mécanique de collecte) et **comment configurer PostHog** pour en tirer des dashboards utiles : latences pipeline, latences voix (STT/TTS), funnel de jeu, coûts.

Projet PostHog : **EU Cloud** (`https://eu.i.posthog.com`)
Clé publique (publishable) intégrée dans `src/services/posthogService.ts` : `phc_x9m2Hn…sPyZr`

Voir aussi : `docs/posthog_latency_observability_audit.md` pour l'audit critique du schéma actuel, les lacunes de corrélation `session_id` / `turn_id`, et le dashboard cible "Ava Proto1 — Latence voix Max".

---

## 1. Mécanique de collecte côté app

### 1.1 Initialisation

Fichier : `src/services/posthogService.ts` (activé depuis `src/main.tsx` via `initializeAnalyticsFromStoredConsent()`).

Options activées :
- `$pageview` explicite après initialisation — la première vue ne peut pas être perdue pendant le chargement du SDK
- `capture_pageleave: true` — événement de sortie de page
- `autocapture: false` — aucun clic, formulaire ou changement d'input automatique
- `disable_session_recording: true` — aucun replay de session
- `persistence: "memory"` et `person_profiles: "never"` — pas de profil persistant

Pendant les tests internes, la collecte technique structurée est active par défaut et le panneau est masqué. `VITE_PRIVACY_NOTICE_ENABLED=true` rétablit le panneau et l'opt-in pour l'expérience finale. Les appels émis pendant le chargement asynchrone du SDK sont conservés dans une file bornée, puis rejoués.

`identifyUser(sessionId)` est appelé après création de la session (`IndexPRD4.tsx`) avec l'ID Supabase pseudonyme. Les événements suivants sont ainsi corrélés à la session sans créer de profil personne.

### 1.2 Pipeline de télémétrie latence

Fichier central : `src/services/latencyTelemetry.ts`.

Deux flux parallèles, **fire-and-forget** (jamais d'`await` côté hot path, exceptions silencées) :

1. **PostHog** via `trackEvent(...)` — pour dashboards temps réel
2. **Supabase** (`turn_latencies`, `audio_latencies`) — pour analyses historiques et UI admin

Cela signifie : tout ce qui apparaît dans l'onglet admin **Latences** et **Consommation Voix** est aussi présent dans PostHog sous les mêmes noms d'événements.

---

## 2. Événements envoyés

### 2.1 Événements de pipeline (latences)

| Event | Source | Propriétés clés |
|---|---|---|
| `turn_latency` | `latencyTelemetry.ts` → `createTurnTimer().emit()` | `session_id`, `turn_index`, `character`, `voice_modality`, `user_message_len`, `max_response_len`, `t_rag_rewrite_ms`, `t_rag_query_ms`, `t_rag_total_ms`, `t_knowledge_build_ms`, `t_gm_pre_ms`, `t_max_llm_ms`, `t_max_first_token_ms`, `t_validator_ms`, `t_gm_post_ms`, `t_turn_total_ms`, `rag_matches_count`, `rag_top_similarity`, `max_model`, `gm_model`, `validator_model`, `usage_total_tokens`, `had_fallback` |
| `turn_latency_post` | `conversationOrchestrator.ts` | `session_id`, `t_gm_post_ms` (mesure asynchrone post-réponse) |
| `audio_latency` | `recordAudioLatency()` | `direction` (`in`=STT / `out`=TTS), `t_stt_ms`, `t_tts_first_byte_ms`, `t_tts_total_ms`, `stt_text_len`, `tts_text_len`, `metadata.provider` (`elevenlabs`/`hume`/`inworld`), `metadata.model`, `metadata.status_code`, `metadata.error_type` (`ok`/`quota`/`auth`/`network`/`server`/`client`/`unknown`), `metadata.stitched_previous`, `metadata.stitched_next` |
| `voice_turn_completed` | `voiceTelemetry.ts` | Événement agrégé fin de tour : `turn_id`, `session_id`, `turn_index`, `t_turn_response_ready_ms`, `t_turn_voice_ready_ms`, `t_turn_end_to_end_ms`, `blocker_step`, `blocker_reason`, `severity`, `browser_family`, `voice_modality`, `max_model`, `tts_provider`, segments TTS |
| `voice_error` | `voiceTelemetry.ts` | Erreur unifiée : `component`, `provider`, `error_type`, `error_message`, `recoverable`, `fallback_used`, `browser_family`, `turn_id` |

Les événements `voice_turn_completed` et `voice_error` sont aussi persistés en Supabase dans `voice_turn_events` et `voice_error_events`, afin que l'admin interne et PostHog s'appuient sur le même schéma.

### 2.2 Événements de jeu / funnel

Le parcours actuel envoie notamment depuis `src/pages/IndexPRD4.tsx` :

| Event | Quand | Propriétés |
|---|---|---|
| `prd4_phase_changed` | Changement d'écran | `phase` |
| `prd4_onboarding_started` | Démarrage du parcours | — |
| `prd4_session_started` | Session Supabase créée | `session_id` |
| `prd4_session_duration_loaded` | Durée admin chargée | `duration_seconds` |
| `prd4_turn_completed` | Tour terminé | `session_id`, `turn_index`, latences |
| `prd4_gm_post_turn` | Analyse GM asynchrone | labels, engagement, recommandations, latence |
| `prd4_video_triggered` / `prd4_video_completed` | Vidéo dynamique | `session_id`, `video_id`, source/état |
| `prd4_persistence_result` | Écriture critique | opération, succès, `session_id` |
| `prd4_session_ended` | Fin de session | raison, durée, nombre de tours |
| `prd4_questionnaire_submitted` | Questionnaire | `session_id`, durée et nombre de tours |

### 2.3 Autocapture, logs et session replay

- L'autocapture et le replay restent désactivés : ils ne sont pas nécessaires aux métriques de fluidité.
- Les erreurs techniques structurées sont conservées après caviardage des tokens, clés et JWT.
- Les transcriptions, réponses libres, réponses brutes et contenus narratifs ne sont jamais envoyés à PostHog.

---

## 3. Configuration PostHog — étape par étape

### 3.1 Vérifier le projet

1. Connecte-toi sur https://eu.posthog.com
2. Ouvre le projet correspondant à la clé `phc_x9m2Hn…sPyZr` (settings → Project → Project API key)
3. Vérifie **Project Settings → Autocapture** : activé
4. Vérifie **Project Settings → Session Replay** : activé, "Record user sessions" ON

### 3.2 Définir les événements custom (Data management)

Va dans **Data management → Events**. Après quelques sessions de test, ces événements apparaîtront automatiquement. Pour chacun, clique → **Edit** → ajoute une description :

- `turn_latency` — Latence complète d'un tour conversationnel (RAG + LLM + validation)
- `audio_latency` — Latence d'un appel STT entrant ou TTS sortant
- `game_started`, `game_over`, `phase_changed`, etc. — voir tableau ci-dessus

### 3.3 Marquer les propriétés numériques comme **Numeric**

PostHog infère parfois les types en `string`. Pour pouvoir faire `median`, `p95`, `avg` :

Va dans **Data management → Properties**, et pour chacune des propriétés suivantes, force le type sur **Numeric** :

```
t_rag_rewrite_ms, t_rag_query_ms, t_rag_total_ms,
t_knowledge_build_ms, t_gm_pre_ms, t_max_llm_ms,
t_max_first_token_ms, t_validator_ms, t_gm_post_ms,
t_turn_total_ms, t_stt_ms, t_tts_first_byte_ms, t_tts_total_ms,
user_message_len, max_response_len, stt_text_len, tts_text_len,
rag_matches_count, rag_top_similarity, usage_total_tokens,
turn_index, trust_level, duration
```

### 3.4 Créer les Insights (dashboards)

Crée un nouveau **Dashboard** "Ava Proto1 — Pipeline" et ajoute :

**A. Latence tour conversationnel (Trends)**
- Event : `turn_latency`
- Math : `p50` puis `p95` sur la propriété `t_turn_total_ms`
- Breakdown : `max_model`
- Interval : par jour

**B. Décomposition pipeline (Trends, stacked)**
- 6 séries, même event `turn_latency`, math = `median`, propriétés respectives :
  `t_rag_total_ms`, `t_knowledge_build_ms`, `t_gm_pre_ms`, `t_max_llm_ms`, `t_validator_ms`, `t_gm_post_ms`
- Affichage : `Area chart (stacked)`

**C. Latence STT Deepgram (Trends)**
- Event : `audio_latency`
- Filtre : `direction = in`
- Math : `p50` et `p95` sur `t_stt_ms`

**D. Latence TTS premier octet & total (Trends)**
- Event : `audio_latency`, filtre `direction = out`
- Math : `p50`/`p95` sur `t_tts_first_byte_ms` et `t_tts_total_ms`
- Breakdown : `metadata.provider` (compare ElevenLabs / Hume / Inworld)

**E. Erreurs TTS par provider (Trends)**
- Event : `audio_latency`, filtre `metadata.error_type ≠ ok`
- Math : `total count`
- Breakdown : `metadata.error_type` puis dupliquer avec breakdown `metadata.provider`

**F. Volume caractères TTS (proxy coût)**
- Event : `audio_latency`, filtre `direction = out`
- Math : `sum` sur `tts_text_len`
- Breakdown : `metadata.provider`
- Tarifs (à mettre dans la description de l'insight) : ElevenLabs $0.30/1k chars, Hume $0.20/1k, Inworld $0.005/1k

**G. Fallbacks LLM**
- Event : `turn_latency`, filtre `had_fallback = true`
- Math : `total count`, interval = jour

**H. Vue voix agrégée end-to-end**
- Event : `voice_turn_completed`
- Math : `p50` et `p95` sur `t_turn_response_ready_ms`, `t_turn_voice_ready_ms`, `t_turn_end_to_end_ms`
- Breakdown : `browser_family`, puis dupliquer avec `voice_modality`, `max_model`, `tts_provider`

**I. Top blockers**
- Event : `voice_turn_completed`
- Math : `total count`
- Filtre : `severity != ok`
- Breakdown : `blocker_step`

**J. Erreurs voix transverses**
- Event : `voice_error`
- Math : `total count`
- Breakdown : `component`
- Dupliquer avec breakdown `error_type` et `provider`

### 3.5 Funnel de jeu

Crée un Insight type **Funnel** :

1. `game_started`
2. `phase_changed` où `phase = character_select`
3. `phase_changed` où `phase = conversation`
4. `game_over`
5. `questionnaire_submitted`

Conversion window : 30 minutes. Breakdown par `variant` pour comparer A vs B.

### 3.6 Cohort & filtres utiles

- **Cohort "Sessions complètes"** : utilisateurs ayant déclenché `questionnaire_submitted`
- **Cohort "Échec TTS"** : utilisateurs avec ≥1 `tts_error`
- Filtre global pratique sur les dashboards : `voice_modality = voice` pour isoler le mode vocal

### 3.7 Session Replay

Dans **Session Replay**, crée des **playlists** filtrées :
- Sessions avec `tts_error`
- Sessions avec `had_fallback = true` (via filtre sur event `turn_latency`)
- Sessions terminées (`game_over` avec `reason = timeout`)

### 3.8 Alertes (Subscriptions)

Sur chaque insight critique → **⋯ → Subscribe** :
- p95 `t_turn_total_ms` > 5000ms → email quotidien
- Comptage `tts_error` > 5/h → email
- Taux d'erreur `audio_latency` (error_type ≠ ok) > 10% → email

---

## 4. Vérification

1. Lance une partie complète sur https://proto1.parle-a-ava.com
2. Dans PostHog → **Activity → Live events**, tu dois voir en quasi-temps réel :
   `game_started` → `phase_changed` (×N) → `audio_latency` (×N) → `turn_latency` (×N) → `game_over` → `questionnaire_submitted`
3. Vérifie qu'une session apparaît dans **Session Replay** sous quelques minutes
4. Vérifie que les insights p50/p95 affichent des valeurs (pas "no data")

Si une propriété affiche "—" dans les graphes : revenir à §3.3 et forcer le type Numeric.

---

## 5. Maintenance

- **Ajout d'un nouvel événement** : ajouter `trackEvent("nom", { … })` côté app + documenter ici + créer l'insight dans PostHog.
- **Ajout d'une nouvelle propriété latence** : étendre `TurnLatencyRecord` ou `AudioLatencyRecord` dans `src/services/latencyTelemetry.ts`. Elle remonte automatiquement.
- **Désactivation d'urgence de la télémétrie** : `disableTelemetry()` exporté depuis `latencyTelemetry.ts` (toggle runtime, sans rebuild).
