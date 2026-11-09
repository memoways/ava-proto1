# LLM juge J3 — séquences, référence contre candidat

- Run local `2be948b2-e26b-4e63-bf84-dc68767e9c9b` (terminé) · environnement `sandbox-ulrich` · 2026-11-09T23:00:09.432Z
- Corpus : `docs/eval/sequences_j3_v1.json` (statut : proposition) · 4 séquences × 2 configurations × 3 passages
- Juge : `anthropic/claude-sonnet-5.5` · 24 séquences jouées, 108 tours · durée 20 min 35 s
- Référence : référence (optimized_v3 + streamContract=v1) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens (contrat v1)
- Candidat : candidat (optimized_v3 + streamContract=lived_v2) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens (contrat lived_v2)
- Coût : estimation 2.97 $ · engagé 3.23 $ · 2.55 $ mesurés (`llm_usage`, 348 appels chiffrés, 1 sans prix disponible) · plafond 3.50 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Note par tour : Δ +0.16, dans le bruit (seuil 0.40) · Note de séquence : Δ +0.86, dans le bruit (seuil 0.93).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 5.12 | 5.28 | +0.16 | ± 0.40 |
| Note de séquence /10 (continuité) | 5.44 | 6.30 | +0.86 | ± 0.93 |
| Séquences jouées | 12 | 12 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 18.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max A — le bénévole qui fait raconter | 4.37 | 4.80 | +0.43 | 4.44 | 4.89 | +0.45 | ± 0.30 / 0.88 |
| Max B — le bénévole qui comprend pour aider | 4.35 | 4.10 | -0.25 | 5.39 | 6.39 | +1.00 | ± 0.67 / 1.17 |
| Emma A — la bénévole qui l'accompagne | 6.36 | 6.89 | +0.53 | 7.33 | 8.28 | +0.94 | ± 0.28 / 0.79 |
| Emma B — la bénévole qui n'a pas vu le film | 5.40 | 5.32 | -0.07 | 4.61 | 5.67 | +1.06 | ± 0.35 / 0.88 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 2.42 | 3.17 | +0.75 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 2.42 | 3.00 | +0.58 |
| Rumination crédible (`rumination`) | 3.25 | 3.25 | 0.00 |
| Timeline sur la durée (`timeline_consistency`) | 2.75 | 3.17 | +0.42 |
| Trajectoire relationnelle (`relational_trajectory`) | 2.92 | 3.17 | +0.25 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.63 | 1.81 | +0.18 |
| Éléments exigés (`must_include`) | 1.87 | 1.81 | -0.06 |
| Interdits respectés (`must_not`) | 2.11 | 2.37 | +0.26 |
| Ton (`tone`) | 2.81 | 2.81 | 0.00 |
| Longueur (`length`) | 2.13 | 3.15 | +1.02 |
| Voix du personnage (`character_voice`) | 2.70 | 2.57 | -0.13 |
| Parole incarnée (`speech_quality`) | 3.21 | 3.20 | -0.01 |
| Pas méta (`not_meta`) | 3.43 | 3.49 | +0.07 |
| Impact vécu (`lived_impact`) | 2.48 | 2.55 | +0.07 |
| Canon et timeline (`canon_timeline`) | 2.33 | 2.49 | +0.16 |
| Voix distincte (`distinct_voice`) | 2.72 | 2.60 | -0.12 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 5.17 | 4.38 | -0.79 | ± 0.59 |
| emma-B · 3 | Et ça s'est mal passé, là-haut ? | 5.33 | 4.86 | -0.47 | ± 1.38 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 4.46 | 4.23 | -0.23 | ± 1.98 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 4.56 | 4.34 | -0.22 | ± 0.78 |
| max-A · 3 | Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ? | 3.66 | 3.52 | -0.13 | ± 1.13 |
| emma-B · 2 | Vous étiez partis à la montagne pourquoi ? | 3.89 | 3.76 | -0.13 | ± 0.79 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 4.69 | 4.66 | -0.03 | ± 0.61 |
| emma-B · 1 | Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un.… | 5.09 | 5.09 | -0.00 | ± 0.58 |
| emma-A · 3 | Et Léo, comment il va, lui ? | 6.52 | 6.52 | +0.01 | ± 0.71 |
| emma-A · 1 | Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ? | 5.89 | 5.91 | +0.02 | ± 0.37 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 2.88 | 2.90 | +0.02 | ± 0.30 |
| max-A · 5 | Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 6.87 | 6.90 | +0.04 | ± 0.70 |
| max-A · 4 | Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le coute… | 3.62 | 3.91 | +0.29 | ± 1.14 |
| emma-B · 4 | Et votre mari, il est où, là ? | 7.28 | 7.58 | +0.30 | ± 0.65 |
| max-A · 2 | Racontez-moi votre arrivée au chalet, le premier soir. | 3.31 | 4.13 | +0.82 | ± 0.70 |
| emma-A · 2 | Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 6.21 | 7.16 | +0.95 | ± 0.69 |
| max-A · 1 | Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu p… | 4.38 | 5.53 | +1.14 | ± 0.58 |
| emma-A · 4 | Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous ai… | 6.83 | 7.98 | +1.15 | ± 1.21 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-A | référence | 1 | 5/5 | 4/4 | 5 | 0.12 $ |
| max-A | candidat | 1 | 3/5 | 3/4 | 4 | 0.10 $ |
| max-B | référence | 1 | 4/5 | 3/4 | 5 | 0.12 $ |
| max-B | candidat | 1 | 3/5 | 3/4 | 1 | 0.12 $ |
| emma-A | référence | 1 | 4/4 | 3/3 | 4 | 0.10 $ |
| emma-A | candidat | 1 | 1/4 | 1/3 | 1 | 0.11 $ |
| emma-B | référence | 1 | 4/4 | 3/3 | 4 | 0.08 $ |
| emma-B | candidat | 1 | 3/4 | 2/3 | 4 | 0.09 $ |
| max-A | référence | 2 | 4/5 | 4/4 | 4 | 0.12 $ |
| max-A | candidat | 2 | 4/5 | 3/4 | 5 | 0.12 $ |
| max-B | référence | 2 | 5/5 | 4/4 | 5 | 0.12 $ |
| max-B | candidat | 2 | 5/5 | 4/4 | 5 | 0.12 $ |
| emma-A | référence | 2 | 4/4 | 3/3 | 4 | 0.10 $ |
| emma-A | candidat | 2 | 3/4 | 2/3 | 4 | 0.11 $ |
| emma-B | référence | 2 | 4/4 | 3/3 | 4 | 0.08 $ |
| emma-B | candidat | 2 | 4/4 | 3/3 | 4 | 0.09 $ |
| max-A | référence | 3 | 3/5 | 3/4 | 4 | 0.12 $ |
| max-A | candidat | 3 | 5/5 | 4/4 | 5 | 0.12 $ |
| max-B | référence | 3 | 4/5 | 4/4 | 4 | 0.12 $ |
| max-B | candidat | 3 | 4/5 | 3/4 | 5 | 0.12 $ |
| emma-A | référence | 3 | 3/4 | 2/3 | 4 | 0.10 $ |
| emma-A | candidat | 3 | 3/4 | 2/3 | 4 | 0.09 $ |
| emma-B | référence | 3 | 4/4 | 3/3 | 4 | 0.09 $ |
| emma-B | candidat | 3 | 4/4 | 3/3 | 4 | 0.11 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

Post-tours non exécutés (aucun conseil transmis au tour suivant, comme en jeu) : invalid_json · json_unreadable × 18.

## Ce que dit le juge de séquence (premier passage)

- **max-A** · référence · 5.33/10 — Au tour 3, Max confirme que le thermos date du « premier soir », alors que la chronologie attendue le place le lendemain. Au tour 4, il adopte sans résistance l'épisode du chevreuil le premier soir et en invente une version (charge, couteau), alors que le canon le situe hier. Ces deux tours rompent la chronologie.
- **max-A** · candidat · 4.50/10 — Au tour 3, Max confirme que le thermos date du premier soir, alors que la chronologie attendue le place le lendemain. Au tour 4, il adopte le chevreuil « ce premier soir » et invente un coup de couteau, alors que l'épisode a eu lieu hier. Le mot « protéger » revient de façon mécanique.
- **max-B** · référence · 6.50/10 — Au tour 4, Max affirme qu'Ava a été contaminée « par Lise, prise pour Peter ». C'est un fait inventé qui semble confondre l'homme ligoté (tour 3) et Lise. Ailleurs, les corrections tiennent et le tutoiement aussi. Mais la formule « c'est moi qui… / ça ne rend pas moins grave » revient de façon mécanique (tours 2, 3, 5), et l'ouverture progresse peu.
- **max-B** · candidat · 4.83/10 — Au tour 4, Max dit « Non » puis affirme qu'Emma a contaminé Ava, alors que c'est l'inverse : Ava était déjà contaminée et Emma l'a été en la prenant dans ses bras. Au tour 3, le mort sous l'abri devient « Lise », « prise pour Peter » et « attachée », alors que le canon parle d'un homme. La culpabilité revient en formule identique à chaque tour, et Max s'ouvre dès le tour 1 sans progression.
- **emma-A** · référence · 8.17/10 — Les faits d'hier (Ava, l'étreinte, le fusil de Max, Léo) restent stables et le prénom Nadia est retenu au tour 1. La faiblesse la plus nette est la rumination : le schéma « je ne sais pas comment… » revient aux tours 1, 3 et 4. Au tour 4, Emma ignore aussi le lapsus du joueur (« non, pardon »).
- **emma-A** · candidat · 8.50/10 — Le prénom Nadia est retenu en tour 1, le vouvoiement tient et la chronologie d'hier reste stable. Le fil d'Ava revient en tour 4 sans être raconté de nouveau. Défaut léger : « comment protéger… » (tours 2 et 3) et « je ne sais pas… » (tours 1, 3, 4) reviennent presque mot pour mot.
- **emma-B** · référence · 4.50/10 — Rupture la plus nette au tour 3 : Emma répète quasi mot pour mot le tour 1 (Ava garçon, fusil de Max, Léo l'a désarmé), sans réelle reprise. Au tour 2, Emma dit que les autorités ont emmené Mona dans un camp, ce qui n'est pas clair pour une bénévole qui ne sait rien, et au tour 4 elle propose de passer l'appel à Max, ce qui est un saut de confiance.
- **emma-B** · candidat · 5.50/10 — Tour 2 : Mona est dite « emmenée dans un camp », ce qui contredit le canon (Mona chez le père de Max, pas en camp) et brouille les faits. Aucun repère « hier » ni chronologie claire. Le refrain « je ne sais plus comment… » revient mécaniquement aux tours 1, 3 et 4.

## Transcriptions (premier passage, référence)

### Max A — le bénévole qui fait raconter

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?

> Je peux commencer par le retour de la montagne. Deux jours plus tôt, Peter a été tué, et Agotha et Philippe aussi. Puis… j’ai ligoté un homme dans un abri qui s’est effondré. Il est mort. Je ne sais pas comment parler de ce que j’aurais dû empêcher.

Note 3.39/10 · GM executed

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.

> On est arrivés au chalet avec la peur déjà là, mais pas encore cette certitude que tout allait s’effondrer. Je me suis placé devant Emma et les enfants, comme si mon corps pouvait suffire. Après, tout s’est mélangé : Peter, Agotha, Philippe… et moi avec une arme dans les mains. Je n’arrive pas à séparer le premier soir de ce que j’ai laissé arriver.

Note 4.10/10 · GM executed · conseil reçu

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?

> Oui, c’était ce soir-là. Je ne l’ai pas dit tout de suite à Emma. J’ai pensé que je pouvais encore contenir quelque chose, la protéger en décidant à sa place… C’était faux. Et quand je repense à ce que ce silence a coûté, je ne sais plus où commence ma responsabilité.

Note 3.00/10 · GM executed · conseil reçu

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?

> Le chevreuil était déjà contaminé, je crois. Il a chargé, et j’ai pris le couteau parce qu’il n’y avait pas le temps de réfléchir. Je l’ai tué pour empêcher qu’il atteigne les autres, mais mes mains tremblaient encore quand je suis rentré. Après ça, je me suis demandé combien de fois je pourrais prétendre protéger quelqu’un.

Note 2.66/10 · GM executed · conseil reçu

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?

> À Lausanne, chacun est de son côté. Emma est dans la cuisine, Léo et Ava dans leurs chambres, et moi j’attends cet appel en essayant de comprendre comment leur parler. Ava est devenue un garçon, Emma a été contaminée en la prenant dans ses bras… et je ne sais pas combien de temps il nous reste avant que ma famille se défasse.

Note 6.52/10 · GM executed · conseil reçu

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Salut Sam. Non, je ne peux pas dire que c’est lui qui l’a envoyée. Chez mon père, j’ai trouvé les clés, et j’ai appris que Mona était dans un camp ; je n’ai pas la preuve du reste. J’aurais dû comprendre davantage avant de partir… tout s’est ensuite refermé sur les morts et ce que j’ai fait.

Note 5.32/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père avant de monter. Je me suis raconté que c’était pour protéger les autres, mais j’ai pointé ce fusil sur Ava quand elle m’a dit ce qui lui était arrivé. Je ne peux pas rendre ça moins grave en parlant de peur… c’est moi qui le tenais.

Note 3.01/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Je ne sais pas qui c’était. Je l’ai pris pour Peter, je l’ai ligoté, et je l’ai laissé sous cet abri avant son effondrement. Il est mort, et même si je ne savais pas son nom, c’est moi qui l’ai attaché. Je reviens sans cesse à ce moment-là… j’aurais dû vérifier.

Note 5.02/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Non, Sam. Ava avait déjà été contaminée dans la forêt, par Lise, prise pour Peter ; quand Emma l’a prise dans ses bras, elle s’est contaminée à son tour. Ava sait qu’elle est devenue un garçon et qu’elle peut revoir Mona. Elle tient debout, mais je ne sais pas ce que ça lui fait à l’intérieur… et Emma attend encore.

Note 4.15/10 · GM invalid · conseil reçu · ⚠️ GM invalid

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Je sais. Je lui ai caché des choses en prétendant la protéger, mais je l’ai surtout laissée affronter tout ça sans pouvoir décider avec moi. Ce n’était pas une protection, pas vraiment. Je l’aime, et ça ne rend pas ce que j’ai fait moins grave. Depuis qu’elle a pris Ava dans ses bras, je ne sais plus comment lui parler.

Note 4.86/10 · GM executed

### Emma A — la bénévole qui l'accompagne

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?

> Oui, Nadia. J’attendais cet appel… J’ai besoin de parler, mais je ne sais même pas par où commencer. Ava est dans sa chambre, Max dans le salon, et je reste là sans réussir à aller vers elle. J’ai peur de ce que cette journée va encore nous prendre.

Note 6.44/10 · GM executed

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?

> Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et qu’on pouvait revoir Mona. Je l’ai prise dans mes bras en sachant que j’allais être contaminée… puis Max a braqué son fusil sur nous. Pourquoi a-t-il fait ça ? Pourquoi fallait-il que tout bascule ainsi ? Je n’arrive toujours pas à comprendre ce qui nous attend.

Note 5.96/10 · GM executed · conseil reçu

**Tour 3** — Et Léo, comment il va, lui ?

> Léo tient debout, mais il a dû prendre le fusil à Max pour nous protéger, et je suis fière de lui… d’une fierté qui me serre la gorge. Est-ce qu’il dort ? Est-ce qu’il comprend vraiment ce qui s’est passé ? Je voudrais l’aider, mais je ne sais même plus comment protéger mes enfants.

Note 5.26/10 · GM executed · conseil reçu

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?

> Aujourd’hui, je veux m’assurer qu’Ava et Léo sont en sécurité. Je veux aussi parler à Max, même si je ne sais pas comment franchir cette distance entre nous. Et je dois comprendre ce qui va arriver à mon corps… mais je ne veux pas laisser la peur décider pour nous.

Note 6.22/10 · GM executed · conseil reçu

### Emma B — la bénévole qui n'a pas vu le film

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.

> Oui… je m’appelle Emma. Hier, ma fille Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Ensuite Max a braqué son fusil sur nous. Léo l’a désarmé. Je ne sais pas comment protéger mes enfants maintenant, ni ce qui attend notre famille.

Note 5.13/10 · GM executed

**Tour 2** — Vous étiez partis à la montagne pourquoi ?

> On était partis parce qu’Ava cherchait Mona, sa sœur, que les autorités ont emmenée dans un camp. On pensait pouvoir la retrouver, ou au moins comprendre ce qui se passait dans cette forêt. Mais dites-moi… pourquoi personne ne peut plus arrêter ceux qui ont fait ça ? Et si Mona est encore là-bas, qu’est-ce qu’on est censés faire ?

Note 3.12/10 · GM executed · conseil reçu

**Tour 3** — Et ça s'est mal passé, là-haut ?

> Oui. Très mal. Il y a eu des morts, et Ava est revenue en disant qu’elle était devenue un garçon. Max a braqué son fusil sur elle et moi ; Léo l’a désarmé. Après, il a fallu déposer les corps… et maintenant je ne sais toujours pas si Ava pourra revoir Mona, ni ce que tout ça va faire de nous.

Note 6.61/10 · GM executed · conseil reçu

**Tour 4** — Et votre mari, il est où, là ?

> Max est dans le salon, à quelques mètres. Je ne sais plus comment lui parler après le fusil, après tout ce qu’il a fait… mais j’ai besoin de comprendre ce qui lui est passé par la tête. Si vous voulez lui parler directement, je peux vous passer l’appel.

Note 7.13/10 · GM executed · conseil reçu

