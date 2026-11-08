# AVA — Reprise questionnaire conversationnel, lot 4 : appareils et recette (dernier lot)

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en
français. Lovable / Lovable Cloud est l'unique chaîne de livraison. Une action humaine à la fois.

Plan : docs/plan_questionnaire_conversationnel.md (lire « Décisions », « Règles de conduite », « Exécution lot 2 » et
« Exécution lot 3 »). Tâche Notion (Gamilab, vérifier get-self `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) :
https://app.notion.com/p/3db62322e59580d6a482f195c6df5bb1. Base Caractères en lecture seule.

## État vérifié au départ (lot 3 livré le 8 novembre)

- Parcours complet derrière `GameplaySettings.QUESTIONNAIRE_MODE = "conversational"` (défaut `prd4`) :
  `ConversationalQuestionnaire` (5 dimensions, relance unique, note confirmée) puis `ConversationalReview`
  (synthèse éditable, radar `ConversationalRadar`, consentement, email/opt-ins, « Valider et envoyer »).
- Admin Questionnaires : `ConversationalQuestionnairesPanel` (radar des moyennes, non évalué, verbatims, filtre
  appareil) ; détail dédié ; export Markdown avec section questionnaire conversationnel.
- Notion : **aucune** ligne de « Questionnaire AVA » (data source `collection://31d62322-e595-8036-af64-000b1236aaf2`)
  n'a de « Conv Version » au 8 novembre. Le premier envoi réel n'a pas eu lieu.
- Recette voix réelle (smartphone, desktop) des lots 2 et 3 : **non faite**.

## Objectif du lot 4

1. Smartphone (< 640 px) : une question par écran, bouton micro et validation en bas au pouce, cibles 44 px,
   radar compact ; vérifier que la synthèse éditable reste lisible (cartes repliables si trop dense).
2. Tablette (`touchFirst`, `touchFirstFor`) : cibles 44 px, « Répondre à la voix » au toucher.
3. Desktop : question et transcript côte à côte sur les étapes réponse/relance.
4. E2E `@device` sur les projets `iphone` / `ipad` (WebKit) pour le parcours clavier jusqu'à « Valider et envoyer ».
5. Préparer la recette humaine (fiche dans `docs/`, sur le modèle de `docs/recette_adaptation_ecrans.md`) : voix
   réelle smartphone/tablette/desktop, relance réelle, premier envoi réel et lecture des colonnes « Conv » dans
   Notion (aucune colonne existante renommée ni vidée), lecture admin agrégée.

Aucun lot ne suit le lot 4 : après lui, seule reste la recette humaine et la décision d'activer le mode
conversationnel par défaut (décision d'Ulrich, pas de l'agent).

## Validations

- `npm run test:quality` et `npm run test:delivery` verts ; E2E `@device` ciblés sur `iphone` / `ipad`.
- Captures 375 × 812, 768 × 1024 et 1280 × 900 de chaque étape, regardées avant livraison.
- Recette humaine distincte : ne pas la présenter comme faite.

## Livraison

Mettre à jour CHANGELOG, `docs/etat_courant.md`, le plan (« Exécution lot 4 ») avant le push ; dire qu'aucun lot ne
suit. Livrer par la garde (`node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`), vérifier arbre/parent sur main et la synchronisation Lovable.
Mettre à jour la tâche Notion (avancement, reçu).

## Première action

`git status`, `git fetch --prune`, main propre par `git pull --ff-only`, puis lire
`src/components/prd4/ConversationalQuestionnaire.tsx`, `src/components/prd4/ConversationalReview.tsx` et
`touchFirstFor` (`grep -rn "touchFirstFor" src`).
