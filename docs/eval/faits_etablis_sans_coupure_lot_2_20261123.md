# Faits établis sans coupure — mesure avant / après (23 novembre 2026)

Sandbox `sandbox-ulrich`, fiches du 21 novembre, prompt `optimized_v3`, juge `anthropic/claude-sonnet-5.5` (non calibré),
corpus `docs/eval/sequences_factuality_f.json` (6 séquences, 26 tours par passage, **2 passages**), 4 runs de 52 tours :
avant / après, avec GM (réglage actuel) et sans GM (`gmMode: off`). « Avant » = `main` à `c20e1438`, « après » = ce lot.
Coût mesuré ≈ 1,40 $ par run (≈ 5,5 $ au total, sandbox). Aucune production, aucune fiche modifiée.

## Ce qui change dans le code

- Le paragraphe « Ce qui est vrai aujourd'hui » n'est plus coupé : il passe en entier (Max 1 399 car., Emma 1 414 car.).
- Le bloc complet d'Emma (≈ 1 850 car. avec sa ligne d'usage et les liens de famille) ne tenait pas dans le noyau de
  7 000 car. : **+ 900 car. de noyau** quand le bloc est présent, et le plafond de contexte monte de 900 (13 000 → 13 900).
- Si le bloc ne tient quand même pas : il reste dans l'identité (rien n'est retiré) et un **avertissement** apparaît dans
  « Voir ce que reçoit le personnage » (`established_facts_dropped` ou `canon_squeezed`) et dans `eval:judge:sheets`.

## Coût et latence (mesurés)

| | Avant | Après | Écart |
|---|---|---|---|
| Tokens d'entrée du personnage, par tour (52 appels par run) | 3 967 | 4 200 | **+ 233 (+ 5,9 %)** |
| Tokens de sortie | ≈ 100 | ≈ 100 | — |
| Latence d'un tour, avec GM (moyenne / médiane) | 6,53 / 6,29 s | 6,35 / 6,23 s | dans le bruit |
| Latence d'un tour, sans GM | 2,67 / 2,62 s | 2,82 / 2,69 s | + 0,15 s, dans le bruit |

Les tokens sont ceux facturés par le fournisseur (`llm_usage`), très stables d'un tour à l'autre (min–max 3 949–4 223).
La latence est celle de bout en bout d'un tour, 48 à 50 tours par run : une seconde de bruit est normale. L'audit
annonçait un coût « quasi inchangé » : **c'est faux depuis l'ajout de 900 car.**, il augmente d'environ 6 %.

## Factualité (à lire avec le bruit)

Écart-type moyen d'un même tour entre deux passages : 0,3 à 1,0 point (1,37 au lot F). **Un écart de moyenne de moins de
~1,5 point n'est pas un signal.**

| Note /10 (tours notés) | Avant, GM | Après, GM | Avant, sans GM | Après, sans GM |
|---|---|---|---|---|
| Max | 5,12 (28) | 5,92 (27) | 5,13 (27) | 6,00 (27) |
| Emma | 5,61 (22) | 6,91 (22) | 6,67 (22) | 6,44 (21) |
| Faits contredits, Max / Emma | 22 / 13 | 16 / 5 | 16 / 7 | 20 / 9 |

Les moyennes montent pour Max (+ 0,8 et + 0,9) et diffèrent peu pour Emma ; **aucune n'est hors bruit**. Le signal est
dans les faits que la coupe retirait, qui sont tous établis dans la fiche :

| Fait (statut par passage, ✓ juste, ✗ contredit, ∅ non abordé) | Avant, GM | Après, GM | Avant, sans GM | Après, sans GM |
|---|---|---|---|---|
| Max B1 : « son père a envoyé Mona au camp » | ✗ ✗ | **✓ ✓** | ✗ ✗ | **✓** (1 passage) |
| Max F4 : « il l'a su il y a cinq jours, chez son père » | ✗ ✗ | **✓ ✓** | ✗ ✗ | **✓ ✓** |
| Emma F3 : « elle l'a su il y a deux jours » | ✗ ∅ | **✓ ✓** | ✗ ∅ | (non joué) |
| Emma F1 : « c'est Ava qui a contaminé Emma » | ✗ ✗ | ✓ ✓ | ✓ ✓ | ✗ ✓ |

Ce sont les phrases de la fin du paragraphe : l'erreur répétée 3 fois sur 3 du lot F (Max nie que son père ait envoyé
Mona) est corrigée sur les 3 passages où elle est jugée, avec et sans GM.

**Pas corrigé, et pas du code** : le fusil. « Ce n'est pas Max qui a pris le fusil » reste contredit dans les 4 runs
(Max F1 ✗ ✗ partout, Max B2 ✗ presque partout) ; Emma F2 passe de non abordé à contredit (elle en parle désormais, de
travers). Le paragraphe ne porte pas ce fait ; il vient des timelines, à arbitrer par Romed (écarts déjà transmis au lot F).
Même chose pour Max A3/A4 (thermos, chevreuil), qui bougent d'un run à l'autre sans lien avec ce lot.

## Limites

- 2 passages seulement par configuration, un juge non calibré : les statuts par fait sont à relire par Romed.
- Les runs « avant » et « après » ne sont pas appariés tour à tour (les réponses diffèrent à chaque passage).
- Les tokens des appels GM et juge ne servent pas ici (inchangés : 8 530 d'entrée par appel GM, avant comme après).
- Rien ne remplace l'écoute humaine de Romed (lot suivant) : ces tests ne valident pas le rendu.
