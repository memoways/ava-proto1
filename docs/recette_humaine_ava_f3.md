## Lecture actuelle — 27 octobre 2026

Ce document conserve un protocole F3 complet et son historique ; il ne doit pas
être réinitialisé ni imposé intégralement pour chaque correction. Le
[point de décision](plan_changement_interlocuteur_manuel.md) distingue la démo
courte proposée de la qualification complète. Objectif prioritaire encore à
convenir avec Ulrich ; aucun nouveau parcours lancé par ce document.

La continuité d’entrée de la session 373833d0 (12:03:29 Paris) est déjà acceptée
sur le réglage final. Conserver cette preuve. Barge-in=false est intentionnel :
aucune interruption volontaire de Max n’est requise pour qualifier cette version.
Les anciennes consignes demandant de relivrer #93/#94, affirmant qu’aucun réglage
Cloud n’a été modifié, ou décrivant text/900 ms sont historiques ; l’état courant
est dans le bilan et la section suivante. Ne pas réactiver la sortie incrémentale.

## Urgence continuité vocale — 27 octobre, retour Cineforom

Dernier résultat humain : **continuité d’entrée acceptée** (« oui maintenant il
n’y a plus de coupures, donc implémenter ça ! »). Session
373833d0-4ed0-4613-9a6c-b33c3c9460b6, 12:03:29 Paris, Max. Flags relus :
acoustic_confirmed, bargeIn=false, endOfSpeechMs=2 000, hesitationExtraMs=700,
incremental=false. Le réglage Cloud est déjà durablement enregistré. L’essai
précédent 749a65e6 à 11:52 était text/900 ms et coupait une parole continue.
Cette correction est une remise en état des réglages existants, pas un nouveau
contrôleur. Acceptation limitée à ce critère : la matrice entière et la
publication ne sont pas implicitement acceptées.


Correctif disponible : PR #98 fusionnée dans main `0170ac5`, CI PR verte sur HEAD
exact `941bd50`, 109 E2E sans retry ; Lovable ready au même SHA et cinq sources
relues identiques. Nouvelle écoute demandée après rechargement/Commencer ;
résultat positif sur la continuité d’entrée ci-dessus. CI main 40491618695 verte, 109 E2E sans retry.

Recette refusée sur la preview Sandbox Ulrich : échange de 10:33,
session 4e018bd3-71d8-4967-b4fb-2d5d72c1da48, phrases hachées/voix variables
chez Max puis Emma. Statuts interrompus confirmés ; grille utilisée, pas un
transfert GM malgré le libellé de l’admin. Session suivante 4b0112b8-5904-4d8f-89fe-7f821818b4c0
à 10:41 conserve encore les flags expérimentaux épinglés. Dernier retour humain :
voix plutôt stables, mais la mention d’un tiers déclenche message et changement
de ton. Ce n’est pas une acceptation du rétablissement.

Restauration Cloud sandbox effectuée et relue : voix de référence Gradium pour
Max et Emma, sortie progressive et interruptions automatiques désactivées,
streaming Gradium désactivé dans les réglages Cloud ; mains libres reste actif.
La capture cliente montre encore un transport websocket : ne pas présenter le
transport réellement utilisé comme prouvé par le seul réglage Cloud. Production inchangée.
Le plan contient les valeurs précédentes et les preuves. Changement de code
complémentaire : préserver la réponse normale, ne préparer qu’une vraie annonce
de transfert, supprimer messages techniques/pastilles en conservant actions texte,
GM/consentement/reçu/clic et grille. Ulrich exige de conserver les passages.

Priorité après livraison et synchronisation : recharger, Commencer une nouvelle
expérience, écouter la continuité et les mentions d’Ava/Emma avec Max puis Emma.
Relire l’ID et les flags épinglés avant d’interpréter le retour. La recette PTT
puis mains libres et l’acceptation restent ouvertes ; aucune publication autorisée.
Les paragraphes historiques ci-dessous décrivent les anciens réglages au moment
des essais et ne doivent pas réactiver la sortie progressive pour la présentation.

# Recette humaine Ava F3 — PTT et mains libres

État : première écoute réelle rapportée le 27 octobre, recette complète et
acceptation humaines en attente. Les résultats F1/F2 simulés ne remplissent aucune case.
Référence : [plan canonique](plan_changement_interlocuteur_manuel.md).

## Cible et preuves de départ

- Checkout canonique `/Users/ulrich/CodeProjects/memoways/ava-proto1` ; main de
  départ `b642e406c660418a30a90b064073761078c9c4e2`, code F2 `d59d510` (#90).
- [Preview de recette](https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich&diagnostic=full).
  Utiliser une nouvelle expérience et vérifier le badge sandbox-ulrich.
  Si l’accès direct est refusé, ouvrir la preview authentifiée Lovable du projet,
  puis admin → Sandbox Ulrich → Tester moi-même. Ne pas utiliser la production
  pour valider le frontend F2 non publié.
- Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
  `5glbtPltldwz9tgNwIi4`, ready, même SHA à l’ouverture F3.
- Version sandbox publiée v7 `98145fe3-96f1-4525-84c2-0e0a1cc5c6da` :
  Max/Emma actifs, seuil 4 échanges complets par appel, pause 2, quota 8.
  Ava/Léo indisponibles. Réglages relus sans mutation via le seul MCP Lovable.
- Notion Gamilab confirmé `7e1a9a09-09cb-4deb-a306-83a29b831bc2` ;
  [tâche existante](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f)
  et [application](https://app.notion.com/p/97462322e595822ca21601814e915159).

## Conduite de la recette

Le correctif F3 est fusionné par [PR #93](https://github.com/memoways/ava-proto1/pull/93)
en `e38b189d080457ba2090882ea3cb43e453183a31` ; CI PR verte (101 E2E sans retry),
CI main verte (101 E2E sans retry), Lovable synchronisé/prêt et source relue identique.
Un complément vocal est maintenant requis après l'échec humain PTT ci-dessous ;
vérifier sa livraison avant de refaire une recette sur la preview.
La sandbox était mains libres selon lecture native Lovable. Pour le
PTT dédié : admin preview → vérifier Sandbox Ulrich → Expérience → Orchestration →
désactiver « Conversation mains libres » → Enregistrer. Démarrer ensuite une
nouvelle expérience : la reprise d'un ancien appel restaure sa modalité épinglée.
Ulrich confirme ce choix effectué (« fait »), et la relecture native confirme
enabled=false, sortie progressive/interface voix seule toujours activées. Une
nouvelle expérience PTT avec Max a été faite : Ulrich a formulé une demande
directe d'Emma, pas la question sur un échange passé. Codex n'a modifié aucun réglage Cloud.
Conserver tous les autres réglages. Réactiver les mains libres
avant l'expérience dédiée suivante.

Commencer par une expérience PTT avec Max, puis refaire la matrice dans une
nouvelle expérience mains libres. Chaque expérience garde son ID, son choix de
film et sa version entre tous ses appels. Noter pour chaque modalité : heure,
ID session, version, navigateur/appareil, mode de sortie et observations utiles.
Ne conserver ni transcript complet ni secrets dans le dépôt ou Notion.

Ulrich juge ce qu’il entend ; Codex vérifie ensuite les métadonnées et les
événements de ces sessions via Lovable. Un reçu de livraison TTS ne prouve pas
l’écoute ni la qualité audible. Une réponse « prêt » valide seulement le début.

La matrice complète ci-dessous reste à faire. Le retour partiel détaillé plus bas
ne remplit pas automatiquement chaque critère ni les deux modalités.

| Contrôle | Geste et résultat attendu | PTT | Mains libres |
|---|---|---|---|
| Accueil Max | Écouter jusqu’au bout ; mots, silences, timbre et portrait cohérents. Micro utilisable ensuite. | À faire | À faire |
| Seuil de l’appel | Demander Emma tôt, puis poursuivre ; accueil, fragments et réponses interrompues ne doivent pas valoir quatre échanges complets. Aucun transfert automatique. | À faire | À faire |
| Fragments | Faire des pauses ou des phrases courtes ; comparer tours complets délivrés et fragments STT dans les traces, sans assimiler toute phrase courte à un fragment. | À faire | À faire |
| Consentement Max → Emma | Après quatre échanges complets minimum, demander Emma naturellement ; attendre accord parlé complet et validation GM, puis voir « Appeler Emma ». Aucun clic forcé ni accord inventé. | À faire | À faire |
| Pronoms | Nommer Emma puis poursuivre avec « elle » ou « lui parler » ; la cible conservée doit rester Emma si la demande est sans ambiguïté. | À faire | À faire |
| Merci et continuation | Quand l’offre apparaît, dire merci, puis continuer brièvement ; offre toujours disponible jusqu’au clic, à Rester ou au changement explicite. | À faire | À faire |
| Rester / autre demande | Choisir Rester ou révoquer explicitement la demande ; ancienne offre retirée. Obtenir ensuite un nouvel accord pour poursuivre. | À faire | À faire |
| Clic et sonneries | Cliquer une fois, puis tenter rapidement un second clic ; un seul appel, source silencieuse, sonneries et portrait cible corrects. | À faire | À faire |
| Accueil Emma | Écouter réellement l’accueil et la voix d’Emma ; même session/film/version/contexte, nouvel ID d’appel et compteur remis à zéro. | À faire | À faire |
| Mémoire isolée | Confier un détail fictif à Max, un autre à Emma ; chacun retrouve son détail lors du retour sans connaître la confidence de l’autre. Ne pas répéter le secret de l’autre dans la question. | À faire | À faire |
| Emma → Max | Après le seuil propre à l’appel Emma et la pause requise, nouvel accord + GM + bouton + clic ; écouter Max de retour. Même expérience, nouvel appel. | À faire | À faire |
| Refus et repli | Demande précoce ou refus naturel : pas de faux succès ni transfert. Si aucun refus narratif ne survient, le noter non observé. Raccrocher permet quand même de choisir Emma dans la grille. | À faire | À faire |
| Cycle grille | Depuis Max : raccrocher → grille → Emma → raccrocher → grille → Max. Aucun questionnaire imposé ; Max/Emma libres, Ava/Léo indisponibles. | À faire | À faire |
| Budget sur grille | Relever le restant au raccrochage, attendre sur la grille puis rappeler ; temps suspendu, sonneries du rappel sans consommation de budget. | À faire | À faire |
| Recharge grille | Relever temps et identité, recharger la grille, rappeler ; même expérience/film/version, temps restant conservé et accueil de retour correct. | À faire | À faire |
| Recharge en appel | Recharger pendant un appel ; temps actif écoulé correctement retiré, reprise explicite cohérente, aucun ancien audio concurrent. | À faire | À faire |
| Annulation sonnerie | Annuler avant décroché puis attendre ; aucune voix cible, connexion ni capture tardive. Grille réutilisable. | À faire | À faire |
| Arrêt et callbacks | Raccrocher pendant une réponse ou son attente ; micro, audio et vidéo source arrêtés, aucune réponse tardive dans le nouvel appel. | À faire | À faire |
| Écoute libre | Paroles entières, aucun micro réarmé depuis l’ancien appel. En PTT : relâchement/annulation propres. Interruption volontaire hors périmètre de la version actuelle (bargeIn=false). | À qualifier | Continuité d’entrée acceptée le 27/10 ; autres cas non observés |
| Fin explicite | Distinguer fin d’expérience et raccrochage ; zéro budget termine l’expérience selon configuration. Ne pas altérer la durée pour forcer un succès. | À faire | À faire |

L’expiration technique de reprise à quatre heures est distincte du budget actif.
F2 en possède une preuve simulée ; aucune attente de quatre heures ni manipulation
de l’horloge Cloud n’est imposée à cette écoute. Noter séparément si elle n’a pas
été observée humainement. Les gardes admin sont protégées par les tests F1/F2 ;
ne pas désactiver de personnage ni modifier les réglages partagés pour la recette.

## Résultats et décisions

- Session réelle `d770e7af-9404-45b5-bbfe-c8cade3259df`, 27 octobre 2026 à
  07:27:41 Europe/Paris, Chrome, sandbox-ulrich v7, film vu. Ulrich confirme
  Max puis Emma sans blocage ni coupure ou répétition remarquée. Il n'a pas dû
  utiliser le bouton de réessai. Ce retour ne vaut pas acceptation globale.
- Modalité : sessions.modalite_voix indique push_to_talk, mais les huit événements
  vocaux terminés indiquent micro_ouvert / STT silence ; l'interface des captures
  affiche Micro ouvert. Observation partielle compatible mains libres ; PTT
  dédié et matrice mains libres complète restent à attester séparément.
- Max T4 : faux message après une question sur un échange passé avec Emma,
  demande locale ouverte à tort ; preuve GM invalide rejetée sans offre.
  T5 : préparation à 07:29:59, validation à 07:30:10, clic à 07:30:12,
  connexion Emma à 07:30:18, même expérience/film/version, nouvel ID d'appel,
  handoff_count=1. T5 est le quatrième échange complet ; T2 n'a pas de réponse
  délivrée. Retour Emma → Max, souvenirs, grille et budget non observés ici.
- Emma T9 : première tentative sans intention privée reconnue, relance avant
  parole soumise ; réponse finale de 209 caractères, completed, un segment lu,
  zéro segment échoué. Premier son mesuré 18 251 ms après transcript final.
  Contenu initial non conservé dans la trace finale, cause amont non démontrée.
  Aucun défaut audible remarqué par Ulrich ; pas de correction spéculative du parseur.
- Premier correctif Max/Emma fusionné et synchronisé ; CI main verte, 101 E2E
  sans retry. Le cas de question passée n'a pas encore été rejoué humainement.
- Session PTT dédiée `fb0e8b40-432d-4aab-8564-ec88f96e4e66`, début 08:34:41
  Europe/Paris, v7, handsFree épinglé false. Accueil et réponses audibles,
  mais T2 prononce une indication technique de préparation rejetée par Ulrich.
  Il avait demandé à parler à Emma. Zéro transfert ; aucun critère de consentement
  validé. La trace confirme une réponse narrative normale remplacée par l'app,
  après confusion entre recherche de solution et recherche de l'autre personnage.
  **Échec de la frontière personnage/mécanique**, complément F3 à livrer puis
  nouvelle écoute requise. Le personnage ne doit pas traiter quatre échanges
  comme une confiance acquise ni exposer seuil, préparation ou réessai technique.
- Acceptation humaine F3 : en attente d’Ulrich, après observations des deux modalités.
- Autorisation explicite de publication : absente. Production inchangée par F3.

Renseigner chaque résultat comme observé, échec ou non observé, avec preuve et
limites. Un défaut acoustique ou fonctionnel bloque son critère jusqu’à correction
et nouvelle recette. Une absence de refus naturel reste une limite explicite.
Tout changement nécessaire suit le plan et la livraison technique complète.

## Publication distincte et reprise

Après acceptation et autorisation explicite seulement, publier via Lovable puis
vérifier le frontend réellement servi et les parcours autorisés. Préparer avant
publication l’identification de la version servie et la procédure de retour via
Lovable ; ne pas supposer qu’un changement de HEAD republie automatiquement.

[Prompt Lovable prêt à copier](prompt_lovable_recette_humaine_f3.md) et
[reprise de finalisation F3](prompt_reprise_fiabilite_passage_personnages_lot_f3_finalisation.md).
À chaque clôture, actualiser plan/CHANGELOG/STORY et tâche Notion, puis fournir
avec lien le prompt autonome suivant ou de finalisation dans le même tour.
Reporter cette obligation dans le prompt ; ne lancer aucun prochain lot/chat.
