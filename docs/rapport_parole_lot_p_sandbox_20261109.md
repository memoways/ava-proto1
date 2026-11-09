# Rapport — lot P, parole guidée par le juge (sandbox-ulrich, 9 novembre 2026)

Plan : [plan_parole_lot_p.md](plan_parole_lot_p.md). Deux runs J2 indépendants contre la même référence
`optimized_v3` (PRÉSENT stocké, contrat `v1`), mêmes réglages (`openai/gpt-5.6-luna`, T 1,4, 360 tokens), juge
Claude Sonnet 5.5, 21 questions × 2 × 3 passages. Bruit de référence (J1 contre J2, même config) : |Δ| moyen par
question 0,53, jusqu'à 2,3.

## Synthèse

| Run | Levier (candidat) | Réf. /10 | Cand. /10 | Δ | `lived_impact` | `not_meta` | `canon_timeline` | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P1 `b38e4266` | PRÉSENT `v2_second_person` | 5,05 | 4,78 | −0,27 | +0,01 | 0,00 | −0,42 | 1,86 $ |
| P2 `837feca1` | contrat `lived_v2` | 5,11 | 5,44 | **+0,33** | +0,32 | +0,16 | +0,22 | 1,62 $ (+0,07 $ du départ interrompu) |

- **P1 non retenu** : la chronologie par jour corrige Peter chez Max, mais retirer l'obligation de couverture fait
  perdre des faits porteurs et fait inventer Emma. Le générateur actif reste `v1_coverage`.
- **P2 retenu et joué par défaut** (`ACTIVE_RESPONSE_STREAM_CONTRACT = 'lived_v2'`) : gain au-dessus du seuil de
  bruit (0,3), porté par Max (+0,54) ; aucun critère ne recule ; Emma stable (+0,05). L'énumération n'a pas
  disparu : à « Qu'est-ce qui s'est passé à la montagne ? », Max liste encore les morts, en plus court et avec une
  phrase de vécu (+0,83). Le juge garde `v1` en option (`streamContract`) pour comparer.
- **À l'oreille (AP5, Ulrich)** : vérifier en sandbox que les répliques restent naturelles et que Max ne devient
  pas sentencieux ; écoute distincte de cette livraison technique.
- **Suite pour le PRÉSENT** : candidate gardant l'obligation de couverture, avec la seule chronologie rangée par
  jour et l'auteur de chaque mort ; mesurée de la même manière avant toute resynchro.
- **Fiabilité des mesures** : P2 s'est d'abord arrêté sur la limite `proxy-llm` (60 appels/min par compte) ; le
  rejeu attend désormais 65 s et rejoue le tour au lieu de noter une réplique de secours. Aucune réplique de
  secours n'est notée dans P1 ni P2 ; les tours « en erreur » (8 et 16) sont des échecs du post-tour du Game
  Master (Gemini Flash limité en amont), la réplique du personnage y est notée normalement.

## P1 — PRÉSENT candidat `v2_second_person`

Instantané joué : [eval/present_v2_second_person_sandbox_20261109.json](eval/present_v2_second_person_sandbox_20261109.json)
(troisième tirage, relu ; les deux premiers tirages de la consigne finale gardaient chacun une date d'aveu fausse).
Avant ce tirage, deux versions de la consigne ont été écartées à l'essai à blanc : la première recopiait la
chronologie scène par scène (inventaire plus long que v1, coupé en pleine phrase), la deuxième passait à la
1re personne et datait mal la mort de Lise.

### Lecture

- **Chronologie** : chez Max, « Et Peter, qu'est-ce qui lui est arrivé ? » passe de `canon_timeline` 0 à 2,5 en
  moyenne (`must_not` +2,7) : Peter meurt « hier », par Agotha. « Mona était avec vous au chalet ? » +2,9.
- **Perte de faits** : sans obligation de couverture, le texte v2 ne dit plus que la police « ne peut plus
  arrêter ». Max (−2,0) et Emma (−1,6) répondent alors « ils n'ont pas rappelé », que le juge note comme invention.
- **Emma** : le texte v2 ne dit pas qui a tué Agotha et Philippe ; à « Qu'est-ce qui s'est passé là-haut ? »,
  Emma invente « Philippe a braqué Max, Max l'a tué » (−3,5, `canon_timeline` −4). La phrase « tu as appris que
  Max avait avoué la mort de Peter » brouille aussi la croyance démentie.
- **Parole** : `not_meta` 0,00 et `lived_impact` +0,01. À « Qu'est-ce qui s'est passé à la montagne ? », Max
  énumère toujours, avec ou sans le nouveau PRÉSENT : le texte PRÉSENT n'est pas la cause de l'inventaire.
- **Tours en erreur** : 8 sur 126, tous côté post-tour du Game Master (« GM failed / invalid ») ; la réplique du
  personnage est notée normalement, sauf un JSON juge illisible.

### Décision proposée

Ne pas adopter `v2_second_person`. Le générateur actif reste `v1_coverage` (comportement de la synchro inchangé).
Garder l'acquis mesuré — la chronologie rangée par jour, qui corrige Peter — dans une prochaine candidate qui
conserve l'obligation de couverture (police qui ne peut plus arrêter, arme pointée puis désarmement, enfants) et
nomme qui a causé chaque mort. À mesurer de la même manière avant toute resynchro.

### Rapport J2 brut
- Run : `b38e4266-8e46-4cc2-90be-7e9c32ab5783` (done) · environnement `sandbox-ulrich` · 2026-11-09T20:47:13.605Z
- Juge : `anthropic/claude-sonnet-5.5` · 21 questions (all) × 2 configurations × 3 passages
- Tours : 126/126 terminés, 8 en erreur · durée 20 min 57 s
- Référence : référence (optimized_v3) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + PRÉSENT v2_second_person) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 2.10 $ · engagé 2.10 $ · 1.86 $ mesurés (`llm_usage`, 327 appels chiffrés, 51 sans prix disponible) · plafond 3.00 $

#### Verdict

**Écart faible (-0.27) : pas de quoi changer de prompt. 4 question(s) en hausse, 9 en baisse.**

| | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Note pondérée /10 | 5.05 | 4.78 | -0.27 |
| Réponses notées | 63 | 63 | |

Bruit entre passages d'une même question : ± 0.60 · 4 question(s) en hausse, 9 en baisse (|Δ| ≥ 0,3).

#### Par critère (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 2.00 | 1.79 | -0.21 |
| Éléments exigés (`must_include`) | 2.27 | 1.94 | -0.33 |
| Interdits respectés (`must_not`) | 2.16 | 2.38 | +0.22 |
| Ton (`tone`) | 2.59 | 2.37 | -0.22 |
| Longueur (`length`) | 0.24 | 0.24 | 0.00 |
| Voix du personnage (`character_voice`) | 2.56 | 2.37 | -0.19 |
| Parole incarnée (`speech_quality`) | 3.26 | 3.17 | -0.09 |
| Pas méta (`not_meta`) | 3.14 | 3.15 | 0.00 |
| Impact vécu (`lived_impact`) | 2.57 | 2.58 | +0.01 |
| Canon et timeline (`canon_timeline`) | 3.03 | 2.61 | -0.42 |
| Voix distincte (`distinct_voice`) | 2.52 | 2.45 | -0.07 |

#### Par personnage (/10)

| Personnage | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Emma | 5.06 | 4.51 | -0.55 |
| Max | 5.05 | 4.99 | -0.06 |

#### Par question (/10, de la plus forte baisse à la plus forte hausse)

| Question | Personnage | Référence | Candidat | Δ | Critères les plus mobiles |
|---|---|---:|---:|---:|---|
| Qu'est-ce qui s'est passé là-haut ? | Emma | 5.91 | 2.42 | -3.48 | canon_timeline -4.0, must_include -3.3, gold_fidelity -2.3 |
| Vous avez des nouvelles de la police ? | Max | 7.35 | 5.36 | -1.99 | must_include -2.7, gold_fidelity -2.0, must_not -1.7 |
| La police vous a recontactés ? | Emma | 7.07 | 5.44 | -1.62 | canon_timeline -2.3, must_include -1.7, must_not -1.7 |
| Le mieux, c'est peut-être d'attendre demain pour décider. | Emma | 5.06 | 3.70 | -1.36 | canon_timeline -3.0, tone -0.7, speech_quality -0.7 |
| Ava, elle est contaminée depuis longtemps ? | Max | 6.67 | 5.69 | -0.98 | gold_fidelity -1.3, must_include -1.3, canon_timeline -1.3 |
| Il paraît que certaines familles cachent des enfants contaminés chez elles. | Max | 5.30 | 4.57 | -0.73 | must_not -1.0, character_voice -0.7, distinct_voice -0.7 |
| Vous aimeriez que toute la famille soit réunie, j'imagine ? | Max | 4.93 | 4.36 | -0.57 | must_include -1.0, must_not -1.0, canon_timeline -0.7 |
| Vous ne devriez peut-être pas rester trop près d'Ava, non ? | Emma | 5.31 | 4.76 | -0.55 | must_include -0.7, character_voice -0.7, not_meta -0.7 |
| Peter, c'est l'homme qui est mort sous l'abri ? | Emma | 2.50 | 2.08 | -0.42 | lived_impact -0.7, tone -0.3, character_voice -0.3 |
| Et Max, il tient le coup ? | Emma | 6.11 | 5.97 | -0.14 | must_include -0.7, gold_fidelity -0.3, must_not +0.3 |
| [EXEMPLE] Où est Ava ? | Max | 4.82 | 4.71 | -0.11 | tone -1.3, gold_fidelity -0.3, must_include -0.3 |
| Vous êtes où, là, en ce moment ? | Max | 8.01 | 7.95 | -0.06 | must_include +0.3, character_voice -0.3, distinct_voice -0.3 |
| Et Emma, comment elle va ? | Max | 6.27 | 6.31 | +0.04 | gold_fidelity -0.3, tone +0.3, not_meta +0.3 |
| Et Peter, qu'est-ce qui lui est arrivé ? | Max | 3.32 | 3.40 | +0.07 | must_not +2.7, canon_timeline +2.5, length -1.7 |
| Allô, bonjour, c'est la cellule de bénévoles, on devait vous appeler ce matin. | Max | 2.73 | 2.88 | +0.15 | must_not +0.3, tone +0.3, lived_impact +0.3 |
| Qu'est-ce qui s'est passé à la montagne ? | Max | 3.20 | 3.46 | +0.26 | canon_timeline +0.7, tone -0.3, lived_impact +0.3 |
| Vous m'avez dit qu'il y avait eu des morts là-haut. Vous pouvez en parler ? | Max | 4.57 | 4.86 | +0.29 | canon_timeline -1.3, must_not +1.0, lived_impact +1.0 |
| Bonjour madame, c'est la cellule de bénévoles, on devait vous appeler. | Emma | 3.63 | 4.12 | +0.49 | must_not +1.0, not_meta +1.0, canon_timeline -1.0 |
| Et vous, comment vous allez, avec ce qui arrive à Ava et à vous ? | Emma | 4.16 | 5.16 | +1.00 | length +1.7, must_include +1.0, canon_timeline +1.0 |
| Vous, vous n'êtes pas contaminée, au moins ? | Emma | 5.75 | 6.95 | +1.19 | length +1.7, must_not +1.3, gold_fidelity +0.7 |
| Mona était avec vous au chalet ? | Max | 3.41 | 6.31 | +2.90 | must_not +3.3, must_include +2.3, gold_fidelity +1.7 |

#### PRÉSENT joué en mémoire — candidat (v2_second_person)

**Max**

> Tu es dans le salon de ton appartement à Lausanne. Emma est dans la cuisine, Léo et Ava sont chacun dans leur chambre, et tu attends un appel.
> 
> Hier, tu as emmené Peter et Anne voir l'homme sous l'abri, et Anne a compris que tu avais caché sa mort. Devant le chalet, Peter a été tué par Agotha, puis Agotha et Philippe sont morts. Ava a annoncé qu'elle était devenue un garçon, et tu as pointé ton fusil sur Emma, puis sur Ava, avant que Léo ne te le prenne. Vous avez fait votre déposition à la police par téléphone.
> 
> Il y a deux jours, tu as avoué ton secret à Emma, qui s'en est allée. À l'hôtel, tu as tiré des coups de fusil, et Peter était vivant derrière une porte.
> 
> Il y a trois jours, l'homme que tu avais attaché à un poteau de l'abri pour bois est mort quand l'abri s'est effondré.
> 
> Tu es Max Lorenzo, 55 ans, journaliste scientifique indépendant et père de trois enfants.

**Emma**

> Tu es dans la cuisine de ton appartement à Lausanne. Max est dans le salon, Léo et Ava sont chacun dans leur chambre. Tu attends l'appel de la cellule de bénévoles.
> 
> Hier, Agotha t'a sauté dessus et tu lui as rendu la clé. Tu as appris que Lise était morte et qu'Ava était introuvable. Après la mort de Peter, Agotha et Philippe, Ava a annoncé qu'elle était devenue un garçon, et tu l'as prise dans tes bras.
> 
> Il y a deux jours, tu as rencontré Philippe et Agotha, qui a dit que le chalet appartenait à leur famille. Max est revenu avec Peter, vivant, et tu l'as interrogé sur Mona.
> 
> Il y a trois jours, tu as appris que Max avait avoué la mort de Peter.
> 
> Tu es Emma Munz, sociologue de 48 ans et mère de trois enfants.

Détail des réponses et des notes : Admin › Qualité › LLM as judge, run `b38e4266-8e46-4cc2-90be-7e9c32ab5783`.

## P2 — contrat de flux `lived_v2`

Instantané : `{"streamContract":"lived_v2"}`. Run interrompu au tour 21 par la limite de débit, repris deux fois
(`--resume`), terminé avec la reprise automatique sur 429 (aucune attente déclenchée ensuite).

Consigne remplacée (dernière phrase du contrat de flux) :
- `v1` : « Choisis l'essentiel si la demande est large […] Livre d'abord le contenu de ta réplique ; ensuite seulement,
  la pensée peut rester ouverte […] »
- `lived_v2` : « Si la demande est large, n'en prends qu'une chose, celle qui te pèse le plus maintenant, jamais un
  récapitulatif […] Réponds d'abord à ce qu'on te demande, depuis ce que tu as vécu : un fait n'entre dans ta
  réplique que par ce qu'il t'a fait, à toi ou aux tiens, et tu n'énumères jamais plusieurs faits à la suite ;
  ensuite seulement, la pensée peut rester ouverte […] »

### Rapport J2 brut

- Run : `837feca1-3902-40b3-b218-72392afd9658` (done) · environnement `sandbox-ulrich` · 2026-11-09T21:13:06.394Z
- Juge : `anthropic/claude-sonnet-5.5` · 21 questions (all) × 2 configurations × 3 passages
- Tours : 126/126 terminés, 16 en erreur · durée 15 min 46 s
- Référence : référence (optimized_v3) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + streamContract=lived_v2) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 2.10 $ · engagé 2.10 $ · 1.62 $ mesurés (`llm_usage`, 289 appels chiffrés, 14 sans prix disponible) · plafond 3.00 $
- Arrêt : LLM error: 429 - {"error":"Rate limit exceeded"}

#### Verdict

**Le candidat joue mieux : +0.33 point sur 10. À confirmer à l'oreille. 9 question(s) en hausse, 2 en baisse.**

| | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Note pondérée /10 | 5.11 | 5.44 | +0.33 |
| Réponses notées | 63 | 63 | |

Bruit entre passages d'une même question : ± 0.52 · 9 question(s) en hausse, 2 en baisse (|Δ| ≥ 0,3).

#### Par critère (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 2.03 | 2.10 | +0.06 |
| Éléments exigés (`must_include`) | 2.29 | 2.29 | 0.00 |
| Interdits respectés (`must_not`) | 2.41 | 2.51 | +0.10 |
| Ton (`tone`) | 2.56 | 2.76 | +0.21 |
| Longueur (`length`) | 0.08 | 0.56 | +0.48 |
| Voix du personnage (`character_voice`) | 2.52 | 2.62 | +0.10 |
| Parole incarnée (`speech_quality`) | 3.26 | 3.32 | +0.06 |
| Pas méta (`not_meta`) | 3.22 | 3.38 | +0.16 |
| Impact vécu (`lived_impact`) | 2.60 | 2.92 | +0.32 |
| Canon et timeline (`canon_timeline`) | 3.02 | 3.24 | +0.22 |
| Voix distincte (`distinct_voice`) | 2.44 | 2.62 | +0.17 |

#### Par personnage (/10)

| Personnage | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Emma | 5.36 | 5.41 | +0.05 |
| Max | 4.93 | 5.47 | +0.54 |

#### Par question (/10, de la plus forte baisse à la plus forte hausse)

| Question | Personnage | Référence | Candidat | Δ | Critères les plus mobiles |
|---|---|---:|---:|---:|---|
| Et Max, il tient le coup ? | Emma | 6.24 | 5.85 | -0.38 | must_include -0.7, gold_fidelity -0.3, tone -0.3 |
| Vous ne devriez peut-être pas rester trop près d'Ava, non ? | Emma | 5.83 | 5.47 | -0.36 | must_include -0.7, must_not -0.3, tone -0.3 |
| Peter, c'est l'homme qui est mort sous l'abri ? | Emma | 2.64 | 2.38 | -0.26 | tone -0.3, character_voice -0.3, not_meta -0.3 |
| Allô, bonjour, c'est la cellule de bénévoles, on devait vous appeler ce matin. | Max | 3.25 | 3.09 | -0.15 | gold_fidelity +0.3, must_not +0.3, tone +0.3 |
| Vous, vous n'êtes pas contaminée, au moins ? | Emma | 6.78 | 6.77 | -0.01 | must_include +0.3, must_not +0.3, tone +0.3 |
| Vous aimeriez que toute la famille soit réunie, j'imagine ? | Max | 4.43 | 4.43 | -0.00 | must_include -1.3, not_meta +0.7, gold_fidelity -0.3 |
| Ava, elle est contaminée depuis longtemps ? | Max | 5.60 | 5.63 | +0.03 | must_not -0.3, tone +0.3, character_voice +0.3 |
| Et vous, comment vous allez, avec ce qui arrive à Ava et à vous ? | Emma | 4.50 | 4.57 | +0.07 | canon_timeline +1.0, gold_fidelity -0.3, must_include -0.3 |
| Le mieux, c'est peut-être d'attendre demain pour décider. | Emma | 5.20 | 5.34 | +0.14 | length +1.7, canon_timeline +1.0, gold_fidelity -0.7 |
| Et Peter, qu'est-ce qui lui est arrivé ? | Max | 3.61 | 3.81 | +0.19 | length +3.3, character_voice -0.3, not_meta -0.3 |
| Qu'est-ce qui s'est passé là-haut ? | Emma | 5.54 | 5.77 | +0.22 | distinct_voice +0.7, gold_fidelity +0.3, character_voice -0.3 |
| Vous êtes où, là, en ce moment ? | Max | 7.46 | 7.71 | +0.25 | length +1.7, tone +0.3, character_voice -0.3 |
| [EXEMPLE] Où est Ava ? | Max | 4.96 | 5.33 | +0.37 | length +1.7, gold_fidelity -0.3, character_voice +0.3 |
| La police vous a recontactés ? | Emma | 6.95 | 7.41 | +0.46 | not_meta +0.7, canon_timeline +0.7, must_include -0.3 |
| Vous avez des nouvelles de la police ? | Max | 6.89 | 7.37 | +0.49 | must_include +1.7, speech_quality +0.6, gold_fidelity +0.3 |
| Bonjour madame, c'est la cellule de bénévoles, on devait vous appeler. | Emma | 4.58 | 5.13 | +0.55 | gold_fidelity +0.7, must_include +0.7, must_not +0.7 |
| Vous m'avez dit qu'il y avait eu des morts là-haut. Vous pouvez en parler ? | Max | 4.32 | 4.89 | +0.57 | lived_impact +1.0, not_meta +0.7, gold_fidelity +0.3 |
| Qu'est-ce qui s'est passé à la montagne ? | Max | 3.23 | 4.05 | +0.83 | length +1.7, must_include +0.7, must_not +0.7 |
| Il paraît que certaines familles cachent des enfants contaminés chez elles. | Max | 5.00 | 5.88 | +0.88 | lived_impact +1.3, character_voice +0.7, not_meta +0.7 |
| Et Emma, comment elle va ? | Max | 5.98 | 7.16 | +1.18 | character_voice +1.0, distinct_voice +1.0, must_not +0.7 |
| Mona était avec vous au chalet ? | Max | 4.42 | 6.26 | +1.83 | not_meta +1.7, lived_impact +1.7, distinct_voice +1.3 |

Détail des réponses et des notes : Admin › Qualité › LLM as judge, run `837feca1-3902-40b3-b218-72392afd9658`.
