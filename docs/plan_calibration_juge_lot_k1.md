# Lot K1 — faits établis dans le prompt et juge calibré (14 novembre 2026)

Prompt : [prompt_reprise_calibration_juge_lot_k1.md](prompt_reprise_calibration_juge_lot_k1.md). Constat de départ :
[analyse du calibrage par Romed](analyse_calibration_juge_romed_20261114.md). Plan du juge : [plan_llm_as_judge.md](plan_llm_as_judge.md#lot-k1--faits-établis-et-juge-calibré-14-novembre-2026).

## En bref

- **Le juge note désormais comme Romed, sous le seuil** : écart moyen 0,82 à 0,85 point (1,51 au calibrage, 1,22 rejugé
  avec l'ancienne grille), aucun écart de plus de 2 points (3 au calibrage). Limite : la grille a été réglée sur ces dix
  réponses ; Romed doit renoter un nouvel échantillon pour le confirmer.
- **Max et Emma ont les faits établis sous les yeux** : un bloc protégé « FAITS ÉTABLIS » (1 075 caractères, tiré de la
  fiche) entre dans le noyau `optimized_v3` sans le grossir ; « tu attends l'appel » n'apparaît plus dans aucun prompt.
- **Ce que ça coûte** : la fin de la « Manière de parler » (641 caractères pour Max, 1 037 pour Emma : « Ce qui passe sans
  être dit », « Marqueurs », « Ce que tu évites ») sort du noyau. Les états de parole et l'ouverture restent entiers.
- **Ce qui manque encore vient des fiches** : cinq faits de la liste de contrôle restent absents du prompt parce que la
  fiche ne les écrit pas ou les écrit de travers (fusil pris par Léo, Lise « présentée comme » Peter, chevreuil disparu,
  raison du geste d'Emma, raison du départ). Ils attendent la [tâche Notion](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27).

## Plan court

1. **Diagnostic** : liste de contrôle versionnée [`docs/eval/faits_canon_k1.json`](eval/faits_canon_k1.json) (18 faits,
   tours du corpus J3 v2) ; le test `src/services/establishedFacts.test.ts` compile le noyau sur la copie sandbox déjà
   versionnée (`src/agents/__fixtures__/speechSandbox20261109.json`, identique à la base au 14 novembre) et vérifie chaque
   fait présent ou absent. Un fait absent porte son explication.
2. **Bloc « FAITS ÉTABLIS »** (`src/services/establishedFacts.ts`) : champ Notion optionnel « Ce que tu sais aujourd'hui »
   s'il est rempli ; sinon le paragraphe « Ce qui est vrai aujourd'hui » de l'identité fondamentale, les liens de parenté
   des titres permanents de la timeline (« Mona, ton aînée ») et, s'il reste de la place, l'interdit « chronologies ».
   1 200 caractères au plus, aucune phrase écrite dans le code.
3. **Présent de l'appel** : la fiche est lue « au moment de l'appel » (`sheetAtCallTime`) ; le cadre commun porte la même
   phrase pour le personnage et le Game Master (`CALL_PRESENT_INVARIANT`).
4. **Juge** : repère canon élargi, vérification du canon avant toute note, plafond, réponse illisible écartée.
5. **Corpus J3 v2** corrigé d'après Romed, statut « corrigé d'après Romed, à revalider ».
6. **Calibrage outillé** : `npm run eval:judge:calibrate`.
7. **Mesures** sur sandbox-ulrich, plafonds explicites.

## Ce qui a été fait

### Noyau `optimized_v3`

| | Avant | Après |
|---|---|---|
| PRÉSENT (protégé) | « Il attend l'appel d'une cellule de bénévoles… » | « Il parle en ce moment avec la personne d'une cellule de bénévoles dont il attendait l'appel… » |
| FAITS ÉTABLIS (protégé, nouveau) | — | 1 076 car. (Max), 1 072 (Emma), après le PRÉSENT, avant l'identité et la voix |
| Manière de parler (protégée) | 2 683 (Max), 2 751 (Emma) | 2 038 (Max), 1 708 (Emma) : ouverture et états de parole entiers |
| Canon choisi selon la question | premier morceau d'une période de la timeline | les titres de timeline que la question touche (quatre au plus), puis le reste |
| Noyau total | ≤ 7 000 | ≤ 7 000 (inchangé) ; prompt complet inchangé à 60 caractères près |

- **Place prise sur la voix, au plus juste** : la manière de parler cède ses derniers paragraphes, un par un depuis la
  fin, seulement tant qu'il le faut pour loger le bloc et garder 650 caractères de canon choisi. Elle ne cède jamais son
  ouverture ni la liste des états de parole (lue par la consigne « état de parole du tour »). Ce qui est cédé apparaît
  dans la trace du prompt (statut `budget`). Si le bloc ne peut pas entrer, l'ancien noyau est joué tel quel : les faits
  ne rendent jamais une fiche injouable.
- **Titres de timeline** : un titre par unité, comparé à la question sur son intitulé (pas sur le lieu ni l'heure, communs
  à des dizaines de titres), les mots rares comptant plus que « chalet » ou « vous ». « Emma te tend le couteau pour le
  chevreuil » arrive ainsi pour la question du chevreuil, « Le fusil de ton père, donné à Léo dans ton dos » pour celle
  du fusil. La période (« Il y a cinq jours… ») est rendue une fois au-dessus de ses titres.
- **Interrupteur** : `establishedFacts` (défaut : actif). Le juge peut rejouer l'ancien noyau en mémoire
  (`--reference-json '{"establishedFacts":false}'`), sans rien écrire dans `admin_settings`.
- **Champ Notion optionnel** : `sync-notion` lit « Ce que tu sais aujourd'hui » si la propriété existe et l'écrit dans
  `character_prompts.ce_que_tu_sais_aujourdhui` ; sans propriété, rien ne change. Si la colonne manque encore, la synchro
  écrit les autres champs et le signale dans ses journaux. Migration additive :
  `supabase/migrations/20261114120000_character_prompts_ce_que_tu_sais_aujourdhui.sql` (à appliquer par le chat Lovable).

### Liste de contrôle (copie sandbox, sans RAG)

| Fait (Romed) | Tour | Avant | Après |
|---|---|---|---|
| Ava n'a visuellement pas changé | Max A1 | absent | présent |
| Emma est contaminée depuis hier | Max A5, B4 | absent (A5) | présent |
| L'appel a lieu ; plus de « tu attends l'appel » | tous | « attend l'appel » partout | présent, plus aucune attente |
| Arrêt chez le père : les clés, Mona au camp | Max B1 | présent | présent |
| Le fusil : titre « donné à Léo dans ton dos » | Max B2 | absent | présent |
| Max sait que c'était Lise | Max B3 | présent | présent |
| Ava contamine Emma, pas l'inverse | Max B4 | présent | présent |
| Emma tend le couteau à Max | Max A4 | absent | présent |
| Mona est la fille aînée d'Emma | Emma B2 | absent | présent |
| Emma a pris Ava dans ses bras en sachant | Emma A2 | absent | présent |
| **Léo a pris le fusil, à la demande du père** | Max B2 | absent | **absent** : la fiche ne le dit pas (titre ambigu) |
| **Lise s'était présentée comme Peter** | Max B3 | absent | **absent** : la fiche dit « prise pour Peter » |
| **Le chevreuil avait disparu** | Max A4 | absent | **absent** : seulement dans un souvenir du RAG |
| **Emma : rester proche d'Ava** | Emma A2 | absent | **absent** : raison absente de la fiche |
| **Partis pour protéger les enfants** | Emma B2 | absent | **absent** : écrit dans « Qui tu es », non retenu pour cette question |

Les cinq écarts en gras se règlent dans Notion : titres avec un agent explicite, et le champ « Ce que tu sais
aujourd'hui » pour les raisons des gestes et les croyances corrigées.

### Juge

- **Repère canon élargi** (`buildJudgeCanonReference`) : situation lue au moment de l'appel, **faits établis**, timeline,
  **identité**, **interdits du personnage**, manière de parler. Il s'ouvre sur « l'appel attendu a lieu ». Environ
  4 700 tokens par appel (2 900 avant) : 0,0205 $ mesuré par jugement (0,0136 $ avant).
- **Vérification du canon avant toute note** : chaque fait affirmé est comparé aux repères même si le corpus ne le demande
  pas ; fait contraire ou prémisse fausse reprise → `canon_timeline` ≤ 1 ; dire qu'il attend l'appel contredit le
  présent ; une crainte ou un projet que les repères rendent sans objet (« protéger » d'un danger déjà advenu) est une
  invention (`canon_timeline` ≤ 2, `lived_impact` ≤ 3).
- **Attente du corpus douteuse** : le juge suit les repères et le dit dans un champ `corpus_doubt`, repris dans le
  rapport de calibrage.
- **Plafond** (`CANON_CONTRADICTION_CAPS`) : note pondérée ≤ **3** si `canon_timeline` = 0, ≤ **4** si ≤ 1. Valeurs
  mesurées sur le calibrage : Romed note de 2 à 4 les réponses qui contredisent le canon (Max A4 3, A5 4, B2 3, Emma B2 2).
  Le plafond n'élève jamais une note ; un ancien résultat sans le critère n'est pas touché.
- **Réponse illisible** : `parseJudgeResponse` rend `null` ; l'appel est rejoué une fois ; s'il reste illisible, le tour
  est enregistré sans note et sort de toutes les moyennes. Les anciens résultats « JSON juge illisible » (0 partout) sont
  eux aussi écartés à la lecture.

### Corpus J3 v2

[`docs/eval/sequences_j3_v2.json`](eval/sequences_j3_v2.json), neuf tours corrigés, détail dans
[corpus_llm_juge_sequences_j3.md](corpus_llm_juge_sequences_j3.md#corpus-v2--corrigé-daprès-romed-14-novembre-lot-k1).
La v1 reste versionnée. Rien n'est saisi dans la base corpus Notion.

### Outils

- `npm run eval:judge:calibrate -- [--file …] [--corpus …] [--repeats 1] [--max-cost-usd 0.5]` : rejuge les réponses
  déjà notées par un humain, sans rien régénérer ni écrire en base ; écart par réponse, écart moyen, nombre d'écarts
  > 2, verdict ; code de sortie 4 si le critère n'est pas atteint.
- `npm run eval:judge:sheets -- [--env sandbox-ulrich]` : copie en lecture seule des fiches synchronisées, pour comparer
  avec la copie de test après une resynchronisation.

## Mesures (sandbox-ulrich, 14 novembre)

### Calibrage : dix réponses de Romed, rejugées telles quelles

| Grille | Corpus | Écart moyen | Écarts > 2 | Biais | Rapport |
|---|---|---:|---:|---:|---|
| Juge du run du 10 novembre (avec les tours précédents) | v1 | 1,51 | 3 | +1,3 | [notes de Romed](eval/calibration_romed_20261114.json) |
| Ancienne grille, rejugé sans les tours précédents | v1 | 1,22 | 2 | +0,8 | [avant](eval/calibration_k1_avant_grille_20261114.md) |
| **Nouvelle grille** | v1 | 0,87 | 2 | — | [grille seule](eval/calibration_k1_apres_grille_corpus_v1_20261114.md) |
| **Nouvelle grille** | **v2** | **0,85** | **0** | −0,3 | [après](eval/calibration_k1_apres_grille_corpus_v2_20261114.md) |
| **Nouvelle grille**, 3 passages | **v2** | **0,82** | **0** | — | [après, 3 passages](eval/calibration_k1_apres_grille_corpus_v2_3passages_20261114.md) |

Critère de sortie (moins de 3 écarts > 2 points, écart moyen ≤ 1) : **atteint**. Coût : environ 1,2 $ pour les cinq
rejugements (60 appels juge), chacun sous son plafond (0,5 à 0,8 $).

- Les trois grands écarts du calibrage sont résorbés : Max A5 4 contre 3,0 (7,8 avant), Emma A2 5 contre 5,9 à 6,2
  (8,5 avant), Emma A4 6 contre 7,5 (8,6 avant).
- Le juge est maintenant un peu plus sévère que Romed sur Max (biais −0,3) : Max A3 (thermos) 6 contre 4,0, exactement au
  seuil de 2 points ; le juge y voit une prémisse fausse non corrigée (`canon_timeline` 1, plafond 4).
- **Limite** : la consigne et le plafond ont été réglés sur ces dix réponses. Le résultat dit que la grille peut suivre
  Romed, pas qu'elle le suivra sur d'autres réponses. Recette humaine : Romed renote dix réponses du run ci-dessous.

### Séquences J3 v2 : ancien noyau contre « faits établis + présent de l'appel »

RESULTATS_SEQUENCES

## Validations

VALIDATIONS

## Hors périmètre, non fait

Base Caractères, pages et champs Notion des personnages : aucune modification. Aucune écriture dans la base corpus
Notion. Aucune resynchronisation. Lot R, rumination, STT/TTS, production. La migration n'est pas appliquée (chat Lovable).

## Suite

- **Ulrich** : appliquer la migration `ce_que_tu_sais_aujourdhui` dans le chat Lovable (colonne additive, vide) et
  vérifier le redéploiement de `sync-notion`.
- **Romed et Ulrich** : [tâche Notion des fiches](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27) (créer et
  remplir « Ce que tu sais aujourd'hui », titres avec agent explicite, présent écrit comme le présent de l'appel) ;
  relire le corpus v2 ; renoter dix réponses du run K1 ; écoute sandbox (la fin de la manière de parler ne se joue plus).
- **Lot suivant** : [K2, fiches corrigées et juge confirmé](prompt_reprise_fiches_corrigees_lot_k2.md).
