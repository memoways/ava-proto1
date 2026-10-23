# AVA — Clôture autonome du switching Emma ↔ Max, lot 4 seulement

## Résultat et limite de reprise

Le 23 octobre 2026, Ulrich a accepté la recette humaine bidirectionnelle au casque
et autorisé la publication. Le frontend a été publié **exclusivement via Lovable**
et le déploiement attendu est réellement servi. Aucun lot 5 ni nouveau chat n'est
autorisé par cette clôture. Ne relancer ni recette ni publication sans nouvelle
demande. Les contrôles GitHub finaux restent obligatoires avant de déclarer le lot
entièrement clos ; leur compte rendu après fusion est attaché à la PR ci-dessous.

## Sources et état de travail

- Checkout unique : `/Users/ulrich/CodeProjects/memoways/ava-proto1`.
- Remote unique : https://github.com/memoways/ava-proto1.
- Runtime accepté/publié : **e2bb6f61d08ccf5140d1e01699c86952930e9505**, main
  au début de la reprise après #67–70. Aucun code produit modifié dans cette reprise.
- Branche de rédaction : `codex/character-handoff-lot-4-recette-finale`, créée
  depuis ce main ; premier commit documentaire de preuves
  **f1cdeeed72d11a6ea504ccb62a175edd8430174f**. Les commits de clôture suivent.
- [PR de clôture #71](https://github.com/memoways/ava-proto1/pull/71) : documents
  seulement, CHANGELOG/STORY/plan/finalisation et ce fichier. Le compte rendu final
  de la PR donne HEAD exact, CI pré-fusion, merge réel, CI main et branches restantes.
  Cette référence distingue le runtime publié du merge documentaire ultérieur.
  Limite explicite : l'entrée CHANGELOG conserve le main vérifié avant cette PR ;
  son commit ne peut contenir son propre SHA. Le SHA après fusion et sa CI sont
  consignés dans le compte rendu GitHub de #71 et le bilan final, sans prétendre
  qu'ils sont inscrits littéralement dans le commit qui les crée.
- [Plan et preuves](plan_changement_interlocuteur_manuel.md),
  [historique de finalisation](prompt_reprise_switch_personnages_finalisation_lot_4.md),
  [CHANGELOG](../CHANGELOG.md), [STORY](../STORY.md).
- Appliquer AGENTS.md et
  `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Preuves de recette

Session **fcfa4f01-d33d-4e1b-8276-9ae4f910cab5**, **08:22:29–08:29:33
Europe/Paris**, Sandbox Ulrich/v7, diagnostic complet ; clôturée user_hangup,
Emma active, compteur **2**, enveloppe none, aucun appel de contrôle restant.

- Emma → Max T13 : accord délivré, GM v2/current_user/max/accept/speech_1,
  preuve v1 exacte, offre 777e04b6, clic, connexion à 08:26:58.
- Max → Emma T17 : nouvel accord délivré, v2/current_user/emma/accept/speech_0,
  preuve v1 exacte, offre 567adfa8, clic, connexion à 08:28:40, firstContact=false.
- Deux événements sessionPreserved/timerPreserved ; timer sans remise à zéro,
  durée 960 s, film vu, rôle/posture null et même version épinglée.
- Portraits/fiches distincts, voix Gradium correctes. Historiques/mémoires/reçus
  filtrés Emma à T13, Max à T14–17, puis **Emma seule à T19 après retour**.
- Ulrich confirme annonces sobres, pastilles, sonneries et voix correctes dans
  les deux sens ; recette acceptée et publication explicitement autorisée.

Ce succès humain de switching ne constitue pas une reproduction humaine de
chaque panne ni un audit exhaustif des confidences. Les refus, indisponibilités,
interruptions, récupérations, concurrence et reprise sont couverts séparément
par les tests contrôlés. Aucun texte ou son synthétique injecté par l'agent
pour remplacer la parole humaine.

## Vérifications techniques et publication

- Qualité locale : **784 unitaires / 41 intégrations / 48 régressions**,
  lint/typecheck/build verts ; avertissement hooks préexistant et bundle conservés.
- **67/67 E2E locaux sans retry**, un worker, Chromium/Firefox/WebKit, **10,8 min**.
- CI main initiale [39851886975](https://github.com/memoways/ava-proto1/actions/runs/39851886975)
  verte sur e2bb6f6 exact, avec 66 premiers essais et un succès au retry sur la
  reprise offre/profil suspendu. Ce test repasse au premier essai local ; cause
  exclusive de l'ancien échec non établie, aucun délai ou assertion modifié.
- Deux revues Standards/Spec indépendantes et successives ; revalidation des
  derniers documents avant fusion. CI de #71 à vérifier sur son HEAD exact,
  puis CI post-fusion main et propreté/synchronisation/nettoyage.
- Projet Lovable **1265958d-b74e-40f2-917d-182fe05163fc**, workspace Memoways
  **5glbtPltldwz9tgNwIi4**, Cloud fourni par Lovable **iralfqlslqndgvexixis**.
- Déploiement unique **d7486ec2-1847-4681-a41e-7f945a520278**, source e2bb6f6.
  Réponse initiale pending, puis **HTTP 200 et x-deployment-id portant ce même ID**
  sur [le site public](https://proto1.parle-a-ava.com/), le 23 octobre à 08:44:29
  Europe/Paris. Accueil « Où est Ava ? » / Commencer observé, aucun appel lancé.
- Bundle réellement servi **index-Xhq-EqQS.js**, SHA-256
  `422b022af220a1e6f2385c84e824930e46f09468c379101168473c89dd05c452` :
  contrat référencé, format compact et GM world-boundary présents. La preuve du
  déploiement servi remplace un statut terminal API non exposé ; aucun redéploiement
  de sondage. L'aller-retour humain est celui accepté en preview.
- V7 sandbox 8/4/2 conservée ; v6 archivée et production narrative v1 quota 1.
  Aucun réglage, migration, Edge Function, secret, capture/provider/voix changé.
  Les autres comportements de #68 ne sont pas déclarés recettés par ce lot.

## Contrôle final et capitalisation

Lire la PR #71 et son compte rendu final après fusion avant toute reprise :
HEAD exact et run CI success avant merge, SHA de main et CI post-fusion success,
checkout canonique propre et synchronisation Lovable. La branche de ce lot doit
être supprimée localement et à distance. La PR étrangère **#24** et sa branche
`agent/test-gap-invitation-validity-multi-use` restent préservées ; les branches
locales hors lot ne sont pas supprimées. Ne pas annoncer « seulement main ».

Notion reste canonique : vérifier le workspace **377e8583-7838-4c05-9f76-8833a450f304**
via le connecteur natif avant lecture/écriture ; lire About et règles de mémoire,
puis réutiliser l'entrée AVA existante **400511682fc381f29b92eb7bd69bff09**.
Capitaliser les seuls faits durables vérifiés de recette acceptée/publication,
avec portée, date, raisons et liens sources ; relire avant et après écriture,
Source conservée, Last updated by=Codex. Aucune nouvelle préférence personnelle,
transcript complet, secret, code copié ou état temporaire ; About et Conare inchangés.
Gami DigiDouble reste exclu ; aucun animal de compagnie affiché.
Lors de cette clôture, l'entrée existante a été actualisée avec la recette acceptée
et la publication effectivement servie, puis relue ; Source et Last updated by=Codex
vérifiés, About et Conare inchangés.

Une éventuelle demande ultérieure repart du main réel après fetch, préserve les
travaux étrangers et réutilise l'identité GitHub existante. Un refus de sandbox
ou trousseau n'autorise ni reconnexion ni remplacement d'identité. Toute future
correction exige reproduction et contrôles proportionnés, plan dans docs,
tests pertinents/qualité/E2E, revues et CI du HEAD exact avant fusion. Toute
future publication reste exclusivement Lovable et distincte d'une fusion GitHub.

**Aucune action utilisateur restante pour la recette ou la publication de ce lot.**
Terminer uniquement les contrôles de livraison documentaire si #71 ne les porte
pas encore ; sinon conserver cette clôture et arrêter après le seul lot 4.
