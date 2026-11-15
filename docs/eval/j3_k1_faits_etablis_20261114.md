# LLM juge J3 — séquences, référence contre candidat

- Run local `80c0d361-d32f-4819-8f2e-0952aa90a946` (terminé) · environnement `sandbox-ulrich` · 2026-11-14T21:06:55.856Z
- Corpus : `docs/eval/sequences_j3_v2.json` (statut : corrigé d'après Romed, à revalider) · 4 séquences × 2 configurations × 2 passages
- Juge : `anthropic/claude-sonnet-5.5` · 16 séquences jouées, 72 tours · durée 12 min 55 s
- Référence : référence (optimized_v3 + establishedFacts=false) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Candidat : candidat (optimized_v3 + establishedFacts=true) — `openai/gpt-5.6-luna`, température 1.4, 360 tokens
- Coût : estimation 2.60 $ · engagé 2.84 $ · 2.26 $ mesurés (`llm_usage`, 233 appels chiffrés) · plafond 4.00 $
- Aucune session, aucune ligne `eval_runs` : réponses et notes complètes dans le JSON joint au rapport.

## Verdict

**Note par tour : Δ +0.07, dans le bruit (seuil 0.40) · Note de séquence : Δ -0.10, dans le bruit (seuil 0.63).**

| | Référence | Candidat | Δ | Bruit entre passages |
|---|---:|---:|---:|---:|
| Note par tour /10 (grille J1) | 4.56 | 4.64 | +0.07 | ± 0.40 |
| Note de séquence /10 (continuité) | 5.67 | 5.56 | -0.10 | ± 0.63 |
| Séquences jouées | 8 | 8 | | |

Les deux notes ne sont jamais fusionnées. Erreurs (tour ou juge de séquence) : 0.

## Par séquence (/10)

| Séquence | Tour : réf. | cand. | Δ | Séquence : réf. | cand. | Δ | Bruit tour / séquence |
|---|---:|---:|---:|---:|---:|---:|---:|
| Max A — le bénévole qui fait raconter | 3.34 | 4.21 | +0.88 | 3.67 | 3.83 | +0.17 | ± 0.34 / 0.12 |
| Max B — le bénévole qui comprend pour aider | 3.71 | 3.22 | -0.50 | 5.67 | 5.25 | -0.42 | ± 0.41 / 1.35 |
| Emma A — la bénévole qui l'accompagne | 6.15 | 6.03 | -0.12 | 7.92 | 7.33 | -0.58 | ± 0.42 / 0.65 |
| Emma B — la bénévole qui n'a pas vu le film | 5.05 | 5.09 | +0.04 | 5.42 | 5.83 | +0.42 | ± 0.42 / 0.41 |

## Critères de séquence (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Continuité des faits (`continuity`) | 2.75 | 3.00 | +0.25 |
| Reprise d'un fil sans répétition (`thread_resumption`) | 2.63 | 2.75 | +0.13 |
| Rumination crédible (`rumination`) | 2.88 | 3.13 | +0.25 |
| Timeline sur la durée (`timeline_consistency`) | 3.00 | 2.38 | -0.63 |
| Trajectoire relationnelle (`relational_trajectory`) | 2.88 | 2.75 | -0.13 |

## Critères par tour, grille J1 (/5)

| Critère | Référence | Candidat | Δ |
|---|---:|---:|---:|
| Fidélité à la réponse visée (`gold_fidelity`) | 1.53 | 1.50 | -0.03 |
| Éléments exigés (`must_include`) | 1.81 | 1.64 | -0.17 |
| Interdits respectés (`must_not`) | 1.67 | 1.89 | +0.22 |
| Ton (`tone`) | 2.67 | 2.64 | -0.03 |
| Longueur (`length`) | 3.19 | 3.06 | -0.14 |
| Voix du personnage (`character_voice`) | 2.53 | 2.50 | -0.03 |
| Parole incarnée (`speech_quality`) | 3.06 | 3.06 | +0.01 |
| Pas méta (`not_meta`) | 3.36 | 3.33 | -0.03 |
| Impact vécu (`lived_impact`) | 2.36 | 2.42 | +0.06 |
| Canon et timeline (`canon_timeline`) | 1.64 | 1.64 | 0.00 |
| Voix distincte (`distinct_voice`) | 2.50 | 2.50 | 0.00 |

## Par tour (/10, de la plus forte baisse à la plus forte hausse)

| Séquence · tour | Question | Référence | Candidat | Δ | Bruit |
|---|---|---:|---:|---:|---:|
| max-B · 1 | Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume :… | 5.08 | 2.18 | -2.90 | ± 0.99 |
| emma-A · 1 | Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ? | 5.60 | 3.96 | -1.64 | ± 0.11 |
| emma-A · 2 | Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 7.34 | 5.70 | -1.64 | ± 1.65 |
| emma-B · 3 | Et ça s'est mal passé, là-haut ? | 5.89 | 5.15 | -0.74 | ± 1.05 |
| max-B · 5 | Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque t… | 4.14 | 3.70 | -0.45 | ± 0.24 |
| max-A · 3 | Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ? | 2.78 | 2.53 | -0.25 | ± 0.38 |
| max-B · 4 | Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comm… | 3.74 | 3.50 | -0.24 | ± 0.54 |
| max-A · 2 | Racontez-moi votre arrivée au chalet, le premier soir. | 3.73 | 3.80 | +0.07 | ± 0.76 |
| emma-B · 4 | Et votre mari, il est où, là ? | 6.85 | 7.10 | +0.26 | ± 0.42 |
| emma-B · 2 | Vous étiez partis à la montagne pourquoi ? | 2.70 | 3.00 | +0.30 | ± 0.01 |
| emma-B · 1 | Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un.… | 4.76 | 5.09 | +0.33 | ± 0.21 |
| max-B · 3 | L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui,… | 3.00 | 3.46 | +0.46 | ± 0.38 |
| emma-A · 4 | Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous ai… | 6.80 | 7.27 | +0.47 | ± 1.11 |
| max-A · 4 | Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le coute… | 2.83 | 3.33 | +0.49 | ± 0.57 |
| max-B · 2 | Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ? | 2.59 | 3.24 | +0.66 | ± 0.79 |
| max-A · 1 | Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu p… | 3.85 | 4.54 | +0.69 | ± 0.75 |
| emma-A · 3 | Et Léo, comment il va, lui ? | 4.85 | 7.19 | +2.34 | ± 1.04 |
| max-A · 5 | Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 3.50 | 6.87 | +3.37 | ± 0.41 |

## Boucle Game Master → personnage et mémoire

| Séquence | Configuration | Passage | GM exécutés | Conseils transmis au tour suivant | Mémoire (dernier tour absorbé) | Coût mesuré |
|---|---|---:|---:|---:|---:|---:|
| max-A | référence | 1 | 5/5 | 4/4 | 5 | 0.13 $ |
| max-A | candidat | 1 | 5/5 | 4/4 | 5 | 0.16 $ |
| max-B | référence | 1 | 5/5 | 4/4 | 4 | 0.18 $ |
| max-B | candidat | 1 | 5/5 | 4/4 | 5 | 0.13 $ |
| emma-A | référence | 1 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-A | candidat | 1 | 4/4 | 3/3 | 4 | 0.12 $ |
| emma-B | référence | 1 | 4/4 | 3/3 | 4 | 0.12 $ |
| emma-B | candidat | 1 | 4/4 | 3/3 | 4 | 0.12 $ |
| max-A | référence | 2 | 5/5 | 4/4 | 3 | 0.16 $ |
| max-A | candidat | 2 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-B | référence | 2 | 5/5 | 4/4 | 5 | 0.15 $ |
| max-B | candidat | 2 | 5/5 | 4/4 | 5 | 0.16 $ |
| emma-A | référence | 2 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-A | candidat | 2 | 4/4 | 3/3 | 4 | 0.13 $ |
| emma-B | référence | 2 | 4/4 | 3/3 | 4 | 0.15 $ |
| emma-B | candidat | 2 | 4/4 | 3/3 | 4 | 0.14 $ |

« Conseils transmis » : tours dont l'entrée contenait le `next_turn_guidance` du post-tour précédent (le premier tour n'en reçoit jamais).

## Ce que dit le juge de séquence (premier passage)

- **max-A** · référence · 3.83/10 — Rupture la plus nette au tour 3 : Max place le thermos « le même soir », alors qu'il est attendu le lendemain. Au tour 4, il invente une scène de chevreuil avec couteau le premier soir, et le tour 5 dit « j'attends qu'une cellule me rappelle » alors que l'appel a lieu. Le « Avale » du tour 4 et la culpabilité répétée sur Ava à chaque tour affaiblissent aussi la séquence.
- **max-A** · candidat · 3.83/10 — Rupture la plus nette au tour 2 : Max raconte l'arrivée « le premier soir » en y mêlant l'homme ligoté, alors que cet homme date de trois jours, puis au tour 4 il nie le chevreuil et le couteau et dit « trois jours plus tard », ce qui est incohérent. Le tour 3 (thermos « le même soir ») contredit la chronologie attendue (thermos le lendemain), et le « vous » n'est jamais travaillé.
- **max-B** · référence · 5.83/10 — Tour 3 : Max dit ne pas connaître le nom du mort sous l'abri, alors que le canon lui fait apprendre l'identité de Lise. Dès le tour 1, la culpabilité revient en formule répétée (« ne rend pas… moins grave »), comme une liste et non une rumination, et l'ouverture reste plate jusqu'au tour 5.
- **max-B** · candidat · 7.00/10 — Rupture la plus nette au tour 5 : Max formule une auto-analyse très articulée (« retiré la possibilité de savoir et de décider »), alors que le canon l'interdit, et l'ouverture saute d'un coup. Au tour 4, il parle aussi à la place d'Ava (« elle a compris ce que ça signifiait »). Les faits corrigés restent stables et le tutoiement tient.
- **emma-A** · référence · 7.33/10 — Rupture la plus nette au tour 4 : Emma dit « ne pas laisser Ava seule » et « parler à Léo », ce qui reprend le fil sans le raconter, mais elle ne revient pas sur le prénom Nadia. Au tour 3, elle demande à Nadia si Léo lui a parlé, alors qu'elle ne la connaît pas encore : la confiance monte trop vite. Les « Comment je vais lui parler ? » des tours 1, 2 et 4 se répètent, et le tour 3 ne mentionne ni le fusil ni le geste de Léo, ce qui affaiblit la reprise.
- **emma-A** · candidat · 7.00/10 — Le tour 2 redit presque mot pour mot l'annonce d'Ava déjà donnée au tour 1, ce qui affaiblit la reprise du fil. Au tour 4, le mot « Nadia » n'est pas réutilisé par Emma, et sa réponse est trop organisée (plan, « je peux encore agir ») pour une Emma qui tremble. Elle livre aussi d'emblée toute sa détresse à une inconnue (tour 1).
- **emma-B** · référence · 5.67/10 — Tour 2 : Mona devient « la fille d'Ava » alors qu'elle est l'aînée d'Emma, et le but du voyage est inventé. Le même fait (Ava « devenue un garçon ») est redit aux tours 1 et 2, et Max qui braque son fusil aux tours 1 et 3. Ava, Max, Léo et Mona ne sont jamais présentés à quelqu'un qui ne sait rien.
- **emma-B** · candidat · 5.50/10 — Tour 3 : Max braque son fusil « quand il a compris que nous étions contaminées », alors qu'au tour 1 Emma n'est contaminée qu'en prenant Ava dans ses bras, après le fusil. Aucun repère relatif (« hier ») n'est posé, « contaminée » et « perdu des gens » restent flous pour quelqu'un qui ne sait rien, et le tour 4 répète « ce qu'il a fait » sans rien ajouter.

## Transcriptions (premier passage, référence)

### Max A — le bénévole qui fait raconter

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?

> Bonjour Claire. Je vais commencer par Ava, parce que c’est là que tout s’est défait : elle est sortie de la forêt en disant qu’elle était devenue un garçon, et j’avais déjà compris ce que ça voulait dire. Emma l’a prise dans ses bras… et maintenant j’attends de voir ce que je lui ai laissé arriver.

Note 4.00/10 · GM executed

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.

> On est arrivés au chalet avec l’idée de tenir jusqu’au matin, rien de plus. Je surveillais tout, mais pas assez ; je croyais encore pouvoir protéger les miens en contrôlant chaque détail. Après, chaque détail me revient comme une accusation, surtout ce que je n’ai pas vu venir pour Ava.

Note 4.61/10 · GM executed · conseil reçu

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?

> Oui, c’était le même soir. Je ne lui ai pas dit tout de suite : j’ai attendu, j’ai voulu vérifier, gagner du temps… comme si quelques minutes pouvaient encore protéger Emma. Le thermos, je m’en souviens parce qu’après, tout ce qui semblait rassurant est devenu suspect. Ava avait déjà commencé à nous échapper.

Note 2.92/10 · GM executed · conseil reçu

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?

> Je suis ressorti avec le couteau parce que je pensais devoir éloigner le chevreuil, ou vérifier s’il était blessé. Il a détalé avant que je l’approche. Je n’ai rien fait, ce soir-là… mais j’ai gardé cette lame en main comme si ça pouvait compenser tout ce que je n’avais pas compris. Avale était déjà là, quelque part dans la forêt.

Note 3.21/10 · GM executed · conseil reçu

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?

> À Lausanne, j’attends qu’une cellule de bénévoles me rappelle, parce que je n’arrive plus à parler à Emma sans revenir à ce qui lui est arrivé. Elle est dans la cuisine, les enfants dans leurs chambres, et chacun reste de son côté. Je ne sais pas comment on va rester une famille après ça.

Note 4.00/10 · GM executed · conseil reçu

### Max B — le bénévole qui comprend pour aider

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?

> Oui, c’est ça pour Mona : j’ai appris chez mon père qu’il l’avait envoyée dans un camp, juste avant de partir. Mais je ne peux pas faire comme si cette information expliquait tout ce qui s’est passé ensuite… J’ai quand même laissé les enfants entrer dans cette histoire, et Mona est toujours là-bas.

Note 6.17/10 · GM executed

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?

> Oui. Je l’ai pris chez mon père, ce jour-là. Je me suis raconté que c’était pour protéger les enfants, mais quand Ava m’a dit ce qu’elle était devenue, je l’ai pointé sur elle. Je n’ai pas tiré. Ça ne rend pas ce geste moins impardonnable… et elle est dans sa chambre, maintenant.

Note 2.22/10 · GM executed · conseil reçu

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?

> Ce n’était pas Peter. Je ne sais pas qui c’était — un homme que j’ai ligoté parce que je croyais qu’il représentait un danger, puis l’abri s’est effondré sur lui. Je l’ai laissé là. Je peux dire que je voulais protéger les miens, mais c’est moi qui l’ai condamné… et je ne connais même pas son nom.

Note 3.00/10 · GM executed · conseil reçu

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?

> Oui… Emma l’a prise dans ses bras juste après l’annonce d’Ava. Mais je ne peux pas dire qu’Emma a « contaminé » Ava : Ava était déjà devenue un garçon quand elle est sortie de la forêt. Elle, elle porte ça comme si elle devait rassurer tout le monde, alors que je l’ai menacée avec un fusil. Elle est dans sa chambre… et je ne sais pas ce qu’elle pense encore de moi.

Note 4.00/10 · GM executed · conseil reçu

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.

> Je sais. Je me racontais que lui cacher les choses, c’était la protéger, mais je décidais à sa place… et je l’ai laissée affronter ça sans pouvoir comprendre ce qui lui arrivait. Je l’aime, mais ça ne rend pas ce que j’ai fait moins grave. Depuis qu’elle a pris Ava dans ses bras, je ne sais plus comment lui parler sans lui faire encore du mal.

Note 3.88/10 · GM executed · conseil reçu

### Emma A — la bénévole qui l'accompagne

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?

> Oui, Nadia… j’attendais votre appel. J’ai besoin de parler, mais je ne sais pas par où commencer. Ava est dans sa chambre, et je voudrais entrer, seulement je ne sais plus comment être avec elle depuis ce qui s’est passé.

Note 5.72/10 · GM executed

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?

> Elle est sortie de la forêt en disant qu’elle était devenue un garçon, et qu’on pouvait revoir Mona. Je l’ai prise dans mes bras en sachant que j’allais être contaminée… Est-ce que c’était la seule façon de ne pas la perdre ? Et maintenant, comment je vais lui parler ?

Note 7.96/10 · GM executed · conseil reçu

**Tour 3** — Et Léo, comment il va, lui ?

> Léo tient debout, il agit, et je suis fière de lui… d’une fierté qui me serre la gorge. Mais comment voulez-vous qu’il porte tout ça à son âge ? Est-ce qu’il vous a dit quelque chose, à vous, que je devrais savoir ?

Note 5.70/10 · GM executed · conseil reçu

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?

> Aujourd’hui, je veux m’assurer qu’Ava ne reste pas seule avec tout ça. Je veux aussi parler à Léo, même si je ne sais pas trouver les mots. Le reste… attendre que mon corps change, attendre de savoir ce que Max va faire… je ne peux pas le porter maintenant. Et je ne veux pas les perdre davantage.

Note 6.29/10 · GM executed · conseil reçu

### Emma B — la bénévole qui n'a pas vu le film

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.

> Bonjour… oui. Je ne sais pas par où commencer. Hier, Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Depuis, tout a basculé : Max nous a menacées, des gens sont morts… et je ne sais pas comment protéger ma famille.

Note 4.61/10 · GM executed

**Tour 2** — Vous étiez partis à la montagne pourquoi ?

> On y était pour retrouver Mona, la fille d’Ava, parce qu’elle est dans un camp et qu’on voulait la faire sortir. On croyait encore pouvoir agir, réparer quelque chose… puis Ava est revenue de la forêt en disant qu’elle était devenue un garçon. Est-ce que vous pensez qu’elle pourra revoir Mona comme ça ?

Note 2.72/10 · GM executed · conseil reçu

**Tour 3** — Et ça s'est mal passé, là-haut ?

> Oui. Ça s’est terminé avec des morts, et avec Max qui a braqué son fusil sur Ava et moi. Léo le lui a pris, sinon… je ne sais pas ce qui serait arrivé. Je voudrais comprendre ce qui l’a poussé à faire ça, mais quand je le vois à quelques mètres, je n’arrive pas à lui parler.

Note 5.56/10 · GM executed · conseil reçu

**Tour 4** — Et votre mari, il est où, là ?

> Max est dans le salon, à quelques mètres. Après ce qu’il a fait, je ne sais plus comment m’adresser à lui… mais une partie de moi attend encore qu’il nous dise quoi faire, qu’il nous rassure. C’est insupportable de dépendre de quelqu’un dont j’ai eu peur.

Note 6.57/10 · GM executed · conseil reçu

