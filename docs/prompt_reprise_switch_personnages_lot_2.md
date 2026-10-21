# AVA — Reprise autonome du switching, lot 2 seulement

Travaille uniquement dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`,
remote `https://github.com/memoways/ava-proto1`, en français. Pas d'autre clone
ni worktree. Lovable / Lovable Cloud reste l'unique chaîne de compilation et
de publication ; ne pas utiliser un Supabase ou un hébergeur externe.

## Commencer par l'état réel et le contexte

1. Lire `AGENTS.md` et les instructions applicables, vérifier le workspace Notion
   canonique par le connecteur natif avant les lectures ciblées. Lire About,
   les règles de mémoire approuvées, la mémoire AVA et ses sources pertinentes.
   Aucun accès à Gami DigiDouble. Aucun animal affiché.
2. Lire intégralement `docs/plan_changement_interlocuteur_manuel.md`, proposition
   du 19 octobre avant les archives et compte rendu du lot 1 du 21 octobre,
   `docs/prompt_reprise_switch_personnages_lot_1.md`, CHANGELOG et STORY récents.
3. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`
   et le plan de latence `docs/plan_optimisation_latence_voice_to_voice.md` §3.
4. Vérifier statut, branche, remote, HEAD local/distant, CI, PR et projet Lovable.
   Préserver toute modification étrangère et utiliser une branche dans le checkout
   canonique. Réutiliser l'identité GitHub configurée, sans login/refresh/logout.

## Références de départ vérifiées le 21 octobre 2026

- Base du lot 1 : `b113e351fad3260316942211cd806e4778a331eb` (PR #50), propre,
  CI main `39249573270` verte, même SHA dans Lovable à l'ouverture.
- Implémentation du socle : commit `ef333fa`, branche
  `codex/character-handoff-contract-lot-1`.
- Lot 1 livré par la [PR #54](https://github.com/memoways/ava-proto1/pull/54),
  fusionnée le 21 octobre à 11:21 Europe/Zurich dans
  `3d53298962f97cc3924b13b4bff60024f9965e35`. Snapshot après fusion : `main`
  local identique à `origin/main`, checkout propre, aucune modification étrangère.
- [CI pré-fusion 39574552872](https://github.com/memoways/ava-proto1/actions/runs/39574552872)
  verte sur le HEAD exact `2a48a9754fe1118076647f09fb9d6b21e43d8bba` :
  48 régressions, 707 unitaires, 34 intégrations, lint/typecheck/build, 45 E2E
  sans retry. Revue des consommateurs effectuée. E2E local final : 45/45
  sans retry avec un worker, après un échec WebKit initial puis vert en isolation.
- Départ du prochain chat : **le main réel après fetch**, sans restaurer une
  ancienne révision. `3d53298` est la référence technique livrée du lot 1 ; la
  clôture documentaire peut ajouter des commits sans changer ce socle. Lire
  la CI post-fusion et les éventuelles PR documentaires dans GitHub avant de
  modifier. Si une régression du lot 1 subsiste, finaliser d'abord ce lot.
- Lovable : projet `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
  `5glbtPltldwz9tgNwIi4`, Supabase fourni par Lovable `iralfqlslqndgvexixis`.
  Contrôle natif après fusion : `latest_commit_sha=3d53298962f97cc3924b13b4bff60024f9965e35`,
  `project.status=ready`, `agentFinished=true`. Code synchronisé ; aucune recette
  humaine de switching ni publication produit dans ce lot. Aucun changement Cloud.

## Ce qui existe après le lot 1

- `src/types/characterHandoff.ts` : contrat versionné, personnages source/cible,
  origine `player_request|gm_proposal`, tour/version, accord `accept|object|defer`,
  preuves exactes de demande/proposition, résolution de cible, accord et refus.
- `src/services/characterHandoff.ts` : nettoyeur additif et validateur pur avec
  raisons d'audit. Le reçu `ResponseDeliveryReceipt` doit correspondre au tour
  et au personnage, et contenir l'accord dans `delivered`. Une portion générée,
  privée ou incertaine ne prouve rien. Le texte complet conserve la priorité
  aux refus contradictoires. Une demande antérieure exige un `openRequest`
  encore valable explicitement fourni par l'appelant, de la même session.
- `PRD4PostTurnEvaluation.handoff_assessment` est optionnel et nettoyé dans le GM.
  L'ancien JSON reste valide et les champs historiques inchangés. Un champ absent,
  invalide ou un GM échoué n'autorise rien par le nouveau validateur.
- `CHARACTER_HANDOFF_ASSESSMENT_INSTRUCTIONS` est exporté dans
  `gameMasterPromptBuilder.ts` mais **jamais ajouté au prompt actif**.
  `GM_CODE_VERSION=gm-2026-10-21-handoff-contract` trace le nettoyeur.
- Fixtures minimales T6/T9/T10/T11 et tests dans `characterHandoff.test.ts` et
  `gameMasterPRD4.handoff.test.ts`. Les deux `it.fails` historiques caractérisent
  les faux négatifs de l'ancien moteur, qui reste inchangé ; les tests positifs
  vérifient le nouveau moteur séparément.
- Le switching réel n'est pas encore corrigé. Aucun nouveau consommateur,
  état d'offre persistant, événement, bouton ou comportement audio n'a été activé.

## Objectif limité au lot 2

Brancher le contrat sur l'offre réelle, sa persistance, sa révocation, sa reprise
et la transition audio existante, avec audit des décisions. **Ne pas réaliser
la nouvelle pastille du lot 3 ni la campagne humaine/publication du lot 4.**
Conserver l'interface existante autant que nécessaire pour tester ce lot.

Avant modification, mettre à jour le plan existant dans `docs/` avec le périmètre
exact et les dépendances constatées. Procéder baseline → test rouge → correction
minimale → vérification. Ne pas recommencer l'enquête Cloud sur la session
historique si le plan suffit.

1. Fournir au même appel GM le tour/ID/version exacts, le contexte de demande
   encore ouverte et les paroles réellement délivrées. Intégrer les instructions
   préparées seulement avec les adaptations et tests nécessaires. Aucun nouvel
   appel LLM ; conserver les budgets et la latence, éviter un JSON tronqué.
   Ne pas publier une configuration/prompt Cloud sans vérifier la cible Lovable
   et le périmètre autorisé. Documenter toute dépendance qui doit attendre le lot 4.
2. Retirer la dépendance bloquante aux anciennes regex dans l'autorisation d'offre.
   Le GM résout la sémantique, le validateur vérifie la preuve et la cohérence,
   le directeur garde seuil/pause/quota/disponibilité/version. Aucune demande seule,
   ancien résultat ou simple recommandation n'autorise l'offre.
3. État explicite et borné : demande ouverte, offre disponible, validation, appel,
   changement, fin ; sorties refus/révocation/échec selon le plan. Une offre
   appartient à une session, source, cible, tour et version. Vérifier les choix
   de durée de validité et quota au §8 ; ne pas modifier silencieusement la v6
   (seuil 4, quota 1, pause 2). Aucun alias global Matt → Max.
4. Résultats tardifs invalidés au changement de tour/personnage/session ; offre
   révoquée à la nouvelle soumission selon le contrat validé. Reprise : les
   anciennes offres dépourvues de preuves ne doivent pas réapparaître comme autorisées.
   PATCH conditionnel/idempotence, double clic et deux onglets à traiter.
5. Au clic, puis au décroché : revalider, fermer capture/sortie avec les primitives
   existantes, réutiliser les sonneries ; empêcher tout callback de l'ancien
   personnage. Conserver session, timer, rôle, film et posture. Persister avant
   le changement visible. Distinguer panne avant commit (source conservée) et
   panne audio après commit (cible connectée, micro fermé, reprise explicite).
6. Mémoires Max/Emma séparées, aucun transcript ou résumé privé partagé.
   `experienceFrame.ts` reste l'unique constructeur du cadre commun. Les décisions
   mains libres restent dans `handsFreeVoice.ts` ; préserver candidats réversibles
   et stratégie de retour arrière. Ne modifier ni provider ni paramètres de voix.
7. Retourner et persister l'audit via les événements existants, y compris les
   refus avant directeur : GM recommande / validateur autorise / offre disponible
   / clic / personnage connecté doivent rester distinguables. Ne jamais traiter
   `execution_status=executed` du GM comme preuve d'une bascule.

## Fichiers à examiner

`src/pages/IndexPRD4.tsx`, `src/services/characterHandoff.ts`,
`characterConversation.ts`, `experienceDirector.ts`, `sessionService.ts`,
`sessionHandoffResume.test.ts`, `sessionConversationMemory.ts`,
`src/services/responseDelivery.ts`, `src/agents/gameMasterPRD4.ts`,
`src/services/gameMasterPromptBuilder.ts`, `src/types/index.ts`,
`src/types/characterHandoff.ts`, tests unitaires/intégration et
`tests/e2e/prd4-happy-path.spec.ts`. Ajuster aux sources réelles.

## Critères de sortie et contrôles

- T6 différé, T9 ambigu ; T10/T11 acceptés seulement avec preuves et cibles
  contextualisées. Refus avec/sans ne, « plus tard », accord contradictoire,
  oui hors contexte, cible/source incorrectes, résultat ancien/échoué,
  accord généré mais non entendu : aucun appel possible.
- Offres courantes uniquement ; aucun double transfert ni parole de l'ancien
  personnage. Tests de reprise, révocation contre GM tardif, PATCH refusé puis
  repris, incident audio après commit, raccrochage pendant sonnerie et isolation.
- Tests ciblés existants et nouveaux puis `npm run test:quality` et
  `npm run test:e2e`. Le lot 1 a vérifié 48 régressions, 707 unitaires et
  34 intégrations, typecheck, lint et build. Un avertissement hooks préexistant
  `finishInputTelemetry` demeure. Le teaser WebKit a échoué une fois, puis passé
  en isolation et dans les 45 E2E locaux relancés avec un worker. Les 45 E2E CI
  passent sans retry. Ne pas masquer une régression ni affaiblir les assertions.
- Revue du diff, consommateurs et parseurs/persistance inclus ; corriger les constats.
- Livrer par branche/PR ; **fusion uniquement après CI verte sur le HEAD exact**.
  Vérifier main, propreté du checkout et synchronisation Lovable. Aucun déploiement
  autonome. Une CI verte ne prouve pas une conversation humaine réussie.

## Clôture obligatoire, à reporter dans chaque prompt suivant

1. Actualiser `CHANGELOG.md`, `STORY.md` et le plan avec les faits vérifiés,
   tests, limites et états distincts préparé/branché/testé/synchronisé/publié.
2. Livrer uniquement le lot autorisé par branche et PR ; CI du HEAD exact verte
   avant fusion, puis vérifier main et Lovable. Préserver les travaux étrangers.
3. Actualiser dans Notion les seuls faits/décisions durables de projet, relire
   avant édition, préserver Source, mettre Last updated by à Codex et vérifier.
4. Sauvegarder le prompt autonome du prochain chat dans
   `docs/prompt_reprise_switch_personnages_lot_3.md` si ce lot est entièrement
   fini ; sinon préparer **d'abord sa finalisation**, jamais le lot suivant.
   Inclure objectif limité, contexte, branche/commit réels, modifications locales,
   PR/CI, Lovable, fait/restant, fichiers et critères de sortie. Rafraîchir les
   références après fusion et reporter ces mêmes obligations de clôture.
5. Donner résultat, liens, contrôles et états local/GitHub/preview/production,
   puis le prompt du prochain chat prêt à copier avec lien vers son fichier.
   Ne lancer ni lot suivant ni nouveau chat automatiquement. S'arrêter après le lot 2.
