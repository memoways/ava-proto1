# Plan — Questionnaire conversationnel de fin d'expérience

Mise à jour : 8 novembre 2026. Tâche Notion (Gamilab) :
https://app.notion.com/p/3db62322e59580d6a482f195c6df5bb1. Base cible : « Questionnaire AVA »
(`31d62322e595804795cbca5bf679d053`, data source `collection://31d62322-e595-8036-af64-000b1236aaf2`).

## But

Remplacer le formulaire PRD4 (10 curseurs) par un échange court, à la voix, qui :

- comprend ce qui fonctionne et ce qui ne fonctionne pas, et pourquoi ;
- s'adapte à l'appareil et à l'usage réel de la session ;
- explore 5 dimensions, recueille du qualitatif, puis une note 1–5 confirmée par dimension, pour un radar ;
- se termine par une validation humaine de la synthèse avant tout enregistrement définitif ;
- reste lisible et utilisable au pouce sur smartphone, au toucher sur tablette, au clavier/souris sur desktop.

## Décisions d'Ulrich (8 novembre 2026)

1. **Voix d'entrée seulement.** La personne répond à la voix (saisie au clavier toujours possible). Questions et
   relances sont **affichées**, jamais lues : aucune voix de sortie, aucun TTS dans ce parcours.
2. **Dimensions de Notion** : fluidité, intérêt, immersion, crédibilité des personnages, engagement émotionnel. Le rôle
   de bénévole, « ce qui marche / ne marche pas » et les projections AVA sont explorés par les relances.
3. **Ne jamais demander ce que la session connaît déjà.** Film vu / pas vu / rappel (`state.hasSeenFilm`, choisi au
   démarrage), personnages appelés et passages Max ↔ Emma, durée, nombre de tours, latences, erreurs micro, appareil
   et mode d'appel (vidéo avatar ou appel vocal) sont **repris des données de session**, pas posés. On ne pose que ce
   qui ne peut pas être inféré de l'usage. Les choix rapides PRD4 (film, personnage suivant, durée ressentie) ne sont
   pas reconduits comme questions séparées.
4. **Conservation** : transcription des réponses et synthèse validée. L'audio n'est jamais stocké.
5. **Radar** montré au participant dans la validation finale, et radar agrégé dans l'admin (filtrable par appareil).

## Règles de conduite (reprises de Notion, non négociables)

- Qualitatif d'abord : chaque dimension s'ouvre par une question ouverte ; la note arrive après, comme confirmation.
- Une question à la fois, **une seule relance maximum par dimension**, 2 à 3 minutes au total ; repère « X/5 ».
- La relance sert seulement à lever une réponse incomplète ou une contradiction ; elle ne complète jamais à la place
  de la personne et ne suggère pas de réponse.
- Une note n'est jamais déduite en silence : une note proposée à partir des propos (« je dirais 4 ») est affichée et
  confirmée ; sinon la personne touche une pastille 1–5 ou choisit « je préfère ne pas noter ».
- « Non évalué » (`null`) est distinct de toute note ; jamais de valeur par défaut (le formulaire PRD4 pré-réglait 3).
- Aucune avance automatique avant validation ; transcript visible pendant la relance ; pas de densité excessive mobile.

## Questions par dimension (texte de base, ajusté au contexte de session)

| Dimension | Question ouverte | Contexte de session utilisé (jamais demandé) |
|---|---|---|
| Fluidité | Déroulé : qu'est-ce qui a bien fonctionné, qu'est-ce qui a accroché, et pourquoi ? | appareil, mode d'appel (avatar / voix seule), latences, erreurs micro, mains libres |
| Intérêt | À quel moment l'envie de continuer était la plus forte, et quand l'attention est-elle retombée ? | durée, nombre de tours, raison de fin |
| Immersion | À quel moment l'expérience a cessé d'être un test pour devenir une histoire, et qu'est-ce qui l'a cassée ? | film vu / pas vu / rappel, teaser vu ou passé, cinématiques déclenchées |
| Crédibilité des personnages | Qu'est-ce qui a rendu {personnages appelés} crédibles, ou au contraire faux ? | personnages appelés, passage Max ↔ Emma |
| Engagement émotionnel | Qu'est-ce que tu as ressenti, et à quel moment ? | rôle de bénévole et posture de départ |

Adaptation à l'appareil : sur smartphone (appel vocal sans avatar), la relance de fluidité peut viser la voix seule ;
sur tablette/desktop (avatar vidéo), la synchronisation et la présence de l'avatar. Le texte de la question reste
neutre : le contexte oriente la relance, il n'oriente pas la réponse (« on a mesuré des latences » est interdit).

## Données

Nouveau format dans `sessions.questionnaire_responses`, `version: "conversational-v1"` ; les réponses `prd4` et
antérieures restent lues telles quelles et ne sont jamais réécrites.

```ts
type DimensionKey = "fluidity" | "interest" | "immersion" | "character_credibility" | "emotional_engagement";
interface DimensionAnswer {
  question: string;            // texte affiché
  answer: string;              // transcription validée
  follow_up: { question: string; answer: string } | null;
  score: 1 | 2 | 3 | 4 | 5 | null; // null = non évalué
  score_source: "touch" | "voice_confirmed" | null;
  score_comment: string | null;
}
interface QuestionnaireConversationalData {
  version: "conversational-v1";
  dimensions: Record<DimensionKey, DimensionAnswer>;
  summary: { text: string; edited_by_user: boolean; validated_at: string };
  consent: { transcript_storage: true; contact_email?: string; opt_in_updates: boolean; opt_in_feedback: boolean };
  session_context: { /* repris de la session : film, personnages, durée, tours, latences, appareil, mode d'appel */ };
}
```

Notion : ajout de colonnes, **aucune colonne existante renommée ni vidée**. Préfixe « Conv » : 5 notes (`Conv Fluidité`,
`Conv Intérêt`, `Conv Immersion`, `Conv Crédibilité`, `Conv Engagement`, number, vide = non évalué), 5 verbatims
(texte), `Conv Synthèse`, `Conv Version`, `Conv Appareil`, `Conv Mode appel`. Le contexte déjà couvert par les
colonnes PRD4 techniques (film, personnage actif, durée, tours, latences) réutilise ces colonnes. `sync-questionnaire`
garde ses branches legacy et PRD4 et gagne une branche `conversational-v1`.

## Lots

1. **Modèle, contexte de session et stockage** — types, construction du `session_context` depuis l'état et la base
   (personnages réellement appelés, appareil, mode d'appel), sauvegarde, branche `conversational-v1` de
   `sync-questionnaire`, colonnes Notion « Conv », tests unitaires (non évalué ≠ 0, legacy intact). Aucun écran.
2. **Parcours vocal** — écran `ConversationalQuestionnaire` derrière un réglage admin (repli sur PRD4) ; saisie par la
   façade `src/services/stt` seule ; texte affiché au fil de la parole ; relance unique générée par `proxy-llm` avec
   le contexte de session (prompt éditorial dans Notion, défaut dans `settingsService.ts`) ; note confirmée.
3. **Validation finale et radar** — synthèse par dimension éditable, radar 5 axes avec dimensions non évaluées à
   part, consentement/email, « Valider et envoyer » ; radar agrégé et verbatims dans l'admin Questionnaires, filtre
   appareil.
4. **Appareils et recette** — smartphone (une question par écran, micro en bas, 44 px, radar compact), tablette
   (`touchFirst`), desktop (question et transcript côte à côte) ; E2E `@iphone` / `@ipad` ; recette humaine.

## Exécution lot 1 (8 novembre 2026)

- **Source fiable des personnages et passages** : le journal `conversationRef` (celui que `endPRD4Session` écrit dans
  `sessions.conversation_log`). Un personnage est « appelé » s'il a une réplique non vide (`role` `max`/`emma`) ; un
  passage est un changement de locuteur entre deux répliques, `returning` si le personnage avait déjà parlé. Plus
  fiable que `voice_turn_events` (télémétrie, absente si l'outbox échoue) et que `handoffCountRef` (compte les offres).
- **Mode d'appel** : `callModeRef` dans `IndexPRD4` (mode résolu par `resolveCallOutputMode` au décrochage, repli
  avatar → voix marqué par `activateTTSFallback`). Appareil : `getDeviceClass()`. Film : `state.hasSeenFilm`
  (`rappel` = vu, comme `experienceFrame`).
- **Code** : types dans `src/types/index.ts` ; `src/services/conversationalQuestionnaire.ts` (pur) ;
  `saveConversationalQuestionnaire` / `syncConversationalQuestionnaireToNotion` dans `src/services/prd4Questionnaire.ts`
  (écriture seulement si `questionnaire_responses` est vide) ; mapping Notion extrait tel quel dans
  `supabase/functions/_shared/questionnaireNotionProps.ts` + branche `conversational-v1`.
- **Notion** (data source `collection://31d62322-e595-8036-af64-000b1236aaf2`, ajout seul, schéma relu après écriture) :
  `Conv Fluidité`, `Conv Intérêt`, `Conv Immersion`, `Conv Crédibilité`, `Conv Engagement` (number, vide = non évalué),
  cinq `… verbatim` (texte : réponse, relance, commentaire de note), `Conv Synthèse`, `Conv Version`, `Conv Appareil`,
  `Conv Mode appel` (Avatar vidéo / Voix seule / Avatar puis voix (repli)), plus `Conv Personnages appelés`
  (multi-select) et `Conv Passages` (number), que les colonnes PRD4 ne couvraient pas. Le contexte connu va dans les
  colonnes PRD4 techniques (film, teaser, personnage de départ, durée, tours, latences, erreurs micro, raison de fin,
  rôle JSON, transcript) ; email et opt-ins réutilisent les canaux PRD4.
- **Pas de migration SQL** : le jsonb suffit. Lecture admin/export inchangée (le rendu dédié arrive au lot 3).
- Redéploiement de `sync-questionnaire` : par Lovable après la fusion.

## Exécution lot 2 (8 novembre 2026)

- **Réglage** : `GameplaySettings.QUESTIONNAIRE_MODE` (`"prd4"` | `"conversational"`, défaut `"prd4"`, toute autre valeur
  → PRD4 via `normalizeQuestionnaireMode`), interrupteur « Questionnaire conversationnel (à la voix) » dans l'onglet
  Game Master, actif seulement si le questionnaire final est affiché. `IndexPRD4` lit le mode avec `SHOW_QUESTIONNAIRE` ;
  `handleEndContinue` et le formulaire PRD4 sont inchangés.
- **Parcours** : machine à états pure `src/services/conversationalQuestionnaireFlow.ts` (réponse → relance éventuelle
  → note → dimension suivante, `review` à la fin) ; aucune étape n'avance seule. Une relance au plus par dimension
  (`followUpRequested`). `detectSpokenScore` repère « je dirais 4 », « 3 sur 5 », « je mettrais cinq » ; la note est
  seulement proposée, `voice_confirmed` uniquement si la personne confirme la note entendue, sinon `touch`.
- **Écran** : `src/components/prd4/ConversationalQuestionnaire.tsx`, repère « X/5 », question affichée, réponse
  précédente visible pendant la relance et la note. Dictée par `src/hooks/useDictation.ts` sur `createConfiguredSTT`
  (façade seule, micro demandé dans le geste, mode manuel, « J'ai fini de parler » appelle `flush`) ; texte affiché au
  fil de la parole, champ modifiable, validation bloquée pendant l'écoute, saisie clavier toujours possible. Aucun TTS.
- **Relance** : `src/services/conversationalFollowUp.ts` (pur) + `conversationalFollowUpClient.ts` (`callLLM` →
  `proxy-llm`, `feature_key: questionnaire_follow_up`, température 0,2). Le modèle reçoit la question, la réponse et un
  contexte **qualitatif** seulement (appareil, avatar/voix seule et repli, mains libres, film vu ou non, personnages
  entendus, passage) : aucune latence, durée ni compte. Sortie JSON `{"follow_up": …}` ; rejet si chiffre, mot de
  mesure (« latence », « mesuré », « secondes », « erreur micro », « on a remarqué »…), plus de 220 caractères ou pas
  une question. Échec, délai (6 s par défaut) ou rejet : pas de relance.
- **Prompt éditorial** : texte dans la tâche Notion (section « Prompt de relance ») ; défaut identique
  `DEFAULT_QUESTIONNAIRE_FOLLOW_UP_PROMPT` dans `settingsService.ts`, surchargeable par environnement dans
  admin_settings, clé `ava_questionnaire_followup_settings` (`prompt`, `timeoutMs`, `model` ; vide = `LLM_MODEL`).
  Aucune surcharge n'existait au 8 novembre (clé nouvelle).
- **Enregistrement provisoire** : écran « Tes réponses » avec synthèse brute (`rawSummary`, non éditée,
  `edited_by_user: false`), case de consentement à la conservation de la transcription obligatoire, puis
  `saveConversationalQuestionnaire` et, si écrit, `syncConversationalQuestionnaireToNotion` ; évènement PostHog
  `conversational_questionnaire_submitted` (notes données, relances, appareil). Email/opt-ins : lot 3.
- **Tests** : unitaires (enchaînement des 5 dimensions, relance unique, null ≠ 0, aucune question sur le contexte, repli
  PRD4, relance absente en échec, filtre des mesures, dictée par la façade) et deux E2E clavier (relance puis relance en
  503) vérifiant l'absence d'appel TTS, la sauvegarde et l'appel `sync-questionnaire`.
- **Non fait** : recette voix réelle smartphone/desktop ; aucune Edge Function modifiée (pas de redéploiement).

Prompt de reprise du lot 3 : [prompt_reprise_questionnaire_conversationnel_lot_3.md](prompt_reprise_questionnaire_conversationnel_lot_3.md).
Prompt du lot 2 (historique) : [prompt_reprise_questionnaire_conversationnel_lot_2.md](prompt_reprise_questionnaire_conversationnel_lot_2.md).
Prompt du lot 1 (historique) : [prompt_reprise_questionnaire_conversationnel_lot_1.md](prompt_reprise_questionnaire_conversationnel_lot_1.md).
