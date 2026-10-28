# Recette courte du présent canonique — lot F4

## Objectif et première action

Vérifier en preview Lovable qu'Emma et Max répondent depuis leur situation
actuelle, sans avancer à aujourd'hui un départ à l'hôtel daté de J−2. Aucun gel
de démo ni publication de production n'est demandé. Ne pas recommencer les
validations vocales et de passage déjà acceptées.

Première action exécutable : dans le checkout canonique Ava, lire `AGENTS.md`,
faire `git fetch --prune`, lire `git log origin/main -6` et la première entrée
du CHANGELOG. Contrôler par GitHub la fusion du correctif, son SHA et la CI main,
puis vérifier le même SHA dans Lovable avant de proposer la recette humaine.
L'état final et les preuves de livraison sont à compléter dans ce document
après la fusion ; tant qu'ils manquent, ne pas annoncer la livraison terminée.

## Sources et accès

- Projet local unique : `/Users/ulrich/CodeProjects/memoways/ava-proto1`.
- Remote unique : `https://github.com/memoways/ava-proto1`.
- [Plan courant](plan_optimisation_payload_max.md),
  [passages et preuves acquises](plan_changement_interlocuteur_manuel.md),
  [diagnostic GitHub exact et accès de repli](diagnostic_github_connecteur_2026-10-28.md).
- Notion Gamilab natif : get-self doit confirmer
  `7e1a9a09-09cb-4deb-a306-83a29b831bc2` ; tâche existante
  `1c498377edb94cfea4d4bae8728e8c7f` ; Max actif
  `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9`, Emma active
  `dfcc15f8-9d37-45f7-8c84-d0c24a4288cf`. Aucun accès à Gami DigiDouble.
- Lovable seul : Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways
  `5glbtPltldwz9tgNwIi4`. SQL par MCP Lovable, aucun Supabase générique.
- Le connecteur GitHub natif expose ses outils mais répond `Unknown tool`.
  Ulrich a autorisé le 28 octobre de tester les autres connexions : `git`/`gh`
  fonctionnent avec la session existante Ulrfis depuis le contexte système
  autorisé. Pas de login/refresh ni remplacement d'identifiants. L'échec de
  `gh auth status` dans la sandbox ne prouve pas une expiration. Refaire une
  requête authentifiée au dépôt exact si nécessaire. PR étrangère #24 préservée.

## Correctif et limites

Le compilateur optimized_v3 conserve `situation_summary` entier comme unité
protégée, avec la manière de parler et le moteur intime. Le budget statique
explicite est de 5 500 caractères, titres compris ; le plafond de contexte reste
11 000. Si le noyau ne tient plus, erreur avant l'appel LLM plutôt que contexte
factuel tronqué. Aucun fait Lausanne/Anne codé dans le runtime ; aucune fiche,
voix, prosodie ou configuration Cloud modifiée.

24 scénarios synthétiques Max/Emma ont reproduit la perte avant correction.
Les tests de requêtes réelles (LLM simulé) vérifient présent et parole entiers,
correction du joueur, rappel Emma → Max → Emma et refus avant modèle si le
budget est impossible. Cela prouve l'assemblage ; l'absence générale
d'hallucinations et la qualité audible restent des validations humaines.

## Recette humaine à proposer après livraison vérifiée

Une seule action initiale pour Ulrich : ouvrir la preview Lovable, Sandbox
Ulrich, démarrer un nouvel appel avec Emma et demander « Comment va Max ce
matin ? ». Attendu : elle répond depuis l'appartement ; le départ avec Anne
à l'hôtel ne devient pas un fait de ce matin. Noter seulement l'ID session,
les horaires, le résultat et tout fait contradictoire nécessaire au diagnostic.
Ne pas conserver de transcript complet.

Ensuite, si la première réponse est correcte, une question explicite sur le
souvenir ancien et une correction éventuelle du joueur permettent de vérifier
la distinction J−2/aujourd'hui. Raccrocher puis appeler Max dans la même
expérience pour confirmer son présent propre et le budget repris. Ces étapes
restent une recette humaine à effectuer ; les tests simulés ne les valident pas.

## Invariants et clôture

Max Gradium `b5ioHAR7JuHVLskk`, Emma `JReEQbhiZbfpeMYy`. Mains libres
`acoustic_confirmed`, bargeIn=false, endOfSpeechMs=2000,
hesitationExtraMs=700, incremental=false. Ava/Léo inactifs. Même expérience
par la grille, budget suspendu, mémoires privées par personnage ; quatre
échanges complets, accord + GM + reçu + clic, aucun transfert automatique.
Capsule et continuité déjà acceptées conservées.

Distinguer local, GitHub, preview et production. Si une correction de code
suit la recette, nouveau lot depuis main à jour, un seul agent actif, CI PR verte
sur HEAD exact, fusion, CI main verte, suppression de notre branche et source
Lovable relue. Ne pas modifier les workflows ou le contrat CI pour ce lot.
Publication sur autorisation distincte d'Ulrich.

À la clôture, actualiser le plan et la tâche Notion existante (Source conservée,
Last updated by=Codex), puis vérifier les écritures. Livrer le prompt autonome
du prochain lot/finalisation dans `docs/` avec lien, ou dire explicitement qu'aucun
lot ne suit. Cette passation ne lance pas le lot suivant.
