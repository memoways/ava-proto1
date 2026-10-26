# Reprise Codex → assistant suivant — fiabilité des passages, F1

Date : 26 octobre 2026. **Prompt F1 exécuté : code livré par PR #88, main `5bf1bd51617adc5ae06c656767ea02b29aca3371` ; CI PR et main vertes, E2E compris ; Lovable synchronisé et prêt.**

Ne pas relancer F1 comme un nouveau lot. Voir le [bilan canonique](plan_changement_interlocuteur_manuel.md#livraison-f1-vérifiée--26-octobre-2026) et la [reprise F2 préparée](prompt_reprise_fiabilite_passage_personnages_lot_f2.md) pour le prochain lot, non lancé. Le corps ci-dessous conserve le contrat exécuté.
Ce prompt, lorsqu'il est donné à l'assistant pour exécution, autorise la
réalisation et la livraison complète du seul lot F1 : correctif, tests,
commit/push, PR, squash-merge après contrôles, nettoyage et synchronisation
Lovable. Il ne lance pas F2 et n'autorise pas la publication de production.
Le plan canonique doit être relu et actualisé à chaque lot ; aucun chantier
ne doit dépendre de la mémoire du chat précédent.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, exécuter
`git fetch --prune`, lire `git log origin/main -6 --oneline`, CHANGELOG et
`gh pr list --repo memoways/ava-proto1`, puis actualiser main avec
`git pull --ff-only` si le checkout est propre. Vérifier l'absence d'agent actif
avant toute écriture. Préserver la PR étrangère #24 et ses fichiers.

## Objectif du seul lot F1

Mettre en œuvre le contrat de passage validé avec Ulrich et verrouiller sa
fiabilité par des replays intégrés des incidents T15/T17/T21 du 26 octobre.
Un accord doit aboutir à un bouton réellement utilisable ou à une erreur
visible et récupérable ; jamais une promesse sans effet. Ne pas lancer F2,
activer Ava/Léo, publier en production ou créer un nouveau chat par ce prompt.
La préparation de ce document ne vaut pas démarrage de F1.

## Contexte obligatoire

- AGENTS.md et `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
- [Plan canonique, audit du 26 octobre](plan_changement_interlocuteur_manuel.md#audit-de-production-et-nouveau-contrat--26-octobre-2026).
- [Tâche Notion existante](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f),
  [application](https://app.notion.com/p/97462322e595822ca21601814e915159).
- À chaque lot, vérifier réellement la connexion Notion native Gamilab :
  get-self doit confirmer `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, puis lire la
  tâche et l'application ci-dessus. Une connexion configurée ne suffit pas.
  Si l'accès échoue, diagnostiquer la connexion existante conformément à AGENTS,
  signaler le blocage précis sans contourner par navigateur ni autre workspace.
  Ne pas prétendre la capitalisation faite. Gami DigiDouble exclu.
- Données uniquement par MCP Lovable, projet
  `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
  `5glbtPltldwz9tgNwIi4`. Aucun connecteur Supabase générique.
- Lovable/Lovable Cloud : seule chaîne de compilation, migrations, Edge,
  preview et publication. Ne pas créer un hébergeur, clone ou worktree adjacent.

## État vérifié à la préparation

Au contrôle de préparation du prompt : main local/distant
`885e38987ad299be120fcb8746e47fb652a69ae2`, checkout propre ; plan et décisions
livrés par #85/#86, branches correspondantes supprimées. Lovable natif au même
SHA, ready, agentFinished=true. Notion Gamilab get-self et lecture de tâche
fonctionnels. Dernière CI complète du code vérifiée verte :
[40351585507](https://github.com/memoways/ava-proto1/actions/runs/40351585507),
code `d38e7f5fd6d6487f5c767ea4fdbf2565397aea91`. #85/#86 sont documentaires.

Lire le main réel au démarrage : cette préparation documentaire peut l'avoir
avancé. Ne pas restaurer une ancienne révision. Les évolutions étrangères de
sandbox Julien et de fournisseur TTS sont préservées ; les tests de l'audit
ci-dessous précèdent ces évolutions. Aucun correctif de passage ou publication
production effectué par les lots documentaires. Le bundle public observé lors
de l'audit ne doit pas être assimilé au SHA de preview.

Incident : session prod `2dc01921-c517-4e4e-b88f-6c5bb1b5bb8d`,
26/10/2026 15:04 Europe/Paris, Max, 27 messages joueur incluant fragments,
zéro transfert, fin user_hangup. Version prod épinglée v8
`74450a74-d1dc-47e6-9f06-4a177a7c5f6a`, seuil 4, quota 8, pause 2.

- T15 : « Oui. Je te la passe. Emma est dans la cuisine. », audio complet,
  preuve et recommandation GM valides ; replay du validateur autorisé.
  Aucun événement d'offre/validation T15. Capture suivante pendant l'attente
  GM (~3,55 s). Course fortement étayée ; instruction JavaScript exacte non
  démontrée. Ne pas dire « cause historique certaine » sans replay intégré.
- T17 : « Oui. Je te la passe maintenant. », audio complet, recommandation
  Emma mais preuve rejetée request_unresolved : pronoms sans demande conservée.
- T21 : « D'accord. Je te passe Emma. », audio complet, décision neutralisée
  relationship_invalid ; aucune preuve de sous-décision valide préservée.
- 176 tests passage/GM/état/directeur/reprise verts ; deux E2E de GM tardif
  verts (24,6 s). Ces tests protègent encore l'ancien contrat d'annulation au
  prochain message et ne prouvent pas la stabilité attendue.
- Harness de diagnostic temporaire supprimé ; aucun transcript complet sauvegardé.

## Décisions humaines à respecter

- Max et Emma suivent exactement la même mécanique ; contrat extensible au
  registre, sans prétendre que le runtime binaire supporte déjà Ava/Léo.
- Quatre **échanges complets de l'appel courant**, réglage piloté au back-office ;
  fragments STT, accueil et réponses non complètement délivrées ne comptent pas.
- Transfert direct après accord du personnage, validation GM et clic joueur.
- En cas de refus, raccrochage puis choix libre dans la grille ; même expérience,
  souvenirs séparés. Ce cycle d'appels complet appartient à F2.
- Décision complémentaire confirmée le 26 octobre : le bouton validé reste
  disponible après « merci » ou une continuation, jusqu'au clic, à « Rester »
  ou à un changement explicite de demande. Un nouveau message n'est pas une
  révocation implicite. Conserver les invalidations techniques nécessaires.
- Timer confirmé : suspendu pendant la grille, repris au prochain appel avec
  le même temps restant ; ni reset ni décompte du temps passé sur la grille.
  Distinguer temps d'expérience et expiration technique de reprise (F2).
- Ces deux choix sont tranchés : ne pas les redemander à Ulrich.

## Travail F1

1. Actualiser le plan avant code, appliquer Confidence Check et les instructions
   de diagnostic. Constituer une boucle rouge à la vraie frontière UI/GM/état :
   T15 reçu complet, GM validé, capture suivante et profils retardés. Faire varier
   un seul retard à la fois, distinguer callbacks annulés et résultats ignorés.
2. Rejouer T17 avec cible rattachée à une demande typée et T21 avec relation
   invalide mais contrat de transfert séparément validable. Ne pas réparer
   arbitrairement un ancien accord, lever une sécurité ou changer de modèle.
3. Extraire un coordinateur de passage, requestId/révision/version/appel source ;
   séparer durée de vie métier et tour vocal. Retirer la dépendance aux vidéos,
   borner les lectures nécessaires et produire un motif terminal pour chaque
   demande. Conserver neutralisation des JSON globalement inutilisables.
4. Prototyper puis mettre en œuvre le séquencement promesse/offre. Une phrase
   définitive de transfert ne doit plus précéder toute capacité réelle d'appel.
   Garder le même appel GM, pas de LLM supplémentaire en série pour les tours
   ordinaires. Mesurer l'attente propre aux transferts ; échec visible/réessayable.
5. Réutiliser les gardes admin, reçus, CAS et revalidation clic/décroché. Atomicité,
   double clic, états post-commit et mémoires privées demeurent des invariants.
6. Compteur d'échanges complets par appel et aide admin cohérente. Toute évolution
   DB reste compatible avec les clients déjà publiés et nécessite migrations,
   autorisation par session et RLS dans Lovable Cloud ; aucune écriture prod de
   réglages ou modification des fiches Notion implicite.

Principaux fichiers : `src/pages/IndexPRD4.tsx`,
`src/services/characterHandoff.ts`, `characterHandoffState.ts`, `sessionHandoff.ts`,
`experienceDirector.ts`, `experienceOrchestration.ts`,
`src/agents/gameMasterPRD4.ts`, `src/services/prd4Orchestrator.ts`,
`src/components/prd4/ConversationScreen.tsx`, aides back-office et tests associés.
Lire le registre et les types avant toute généralisation.

## Vérifications et livraison

- Rouge avant correctif puis vert sur le scénario initial ; cas Max→Emma et
  Emma→Max, refus/rétraction/ambiguïté, délais GM et profils, stockage en échec,
  reprise, deux onglets, double clic, sortie audio interrompue. Registre fictif
  à trois personnages pour l'indépendance du contrat ; Ava réel toujours fermé.
- Tests ciblés puis `npm run test:quality` et E2E complets adaptés au dépôt.
  Ne pas simplement réécrire les anciennes assertions sans tester le risque
  qu'elles empêchaient : transferts périmés et confidences croisées.
- Branche unique depuis main actuel, PR, CI verte sur HEAD exact avant fusion,
  main vert E2E compris, synchronisation Lovable relue, suppression distante et
  locale de **sa seule branche**. Ne pas toucher aux branches étrangères.
- Identité GitHub existante : App de livraison si configurée et valide,
  sinon `git`/`gh` déjà authentifiés ; aucun login/refresh/logout improvisé.
- Mettre à jour CHANGELOG/STORY, plan et tâche Notion existante (Source conservée,
  Last updated by=Codex, relecture des écritures). Aucun transcript complet,
  secret ou mémoire personnelle parallèle.
- Livrer le prompt autonome F2 dans ce même tour, état vérifié, sources,
  périmètre/invariants, validations et première action exécutable ; inclure
  cette même obligation dans le prompt. Ne pas lancer F2 automatiquement.
- Rapporter séparément local/GitHub/preview/production et recette humaine.
  Publication production distincte après validation humaine, jamais déduite de CI.

## Intégration Lovable et clôture de chaque lot — obligation de reprise

1. Aller jusqu'à commit, push, PR, CI verte sur son HEAD exact, squash-merge
   dans main et CI main verte E2E compris, selon AGENTS. Supprimer uniquement
   sa branche locale/distante et vérifier le checkout. Une CI queued,
   in_progress ou rouge n'autorise pas la fusion d'un lot de code. Les lots
   exclusivement documentaires gardent leur exception explicite.
2. Vérifier par MCP Lovable le projet, le SHA synchronisé et son état prêt.
   Distinguer synchronisation des sources, compilation/preview, migrations,
   Edge Functions et publication de production. Une fusion GitHub ne prouve
   pas qu'une migration ou une fonction Cloud est appliquée. Ne pas modifier
   les fournisseurs voix ou l'éditorial pour contourner un échec de passage.
3. Si le lot exige une opération Lovable/Cloud, la réaliser avec les outils
   natifs dans le périmètre autorisé puis vérifier le résultat. Si Ulrich doit
   intervenir, enregistrer un prompt exact, spécifique au diff livré, dans
   `docs/prompt_lovable_passages_lot_f1.md` : projet, SHA, fichiers/migrations/
   fonctions concernés, environnement, action attendue, vérifications et retour
   arrière. Le fournir aussi prêt à copier dans la réponse finale, avec une
   seule action précise. Ne pas créer un prompt générique demandant à Lovable
   de refaire le code. Si aucune opération n'est requise, le dire explicitement.
   Une intégration indispensable non faite laisse le lot technique incomplet.
4. Actualiser plan, CHANGELOG/STORY et tâche Notion existante avec faits, raisons,
   sources, dates et tests ; conserver Source, actualiser Last updated by et
   relire chaque écriture. Notion inaccessible : nommer ce qui n'est pas sauvé,
   garder la reprise dans le dépôt et signaler cette limite sans inventer de succès.
5. **À la fin de chaque lot, préparer le rebond dans le même tour.** Si F1 est
   complet, enregistrer `docs/prompt_reprise_fiabilite_passage_personnages_lot_f2.md`.
   S'il est partiel, fournir plutôt sa reprise de finalisation, sans lancer F2.
   Inclure état Git réel, fait/restant, décisions, sources Notion et contrôle de
   connexion, cible Lovable, invariants, tests, livraison attendue et première
   action exécutable. Reporter cette même obligation dans chaque prompt suivant.
   À la fin du chantier, produire une clôture autonome et dire explicitement
   qu'aucun lot ne suit, plutôt qu'inventer du travail.
6. La réponse finale contient résultat et limites, liens vers plan/PR/Notion,
   SHA main et CI vérifiés, branches restantes, états local/GitHub/preview/
   production, éventuelle action Lovable, **puis le prochain prompt prêt à
   copier et le lien vers son fichier**. Ne pas se contenter de dire « prompt
   disponible » ni proposer de le préparer plus tard. Ne pas ouvrir de nouveau
   chat ou lancer le lot suivant automatiquement.
