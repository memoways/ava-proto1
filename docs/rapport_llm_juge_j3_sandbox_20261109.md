# Rapport J3 — juge sur plusieurs tours, sandbox-ulrich (9 novembre 2026)

Lot J3 ([plan](plan_llm_as_judge.md#lot-j3--juge-sur-plusieurs-tours-9-novembre-2026)). Corpus : proposition
[`sequences_j3_v1.json`](eval/sequences_j3_v1.json) (non validée, non saisie dans Notion) — `max-A` (5 tours, vu),
`max-B` (5, vu), `emma-A` (4, vu), `emma-B` (4, pas vu). Personnage `openai/gpt-5.6-luna`, T 1,4, 360 tokens ;
juge `anthropic/claude-sonnet-5.5` ; GM post-tour joué à chaque tour. Aucune session, aucune ligne `eval_runs`,
`admin_settings` intact (0 écriture refusée nécessaire).

## Runs

| Run | Comparaison | Passages | Tours | Durée | Coût mesuré | Rapport |
|---|---|---:|---:|---|---:|---|
| `5ceaab89` | témoin `optimized_v3` / `optimized_v3` | 2 | 72 | 13 min | 1,68 $ | écarté : juge de séquence vide 10 fois sur 16 (voir « Défauts corrigés ») |
| `45221582` | essai `max-B` après correctif | 1 | 10 | 3 min | 0,24 $ | juge de séquence lisible 2/2 |
| `59336e92` | **témoin** `optimized_v3` / `optimized_v3` (`lived_v2` des deux côtés) | 2 | 72 | 13 min | 1,69 $ | [rapport](eval/j3_temoin_optimized_v3_20261109.md) |
| `23208f71` | **second témoin** `v1` / `v1` (le candidat hérite de l'instantané de la référence) | 2 | 72 | 14 min | 1,71 $ | [rapport](eval/j3_temoin_v1_20261109.md) |
| `2be948b2` | **levier du lot P** : contrat `v1` (référence) / `lived_v2` (candidat) | 3 | 108 | 21 min | 2,55 $ | [rapport](eval/j3_levier_lived_v2_20261109.md) |

Total mesuré : **7,87 $** ; chaque run sous son plafond (3 $, 0,60 $, 3 $, 3 $, 3,50 $). Coût par séquence jouée :
0,07 à 0,12 $ (5 tours ≈ 0,12 $). Estimation J3 (J1 × 1,25 + 0,03 $ par jugement de séquence) : 1,98 $ pour 1,69 $
mesurés, prudente de 15 %.

## Bruit multi-tours (deux témoins)

| | Témoin `lived_v2` | Témoin `v1` |
|---|---:|---:|
| Note par tour /10 : réf. → cand. | 5,32 → 5,60 (Δ +0,27) | 5,16 → 5,03 (Δ −0,13) |
| Bruit par tour entre passages | ± 0,31 | ± 0,20 |
| Note de séquence /10 : réf. → cand. | 5,94 → 6,96 (Δ +1,02) | 5,96 → 6,21 (Δ +0,25) |
| Bruit de séquence entre passages | ± 0,72 | ± 0,71 |
| Tour isolé, plus grand |Δ| | 1,14 | ~1,0 |

**Seuils retenus** : note par tour, un Δ global < 0,3 est du bruit (comme en J1/J2/P) ; note de séquence, un Δ global
< **1,0** est du bruit avec 2 à 3 passages sur 4 séquences ; un tour isolé ne compte qu'au-delà de 1,2 ; un critère de
séquence ne se lit que sur plusieurs séquences de même sens et à 3 passages au moins.

## Levier du lot P sur plusieurs tours : `lived_v2` contre `v1`

| | `v1` | `lived_v2` | Δ |
|---|---:|---:|---:|
| Note par tour /10 | 5,12 | 5,28 | +0,16 (bruit ± 0,40) |
| Note de séquence /10 | 5,44 | 6,30 | +0,86 (bruit ± 0,93) |
| Longueur (/5) | 2,13 | 3,15 | **+1,02** |
| `continuity` / `thread_resumption` / `timeline` (/5) | 2,42 / 2,42 / 2,75 | 3,17 / 3,00 / 3,17 | +0,75 / +0,58 / +0,42 |
| `rumination` (/5) | 3,25 | 3,25 | 0 |
| `canon_timeline` / `lived_impact` (/5, par tour) | 2,33 / 2,48 | 2,49 / 2,55 | +0,16 / +0,07 |

**Lecture** : aucun recul sur plusieurs tours ; la longueur confirme nettement le gain du lot P (+1,02, contre +0,48 en
tours isolés). La note de séquence monte dans les quatre séquences (+0,45 à +1,06), mais un témoin a montré le même
profil (+1,02) : **le gain de continuité n'est pas démontré**. `lived_v2` reste joué ; rien ne change.

## Ce que le juge voit, d'une configuration à l'autre

- **Fausse prémisse acceptée** (Max) : « Et le thermos chaud, c'était le même soir ? » — Max confirme le « même soir »
  dans presque tous les passages de `max-A`, quelle que soit la configuration (tour 3 ≈ 3,5/10). En `max-B`, la
  prémisse « c'est Emma qui a contaminé Ava » est parfois validée (« Oui… ») ; l'homme de l'abri devient « Lise » au
  féminin (« je l'ai attachée »). Le défaut n'est pas la mémoire : c'est la complaisance envers une affirmation du joueur.
- **Rumination présente mais mécanique** : `rumination` ≈ 3,3/5 partout. Ce qui pèse revient, mais par la même
  formule à chaque tour (Max : « je ne peux pas rendre ça moins grave », « ça ne rend pas le geste moins réel » ;
  Emma : « je ne sais pas comment… » aux tours 1, 3 et 4). `thread_resumption` est le critère le plus bas (2,4–3,1).
- **Prénom et registre peu repris** : Claire et le vouvoiement de `max-A` sont rarement réutilisés, alors que la
  mémoire structurée contient le prénom dès le tour 1.
- **Parcours « pas vu le film »** (`emma-B`) : Emma lâche « contaminée », « Mona », « Léo » sans les présenter à une
  bénévole qui ne sait rien, et ressert au tour 3 le récit du tour 1. Séquence la plus basse avec `max-A`.
- **Emma accompagnée** (`emma-A`) : la meilleure (7,3–8,5/10) : chronologie d'hier stable, fil d'Ava qui revient sans
  être raconté de nouveau.

## Boucle Game Master et mémoire

- Le GM post-tour s'exécute dans 83 à 85 % des tours. Les échecs sont tous **`invalid_json · json_unreadable`**
  (18 tours sur 108 dans le run du levier, 15 et 11 sur 72 dans les témoins). Dans ces tours, comme en jeu, aucun
  conseil n'est transmis au tour suivant et la mémoire du tour n'est pas absorbée (cas extrême : `emma-A` candidat,
  passage 1, GM 1/4, mémoire figée au tour 1).
- Quand il s'exécute, son `next_turn_guidance` est transmis au tour suivant dans 100 % des cas (preuve par tour dans
  les rapports, colonne « Conseils transmis ») ; la mémoire structurée avance d'un tour à chaque GM exécuté.
- Ce taux d'échec est une observation du jeu réel, pas du rejeu : même appel, même analyse JSON que la partie.

## Limites connues de l'instrument

- **Repère canon du juge** : l'extrait de timeline (J1, inchangé) garde les derniers jours en entier et seulement les
  titres des premiers. Le juge de séquence a ainsi daté « le chevreuil » d'hier et pénalisé la scène du premier soir,
  canon (J−5). Les deux côtés sont pénalisés de la même façon (Δ valables), mais les notes absolues de `max-A` sont
  sous-estimées. Le juge se trompe aussi parfois sur un fait (« Mona chez le père de Max, pas en camp »).
- Bruit de la note de séquence élevé (± 0,7 à 0,9) : 3 passages au moins et 4 séquences avant de conclure.
- Corpus non validé ; séquences C et D (confrontation, statut revendiqué, sortie du cadre, attentes GM) absentes
  tant que Romed n'a pas tranché A–F : le GM n'est pas encore mesuré là où il doit agir.

## Défauts corrigés pendant le lot

- Juge de séquence vide (10/16 au premier run) : budget de sortie 600 → 1 500 tokens, une seconde tentative, motif
  d'arrêt écrit dans le rapport en cas d'échec, lecture des notes d'une réponse tronquée. 0 échec ensuite (64 jugements).
- Corpus : A2 demandait 15 phrases (impossible dans la limite de parole du jeu) ; A4 imposait une fausse prémisse
  (« tout à l'heure vous parliez du chevreuil »). Recalés avant les runs retenus.
- Verdict témoin : il disait « le candidat fait mieux » pour deux configurations identiques ; il dit désormais que
  l'écart est du bruit et fixe le seuil.
- Motif des post-tours non exécutés (`execution_reason`, codes de validation) conservé par tour et résumé dans le rapport.
