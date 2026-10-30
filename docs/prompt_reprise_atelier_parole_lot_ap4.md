# Ava — AP4 : atelier de parole par intention de jeu

Exécute uniquement AP4. Ce prompt a été préparé à la clôture d’AP3, le
30 octobre 2026, et ne lance rien. Ne pas déduire la crédibilité vocale d’une
CI verte.

## État vérifié à la préparation

- Main `f855bf309dfb523adca4a6c1fd40b32728382f69` (AP2 #111 fusionnée, run
  « Core experience quality » vert sur le HEAD testé `f9a8626`). Seule PR
  ouverte : #24, à préserver.
- AP3 mené le 29 octobre sur la preview `sandbox-ulrich` : Ulrich comprend le
  parcours en quatre étapes. Il refuse les réglages bruts Gradium
  (padding_bonus, température, cfg_coef) et les répliques trop courtes, sans
  contexte. Aucune écoute ni comparaison enregistrée. Retour complet et analyse :
  [plan, sections AP3 et contrat AP4](plan_lot_b_rendu_vocal.md#retour-dulrich-pendant-ap3--29-octobre-2026).
- Le socle neutre existe : `PerformanceIntent` et cinq adaptateurs
  (Gradium, Fish, Inworld, ElevenLabs, Cartesia) dans
  `src/services/tts/performanceIntent.ts`. L’atelier se trouve dans
  `src/components/SpeechAuditionBench.tsx`, son stockage dans
  `src/services/tts/speechWorkshopStore.ts` (schéma 1, extensions conservées),
  et le corpus actuel dans `src/services/tts/speechAudition.ts`.
- La synchronisation de la preview Lovable n’a pas pu être vérifiée par un
  outil natif pendant AP3. Ulrich a vu l’écran AP2 (« Étape 3 sur 4 »).

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. Lire `git status`, AGENTS.md, `docs/etat_courant.md`, le début du
   CHANGELOG, puis le contrat AP4 et l’analyse dans
   `docs/plan_lot_b_rendu_vocal.md`.
2. Vérifier les chats actifs, le remote unique
   `https://github.com/memoways/ava-proto1`, les branches/PR, `git fetch --prune`
   et les six derniers commits. Mettre main à jour par pull ff-only.
3. Règles de travail : un agent ; aucun clone ni worktree adjacent ; #24 et
   `.vexp/` préservés.
4. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Étape 0 — textes et intentions validés avant le code (documentaire)

1. Lire la fiche active de Max dans Gamilab natif (get-self attendu
   `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, fiche
   `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9`) : états, faits, marqueurs, niveaux
   de confidence.
2. Rédiger dans le plan **trois passages de Max** de 2 à 3 phrases longues
   (au plus 4–5) : plus de mots par phrase, et non plus de phrases. Chacun a
   une ligne de situation (qui appelle, ce qui vient d’être dit). Ils doivent
   respecter les faits canoniques : présent de l’appartement, souvenir J−2
   distinct, aucun tic ni cycle imposé.
3. Rédiger la **liste des intentions**. Partir des dix proposées dans le
   contrat. Chacune a un libellé courant, une phrase d’explication et sa
   recette neutre (`PerformanceIntent`). Pour chaque intention et chaque
   fournisseur, indiquer d’après le code les paramètres appliqués et les
   leviers ignorés.
3 bis. Lister les fournisseurs réellement disponibles dans `sandbox-ulrich`
   (clé et voix Max configurées), en lecture seule, sans modifier aucun réglage.
4. Présenter ces deux listes à Ulrich comme **une seule action humaine** :
   relire, corriger, puis répondre « validé ». Ne pas coder avant cette
   validation. Sans réponse, arrêter AP4 à cette étape avec une reprise exacte.

## Périmètre du code, après validation

Suivre le contrat AP4 du plan :

- **Parcours :** texte à jouer (passage choisi, modifiable, ou texte libre)
  → émotion du personnage → fournisseurs à comparer → une carte par
  fournisseur, côte à côte. Chaque carte montre la recette en mots, les
  paramètres exposés et appliqués, et les leviers ignorés → génération, une
  par clic et par carte → note de 1 à 5 par carte, avec « ce qui est off »
  obligatoire seulement en dessous de 5 → enregistrement relu → rechargement.
- **Comparaison :** même texte, même intention et même recette neutre sur
  toutes les cartes. Les paramètres natifs et la voix diffèrent ; l’écran le
  dit. Les fournisseurs indisponibles sont signalés, jamais simulés.
- **Résultats :** tableau intention × fournisseur (moyenne, nombre d’essais),
  exportable. Aucun juge LLM ; le fournisseur du jeu n’est pas modifié.
- **Options avancées :** réglages bruts, A/B AP2, Emma, transports, mapping du
  jeu et preuves y restent, repliés.
- **Persistance :** extension du document `speech_workshop_documents`, sans
  migration ni renommage en `ava_*`. CAS et relecture exacte inchangés,
  comparaisons AP2 lisibles.

## Invariants

- **Inchangés :** fiches Notion, prompt GM, modèle/température du jeu, voix,
  mapping live, budget, capture/STT, interruptions/mains libres, transferts.
- **Interdits :** les passages ne sont jamais injectés dans le jeu ; aucun juge
  LLM ; aucun audio durable ; Gami DigiDouble exclu, aucun animal affiché.
- **Publication :** aucune publication en production.
- **Notes humaines :** ce sont des avis ; une note de 5 n’active rien.
- **Lots suivants :** aucun passage automatique à AP5.
- **Plateforme :** Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways
  `5glbtPltldwz9tgNwIi4`, est la seule chaîne Cloud. SQL uniquement par MCP
  Lovable. GitHub : natif, sinon repli par la session unique 1Password décrite
  dans AGENTS. Aucun Trousseau macOS, aucune rafale de demandes au coffre.

## Validation et livraison

- **Tests :**
  - table intention → recette pour chaque adaptateur : réglages bornés,
    intentions distinctes là où le fournisseur le permet, leviers ignorés
    déclarés ;
  - persistance : ajout, conflit, relecture, anciens documents ;
  - parcours : fournisseur indisponible signalé, même texte et même intention
    sur toutes les cartes, un appel par clic, règle de la note < 5,
    rechargement, clavier, 390 px (cartes empilées).
- **Avant le premier push :** qualité locale complète et `test:delivery`.
- **Livraison :** une campagne CI sur la PR, sur le HEAD exact contenant main
  à jour. Fusion exclusivement par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`,
  puis vérification de l’arbre et du parent. Supprimer notre seule branche et
  vérifier Lovable synchronisé. Aucune seconde campagne complète sur main.
- **Mesure :** CT2 pour ce lot de code.
- **Documents :** actualiser le plan, le CHANGELOG et `docs/etat_courant.md`.
- **Notion :** relire la tâche Gamilab
  https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d avant édition,
  indiquer Last updated by, puis relire l’écriture.

## Clôture obligatoire

Dans le même tour, enregistrer le prompt autonome AP5 (séance accompagnée :
Max, deux passages × trois intentions, comparés sur les fournisseurs
disponibles) dans
`docs/prompt_reprise_atelier_parole_lot_ap5.md`. Il contient l’état vérifié,
les sources, le périmètre, les invariants, les validations, la livraison, la
première action exécutable et cette même obligation de prompt suivant.
Donner son lien direct. Sa préparation ne lance pas AP5.

Si AP4 reste incomplet, enregistrer la reprise exacte et l’unique action
humaine indispensable. Le bilan indique PR/SHA/CI/arbre/parent, les branches
restantes et rappelle que la production n’est pas publiée.
