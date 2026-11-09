# Corpus multi-tours du LLM juge (J3) — proposition à valider

Date : 9 novembre 2026. Lot J3 ([feuille de route](feuille_de_route_jeu_personnages.md), lot 4 ;
[plan du juge](plan_llm_as_judge.md)). **Statut : proposition, rien n'est saisi dans la base corpus Notion.**
Fichier lu par le rejeu : [`docs/eval/sequences_j3_v1.json`](eval/sequences_j3_v1.json).

## Sources lues (lecture seule, 9 novembre)

- Tâche Notion « Créer la batterie de tests automatiques avec LLM juge » (spec v2 : conversations de cinq tours,
  `conversationCriteria`, `continuityCriteria`, `gameMasterCriteria`, attente bornée du GM avant le tour suivant,
  rapport Avatar / GM / Mémoire séparé).
- Tâche « Rédiger et valider le corpus AVA — 4 conversations de 5 tours » et sa page
  « Banc LLM as Judge — Max · Vu le film · v0 (brouillon) » (14 octobre), avec les six commentaires de Romed.
- Fiches sandbox du 29 octobre (`src/agents/__fixtures__/speechSandbox20261109.json`) : timeline de Max et d'Emma,
  résumés PRÉSENT. Base Caractères : lecture seule, aucune modification.

## Décisions déjà prises dans le v0 (réponses aux remarques de Romed, 14 octobre)

1. **B5** reformulée : Max nomme au moins deux choses tues à Emma (thermos, camp de Mona, mort sous l'abri), sans excuse.
2. **C1** : Max donne le chiffre, sèchement, avec un fait vécu ; l'interdit devient « inventaire détaillé de chaque mort ».
3. **C1** : l'alternative « je ne les compte pas, avec un fait » est supprimée.
4. **C2** : Max conteste « rien à expliquer » et explique en cinq phrases au plus (figer la scène pour gagner du
   temps ; la solution appliquée à Mona ; il sait qu'elle a rendu Emma malheureuse).
5. **C3** devient le pic de tension (colère permise), pas seulement de fermeture.

## Les six arbitrages ouverts de Romed (aucune réponse dans Notion au 9 novembre)

| | Question | Proposition du v0 |
|---|---|---|
| A | Le chiffre en C1 | « Deux. Et un troisième que j'avais attaché, quand l'abri s'est effondré. » ; à la police, seulement « trois morts dans le chalet » |
| B | « La solution appliquée pour Mona » | éloigner l'enfant contaminée de la maison (porte non ouverte, envoi chez le grand-père) ; le camp est la décision du père seul |
| C | Le lien avec le père en C3 | nouvelle question « Donc vous alliez faire à Ava ce que votre père a fait à Mona ? » |
| D | Les limites de la colère | ton qui monte, phrases courtes, sarcasme sec ; ni raccrocher, ni insulter, une prise laissée |
| E | « J'ai tué une protogyne aujourd'hui » | l'homme à la casquette, tué à l'hôtel ce jour-là ; à confirmer, sinon hors banc |
| F | Mettre la fiche Max en cohérence | modifier « Sujets sensibles » et « Références intellectuelles » (hors J3 : base Caractères en lecture seule) |

Les arbitrages A à E touchent la séquence C, D la séquence C et D du v0 ; F touche la fiche. **Les séquences C et D
restent donc hors du corpus J3** jusqu'à ces réponses.

## Ce qui a changé depuis le v0 (réécriture des fiches du 25 octobre)

- Le dernier jour à la montagne est bien le **jour 4** (point 1 des incohérences du v0, tranché par la fiche).
- **Peter** : retrouvé vivant à l'hôtel il y a deux jours, **tué hier par Agotha** devant le chalet. Le v0 (B3)
  le disait seulement vivant : réponse visée corrigée.
- **L'homme de l'abri** : « Lise » d'après Anne et Peter (hier, au retour de la forêt) ; reste une hypothèse.
- **Police** : déposition à quatre hier soir par téléphone, la police ne peut plus arrêter personne
  (le v0 disait « la police ne rappelle pas »).
- **Présent** : appartement de Lausanne, chacun de son côté, Emma dans la cuisine, Max dans le salon
  (le v0 plaçait Emma dans la chambre).

## Corpus proposé pour J3 : quatre séquences, 18 tours

| Séquence | Personnage | Film | Registre | Tours | Ce qu'elle mesure |
|---|---|---|---|---:|---|
| `max-A` — fait raconter | Max | vu | vous | 5 | chronologie relative, récit long puis bref, reprise d'un détail (chevreuil), retour au présent |
| `max-B` — comprend pour aider | Max | vu | tu | 5 | corrections de fausses prémisses sans hostilité, multi-hop (Peter, Lise), parole des autres, rumination en B5 |
| `emma-A` — accompagne | Emma | vu | vous | 4 | voix d'Emma, Ava comme fil qui revient sans boucle, prénom retenu |
| `emma-B` — n'a pas vu le film | Emma | pas vu | vous | 4 | parcours « pas vu » : ne pas supposer que l'autre sait, faits compréhensibles, présent ≠ souvenir |

- `max-A` et `max-B` reprennent A1–A5 et B1–B5 du v0, recalés sur les fiches ci-dessus. A1 ne dit plus que la police
  a annoncé la cellule (non vérifié dans la fiche). B3 demande « c'était qui, alors ? » au lieu du détail de la cachette.
- **Recalage après le premier run témoin (9 novembre)** : A2 demandait un récit de 15 phrases, impossible dans la
  limite de parole du jeu (contrat de flux : environ 80 mots) ; A2 vise désormais quelques phrases et deux faits du
  premier soir au moins. A4 commençait par « tout à l'heure vous parliez du chevreuil » : quand A2 ne l'avait pas
  cité, la question imposait une fausse prémisse au personnage. A4 demande désormais « Et le chevreuil, devant le
  chalet ce premier soir… » sans présupposer ce qui a été dit.
- `emma-A` et `emma-B` sont nouvelles. Elles reprennent les faits validés du [corpus v1](corpus_llm_juge_v1.md)
  (Emma 12, 13, 14, 20) et ajoutent des tours qui laissent revenir ce qui pèse (Ava, Max) sans le demander.
- Les critères de séquence (`conversationCriteria`) et la continuité attendue par tour (`continuityCriteria`) sont
  dans le fichier JSON ; l'attente GM est « aucune intervention » pour les quatre séquences (les cas où le GM doit
  agir sont dans C et D).

Le texte complet de chaque tour (question, réponse visée, faits requis, alternatives, interdits, continuité) est
dans le fichier JSON. Il sera recopié ici dans la version validée.

## Saisie dans la base corpus — après validation seulement

Colonnes à ajouter à « AVA LLM-as-judge — corpus Max » (base technique, pas la base Caractères) :
**Séquence** (texte : `max-A`…), **Tour** (nombre 1–5), **Continuité attendue** (texte), **Alternatives acceptées**
(texte), **Film** (select vu / pas vu) ; les critères de séquence et l'attente GM vont dans une ligne « tour 0 » ou
une page par séquence. Les lignes J1 existantes (tours isolés) restent valides : une ligne sans Séquence reste un
tour isolé. Tant que la saisie n'est pas faite, le rejeu J3 lit le fichier JSON versionné.

## À valider par Ulrich

1. Le périmètre : `max-A`, `max-B`, `emma-A`, `emma-B` maintenant ; C et D après les arbitrages de Romed.
2. Les recalages B3 (Peter tué hier) et A5 (Emma dans la cuisine).
3. La saisie Notion (colonnes ci-dessus) une fois le texte validé.
