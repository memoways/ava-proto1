# AVA — Reprise questionnaire conversationnel, lot 3 : validation finale et radar

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison. Une action humaine à la fois.

Plan : docs/plan_questionnaire_conversationnel.md (lire « Décisions », « Règles de conduite », « Exécution lot 1 » et
« Exécution lot 2 »). Tâche Notion (Gamilab, vérifier get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) :
https://app.notion.com/p/3db62322e59580d6a482f195c6df5bb1. Base Caractères en lecture seule.

## État vérifié au départ (lot 2 livré le 8 novembre)

- Réglage `GameplaySettings.QUESTIONNAIRE_MODE` (`prd4` par défaut, `conversational` sur choix admin, onglet Game
  Master). `IndexPRD4` rend `ConversationalQuestionnaire` en phase `questionnaire` si le mode est conversationnel,
  sinon `QuestionnaireScreenPRD4` (inchangé). Contexte de session figé à l'ouverture (`conversationalContext`).
- Machine à états pure `src/services/conversationalQuestionnaireFlow.ts` : `startFlow`, `submitAnswer`, `applyFollowUp`,
  `submitFollowUpAnswer`, `confirmScore`, `detectSpokenScore`, `rawSummary`, `buildProvisionalQuestionnaire`,
  `DIMENSION_LABELS` ; étape finale `review`.
- Écran `src/components/prd4/ConversationalQuestionnaire.tsx` ; dictée `src/hooks/useDictation.ts` (façade STT seule).
- Relance : `src/services/conversationalFollowUp.ts` (pur, filtre des mesures) et `conversationalFollowUpClient.ts`
  (`proxy-llm`, prompt `ava_questionnaire_followup_settings` / `DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT`).
- L'étape `review` affiche une synthèse **brute** (`edited_by_user: false`), une case de consentement à la transcription
  et « Enregistrer mes réponses » → `saveConversationalQuestionnaire` puis `syncConversationalQuestionnaireToNotion`.
  Email et opt-ins ne sont pas encore proposés (`opt_in_* = false`).
- Admin Questionnaires et export : `conversational-v1` lu tel quel, sans rendu dédié.
- Recette humaine voix réelle (smartphone, desktop) du lot 2 : **non faite** ; à signaler, pas à présenter comme faite.

## Objectif du lot 3

1. Remplacer l'étape `review` par la validation finale : synthèse par dimension éditable (réponse, relance, note,
   commentaire), `edited_by_user` vrai dès qu'un texte change, aucune note modifiée sans geste explicite.
2. Radar 5 axes (1–5) montré au participant ; dimensions non évaluées listées à part, jamais tracées à 0
   (`radarScores`). Respecter la skill dataviz (couleurs en tokens, clair/sombre, lisible mobile).
3. Consentement (transcription, jamais l'audio), email facultatif et opt-ins repris des canaux PRD4 ;
   « Valider et envoyer » seul déclencheur d'enregistrement définitif.
4. Admin Questionnaires : radar agrégé (moyennes par dimension sur les seules notes données, nombre de « non évalué »),
   verbatims par dimension, filtre appareil (`session_context.device_class`) ; export cohérent. PRD4/legacy intacts.
5. Notion : vérifier qu'un vrai envoi remplit les colonnes « Conv » (premier envoi réel de la branche
   `conversational-v1`) ; aucune colonne existante renommée ni vidée.

Hors lot : recette multi-appareils et réglages d'écran fins (lot 4).

## Validations

- Unitaires : synthèse éditée ⇒ `edited_by_user`, radar sans 0 pour `null`, agrégat admin ignorant les non évalués,
  filtre appareil, consentement obligatoire, legacy/PRD4 rendus comme avant.
- `npm run test:quality` et `npm run test:delivery` verts ; E2E ciblé (clavier) jusqu'à « Valider et envoyer » et
  admin agrégé.
- Recette humaine distincte (voix réelle smartphone/desktop, lots 2 et 3) : ne pas la présenter comme faite.

## Livraison

Mettre à jour CHANGELOG, `docs/etat_courant.md`, le plan (section « Exécution lot 3 ») et écrire le prompt du lot 4
(`docs/prompt_reprise_questionnaire_conversationnel_lot_4.md`) avant le push ; si aucun lot ne suit, le dire. Livrer
par la garde (`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`), vérifier arbre/parent sur main et la synchronisation Lovable.
Toute Edge Function modifiée est redéployée via Lovable. Mettre à jour la tâche Notion (avancement, reçu).

## Première action

`git status`, `git fetch --prune`, main propre par `git pull --ff-only` (si `/usr/bin/git` est bloqué par la licence
Xcode, `DEVELOPER_DIR=/Library/Developer/CommandLineTools git …`), puis lire l'étape `review` de
`src/components/prd4/ConversationalQuestionnaire.tsx`, `radarScores` dans `src/services/conversationalQuestionnaire.ts`
et l'onglet admin Questionnaires (`grep -rn "questionnaire_responses" src/components`).
