# Reprise F3 — accepter puis geler la démo Max/Emma

## Première action exécutable

Dans /Users/ulrich/CodeProjects/memoways/ava-proto1, lire AGENTS.md puis lancer
`git fetch --prune`, `git status`, `git log origin/main -6 --oneline` et
`gh pr list --repo memoways/ava-proto1`. Lire seulement la section courante en tête
de docs/plan_changement_interlocuteur_manuel.md ; les preuves historiques ne
sont pas une nouvelle liste de travaux. Un seul agent, checkout canonique seul.
Préserver PR #24 et toutes les branches étrangères.

Vérifier le SHA de main, sa CI et Lovable avant de demander une recette : jamais
transmettre un parcours dépendant d’une PR non fusionnée. Projet Lovable Ava
1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways 5glbtPltldwz9tgNwIi4.
SQL/Cloud par MCP Lovable natif ; aucune connexion Supabase générique.
Notion Gamilab natif : get-self doit confirmer 7e1a9a09-09cb-4deb-a306-83a29b831bc2,
puis relire la tâche https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f.
Conserver Source et Last updated by=Codex, vérifier toute écriture.
Gami DigiDouble exclu, aucun transcript complet ni secret sauvegardé.

## Objectif convenu et preuves acquises

**Démo fiable Max/Emma d’abord**, décision d’Ulrich du 27 octobre. Ne pas
redemander de choisir entre démo, CI et F3 complet. L’optimisation CI est un
chantier séparé ultérieur ; aucune qualification exhaustive imposée à la démo.

- Entrée mains libres déjà acceptée, session 373833d0-4ed0-4613-9a6c-b33c3c9460b6,
  27 octobre 12:03:29 Paris : « plus de coupures ». Ne pas refaire cet essai sans
  modification pertinente du contrôleur ou de ses réglages.
- Nouvel essai rapporté par Ulrich : longue discussion avec Max puis passage vers
  Emma réussi, « pour le moment, tout va bien ». Session sandbox correspondante
  043712a6-27e5-4364-8b5f-1174b8befdc0, début 20:50:40 Paris : préparation,
  validation, clic et exécution observés, handoff_count=1, puis appel fermé.
  Mains libres épinglé=true, acoustic_confirmed, bargeIn=false,
  endOfSpeechMs=2000, hesitationExtraMs=700, incremental=false.
  La colonne historique modalite_voix=push_to_talk ne remplace pas ces flags.
- Ulrich demande ensuite le retour d’une capsule portrait de même format et de
  même largeur que le personnage courant, avec indisponibilité, préparation et
  disponibilité clairement distinctes ; clignotement doux uniquement cliquable.
  Cette décision remplace l’ancienne présentation en lien texte sans capsule.
- Base de ce lot visuel : main/Lovable 4871d9861617f715d78d340f1dd984e14592bbbc,
  CI 40563547468 verte. Capsule livrée par PR #102 dans main code
  bf24b3765733d555fabdac88aed02d02827800e7, CI PR 40574690336 verte sur HEAD
  exact dfb1edc5bd3e2954b04527592487b91a218051d8 (109 E2E sans retry), CI main
  40578598650 verte (109 E2E sans retry) après une relance unique pour une
  assertion asynchrone préexistante du tableau de latence. Aucun code modifié
  pour la relance. Lovable synchronisé/prêt, composant et CSS relus identiques,
  branche du lot supprimée. La clôture Markdown peut avancer main sans changer
  ce code ; vérifier l’état courant avant tout nouvel essai.

## Invariants

Max/Emma seuls actifs ; Max Gradium b5ioHAR7JuHVLskk, Emma JReEQbhiZbfpeMYy.
Conserver voix, prosodie, prompts éditoriaux, fournisseurs et réglages Cloud.
Sortie incrémentale et interruption volontaire restent désactivées en sandbox.
Une fonction volontairement désactivée n’est pas un test « à faire ».

Au moins quatre échanges complets de l’appel courant, accord du personnage,
validation GM, reçu complet puis clic. Aucune bascule automatique ni confiance
forcée. Capsule indisponible avant validation ; préparation explicite mais jamais
présentée comme un accord. Capsule disponible après autorisation, désactivée
pendant la prise de parole ou la validation du clic. Rester révoque l’offre ;
merci/continuation la conserve. Le mouvement réduit supprime le clignotement,
pas le contraste, le libellé ni l’accès clavier. Aucun message technique prononcé.
Raccrochage vers grille, même expérience, budget suspendu, souvenirs propres.

## Ce qui reste pour la démo

Demander une seule action courte dans Sandbox Ulrich : observer la capsule,
puis raccrocher → grille → rappeler Max dans la même expérience. Le passage
Max → Emma déjà réussi n’est pas à requalifier intégralement. Si besoin d’un
nouveau passage pour voir la capsule, ne forcer ni seuil ni accord. Un refus
naturel est légitime et ne doit pas bloquer la grille.
Ulrich a confirmé « Non, pas encore » à la question du rappel depuis la grille ;
ne pas le tenir pour acquis ni lui redemander si cet ancien essai le couvrait.
Preview : https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich

Ulrich juge ce qu’il entend et voit ; Codex relit les métadonnées de la session.
Si Ulrich accepte ce parcours comme démo : **geler cette version et s’arrêter**.
Ne pas transformer cette acceptation en validation exhaustive PTT/mains libres,
en lancement d’un nouveau chantier ou en publication.

Si un défaut précis apparaît : noter attendu/observé, session et flags ; reproduire
avant correction. Une hypothèse, un changement minimal réversible, replays du
cas et des voisins avant le premier push. Aucun contrôleur/refactor par défaut.
La qualité CI prouve les contrats simulés, pas la qualité acoustique.

## Livraison et clôture

Le contrat courant impose qualité locale, CI PR verte sur HEAD exact puis fusion,
CI main verte E2E compris, branche propre supprimée localement et à distance,
Lovable synchronisé/prêt. Ne modifier ni workflows ni contrat CI dans ce lot.
Préparer code, preuves et prompt ensemble avant le premier push ; aucun commit
ajouté pendant une CI. Markdown seul : relire le diff, citer la dernière CI code
verte, ne pas lancer une nouvelle campagne lourde.

Actualiser plan, preuves pertinentes, CHANGELOG/STORY et tâche Notion. Donner
SHA main et CI réellement vérifiés ; préserver les branches/PR étrangères.
Distinguer livré techniquement, entendu, accepté humainement et publié.
La production a ses propres réglages : une publication de code ne copie pas ceux
de sandbox. Aucune publication F3 ni portage Cloud implicite : acceptation humaine
puis autorisation explicite distincte, version servie et retour arrière identifiés.

À chaque clôture, livrer avec lien dans le même tour un prompt autonome de
finalisation ou du prochain lot, et y conserver cette obligation, sans le lancer.
Si aucun lot ne suit, le dire explicitement. Le reste actuel est la finalisation
humaine de cette démo ; aucune nouvelle extension fonctionnelle n’est lancée.
