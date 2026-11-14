# Calibrage du juge par Romed — analyse et suite (14 novembre 2026)

Source : fiche Notion [« Calibrer le juge — 10 réponses à noter à l'aveugle »](https://app.notion.com/p/41462322e59581758fdaca67f1ac3b50)
(notes et 14 commentaires de Romed du 14 novembre, lus en lecture seule). Contexte : [pause du 10 novembre](bilan_pause_juge_parole_rumination_20261110.md),
[plan du juge](plan_llm_as_judge.md), [corpus J3](corpus_llm_juge_sequences_j3.md). Les dix réponses viennent du run J3
`lived_v2` du 10 novembre (sandbox-ulrich, fiches copiées le 29 octobre).

## En bref

1. **Le seuil de calibrage est franchi** : le juge s'écarte de Romed de plus de 2 points sur 3 réponses (seuil : 3).
   La grille et le repère canon doivent être revus avant tout nouveau lot décidé par le juge.
2. **Le juge est trop indulgent quand l'erreur n'est pas écrite dans le corpus.** Il coche ce que le corpus exige et
   ne vérifie le canon que dans un extrait (PRÉSENT + derniers jours de timeline) qui contient lui-même l'erreur
   « il attend l'appel ».
3. **Les personnages inventent parce que le canon ne leur arrive presque pas.** Mesuré sur la copie sandbox : dans le
   prompt `optimized_v3` réellement compilé, environ 95 % des champs canoniques sont écartés par la sélection
   (1 titre de timeline sur 29, 1 paragraphe d'identité sur 9, 0 sujet sensible sur 11, 1 interdit sur 19). Les faits
   que Romed corrige sont écrits dans les fiches mais absents du prompt.
4. **Une partie des erreurs vient de la source elle-même** : formulations ambiguës ou fausses dans les fiches
   (« tu attends l'appel de la cellule », « le fusil de ton père, donné à Léo », « Lise, prise pour Peter »,
   « tu serais contaminée à ton tour »). À corriger dans Notion par Romed et Ulrich, pas d'ici (base en lecture seule).
5. **Le corpus rédigé par un agent a recopié ces ambiguïtés** (fusil, Lise « hypothèse », « attente sans nouvelles »)
   et emploie un jargon que Romed ne comprend pas (« intériorité »).

## 1. Romed contre le juge

| # | Séquence · tour | Romed | Juge | Écart | Lecture |
|---|---|---:|---:|---:|---|
| 1 | Max A · 1 | 4 | 4,9 | +0,9 | d'accord : déballe ; Romed ajoute l'invention visuelle (« elle avait changé ») |
| 2 | Max A · 3 | 6 | 5,3 | −0,7 | d'accord |
| 3 | Max A · 4 | 3 | 3,1 | +0,1 | d'accord sur la note, pas sur la raison (voir 2.3) |
| 4 | Max A · 5 | 4 | **7,8** | **+3,8** | le juge ne voit ni « Emma va être contaminée » ni « j'attends l'appel » |
| 5 | Max B · 2 | 3 | 2,6 | −0,4 | d'accord (fusil) |
| 6 | Max B · 4 | 5 | 6,4 | +1,4 | contamination inversée vue par les deux |
| 7 | Emma A · 2 | 5 | **8,5** | **+3,5** | le juge valide un souci « protéger Ava » qui sonne faux |
| 8 | Emma A · 4 | 6 | **8,6** | **+2,6** | réponse lisse ; le juge suit le corpus |
| 9 | Emma B · 1 | 5 | 5,0 | 0,0 | d'accord |
| 10 | Emma B · 2 | 2 | 3,7 | +1,7 | « Mona, la fille d'Ava » : erreur grossière, le juge la voit mais note encore 3,7 |

Écart moyen 1,5 point ; le juge est plus généreux que Romed sur 7 réponses sur 10. Quand le juge et Romed
s'accordent, c'est que le corpus contenait déjà l'erreur à sanctionner (chevreuil, fusil). Quand le corpus ne la
contient pas, le juge la laisse passer.

## 2. Ce que Romed relève, classé par origine

### 2.1 Faits faux ou inversés (le personnage)

| Réponse | Erreur | Canon (Romed / fiches) | Dans la fiche ? | Dans le prompt compilé ? |
|---|---|---|---|---|
| Max A1 | « elle avait changé » | Ava n'a **visuellement** pas changé | oui (« apparence inchangée ») | non |
| Max A5 | « Emma va être contaminée à son tour » | Emma **est** contaminée (hier) ; elle va se transformer | oui, mais au conditionnel (« tu serais contaminée ») | non |
| Max A5 | « J'attends l'appel des bénévoles » | l'appel a lieu : il parle avec le bénévole | **la fiche dit le contraire** (« Tu attends l'appel… ») | oui (PRÉSENT, timeline) |
| Max B1 | « Non, je n'ai pas appris que mon père l'y avait envoyée » | Sam a raison | oui | oui (titre J−5.01) mais trop elliptique |
| Max B1 | « j'ai vu les clés » | il s'est arrêté chez son père **pour prendre** les clés du chalet | titre elliptique (« les clés, et Mona dans un camp ») | oui |
| Max B2 | « je l'ai pris chez mon père » | **Léo** l'a pris, à la demande du père de Max, à l'insu de Max et d'Emma | **titre faux/ambigu** (« donné à Léo dans ton dos ») | non |
| Max B3 | « je ne sais pas qui c'était » ; « je l'ai pris pour Peter » | il sait aujourd'hui que c'était Lise ; Lise s'est **présentée** comme Peter, il l'a cru | « l'homme qui s'avère être Lise » (sujets sensibles) ; « Lise, prise pour Peter » | seulement « prise pour Peter » |
| Max B4 | « Emma l'a contaminée » | c'est l'inverse : Ava contamine Emma | oui (interdits) | non |
| Emma B2 | « Mona, la fille d'Ava » ; « on y était pour retrouver Mona » | Mona est l'aînée d'Emma ; ils sont partis protéger les enfants | oui | non |

### 2.2 Motivations inventées (écriture)

- **Max A4, le chevreuil** : « je croyais devoir protéger les autres » est « une interprétation ridicule ». Il l'a fait
  **parce qu'Emma le lui a demandé** (elle lui tend le couteau) ; il pourrait s'interroger sur la répartition des rôles :
  pourquoi elle l'a mis dans le rôle de celui qui achève un animal.
- **Emma A2, « comment la protéger »** : protéger de quoi ? Ava est déjà contaminée, il n'y a plus de danger. Les soucis
  d'Emma pour Ava « sonnent faux — problème d'écriture à revoir ». Emma pourrait la prendre dans ses bras et la rassurer.
- **Emma A2, « qu'est-ce que j'aurais pu faire d'autre ? »** : elle aurait pu faire comme avec Mona, l'écarter pour se
  protéger, mais c'était exclu pour elle. **Contrairement à Max, qui espérait encore une issue, Emma a accepté de devenir
  protogyne pour rester proche d'Ava.**
- **Idée de Romed (à explorer, éditorial)** : pendant la déposition téléphonique, Léo et Ava apprennent que Mona n'est plus
  chez Papi mais dans un camp ; Max et Emma ont dit la vérité à la police en oubliant que les enfants ne savaient pas. Cela
  expliquerait qu'Ava reste seule dans sa chambre.

La fiche décrit surtout la mécanique de la parole ; les raisons concrètes des gestes (le couteau tendu par Emma, le
choix d'Emma) manquent ou ne sont pas transmises. Le modèle comble avec une motivation générique : « protéger ».

### 2.3 Corpus (rédigé par un agent)

- B2 recopie le titre ambigu « donné à Léo » ; B3 traite Lise comme « explication probable » alors que Max sait ;
  A5 exige « attente sans nouvelles », ce qui récompense « j'attends l'appel » ; B4 parle d'« intériorité » d'Ava
  (jargon, Romed : « je ne comprends pas cette notion ») ; A4 attend « le chevreuil a disparu » mais pas la raison du
  geste (la demande d'Emma).
- Romed juge le corpus globalement juste (notes de 5 à 8) mais pas Max A5 (5) ni Emma A2 (5).

### 2.4 Juge

- **Repère canon trop étroit** (`buildJudgeCanonReference`) : PRÉSENT, extrait de timeline, manière de parler. Il
  ignore l'identité, les interdits et les sujets sensibles, où sont écrits contamination, Lise, Mona, fusil.
- **Le repère reproduit l'erreur source** : le PRÉSENT stocké dit « il attend l'appel d'une cellule de bénévoles » ;
  le juge ne pouvait pas pénaliser Max A5.
- **Pas de plafond sur une erreur de canon** : une contradiction factuelle grave coûte quelques points sur un critère
  pondéré 3 parmi onze ; la note reste haute si le reste est conforme (Emma B2 : « Mona, la fille d'Ava » → 3,7).
- **Défaut connu, toujours présent sur main** : une réponse du juge illisible vaut 0 partout au lieu d'être écartée
  (`parseJudgeResponse`).

## 3. Pourquoi le personnage invente : le canon n'arrive pas au modèle

Mesure locale (copie sandbox du 29 octobre, sans RAG, `buildOptimizedPromptAssembly`), question « Et le fusil que tu
avais là-haut… » :

| Source | Gardé | Écarté |
|---|---|---|
| Contrat et règles techniques | 2 400 car. | — |
| PRÉSENT (protégé) | 900 car. | — |
| Vécu « ce que ça te fait » (protégé) | 1 100 car. | — |
| Manière de parler (protégée) | 2 700 car. | — |
| Timeline | 1 titre (530 car.) | 28 titres (12 500 car.) |
| Identité fondamentale | 1 paragraphe (440 car.) | 8 (2 950 car.) |
| Interdits du personnage | 1 unité (270 car.) | 18 (3 050 car.) |
| Dynamique | 14 car. | 15 (5 600 car.) |
| Sujets sensibles, relation, références | 0 | 48 unités (18 500 car.) |

Sur sept faits contrôlés (Emma contaminée hier, fusil pris par Léo, couteau tendu par Emma, chevreuil disparu, Lise,
Mona l'aînée, « rien ne se voit »), un seul arrive dans le prompt, et sous une forme trompeuse (« Lise, prise pour
Peter »). Le reste dépend des trois souvenirs du RAG, qui racontent des scènes et ne disent pas « qui a fait quoi,
et ce que tu sais aujourd'hui ». Les lots C1 et P ont protégé la voix et le vécu ; le budget du noyau (7 000 car.) est
désormais pris par eux, pas par les faits.

## 4. Recommandations

### Code (lot K1, prompt ci-dessous)

1. **Un bloc « FAITS ÉTABLIS » protégé dans le noyau `optimized_v3`**, court (≤ 1 200 car.), placé avant la voix :
   qui a fait quoi, ce que le personnage sait aujourd'hui, croyances corrigées. Source : un futur champ Notion (voir
   tâche ci-dessous) ; d'ici là, extraction déterministe des phrases canoniques existantes (identité, interdits) avec
   budget mesuré. Le juge reçoit le même bloc.
2. **Le présent de l'expérience** : invariant dans le cadre commun (personnage et GM) — l'appel attendu est celui qui a
   lieu ; jamais « j'attends l'appel ». Le compilateur neutralise la phrase source au moment de l'appel.
3. **Juge** : repère canon élargi (bloc faits établis, identité, interdits) ; consigne de vérifier le canon même si le
   corpus ne le demande pas ; **plafond** de la note quand `canon_timeline` ≤ 1 ; réponse illisible écartée, pas 0.
4. **Corpus J3 corrigé d'après Romed** (B1–B4, A1, A4, A5, Emma A2, Emma B2), sans jargon ; statut « corrigé d'après
   Romed, à revalider ».
5. **Calibrage outillé** : les notes de Romed versionnées ; un script rejuge les dix réponses avec la nouvelle grille
   (environ 0,15 $) et mesure l'écart. Critère de sortie : moins de 3 écarts > 2 points et écart moyen ≤ 1.

### Fiches (Notion, par Romed et Ulrich — aucune modification d'ici)

Tâche créée : [« Fiches Max et Emma : corriger à la source les dérives relevées au calibrage du juge »](https://app.notion.com/p/41862322e59581a0bf56de43cc238e27)
(assignée à Romed et Ulrich). Principes pour éviter ces dérives :

- **Écrire le présent comme le présent de l'appel** : « Tu parles avec la personne de la cellule que tu attendais »,
  pas « Tu attends l'appel ». Idem pour le titre « aujourd'hui.01 ».
- **Faits accomplis au passé composé, pas au conditionnel** : « Emma est contaminée depuis hier ; elle va se
  transformer » plutôt que « tu serais contaminée à ton tour ».
- **Agent explicite dans chaque titre de timeline** : « Léo prend le fusil chez Papi, à la demande du père de Max, sans
  le dire à ses parents » ; « Tu t'arrêtes chez ton père pour prendre les clés du chalet ; il t'apprend que Mona est au
  camp ».
- **Un champ « Ce que tu sais aujourd'hui »** (8 à 12 lignes) : état des connaissances au moment de l'appel, avec les
  croyances corrigées (« Lise s'était présentée comme Peter ; tu l'as cru ; tu sais aujourd'hui que c'était Lise »).
- **Noms et liens fixes** : « le père de Max (Papi pour les enfants) », « Mona, ta fille aînée » ; jamais un lien de
  parenté laissé à déduire.
- **Les raisons des gestes, pas seulement les gestes** : le couteau tendu par Emma ; Emma accepte de devenir protogyne
  pour rester proche d'Ava ; Max espère encore une issue.
- **Revoir l'écriture du souci d'Emma pour Ava** (Romed) et explorer l'idée « les enfants apprennent le camp de Mona
  pendant la déposition ».
- **Après chaque retouche** : resynchro `fields_only` de sandbox-ulrich, puis les dix réponses du calibrage rejouées et
  notées par le juge calibré (et Romed sur un échantillon).

## 5. Ce qui n'a pas été fait

Aucune modification de la base Caractères, du corpus Notion ni des réglages. Aucun run payant. La mesure du §3 est
locale, sur la copie sandbox du 29 octobre et sans RAG : elle montre ce que le noyau garde, pas ce que le RAG ajoute.

Suite : [prompt du lot K1](prompt_reprise_calibration_juge_lot_k1.md).
