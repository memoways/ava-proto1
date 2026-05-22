# Plan d'implémentation — PRD4 (mai 2026)

Refonte structurante : remplacement de l'onboarding A/B par un parcours unique post-film, injection d'un rôle utilisateur libre dans Max, affichage des 4 protagonistes (Max actif, Emma/Ava/Léo grisés), bascule conversation en push-to-talk avec sous-titres, suppression du GM pre-turn, remplacement total du questionnaire (+ mapping Notion).

Découpé en 6 phases livrables indépendamment.

---

## Phase 1 — Nouvelle state machine + écrans statiques

**Objectif** : tout le flow visuel cliquable sans STT/LLM/TTS.

- Nouveau type `ExperiencePhase` dans `src/types/index.ts` (welcome, film_question, teaser, role_capture, role_summary, character_select, locked_character, calling_max, conversation_max, end_session, questionnaire). `GamePhase` conservé en parallèle puis supprimé.
- `useGameState` réécrit. Supprimés : `variant`, `trustLevel`, `triggeredIds`, `currentTrigger`, `voiceModality` (PTT forcé). Ajoutés : `hasSeenFilm`, `teaserSeen`, `teaserSkipped`, `userRoleProfile`, `pttErrors`, `turnCount`.
- Composants écrans nouveaux/refondus : `WelcomeScreenPRD4`, `FilmQuestionScreen`, `TeaserScreen`, `RoleCaptureScreen`, `RoleSummaryScreen`, `CharacterSelectScreenPRD4`, `CallingMaxScreen`, `ConversationScreenPRD4`, `EndSessionScreen`.
- Suppression du router : `OnboardingAScreen`, `OnboardingBScreen`, `ABChoiceScreen`, `OnboardingScreen`, `GateScreen`.
- 4 SVG placeholders dans `src/assets/characters/`.

---

## Phase 2 — Création de rôle (PTT + résumé LLM)

- PTT sur `role_capture` (réutilise `usePushToTalk`, `deepgramSTT`).
- Edge function `summarize-role` (OpenRouter via `proxy-llm`, modèle `google/gemini-2.5-flash`) → JSON `user_role_profile_json` :
  `{ raw_input, summary_for_user, summary_for_max, relationship_to_family, age, gender, proximity_level, intent, created_by_system, created_at }`.
- Service `roleProfileService.ts`.
- Persistance dans `sessions.player_role` (colonne existante, pas de migration).
- Fallback robuste si LLM échoue.

---

## Phase 3 — Max contextualisé + GM post-turn async uniquement

- `maxAgent.ts` : injection de `summary_for_max` + champs structurés en tête du system prompt.
- `conversationOrchestrator.ts` : suppression du GM pre-turn du chemin critique, GM post-turn en `void` (non bloquant), JSON conforme PRD § 10.3.
- Migration : `alter table sessions add column gm_post_turn_log jsonb default '[]'`.
- Timer 3–5 min ou `end_recommended` → `end_session`.
- Conversation sans score/trust visible.

---

## Phase 4 — Personnages grisés + appel Max

- Grille 2×2, Max coloré, 3 autres grisés + cadenas + dialog "indisponible".
- `CallingMaxScreen` : 2–3 sonneries (~3s) puis transition auto vers `conversation_max`.

---

## Phase 5 — Nouveau questionnaire PRD4

- `QuestionnaireScreenPRD4.tsx` (10 questions PRD § 14.2 + email/opt-ins).
- Type `QuestionnairePRD4Data`. L'ancien `QuestionnaireData` conservé en historique.
- Données techniques auto (PRD § 14.3).
- `questionnaire_responses` jsonb : `{ version: "prd4", answers, technical }`.
- Edge `sync-questionnaire` modifiée : mapping PRD4 vers Notion (§ 14.4), détection par `version`.

---

## Phase 6 — Back-office + nettoyage

- `SessionsTab` : section "Rôle utilisateur" + timeline `gm_post_turn_log`.
- Suppression définitive écrans A/B + tests obsolètes.
- README + CHANGELOG.

---

## Section technique

### Migrations
```sql
alter table public.sessions
  add column if not exists gm_post_turn_log jsonb not null default '[]'::jsonb;
```

### Edge functions
- Nouveau : `summarize-role`.
- Modifié : `sync-questionnaire`.

### Garde-fous régression
- Pipeline STT/TTS/RAG inchangé.
- Telemetry latence bénéficie de la suppression du GM pre-turn.
- PostHog : events ajoutés `role_created`, `character_locked_clicked`, `ptt_error`, `session_ended`.

### Hors scope
- Vraie vidéo teaser, images finales, activation Emma/Ava/Léo, cinématiques, mémoire inter-personnages, split GM.
