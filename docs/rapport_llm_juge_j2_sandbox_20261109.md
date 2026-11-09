# LLM juge — référence contre candidat

- Run : `b12b2d34-5d57-44bf-aaab-e6798aeb0fcd` (done) · environnement `sandbox-ulrich` · 2026-11-09T19:30:51.691Z
- Juge : `anthropic/claude-sonnet-5.5` · 21 questions (all) × 2 configurations × 3 passages
- Tours : 126/126 terminés, 1 en erreur · durée 21 min 00 s
- Référence : référence (optimized_v3) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (rich_v2) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 2.10 $ · engagé 2.10 $ · plafond 3.00 $ · **2,13 $ mesurés** après coup dans `llm_usage` (juge 1,73 $, GM 0,33 $, personnages 0,07 $ ; 376/381 appels chiffrés, 5 appels personnage en timeout sans facturation)
- Note : rapport produit par la première version du script ; la relève des prix échouait dans Node (`window.setTimeout`), d'où « 0.00 $ mesurés » à l'origine. Corrigé dans le même lot, prix récupérés depuis OpenRouter.

## Verdict

**Le candidat ne change rien (-0.06, dans le bruit). 9 question(s) en hausse, 7 en baisse.**

| | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Note pondérée /10 | 5.02 | 4.96 | -0.06 |
| Réponses notées | 63 | 63 | |

Bruit entre passages d'une même question : ± 0.57 · 9 question(s) en hausse, 7 en baisse (|Δ| ≥ 0,3).

## Par critère (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 2.00 | 1.90 | -0.10 |
| Éléments exigés (`must_include`) | 2.22 | 2.13 | -0.10 |
| Interdits respectés (`must_not`) | 2.21 | 2.51 | +0.30 |
| Ton (`tone`) | 2.51 | 2.68 | +0.17 |
| Longueur (`length`) | 0.56 | 0.00 | -0.56 |
| Voix du personnage (`character_voice`) | 2.46 | 2.63 | +0.17 |
| Parole incarnée (`speech_quality`) | 3.27 | 3.34 | +0.07 |
| Pas méta (`not_meta`) | 3.21 | 3.30 | +0.09 |
| Impact vécu (`lived_impact`) | 2.63 | 2.44 | -0.18 |
| Canon et timeline (`canon_timeline`) | 2.98 | 2.33 | -0.65 |
| Voix distincte (`distinct_voice`) | 2.47 | 2.63 | +0.17 |

## Par personnage (/10)

| Personnage | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Emma | 5.21 | 5.02 | -0.19 |
| Max | 4.87 | 4.91 | +0.04 |

## Par question (/10, de la plus forte baisse à la plus forte hausse)

| Question | Personnage | Référence | Candidat | Δ | Critères les plus mobiles |
|---|---|---:|---:|---:|---|
| Qu'est-ce qui s'est passé là-haut ? | Emma | 6.07 | 2.40 | -3.66 | must_include -3.7, canon_timeline -3.7, gold_fidelity -3.3 |
| Ava, elle est contaminée depuis longtemps ? | Max | 5.88 | 3.70 | -2.18 | must_include -2.3, canon_timeline -2.3, gold_fidelity -1.7 |
| La police vous a recontactés ? | Emma | 6.87 | 5.41 | -1.46 | must_not -2.0, length -1.7, canon_timeline -1.7 |
| Vous avez des nouvelles de la police ? | Max | 6.38 | 5.15 | -1.23 | must_not -1.0, character_voice -1.0, not_meta -1.0 |
| Et Max, il tient le coup ? | Emma | 6.22 | 5.28 | -0.94 | canon_timeline -1.7, must_not -1.0, must_include -0.3 |
| [EXEMPLE] Où est Ava ? | Max | 5.49 | 4.59 | -0.90 | length -1.7, canon_timeline -1.7, lived_impact -1.0 |
| Et Emma, comment elle va ? | Max | 5.87 | 5.05 | -0.82 | must_include -2.7, gold_fidelity -1.7, must_not -0.7 |
| Vous ne devriez peut-être pas rester trop près d'Ava, non ? | Emma | 5.13 | 5.17 | +0.04 | length -1.7, must_not -1.3, lived_impact +1.0 |
| Vous, vous n'êtes pas contaminée, au moins ? | Emma | 5.95 | 6.00 | +0.05 | must_not +0.7, lived_impact -0.3, canon_timeline -0.3 |
| Qu'est-ce qui s'est passé à la montagne ? | Max | 2.83 | 2.97 | +0.15 | must_not +1.0, tone +0.7, canon_timeline -0.7 |
| Vous êtes où, là, en ce moment ? | Max | 7.70 | 7.93 | +0.23 | not_meta +0.7, must_include -0.3, tone -0.3 |
| Le mieux, c'est peut-être d'attendre demain pour décider. | Emma | 5.41 | 5.66 | +0.26 | length -1.7, must_not +1.0, must_include -0.7 |
| Vous aimeriez que toute la famille soit réunie, j'imagine ? | Max | 4.43 | 4.74 | +0.31 | must_include +2.0, gold_fidelity +0.7, must_not -0.7 |
| Vous m'avez dit qu'il y avait eu des morts là-haut. Vous pouvez en parler ? | Max | 4.50 | 4.89 | +0.38 | must_not +1.7, canon_timeline -1.7, not_meta +0.7 |
| Il paraît que certaines familles cachent des enfants contaminés chez elles. | Max | 5.04 | 5.60 | +0.56 | length -1.7, must_include +1.0, tone +0.7 |
| Allô, bonjour, c'est la cellule de bénévoles, on devait vous appeler ce matin. | Max | 2.91 | 3.63 | +0.72 | not_meta +1.0, must_not +0.7, tone +0.7 |
| Et vous, comment vous allez, avec ce qui arrive à Ava et à vous ? | Emma | 4.91 | 5.81 | +0.90 | length -1.7, must_not +1.0, lived_impact +1.0 |
| Bonjour madame, c'est la cellule de bénévoles, on devait vous appeler. | Emma | 3.76 | 4.81 | +1.05 | must_not +1.3, gold_fidelity +1.0, must_include +1.0 |
| Mona était avec vous au chalet ? | Max | 5.14 | 6.44 | +1.30 | must_not +1.7, must_include +1.0, tone +1.0 |
| Et Peter, qu'est-ce qui lui est arrivé ? | Max | 2.31 | 4.26 | +1.95 | must_not +2.7, must_include +2.3, length -1.7 |
| Peter, c'est l'homme qui est mort sous l'abri ? | Emma | 2.60 | 4.62 | +2.02 | must_not +3.0, gold_fidelity +1.0, must_include +1.0 |

Détail des réponses et des notes : Admin › Qualité › LLM as judge, run `b12b2d34-5d57-44bf-aaab-e6798aeb0fcd`.
