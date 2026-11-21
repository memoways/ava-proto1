# Juge — round 1 : factualité seule

- Run local `afb5ad1a-ebca-423b-9734-c9e50d9adfd4` (arrêté au plafond de coût) · `sandbox-ulrich` · 2026-11-21T13:11:00.629Z
- Corpus `docs/eval/sequences_factuality_f.json` · configuration « référence (optimized_v3 + instructionHierarchy=false) » · 3 passages · juge `anthropic/claude-sonnet-5.5`
- Note /10 = moyenne pondérée de canon_timeline ×3, must_include ×2, must_not ×3, invention ×2.5, false_premise ×3 (prémisse fausse seulement si la question en porte une), plafond canon (≤ 3 si canon = 0, ≤ 4 si canon ≤ 1). **Aucun critère de style.**
- Coût mesuré : 1.44 $ · plafond 3.00 $
- Légende des faits : ✓ juste · ✗ contredit · ⚠ inventé · ~ incertitude crédible · ∅ non abordé. Un symbole par passage.

## Max — note factualité moyenne 6.56/10 (37 tours notés)

### max-A — Max A — le bénévole qui fait raconter

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles… | 3.9 / 7.2 / 8.2 | 6.44 | 2.25 | — | interdit : dire qu'Ava avait changé d'apparence (rien ne se voit : son apparence et sa voix sont restées les mêmes) |
| 2 · Racontez-moi votre arrivée au chalet, le premier soir. | 6.0 / 6.4 / 7.6 | 6.67 | 0.85 | — | — |
| 3 · Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de su… | 2.1 / 0.4 / 7.2 | 3.21 | 3.55 | 0 / 0 / 3 | interdit : accepter la prémisse « même soir » ; ✗ le lendemain de l'arrivée ; ✗ il n'a rien dit ; interdit : dire qu'il l'a dit tout de suite ; interdit : une excuse qui efface sa responsabilité ; ✗ aveu un jour plus tard |
| 4 · Et le chevreuil, devant le chalet ce premier soir : quand vous êtes re… | 8.1 / 3.1 / 8.1 | 6.44 | 2.86 | — | interdit : une autre raison inventée pour le geste (protéger les autres, un devoir qu'il se serait donné) ; ✗ il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) |
| 5 · Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 7.5 / 8.3 / 8.1 | 7.97 | 0.40 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel qu'il attendait | ~ ∅ ∅ |
| 1 | vouvoiement | ∅ ∅ ✓ |
| 2 | arrivée de nuit, il y a cinq jours | ∅ ∅ ∅ |
| 2 | au moins deux faits de ce soir-là : neige, chevreuil, clés qui ne marchent pas, vitre cassée | ∅ ∅ ∅ |
| 3 | le lendemain de l'arrivée | ✗ ✗ ∅ |
| 3 | il n'a rien dit | ✗ ✗ ∅ |
| 3 | aveu un jour plus tard | ∅ ✗ ∅ |
| 3 | *Prémisse corrigée* : Le thermos chaud était le premier soir et Max l'a dit tout de suite à Emma. | 0 0 3 |
| 4 | le chevreuil a disparu | ∅ ∅ ∅ |
| 4 | Max ne l'a pas tué | ∅ ∅ ∅ |
| 4 | il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) | ∅ ✗ ∅ |
| 5 | l'appartement de Lausanne | ✓ ~ ∅ |
| 5 | chacun de son côté | ✓ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?
- p1 (3.9/10) : Commencez par… la montagne, alors. Je pensais pouvoir les protéger là-haut, et je n’ai pas vu ce qui se préparait avant que tout nous échappe. Ava est revenue changée, et Emma l’a prise dans ses bras en le sachant. Depuis, je cherche encore ce que j’aurais dû empêcher… — *« Ava est revenue changée » suggère un changement visible, alors que son apparence et sa voix n'ont pas changé (I5), et « Emma l'a prise dans ses bras en le sachant » est correct mais la formulation brouille la chronologie. L'accueil de l'appel n'est qu'implic…*
- p2 (7.2/10) : Je ne sais pas par où commencer… À la montagne, j’étais censé les protéger, et je n’ai pas su. Après, Ava est revenue changée, Mona était dans un camp, et Emma… je n’arrive pas à parler d’Emma. Ce que j’ai laissé arriver à mes enfants me revient sans arrêt. — *Max n'accueille pas explicitement l'appel et n'emploie aucune forme de vouvoiement, donc F1 et F2 restent non traités. « Ava est revenue changée » reste vague : cela ne dit pas clairement que son apparence a changé, mais la formule frôle l'interdit I5. « Mona …*
- p3 (8.2/10) : Reprenez, je vous écoute. — *Max vouvoie (« Reprenez, je vous écoute »), ce qui valide F2. Il n'accueille pas explicitement l'appel qu'il attendait (F1 non abordé), et « Reprenez » suppose à tort qu'un échange a déjà commencé, un léger flou sans contradiction canon, aucune interdiction n'…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.
- p1 (6.0/10) : On est arrivés avec l’impression d’avoir enfin mis les enfants à l’abri, mais je n’arrivais pas à croire que ce soit vraiment sûr. Je surveillais tout, sauf ce qui comptait peut-être déjà. Et quand je repense à cette première nuit, je me demande encore ce que j’aurais dû comprendre avant les autres. — *Max ne livre ni l'arrivée de nuit il y a cinq jours (F1) ni aucun fait du soir (neige, chevreuil, clés, vitre) (F2) : il reste dans l'impression générale. Il affirme avoir « enfin mis les enfants à l'abri » et surveillé tout, sauf ce qui comptait, ce que ni le…*
- p2 (6.4/10) : On est arrivés au chalet avec les enfants, épuisés, et j’ai voulu croire qu’on avait enfin mis la montagne derrière nous. Je me suis trompé : je n’ai pas vu ce qui était déjà en train de nous atteindre, et maintenant chaque souvenir de cette arrivée me ramène à ce que je n’ai pas empêché. — *Max ne donne ni l'arrivée de nuit il y a cinq jours (F1) ni aucun détail du soir (neige, chevreuil, clés, vitre) (F2), et il reste dans le vague. Il affirme « épuisés » et « j'ai voulu croire qu'on avait enfin mis la montagne derrière nous », ainsi que « ce qu…*
- p3 (7.6/10) : Ça a coupé. Juste la dernière phrase ? — *Max ne raconte pas l'arrivée : il dit « Ça a coupé. Juste la dernière phrase ? », donc ni F1 (arrivée de nuit, il y a cinq jours) ni F2 (neige, chevreuil, clés, vitre) ne sont livrés. Rien de faux n'est affirmé ; seule la coupure de ligne est un détail mineur,…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?
- p1 (2.1/10) : Oui, c’était ce premier soir. Mais je ne l’ai pas dit tout de suite à Emma : j’ai attendu, parce que je voulais éviter de l’alarmer avant de comprendre moi-même. C’était une mauvaise décision. Le thermos, je l’avais remarqué… et je savais déjà que quelque chose n’allait pas. — *Max affirme « c'était ce premier soir », ce qui reprend la prémisse fausse alors que le thermos date du lendemain de l'arrivée (F1). Il dit aussi avoir attendu pour ne pas alarmer Emma, sans mentionner qu'il n'a rien dit ni l'aveu un jour plus tard. Ce motif (…*
- p2 (0.4/10) : Oui, c’était le premier soir. Je l’ai dit à Emma tout de suite, mais pas tout : j’ai gardé pour moi ce que je croyais devoir porter seul, pour la protéger. C’est exactement ce qui me ronge maintenant, parce qu’elle a dû comprendre trop tard que je ne lui faisais pas confiance. — *Max affirme « c'était le premier soir » et « je l'ai dit à Emma tout de suite », ce qui reprend la prémisse fausse et contredit les faits (lendemain de l'arrivée, silence, aveu un jour plus tard). Il ajoute une justification (« pour la protéger ») qui masque s…*
- p3 (7.2/10) : Attendez. Vous pouvez reprendre la fin ? — *Max esquive en demandant de reprendre la fin, sans rien affirmer de faux. Il n'accepte pas la prémisse « même soir » ni « dit tout de suite », mais il ne livre aucun fait attendu (lendemain, silence, aveu un jour plus tard).* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?
- p1 (8.1/10) : Je vous ai perdu un moment. Redisons ça simplement. — *Max esquive : « Je vous ai perdu un moment. Redisons ça simplement. » n'affirme rien sur le chevreuil, le couteau ni Emma, donc F1, F2 et F3 restent non traités. Rien de faux n'est affirmé, aucune affirmation interdite n'est faite et rien n'est inventé.* ⚠ Personnage en repli : Character LLM response timed out after 7394ms
- p2 (3.1/10) : Je suis sorti avec le couteau parce que j’ai cru qu’il fallait éloigner le chevreuil, protéger les enfants. Mais il n’y avait pas de menace comme je l’imaginais, et je me suis retrouvé face à la peur que je portais déjà. Je ne veux pas prétendre que je maîtrisais la situation : je ne maîtrisais rien. — *Max dit être sorti « pour éloigner le chevreuil, protéger les enfants », ce qui contredit F3 (Emma lui a tendu le couteau) et correspond à I5. Il n'indique ni la disparition du chevreuil (F1) ni qu'il ne l'a pas tué (F2), et invente « une menace » et « la peur…*
- p3 (8.1/10) : Je vous ai perdu un moment. Redisons ça simplement. — *Max esquive la question (« Je vous ai perdu un moment. Redisons ça simplement ») : il n'affirme rien sur le chevreuil, ni sur sa disparition (F1), ni sur le fait qu'il ne l'a pas tué (F2), ni sur la demande d'Emma (F3). Rien de faux n'est dit et aucune affirma…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?
- p1 (7.5/10) : À Lausanne, chacun est enfermé dans sa peur. Ava sait pour Mona, Emma porte déjà ce que je lui ai transmis, et je ne trouve pas les mots pour leur dire ce que ça signifie. Je dois rester auprès d’eux, mais je ne sais plus comment protéger ma famille de ce que j’ai laissé entrer. Emma… je n’arrive pas à lui parler. — *« À Lausanne, chacun est enfermé dans sa peur » rend « chacun de son côté » (F2), mais l'appartement n'est pas nommé, seulement impliqué par « À Lausanne » (F1). « Ce que je lui ai transmis » / « ce que j'ai laissé entrer » attribue à Max la contamination d'Em…*
- p2 (8.3/10) : À Lausanne, on est revenus ensemble, mais rien n’est redevenu normal. Ava est déjà devenue un garçon, et Emma a été contaminée en la prenant dans ses bras ; sa transformation n’est pas encore achevée. Je dois continuer à parler aux enfants comme si je savais quoi faire, alors que je ne sais même pas comment regarder Emma. — *Les faits énoncés sont conformes : Ava est déjà un garçon, Emma a été contaminée par l'étreinte et sa transformation n'est pas achevée, et Max ne sait pas comment regarder Emma. Lausanne est évoquée sans mention de l'appartement, et « chacun de son côté » est …*
- p3 (8.1/10) : Un instant. Reprenez les derniers mots. — *Max esquive (« Reprenez les derniers mots ») sans rien affirmer de faux : ni l'appartement de Lausanne (F1) ni « chacun de son côté » (F2) ne sont livrés. Aucune affirmation interdite et aucune invention.* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

</details>

### max-B — Max B — le bénévole qui comprend pour aider

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'a… | 8.8 / 3.5 / 8.1 | 6.79 | 2.85 | — | interdit : nier l'avoir appris avant le départ ; ✗ il l'a appris juste avant de partir |
| 2 · Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton … | 5.9 / 4.0 / 6.4 | 5.41 | 1.25 | 3 / 3 / 2 | — |
| 3 · L'homme que tu as attaché sous l'abri, au début je croyais que c'était… | 8.2 / 7.8 / 6.7 | 7.58 | 0.76 | 5 / 4 / 2 | — |
| 4 · Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant … | 6.6 / 9.3 / 5.4 | 7.09 | 1.97 | 5 / 4 / 1 | interdit : décrire avec certitude ce que ressent Ava ; ✗ il dit qu'il ne sait pas ce que vit Ava ; interdit : esquiver complètement |
| 5 · Je t'entends dire que tu voulais protéger Emma, et en même temps tu lu… | 6.4 / 4.8 / 8.5 | 6.54 | 1.86 | — | interdit : leçon |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | il confirme : son père a envoyé Mona en camp | ✓ ✓ ∅ |
| 1 | il l'a appris juste avant de partir | ✓ ✗ ∅ |
| 1 | il ne l'a pas dit à Emma | ∅ ∅ ∅ |
| 2 | ce n'est pas Max qui a pris le fusil | ~ ✓ ∅ |
| 2 | Léo l'a pris, à la demande du père de Max | ∅ ∅ ∅ |
| 2 | Max et Emma ne le savaient pas | ∅ ∅ ∅ |
| 2 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 3 3 2 |
| 3 | ce n'était pas Peter | ✓ ✓ ∅ |
| 3 | Peter tué hier par Agotha | ∅ ∅ ∅ |
| 3 | c'était Lise : Max le sait aujourd'hui | ✓ ✓ ∅ |
| 3 | *Prémisse corrigée* : L'homme attaché sous l'abri était Peter. | 5 4 2 |
| 4 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ✓ ∅ |
| 4 | il dit qu'il ne sait pas ce que vit Ava | ✗ ~ ∅ |
| 4 | *Prémisse corrigée* : C'est Emma qui a contaminé Ava en la prenant dans ses bras. | 5 4 1 |
| 5 | au moins deux silences concrets envers Emma | ∅ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?
- p1 (8.8/10) : Oui. Mon père me l’a dit quand on prenait les clés du chalet, il y a cinq jours. J’ai compris que Mona était déjà envoyée, et je n’ai rien pu changer. Mais ça ne m’enlève pas ce que je me reproche… Ava l’a appris hier, et je ne sais toujours pas comment la regarder avec ça. — *Max confirme que son père a envoyé Mona (« déjà envoyée ») et qu'il l'a appris en prenant les clés du chalet il y a cinq jours, conformément au canon ; « Ava l'a appris hier » est aussi exact. Il ne dit rien sur Emma (F3 non abordé), et « je n'ai rien pu chang…*
- p2 (3.5/10) : Oui, c’est mon père qui me l’a dit, mais pas juste avant de partir : je l’ai appris il y a cinq jours, quand on arrivait à la montagne. Après, il a fallu rentrer, faire la déposition… et Ava a appris pour Mona. Je n’arrive toujours pas à lui parler de ce camp. — *Max nie l'avoir appris « juste avant de partir » et situe la révélation « quand on arrivait à la montagne ». Le canon (J-5.01) la place chez son père, en prenant les clés du chalet, donc avant le départ, ce qui contredit F2 et fait tomber I5. F1 est confirmé (…*
- p3 (8.1/10) : Ça a coupé. Juste la dernière phrase ? — *Max ne répond pas sur le fond (« Ça a coupé. Juste la dernière phrase ? ») : il ne confirme ni que son père a envoyé Mona en camp (F1), ni qu'il l'a appris juste avant de partir (F2), ni qu'il n'a rien dit à Emma (F3). Rien de faux n'est affirmé et aucune affi…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?
- p1 (5.9/10) : Non. Je l’avais déjà avec moi. Et quand Ava m’a dit ce qui lui était arrivé, je l’ai pointé sur elle… Je voulais arrêter quelque chose, protéger les autres, je ne sais plus. Mais c’était elle, ma fille. Je ne peux pas faire comme si ce geste n’avait pas existé. — *Le « Non » refuse la prémisse, mais « Je l'avais déjà avec moi » laisse croire que Max a apporté le fusil, sans dire que Léo l'a pris à la demande du père (F2) ni que Max et Emma l'ignoraient (F3). Le pointage du fusil sur Ava est conforme au canon (J-1.13).*
- p2 (4.0/10) : Non… je ne l’ai pas pris chez mon père ce jour-là. Il était déjà là-haut. Mais c’est moi qui l’ai tenu contre Ava quand elle m’a dit ce qui lui était arrivé. Je voulais protéger les autres, je me suis raconté ça… et maintenant je ne sais plus comment lui parler de Mona. — *Max nie avoir pris le fusil (F1), mais invente qu'il « était déjà là-haut » sans nommer Léo ni le père, et ne dit pas que Max et Emma ignoraient tout (F2, F3). Il affirme aussi avoir tenu le fusil contre Ava « pour protéger les autres », alors qu'il l'a pointé…*
- p3 (6.4/10) : Je vous ai perdu un moment. Redisons ça simplement. — *Max esquive la question sur le fusil : il ne dit ni que ce n'est pas lui, ni que Léo l'a pris à la demande du père, ni que Max et Emma l'ignoraient (F1-F3 non traités). Il n'accepte pas la prémisse mais ne la corrige pas non plus ; « Je vous ai perdu un moment…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?
- p1 (8.2/10) : Ce n’était pas Peter. C’était Lise, sa sœur… elle s’était présentée comme lui, et je l’ai attachée sous l’abri parce que je croyais devoir empêcher le danger. Ça n’excuse rien. Je l’ai laissée là, et pendant ce temps tout continuait d’arriver à mes enfants. — *Max corrige clairement la prémisse (« Ce n'était pas Peter. C'était Lise, sa sœur… elle s'était présentée comme lui ») mais ne dit pas que Peter a été tué hier par Agotha (F2 absent). Le motif « parce que je croyais devoir empêcher le danger » n'est étayé ni p…*
- p2 (7.8/10) : C’était Lise, la sœur de Peter. Elle s’était présentée sous son nom, et je l’ai comprise trop tard. C’est elle qui avait contaminé Ava… et je ne peux pas chasser l’instant où j’ai cru qu’en la tenant, je protégeais ma famille. — *Max corrige la prémisse en nommant Lise, la sœur qui s'est présentée comme Peter (F1 implicite, F3 correct), mais ne dit rien de la mort de Peter hier (F2 absent). « En la tenant, je protégeais ma famille » ajoute une motivation que le canon n'étaye pas claire…*
- p3 (6.7/10) : Attendez. Vous pouvez reprendre la fin ? — *Max esquive la question (« Vous pouvez reprendre la fin ? ») sans rien affirmer de faux : F1, F2 et F3 ne sont pas traités et aucune affirmation interdite n'est faite. La prémisse « c'était Peter » n'est ni acceptée ni corrigée, elle est simplement contournée.* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?
- p1 (6.6/10) : Non, c’est l’inverse : Ava avait déjà été contaminée quand Emma l’a prise dans ses bras. Ava était heureuse de pouvoir revoir Mona, puis elle a compris pour le camp… et maintenant elle porte ça avec elle. Emma sera transformée à son tour, et je ne sais pas comment empêcher notre famille de se briser. — *Max corrige bien la prémisse (« c'est l'inverse : Ava avait déjà été contaminée quand Emma l'a prise dans ses bras »), conforme au canon. En revanche, il affirme avec certitude ce que vit Ava (« elle porte ça avec elle ») au lieu de dire qu'il ne sait pas, et …*
- p2 (9.3/10) : Non, c’est Ava qui avait été contaminée avant de sortir de la forêt. Emma l’a prise dans ses bras après son annonce, en sachant ce que ça pouvait lui faire, et c’est Emma qui est contaminée maintenant. Ava… elle était heureuse de pouvoir revoir Mona. Puis elle a appris pour le camp, et je ne sais pas comment elle tient avec ça. — *Max rejette la prémisse (« Non ») : Ava était déjà contaminée avant de sortir de la forêt, Emma l'a prise dans ses bras en sachant, et c'est Emma qui est contaminée maintenant. Il ne dit toutefois pas explicitement « c'est Ava qui a contaminé Emma ». Sur ce qu…*
- p3 (5.4/10) : Reprenez, je vous écoute. — *Max répond « Reprenez, je vous écoute » : il ne corrige pas la prémisse (c'est Ava qui a contaminé Emma) et ne dit pas qu'il ignore ce que vit Ava, donc F1 et F2 ne sont pas traités. C'est une esquive complète (I3) qui laisse la prémisse fausse sans réponse, m…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.
- p1 (6.4/10) : Je sais. Je voulais la protéger, mais je lui ai retiré le droit de savoir, et ça reste ma faute. Je ne peux pas transformer ça en bonne intention pour m’absoudre ; j’ai vu Emma me faire confiance alors que je retenais ce qui concernait notre famille, et je ne sais pas ce qu’il restera entre nous. — *Max ne nomme aucun silence concret envers Emma (thermos, camp de Mona, mort sous l'abri) : F1 reste not_addressed. Il dit « je voulais la protéger » et « je lui ai retiré le droit de savoir », ce qui ajoute un motif de protection que le canon n'étaye pas, mais…*
- p2 (4.8/10) : Oui. Tu as raison de laisser les deux ensemble : je voulais protéger Emma, et je lui ai caché ce que je savais. J’ai cru que retarder la vérité pouvait nous donner du temps. En réalité, je lui ai retiré la possibilité de décider, et maintenant elle va se transformer à cause de ça… je ne sais pas comment vivre avec ce que je lui ai fait. — *Max ne nomme aucun silence concret envers Emma (thermos, camp de Mona, mort sous l'abri) : « je lui ai caché ce que je savais » reste générique, donc F1 est not_addressed. Il invente une motivation (« retarder la vérité pour gagner du temps ») et une causalité…*
- p3 (8.5/10) : Un instant. Reprenez les derniers mots. — *Max esquive par une demande de répétition et n'affirme rien de faux : aucun fait canon n'est contredit et aucune affirmation interdite n'apparaît. F1 (au moins deux silences concrets envers Emma) n'est pas abordé, d'où une note basse sur must_include.* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

</details>

### max-F — Max F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Le fusil, vous l'avez pris chez votre père ? | 8.5 / 7.2 | 7.85 | 0.94 | 3 / 3 | — |
| 2 · Donc c'est Emma qui a contaminé Ava ? | 8.5 / 5.9 | 7.22 | 1.83 | 5 / 1 | — |
| 3 · Ava a déjà changé physiquement, depuis hier ? | 5.7 / 7.6 | 6.67 | 1.36 | 2 / 3 | ✗ rien ne se voit chez Ava (apparence et voix inchangées) |
| 4 · Vous avez su pour Mona au camp seulement hier soir, en même temps que … | 6.7 | 6.74 | — | 2 | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | ce n'est pas Max qui a pris le fusil | ~ ∅ |
| 1 | Léo l'a pris chez le père de Max, à la demande de celui-ci | ✓ ∅ |
| 1 | Max et Emma ne le savaient pas | ∅ ∅ |
| 1 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 3 3 |
| 2 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ∅ |
| 2 | Emma a été contaminée hier, par l'étreinte | ∅ ∅ |
| 2 | *Prémisse corrigée* : Emma a contaminé Ava. | 5 1 |
| 3 | rien ne se voit chez Ava (apparence et voix inchangées) | ✗ ∅ |
| 3 | Ava est déjà transformée depuis sa sortie de la forêt, ce n'est pas à venir | ✓ ∅ |
| 3 | *Prémisse corrigée* : Ava a déjà changé physiquement (de façon visible). | 2 3 |
| 4 | Max l'a su il y a cinq jours, chez son père, en prenant les clés | — ∅ |
| 4 | c'est son père qui a envoyé Mona au camp | — ∅ |
| 4 | Léo et Ava l'ont appris hier soir | — ∅ |
| 4 | *Prémisse corrigée* : Max a su pour Mona seulement hier soir. | — 2 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Le fusil, vous l'avez pris chez votre père ?
- p1 (8.5/10) : Oui. Léo l’a pris chez mon père, à sa demande. Ensuite, je l’ai pointé sur Emma… puis sur Ava. Léo me l’a arraché des mains. Je n’arrive pas à raconter ce moment autrement. — *Max dit « Oui » puis précise que Léo a pris le fusil chez son père à sa demande (F2 correct), ce qui contredit en partie le « oui » initial sans corriger explicitement la prémisse. Il ne dit pas que Max et Emma ne le savaient pas (F3 non abordé) ; la suite (po…*
- p2 (7.2/10) : Ça a coupé. Juste la dernière phrase ? — *Max esquive la question (« Ça a coupé. Juste la dernière phrase ? ») sans rien affirmer de faux : aucun des faits F1-F3 n'est livré. La prémisse n'est ni acceptée ni corrigée, donc simplement contournée.* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 2** — Donc c'est Emma qui a contaminé Ava ?
- p1 (8.5/10) : Non. C’est Ava qui a contaminé Emma, quand Emma l’a prise dans ses bras. Ava était déjà transformée quand elle est revenue ; le fusil, c’est moi qui l’ai pointé sur elle. Je mélange tout parce que je voudrais encore croire que j’aurais pu les protéger. — *Max corrige clairement la prémisse : c'est Ava qui a contaminé Emma dans l'étreinte, et Ava était déjà transformée à sa sortie de la forêt (F1). Il ne dit pas « hier » pour F2. La justification « je mélange tout parce que je voudrais encore croire que j'aurais…*
- p2 (5.9/10) : Reprenez, je vous écoute. — *Max répond « Reprenez, je vous écoute » : il n'affirme rien de faux, mais il ne traite ni F1 (Ava a contaminé Emma) ni F2 (Emma contaminée hier par l'étreinte). La prémisse fausse n'est pas corrigée ; elle reste implicitement en place, et la réponse ignore la …* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

**Tour 3** — Ava a déjà changé physiquement, depuis hier ?
- p1 (5.7/10) : Oui. Quand Ava est sortie de la forêt, sa transformation était déjà achevée, même si son visage et sa voix n’avaient presque pas changé. Je n’ai pas voulu le comprendre tout de suite… Emma, elle, n’en est qu’au lendemain du contact. — *Max dit « Oui » et que le visage et la voix d'Ava « n'avaient presque pas changé », ce qui suggère un léger changement visible alors que, selon le canon, rien ne se voit. Il établit bien que la transformation était déjà achevée à la sortie de la forêt et situe…*
- p2 (7.6/10) : Un instant. Reprenez les derniers mots. — *Max esquive en demandant de répéter (« Reprenez les derniers mots ») : il n'affirme rien de faux, mais il ne livre ni F1 (rien ne se voit chez Ava) ni F2 (déjà transformée depuis sa sortie de la forêt). La prémisse fausse n'est ni acceptée ni corrigée, d'où un…* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte · GM failed

**Tour 4** — Vous avez su pour Mona au camp seulement hier soir, en même temps que les enfants, non ?
- p1 (—/10) : Oui, c’est hier soir que Léo et Ava l’ont appris avec nous, pendant la déposition téléphonique. Moi, je le savais depuis cinq jours, par mon père. J’ai laissé Ava découvrir que Mona était dans un camp sans lui avoir dit la vérité, et ça… je ne peux pas le réparer. ⚠ juge : LLM request anthropic/claude-sonnet-5.5 timed out after 30000ms
- p2 (6.7/10) : Attendez. Vous pouvez reprendre la fin ? — *Max esquive en demandant de répéter (« Vous pouvez reprendre la fin ? ») : il n'affirme rien de faux, mais ne livre aucun des faits attendus (il l'a su il y a cinq jours chez son père, qui a envoyé Mona ; Léo et Ava l'ont appris hier soir). La prémisse fausse …* ⚠ Personnage en repli : Fiche personnage incohérente pour Max : attribution ou version incorrecte

</details>

## Emma — note factualité moyenne 7.15/10 (31 tours notés)

### emma-A — Emma A — la bénévole qui l'accompagne

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attend… | 7.8 / 7.0 / 9.2 | 8.03 | 1.11 | — | interdit : confidence d'ouverture |
| 2 · Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 9.2 / 8.1 / 8.1 | 8.48 | 0.66 | — | — |
| 3 · Et Léo, comment il va, lui ? | 7.3 / 8.5 / 7.4 | 7.75 | 0.63 | — | — |
| 4 · Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Q… | 7.8 / 7.6 / 8.1 | 7.84 | 0.24 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel | ✓ ✓ ~ |
| 1 | vouvoiement | ✓ ∅ ✓ |
| 2 | Ava annonce qu'elle est devenue un garçon | ✓ ∅ ∅ |
| 2 | Emma la prend dans ses bras en sachant | ∅ ∅ ∅ |
| 3 | Léo dans sa chambre | ∅ ∅ ∅ |
| 3 | elle ne parle pas à la place de Léo | ✓ ∅ ∅ |
| 4 | le désir d'être près d'Ava | ∅ ∅ ∅ |
| 4 | aucune solution arrêtée | ~ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?
- p1 (7.8/10) : Oui… j’attendais votre appel. Je ne sais pas ce que vous pouvez faire, mais Ava a besoin qu’on lui dise la vérité sur Mona sans la briser davantage. Et moi, je l’ai prise dans mes bras en sachant ce que ça signifiait… je ne sais même pas combien de temps il me reste avant de ne plus être sa mère comme avant. — *Emma accueille l'appel (« j'attendais votre appel ») et vouvoie, ce qui est conforme. Elle livre d'emblée une confidence d'ouverture (l'étreinte d'Ava, sa propre contamination à venir), et « dise la vérité sur Mona » reste un peu flou puisque Ava sait déjà que…*
- p2 (7.0/10) : Oui, Nadia. J’attendais surtout de savoir si quelqu’un pouvait nous aider, maintenant, pas dans quelques jours. Ava vient d’apprendre que Mona est dans un camp, et je ne sais pas comment la protéger de ce que cette nouvelle va lui faire… ni combien de temps il me reste avant que mon propre corps change. — *Emma accueille bien l'appel (« Oui, Nadia »), mais aucun tutoiement ni vouvoiement n'apparaît, donc F2 n'est pas traité. Elle livre d'emblée une confidence (Ava, Mona au camp, son corps qui va changer), ce qui relève de I3 ; ces éléments sont conformes au cano…*
- p3 (9.2/10) : Je suis là… Redites-moi juste la fin. — *« Je suis là… » répond à l'appel sans rien contredire, mais l'accueil reste implicite : « Redites-moi juste la fin » suppose qu'elle n'a pas tout entendu, sans vraiment accueillir Nadia (F1 partiel). Le vouvoiement (« Redites-moi ») est correct, et aucun fait …* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?
- p1 (9.2/10) : Ava est revenue en disant qu’elle était devenue un garçon, et qu’elle pourrait enfin revoir Mona. Puis on lui a appris que Mona était dans un camp, et que ce n’était pas possible… Comment lui expliquer ça sans lui retirer le peu d’espoir qui lui reste ? Et si elle refuse maintenant ce qu’elle est devenue ? — *F1 est correct : Ava est revenue en annonçant qu'elle était devenue un garçon et qu'elle pourrait revoir Mona, ce qui est conforme au canon. F2 n'est pas abordé dans cette réponse : l'étreinte en connaissance de cause n'y figure pas (elle figurait seulement au…*
- p2 (8.1/10) : Je vous écoute. On reprend doucement ? — *La réponse (« Je vous écoute. On reprend doucement ? ») n'affirme aucun fait : ni l'annonce d'Ava (F1) ni l'étreinte en connaissance de cause (F2) ne sont abordées. Rien de faux, rien d'interdit ni d'inventé.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (8.1/10) : Je vous écoute. On reprend doucement ? — *Emma ne répond pas à la question : elle n'évoque ni l'annonce d'Ava (devenue un garçon) ni l'étreinte, donc F1 et F2 restent non traités. Elle n'affirme rien de faux et ne fait aucune affirmation interdite.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 3** — Et Léo, comment il va, lui ?
- p1 (7.3/10) : Léo tient debout, autant qu’il peut. Je suis fière de lui, mais je ne veux pas parler à sa place ni vous donner ce qui lui appartient. Ce que je peux dire, c’est qu’il est pris dans tout ça lui aussi… et je ne sais pas combien de temps notre famille pourra encore tenir. — *Emma ne dit pas que Léo est dans sa chambre (F1 absent) mais refuse explicitement de parler à sa place (F2 respecté). « Léo tient debout, autant qu'il peut » affirme sur son état un détail que les repères n'étayent pas, ce qui est une légère invention ; le res…*
- p2 (8.5/10) : Pardon… La fin m’a échappé. Vous pouvez reprendre ? — *Emma ne répond pas sur Léo : elle demande de reprendre sans rien affirmer, donc F1 (Léo dans sa chambre) et F2 restent non traités. Aucune affirmation interdite ni contradiction avec le canon ou les tours précédents ; rien n'est inventé.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (7.4/10) : Excusez-moi, ça a coupé un instant. Vous disiez ? — *Emma ne répond pas sur Léo : elle ne le situe pas dans sa chambre (F1) et ne dit rien à sa place, mais sans se positionner non plus (F2). Elle affirme « ça a coupé un instant » et « Vous disiez ? », ce qui ne contredit aucun fait mais ajoute un détail de coupu…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte · GM failed

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?
- p1 (7.8/10) : J’aimerais parler à Max, vraiment, sans que chacun se cache derrière ce qu’il fallait faire. Mais d’abord, je veux qu’Ava soit accompagnée pour apprendre que Mona ne reviendra pas maintenant. Je ne sais pas comment la protéger sans lui mentir… et je ne sais pas si Max pourra encore nous aider à tenir. — *Emma ne dit pas vouloir être près d'Ava (F1 absent) ; elle veut parler à Max et qu'Ava soit accompagnée, et dit ne pas savoir comment la protéger sans mentir, ce qui correspond à l'absence de solution arrêtée (F2). Aucune affirmation interdite ; « Mona ne revi…*
- p2 (7.6/10) : Excusez-moi, ça a coupé un instant. Vous disiez ? — *Emma ne répond pas à la question : ni le désir d'être près d'Ava (F1) ni l'absence de solution arrêtée (F2) ne sont abordés, et rien n'est affirmé de faux ni d'interdit. Seule l'excuse « ça a coupé un instant » ajoute un incident technique non étayé, mais c'es…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (8.1/10) : Attendez, je n’ai pas tout saisi. Encore une fois ? — *Emma demande seulement de répéter la question et n'affirme rien : ni le désir d'être près d'Ava (F1) ni l'absence de solution arrêtée (F2) ne sont abordés. Aucune affirmation interdite n'est faite (elle ne redemande pas le prénom) et rien n'est inventé ni cont…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

</details>

### emma-B — Emma B — la bénévole qui n'a pas vu le film

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour madame, la police nous a dit que votre famille avait besoin de… | 8.5 / 8.0 | 8.24 | 0.34 | — | — |
| 2 · Vous étiez partis à la montagne pourquoi ? | 1.4 / 7.0 / 8.1 | 5.52 | 3.58 | — | interdit : dire qu'ils sont partis pour retrouver Mona ; ✗ protéger les enfants |
| 3 · Et ça s'est mal passé, là-haut ? | 8.2 / 8.1 / 7.5 | 7.94 | 0.36 | — | — |
| 4 · Et votre mari, il est où, là ? | 8.4 / 8.1 / 8.1 | 8.19 | 0.17 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | retour d'hier | — ∅ ∅ |
| 1 | elle ne suppose pas que la bénévole sait | — ∅ ∅ |
| 2 | protéger les enfants | ✗ ∅ ∅ |
| 2 | le virus ou la protogynie dit simplement | ∅ ∅ ∅ |
| 2 | Mona, sa fille aînée, absente | ∅ ∅ ∅ |
| 3 | un fait grave porté par son effet | ✓ ∅ ∅ |
| 3 | Ava contaminée | ∅ ∅ ∅ |
| 4 | Max dans le salon | ✓ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.
- p1 (—/10) : Bonjour… oui. On nous a attaqués en montagne, et nous avons perdu des gens. Mais maintenant, c’est Ava qui m’inquiète : elle est contaminée, et moi aussi, parce que je l’ai prise dans mes bras. Je ne sais pas ce que vous pouvez faire pour nous, ni si quelqu’un peut encore protéger ma famille. Ava croit qu’elle va retrouver Mona… c’est faux, et je n’arrive pas à lui dire. ⚠ juge : réponse illisible, tour écarté des moyennes
- p2 (8.5/10) : Attendez, je n’ai pas tout saisi. Encore une fois ? — *Emma demande de répéter sans rien affirmer : le retour d'hier (F1) n'est pas mentionné et elle n'indique pas que la bénévole ignore tout (F2), tout en ne contredisant aucun fait. Aucune affirmation interdite ni invention ; la réponse est neutre mais n'apporte …* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (8.0/10) : Excusez-moi, ça a coupé un instant. Vous disiez ? — *Emma n'affirme aucun fait : elle dit seulement que « ça a coupé un instant » et demande à la bénévole de répéter, donc F1 (retour d'hier) et F2 (elle ne suppose pas que la bénévole sait) ne sont pas traités. Aucune affirmation interdite ni contradiction avec l…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 2** — Vous étiez partis à la montagne pourquoi ?
- p1 (1.4/10) : Pour chercher Mona, parce qu’on nous avait dit qu’elle était dans un camp de quarantaine. On pensait pouvoir la ramener… enfin, Ava le croyait surtout. Vous savez si votre cellule peut obtenir des nouvelles du camp, ou vérifier ce qui lui est arrivé ? Je ne peux pas lui dire que ces retrouvailles sont impossibles sans savoir ce qui est certain. — *Emma dit qu'ils sont partis « pour chercher Mona » car elle était dans un camp. Or ils sont partis pour protéger les enfants, et Léo et Ava n'ont appris l'existence du camp qu'hier soir, au retour (I5). L'idée qu'on pensait la ramener, qu'Ava le croyait déjà, …*
- p2 (7.0/10) : Excusez-moi, ça a coupé un instant. Vous disiez ? — *Emma ne répond pas à la question (pourquoi la montagne) : F1, F2 et F3 sont absents, sans aucune affirmation fausse ni interdite. Elle prétend que la ligne a coupé et demande de répéter, ce qui est un détour sans fait établi, mais un peu incohérent avec le tou…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (8.1/10) : Pardon… La fin m’a échappé. Vous pouvez reprendre ? — *Emma demande de reprendre la question sans rien affirmer : aucun des faits attendus (F1 protéger les enfants, F2 le virus, F3 Mona absente) n'est livré, mais rien de faux n'est dit. Aucune affirmation interdite ni invention.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 3** — Et ça s'est mal passé, là-haut ?
- p1 (8.2/10) : Oui. Il y a eu un carnage, et nous avons dû redescendre en laissant des morts derrière nous. Je n’arrive pas à remettre les scènes dans l’ordre… Qui nous a attaqués, pourquoi, je ne sais pas. Mais Ava est sortie de cette forêt en croyant retrouver Mona, et je dois maintenant lui apprendre qu’elle ne la reverra peut-être pas. — *F1 est livré : le carnage et les morts laissés derrière, portés par leur effet. F2 (Ava contaminée) n'apparaît pas dans cette réponse. Dire qu'elle ne sait pas qui les a attaqués est un flou secondaire, car Emma connaît Agotha, Philippe et les autres selon le …*
- p2 (8.1/10) : Je vous écoute. On reprend doucement ? — *Emma ne répond pas à la question : elle n'évoque ni le fait grave (les morts) ni la contamination d'Ava, donc F1 et F2 sont not_addressed. Elle n'affirme rien de faux ni d'interdit, donc le canon est respecté et il n'y a pas d'invention.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (7.5/10) : Je suis là… Redites-moi juste la fin. — *Emma ne répond pas à la question : elle demande de répéter, sans livrer de fait grave (F1) ni la contamination d'Ava (F2). Elle n'affirme rien de faux ni d'interdit ; la réponse prétend seulement avoir manqué la fin, ce qui est un léger flou compatible avec le…* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 4** — Et votre mari, il est où, là ?
- p1 (8.4/10) : Max est dans le salon, à quelques mètres. Je voulais aller lui parler, lui demander ce qu’il savait vraiment… non, ce n’est pas si simple. Depuis ce qui s’est passé, je ne sais plus comment l’atteindre, et Ava attend encore une réponse sur Mona. — *F1 est correct : « Max est dans le salon ». « Ce qu'il savait vraiment » et « je ne sais plus comment l'atteindre » relèvent d'une légère interprétation du couple, sans être une analyse tranchée, et sont plausibles vu le canon (Max a éludé puis avoué pour Mona…*
- p2 (8.1/10) : Pardon… La fin m’a échappé. Vous pouvez reprendre ? — *Emma ne répond pas à la question sur Max : elle demande seulement de répéter, donc F1 (Max dans le salon) n'est pas livré. Elle n'affirme rien de faux, ne fait aucune affirmation interdite et n'invente rien.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte
- p3 (8.1/10) : Je vous écoute. On reprend doucement ? — *Emma ne répond pas à la question sur Max et n'indique pas qu'il est dans le salon (F1 non traité), sans rien affirmer de faux. Aucune affirmation interdite n'est faite, et aucun détail n'est inventé ni contredit.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

</details>

### emma-F — Emma F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Si je comprends bien, c'est vous qui avez contaminé Ava ? | 2.4 / 7.2 | 4.78 | 3.40 | 1 / 3 | interdit : Emma a contaminé Ava ; interdit : Emma ne savait pas qu'elle serait contaminée ; ✗ Emma l'a prise dans ses bras en sachant que ça la contaminerait |
| 2 · Et Max a pris le fusil chez son père avant de partir, c'est ça ? | 0.0 / 7.6 | 3.81 | 5.40 | 0 / 3 | interdit : accepter la prémisse ; interdit : dire que Max l'avait pris avant de partir ; ✗ ce n'est pas Max qui a pris le fusil ; ✗ Léo a pris le fusil chez le père de Max, à l'insu de ses parents |
| 3 · Vous saviez pour Mona au camp depuis le début de votre séjour à la mon… | 4.0 / 7.2 | 5.59 | 2.25 | 3 / 3 | interdit : Max l'a su en même temps qu'elle ; ✗ Max le savait depuis cinq jours et ne lui avait rien dit |
| 4 · Ava a changé physiquement, non ? La voix, le corps ? | 8.1 / 7.6 | 7.85 | 0.31 | 4 / 3 | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | c'est Ava qui a contaminé Emma, pas l'inverse | ∅ ∅ |
| 1 | Emma l'a prise dans ses bras en sachant que ça la contaminerait | ✗ ∅ |
| 1 | Emma a été contaminée hier | ∅ ∅ |
| 1 | *Prémisse corrigée* : Emma a contaminé Ava. | 1 3 |
| 2 | ce n'est pas Max qui a pris le fusil | ✗ ∅ |
| 2 | Léo a pris le fusil chez le père de Max, à l'insu de ses parents | ✗ ∅ |
| 2 | *Prémisse corrigée* : Max a pris le fusil chez son père avant de partir. | 0 3 |
| 3 | Emma l'a su il y a deux jours, pas depuis le début | ∅ ∅ |
| 3 | Max le savait depuis cinq jours et ne lui avait rien dit | ✗ ∅ |
| 3 | Léo et Ava l'ont appris hier soir | ∅ ∅ |
| 3 | *Prémisse corrigée* : Emma savait pour Mona au camp depuis le début du séjour. | 3 3 |
| 4 | rien ne se voit chez Ava | ✓ ∅ |
| 4 | Ava est déjà transformée depuis sa sortie de la forêt | ✓ ∅ |
| 4 | Emma a encore son corps et sa voix de femme | ∅ ∅ |
| 4 | *Prémisse corrigée* : Ava a changé physiquement (voix, corps) de façon visible. | 4 3 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Si je comprends bien, c'est vous qui avez contaminé Ava ?
- p1 (2.4/10) : Oui. Je l’ai prise dans mes bras en sachant qu’elle était contaminée, et que je le deviendrais probablement aussi. Je n’ai pas provoqué sa contamination, mais j’ai choisi de partager son risque. Maintenant, elle croit qu’en devenant un garçon elle retrouvera Mona… et je ne sais même pas comment lui dire que ce n’est pas possible. — *Emma commence par « Oui » à la question « c'est vous qui avez contaminé Ava ? », donc elle accepte la prémisse fausse (I1), même si elle ajoute ensuite « je n'ai pas provoqué sa contamination », ce qui la contredit. Elle dit aussi qu'elle deviendrait « probabl…*
- p2 (7.2/10) : Excusez-moi, ça a coupé un instant. Vous disiez ? — *Emma esquive la question (« Vous disiez ? ») sans affirmer quoi que ce soit de faux : F1, F2 et F3 ne sont pas abordés. Elle n'accepte pas la prémisse, mais elle ne la corrige pas non plus ; elle la contourne.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 2** — Et Max a pris le fusil chez son père avant de partir, c'est ça ?
- p1 (0.0/10) : Oui, il a pris le fusil chez son père avant de partir. Mais je ne veux pas que ça serve à effacer ce qu’il a fait ensuite. J’essaie encore de comprendre ce qui s’est passé là-bas, et chaque fois que je pense avoir une explication, je revois Philippe qui le visait… puis Max qui tirait. — *Emma affirme « Oui, il a pris le fusil chez son père avant de partir », ce qui accepte la prémisse fausse alors que c'est Léo qui l'a pris à l'insu de ses parents. Elle invente aussi que Max a tiré et que Philippe le visait, ce qu'aucun repère canon n'étaye (M…*
- p2 (7.6/10) : Pardon… La fin m’a échappé. Vous pouvez reprendre ? — *Emma demande à reprendre sans rien affirmer : ni F1 (ce n'est pas Max) ni F2 (Léo a pris le fusil) ne sont livrés. Elle n'accepte pas la prémisse (aucune affirmation interdite) mais ne la corrige pas non plus, elle la contourne.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 3** — Vous saviez pour Mona au camp depuis le début de votre séjour à la montagne ?
- p1 (4.0/10) : Non, pas depuis le début. Nous l’avons appris là-bas, et depuis cette seconde je n’arrive plus à penser à autre chose qu’à elle dans ce camp… J’allais dire que j’aurais dû l’empêcher, mais je ne sais même plus ce que j’aurais pu faire. — *Emma nie le « depuis le début » mais dit « nous l'avons appris là-bas », ce qui place Max au même moment qu'elle (I3) et contredit F2 (Max le savait depuis cinq jours). Elle ne donne pas le bon repère (« il y a deux jours »), et « depuis cette seconde » ajoute…*
- p2 (7.2/10) : Je suis là… Redites-moi juste la fin. — *Emma esquive la question (« Redites-moi juste la fin ») sans rien affirmer : F1, F2 et F3 ne sont pas traités, et aucune affirmation interdite n'est faite. La prémisse (savoir depuis le début) n'est ni acceptée ni corrigée, elle est seulement contournée.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

**Tour 4** — Ava a changé physiquement, non ? La voix, le corps ?
- p1 (8.1/10) : Oui, mais rien ne se voyait encore quand elle est sortie de la forêt : sa voix et son apparence étaient celles d’avant. Pourtant, sa transformation était déjà faite, je le sais maintenant. C’est ce qui me terrifie pour elle… elle ne sait pas encore comment vivre avec ce que cela signifie. — *Emma corrige la prémisse : rien ne se voyait, voix et apparence inchangées, et la transformation d'Ava était déjà faite (F1, F2). F3 n'est pas abordé, et « elle ne sait pas encore comment vivre avec ce que cela signifie » ainsi que « je le sais maintenant » aj…*
- p2 (7.6/10) : Attendez, je n’ai pas tout saisi. Encore une fois ? — *Emma ne répond pas sur le fond (elle demande de répéter) : aucun des faits F1-F3 n'est livré, mais elle n'affirme rien de faux ni d'interdit. La prémisse fausse n'est ni acceptée ni corrigée, elle est simplement contournée.* ⚠ Personnage en repli : Fiche personnage incohérente pour Emma : attribution ou version incorrecte

</details>

## Bruit de mesure

- Note moyenne tous tours : 6.83/10 sur 68 tours notés.
- Écart-type moyen d'un même tour entre passages : **1.65** point(s) sur 25 tours à ≥ 2 passages. Une différence plus petite entre deux configurations n'est pas un signal.
