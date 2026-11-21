# Plan — juge, fiches et direction de jeu : état des lieux et rounds de test

Date : 21 novembre 2026. Lot 0 (documentaire). Prochain lot : [F — factualité](prompt_reprise_juge_lot_f.md).

## Contexte

Ulrich est perdu dans les tâches : le juge (J1–J3, K1), les corrections de fiches par Romed, les réglages GM (lots A–E)
et les essais de Romed/Benoît avancent en parallèle. Max sonne « off » : trop méta, trop intello, pas crédible.
Il faut un point clair et un plan qui teste une dimension à la fois : **factualité**, puis **direction de jeu /
état émotionnel**, puis **crédibilité et style**, en supprimant les contradictions entre la fiche Notion et les
réglages du back-office.

## État des lieux vérifié (21 novembre, lecture seule)

### Tâches Notion (Gamilab, Tâches Storygami)
| Tâche | État | Ce qui reste vraiment |
|---|---|---|
| Créer la batterie de tests avec LLM juge | En cours | J1–J3 + K1 livrés ; K2 jamais lancé ; « comparer des variables » (20 nov.) sans liste |
| Fiches Max et Emma : corriger à la source | **Terminé** (Romed, 19 nov.) | voir écarts ci-dessous |
| Calibrer le juge — 10 réponses | fait le 14 nov. | 10 nouvelles réponses à noter (condition K2) |
| 5 développements Game Master | En cours | lots A–D livrés en code ; D : « courbes très linéaires » ; E1 non branché |
| Tester Max et Emma en audio / Todos Romed et Benoît | À faire / En cours | retours attendus 23–24 nov. ; observer « trop intellectuel, méta » |
| Rendre les dialogues moins écrits | En cours | écoute |
| Complément rumination | En cours | non tranché |

### Fiches (base Caractères, lecture seule)
- Max et Emma actives retouchées par Romed le 19 nov. : plus aucun « tu attends l'appel » ; présent de l'appel écrit ;
  déposition téléphonique et Mona au camp ajoutées.
- **Pas de champ « Ce que tu sais aujourd'hui »** dans la base : les faits restent dans le paragraphe « Ce qui est vrai
  aujourd'hui » de l'identité (le code le prend en repli, OK), plus long qu'avant (identité 2,3k → 4,0k car.).
- Reste au moins une formule au futur : « en sachant qu'elle sera contaminée à son tour ».

### Code — ce que reçoit le personnage à chaque tour (`src/agents/maxOptimizedPromptCompiler.ts:674-743`)
Six couches disent au personnage *comment être*, sans hiérarchie écrite entre elles :
1. CADRE DE L'APPEL — PRIORITAIRE (orchestration publiée)
2. DIRECTIVE RELATIONNELLE DU TOUR — PRIORITAIRE (GM)
3. PAROLE DU TOUR (état de parole de la fiche choisi par le GM, `next_speech_state`)
4. ÉTAT DU PERSONNAGE À CE TOUR (radar 5 axes, `src/services/characterState.ts`)
5. Fiche : identité (contient aussi des **règles de longueur** 1–3 phrases / 15 max), manière de parler (**5 états de
   parole**), moteur de l'appel (**conditions d'ouverture / fermeture**), références intellectuelles
6. RAG, mémoire, état du tour

### Conflits identifiés
- **Deux systèmes à 5 éléments en parallèle** : 5 états de parole (fiche, Notion) et 5 axes du radar (app). L'agitation
  du radar recoupe « la digue cède » ; l'ouverture du radar recoupe les conditions d'ouverture du moteur.
- **Le radar pousse vers l'intello** : lucidité 4–5 = « tu repères les incohérences… tu nommes les contradictions » ;
  initiative 5 = « tu cadres » ; ouverture 5 = « tu dis ce que tu n'as dit à personne ». La fiche dit l'inverse
  (choc, pas d'auto-analyse, aveu jamais d'un coup).
- **Sources probables du ton méta côté fiche** : champ « Références intellectuelles » envoyé au runtime ; consignes
  rédigées en prose analytique (« ces moteurs ne sont ni des aveux à produire ni une psychologie à expliquer ») que le
  modèle imite ; « tu ne sais pas que tu es un personnage de fiction » qui amorce le méta.
- **Format dans la fiche** (longueur des réponses) alors que c'est de la direction de jeu.
- Le **juge** mélange factualité (`canon_timeline` ×3, `must_not` ×3) et style (`not_meta`, `lived_impact`,
  `distinct_voice`, `speech_quality`) dans une seule note (`src/services/evalJudgeScoring.ts:33-37`) ; il ignore
  l'état injecté, le mode GM et l'intention artistique ; calibré sur 10 réponses seulement.

### Répartition cible (proposée par Ulrich, retenue)
- **Notion (Romed)** : qui est le personnage, ce qui est vrai, ce qu'il sait, sa réalité émotionnelle et ses moteurs,
  sa signature verbale.
- **App (back-office)** : la direction de jeu — état initial, bornes, vitesse d'évolution, mode GM, format/longueur,
  intention de la scène. Visuel, changeable vite, sans toucher aux prompts.
- **GM** : fait évoluer l'état dans les bornes de l'app et dans la vérité de la fiche.

## Plan en lots (un lot = une PR, livraison par la garde)

### Lot 0 — Carte des couches et état des lieux (doc, aucun code)
- Ce document (livré le 21 novembre) : tableau des couches avec
  provenance et propriétaire, liste des conflits ci-dessus avec extraits.
- Mise à jour de la tâche Notion du juge (section « État des lieux 21 nov. ») et lien dans `docs/etat_courant.md`.
- Prompt de reprise du lot F.

### Lot F — Round 1 : factualité seule (reprend K2, adapté)
- Resynchro `fields_only` sandbox-ulrich ; `npm run eval:judge:sheets` ; mise à jour de `docs/eval/faits_canon_k1.json`.
- Retirer `neutralizeAwaitedCall` / `sheetAtCallTime` si la copie de test ne contient plus « attends l'appel » ;
  remplacer par un test qui **signale** une fiche fautive ; déplacer `CALL_PRESENT_INVARIANT` dans
  `ExperienceFrameConfig` (défaut = texte actuel).
- Juge en **mode factualité** : note séparée, critères canon, interdits, invention, prémisse fausse corrigée ; les
  critères de style ne comptent pas dans ce round.
- Corpus factuel adversarial (prémisses fausses, faits du tableau de Romed : fusil, clés, Lise/Peter, sens de la
  contamination, Mona) tiré de `sequences_j3_v2.json`, sans second corpus.
- Liste des écarts de fiche à envoyer à Romed (futur « sera contaminée », doublons identité/timeline). Question à
  Romed : créer le champ dédié ou garder le paragraphe (le code gère les deux).
- Condition humaine : 10 nouvelles réponses notées par Romed pour confirmer le juge.

### Lot H — Une seule hiérarchie, zéro contradiction (code + propositions à Romed)
- Écrire la hiérarchie en tête du prompt : faits (fiche) > cadre > état de l'app > parole du tour ; règle « le radar
  règle l'attitude, jamais la vérité ni le registre ».
- Réécrire les textes du radar en attitudes vécues, sans cognition (supprimer « tu nommes les contradictions »,
  « tu cadres », « sans filtre ») ; bornes par personnage (ex. Max lucidité ≤ 3, ouverture ≤ 4) ; validation Romed des
  libellés.
- Décider le sort des états de parole : rester dans la fiche (signature) mais le GM les choisit en cohérence avec le
  radar (une seule décision GM par tour, pas deux indépendantes).
- Format/longueur : réglage app ; proposer à Romed de retirer ces phrases de l'identité.
- Interrupteur d'évaluation « références intellectuelles hors runtime » pour mesurer leur effet sur le ton.
- Back-office : « Voir ce que reçoit le personnage » avec la provenance de chaque couche (le pendant de l'aperçu GM).

### Lot D2 — État émotionnel qui évolue vraiment
- Diagnostiquer les courbes linéaires (calcul, delta GM, transmission, affichage) sur des sessions réelles.
- Règles d'évolution ancrées sur des événements (insistance → fermeture, écoute → ouverture, sujet Emma → agitation),
  toujours dans les bornes de l'app ; persistance entre deux appels d'une même expérience.

### Lot J4 — Round 2 : direction de jeu
- Le juge reçoit l'état injecté et l'intention de la scène ; il note la conformité au tour et la plausibilité de
  l'évolution sur la séquence (critère séparé). Comparaison GM off / léger / fort sur le même corpus.

### Lot J5 — Round 3 : crédibilité et style
- Grille « crédible / pas méta / pas intello / oral » calibrée par Romed sur des répliques réelles de Max jugées
  « off » ; intention artistique lue depuis un texte éditable de l'app, pas codée en dur.
- Boucle avec Romed : propositions d'écriture issues des pires tours (il écrit dans Notion, jamais un agent).

## Ordre et dépendances
Lot 0 → F (en attendant les retours Romed/Benoît 23–24 nov.) → H → D2 → J4 → J5. Chaque round ne démarre que si le
précédent est stable (factualité vérifiée avant de juger le jeu).

## Limites
Base Caractères en lecture seule ; aucune production ; resynchro sandbox-ulrich uniquement ; runs payants plafonnés
(≤ 3 $ par run, annoncés) ; Lovable pour toute migration.

## Vérification
- Lot 0 : liens valides, page Notion relue après écriture.
- Lot F : `npm run eval:judge:sheets`, `npm run eval:judge:calibrate`, `npm run eval:judge:sequences` (mode
  factualité), tests unitaires du compilateur et du garde-fou ; CI `regression-gates` verte ; écart moyen ≤ 1 sur les
  deux échantillons Romed.
- Lot H : tests de compilation du prompt (hiérarchie présente, textes radar), rejeu J3 avant/après dans le bruit
  mesuré, écoute Romed.
- Lots D2/J4/J5 : courbes non linéaires sur sessions sandbox, notes séparées par round dans le rapport.

