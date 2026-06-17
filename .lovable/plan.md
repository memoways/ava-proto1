# Plan — Game Master labels fiables + déclenchement vidéo (backend only)

Objectif : faire fonctionner le Game Master comme demandé (analyse fine du tour user en parallèle de Max, labels par phrase, déclenchement vidéo dès qu'un thème user recoupe un thème vidéo) **sans rien changer à l'UI utilisateur**. Toute la sortie reste visible dans l'admin (déjà câblée).

## Diagnostic actuel (constaté sur la session « Test Ulrich patriarcat »)

1. **GM séquentiel.** `processPRD4Turn` lance `evaluatePostTurnPRD4` **après** la réponse Max. L'analyse user n'est pas démarrée en parallèle.
2. **Labels rares.** 3 évaluations sur 5 retournent `next_turn_guidance="Continue la conversation naturellement"` sans labels — le prompt unique mélange labels + guidance + trigger vidéo et le LLM lâche prise.
3. **Trigger vidéo fragile.** Il dépend du LLM qui doit renseigner `trigger_video_id`. Sur la session test, le mot « patriarcat » côté user n'a rien déclenché alors que `video_triggers.couteau` est étiquetée `[famille, patricarcat]` (coquille Notion).
4. **Données vidéos** : `couteau` [famille, patricarcat], `mauvaise conscience` [trahison, confiance], `mort Peter` [secrets, pandémie]. Toutes prêtes en base.
5. **UI joueur ok.** Les chips ne doivent PAS apparaître à l'écran (`ConversationScreen.tsx` reste intact). Les chips sont déjà rendues dans `SessionsTab.tsx` (admin) à partir de `conversationLog[].labels`.

## Architecture cible

```text
USER finalise sa phrase
        │
        ├──► Max LLM (RAG → réponse → TTS streaming)         [inchangé]
        │
        └──► GM "Label Pass" (LLM léger, mono-tâche, 4 s)   [nouveau, en parallèle]
                 │
                 ├─ extrait labels {themes, topics, intentions} (≤4)
                 └─ Côté client : pickVideoForLabels(labels, videos, userText)
                        → si match → activeVideo (déclenche après TTS Max, mécanique existante)
                 │
                 └─► attach labels au dernier message user (state + DB)

POST Max → evaluatePostTurnPRD4 (engagement, end_recommended, log)  [inchangé]
         → si elle renvoie un trigger_video_id et qu'aucune vidéo n'a été lancée ce tour → garde-fou
```

## Étapes d'implémentation

### 1. Nouveau matcher déterministe — `src/services/videoTriggerMatcher.ts`
- `normalize(str)` : minuscules + retrait des accents + map des coquilles connues (`patricarcat→patriarcat`, etc.).
- Table de synonymes (un seul match suffit) :
  - `famille` ⊃ père, sœur, frère, parents, enfance, fratrie, fils, fille
  - `patriarcat` ⊃ mâle, homme, machisme, domination, viril, violent
  - `trahison` ⊃ mensonge, cacher, secret, tromper
  - `secrets` ⊃ cacher, vérité, mensonge
  - `confiance` ⊃ trahison, loyauté
  - `pandémie` ⊃ virus, épidémie, contagion, protogynie
- `pickVideoForLabels(labels, videos, alreadyTriggered, rawUserMessage?)` → 1ère vidéo (par priorité asc) dont un `themes` recoupe un label ; fallback scan tokens du message brut. Ignore les vidéos déjà déclenchées.

### 2. Nouveau pass GM léger — `src/agents/gameMasterLabelPRD4.ts`
- Prompt mono-tâche : extraire **uniquement** `labels` (max 4, vides si pas évident). Pas de guidance, pas de cinematic_hint, pas de trigger.
- Modèle = `getLLMSettings().LLM_MODEL_GM`, `temperature: 0.1`, `max_tokens: 120`, timeout 4 s.
- Renvoie `{ labels, latency_ms, model, ok }`. Fallback `EMPTY` en cas d'erreur ou JSON invalide.

### 3. Orchestrateur — `src/services/prd4Orchestrator.ts`
- Après le RAG, lancer `labelUserTurnPRD4(...)` **sans await** (parallèle à Max).
- Ajouter `labelPromise: Promise<PRD4LabelResult>` au `PRD4TurnResult`.
- `postTurnPromise` inchangée (continue de remplir `gm_post_turn_log`, `engagement_delta`, `end_recommended`).

### 4. Page conversation — `src/pages/IndexPRD4.tsx`
- Consommer `labelPromise` dès résolution (en général avant la fin du TTS) :
  - `setLastUserLabels(labels)` (state existant).
  - Patcher le dernier `ConversationMessage` user avec `labels` puis `updatePRD4Conversation(...)`.
  - `pickVideoForLabels(labels, videos, triggered, userText)` → si match → `setActiveVideo(row)` (mécanique de déclenchement post-TTS existante).
  - Telemetry : `prd4_gm_label` { latency_ms, n_labels, trigger_video_id, source }.
- `postTurnPromise` reste branchée pour `end_recommended` et `prd4_gm_post_turn`. Garde-fou : si elle renvoie un `trigger_video_id` ET qu'aucune vidéo n'a été déclenchée ce tour → on l'utilise.

### 5. Aucun changement UI joueur
- `ConversationScreen.tsx`, `WelcomeScreen.tsx`, `PostureCaptureScreen.tsx`, etc. : **intacts**.
- Les chips sont déjà rendues dans `SessionsTab.tsx` à partir de `msg.labels` (déjà persisté dans `sessions.conversation_log`).

### 6. Documentation
- `docs/plan_game_master_labels_videos.md` : copie de ce plan pour archive projet.
- `CHANGELOG.md` (v0.31.0) + `STORY.md` (session 29) : entrée listant le label pass parallèle, le matcher déterministe et la fiabilisation du déclenchement vidéo. Préciser « aucun changement UI joueur ».

## Fichiers touchés

- nouveau : `docs/plan_game_master_labels_videos.md`
- nouveau : `src/services/videoTriggerMatcher.ts`
- nouveau : `src/agents/gameMasterLabelPRD4.ts`
- modifié : `src/services/prd4Orchestrator.ts` (ajout `labelPromise`, lancement parallèle)
- modifié : `src/pages/IndexPRD4.tsx` (consomme `labelPromise`, déclenchement vidéo via matcher, garde-fou postTurn)
- modifié : `CHANGELOG.md`, `STORY.md`

## Hors-scope

- Pas de modification de l'UI joueur (interdit explicitement par la consigne).
- Pas de migration DB (les labels sont déjà persistés via `ConversationMessage.labels` dans `sessions.conversation_log`).
- Pas de modification des vidéos Notion (la coquille `patricarcat` est tolérée par le matcher).
- Pas de changement du pipeline STT/TTS, ni de l'agent Max.

## Cas de validation rapide

- A. User dit « j'aimerais te parler du patriarcat dans ta famille » → label pass extrait `themes: ["patriarcat", "famille"]` → matcher trouve `couteau` (prio 1) → vidéo jouée après TTS Max → chip visible dans admin.
- B. User dit « bonjour ça va » → labels vides → aucune vidéo, aucun chip.
- C. Label pass timeout/erreur → garde-fou via `pickVideoForLabels(null, videos, [], userText)` sur tokens du message brut ; sinon, fallback éventuel sur le `trigger_video_id` renvoyé par `postTurnPromise`.
