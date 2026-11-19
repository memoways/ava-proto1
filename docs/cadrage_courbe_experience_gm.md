# Cadrage — Courbe d'expérience du GM (lot E)

Statut : **cadrage, sans code** (19 novembre 2026). Aucune migration, aucun appel IA ajouté, aucune publication
production. La base Caractères Notion reste en lecture seule : les indications pour les fiches ne sont que des
propositions à relire par Romed. Contexte : [plan réglages GM](plan_reglages_gm_lisibles_gradues.md), chantier E.

## 1. Ce qui existe déjà (vérifié dans le code)

- **Clôture à 80 %** : `SESSION_MINIMUM_CLOSURE_RATIO = 0.8` (`src/config/experienceRuntime.ts`) ;
  `prd4Orchestrator.ts` calcule `minimumClosureSeconds` et le passe au GM, qui reçoit « TEMPS ÉCOULÉ … clôture naturelle
  autorisée après X » (`gameMasterPRD4.ts`). Règle du prompt : `end_recommended` seulement après le seuil et si la
  conversation a trouvé une clôture naturelle ou échoue durablement. `cleanDirectorAction` transforme alors en
  `action: end`. Le personnage ne raccroche jamais lui-même.
- **Actions du GM** : `none | cinematic | handoff | end`, une seule par tour, validées par le moteur déterministe ;
  le handoff est une suggestion que le personnage formule lui-même.
- **Radar d'état (lot D)** : 5 axes 0–5 (combativité, initiative, lucidité, ouverture, agitation), `initial/min/max`,
  `maxStepPerTurn`, évolution par `character_state_delta` validée par le code, tracée par tour dans `gm_post_turn_log`
  (`character_state_used` / `character_state_after`). `buildGmStateSection` est le point d'extension naturel.
- **Politique relationnelle** : paliers et ouverture par sujet, `closingSignals`, faits établis, décision GM précédente.
- **Modes GM off / light / full** (lot C) et registre unique des réglages (lot A).

Aujourd'hui le GM n'a **aucune notion de trajectoire** : il réagit tour par tour, le temps n'intervient que pour
interdire la clôture avant 80 %. C'est la « courbe ouverte ».

## 2. Interrupteur courbe ouverte / dirigée

| Mode | Comportement | Statut |
|---|---|---|
| **Ouverte** | Comportement actuel, aucune cible. | Défaut, et seul mode si réglage absent. |
| **Dirigée** | Le GM reçoit une **direction courante** (voir §3) et la cherche d'une façon qui reste réactive à l'appelant. | Optionnel, par version d'orchestration. |

Règles proposées :
- Réglage dans la page Game Master via le registre du lot A (un seul champ `experienceCurve.mode`), actif sur toutes
  les versions épinglées, comme les autres réglages GM.
- Dirigée n'a de sens qu'en mode GM **full** (le GM évolue et propose). En **light** : direction transmise en texte
  seulement, sans action de rapprochement ; en **off** : ignorée (courbe ouverte forcée). À confirmer en écoute.
- Retour à ouverte sans perte : rien n'est stocké hors du log de tour.

## 3. Directions à atteindre (pas des phases chronométrées)

Une **direction** est un état narratif visé, atteint quand des signaux observables sont réunis, jamais un créneau
horaire. Le temps ne sert que de **pression douce** (§5), pas de déclencheur.

Catalogue de départ proposé (à valider avec Romed, libellés éditables) :

1. **Établir le contact** : le personnage s'est senti entendu ; palier de départ dépassé.
2. **Creuser** : un sujet sensible (chevreuil, contamination, patriarcat, sous-texte) peut s'ouvrir.
3. **Faire peser** : le choix ou le dilemme du personnage est posé, l'appelant le ressent.
4. **Relâcher** : redescente avant la fin, le personnage retrouve de la lucidité.
5. **Conclure** : fin naturelle possible (jamais avant 80 %, voir §5).

Critères de choix de la direction courante (calculés par le **code**, pas par le GM) :
- **Précondition obligatoire** : ouverture du sujet / palier relationnel (jamais de « faire peser » si le palier ne le
  permet pas : le garde-fou existant prime).
- **État du radar** : p. ex. « Creuser » suppose Ouverture ≥ 2 ; « Relâcher » suppose Agitation ≥ 4.
- **Signaux de conversation** déjà produits par le GM (labels, thèmes, `closingSignals`).
- **Pression temporelle douce** : une direction non atteinte à une fraction du temps n'est jamais forcée, elle est
  seulement rappelée au GM.
- **Non-régression** : on peut rester sur une direction ou reculer ; on ne saute pas une direction sans précondition.
- **Cas de non-intervention** (repris de la tâche Notion des triggers) : appelant en détresse, hors-sujet, hostilité,
  silence demandé. La direction est alors suspendue.

Sortie : une direction courante + une courte raison, exposées au GM dans une section « ## DIRECTION DE L'EXPÉRIENCE »
(même mécanique que « ## ÉTAT DU PERSONNAGE »). Le GM propose, le moteur valide.

## 4. Indications portées par les fiches personnages (proposition pour Romed)

Rien n'est écrit dans la base Caractères. Proposition de champ **hors Notion** (profil runtime, comme `state_profile`) :
- **Axes privilégiés par direction** (« quand on creuse, Ouverture monte avant Combativité ») ;
- **Directions interdites ou rares** pour ce personnage (ex. Emma : jamais d'évocation du suicide, déjà une règle) ;
- **Fin souhaitée** : ton de clôture compatible avec la fiche.
À défaut d'indication : valeurs neutres, le personnage suit la direction par défaut. Romed relit sur une courte grille
(un tableau par personnage), puis Ulrich décide s'il faut aussi l'inscrire à la source dans Notion (demande explicite).

## 5. Articulation

- **Radar (lot D)** : une direction vise des axes avec une **cible** (p. ex. Agitation ↓). Le GM garde son pas par tour
  et ses bornes (déjà validés par `validateStateDelta`) : la courbe ne contourne jamais le radar, elle ajoute un
  **biais** dans la consigne (« préférer faire monter l'ouverture si l'échange le permet »). Pas de nouveau stockage :
  la trajectoire se relit dans `character_state_after`.
- **Clôture à 80 %** : inchangée. En dirigé, la direction « Conclure » ne peut être courante qu'après le seuil ; avant
  le seuil, le GM peut recevoir « Relâcher » pour préparer la fin, sans `end`. La règle d'échec durable (hostilité
  répétée) reste prioritaire.
- **Triggers narratifs** ([tâche Notion](https://app.notion.com/p/2083482bf92f477aa47b66cf473fac25), à faire) : un
  trigger est un signal ponctuel (indice → action possible : transition, autre personnage, cinématique) ; une direction
  est un état de fond. Un trigger peut **faire avancer ou suspendre** une direction, jamais l'inverse. Les triggers
  restent prioritaires sur la pression temporelle et conservent leurs cas de non-intervention. Pas de cinématique
  déclenchée par la seule direction.

## 6. Options

- **A. Texte seulement** : section dans le prompt GM, direction choisie par le GM (aucun calcul code). Rapide, mais non
  testable et dérive possible.
- **B. Direction calculée par le code, consigne au GM (recommandé)** : fonction pure `resolveExperienceDirection`
  (états, palier, temps), testée unitairement ; le GM n'a qu'à s'y conformer. Aucun appel IA ajouté.
- **C. Courbe complète pilotant les actions** (handoff, cinématique) : à écarter à ce stade, trop intrusif avant les
  triggers narratifs.

## 7. Risques

- Courbe trop directive qui rend l'appel prévisible → rester sur « biais », jamais sur action forcée.
- Effet faible et invisible (cf. mesure du lot B : conseils GM quasi identiques) → prévoir un corpus qui sollicite
  clôture et recadrage, pas seulement 5 tours.
- Conflit avec les paliers relationnels → précondition obligatoire, test dédié.
- Surcharge du prompt GM (latence) → section courte, uniquement en dirigé.
- Validation artistique non techniquement mesurable → recette humaine Romed + Ulrich.

## 8. Mesure d'effet

- Rejeu J3, sandbox, sans écriture : `npm run eval:judge:sequences -- --reference optimized_v3 --candidate optimized_v3
  --reference-json '{…ouverte…}' --candidate-json '{…dirigée…}' --repeats 1` (même protocole que la mesure du lot B,
  4 séquences). Compléter par une **séquence longue jusqu'à la clôture** et un corpus de dérapages.
- Indicateurs : notes du juge par tour et par séquence (seuil de bruit 0,30), trajectoire des axes
  (`character_state_after`), présence de mots de rythme ou de clôture dans `gmGuidanceOut`, taux de clôtures avant
  80 % (doit rester nul).
- Recette humaine sandbox (≥ 3 appels par personnage, ouverte vs dirigée) ; la livraison technique ne vaut pas
  validation artistique.

## 9. Lots de réalisation proposés

1. **E1 — Moteur de directions** : types, catalogue, `resolveExperienceDirection` pure et testée, sans branchement.
2. **E2 — Réglage et consigne GM** : interrupteur dans le registre (lot A), section « ## DIRECTION… », trace de la
   direction par tour dans `gm_post_turn_log`, modes off/light/full.
3. **E3 — Indications par fiche** : champ profil runtime (migration via le chat Lovable), onglet de réglage, relecture
   Romed.
4. **E4 — Mesure et recette** : rejeu J3 ouverte/dirigée, séquence jusqu'à la clôture, recette humaine.
Ordre : E1 → E2 → E4 (premier effet), E3 si les indications par fiche se révèlent utiles. Triggers narratifs en
parallèle, indépendants.

## 10. Décisions attendues d'Ulrich

- Valider le catalogue de directions et la règle « directions, pas phases » (avec Romed).
- Choisir l'option (B recommandée).
- Confirmer le comportement en mode light.
- Décider si les indications de fiche restent hors Notion.

Reprise du premier lot de code : [prompt E1](prompt_reprise_courbe_experience_gm_lot_e1.md).
