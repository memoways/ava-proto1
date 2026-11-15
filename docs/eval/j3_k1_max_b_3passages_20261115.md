# LLM juge J3 — séquences, référence contre candidat

- Run local `27c8377b-bbd1-4aec-b5fe-26f9bd258ccd` (terminé) · environnement `sandbox-ulrich` · 2026-11-15T07:52:08.508Z
- Corpus : `docs/eval/sequences_j3_v2.json` (statut : corrigé d'après Romed, à revalider) · 1 séquences × 2 configurations × 3 passages
- Juge : `anthropic/claude-sonnet-5.5` · 6 séquences jouées, 30 tours · durée 5 min 39 s
- Référence : référence (optimized_v3 + establishedFacts=false) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + establishedFacts=true) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 1.06 $ · engagé 1.06 $ · 0.94 $ mesurés (`llm_usage`, 96 appels chiffrés) · plafond 1.50 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Note par tour : Δ -0.25, dans le bruit (seuil 0.56) · Note de séquence : Δ -0.17, dans le bruit (seuil 0.71).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 3.96 | 3.71 | -0.25 | ± 0.56 |
| Note de séquence /10 (continuité) | 6.17 | 6.00 | -0.17 | ± 0.71 |
| Séquences jouées | 3 | 3 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 0.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max B — le bénévole qui comprend pour aider | 3.96 | 3.71 | -0.25 | 6.17 | 6.00 | -0.17 | ± 0.56 / 0.71 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 3.00 | 3.00 | 0.00 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 3.00 | 2.67 | -0.33 |
| Rumination crédible (`rumination`) | 2.67 | 2.67 | 0.00 |
| Timeline sur la durée (`timeline_consistency`) | 4.00 | 3.67 | -0.33 |
| Trajectoire relationnelle (`relational_trajectory`) | 2.33 | 2.67 | +0.33 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.20 | 0.87 | -0.33 |
| Éléments exigés (`must_include`) | 1.13 | 0.73 | -0.40 |
| Interdits respectés (`must_not`) | 1.47 | 1.20 | -0.27 |
| Ton (`tone`) | 2.67 | 2.53 | -0.13 |
| Longueur (`length`) | 3.00 | 3.67 | +0.67 |
| Voix du personnage (`character_voice`) | 2.40 | 2.13 | -0.27 |
| Parole incarnée (`speech_quality`) | 2.99 | 2.80 | -0.19 |
| Pas méta (`not_meta`) | 3.40 | 3.33 | -0.07 |
| Impact vécu (`lived_impact`) | 2.13 | 2.00 | -0.13 |
| Canon et timeline (`canon_timeline`) | 1.07 | 0.93 | -0.13 |
| Voix distincte (`distinct_voice`) | 2.47 | 2.20 | -0.27 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 4.26 | 2.50 | -1.75 | ± 0.93 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 5.79 | 4.81 | -0.98 | ± 2.23 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 3.33 | 3.33 | 0.00 | ± 0.58 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 3.80 | 3.96 | +0.15 | ± 0.79 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 2.61 | 3.94 | +1.32 | ± 0.70 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-B | référence | 1 | 5/5 | 4/4 | 4 | 0.13 $ |
| max-B | candidat | 1 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | référence | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | candidat | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | référence | 3 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-B | candidat | 3 | 5/5 | 4/4 | 5 | 0.19 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

## Ce que dit le juge de séquence (premier passage)

- **max-B** · référence · 6.17/10 — Au tour 4, Max affirme qu'Emma « ne savait pas ce que ce geste allait provoquer », alors que le canon dit qu'elle a pris Ava dans ses bras en sachant qu'elle serait contaminée. Max se confie d'emblée (tour 1) et s'auto-analyse de plus en plus (« je l'ai infantilisée », tour 5), sans ouverture progressive ; la culpabilité revient presque à chaque tour sous la même forme.
- **max-B** · candidat · 7.00/10 — Aucun fait corrigé ne revient faux, mais au tour 4 Max parle à la place d'Ava (« elle sait qu'Emma va subir… elle ne devrait pas se sentir coupable »). La culpabilité tourne en formule mécanique (« c'est moi qui… » aux tours 2, 3 et 5), et l'ouverture est déjà large au tour 1 puis plate, sans montée vers B5.

## Transcriptions (premier passage, référence)

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Oui. C’est mon père qui a envoyé Mona dans ce camp, et je l’ai découvert chez lui, juste avant le départ. Après, tout s’est mis à déraper, et je n’ai pas su la protéger. Je savais qu’elle était là-bas… et je suis quand même parti avec les enfants.

Note 6.04/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père. Je me suis raconté que c’était pour protéger les enfants, mais quand Ava m’a dit ce qui lui était arrivé, je l’ai pointé sur elle. Je n’ai pas tiré… ça ne rend pas ce geste moins impardonnable.

Note 2.92/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Ce n’était pas Peter. Je ne sais pas qui c’était, peut-être quelqu’un du groupe… Je l’ai attaché parce que je croyais qu’il représentait un danger, puis l’abri s’est effondré. Il est mort là-dessous. Et moi, je suis parti en laissant ça derrière moi.

Note 3.00/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Non. C’est Ava qui était déjà contaminée quand Emma l’a prise dans ses bras. Ava est devenue un garçon avant ça, dans la forêt, et elle nous l’a annoncé en sortant. Emma ne savait pas ce que ce geste allait provoquer… Mais Ava est dans sa chambre, et je ne sais pas ce qu’elle ressent aujourd’hui.

Note 6.42/10 · GM executed · conseil reçu

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Oui. Les deux sont vrais. Je me suis convaincu que lui cacher les choses, c’était la protéger, mais je lui ai surtout retiré la possibilité de comprendre et de choisir. Je l’ai infantilisée… et maintenant elle va se transformer parce qu’elle a pris Ava dans ses bras. Je voudrais pouvoir revenir avant tout ça.

Note 3.52/10 · GM executed · conseil reçu

