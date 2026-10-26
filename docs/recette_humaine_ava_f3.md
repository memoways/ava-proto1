# Recette humaine Ava F3 — PTT et mains libres

État : préparée, exécution et acceptation humaines en attente. Aucun résultat
acoustique F3 attesté. Les résultats F1/F2 simulés ne remplissent aucune case.
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

Commencer par une expérience PTT avec Max, puis refaire la matrice dans une
nouvelle expérience mains libres. Chaque expérience garde son ID, son choix de
film et sa version entre tous ses appels. Noter pour chaque modalité : heure,
ID session, version, navigateur/appareil, mode de sortie et observations utiles.
Ne conserver ni transcript complet ni secrets dans le dépôt ou Notion.

Ulrich juge ce qu’il entend ; Codex vérifie ensuite les métadonnées et les
événements de ces sessions via Lovable. Un reçu de livraison TTS ne prouve pas
l’écoute ni la qualité audible. Une réponse « prêt » valide seulement le début.

Tous les résultats ci-dessous sont **à faire** dans les deux modalités.

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
| Écoute libre | En mains libres : silences, prise de parole et interruption volontaire compréhensibles ; aucun micro réarmé depuis l’ancien appel. En PTT : relâchement/annulation propres. | À faire | À faire |
| Fin explicite | Distinguer fin d’expérience et raccrochage ; zéro budget termine l’expérience selon configuration. Ne pas altérer la durée pour forcer un succès. | À faire | À faire |

L’expiration technique de reprise à quatre heures est distincte du budget actif.
F2 en possède une preuve simulée ; aucune attente de quatre heures ni manipulation
de l’horloge Cloud n’est imposée à cette écoute. Noter séparément si elle n’a pas
été observée humainement. Les gardes admin sont protégées par les tests F1/F2 ;
ne pas désactiver de personnage ni modifier les réglages partagés pour la recette.

## Résultats et décisions

- PTT : ID session non fourni ; écoute non réalisée/rapportée ; aucune acceptation.
- Mains libres : ID session non fourni ; écoute non réalisée/rapportée ; aucune acceptation.
- Traces F3 : aucune nouvelle session attestée lors de la préparation.
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
