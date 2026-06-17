# Plan — Game Master labels fiables + déclenchement vidéo (backend only)

Objectif : faire fonctionner le Game Master comme demandé (analyse fine du tour user en parallèle de Max, labels par phrase, déclenchement vidéo dès qu'un thème user recoupe un thème vidéo) **sans rien changer à l'UI utilisateur**.

## Architecture cible

```text
USER finalise sa phrase
        │
        ├──► Max LLM (RAG → réponse → TTS streaming)         [inchangé]
        │
        └──► GM "Label Pass" (LLM léger, 4 s timeout)       [nouveau, parallèle]
                 ├─ extrait labels {themes, topics, intentions} (≤4)
                 └─ Côté client : pickVideoForLabels(...)
                        → si match → activeVideo (déclenche après TTS Max)

POST Max → evaluatePostTurnPRD4 (engagement, end_recommended, log)  [inchangé]
         → garde-fou : trigger_video_id si rien n'a été joué ce tour
```

## Fichiers

- nouveau : `src/services/videoTriggerMatcher.ts` — normalisation + synonymes + matching déterministe.
- nouveau : `src/agents/gameMasterLabelPRD4.ts` — pass LLM mono-tâche pour les labels.
- modifié : `src/services/prd4Orchestrator.ts` — lance le label pass en parallèle, expose `labelPromise`.
- modifié : `src/pages/IndexPRD4.tsx` — consomme `labelPromise` (chips admin + vidéo) ; postTurn en garde-fou.

## Hors-scope

- Pas de modification de l'UI joueur.
- Pas de migration DB (labels déjà persistés dans `sessions.conversation_log[].labels`).
- Pas de modification du pipeline STT/TTS ni de l'agent Max.
