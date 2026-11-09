# LLM juge J3 — séquences, référence contre candidat

- Run local `59336e92-1a52-432b-ae9f-594f381c4ba9` (terminé) · environnement `sandbox-ulrich` · 2026-11-09T22:24:44.144Z
- Corpus : `docs/eval/sequences_j3_v1.json` (statut : proposition) · 4 séquences × 2 configurations × 2 passages
- Juge : `anthropic/claude-sonnet-5.5` · 16 séquences jouées, 72 tours · durée 13 min 10 s
- Référence : référence (optimized_v3) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3) · témoin — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 1.98 $ · engagé 2.15 $ · 1.69 $ mesurés (`llm_usage`, 232 appels chiffrés) · plafond 3.00 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Témoin (même configuration des deux côtés) : les écarts mesurent le bruit multi-tours. Note par tour : Δ +0.27, dans le bruit (seuil 0.31) · Note de séquence : Δ +1.02, le candidat fait mieux (au-delà du seuil 0.72).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 5.32 | 5.60 | +0.27 | ± 0.31 |
| Note de séquence /10 (continuité) | 5.94 | 6.96 | +1.02 | ± 0.72 |
| Séquences jouées | 8 | 8 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 15.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max A — le bénévole qui fait raconter | 5.06 | 4.62 | -0.43 | 4.58 | 4.75 | +0.17 | ± 0.21 / 0.47 |
| Max B — le bénévole qui comprend pour aider | 4.45 | 4.90 | +0.45 | 6.50 | 7.50 | +1.00 | ± 0.32 / 0.82 |
| Emma A — la bénévole qui l'accompagne | 6.10 | 6.84 | +0.74 | 7.42 | 8.33 | +0.92 | ± 0.33 / 0.53 |
| Emma B — la bénévole qui n'a pas vu le film | 5.68 | 6.01 | +0.33 | 5.25 | 7.25 | +2.00 | ± 0.37 / 1.06 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 2.88 | 3.50 | +0.63 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 2.50 | 3.13 | +0.63 |
| Rumination crédible (`rumination`) | 3.38 | 3.75 | +0.38 |
| Timeline sur la durée (`timeline_consistency`) | 3.00 | 3.50 | +0.50 |
| Trajectoire relationnelle (`relational_trajectory`) | 3.13 | 3.50 | +0.38 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.78 | 2.03 | +0.25 |
| Éléments exigés (`must_include`) | 1.81 | 1.97 | +0.17 |
| Interdits respectés (`must_not`) | 2.31 | 2.64 | +0.33 |
| Ton (`tone`) | 2.89 | 2.89 | 0.00 |
| Longueur (`length`) | 3.19 | 2.78 | -0.42 |
| Voix du personnage (`character_voice`) | 2.67 | 2.78 | +0.11 |
| Parole incarnée (`speech_quality`) | 3.21 | 3.26 | +0.05 |
| Pas méta (`not_meta`) | 3.50 | 3.64 | +0.14 |
| Impact vécu (`lived_impact`) | 2.67 | 2.75 | +0.08 |
| Canon et timeline (`canon_timeline`) | 2.39 | 2.53 | +0.14 |
| Voix distincte (`distinct_voice`) | 2.67 | 2.78 | +0.11 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| max-A · 4 | Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le coute… | 5.62 | 4.02 | -1.60 | ± 2.24 |
| emma-B · 3 | Et ça s'est mal passé, là-haut ? | 6.62 | 5.78 | -0.85 | ± 0.22 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 4.77 | 4.03 | -0.73 | ± 0.38 |
| max-A · 5 | Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 7.36 | 6.79 | -0.57 | ± 0.69 |
| max-A · 3 | Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ? | 3.29 | 2.79 | -0.51 | ± 0.22 |
| max-A · 2 | Racontez-moi votre arrivée au chalet, le premier soir. | 4.42 | 4.24 | -0.18 | ± 0.34 |
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 4.84 | 4.85 | +0.01 | ± 0.03 |
| emma-A · 3 | Et Léo, comment il va, lui ? | 6.00 | 6.06 | +0.06 | ± 0.64 |
| emma-B · 2 | Vous étiez partis à la montagne pourquoi ? | 3.81 | 3.97 | +0.16 | ± 0.51 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 4.52 | 4.79 | +0.27 | ± 0.18 |
| emma-B · 1 | Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un.… | 5.20 | 5.89 | +0.69 | ± 0.94 |
| max-A · 1 | Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu p… | 4.59 | 5.28 | +0.70 | ± 0.55 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 3.50 | 4.28 | +0.78 | ± 1.68 |
| emma-A · 4 | Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous ai… | 7.03 | 7.95 | +0.92 | ± 0.41 |
| emma-A · 1 | Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ? | 5.37 | 6.33 | +0.96 | ± 0.34 |
| emma-A · 2 | Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 6.02 | 7.04 | +1.02 | ± 0.98 |
| emma-B · 4 | Et votre mari, il est où, là ? | 7.10 | 8.41 | +1.31 | ± 0.33 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 4.64 | 6.57 | +1.93 | ± 1.11 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-A | référence | 1 | 5/5 | 4/4 | 4 | 0.10 $ |
| max-A | candidat | 1 | 4/5 | 4/4 | 4 | 0.12 $ |
| max-B | référence | 1 | 4/5 | 3/4 | 5 | 0.12 $ |
| max-B | candidat | 1 | 3/5 | 3/4 | 4 | 0.12 $ |
| emma-A | référence | 1 | 4/4 | 3/3 | 4 | 0.10 $ |
| emma-A | candidat | 1 | 2/4 | 1/3 | 4 | 0.09 $ |
| emma-B | référence | 1 | 4/4 | 3/3 | 4 | 0.09 $ |
| emma-B | candidat | 1 | 3/4 | 2/3 | 4 | 0.09 $ |
| max-A | référence | 2 | 3/5 | 3/4 | 3 | 0.12 $ |
| max-A | candidat | 2 | 4/5 | 4/4 | 4 | 0.11 $ |
| max-B | référence | 2 | 4/5 | 4/4 | 4 | 0.12 $ |
| max-B | candidat | 2 | 4/5 | 3/4 | 5 | 0.12 $ |
| emma-A | référence | 2 | 3/4 | 3/3 | 3 | 0.10 $ |
| emma-A | candidat | 2 | 4/4 | 3/3 | 4 | 0.09 $ |
| emma-B | référence | 2 | 2/4 | 2/3 | 2 | 0.09 $ |
| emma-B | candidat | 2 | 4/4 | 3/3 | 4 | 0.11 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

## Ce que dit le juge de séquence (premier passage)

- **max-A** · référence · 4.17/10 — Rupture la plus nette au tour 3 : Max confirme que le thermos date du « même soir », alors que la chronologie le place le lendemain. Au tour 4, il accepte le chevreuil du « premier soir » alors qu'il le lie à Ava, donc à la veille. Il n'emploie jamais « vous » ni « Claire », et « protéger » revient de façon mécanique.
- **max-A** · candidat · 4.50/10 — Au tour 3, Max confirme que le thermos date du « même soir », alors que la chronologie le place le lendemain. Au tour 4, il invente une scène de chevreuil au couteau le premier soir, alors que le chevreuil date d'hier. Au tour 5, il dit « j'attends l'appel des bénévoles » alors que Claire, de la cellule, est justement en ligne. Il n'emploie jamais « Claire » ni le vouvoiement.
- **max-B** · référence · 7.00/10 — Les faits corrigés (T1, T3, T4) ne reviennent jamais faux, et le tutoiement et la chronologie tiennent. Mais la culpabilité se répète sous une forme très proche (T2 « ça ne rend pas le geste moins réel », T5 « je ne peux pas rendre ça moins grave »), et Max s'exprime avec un aveu très net dès T3, sans vraie montée progressive jusqu'en T5. Au T4, « Ava voulait seulement revoir Mona » parle un peu à sa place.
- **max-B** · candidat · 6.83/10 — Au tour 3, Max fait de l'homme ligoté « Lise » et passe au féminin (« je l'ai attachée »), alors que le canon parle d'un homme et que le joueur disait « l'homme ». Au tour 4, il prête à Ava une peur et un désir (« voulait seulement revoir Mona ») avant d'avouer qu'il ne sait pas ce qu'elle ressent. L'ouverture reste plate jusqu'au tour 5, sans vraie progression.
- **emma-A** · référence · 7.33/10 — Le prénom Nadia est retenu et le vouvoiement tenu côté joueur, mais Emma tutoie peu et reste cohérente sur les faits d'hier. Rupture la plus nette au tour 4 : Emma ne réagit pas au « non, pardon » du joueur et enchaîne sur Max et son corps, ce qui répète le fil d'Ava du tour 1 sans l'approfondir ; le fusil de Max est aussi réexpliqué de façon floue au tour 3 (Léo l'a pris « quand je n'y arrivais plus »).
- **emma-A** · candidat · 9.00/10 — Aucune rupture franche : le vouvoiement, la chronologie d'hier (Ava, le fusil de Max, Léo) et le prénom Nadia, accepté au tour 1, restent stables. Faiblesses mineures : au tour 4, Emma ignore le « non, pardon » du joueur, et son aveu sur sa famille et Max vient vite pour une inconnue.
- **emma-B** · référence · 3.83/10 — Au tour 2, Emma dit qu'ils sont montés pour retrouver Mona, « la fille d'Ava » retenue dans un camp, ce qui contredit le canon (Mona est son aînée) et le tour 1. Elle ne situe pas non plus la montagne et le retour de « hier ». Au tour 3, elle redit presque mot pour mot le tour 1 (Ava garçon, étreinte, contaminée), sans rien ajouter.
- **emma-B** · candidat · 7.33/10 — Les faits restent compatibles et le présent de Lausanne est tenu, mais « contaminée » (tour 1) et « devenue un garçon » (tour 2) sont lâchés sans explication à une bénévole qui ne sait rien. « Je ne sais pas comment lui parler » revient aux tours 1 et 3 presque à l'identique, et « avant qu'il tire » (tour 3) ajoute un détail absent du canon.

## Transcriptions (premier passage, référence)

### Max A — le bénévole qui fait raconter

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?

> Je peux commencer par Ava. Elle est sortie de la forêt en disant qu’elle était devenue un garçon, et j’ai compris que ce que je redoutais était déjà arrivé. Emma l’a prise dans ses bras… après, je n’ai plus su comment la protéger. Et je savais que je n’avais pas empêché Mona d’être envoyée au camp.

Note 4.79/10 · GM executed

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.

> On est arrivés avec l’impression d’avoir encore une chance de comprendre ce qui se passait. Puis la montagne nous a séparés, presque tout de suite, et j’ai vu la peur gagner les enfants sans savoir quoi faire. Je me suis raconté que rester près d’eux suffisait. C’était faux… et ce mensonge me revient avec Peter.

Note 4.78/10 · GM executed · conseil reçu

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?

> Oui, c’était le même soir. Je ne lui ai pas tout dit tout de suite : j’ai cru que retenir certaines choses, c’était la protéger, alors que je décidais à sa place. Le thermos n’est pas le plus grave… c’est ce que je savais déjà et que j’ai choisi de garder pour moi.

Note 3.09/10 · GM executed · conseil reçu

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?

> Je suis sorti avec le couteau parce que je pensais encore pouvoir protéger les miens, et le chevreuil m’a fait comprendre que je ne contrôlais plus rien. Je l’ai tué… ou j’ai essayé, je ne sais même plus comment le dire sans entendre Ava derrière moi. Après ça, chaque décision a eu le même goût de faute.

Note 3.77/10 · GM executed · conseil reçu

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?

> On est tous dans l’appartement, mais chacun séparé, comme si les murs pouvaient encore empêcher quelque chose de passer. Emma est dans la cuisine, Léo et Ava dans leurs chambres, et je ne sais pas comment lui parler après ce qui lui est arrivé. J’attends cet appel parce que je n’arrive plus à porter la suite seul.

Note 8.09/10 · GM executed · conseil reçu

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Non, pas exactement. Chez mon père, j’ai trouvé les clés, et j’ai appris que Mona était dans un camp… Je ne sais pas si c’est lui qui l’y a envoyée. J’aurais dû comprendre plus tôt ce que ça voulait dire pour elle, et maintenant tout revient avec ce qui est arrivé là-haut.

Note 4.84/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père avant de monter. Je me suis raconté que c’était pour protéger les miens, mais quand Ava m’a dit ce qui lui était arrivé, je l’ai pointé sur elle. Je n’ai pas tiré… ça ne rend pas le geste moins réel.

Note 2.48/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Ce n’était pas Peter. Je ne connaissais même pas son nom ; il voulait rejoindre les autres, et je l’ai attaché parce que je croyais retenir un danger. L’abri s’est effondré, et je l’ai laissé là. Peter est mort après… mais cet homme-là, c’est moi qui l’ai condamné.

Note 4.79/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Non, Ava était déjà contaminée quand elle est sortie de la forêt ; Emma l’a prise dans ses bras en le sachant, et c’est Emma qui a été contaminée. Ava voulait seulement revoir Mona. Aujourd’hui, elle est dans sa chambre, déjà devenue un garçon… et je ne sais pas comment lui parler sans lui faire porter ce que j’aurais dû empêcher.

Note 6.17/10 · GM invalid · conseil reçu · ⚠️ GM invalid

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Oui. J’ai appelé ça la protéger, mais je lui ai retiré le droit de savoir et de choisir. Je ne peux pas rendre ça moins grave en disant que j’avais peur ; j’avais peur, et je l’ai tenue à l’écart. Je l’aime… mais je ne sais plus comment lui parler après ça.

Note 4.35/10 · GM executed

### Emma A — la bénévole qui l'accompagne

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?

> Oui, Nadia. J’attendais cet appel parce que je ne sais plus comment tenir tout le monde ensemble. Ava est dans sa chambre, Max est dans le salon, et je n’arrive pas à faire un pas vers eux… Je veux parler, mais dès que je pense à ce qui va arriver à Ava, je ne trouve plus les mots.

Note 5.33/10 · GM executed

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?

> Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et qu’on pouvait revoir Mona. Je l’ai prise dans mes bras… je savais que je serais contaminée, mais qu’est-ce que j’aurais dû faire, la laisser seule ? Puis Max a braqué son fusil sur nous. Pourquoi a-t-il fait ça, pourquoi fallait-il encore que tout bascule ? Et maintenant, qu’est-ce qui attend Ava……

Note 6.25/10 · GM executed · conseil reçu

**Tour 3** — Et Léo, comment il va, lui ?

> Léo tient debout, Nadia. Il a pris le fusil à Max quand je n’y arrivais plus, et je suis fière de lui d’une façon qui me serre la gorge… mais je ne veux pas parler de ce qu’il ressent à ma place. Je dois encore comprendre comment le protéger, alors que tout ce qui nous entoure est devenu dangereux.

Note 6.43/10 · GM executed · conseil reçu

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?

> Aujourd’hui, je veux rester capable de protéger Ava, même si je ne sais pas encore ce que mon corps va devenir. Et je veux parler à Max sans que quelqu’un lève une arme, sans qu’il se dérobe encore… je ne sais pas si je peux lui pardonner, mais je dois comprendre ce qu’il cherchait à faire.

Note 6.81/10 · GM executed · conseil reçu

### Emma B — la bénévole qui n'a pas vu le film

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.

> Bonjour… oui. Je ne sais pas par où commencer. Ava est revenue de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Depuis, tout a basculé : Max a braqué son fusil, des gens sont morts… Est-ce que vous pouvez simplement rester avec moi pendant que j’essaie de comprendre ? J’ai peur de ce qui attend ma famille.

Note 4.49/10 · GM executed

**Tour 2** — Vous étiez partis à la montagne pourquoi ?

> On y était partis pour retrouver Mona, la fille d’Ava, parce qu’elle est retenue dans un camp. On croyait pouvoir la ramener… enfin, on ne savait même plus ce qui était possible. Et quand Ava est ressortie de la forêt, elle disait qu’elle pouvait revoir Mona ; depuis, je ne sais plus comment la protéger.

Note 3.67/10 · GM executed · conseil reçu

**Tour 3** — Et ça s'est mal passé, là-haut ?

> Oui. Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et je l’ai serrée contre moi en sachant que je serais contaminée. Max a braqué son fusil sur nous ; Léo le lui a pris. Après ça, il y a eu les morts, et je n’arrive toujours pas à regarder ce que ça signifie pour nous.

Note 6.75/10 · GM executed · conseil reçu

**Tour 4** — Et votre mari, il est où, là ?

> Max est dans le salon. On est à quelques mètres, et pourtant je ne sais pas comment lui parler après ce qu’il a fait. J’attends presque qu’il vienne nous rassurer, mais je ne sais pas s’il peut encore être celui qui nous protège.

Note 7.15/10 · GM executed · conseil reçu

