# Reprise F2 — cycle des appels Ava

Document préparé pendant F1 le 26 octobre 2026. **F2 non lancé.**
L'état de livraison F1 ci-dessous sera renseigné après vérification GitHub/Lovable.

## Première action exécutable et contrôles

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, exécuter `git fetch --prune`,
lire `git log origin/main -6 --oneline`, `git status`, les branches et
`gh pr list --repo memoways/ava-proto1`, puis actualiser main propre par
`git pull --ff-only`. Préserver la PR étrangère #24 et les branches historiques.
Un seul agent, une seule branche de lot depuis main actualisé, aucun checkout adjacent.

Lire AGENTS.md, CHANGELOG.md, STORY.md,
`docs/plan_changement_interlocuteur_manuel.md`, ce prompt et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Vérifier réellement Notion natif Gamilab : get-self doit retourner
`7e1a9a09-09cb-4deb-a306-83a29b831bc2`, puis lire la
[tâche existante](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f) et
[l'application](https://app.notion.com/p/97462322e595822ca21601814e915159).
Aucun navigateur ni autre workspace en repli ; Gami DigiDouble exclu.
Vérifier par MCP le projet Lovable `1265958d-b74e-40f2-917d-182fe05163fc`,
workspace Memoways `5glbtPltldwz9tgNwIi4`. Toute opération Cloud, SQL,
migration ou Edge passe par son connecteur ; aucun Supabase générique.

## État F1 à relire au démarrage

F1 introduit le coordinateur, requestId/sourceCallId et CAS, le candidat GM
avant confirmation, la réservation `prepared` puis la disponibilité après reçu
complet, les erreurs/réessais et quatre échanges complets par appel. Les replays
T15/T17/T21 ont été rouges avant correction, puis verts ; le point exact du
T15 historique n'est pas déclaré certain. Aucun nouveau modèle, migration,
Edge Function ou réglage production requis. Aucun déploiement production par F1.

Livraison GitHub, CI et preview : voir la section de clôture F1 du plan et le
CHANGELOG, à contrôler contre GitHub et Lovable réels avant toute écriture.

## Périmètre autorisé lorsque ce prompt est exécuté

Livrer seulement F2 : séparer fin d'appel (`closeCall`) et fin d'expérience.
Raccrocher mène directement à la grille libre Max/Emma, Ava/Léo indisponibles,
sans questionnaire imposé. Le prochain appel garde expérience, film, version,
contexte commun et souvenirs privés propres à chaque personnage ; seul son
compteur d'échanges repart à zéro. Utiliser un identifiant/marqueur de nouvel
appel explicite : F1 déduit encore les appels des transferts existants.

Le timer est suspendu sur la grille et reprend avec le même temps restant,
sans reset ni décompte sur la grille. Distinguer budget d'expérience et expiration
technique de reprise. Arrêter micro, sorties et callbacks de l'appel quitté ;
ne pas copier les réinitialisations du premier `handleAnswered`.

Préserver le transfert direct accord + GM + clic, l'offre persistante après
« merci »/continuation jusqu'au clic, « Rester » ou changement explicite,
les gardes admin, fraîcheur, CAS/deux onglets, double clic, reprise et mémoires
cloisonnées. Aucun développement de règles futures d'Ava/Léo, aucun F3 lancé.

## Vérifications et livraison attendues

Actualiser le plan avant code. Tester Max → raccrochage → grille → Emma →
raccrochage → Max : même expérience, souvenirs Max retrouvés et aucune confidence
croisée ; timer suspendu/repris, reload, expérience expirée, callbacks tardifs,
PTT/mains libres et échecs réseau. Repasser replays F1, tests ciblés,
`npm run test:quality` et E2E complets. Toute évolution DB doit préserver anciens
clients, autorisation par session et RLS ; vérifier son application par Lovable.

Commit/push/PR, CI verte sur le HEAD exact avant squash-merge, CI main verte E2E
compris, suppression de sa branche locale/distante, SHA synchronisé et état prêt
Lovable vérifiés. Production distincte, uniquement sur autorisation explicite.
Recette humaine distincte des tests simulés. Actualiser plan, CHANGELOG/STORY et
la tâche Notion existante : Source conservée, Last updated by=Codex, écritures relues.

Si une intervention Cloud d'Ulrich est indispensable, préparer le prompt exact
avec projet/SHA/environnement/actions/contrôles/retour arrière, le sauver dans
`docs/prompt_lovable_passages_lot_f2.md` et le donner prêt à copier. Ne pas annoncer
F2 technique complet si cette intégration reste à faire.

À la clôture du même tour, enregistrer et fournir **prêt à copier dans la réponse**
le prompt autonome F3 si F2 est complet, sinon sa reprise de finalisation : état
vérifié, sources, contrôle Notion, décisions, périmètre, tests, GitHub/Lovable et
première action exécutable. Donner les liens de plan/PR/Notion, SHA/CI/branches,
les états local/GitHub/preview/production et une seule action si nécessaire.
Reporter cette obligation dans chaque prompt suivant. Ne lancer aucun prochain
lot et ne créer aucun nouveau chat automatiquement.
