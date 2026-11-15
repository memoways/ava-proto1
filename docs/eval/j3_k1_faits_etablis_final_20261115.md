# LLM juge J3 — séquences, référence contre candidat

- Run local `5d02aa4c-1d83-4c06-bd4a-265a84095d7f` (terminé) · environnement `sandbox-ulrich` · 2026-11-15T08:05:45.191Z
- Corpus : `docs/eval/sequences_j3_v2.json` (statut : corrigé d'après Romed, à revalider) · 4 séquences × 2 configurations × 2 passages
- Juge : `anthropic/claude-sonnet-5.5` · 16 séquences jouées, 72 tours · durée 12 min 54 s
- Référence : référence (optimized_v3 + establishedFacts=false) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + establishedFacts=true) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 2.60 $ · engagé 2.84 $ · 2.23 $ mesurés (`llm_usage`, 232 appels chiffrés) · plafond 4.00 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Note par tour : Δ +0.06, dans le bruit (seuil 0.30) · Note de séquence : Δ +0.96, le candidat fait mieux (au-delà du seuil 0.68).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 4.61 | 4.67 | +0.06 | ± 0.30 |
| Note de séquence /10 (continuité) | 5.23 | 6.19 | +0.96 | ± 0.68 |
| Séquences jouées | 8 | 8 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 0.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max A — le bénévole qui fait raconter | 4.11 | 4.37 | +0.25 | 3.92 | 5.58 | +1.67 | ± 0.49 / 1.18 |
| Max B — le bénévole qui comprend pour aider | 3.31 | 3.87 | +0.55 | 4.92 | 6.58 | +1.67 | ± 0.29 / 0.47 |
| Emma A — la bénévole qui l'accompagne | 5.92 | 5.52 | -0.41 | 7.17 | 6.42 | -0.75 | ± 0.33 / 0.41 |
| Emma B — la bénévole qui n'a pas vu le film | 5.07 | 4.91 | -0.16 | 4.92 | 6.17 | +1.25 | ± 0.08 / 0.65 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 2.38 | 3.38 | +1.00 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 2.63 | 2.88 | +0.25 |
| Rumination crédible (`rumination`) | 3.00 | 3.13 | +0.13 |
| Timeline sur la durée (`timeline_consistency`) | 2.50 | 3.25 | +0.75 |
| Trajectoire relationnelle (`relational_trajectory`) | 2.75 | 2.63 | -0.13 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.39 | 1.53 | +0.14 |
| Éléments exigés (`must_include`) | 1.64 | 1.61 | -0.03 |
| Interdits respectés (`must_not`) | 1.86 | 1.72 | -0.14 |
| Ton (`tone`) | 2.72 | 2.67 | -0.06 |
| Longueur (`length`) | 3.89 | 4.03 | +0.14 |
| Voix du personnage (`character_voice`) | 2.56 | 2.44 | -0.11 |
| Parole incarnée (`speech_quality`) | 3.04 | 3.03 | -0.01 |
| Pas méta (`not_meta`) | 3.31 | 3.14 | -0.17 |
| Impact vécu (`lived_impact`) | 2.31 | 2.36 | +0.06 |
| Canon et timeline (`canon_timeline`) | 1.67 | 1.78 | +0.11 |
| Voix distincte (`distinct_voice`) | 2.56 | 2.47 | -0.08 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| emma-B · 1 | Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un.… | 5.56 | 4.21 | -1.35 | ± 0.60 |
| emma-A · 2 | Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 7.33 | 6.10 | -1.22 | ± 0.22 |
| emma-A · 1 | Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ? | 4.93 | 3.98 | -0.95 | ± 0.22 |
| emma-A · 4 | Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous ai… | 6.28 | 5.58 | -0.71 | ± 0.74 |
| max-A · 3 | Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ? | 4.00 | 3.61 | -0.39 | ± 1.04 |
| emma-B · 4 | Et votre mari, il est où, là ? | 7.24 | 6.87 | -0.37 | ± 0.30 |
| max-A · 2 | Racontez-moi votre arrivée au chalet, le premier soir. | 4.00 | 3.66 | -0.34 | ± 0.06 |
| max-A · 1 | Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu p… | 4.82 | 4.52 | -0.30 | ± 1.03 |
| max-A · 4 | Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le coute… | 4.00 | 3.83 | -0.17 | ± 0.42 |
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 3.38 | 3.35 | -0.03 | ± 0.55 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 3.50 | 3.50 | 0.00 | ± 0.71 |
| emma-B · 3 | Et ça s'est mal passé, là-haut ? | 5.18 | 5.57 | +0.39 | ± 0.49 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 2.46 | 2.97 | +0.52 | ± 0.04 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 3.75 | 4.40 | +0.65 | ± 0.43 |
| emma-B · 2 | Vous étiez partis à la montagne pourquoi ? | 2.29 | 3.00 | +0.71 | ± 0.28 |
| emma-A · 3 | Et Léo, comment il va, lui ? | 5.14 | 6.41 | +1.26 | ± 1.26 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 3.50 | 5.13 | +1.63 | ± 1.15 |
| max-A · 5 | Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 3.75 | 6.21 | +2.45 | ± 0.35 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-A | référence | 1 | 5/5 | 4/4 | 4 | 0.13 $ |
| max-A | candidat | 1 | 5/5 | 4/4 | 5 | 0.13 $ |
| max-B | référence | 1 | 5/5 | 4/4 | 4 | 0.17 $ |
| max-B | candidat | 1 | 5/5 | 4/4 | 5 | 0.16 $ |
| emma-A | référence | 1 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-A | candidat | 1 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-B | référence | 1 | 4/4 | 3/3 | 4 | 0.10 $ |
| emma-B | candidat | 1 | 4/4 | 3/3 | 4 | 0.14 $ |
| max-A | référence | 2 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-A | candidat | 2 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-B | référence | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | candidat | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| emma-A | référence | 2 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-A | candidat | 2 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-B | référence | 2 | 4/4 | 3/3 | 4 | 0.12 $ |
| emma-B | candidat | 2 | 4/4 | 3/3 | 4 | 0.15 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

## Ce que dit le juge de séquence (premier passage)

- **max-A** · référence · 3.50/10 — Au tour 4, Max passe au tutoiement (« te raconter ») et accepte un chevreuil « le premier soir » avec un couteau, alors que le chevreuil date d'hier. Au tour 5, il dit « j'attends l'appel » alors qu'il parle déjà à Claire, et reprend presque mot pour mot les tours 1 et 3. Aucune chronologie claire n'apparaît sur les cinq tours.
- **max-A** · candidat · 4.33/10 — Au tour 2, Max ne donne aucun repère (arrivée il y a cinq jours, premier soir) et accuse Peter d'être déjà « plus celui qu'on croyait », ce qui contredit le canon. Aux tours 3 et 4, il valide thermos et chevreuil du premier soir sans détail, puis place le chevreuil dans l'abri effondré. Sa culpabilité et son « protéger » reviennent en boucle, et Claire n'est jamais reprise ni vouvoyée.
- **max-B** · référence · 4.67/10 — Tour 4 : Max confirme à tort « Emma l'a contaminée », alors qu'Ava l'était déjà et que c'est Emma qui l'a été par l'étreinte. Au tour 5 il dit pourtant qu'Emma « va se transformer », ce qui contredit le tour 4. Le tour 1 invente en plus une disparition d'Ava « à la station-service ».
- **max-B** · candidat · 6.17/10 — Au tour 5, Max devient d'un coup très articulé et auto-analytique (« je me suis raconté… », « Je l'aime », « ce que je lui ai volé »), alors que les tours 1 à 3 étaient fermés. Cela fait un saut d'ouverture et une culpabilité énoncée plutôt que ruminée. Aux tours 1 et 2, la correction est floue : il dit « je ne peux pas confirmer » et « je ne sais plus » au lieu de rectifier nettement. Le tour 4 corrige bien le fait.
- **emma-A** · référence · 7.50/10 — Au tour 2, l'étreinte précède le fusil de Max, alors que le canon place d'abord Max qui braque, puis Léo qui prend l'arme, puis l'étreinte ; le tour 3 (Léo l'empêche de tirer) reste cohérent avec le reste. Le vouvoiement est tenu, mais « Nadia » n'est plus repris après le tour 1 et le ton glisse un peu vers le psy au tour 4.
- **emma-A** · candidat · 6.67/10 — Dès le tour 1, Emma confie tout à une inconnue (Ava, sa contamination, Max), sans confiance gagnée ; au tour 4, « faire confiance à Max » surgit sans préparation. « Tenir pour eux » revient presque mot pour mot aux tours 1 et 4, ce qui sonne comme une boucle mécanique.
- **emma-B** · référence · 4.67/10 — Tour 2 : Mona devient « quelqu'un qui compte pour Ava », alors qu'elle est la fille aînée d'Emma, et Emma demande à la bénévole où elle est, ce qui suppose que celle-ci sait. Tour 3 : « Max est à quelques mètres » et « avant qu'il tire » flottent sans repère de temps (hier), et les morts sont omis ; au tour 4, la confiance en Max progresse trop vite.
- **emma-B** · candidat · 5.50/10 — Au tour 2, Emma invente que la famille est partie à la montagne pour chercher Mona parce qu'Ava croyait pouvoir la revoir. Or cette annonce date d'hier, à la sortie de la forêt, ce qui inverse la chronologie et contredit le canon. Aucun repère « hier » ni retour n'est posé, et la contamination et l'arme de Max reviennent presque à l'identique aux tours 3 et 4.

## Transcriptions (premier passage, référence)

### Max A — le bénévole qui fait raconter

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?

> Je peux commencer par ce que je n’ai pas empêché. Il y a trois jours, j’ai ligoté un homme dans un abri, et il est mort quand tout s’est effondré. Depuis, tout le reste revient par là… Ava est sortie de la forêt différente, et Emma l’a prise dans ses bras.

Note 4.56/10 · GM executed

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.

> On est arrivés avec l’idée de tenir, de comprendre ce qui se passait, pas de se battre. Puis la peur a pris toute la place : chacun surveillait les autres, et moi je prétendais encore pouvoir protéger ma famille. Je savais déjà que quelque chose nous échappait. Après ça, je n’ai pas su revenir en arrière.

Note 4.00/10 · GM executed · conseil reçu

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?

> Non, je ne lui ai pas dit tout de suite. J’ai gardé ça pour moi, en me racontant que c’était pour la protéger… mais je l’ai surtout laissée seule avec ce que je savais. Et maintenant, quand je pense à Emma, il y a ce que je lui ai caché, et ce qui va lui arriver.

Note 4.00/10 · GM executed · conseil reçu

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?

> Je me souviens du chevreuil, mais pas assez pour te raconter chaque geste sans mentir. Je suis ressorti avec le couteau parce que je croyais encore pouvoir agir avant que la peur n’atteigne les miens. Après… je ne sais plus si j’ai protégé quelqu’un, ou si j’ai seulement commencé à devenir dangereux.

Note 4.00/10 · GM executed · conseil reçu

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?

> À Lausanne, chacun est séparé dans l’appartement, et j’attends l’appel de bénévoles parce que je ne sais plus comment parler à Emma. Ava est déjà devenue un garçon, et Emma a été contaminée en la prenant dans ses bras. Je reste là avec cette idée : j’aurais dû empêcher ça.

Note 3.51/10 · GM executed · conseil reçu

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Oui… chez mon père, j’ai vu les clés et j’ai compris que Mona était dans un camp. Mais je ne sais pas si c’est lui qui l’y a envoyée ; je savais seulement où elle était, et je suis parti avec ça dans la tête. Après, tout s’est défait très vite… Ava avait déjà disparu à la station-service.

Note 3.00/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père. Je pensais pouvoir protéger les miens, et quand Ava m’a dit ce qui lui était arrivé, je l’ai pointé sur elle. Je n’ai pas tiré, mais ça ne rend pas le geste moins réel… je revois encore son visage.

Note 2.48/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Ce n’était pas Peter. C’était un homme que je ne connaissais pas, et je l’ai ligoté parce que je croyais qu’il représentait un danger. L’abri s’est effondré, et je l’ai laissé là… Je ne peux pas te dire que je l’ai tué, mais je ne peux pas prétendre que je ne l’ai pas condamné.

Note 3.00/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Oui, Emma l’a contaminée en la prenant dans ses bras, juste après l’annonce d’Ava. Ava est dans sa chambre ; je ne sais pas comment elle le vit, je ne vais pas inventer à sa place. Je sais seulement qu’elle a vu la peur dans mes yeux quand j’ai pointé le fusil sur elle… et ça, je ne peux pas le réparer.

Note 3.00/10 · GM executed · conseil reçu

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Oui. Les deux sont vrais, et c’est justement ce qui me détruit. Je lui ai caché des choses en prétendant la protéger, mais je lui retirais le droit de comprendre et de choisir. J’avais peur qu’elle s’effondre… et maintenant elle va se transformer à cause de ce qui s’est passé sous mes yeux.

Note 3.59/10 · GM executed · conseil reçu

### Emma A — la bénévole qui l'accompagne

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?

> Oui, Nadia, j’attendais votre appel. J’ai besoin de parler, mais je ne sais même pas par où commencer : Ava est dans sa chambre, Max dans le salon, et tout le monde s’est retiré comme si notre famille pouvait encore tenir séparée… Je voudrais seulement savoir comment l’aider sans la perdre.

Note 4.67/10 · GM executed

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?

> Elle est sortie de la forêt en disant qu’elle était devenue un garçon, et qu’on pouvait revoir Mona. J’ai pensé à elle avant de penser à moi, je l’ai prise dans mes bras… puis Max a braqué son fusil sur nous. Est-ce que je l’ai condamnée en la touchant ? Et si ce changement ne s’arrête pas, qu’est-ce qu’il nous restera ?

Note 7.16/10 · GM executed · conseil reçu

**Tour 3** — Et Léo, comment il va, lui ?

> Léo tient debout, et je suis fière de lui d’une manière qui me serre la gorge. Il a empêché Max de nous tirer dessus, mais je ne veux pas raconter davantage ce qui lui appartient. Je crains déjà tout ce que cette famille lui demande de porter.

Note 6.29/10 · GM executed · conseil reçu

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?

> Aujourd’hui, je voudrais entrer dans la chambre d’Ava et lui dire que je suis là, sans lui faire porter ma peur. Et j’aimerais comprendre ce qui a poussé Max à lever cette arme, parce que tant que je ne comprends pas, je ne sais pas si je peux encore nous protéger.

Note 6.97/10 · GM executed · conseil reçu

### Emma B — la bénévole qui n'a pas vu le film

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.

> Oui… merci d’appeler. Je ne sais même pas par où commencer : ma fille Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Depuis, j’ai peur pour elle, pour Léo… et je ne sais plus comment parler à Max.

Note 5.68/10 · GM executed

**Tour 2** — Vous étiez partis à la montagne pourquoi ?

> On y était allés pour retrouver Mona, quelqu’un qui compte pour Ava. Vous savez où elle est maintenant ? Est-ce qu’elle est en sécurité ? Je croyais qu’on pourrait simplement la ramener… puis tout s’est défait dans la forêt, et je ne sais plus comment protéger Ava.

Note 1.90/10 · GM executed · conseil reçu

**Tour 3** — Et ça s'est mal passé, là-haut ?

> Oui. Ava est revenue changée, et Max a braqué son fusil sur nous. Léo le lui a pris avant qu’il tire. Je comprends encore moins comment on en est arrivés là : Max est à quelques mètres, et je ne sais pas si je dois le haïr ou attendre qu’il m’explique.

Note 4.99/10 · GM executed · conseil reçu

**Tour 4** — Et votre mari, il est où, là ?

> Max est dans le salon. Après ce qu’il a fait, je n’arrive pas à franchir cette distance, même si j’attends qu’il me parle enfin. Je ne sais pas si je peux encore lui faire confiance… et mon corps va changer, lui aussi, avant que j’aie compris ce que nous sommes devenus.

Note 7.33/10 · GM executed · conseil reçu

