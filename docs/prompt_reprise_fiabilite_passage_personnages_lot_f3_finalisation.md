# Continuer uniquement F3 — recette humaine et publication distincte

Travaille dans /Users/ulrich/CodeProjects/memoways/ava-proto1, remote unique
https://github.com/memoways/ava-proto1. Un agent ; préserver PR #24 et les branches
historiques. Aucun clone/worktree adjacent, aucun prochain lot/chat automatique.

Première action : git fetch --prune, puis git log origin/main -6 --oneline,
git status, branches et PR ouvertes ; actualiser main propre par git pull --ff-only.
Lire AGENTS.md, CHANGELOG.md, STORY.md, docs/plan_changement_interlocuteur_manuel.md,
docs/recette_humaine_ava_f3.md, docs/prompt_lovable_recette_humaine_f3.md et
/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md.

État de départ vérifié : main 3b20b90288ee73824f235de7fcf79b2c96c1a656 (#92),
code F2 d59d51055222d46508e598cedcfb00886412e524 (#90). La préparation documentaire
F3 peut avoir avancé main ; lire le SHA réel, ne restaurer aucune ancienne révision.
Dernière CI complète du code 40385670472 verte (98 E2E sans retry + T11 au retry,
assertion de journal asynchrone, bouton déjà visible). CI PR F2 40382029766 verte
sur HEAD exact 146f2f6, 99/99 sans retry. Qualité locale F2 : 1 037 unitaires,
41 intégrations, 67 régressions et 99 E2E sans retry. Aucun test simulé F3 relancé.

F3 est en cours. Session réelle d770e7af-9404-45b5-bbfe-c8cade3259df,
27 octobre 2026 à 07:27:41 Europe/Paris, Chrome, sandbox v7. Ulrich confirme
Max puis Emma, aucun blocage ni coupure/répétition remarquée, aucun réessai
nécessaire de sa part. Transfert accord/GM/clic exécuté à 07:30:18 ; T5 est le
quatrième échange complet, T2 étant un fragment sans réponse délivrée. Même
expérience/film/version, nouvel appel Emma. Libellé initial push_to_talk mais
huit événements terminés micro_ouvert / silence et interface Micro ouvert :
ne pas compter ce parcours comme deux recettes, ne pas déclarer PTT validé.

Max T4 : question sur un échange passé prise à tort pour une demande locale
après normalisation parlé → parle ; le GM produit une référence openRequest
invalide, rejetée sans offre. Correction ciblée F3 sur
codex/ava-f3-past-contact, retrait de la seule forme isolée parle dans le détecteur,
sans changer demandes explicites, garde GM, reçu complet, seuils ni clic.
Six reproductions unitaires et deux E2E des deux sens rouges avant correction,
212 tests ciblés et deux E2E verts après. Qualité complète locale verte : 1 048
unitaires, 41 intégrations, 67 régressions, lint/typage/build ; 101 E2E locaux
sans retry (17,1 min). Un premier timeout du tableau de latence inchangé est
passé isolément puis dans la qualité complète, sans modification. Livraison
complète à vérifier dans le plan : ne pas prendre un correctif local pour un main livré.

Emma T9 : Missing response intent, récupération avant parole soumise ; réponse
finale de 209 caractères completed, un segment lu, aucun segment échoué.
Premier son mesuré 18 251 ms après transcript final. La trace finale conserve
seulement la génération récupérée ; sa cause amont exacte n'est pas démontrée.
Ne pas assouplir le parseur ni inventer une coupure. Aucun résultat acoustique
supplémentaire accepté. Production inchangée, autorisation de publier absente.
Vérifier les observations arrivées depuis dans ce chat et le protocole avant
de redemander ou de conclure. Aucun transcript complet à sauvegarder.

Vérifier Notion MCP natif Gamilab par get-self :
7e1a9a09-09cb-4deb-a306-83a29b831bc2. Lire la tâche existante
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f et l’application
https://app.notion.com/p/97462322e595822ca21601814e915159.
Aucun autre workspace ou navigateur de repli ; Gami DigiDouble exclu.

Vérifier Lovable Ava 1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4, SHA de main actuel, ready. Toute lecture SQL et opération
Cloud passe seulement par ce connecteur ; aucun Supabase direct. Sandbox publiée
v7 98145fe3-96f1-4525-84c2-0e0a1cc5c6da : Max/Emma, seuil 4, pause 2, quota 8
vérifiés, aucun changement requis pour démarrer. Preview :
https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich&diagnostic=full

Prochaine action technique : terminer/vérifier la livraison du correctif F3
mentionnée dans le plan, CI et synchronisation Lovable, avant nouvelle écoute.
Prochaine action humaine après preview synchronisée : démarrer une nouvelle
expérience PTT explicite avec Max, contrôler la question sur un échange passé
sans faux message, puis demander réellement Emma après le seuil. Confirmer
l’accueil audible et fournir l’ID session si disponible.
Accompagner ensuite le protocole PTT puis mains libres : Max → Emma → Max par
accord/GM/clic, puis Max → grille → Emma → grille → Max, souvenirs isolés,
quatre échanges complets par appel, fragments/pronoms/refus/repli, merci et
continuation, Rester/changement explicite, double clic, sonneries/annulations,
timer suspendu sur grille/recharge et écoute des accueils/voix. Ne pas altérer
les réglages partagés pour forcer le test ; signaler les critères non observés.
Expiration technique de quatre heures distincte du budget, couverte en simulation
F2 ; ne pas la présenter comme nouvellement observée humainement.

Préserver F1/F2 : préparation avant confirmation, reçu complet, requestId /
sourceCallId / version / CAS, offre persistante après merci/continuation jusqu’au
clic, à Rester ou à un changement explicite, gardes admin/double clic, contexte
commun et mémoires privées ; mêmes expérience/film/version, nouvel ID et compteur
par appel. Aucun changement éditorial Notion par défaut.

Toute correction nécessaire : plan avant code, une branche, tests ciblés,
test:quality et E2E complets, PR, CI verte sur HEAD exact avant squash, main vert
E2E, nettoyage de sa branche puis Lovable synchronisé/prêt. Documentation seule :
exception CI Markdown, relecture liens/diff et citation de la dernière CI code.

Publication distincte : attendre acceptation humaine F3 ET autorisation explicite
de publication. Publier uniquement via Lovable, vérifier frontend réellement servi
et parcours autorisés. Avant ce geste, vérifier version servie et retour arrière
possible via Lovable. Une preview ready ne prouve pas une publication production.

À chaque clôture, actualiser plan/CHANGELOG/STORY et tâche Notion existante,
conserver Source, Last updated by=Codex, relire chaque écriture. Vérifier main/CI,
branches restantes et synchronisation Lovable. Si Ulrich doit agir dans Lovable,
enregistrer et fournir prêt à copier le prompt projet/SHA/environnement/actions/
contrôles/retour arrière ; ne pas annoncer une intégration terminée si elle reste.
Dans la même réponse, enregistrer et fournir avec lien et prêt à copier le prompt
du prochain lot ou de finalisation ; reporter cette obligation dans ce prompt.
Si aucun lot ne suit, le dire explicitement. Aucun prochain lot/chat automatique.
