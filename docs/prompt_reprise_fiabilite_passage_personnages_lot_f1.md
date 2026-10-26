# Reprise Codex → assistant suivant — fiabilité des passages, F1

Date : 26 octobre 2026. **Prompt préparé, lot F1 non lancé.**

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
L'exécution de ce prompt est une demande future distincte du présent audit.

## Contexte obligatoire

- AGENTS.md et `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
- [Plan canonique, audit du 26 octobre](plan_changement_interlocuteur_manuel.md#audit-de-production-et-nouveau-contrat--26-octobre-2026).
- [Tâche Notion existante](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f),
  [application](https://app.notion.com/p/97462322e595822ca21601814e915159).
- Notion natif Gamilab uniquement : get-self doit confirmer
  `7e1a9a09-09cb-4deb-a306-83a29b831bc2`. Ne pas utiliser Ulrich, le navigateur
  ou un autre workspace pour les sources Ava ; Gami DigiDouble exclu.
- Données uniquement par MCP Lovable, projet
  `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
  `5glbtPltldwz9tgNwIi4`. Aucun connecteur Supabase générique.
- Lovable/Lovable Cloud : seule chaîne de compilation, migrations, Edge,
  preview et publication. Ne pas créer un hébergeur, clone ou worktree adjacent.

## État vérifié à la préparation

Base audit : main `7e36e94476dc541c9f3f371b9a92d6b09ad8abd4`, propre,
Lovable au même SHA et ready. La PR documentaire qui contient ce prompt peut
avoir avancé main : lire son état GitHub réel, ne pas restaurer cette base.
Branche documentaire de préparation : `codex/audit-handoff-fiabilite-20261026`.
Sa fusion et son nettoyage se vérifient dans CHANGELOG et le compte rendu de PR.
Aucun code, workflow, donnée Cloud, prompt de personnage ou production modifié
par l'audit. Source publique HTTP observée : bundle index-BhfS0uYD.js ; ne pas
en déduire le SHA de publication. Dernière CI complète du code :
[40298606848](https://github.com/memoways/ava-proto1/actions/runs/40298606848),
code `26cfc2caf5812e1907d3a2d4db1730ed8f8948ec`.

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
- Deux questions complémentaires figurent dans le plan : durée de vie du bouton
  après continuation et timer sur la grille. Lire les réponses enregistrées dans
  le plan ; si elles restent ouvertes, clarifier avant de coder leurs effets.

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
