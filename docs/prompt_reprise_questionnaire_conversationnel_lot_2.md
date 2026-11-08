# AVA — Reprise questionnaire conversationnel, lot 2 : parcours vocal

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison. Une action humaine à la fois.

Plan et décisions d'Ulrich du 8 novembre : [plan_questionnaire_conversationnel.md](plan_questionnaire_conversationnel.md)
(lire « Décisions », « Règles de conduite », « Questions par dimension » et « Exécution lot 1 »).
Tâche Notion (Gamilab, vérifier get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) :
https://app.notion.com/p/3db62322e59580d6a482f195c6df5bb1.

## État vérifié au départ (lot 1 livré le 8 novembre)

- Modèle : `QuestionnaireConversationalData`, `DimensionAnswer`, `ConversationalSessionContext` dans
  `src/types/index.ts` ; note `1..5 | null`, `null` = non évalué.
- `src/services/conversationalQuestionnaire.ts` (pur) : `buildSessionContext(input)`, `baseDimensionQuestions(context)`,
  `emptyDimensionAnswer`, `normalizeScore`, `validateConversationalQuestionnaire`, `radarScores`,
  `CONVERSATIONAL_DIMENSIONS`.
- Entrées de `buildSessionContext` disponibles dans `src/pages/IndexPRD4.tsx` : `sessionIdRef`, `state.hasSeenFilm`,
  `state.teaserSeen` / `teaserSkipped`, `startingCharacterRef`, `conversationRef.current`, `watchedVideosRef.current`,
  `sessionDurationRef`, `turnLatenciesRef`, `state.pttErrors`, `handsFreeSettingsRef.current.enabled`,
  `state.endReason`, `getDeviceClass()`, `callModeRef.current` (`mode`, `avatarFallback`), `state.userRoleProfile`,
  `state.userPosture`. Rien de ce contexte ne devient une question.
- Persistance : `saveConversationalQuestionnaire` (écrit seulement si `questionnaire_responses` est vide) et
  `syncConversationalQuestionnaireToNotion` dans `src/services/prd4Questionnaire.ts` ; branche `conversational-v1` de
  `sync-questionnaire` (mapping dans `supabase/functions/_shared/questionnaireNotionProps.ts`) ; 16 colonnes « Conv »
  dans la base Notion « Questionnaire AVA ». Vérifier que Lovable a bien redéployé `sync-questionnaire`.
- Le parcours visible reste PRD4 : `handleEndContinue` → phase `questionnaire` → `QuestionnaireScreenPRD4`, réglage
  `SHOW_QUESTIONNAIRE` dans `settingsService.ts`.

## Objectif du lot 2

1. Réglage admin (gameplay, défaut désactivé) pour choisir le questionnaire conversationnel ; repli sur PRD4 sinon,
   sans changer PRD4.
2. Écran `ConversationalQuestionnaire` : une dimension à la fois, repère « X/5 », question **affichée, jamais lue**
   (aucun TTS), réponse à la voix par la façade `src/services/stt` seule (saisie clavier toujours possible), texte
   affiché au fil de la parole et corrigeable avant validation, aucune avance automatique.
3. Relance unique par dimension, générée par `proxy-llm` avec la réponse et le contexte de session ; prompt éditorial
   dans Notion avec défaut dans `settingsService.ts` (vérifier admin_settings/localStorage). La relance lève une
   réponse incomplète ou une contradiction, ne suggère rien, ne cite jamais une mesure (« on a mesuré des latences »
   interdit). Échec ou délai dépassé : pas de relance, le parcours continue.
4. Note : pastilles 1–5 et « je préfère ne pas noter » (`null`) ; une note proposée depuis la parole (« je dirais 4 »)
   est affichée puis confirmée (`score_source: "voice_confirmed"`) ; jamais de valeur par défaut.
5. À la fin du lot 2, enregistrement provisoire possible avec une synthèse brute ; la validation finale et le radar sont
   le lot 3.

Hors lot : radar et validation finale (lot 3), recette multi-appareils (lot 4). Base Caractères Notion en lecture seule.

## Validations

- Unitaires : enchaînement des 5 dimensions, une seule relance, note nulle ≠ 0, aucune question sur le contexte, repli
  PRD4 quand le réglage est désactivé, relance absente en cas d'échec `proxy-llm`.
- `npm run test:quality` et `npm run test:delivery` verts ; E2E ciblé du parcours (texte au clavier).
- Recette humaine distincte (voix réelle sur smartphone et desktop) : ne pas la présenter comme faite.

## Livraison

Mettre à jour CHANGELOG, `docs/etat_courant.md`, le plan (section « Exécution lot 2 ») et écrire le prompt du lot 3
(`docs/prompt_reprise_questionnaire_conversationnel_lot_3.md`) avant le push. Livrer par la garde
(`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge` via `github-delivery-exec`), vérifier arbre/parent
sur main et la synchronisation Lovable. Toute Edge Function modifiée est redéployée via Lovable.

## Première action

`git status`, `git fetch --prune`, main propre par `git pull --ff-only`, puis lire `handleEndContinue` et le rendu de
la phase `questionnaire` dans `src/pages/IndexPRD4.tsx`, et `src/services/stt/index.ts`.
