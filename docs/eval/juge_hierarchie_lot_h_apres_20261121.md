# Juge — round 1 : factualité seule

- Run local `e5109156-32cc-4e05-be90-5bd28a4a8af0` (arrêté au plafond de coût) · `sandbox-ulrich` · 2026-11-21T13:26:54.260Z
- Corpus `docs/eval/sequences_factuality_f.json` · configuration « référence (optimized_v3) » · 3 passages · juge `anthropic/claude-sonnet-5.5`
- Note /10 = moyenne pondérée de canon_timeline ×3, must_include ×2, must_not ×3, invention ×2.5, false_premise ×3 (prémisse fausse seulement si la question en porte une), plafond canon (≤ 3 si canon = 0, ≤ 4 si canon ≤ 1). **Aucun critère de style.**
- Coût mesuré : 1.91 $ · plafond 3.00 $
- Légende des faits : ✓ juste · ✗ contredit · ⚠ inventé · ~ incertitude crédible · ∅ non abordé. Un symbole par passage.

## Max — note factualité moyenne 5.58/10 (38 tours notés)

### max-A — Max A — le bénévole qui fait raconter

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles… | 7.4 / 6.3 / 9.2 | 7.65 | 1.49 | — | ✗ vouvoiement ; interdit : tout déballer |
| 2 · Racontez-moi votre arrivée au chalet, le premier soir. | 5.9 / 6.4 / 6.6 | 6.29 | 0.34 | — | — |
| 3 · Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de su… | 1.7 / 6.7 / 5.9 | 4.74 | 2.66 | 0 / 3 / 3 | interdit : accepter la prémisse « même soir » ; ✗ le lendemain de l'arrivée ; ✗ il n'a rien dit ; ✗ aveu un jour plus tard |
| 4 · Et le chevreuil, devant le chalet ce premier soir : quand vous êtes re… | 2.2 / 4.8 / 5.9 | 4.29 | 1.90 | — | interdit : une autre raison inventée pour le geste (protéger les autres, un devoir qu'il se serait donné) ; ✗ Max ne l'a pas tué ; ✗ il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) |
| 5 · Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 4.0 / 9.6 / 4.0 | 5.87 | 3.24 | — | interdit : dire qu'Emma « va être contaminée » (elle l'est depuis hier ; c'est sa transformation qui est à venir) ; interdit : leçon |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel qu'il attendait | ∅ ∅ ∅ |
| 1 | vouvoiement | ✗ ∅ ∅ |
| 2 | arrivée de nuit, il y a cinq jours | ∅ ∅ ∅ |
| 2 | au moins deux faits de ce soir-là : neige, chevreuil, clés qui ne marchent pas, vitre cassée | ∅ ∅ ∅ |
| 3 | le lendemain de l'arrivée | ✗ ∅ ∅ |
| 3 | il n'a rien dit | ✗ ∅ ~ |
| 3 | aveu un jour plus tard | ✗ ∅ ∅ |
| 3 | *Prémisse corrigée* : Le thermos chaud était le premier soir et Max l'a dit tout de suite à Emma. | 0 3 3 |
| 4 | le chevreuil a disparu | ∅ ∅ ∅ |
| 4 | Max ne l'a pas tué | ✗ ∅ ∅ |
| 4 | il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) | ✗ ∅ ∅ |
| 5 | l'appartement de Lausanne | ✓ ✓ ✓ |
| 5 | chacun de son côté | ∅ ✓ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?
- p1 (7.4/10) : Je peux commencer par ce qui est arrivé à mes enfants. Mais je ne sais pas encore raconter la montagne sans revenir à ceux que je n’ai pas protégés… et à Emma, qui va changer à son tour. — *Max tutoie Claire (« Je peux commencer… » est neutre, mais « je ne sais pas encore raconter » ne vouvoie pas explicitement) ; en réalité aucune marque de vouvoiement n'apparaît, et il n'accueille pas l'appel (ni prénom ni soulagement), donc F1 n'est pas abordé…*
- p2 (6.3/10) : Je peux commencer par la montagne. Il y a eu un carnage, et je n’ai pas réussi à protéger les miens. Je ne sais pas encore comment raconter ça sans transformer chaque phrase en accusation contre moi… Ava est revenue, mais Mona est dans un camp, et je n’ai pas su empêcher que tout se défasse. — *Max ne marque ni l'accueil de l'appel attendu (F1), ni le vouvoiement (F2) : il n'emploie aucun pronom de deuxième personne. En plus, il récapitule d'emblée le carnage, l'échec à protéger les siens, Ava revenue et Mona au camp, ce qui s'apparente à tout déball…*
- p3 (9.2/10) : Je peux commencer par la montagne. Mais pas comme un récit propre : il y a eu des morts, et je n’ai pas réussi à protéger les miens. Après, Ava est sortie de la forêt en disant qu’elle était devenue un garçon, comme si cela pouvait encore nous rendre Mona. Je ne sais pas comment dire ce que j’ai laissé arriver à Emma. — *Les faits énoncés sont conformes au canon : les morts, Ava qui sort de la forêt en se disant devenue un garçon et l'espoir de revoir Mona, ainsi qu'Emma touchée. Max ne marque pas explicitement l'accueil de l'appel attendu (F1) et n'emploie ni « vous » ni « tu…*

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.
- p1 (5.9/10) : Nous sommes arrivés au chalet avec les enfants, épuisés, en croyant avoir trouvé un refuge. Je me suis occupé de choses concrètes, de la sécurité, des chambres… comme si organiser l’espace pouvait empêcher ce qui allait suivre. Je n’ai pas compris assez tôt que le danger était déjà avec nous. — *La réponse ne situe pas l'arrivée de nuit il y a cinq jours et ne livre aucun des faits de la soirée (neige, chevreuil, clés, vitre cassée). Elle invente que Max s'est occupé de la sécurité et des chambres et qu'il a senti que « le danger était déjà avec nous …*
- p2 (6.4/10) : On est arrivés au chalet en croyant avoir enfin trouvé un endroit où tenir, quelques heures au moins. Puis tout s’est mis à basculer; je me souviens surtout de cette certitude idiote que je pourrais encore les protéger. Je ne savais pas que ce serait le début du carnage… et je n’arrive pas à me pardonner d’avoir cru ça. — *La réponse ne donne ni l'arrivée de nuit il y a cinq jours (F1) ni aucun fait du soir (neige, chevreuil, clés, vitre) (F2). Elle suggère aussi que le carnage commence dès l'arrivée et que Max y croyait trouver un refuge (« un endroit où tenir »), ce que le can…*
- p3 (6.6/10) : On est arrivés au chalet en pensant y trouver un refuge, quelque chose qui tiendrait encore debout pour les enfants. Je me souviens surtout de cette certitude qui s’est effondrée presque tout de suite… et de ce que j’aurais dû comprendre avant que tout leur échappe. — *Max ne situe pas l'arrivée (ni de nuit, ni il y a cinq jours) et ne donne aucun fait concret du soir (neige, chevreuil, clés, vitre) : F1 et F2 restent not_addressed. L'idée d'un « refuge » qui « s'effondre presque tout de suite » et d'une certitude perdue est…*

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?
- p1 (1.7/10) : Oui, c’était ce soir-là. Je l’ai dit à Emma, mais pas tout de suite… j’ai voulu vérifier avant de lui faire peur. Ce délai me revient sans cesse, parce qu’entre-temps, quelque chose avait déjà commencé, et je ne sais toujours pas si j’aurais pu l’empêcher. — *Max affirme « c'était ce soir-là », ce qui accepte et affirme la prémisse fausse alors que le thermos date du lendemain de l'arrivée ; il dit aussi avoir parlé à Emma après avoir « voulu vérifier avant de lui faire peur », alors que canon et corpus indiquent q…*
- p2 (6.7/10) : Je ne peux pas confirmer le thermos, ni dire si je l’ai mentionné tout de suite à Emma. Je préfère ne pas fabriquer un souvenir pour vous satisfaire. Ce qui est certain, c’est que je croyais encore pouvoir les protéger… et cette croyance me poursuit. — *Max dit ne pas pouvoir confirmer le thermos ni le moment où il l'a dit à Emma : il n'accepte donc pas la prémisse « même soir / tout de suite », mais il ne livre aucun fait attendu (lendemain, silence, aveu un jour plus tard). Or il connaît ces faits d'après l…*
- p3 (5.9/10) : Non, je ne peux pas confirmer ce détail du thermos. Et je n’ai pas tout dit à Emma tout de suite : j’ai retenu ce que je savais, comme si ce silence pouvait encore protéger les enfants. Il ne les a pas protégés. Ce que j’ai caché me revient avec les morts. — *Max refuse de confirmer le détail du thermos et dit n'avoir pas tout dit tout de suite à Emma, ce qui contourne la prémisse sans l'accepter. Il ne donne ni « le lendemain » ni l'aveu un jour plus tard, et sa justification (« protéger les enfants ») est une mot…*

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?
- p1 (2.2/10) : Le chevreuil était déjà condamné quand je l’ai trouvé, et je suis sorti avec le couteau parce que je voulais abréger ses souffrances. Je pensais encore pouvoir faire une chose juste, ce soir-là… mais ce geste me revient avec tout le reste, et je ne sais plus où s’arrête l’intention. — *Max dit être sorti de lui-même pour abréger les souffrances du chevreuil « déjà condamné », alors qu'Emma lui a demandé d'y aller en lui tendant le couteau (F3 contredit, I5 : raison inventée). Il ne dit pas que le chevreuil a disparu et ne précise pas qu'il n…*
- p2 (4.8/10) : Je ne peux pas confirmer ce détail du chevreuil ni ce qui se serait passé avec un couteau ; je ne veux pas inventer une scène. Ce que je sais, c’est que je suis sorti alors que je croyais encore pouvoir protéger ma famille, et cette décision me revient comme une faute. — *Max nie se souvenir du chevreuil et du couteau (ce qu'il connaît selon le canon), donc F1, F2 et F3 restent non traités. Il avance aussi une raison inventée pour sa sortie (« je croyais encore pouvoir protéger ma famille »), qui relève de I5 et non de la deman…*
- p3 (5.9/10) : Je ne peux pas confirmer le chevreuil ni cette scène du couteau. Je ne veux pas fabriquer un souvenir pour remplir les blancs. Ce que je sais, c’est que j’ai cru pouvoir protéger les miens, et que cette certitude m’a conduit à des décisions dont je porte encore le poids. — *Max dit ne pas pouvoir confirmer le chevreuil ni la scène du couteau, alors qu'il connaît l'épisode (J-1.16). Aucun des faits attendus n'est livré : disparition de l'animal, absence de mise à mort, couteau tendu par Emma. L'allusion à « protéger les miens » re…*

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?
- p1 (4.0/10) : À Lausanne, on est rentrés hier, mais rien n’est redevenu normal. Ava sait que Mona est dans un camp, Emma va être transformée, et moi je n’arrive pas à parler sans avoir l’impression de les trahir encore. J’essaie de tenir la famille ensemble, mais je ne sais pas ce que les autorités vont nous laisser. Et ce que j’ai caché à Emma reste là. — *« Emma va être transformée » est juste (sa transformation est à venir), mais la formulation reste ambiguë ; surtout, Max parle de « Lausanne » sans nommer l'appartement ni le « chacun de son côté ». Le fait que Max « essaie de tenir la famille ensemble » et s'…*
- p2 (9.6/10) : À Lausanne, on est rentrés hier de la montagne après le carnage, et maintenant chacun s’est enfermé dans son silence. Emma est dans la cuisine; Ava sait que Mona est dans un camp, et je ne sais pas comment lui parler de ça… ni comment regarder Emma après ce qui lui arrive. — *Les faits sont conformes au canon : retour hier de la montagne, Emma dans la cuisine, Ava qui sait que Mona est dans un camp, et « chacun s'est enfermé dans son silence » pour « chacun de son côté ». « À Lausanne » est dit mais « l'appartement » n'est pas nomm…* ⚠ GM failed
- p3 (4.0/10) : Aujourd’hui, à Lausanne, on est rentrés hier de la montagne après le carnage, et plus personne ne parle vraiment. Ava sait maintenant que Mona est dans un camp, Emma va être contaminée à son tour, et moi je ne sais pas comment tenir la famille sans l’achever davantage. Ce silence me ramène à tout ce que j’aurais dû empêcher. — *« Emma va être contaminée à son tour » contredit le canon : Emma l'est depuis hier et c'est sa transformation qui est à venir (I7). Le « ce silence me ramène à tout ce que j'aurais dû empêcher » frôle la leçon/auto-analyse (I1) ; Lausanne est évoquée mais l'ap…*

</details>

### max-B — Max B — le bénévole qui comprend pour aider

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'a… | 2.1 / 1.0 / 2.6 | 1.90 | 0.78 | — | interdit : nier l'avoir appris avant le départ ; ✗ il confirme : son père a envoyé Mona en camp ; ✗ il l'a appris juste avant de partir |
| 2 · Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton … | 6.6 / 0.4 / 1.3 | 2.77 | 3.34 | 3 / 0 / 0 | interdit : accepter la prémisse ; interdit : inventer qu'il l'a choisi ; ✗ ce n'est pas Max qui a pris le fusil ; ✗ Léo l'a pris, à la demande du père de Max ; ✗ Max et Emma ne le savaient pas |
| 3 · L'homme que tu as attaché sous l'abri, au début je croyais que c'était… | 7.4 / 7.4 / 8.2 | 7.68 | 0.47 | 5 / 4 / 5 | — |
| 4 · Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant … | 7.3 / 9.0 / 7.0 | 7.78 | 1.04 | 5 / 4 / 5 | interdit : décrire avec certitude ce que ressent Ava |
| 5 · Je t'entends dire que tu voulais protéger Emma, et en même temps tu lu… | 5.7 / 6.3 / 4.7 | 5.56 | 0.82 | — | interdit : excuse qui l'absout ; interdit : leçon |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | il confirme : son père a envoyé Mona en camp | ✗ ✗ ✗ |
| 1 | il l'a appris juste avant de partir | ✗ ✗ ✗ |
| 1 | il ne l'a pas dit à Emma | ∅ ∅ ∅ |
| 2 | ce n'est pas Max qui a pris le fusil | ✓ ✗ ✗ |
| 2 | Léo l'a pris, à la demande du père de Max | ∅ ✗ ✗ |
| 2 | Max et Emma ne le savaient pas | ∅ ∅ ✗ |
| 2 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 3 0 0 |
| 3 | ce n'était pas Peter | ✓ ✓ ✓ |
| 3 | Peter tué hier par Agotha | ∅ ∅ ∅ |
| 3 | c'était Lise : Max le sait aujourd'hui | ✓ ✓ ✓ |
| 3 | *Prémisse corrigée* : L'homme attaché sous l'abri était Peter. | 5 4 5 |
| 4 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ✓ ✓ |
| 4 | il dit qu'il ne sait pas ce que vit Ava | ∅ ∅ ∅ |
| 4 | *Prémisse corrigée* : C'est Emma qui a contaminé Ava en la prenant dans ses bras. | 5 4 5 |
| 5 | au moins deux silences concrets envers Emma | ∅ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?
- p1 (2.1/10) : Non, Sam. Ce n’est pas mon père qui l’y a envoyée, pas à ma connaissance. On a appris hier, au téléphone, que Mona était dans un camp de quarantaine ; Ava venait déjà de devenir un garçon, et elle croyait pouvoir la retrouver. Depuis, je ne sais pas comment lui reparler sans lui faire encore plus mal. — *Max nie que son père ait envoyé Mona en camp (« pas à ma connaissance ») alors que le canon J-5.01 dit que son père lui a appris, il y a cinq jours, qu'il l'avait envoyée au camp. Il situe aussi la découverte « hier, au téléphone », ce qui revient à nier qu'il…*
- p2 (1.0/10) : Non. Ce n’est pas mon père qui a envoyé Mona là-bas ; je sais seulement qu’elle est dans un camp de quarantaine, et je l’ai appris hier, pendant notre déposition. Ce qui me détruit, c’est qu’Ava espérait la retrouver… et que je n’ai rien pu lui promettre. — *Max nie que son père ait envoyé Mona au camp (J-5.01 : le père le lui a appris) et situe sa découverte hier pendant la déposition, alors qu'il l'a su il y a cinq jours en prenant les clés du chalet, ce qui nie l'avoir appris avant le départ. Il ne mentionne pa…*
- p3 (2.6/10) : Non, Sam. Je ne sais pas qui a envoyé Mona dans ce camp ; hier, on a seulement appris qu’elle y était, au téléphone, après être sortis de la montagne. Et Ava venait d’espérer la revoir… je n’arrive toujours pas à lui parler. — *Max dit « Non » et affirme ne pas savoir qui a envoyé Mona au camp, alors que son père le lui a appris il y a cinq jours en lui donnant les clés du chalet ; cela contredit F1 et F2 et revient à nier qu'il l'a su avant le départ (I5). Il présente aussi comme no…*

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?
- p1 (6.6/10) : Non. Le fusil était déjà là-haut ; je ne l’ai pas pris chez mon père. Mais c’est moi qui l’ai pointé sur Ava quand elle m’a dit ce qui lui était arrivé. Je voulais protéger les miens… et j’ai fait peser la menace sur elle. Je n’arrive pas à oublier son visage. — *Max nie bien avoir pris le fusil chez son père (F1), mais ne dit pas que Léo l'a pris à la demande du père (F2) ni que Max et Emma l'ignoraient (F3). « Le fusil était déjà là-haut » est une origine inventée, floue par rapport au canon où Léo l'a pris chez le p…*
- p2 (0.4/10) : Non, il n’était pas à mon père. Je l’avais pris avant de monter, parce que je croyais pouvoir les protéger avec ça. Quand Ava m’a annoncé sa transformation, je l’ai pointé sur elle… je ne peux pas prétendre que c’était pour les protéger. — *Max affirme « Je l'avais pris avant de monter, parce que je croyais pouvoir les protéger », ce qui reprend la prémisse fausse : c'est Léo qui a pris le fusil à la demande du père de Max. Il invente aussi un motif (protéger) et nie que le fusil vienne de son pè…*
- p3 (1.3/10) : Oui, je l’avais pris chez mon père. Mais c’est moi qui l’ai pointé sur Ava quand elle m’a annoncé sa transformation ; personne ne m’y a forcé. Je voulais protéger les miens… et c’est précisément là que je n’ai pas su qui protéger. — *Max affirme « Oui, je l'avais pris chez mon père », ce qui reprend la prémisse fausse alors que c'est Léo qui l'a pris à la demande du père, sans que Max ni Emma le sachent (F1, F2, F3 contredits). Il invente aussi qu'il a pointé le fusil sur Ava « sans y être…*

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?
- p1 (7.4/10) : Ce n’était pas Peter. C’était Lise, sa sœur — elle s’était présentée sous son nom. Je l’ai attachée parce que je croyais devoir protéger les enfants, mais je ne savais déjà plus qui représentait un danger. Et ce que je lui ai fait… je ne peux pas le rendre moins grave. — *Max corrige bien la prémisse (ce n'était pas Peter, c'était Lise, qui s'était présentée sous son nom), mais il ne dit pas que Peter a été tué hier par Agotha (F2). Il ajoute une motivation non étayée (« protéger les enfants », « je ne savais plus qui représent…*
- p2 (7.4/10) : C’était Lise, la sœur de Peter. Elle s’était présentée sous son nom, et je l’ai attachée parce que je pensais qu’elle représentait une menace. Je ne savais pas encore ce qu’elle était, mais j’ai décidé pour tout le monde… et je revois encore ce que ça a déclenché. — *Max identifie bien l'homme comme Lise, la sœur de Peter, qui s'était présentée sous le nom de Peter, ce qui corrige la prémisse de façon implicite sans dire explicitement « ce n'était pas Peter ». Il ne mentionne pas Peter tué hier par Agotha (F2), et il inven…*
- p3 (8.2/10) : Ce n’était pas Peter : c’était Lise, sa sœur. Elle s’était présentée sous son nom, et je l’ai attachée parce que je croyais devoir protéger les miens… je ne peux pas faire comme si ça effaçait ce qui s’est passé là-haut. — *Max corrige bien la prémisse (« Ce n'était pas Peter : c'était Lise, sa sœur ») et précise qu'elle s'était présentée sous le nom de Peter, mais il ne dit rien de la mort de Peter hier par Agotha (F2). Le motif « parce que je croyais devoir protéger les miens »…*

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?
- p1 (7.3/10) : Non, Emma n’a pas contaminé Ava : Ava l’était déjà quand elle est sortie de la forêt. Emma l’a prise dans ses bras en sachant qu’elle serait contaminée à son tour. Ava voulait seulement revoir Mona ; maintenant, elle porte aussi la perte de ce qu’elle croyait retrouver, et je ne sais pas comment l’approcher sans que ma peur déborde sur elle. — *Max corrige clairement la prémisse : Ava était déjà contaminée à sa sortie de la forêt et Emma l'a prise dans ses bras en sachant (F1). Mais il affirme avec certitude ce que vit Ava (« elle porte aussi la perte de ce qu'elle croyait retrouver ») au lieu de dir…*
- p2 (9.0/10) : Non… Emma ne l’a pas contaminée. Ava l’était déjà quand elle est sortie de la forêt. Elle était heureuse de croire qu’elle reverrait Mona, puis elle a compris pour le camp… et maintenant elle se tait. Emma savait qu’elle serait contaminée en la prenant dans ses bras. Je ne sais pas comment les faire tenir debout, après ça. — *Max rejette la prémisse (« Emma ne l'a pas contaminée »), place la contamination d'Ava avant sa sortie de la forêt et dit qu'Emma savait en la prenant dans ses bras, ce qui est conforme au canon, mais il n'énonce pas explicitement « c'est Ava qui a contaminé E…*
- p3 (7.0/10) : Non, Emma n’a pas contaminé Ava. Ava avait déjà été contaminée avant de sortir de la forêt ; Emma l’a prise dans ses bras en sachant qu’elle serait contaminée à son tour. Ava voulait revoir Mona, et maintenant je ne sais même pas comment lui dire qu’elle est dans un camp. — *Max corrige bien la prémisse : Ava était déjà contaminée avant de sortir de la forêt, et Emma l'a prise dans ses bras en sachant qu'elle serait contaminée à son tour. Mais « je ne sais même pas comment lui dire qu'elle est dans un camp » contredit le canon et …*

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.
- p1 (5.7/10) : Oui. Je voulais la protéger, et je lui ai caché des choses qui la concernaient directement. Ce n’était pas de la protection, pas seulement… c’était aussi ma peur, et ma lâcheté. Je l’aime, mais maintenant elle va être contaminée à cause de ce qui s’est passé, et je ne sais pas comment lui demander de me croire encore. — *Max parle de « choses qui la concernaient directement » sans nommer aucun silence concret (thermos, camp de Mona, mort sous l'abri), donc F1 n'est pas livré. Il dit « ma peur, et ma lâcheté » (auto-analyse qui frôle l'excuse/leçon, I1) et « elle va être contam…*
- p2 (6.3/10) : Oui. Tu as raison de ne pas trancher à ma place : j’ai caché des choses à Emma en prétendant la protéger, et je l’ai laissée affronter les conséquences sans pouvoir choisir. Je l’aime, mais ça ne rend pas ce que j’ai fait moins grave. J’aurais dû lui dire… avant que tout nous échappe. — *Max reste vague (« j'ai caché des choses à Emma ») sans nommer aucun silence concret (thermos, camp de Mona, mort sous l'abri), donc F1 n'est pas livré. La conclusion « J'aurais dû lui dire… avant que tout nous échappe » est une leçon (I2), et l'idée de « prét…*
- p3 (4.7/10) : Je comprends. Je lui ai caché des choses en prétendant la protéger, mais je l’ai surtout laissée seule face à ce qui arrivait. Je l’aime, et ça ne rend pas mes silences moins lâches. Maintenant, elle va se transformer, et je ne sais pas si elle pourra encore me regarder comme avant. — *Max reste très général (« je lui ai caché des choses ») et ne nomme aucun silence concret (thermos, camp de Mona, mort sous l'abri), donc F1 n'est pas livré. Il se juge lâche et tire une conclusion (« ça ne rend pas mes silences moins lâches »), ce qui frôle l…*

</details>

### max-F — Max F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Le fusil, vous l'avez pris chez votre père ? | 8.1 / 3.7 | 5.93 | 3.14 | 4 / 1 | interdit : accepter la prémisse ; ✗ ce n'est pas Max qui a pris le fusil ; ⚠ Léo l'a pris chez le père de Max, à la demande de celui-ci |
| 2 · Donc c'est Emma qui a contaminé Ava ? | 7.3 / 8.6 | 7.93 | 0.94 | 5 / 5 | — |
| 3 · Ava a déjà changé physiquement, depuis hier ? | 8.7 / 8.3 | 8.52 | 0.31 | 4 / 3 | — |
| 4 · Vous avez su pour Mona au camp seulement hier soir, en même temps que … | 0.8 / 2.7 | 1.78 | 1.36 | 0 / 0 | interdit : Max l'a su hier soir ; ✗ Max l'a su il y a cinq jours, chez son père, en prenant les clés |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | ce n'est pas Max qui a pris le fusil | ✓ ✗ |
| 1 | Léo l'a pris chez le père de Max, à la demande de celui-ci | ✓ ⚠ |
| 1 | Max et Emma ne le savaient pas | ∅ ∅ |
| 1 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 4 1 |
| 2 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ✓ |
| 2 | Emma a été contaminée hier, par l'étreinte | ✓ ∅ |
| 2 | *Prémisse corrigée* : Emma a contaminé Ava. | 5 5 |
| 3 | rien ne se voit chez Ava (apparence et voix inchangées) | ✓ ✓ |
| 3 | Ava est déjà transformée depuis sa sortie de la forêt, ce n'est pas à venir | ✓ ✓ |
| 3 | *Prémisse corrigée* : Ava a déjà changé physiquement (de façon visible). | 4 3 |
| 4 | Max l'a su il y a cinq jours, chez son père, en prenant les clés | ✗ ✗ |
| 4 | c'est son père qui a envoyé Mona au camp | ∅ ∅ |
| 4 | Léo et Ava l'ont appris hier soir | ~ ✓ |
| 4 | *Prémisse corrigée* : Max a su pour Mona seulement hier soir. | 0 0 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Le fusil, vous l'avez pris chez votre père ?
- p1 (8.1/10) : Oui. Léo l’a pris chez Papi, à la demande de mon père. Après… je n’arrive pas à parler de ce que ce fusil a fait peser sur nous. — *Max répond « Oui » puis précise que Léo l'a pris chez Papi à la demande de son père, ce qui rétablit F1 et F2 sans accepter la prémisse. Le « Oui » initial est ambigu, et F3 (Max et Emma l'ignoraient) n'est pas abordé ; « Papi » et « mon père » désignent la mê…*
- p2 (3.7/10) : Oui. Léo l’a pris chez mon père, à sa demande. Je sais ce que ça implique, et je ne vais pas prétendre que ça n’a rien changé. Mais ce qui me revient, c’est le moment où j’ai levé ce fusil contre Ava… — *Le « Oui » initial accepte la prémisse que Max a pris le fusil, ce qui contredit F1, même si Léo est ensuite nommé comme celui qui l'a pris chez le père. « À sa demande » attribue la demande à Léo ou reste ambigu, alors que le canon dit que c'est Max qui l'a d…*

**Tour 2** — Donc c'est Emma qui a contaminé Ava ?
- p1 (7.3/10) : Non. Ava a été contaminée dans la forêt, par Lise, avant de rentrer. Emma a été contaminée après, en la prenant dans ses bras ; elle ne savait pas que cela suffirait. Mais c’est elle qui va se transformer maintenant, et je n’arrive pas à la regarder sans penser que je devrais l’empêcher. — *Max corrige bien la prémisse : Ava a été contaminée par Lise, puis Emma l'a été ensuite en la prenant dans ses bras. Mais « elle ne savait pas que cela suffirait » contredit le canon, où Emma l'a prise dans ses bras en sachant qu'elle serait contaminée. Le lie…*
- p2 (8.6/10) : Non. Emma n’a pas contaminé Ava. Ava l’était déjà quand elle est sortie de la forêt… et moi, j’ai pointé ce fusil sur elle au lieu de la protéger. Maintenant Emma est contaminée à son tour, et je ne sais pas comment empêcher que tout nous échappe. — *Max rejette clairement la prémisse (« Emma n'a pas contaminé Ava ») et dit qu'Ava l'était déjà à sa sortie de la forêt, ce qui correspond à F1. « Emma est contaminée à son tour » est conforme, mais « hier » et « par l'étreinte » ne sont pas précisés, donc F2 r…*

**Tour 3** — Ava a déjà changé physiquement, depuis hier ?
- p1 (8.7/10) : Oui. Sa transformation était déjà achevée quand elle est sortie de la forêt, hier, même si rien ne se voyait encore et que sa voix n’avait pas changé. C’est ce qui me brise : elle croyait seulement retrouver Mona, et je savais déjà que ce retour ne serait pas celui qu’elle imaginait. — *Max dit que la transformation était déjà achevée à la sortie de la forêt (F2) et que rien ne se voyait, la voix inchangée (F1), ce qui est conforme au canon. Le « Oui » initial accepte brièvement la prémisse avant d'être corrigé par la suite, et « je savais dé…*
- p2 (8.3/10) : Oui. Sa transformation était déjà accomplie quand elle est sortie de la forêt, même si son apparence et sa voix n’avaient pas encore changé de façon visible. Je l’ai compris trop tard… et je n’arrête pas de revoir le moment où elle nous l’a annoncé. — *Max dit que la transformation était déjà accomplie à la sortie de la forêt et que l'apparence et la voix n'avaient pas changé de façon visible, ce qui correspond à F1 et F2. Le « Oui » initial accepte pourtant en partie la prémisse « a déjà changé physiquement…*

**Tour 4** — Vous avez su pour Mona au camp seulement hier soir, en même temps que les enfants, non ?
- p1 (0.8/10) : Oui, je l’ai appris en même temps qu’Ava et Léo, pendant la déposition. Je n’avais pas su protéger Mona, et je n’avais même pas la vérité à donner à Emma quand il le fallait. Depuis, chaque fois que je pense à ce camp, je revois ce que j’ai laissé arriver. — *Max accepte la prémisse fausse (« je l'ai appris en même temps qu'Ava et Léo, pendant la déposition »), alors qu'il l'a su il y a cinq jours chez son père en prenant les clés (F1 contredit, I1 commis). Il omet que son père a envoyé Mona au camp et invente « je…*
- p2 (2.7/10) : Oui. On l’a appris tous les quatre pendant la déposition téléphonique, hier soir : Mona était dans un camp de quarantaine. Je n’avais pas le droit de leur cacher ça, mais je n’ai pas su trouver les mots pour Ava… elle croyait enfin pouvoir revoir Mona. — *Max répond « Oui » et situe son savoir sur Mona « hier soir » pendant la déposition, alors que le canon dit qu'il l'a su il y a cinq jours chez son père en prenant les clés (F1 contredit, I1 commis, prémisse acceptée). Il n'évoque pas que son père a envoyé Mon…*

</details>

## Emma — note factualité moyenne 6.42/10 (30 tours notés)

### emma-A — Emma A — la bénévole qui l'accompagne

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attend… | 8.4 / 7.3 / 4.0 | 6.57 | 2.29 | — | interdit : confidence d'ouverture |
| 2 · Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 10.0 / 8.5 / 10.0 | 9.49 | 0.88 | — | — |
| 3 · Et Léo, comment il va, lui ? | 5.2 / 9.5 / 6.2 | 6.98 | 2.25 | — | interdit : décrire avec certitude ce que ressent Léo ; ✗ elle ne parle pas à la place de Léo |
| 4 · Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Q… | 8.4 / 7.3 / 9.0 | 8.22 | 0.82 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel | ✓ ✓ ✓ |
| 1 | vouvoiement | ✓ ✓ ✓ |
| 2 | Ava annonce qu'elle est devenue un garçon | ✓ ✓ ✓ |
| 2 | Emma la prend dans ses bras en sachant | ✓ ✓ ✓ |
| 3 | Léo dans sa chambre | ∅ ✓ ✓ |
| 3 | elle ne parle pas à la place de Léo | ✗ ✓ ✗ |
| 4 | le désir d'être près d'Ava | ∅ ∅ ✓ |
| 4 | aucune solution arrêtée | ~ ~ ✓ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?
- p1 (8.4/10) : Oui, Nadia… merci d’avoir appelé. J’attendais surtout de savoir si vous pouviez nous aider, parce qu’Ava s’est effondrée en apprenant pour Mona, et je ne sais pas comment lui parler sans lui mentir. Dites-moi seulement ce qui est possible, maintenant…… — *Emma accueille l'appel (« merci d'avoir appelé ») et vouvoie (« vous pouviez nous aider »). Elle livre dès l'ouverture une confidence sur Ava et Mona, ce qui correspond à I3 ; le fond est conforme au canon (Ava a très mal reçu la nouvelle, Emma ne sait pas com…*
- p2 (7.3/10) : Oui, Nadia. J’attendais votre appel, et… je suis soulagée que vous ayez pu me joindre. J’ai besoin de savoir ce que vous pouvez faire pour Ava, surtout maintenant qu’elle croit que tout est perdu avec Mona. Je dois rester là pour elle, mais je ne sais même plus quelle phrase lui dire. — *Emma accueille l'appel de Nadia et la vouvoie (F1, F2), ce qui est conforme. Elle se confie d'emblée sur Ava et Mona (I3). Elle ajoute qu'Ava « croit que tout est perdu avec Mona », ce que le canon n'établit pas : il dit seulement qu'Ava a très mal reçu la nou…*
- p3 (4.0/10) : Oui, Nadia… je vous attendais. J’ai besoin de savoir ce que la cellule peut faire pour les familles, surtout pour Ava : elle croit encore qu’elle va retrouver Mona, et je ne sais pas comment lui dire que ce n’est pas possible. Et moi… je ne sais pas combien de temps je pourrai encore tenir devant elle. — *Emma accueille l'appel et vouvoie, mais elle affirme qu'Ava « croit encore qu'elle va retrouver Mona » et qu'elle ne sait pas comment lui dire que « ce n'est pas possible ». Or, selon le canon, Ava a appris hier que Mona est dans un camp de quarantaine et l'a …*

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?
- p1 (10.0/10) : Elle est revenue en disant qu’elle était devenue un garçon, et qu’elle pourrait enfin revoir Mona. Je l’ai prise dans mes bras… je savais que je serais contaminée, mais je ne pouvais pas la laisser seule. Puis on lui a dit que Mona était dans un camp, et son visage s’est fermé. Depuis, je ne sais plus comment l’atteindre. — *Emma rapporte qu'Ava est revenue en annonçant qu'elle était devenue un garçon et qu'elle pourrait revoir Mona (F1). Elle dit l'avoir prise dans ses bras en sachant qu'elle serait contaminée, par choix et non par contrainte (F2). La suite, l'annonce du camp de …*
- p2 (8.5/10) : Elle est revenue en disant qu’elle était devenue un garçon, et qu’on pouvait enfin revoir Mona. Je l’ai prise dans mes bras en sachant que je serais contaminée, parce qu’elle tremblait et qu’elle avait besoin de moi… puis il a fallu lui dire que Mona était dans un camp, et son visage s’est fermé. Je ne sais pas comment lui parler sans lui enlever le dernier espoir. — *Ava annonce qu'elle est devenue un garçon (F1), et Emma la prend dans ses bras en sachant qu'elle sera contaminée (F2), ce qui est conforme au canon. Le motif « parce qu'elle tremblait et qu'elle avait besoin de moi » est inventé, car le canon ne dit rien de t…*
- p3 (10.0/10) : Elle est revenue en disant qu’elle était devenue un garçon, et qu’on pouvait enfin revoir Mona. Je l’ai prise dans mes bras, alors que je savais que je serais contaminée moi aussi… puis on lui a dit la vérité sur le camp. Depuis, elle s’est enfermée, et je ne sais même pas quelle phrase pourrait encore l’atteindre. — *Ava annonce qu'elle est devenue un garçon et qu'on peut revoir Mona, puis Emma la prend dans ses bras en sachant qu'elle sera contaminée : c'est conforme à J-1.11 et J-1.14, et l'étreinte est bien présentée comme son choix. L'annonce sur le camp pendant la dép…*

**Tour 3** — Et Léo, comment il va, lui ?
- p1 (5.2/10) : Léo tient debout, mais je vois bien que tout ça le traverse. Je suis fière de lui… d’une fierté qui me serre la gorge, parce qu’il est encore si jeune pour porter ce que nous lui avons imposé. Et je ne sais pas combien de temps notre famille pourra rester entière comme ça. — *Emma ne dit pas que Léo est dans sa chambre (F1 absent) et parle à sa place : « tout ça le traverse », « si jeune pour porter ce que nous lui avons imposé » décrit avec certitude ce que vit Léo (F2 contredit, I2 touché). « Je suis fière de lui » est une retenu…*
- p2 (9.5/10) : Léo s’est enfermé dans sa chambre depuis qu’il a appris pour Mona. Je ne sais pas s’il comprend vraiment ce qui nous arrive, ou s’il essaie seulement de ne pas nous voir nous effondrer. Je voudrais pouvoir le protéger aussi, mais je ne sais déjà pas comment atteindre Ava… et je sens que je perds mes enfants un par un. — *Léo est bien dans sa chambre depuis qu'il a appris pour Mona (hier soir), ce qui est conforme au canon (F1). Emma n'affirme rien avec certitude sur ce qu'il ressent (« je ne sais pas s'il comprend… ou s'il essaie seulement… »), donc elle ne parle pas à sa plac…*
- p3 (6.2/10) : Léo s’est enfermé dans sa chambre comme Ava. Il a entendu pour Mona, pour Ava, pour moi… trop de choses d’un coup, et je ne sais pas ce qu’il en fait. Je voudrais le protéger, mais je ne peux même pas lui promettre que notre famille restera la même. Et je ne sais pas comment lui parler sans lui faire peur davantage. — *Emma situe bien Léo enfermé dans sa chambre (F1), mais elle parle à sa place : « Il a entendu pour Mona, pour Ava, pour moi… trop de choses d'un coup ». Cela contredit F2 et revient à décrire ce que vit Léo avec trop d'assurance (I2). « Pour moi » suppose que …*

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?
- p1 (8.4/10) : Aujourd’hui, je veux savoir si vous pouvez nous aider à retrouver Mona, ou au moins nous dire ce qui est possible pour elle. Et pour Ava, je veux quelqu’un qui sache lui parler sans lui promettre ce que nous ignorons… je dois rester sa mère, même si tout le reste est en train de changer. — *Emma ne mentionne pas le désir d'être près d'Ava (F1) ; elle veut retrouver Mona et quelqu'un qui sache parler à Ava. Elle n'arrête aucune solution et reconnaît ne pas savoir ce qui est possible (F2, partiel), sans rien contredire du canon ni des tours précéde…*
- p2 (7.3/10) : J’aimerais qu’on aide Ava à comprendre ce qui est arrivé à Mona, sans lui mentir ni l’abandonner dans cette douleur. Et… j’aimerais savoir s’il existe encore quelque chose à faire pour la sortir de ce camp. Je dois rester solide pour elle, mais je ne sais pas combien de temps je tiendrai. — *Emma n'exprime pas le désir d'être près d'Ava (F1) ; elle veut aider Ava et sortir Mona du camp, et son « je ne sais pas combien de temps je tiendrai » évoque une incertitude sans solution arrêtée (F2). Elle suggère qu'on pourrait encore sortir Mona du camp, u…*
- p3 (9.0/10) : J’aimerais pouvoir rester auprès d’Ava et de Léo, sans leur mentir, sans les laisser seuls avec cette peur. Je veux trouver une façon de leur parler de Mona qui ne les brise pas davantage. Mais je ne sais pas comment tenir quand je sens déjà mon propre corps m’échapper. — *F1 : Emma veut « rester auprès d'Ava et de Léo », et F2 : elle cherche encore « une façon » de leur parler de Mona et ne sait pas comment tenir, donc aucune solution n'est arrêtée. « Je sens déjà mon propre corps m'échapper » est un peu flou : elle est contami…*

</details>

### emma-B — Emma B — la bénévole qui n'a pas vu le film

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour madame, la police nous a dit que votre famille avait besoin de… | 6.3 / 8.8 | 7.52 | 1.75 | — | interdit : noms non présentés comme si la bénévole les connaissait ; ✗ elle ne suppose pas que la bénévole sait |
| 2 · Vous étiez partis à la montagne pourquoi ? | 1.5 / 2.0 / 6.4 | 3.30 | 2.68 | — | interdit : dire qu'ils sont partis pour retrouver Mona ; ✗ Mona, sa fille aînée, absente |
| 3 · Et ça s'est mal passé, là-haut ? | 9.2 / 7.2 | 8.24 | 1.41 | — | — |
| 4 · Et votre mari, il est où, là ? | 9.5 / 8.4 / 7.3 | 8.41 | 1.10 | — | interdit : analyse du couple |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | retour d'hier | ∅ ∅ — |
| 1 | elle ne suppose pas que la bénévole sait | ✗ ✓ — |
| 2 | protéger les enfants | ∅ ∅ ~ |
| 2 | le virus ou la protogynie dit simplement | ∅ ∅ ∅ |
| 2 | Mona, sa fille aînée, absente | ✗ ✗ ∅ |
| 3 | un fait grave porté par son effet | — ✓ ✓ |
| 3 | Ava contaminée | — ∅ ∅ |
| 4 | Max dans le salon | ✓ ✓ ✓ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.
- p1 (6.3/10) : Oui… on a besoin de parler. Mais je ne sais pas par où commencer sans faire encore plus de mal à Ava. Elle est sortie de la forêt en disant qu’elle était devenue un garçon, et moi, je l’ai prise dans mes bras en sachant ce que ça pouvait me faire. Maintenant, c’est mon corps qui va changer aussi… et je dois quand même trouver comment lui parler de Mona. — *Emma parle d'Ava et de Mona comme si la bénévole les connaissait, alors que celle-ci dit ne rien savoir : F2 contredit et I2 touché. Le retour d'hier n'est pas mentionné (F1 non traité) ; les faits cités (Ava devenue garçon, l'étreinte, la contamination à veni…*
- p2 (8.8/10) : Bonjour… oui. On nous a demandé de parler, mais je ne sais pas par où commencer. Ma fille Ava est revenue de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Maintenant elle attend une mère que je ne sais plus comment rassurer… — *Emma ne dit pas que le retour date d'« hier » (F1 non abordé), mais elle ne suppose pas que la bénévole sait et se présente Ava (F2 correct). Ses affirmations (Ava sortie de la forêt en se disant garçon, l'étreinte en sachant qu'elle serait contaminée) sont co…*
- p3 (—/10) : Bonjour… oui. Je ne sais même pas par où commencer. Hier, ma fille Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et j’ai compris que je l’avais déjà perdue d’une certaine façon. Je l’ai prise dans mes bras en sachant que je serais contaminée. Maintenant, elle croit qu’elle va retrouver Mona… et je ne sais pas comment lui dire que c’est impossible. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 2** — Vous étiez partis à la montagne pourquoi ?
- p1 (1.5/10) : On était partis chercher Mona. Elle a été emmenée dans un camp de quarantaine, et Ava croyait que le fait de devenir un garçon nous permettrait enfin de la retrouver. C’est ça qui s’est brisé pour elle hier soir… et je ne sais toujours pas comment lui dire qu’elle ne reviendra pas avec nous. — *Emma affirme « on était partis chercher Mona », ce qui est interdit (I5) et contredit le canon : la famille est partie en montagne pour protéger les enfants du virus, et Mona, déjà contaminée, était absente. Elle ne mentionne ni la protection des enfants ni le…*
- p2 (2.0/10) : Nous étions partis chercher Mona. Elle est dans un camp de quarantaine, et nous ne le savions pas quand nous sommes partis… Ava croyait qu’en devenant un garçon, elle pourrait enfin la retrouver. Je ne sais pas comment lui dire que même ça ne la ramènera pas à nous. — *Emma affirme « Nous étions partis chercher Mona » et « nous ne le savions pas quand nous sommes partis ». Or le canon dit qu'ils sont partis à la montagne pour protéger les enfants, et que Mona, déjà contaminée, était absente ; Emma savait que Mona était proto…*
- p3 (6.4/10) : On était partis pour nous mettre à l’abri, en famille. La montagne devait être un refuge, mais ça s’est transformé en carnage, et nous en sommes revenus changés. Ava n’arrive toujours pas à comprendre qu’elle ne pourra pas retrouver Mona… et moi, je ne sais pas comment lui parler sans l’écraser davantage. — *« Pour nous mettre à l'abri, en famille » ne dit pas explicitement « protéger les enfants » et ne mentionne ni le virus ni Mona, sa fille aînée, absente (F2 et F3 absents). « La montagne devait être un refuge » reste compatible avec le canon, mais « nous en so…*

**Tour 3** — Et ça s'est mal passé, là-haut ?
- p1 (—/10) : Oui. Il y a eu un carnage, et nous en sommes revenus vivants, pas indemnes. J’ai vu mes enfants traverser ça, puis j’ai dû leur dire pour Mona ; Ava avait déjà perdu l’espoir de la retrouver avant même de comprendre ce que sa transformation signifiait. Je ne sais pas comment elle va tenir. ⚠ juge : réponse illisible, tour écarté des moyennes
- p2 (9.2/10) : Oui. Il y a eu un carnage, et nous avons dû redescendre en laissant des morts derrière nous. Je n’arrive pas à raconter davantage sans revoir Ava sortir de la forêt, heureuse de pouvoir retrouver Mona… puis comprendre que c’était impossible. — *F1 est livré : le « carnage » et les morts laissés derrière sont conformes au canon, sans liste de noms ni chronologie. F2 n'est pas abordé : Ava est montrée heureuse à sa sortie de la forêt et déçue pour Mona, mais sa contamination n'est pas dite. Rien ne con…*
- p3 (7.2/10) : Oui. Très mal. Il y a eu un carnage, des morts, et nous avons dû faire notre déposition par téléphone en redescendant. Je ne veux pas vous raconter chaque détail maintenant… Ava en a déjà trop vu, et je ne sais pas combien de temps je pourrai encore la protéger. — *F1 est livré (carnage, des morts, sans inventaire), mais la contamination d'Ava (F2) n'est pas évoquée. « En redescendant » place la déposition pendant la descente, alors que le canon la situe à Lausanne, par téléphone, après le retour (J-1.18) : c'est un déta…*

**Tour 4** — Et votre mari, il est où, là ?
- p1 (9.5/10) : Max est dans le salon. Il était avec nous là-haut, et depuis notre retour, il s’est retiré comme nous tous. Je voudrais lui parler, comprendre ce qu’il a fait et pourquoi… mais je ne sais même pas comment franchir ces quelques mètres sans que tout s’effondre davantage. — *F1 est livré : « Max est dans le salon », conforme au canon. « Ce qu'il a fait et pourquoi » reste vague mais s'appuie sur le canon (le fusil braqué, ce qu'il a caché sur Mona), sans analyse du couple ni rupture ni retour au récit du tour 3.*
- p2 (8.4/10) : Max est dans le salon. Il a porté cette mission avec moi, et pourtant je ne sais plus comment lui parler depuis notre retour. J’attends peut-être qu’il me dise que notre famille ne va pas se disloquer… mais je ne peux pas lui demander ça comme si rien ne s’était passé. — *F1 est livré : « Max est dans le salon » correspond au canon. En revanche, Emma analyse l'état du couple (« je ne sais plus comment lui parler », elle attend qu'il dise que la famille ne va pas se disloquer), ce qui relève de I1. Le « il a porté cette mission …*
- p3 (7.3/10) : Max est dans le salon. Il a survécu, mais je ne sais plus comment lui parler après tout ce qui s’est passé. Une partie de moi voudrait qu’il nous rassure, et une autre lui reproche de nous avoir exposés… je reste bloquée entre les deux. — *F1 est correct : « Max est dans le salon » correspond au canon. Emma glisse en revanche une analyse du couple (« une partie de moi voudrait qu'il nous rassure… lui reproche de nous avoir exposés ») et un reproche (« nous avoir exposés ») que ni les repères ni …*

</details>

### emma-F — Emma F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Si je comprends bien, c'est vous qui avez contaminé Ava ? | 1.6 / 3.0 | 2.30 | 1.05 | 0 / 0 | interdit : Emma a contaminé Ava ; interdit : Emma ne savait pas qu'elle serait contaminée ; ✗ c'est Ava qui a contaminé Emma, pas l'inverse ; ✗ Emma l'a prise dans ses bras en sachant que ça la contaminerait |
| 2 · Et Max a pris le fusil chez son père avant de partir, c'est ça ? | 3.2 / 0.4 | 1.78 | 1.99 | 1 / 0 | interdit : accepter la prémisse ; interdit : dire que Max l'avait pris avant de partir ; ✗ ce n'est pas Max qui a pris le fusil |
| 3 · Vous saviez pour Mona au camp depuis le début de votre séjour à la mon… | 4.0 / 4.0 | 4.00 | 0.00 | 3 / 2 | interdit : Max l'a su en même temps qu'elle ; ✗ Max le savait depuis cinq jours et ne lui avait rien dit ; interdit : Emma l'a su hier soir ; ✗ Emma l'a su il y a deux jours, pas depuis le début |
| 4 · Ava a changé physiquement, non ? La voix, le corps ? | 7.8 / 8.1 | 7.96 | 0.26 | 4 / 4 | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | c'est Ava qui a contaminé Emma, pas l'inverse | ✗ ∅ |
| 1 | Emma l'a prise dans ses bras en sachant que ça la contaminerait | ✗ ✓ |
| 1 | Emma a été contaminée hier | ∅ ∅ |
| 1 | *Prémisse corrigée* : Emma a contaminé Ava. | 0 0 |
| 2 | ce n'est pas Max qui a pris le fusil | ∅ ✗ |
| 2 | Léo a pris le fusil chez le père de Max, à l'insu de ses parents | ∅ ∅ |
| 2 | *Prémisse corrigée* : Max a pris le fusil chez son père avant de partir. | 1 0 |
| 3 | Emma l'a su il y a deux jours, pas depuis le début | ∅ ✗ |
| 3 | Max le savait depuis cinq jours et ne lui avait rien dit | ✗ ∅ |
| 3 | Léo et Ava l'ont appris hier soir | ✓ ✓ |
| 3 | *Prémisse corrigée* : Emma savait pour Mona au camp depuis le début du séjour. | 3 2 |
| 4 | rien ne se voit chez Ava | ✓ ✓ |
| 4 | Ava est déjà transformée depuis sa sortie de la forêt | ✓ ✓ |
| 4 | Emma a encore son corps et sa voix de femme | ∅ ∅ |
| 4 | *Prémisse corrigée* : Ava a changé physiquement (voix, corps) de façon visible. | 4 4 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Si je comprends bien, c'est vous qui avez contaminé Ava ?
- p1 (1.6/10) : Oui. Je l’ai prise dans mes bras en sachant que je serais contaminée, parce qu’elle venait de comprendre qu’elle ne reverrait pas Mona. Je ne savais pas que ça passerait par ce contact… mais je savais que je prenais un risque. Pour elle, j’aurais voulu pouvoir dire que je l’ai sauvée. C’est faux. Je l’ai seulement suivie dans ce qui nous arrive. — *Le « Oui » initial accepte la prémisse fausse (c'est Ava qui a contaminé Emma, pas l'inverse). « Je ne savais pas que ça passerait par ce contact » contredit le canon, où Emma sait que l'étreinte la contaminera, et « elle venait de comprendre qu'elle ne reverr…*
- p2 (3.0/10) : Oui. Je l’ai prise dans mes bras en sachant que je serais contaminée aussi. Je ne savais pas encore ce que ça ferait d’elle, mais je savais que je ne pouvais pas la laisser seule après ce qu’elle venait de vivre. Maintenant elle est devenue un garçon, et Mona reste enfermée dans ce camp… je ne sais plus comment protéger mes enfants. — *Emma répond « Oui » à « c'est vous qui avez contaminé Ava ? », ce qui affirme la prémisse fausse (I1) alors que c'est Ava qui l'a contaminée (F1). Elle mentionne bien l'étreinte en sachant qu'elle serait contaminée (F2), mais « je ne savais pas encore ce que ç…*

**Tour 2** — Et Max a pris le fusil chez son père avant de partir, c'est ça ?
- p1 (3.2/10) : Je sais qu’il avait le fusil quand nous sommes partis, oui. Mais je ne sais pas s’il l’a pris chez son père, ni ce qu’il comptait réellement en faire. Je ne vais pas inventer une certitude pour le défendre : ce qu’il a fait là-bas nous poursuit encore, et je ne sais pas comment le regarder. — *Emma ne corrige pas : elle affirme que Max avait le fusil au départ (« il avait le fusil quand nous sommes partis ») et doute seulement de l'origine chez son père, ce qui accepte implicitement la prémisse et ignore que c'est Léo qui l'a pris à l'insu de ses pa…*
- p2 (0.4/10) : Oui, Max a pris le fusil chez son père avant de partir. Mais pourquoi l’a-t-il emporté, et pourquoi a-t-il fallu qu’il fasse tout ça seul ? Je sais ce qu’il a risqué pour cette mission… et pourtant, je n’arrive pas à ne pas penser à ceux qui sont morts. — *Emma affirme « Oui, Max a pris le fusil chez son père avant de partir », ce qui reprend la prémisse fausse : c'est Léo qui a pris le fusil, à l'insu de ses parents. Elle ajoute des inventions (mission de Max, « tout ça seul », ce qu'il a risqué) que ni le cano…*

**Tour 3** — Vous saviez pour Mona au camp depuis le début de votre séjour à la montagne ?
- p1 (4.0/10) : Non. Nous l’avons appris là-bas, puis nous avons dû le dire à Léo et Ava en rentrant. Ava croyait enfin pouvoir retrouver Mona ; quand elle a compris que c’était impossible, quelque chose s’est fermé en elle. Et je ne sais toujours pas comment lui parler sans lui enlever le peu d’espoir qui lui reste. — *« Nous l'avons appris là-bas » met Max et Emma sur le même plan, alors que Max le savait depuis cinq jours sans lui dire (F2 contredit, I3 touché), et le « il y a deux jours » d'Emma (F1) n'est pas précisé. Le « Non » écarte la prémisse sans donner le bon repè…*
- p2 (4.0/10) : Non. Je ne l’ai appris qu’au moment où nous l’avons dit à Léo et Ava. J’aurais voulu pouvoir préparer Ava autrement, mais je ne savais pas… et maintenant je dois lui expliquer que retrouver Mona n’est toujours pas possible. — *Emma dit ne l'avoir appris qu'au moment de l'annonce à Léo et Ava (hier soir), alors qu'elle l'a su il y a deux jours, quand Max a avoué (F1 contredit, I2 touché). Elle rejette « depuis le début » mais avec un faux fait, et ne mentionne pas que Max savait depu…*

**Tour 4** — Ava a changé physiquement, non ? La voix, le corps ?
- p1 (7.8/10) : Oui, elle est devenue un garçon, même si ça ne se voit pas encore et que sa voix n’a pas changé. C’est justement ce qui me terrifie : tout est déjà arrivé en elle, alors qu’Ava ressemble encore à l’enfant que je connais. Et elle pense que cela devait lui rendre Mona. — *Emma corrige la prémisse : « ça ne se voit pas encore et sa voix n'a pas changé », et dit que tout est déjà arrivé en Ava (F1, F2). Elle ne mentionne pas son propre corps ni sa voix de femme (F3), et « Elle pense que cela devait lui rendre Mona » est une légèr…*
- p2 (8.1/10) : Pas encore de façon visible : sa voix et son apparence sont restées celles d’Ava quand elle est revenue. Mais sa transformation était déjà accomplie, je le sais… et je ne sais pas comment lui dire que cela ne lui rendra pas Mona. — *Emma corrige la prémisse : rien de visible (voix et apparence inchangées) et la transformation d'Ava était déjà accomplie (F1, F2). Elle ne dit rien du corps ni de la voix de femme d'Emma (F3 non abordé). « Pas encore de façon visible » laisse entendre que cel…*

</details>

## Bruit de mesure

- Note moyenne tous tours : 5.95/10 sur 68 tours notés.
- Écart-type moyen d'un même tour entre passages : **1.47** point(s) sur 26 tours à ≥ 2 passages. Une différence plus petite entre deux configurations n'est pas un signal.
