# AVA — Reprise questionnaire conversationnel, lot 1 : modèle, contexte de session et stockage

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison. Lot **sans écran visible** : données, contexte de
session, persistance et synchronisation Notion. Une action humaine à la fois.

Plan et décisions d'Ulrich du 8 novembre : [plan_questionnaire_conversationnel.md](plan_questionnaire_conversationnel.md).
Tâche Notion (Gamilab, vérifier get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) :
https://app.notion.com/p/3db62322e59580d6a482f195c6df5bb1.

## État vérifié au départ

- Questionnaire actuel : `src/components/prd4/QuestionnaireScreenPRD4.tsx` (10 curseurs pré-réglés à 3, donc aucun
  « non évalué »), soumis par `handleQuestionnaireSubmit` dans `src/pages/IndexPRD4.tsx` (vers la ligne 3302), qui
  construit `QuestionnairePRD4Data` (`src/types/index.ts`, ~l. 520) avec un bloc `technical` déjà riche (durée, tours,
  latences, erreurs micro, film vu, posture, personnage actif).
- Persistance : `src/services/prd4Questionnaire.ts` → `sessions.questionnaire_responses` (jsonb), puis
  `supabase/functions/sync-questionnaire/index.ts` (branches legacy PRD1–3 et PRD4) vers la base Notion
  `31d62322e595804795cbca5bf679d053`.
- Film vu : `state.hasSeenFilm` (`"vu" | "pas_vu" | "rappel"`), choisi à l'écran film du démarrage.
- Appareil : `src/services/deviceClass.ts` (`getDeviceClass()`), mode d'appel : `src/services/callOutputMode.ts`.
- Notion : seules les colonnes « PRD4 … » sont alimentées aujourd'hui ; les autres gardent l'historique.

## Objectif du lot 1

1. Types `QuestionnaireConversationalData` / `DimensionAnswer` du plan (`score: 1..5 | null`, `null` = non évalué).
2. `buildSessionContext()` pur et testé : film, teaser, personnages **réellement appelés** et passages Max ↔ Emma
   (vérifier la source fiable : état, `voice_turn_events` ou messages), durée, tours, latences, erreurs micro, raison
   de fin, appareil, mode d'appel. Rien de ce contexte ne doit devenir une question.
3. Sauvegarde `conversational-v1` à côté de PRD4 sans toucher aux réponses existantes ; lecture des anciennes versions
   inchangée (admin Questionnaires, export de sessions).
4. `sync-questionnaire` : branche `conversational-v1` ; contexte vers les colonnes PRD4 techniques existantes ; notes,
   verbatims, synthèse, version, appareil, mode d'appel vers de nouvelles colonnes « Conv ». Ajouter ces colonnes à la
   data source `collection://31d62322-e595-8036-af64-000b1236aaf2` (ajout seul : aucune colonne renommée, retypée ou
   vidée ; relire le schéma après écriture). Une note `null` n'écrit rien (cellule vide), jamais `0`.
5. Tests : non évalué ≠ 0 de bout en bout, PRD4 et legacy synchronisés comme avant, contexte sans questions.
6. Si une migration SQL s'avère nécessaire, elle passe par le chat Lovable ; a priori le jsonb suffit.

Hors lot : écran, STT, relances `proxy-llm`, radar (lots 2 à 4). Mettre à jour CHANGELOG, `docs/etat_courant.md`,
le plan (section « Exécution lot 1 ») et écrire le prompt du lot 2 avant le push ; livrer par la garde
(`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge`), puis vérifier la synchronisation Lovable et
redéployer `sync-questionnaire` via Lovable.
