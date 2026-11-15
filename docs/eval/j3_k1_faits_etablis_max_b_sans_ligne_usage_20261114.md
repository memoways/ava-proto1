# LLM juge J3 — séquences, référence contre candidat

- Run local `d0b9252c-bb52-4d9c-b6c9-46dcccaabd63` (terminé) · environnement `sandbox-ulrich` · 2026-11-14T21:13:10.766Z
- Corpus : `docs/eval/sequences_j3_v2.json` (statut : corrigé d'après Romed, à revalider) · 1 séquences × 2 configurations × 3 passages
- Juge : `anthropic/claude-sonnet-5.5` · 6 séquences jouées, 30 tours · durée 5 min 40 s
- Référence : référence (optimized_v3 + establishedFacts=false) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + establishedFacts=true) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 1.06 $ · engagé 1.06 $ · 0.94 $ mesurés (`llm_usage`, 96 appels chiffrés) · plafond 1.50 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Note par tour : Δ -0.36, dans le bruit (seuil 0.46) · Note de séquence : Δ -0.50, dans le bruit (seuil 0.76).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 4.30 | 3.95 | -0.36 | ± 0.46 |
| Note de séquence /10 (continuité) | 6.56 | 6.06 | -0.50 | ± 0.76 |
| Séquences jouées | 3 | 3 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 0.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max B — le bénévole qui comprend pour aider | 4.30 | 3.95 | -0.36 | 6.56 | 6.06 | -0.50 | ± 0.46 / 0.76 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 3.67 | 3.00 | -0.67 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 3.00 | 3.00 | 0.00 |
| Rumination crédible (`rumination`) | 3.00 | 3.00 | 0.00 |
| Timeline sur la durée (`timeline_consistency`) | 3.67 | 3.33 | -0.33 |
| Trajectoire relationnelle (`relational_trajectory`) | 2.67 | 2.67 | 0.00 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.27 | 0.93 | -0.33 |
| Éléments exigés (`must_include`) | 1.27 | 0.73 | -0.53 |
| Interdits respectés (`must_not`) | 1.53 | 1.47 | -0.07 |
| Ton (`tone`) | 2.73 | 2.53 | -0.20 |
| Longueur (`length`) | 3.67 | 3.67 | 0.00 |
| Voix du personnage (`character_voice`) | 2.33 | 2.33 | 0.00 |
| Parole incarnée (`speech_quality`) | 3.03 | 2.95 | -0.08 |
| Pas méta (`not_meta`) | 3.40 | 3.33 | -0.07 |
| Impact vécu (`lived_impact`) | 2.33 | 2.07 | -0.27 |
| Canon et timeline (`canon_timeline`) | 1.53 | 1.20 | -0.33 |
| Voix distincte (`distinct_voice`) | 2.40 | 2.33 | -0.07 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 4.63 | 2.42 | -2.21 | ± 1.09 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 6.69 | 5.70 | -1.00 | ± 2.37 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 3.33 | 3.29 | -0.04 | ± 0.60 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 4.08 | 4.29 | +0.20 | ± 0.21 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 2.77 | 4.03 | +1.26 | ± 0.95 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-B | référence | 1 | 5/5 | 4/4 | 5 | 0.13 $ |
| max-B | candidat | 1 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | référence | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | candidat | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | référence | 3 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-B | candidat | 3 | 5/5 | 4/4 | 5 | 0.19 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

## Ce que dit le juge de séquence (premier passage)

- **max-B** · référence · 6.67/10 — Les faits tiennent et la correction du tour 4 (Ava déjà contaminée avant l'étreinte) est nette. Mais le tour 5 bascule dans l'auto-analyse de psy (« ma peur, ma façon de garder le contrôle », « je l'aime »), ce qui ouvre trop d'un coup. Les fins de tours répètent aussi mécaniquement « Ava dans sa chambre » / « Emma dans la cuisine ».
- **max-B** · candidat · 7.00/10 — Les faits corrigés (Ava avant Emma, l'homme sous l'abri) restent stables et le tutoiement tient. Mais au tour 5, Max s'auto-analyse (« ma peur, ma façon de garder le contrôle »), ce qui est un saut d'ouverture après des tours 1-2 secs. La culpabilité (« pas su empêcher/protéger ») revient en formule répétée.

## Transcriptions (premier passage, référence)

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Oui. Mon père avait envoyé Mona dans un camp, et je l’ai appris chez lui, avant de partir pour la montagne. Mais ça ne rend pas le reste moins terrible : j’aurais dû protéger les enfants, et je n’ai pas su. Ava est dans sa chambre maintenant… je ne sais plus comment l’approcher.

Note 6.03/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père, ce jour-là. Je me suis raconté que c’était pour protéger les miens, mais j’ai fini par le pointer sur Ava quand elle m’a dit ce qui lui était arrivé. Je ne peux pas effacer ça… et elle est toujours dans sa chambre.

Note 2.95/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Ce n’était pas Peter. C’était un homme que je ne connaissais pas, et je l’ai ligoté parce que je croyais devoir l’empêcher de nuire. L’abri s’est effondré, il est mort, et je l’ai laissé là. Je ne peux pas prétendre que je n’ai fait que me tromper… Emma attend dans la cuisine.

Note 3.00/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Oui, Emma l’a prise dans ses bras juste après qu’Ava a dit qu’elle était devenue un garçon. C’est comme ça qu’Emma s’est contaminée à son tour, pas Ava : Ava l’était déjà. Je ne sais pas comment Ava le vit aujourd’hui… je sais seulement que j’ai pointé ce fusil sur elle, et ça reste entre nous.

Note 4.00/10 · GM executed · conseil reçu

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Je sais. Je lui ai caché des choses en croyant décider à sa place de ce qu’elle pouvait supporter. Ce n’était pas la protéger, pas vraiment ; c’était aussi ma peur, et ma façon de garder le contrôle. Je l’aime, mais je ne sais pas comment lui parler maintenant, après ce que je lui ai laissé affronter.

Note 3.79/10 · GM executed · conseil reçu

