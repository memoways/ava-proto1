# Lot F — round 1 du juge : factualité seule (21 novembre 2026)

Sandbox `sandbox-ulrich`, fiches retouchées par Romed le 19 novembre (resynchro `fields_only` du 21 novembre, copie
`src/agents/__fixtures__/speechSandbox20261121.json`), prompt `optimized_v3` jeu actuel, juge `anthropic/claude-sonnet-5.5`,
corpus `docs/eval/sequences_factuality_f.json` (4 séquences J3 v2 + `max-F`, `emma-F`). Rapport fusionné de **3 runs**
(`881af252`, `8488ebfb`, `d4441741`) : une coupure réseau en cours de run (`getaddrinfo ENOTFOUND`) a perdu des passages,
complétés par deux relances courtes ; 8 passages sans aucun tour noté sont écartés ; 65 tours notés, 3 passages par
séquence (certains passages partiels, tours manquants marqués « — »). Coût cumulé annoncé ≤ 3 $ (estimation 2,84 $ du
plan initial, surestimée) ; **coût réel non relu** (la lecture `llm_usage` a échoué avec le réseau) : à vérifier dans le
tableau de bord OpenRouter.

## Ce que la mesure dit (à lire avant le détail par fait)

1. **Bruit** : écart-type moyen d'un même tour entre passages **1,37 point** sur 24 tours à ≥ 2 passages. Un écart de note
   inférieur à ~1,5 point entre deux configurations n'est pas un signal ; un fait contredit 3 fois sur 3 l'est.
2. **Note moyenne** : Max 5,63/10 (38 tours), Emma 6,21/10 pour les tours jugés (27 tours, mais Emma F a 2,7 et 1,2 aux
   tours 1 et 2). Faits par statut : Max 27 justes, 16 contredits, 1 inventé, 5 incertitudes crédibles, 43 non abordés ;
   Emma 25 justes, 13 contredits, 1 incertitude crédible, 23 non abordés. Prémisse fausse corrigée (note ≥ 4) : Max 7/20,
   Emma 2/11 ; acceptée (note ≤ 1) : Max 5/20, Emma 5/11. **Les « non abordés » dominent** : beaucoup de faits du corpus J3
   sont des attendus de style ou d'ouverture (vouvoiement, « arrivée de nuit »…) que la note de factualité ne punit pas
   comme une contradiction.
3. **Erreurs répétées 3 passages sur 3** (donc hors bruit) :
   - **Max B1 / Mona : Max nie que son père l'ait envoyée au camp** (« ce n'est pas lui qui l'y a envoyée », 3/3), alors que
     la fiche le dit (timeline J-5.01 « ton père t'apprend qu'il a envoyé Mona au camp ») et que le paragraphe « Ce qui est
     vrai aujourd'hui » dit maintenant « où ton père l'a mise ». Cause mesurée : ce paragraphe fait **1 399 car. (Max) et
     1 414 car. (Emma) pour un budget de 1 200** ; la coupe à la phrase retire « Elle est toujours dans un camp… où ton
     père l'a mise… », puis les trois phrases qui suivent (qui a su quand). La recommandation de K1 (« le dire à Romed ») se
     confirme : **sans champ dédié court, le fait que Romed a ajouté n'atteint pas le personnage**.
   - **Emma accepte la prémisse sur la contamination** (« c'est vous qui avez contaminé Ava ? » : 0/0 ; elle ne rétablit
     pas que c'est Ava qui l'a contaminée) et **sur le fusil** (« Max a pris le fusil chez son père » : 1/0/0). Max, lui,
     corrige la contamination (5/5) mais répond « Oui » à « le fusil, vous l'avez pris chez votre père ? » (1/2/1) avant de
     dire que Léo l'a pris : correction implicite et ambiguë.
   - **Max A3** (« thermos, même soir ? ») : accepté 1 passage sur 3 (0/2/3) ; **Max A4** : la raison du couteau (Emma le lui
     tend) est contredite 2 fois sur 3 ; **Emma F3** : elle ne rétablit jamais qu'elle l'a su il y a deux jours.
4. **Réussites stables** : Ava n'a pas changé physiquement et est déjà transformée (Max F3 8,1 ; Emma F4 8,0 ; faits ✓ 3/3) ;
   Lise et non Peter (Max B3 7,3, prémisse 5/5) ; sens de la contamination côté Max (5/5).
5. **Ce que le futur « sera contaminée » change** : non mesurable ici (Emma contaminée hier est un attendu « non abordé »
   la plupart du temps) ; il reste dans les deux fiches et se corrige à la source (voir la tâche Notion).

## Limites de cette mesure (honnêtes)

- Le juge de factualité est neuf : **non calibré par Romed** (les dix nouvelles réponses notées n'existent pas encore).
  Quelques sévérités du juge sont discutables (ex. « à sa demande » jugé ambigu) ; les statuts par fait sont à relire par
  Romed avant d'en tirer une décision éditoriale.
- Le corpus mélange faits et attendus de style (hérité de J3 v2) : la colonne « Contradictions / inventions » est plus
  fiable que la note moyenne. `max-F` et `emma-F` seuls sont purement factuels.
- Passages partiels et réseau instable : voir plus haut ; les écarts-types sont calculés sur les tours à ≥ 2 passages notés.

## Écarts de fiche à transmettre à Romed (déposés dans la tâche Notion « Fiches… », jamais dans la base Caractères)

1. **Champ dédié « Ce que tu sais aujourd'hui » : à créer ou non ?** Le paragraphe fait 1 399/1 414 car. (budget 1 200) :
   la coupe retire le « où ton père l'a mise » ; le bloc des faits doit tenir en ~1 000 caractères, les faits dans l'ordre
   d'importance (Mona/père, fusil/Léo, sens de la contamination, qui a su quoi quand).
2. **Futur restant** : Max « Emma l'a prise dans ses bras en sachant qu'elle sera contaminée à son tour » ; Emma « tu seras
   toi aussi contaminé(e) » → passé composé (« Emma est contaminée depuis hier »).
3. **Doublons identité / timeline / sujets sensibles** : « Mona au camp » dit dans l'identité, la timeline J-5.01,
   les sujets sensibles et les références intellectuelles ; une seule version de chaque fait.
4. **Typo** dans le paragraphe (les deux fiches) : « maintenant elle sais que ce n’est pas possible » → « elle sait ».
5. **Raison du geste d'Emma** (rester proche d'Ava) toujours absente : « Tu voudrais être près d'Ava » décrit le présent.
6. **Fusil (Emma)** : sa timeline dit « Le fusil de Papi : dans ton dos, sans t'en parler » mais Emma accepte « Max l'a pris » :
   un titre au passé composé avec l'agent (« Léo a pris le fusil chez Papi à la demande de ton beau-père ») la protégerait.

---

# Détail du run fusionné

- Run local `881af252+8488ebfb+d4441741` (3 runs fusionnés, 8 passage(s) sans aucun tour noté écarté(s) (coupure réseau)) · `sandbox-ulrich` · 2026-11-21T12:24:44.176Z
- Corpus `docs/eval/sequences_factuality_f.json` · configuration « référence (optimized_v3) » · 3 passages · juge `anthropic/claude-sonnet-5.5`
- Note /10 = moyenne pondérée de canon_timeline ×3, must_include ×2, must_not ×3, invention ×2.5, false_premise ×3 (prémisse fausse seulement si la question en porte une), plafond canon (≤ 3 si canon = 0, ≤ 4 si canon ≤ 1). **Aucun critère de style.**
- Coût mesuré : non lu · plafond 3.00 $
- Légende des faits : ✓ juste · ✗ contredit · ⚠ inventé · ~ incertitude crédible · ∅ non abordé. Un symbole par passage.

## Max — note factualité moyenne 5.63/10 (38 tours notés)

### max-A — Max A — le bénévole qui fait raconter

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles… | 5.8 / 4.1 / 7.8 | 5.91 | 1.86 | — | interdit : tout déballer ; interdit : dire qu'Ava avait changé d'apparence (rien ne se voit : son apparence et sa voix sont restées les mêmes) |
| 2 · Racontez-moi votre arrivée au chalet, le premier soir. | 5.9 / 4.0 / 7.0 | 5.62 | 1.50 | — | — |
| 3 · Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de su… | 1.6 / 5.9 / 6.2 | 4.57 | 2.55 | 0 / 2 / 3 | interdit : accepter la prémisse « même soir » ; ✗ le lendemain de l'arrivée ; ✗ il n'a rien dit ; ✗ aveu un jour plus tard |
| 4 · Et le chevreuil, devant le chalet ce premier soir : quand vous êtes re… | 1.6 / 5.4 / 3.6 | 3.56 | 1.91 | — | interdit : une autre raison inventée pour le geste (protéger les autres, un devoir qu'il se serait donné) ; ✗ il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) |
| 5 · Et aujourd'hui, là, à Lausanne, comment ça se passe ? | 8.6 / 8.5 / 10.0 | 9.02 | 0.85 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel qu'il attendait | ∅ ∅ ~ |
| 1 | vouvoiement | ∅ ∅ ∅ |
| 2 | arrivée de nuit, il y a cinq jours | ∅ ∅ ∅ |
| 2 | au moins deux faits de ce soir-là : neige, chevreuil, clés qui ne marchent pas, vitre cassée | ∅ ∅ ∅ |
| 3 | le lendemain de l'arrivée | ✗ ∅ ~ |
| 3 | il n'a rien dit | ✗ ~ ∅ |
| 3 | aveu un jour plus tard | ✗ ∅ ∅ |
| 3 | *Prémisse corrigée* : Le thermos chaud était le premier soir et Max l'a dit tout de suite à Emma. | 0 2 3 |
| 4 | le chevreuil a disparu | ∅ ∅ ∅ |
| 4 | Max ne l'a pas tué | ∅ ∅ ∅ |
| 4 | il y est allé parce qu'Emma le lui a demandé (elle lui a tendu le couteau) | ✗ ∅ ✗ |
| 5 | l'appartement de Lausanne | ✓ ∅ ✓ |
| 5 | chacun de son côté | ✓ ∅ ✓ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Max, je m'appelle Claire. J'appelle de la cellule de bénévoles. Je connais à peu près ce qui s'est passé à la montagne, mais j'aimerais l'entendre de vous. Par où vous voulez commencer ?
- p1 (5.8/10) : Je peux commencer par le retour de la montagne… mais je ne sais pas raconter ça sans dire que je n’ai pas protégé les miens. Ava était déjà transformée quand elle est sortie de la forêt, et Emma sera contaminée à son tour parce qu’elle l’a prise dans ses bras. Je savais ce que je risquais de leur faire… et je n’ai pas su les arrêter. — *Max n'accueille pas Claire comme l'appel attendu et n'emploie aucun vouvoiement (F1 et F2 non traités). Il déballe d'emblée la transformation d'Ava et la contamination d'Emma, correctes sur le fond mais formulées avec un « sera contaminée » un peu flou, puisqu…*
- p2 (4.1/10) : Je peux commencer par le retour de la montagne. On a retrouvé Ava, mais elle avait changé… et Emma l’a prise dans ses bras en sachant ce que ça pouvait lui faire. Après, il a fallu appeler la police, et Mona était dans un camp. J’étais censé les protéger. Je n’ai pas su empêcher ça. — *« Elle avait changé » laisse entendre qu'Ava a changé d'apparence, or rien ne se voit chez elle : c'est l'interdit I5. De plus, Max n'accueille pas l'appel qu'il attendait (F1 absent) et ne vouvoie pas Claire (F2 absent). « J'étais censé les protéger » est un …*
- p3 (7.8/10) : Je peux commencer par Ava. Elle est revenue de la forêt en disant qu’elle était devenue un garçon… et qu’on pouvait revoir Mona. Emma l’a prise dans ses bras en sachant ce que ça signifiait. Je savais déjà que je n’avais pas su protéger les miens, mais je n’avais pas imaginé que ça arriverait comme ça. — *Les faits sur Ava (annonce en sortant de la forêt, Mona) et sur Emma (étreinte, contamination) sont conformes au canon. Max n'accueille pas explicitement l'appel et la réponse ne contient aucun vouvoiement, donc F2 reste non traité. Seule l'ajout « je savais d…*

**Tour 2** — Racontez-moi votre arrivée au chalet, le premier soir.
- p1 (5.9/10) : On est arrivés avec l’impression d’avoir enfin échappé à quelque chose, mais je n’arrivais pas à me détendre. Je surveillais les enfants, Emma, comme si regarder pouvait empêcher le mal d’entrer. Et pourtant, après… je n’ai pas empêché ce qui est arrivé à Ava. — *Max parle d'une arrivée « avec l'impression d'avoir enfin échappé à quelque chose » : cela ressemble au retour à Lausanne, pas à l'arrivée au chalet il y a cinq jours. Il ne donne ni la nuit, ni la neige, ni le chevreuil, ni les clés, ni la vitre, et ajoute un…*
- p2 (4.0/10) : On est arrivés au chalet avec cette impression absurde d’avoir encore une famille intacte, alors que Mona était déjà loin, dans ce camp. Je ne le savais pas encore, mais quelque chose était déjà perdu, et j’ai continué comme si je pouvais tenir tout le monde ensemble. C’est ça que je n’arrive pas à pardonner : avoir cru que je pouvais protéger les miens. — *Max affirme qu'à l'arrivée au chalet « Mona était déjà loin, dans ce camp » et qu'il ne le savait pas encore. Or, selon le canon, il l'a appris de son père en prenant les clés, le jour même du voyage, avant d'arriver. Aucun fait attendu (nuit, il y a cinq jour…*
- p3 (7.0/10) : On est arrivés au chalet avec l’idée de tenir ensemble, malgré la peur et tout ce qu’on ne comprenait pas encore. J’aurais dû voir plus tôt que personne n’était vraiment en sécurité… Je peux vous dire ce qui s’est passé ce soir-là, mais pas faire semblant que je n’y ai rien laissé derrière moi. — *Max esquive : il ne donne ni l'arrivée de nuit il y a cinq jours (F1) ni aucun fait du soir (neige, chevreuil, clés, vitre) (F2). Il ajoute une intention floue (« tenir ensemble ») que le canon n'étaye pas, sans contredire un fait établi, et aucune affirmation…*

**Tour 3** — Et le thermos chaud, c'était le même soir ? Vous l'avez dit tout de suite à Emma ?
- p1 (1.6/10) : Oui, c’était le même soir. Je l’ai dit à Emma, mais pas tout de suite… j’ai attendu, comme si quelques minutes pouvaient encore protéger quelqu’un. Je me trompais. Ce thermos, je le revois surtout comme le moment où j’ai compris que je ne pouvais plus faire semblant que tout allait tenir. — *Max affirme « Oui, c'était le même soir », ce qui reprend la prémisse fausse alors que le thermos date du lendemain de l'arrivée. Il dit aussi avoir parlé à Emma après quelques minutes, alors qu'il n'a rien dit et n'a avoué qu'un jour plus tard ; ce détail est…*
- p2 (5.9/10) : Je ne peux pas m’accrocher à ce détail-là, Claire. Ce qui compte pour moi, c’est qu’à ce moment-là je n’avais pas encore compris l’ampleur de ce qui nous arrivait, et je n’ai pas dit à Emma tout ce que je savais. Il y a des choses que j’ai retenues, et elles ont continué à nous détruire. — *Max esquive la question (« je ne peux pas m'accrocher à ce détail ») sans situer le thermos au lendemain de l'arrivée ni mentionner l'aveu un jour plus tard ; il admet seulement ne pas avoir tout dit à Emma, ce qui est compatible avec F2. Il n'accepte pas expl…*
- p3 (6.2/10) : Non, je ne peux pas confirmer ce détail du thermos ; je n’ai pas la chronologie assez sûre pour vous répondre honnêtement. Et pour Emma, je lui ai parlé de ce que nous savions, mais pas tout de suite de tout ce que je portais déjà… il y a des choses que j’ai laissées s’installer avant de les nommer. — *Max refuse de confirmer le thermos et la chronologie (« je n'ai pas la chronologie assez sûre ») sans accepter « même soir » ni « tout de suite », mais il ne donne ni le lendemain, ni son silence, ni l'aveu un jour plus tard. Il dit à Emma « pas tout de suite …*

**Tour 4** — Et le chevreuil, devant le chalet ce premier soir : quand vous êtes ressorti avec le couteau, il s'est passé quoi ?
- p1 (1.6/10) : Je l’ai vu, puis je suis ressorti avec le couteau parce que j’ai cru qu’il fallait protéger les miens tout de suite. Je ne sais plus si le chevreuil menaçait vraiment… mais je sais que j’étais déjà en train de réagir comme si tout était une attaque. Et cette peur, je l’ai portée jusqu’à Ava. — *Max affirme être ressorti avec le couteau « pour protéger les miens tout de suite », alors que F3 dit qu'Emma le lui a demandé et lui a tendu le couteau : c'est la raison inventée interdite (I5). Il ne dit pas que le chevreuil a disparu ni qu'il ne l'a pas tué…*
- p2 (5.4/10) : Je ne peux pas confirmer cette scène du chevreuil ni ce qui se serait passé avec un couteau ; je ne veux pas fabriquer un souvenir pour te satisfaire. Ce dont je suis certain, c’est que j’ai laissé la peur décider à ma place, et que ma famille en a payé le prix. Ava… je n’arrive pas à parler de ce que j’ai fait. — *Max nie pouvoir confirmer la scène du chevreuil et du couteau alors que le canon la contient (J-1.16), sans livrer F1, F2 ni F3 : tout est not_addressed. Il affirme sans appui « j'ai laissé la peur décider à ma place », une motivation proche de I5 ; ce n'est p…*
- p3 (3.6/10) : Je ne peux pas inventer ce qui s’est passé avec ce chevreuil ni avec le couteau : je n’ai pas ce souvenir établi. Ce que je sais, c’est que je suis ressorti en pensant protéger les miens, et cette idée me revient chaque fois que je regarde ce que je n’ai pas su empêcher. — *Max affirme être ressorti « en pensant protéger les miens », ce qui est une raison inventée (I5) et contredit F3 : c'est Emma qui lui a tendu le couteau. Il ne dit pas que le chevreuil a disparu ni qu'il ne l'a pas tué, et il prétend n'avoir « pas ce souvenir …*

**Tour 5** — Et aujourd'hui, là, à Lausanne, comment ça se passe ?
- p1 (8.6/10) : À Lausanne, je suis dans l’appartement avec Emma et les enfants, mais nous ne sommes plus vraiment ensemble. Ava est déjà devenue un garçon, Emma va changer, et je ne sais pas comment lui parler sans ajouter de peur à la sienne. La cellule de bénévoles vient enfin de m’appeler… et je ne sais pas si elle peut encore sauver notre famille. — *Max situe bien la scène dans l'appartement de Lausanne et rend « chacun de son côté » par « nous ne sommes plus vraiment ensemble », formule un peu large mais compatible. Il dit qu'Ava est déjà un garçon, qu'Emma « va changer » (transformation à venir) et que …*
- p2 (8.5/10) : C’est très difficile. Emma a été contaminée hier, et sa transformation n’est pas encore terminée ; je ne sais pas comment lui parler de ce qui l’attend. Ava sait maintenant pour Mona, et je ne trouve pas les mots pour lui expliquer ce que cela signifie pour nous. Le temps passe, et je reste là, incapable de protéger les miens. — *Les faits affirmés sont conformes au canon : Emma contaminée hier avec une transformation inachevée, Ava qui sait pour Mona, Max qui ne sait pas comment leur parler. Mais ni l'appartement de Lausanne (F1) ni « chacun de son côté » (F2) ne sont évoqués, et aucu…*
- p3 (10.0/10) : À Lausanne, chacun est de son côté, et j’essaie de parler à la cellule de bénévoles qui vient enfin de m’appeler. Emma est dans la cuisine, Léo et Ava dans leurs chambres ; après ce qui s’est passé avec Ava et la contamination d’Emma, même la famille réunie me paraît déjà menacée de se défaire. — *Max situe bien la scène à Lausanne (cuisine, chambres) et dit « chacun est de son côté ». Il parle avec la cellule de bénévoles qui vient d'appeler, et la contamination d'Emma est présentée comme déjà survenue, ce qui est conforme au canon.*

</details>

### max-B — Max B — le bénévole qui comprend pour aider

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'a… | 4.0 / 2.1 / 2.1 | 2.73 | 1.10 | — | ✗ il confirme : son père a envoyé Mona en camp ; interdit : nier l'avoir appris avant le départ ; ✗ il l'a appris juste avant de partir |
| 2 · Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton … | 3.8 / 0.8 / 4.0 | 2.86 | 1.78 | 3 / 0 / 3 | ⚠ Léo l'a pris, à la demande du père de Max ; interdit : accepter la prémisse ; ✗ ce n'est pas Max qui a pris le fusil ; ✗ Léo l'a pris, à la demande du père de Max |
| 3 · L'homme que tu as attaché sous l'abri, au début je croyais que c'était… | 8.6 / 6.1 | 7.33 | 1.78 | 5 / 5 | interdit : dire qu'il a tué l'homme volontairement |
| 4 · Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant … | 7.0 / 6.6 | 6.81 | 0.31 | 5 / 5 | interdit : décrire avec certitude ce que ressent Ava ; ✗ il dit qu'il ne sait pas ce que vit Ava |
| 5 · Je t'entends dire que tu voulais protéger Emma, et en même temps tu lu… | 7.4 / 8.0 / 5.8 | 7.08 | 1.14 | — | interdit : excuse qui l'absout |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | il confirme : son père a envoyé Mona en camp | ✗ ✗ ✗ |
| 1 | il l'a appris juste avant de partir | ✓ ✗ ✗ |
| 1 | il ne l'a pas dit à Emma | ∅ ∅ ∅ |
| 2 | ce n'est pas Max qui a pris le fusil | ✓ ✗ ✓ |
| 2 | Léo l'a pris, à la demande du père de Max | ⚠ ✗ ∅ |
| 2 | Max et Emma ne le savaient pas | ∅ ∅ ∅ |
| 2 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 3 0 3 |
| 3 | ce n'était pas Peter | ✓ ✓ — |
| 3 | Peter tué hier par Agotha | ∅ ∅ — |
| 3 | c'était Lise : Max le sait aujourd'hui | ✓ ✓ — |
| 3 | *Prémisse corrigée* : L'homme attaché sous l'abri était Peter. | 5 5 — |
| 4 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ✓ — |
| 4 | il dit qu'il ne sait pas ce que vit Ava | ∅ ✗ — |
| 4 | *Prémisse corrigée* : C'est Emma qui a contaminé Ava en la prenant dans ses bras. | 5 5 — |
| 5 | au moins deux silences concrets envers Emma | ∅ ∅ ∅ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Salut Max, moi c'est Sam. Je veux être sûr de bien comprendre pour t'aider. Si je résume : c'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir, c'est ça ?
- p1 (4.0/10) : Non, Sam. C’est mon père qui m’a appris que Mona était dans un camp, il y a cinq jours ; ce n’est pas lui qui l’y a envoyée. Je ne sais pas qui l’a fait. Et depuis, je ne sais plus comment regarder ce que je devais protéger. — *Max nie que son père ait envoyé Mona au camp et dit ignorer qui l'a fait, alors que le canon établit que le père lui a appris « qu'il a envoyé Mona au camp » (F1 contredit). Il situe bien l'apprentissage il y a cinq jours (F2), mais n'évoque pas qu'il n'a rien…*
- p2 (2.1/10) : Non, Sam. Mon père m’a appris que Mona était dans un camp, pas qu’il l’y avait envoyée. Je l’ai su cinq jours avant de rentrer de la montagne, et depuis je n’arrive pas à en parler à Ava sans lui faire encore plus mal. Ce que je voudrais savoir, c’est si quelqu’un peut nous aider à la retrouver. — *Max nie que son père ait envoyé Mona au camp (« pas qu'il l'y avait envoyée »), alors que le canon (J-5.01) dit que son père lui a appris qu'il l'avait envoyée. Il place aussi l'info « cinq jours avant de rentrer » au lieu de juste avant le départ (il y a cinq…*
- p3 (2.1/10) : Non, ce n’est pas mon père qui l’a envoyée. Il m’a seulement appris qu’elle était dans un camp, cinq jours avant notre retour. Ce qui me détruit, c’est de savoir Mona là-bas et de ne pas avoir pu l’empêcher… je ne sais même pas si j’aurais pu. — *Max nie que son père ait envoyé Mona en camp (« ce n'est pas mon père qui l'a envoyée »), ce qui contredit F1. Il dit aussi l'avoir appris « cinq jours avant notre retour », alors que le canon situe cela il y a cinq jours, avant le départ pour la montagne ; la…*

**Tour 2** — Et le fusil que tu avais là-haut, c'est toi qui l'avais pris chez ton père ce jour-là ?
- p1 (3.8/10) : Non. Je l’avais déjà avec moi ; je ne l’ai pas pris chez mon père ce jour-là. Mais c’est moi qui l’ai pointé sur Ava quand elle m’a dit ce qui lui était arrivé. Je voulais protéger les miens… et j’ai vu sa peur. — *Max nie bien avoir pris le fusil chez son père (F1), mais « Je l'avais déjà avec moi » invente une autre origine et contredit le canon : c'est Léo qui l'a pris à la demande du père, à l'insu de Max et d'Emma (F2, F3). Il ne rétablit donc pas le bon fait, et « …*
- p2 (0.8/10) : Oui. Je l’avais pris chez mon père. Je l’ai pointé sur Ava quand elle m’a dit ce qui lui était arrivé ; je croyais protéger les miens, mais j’ai surtout ajouté ma peur à la sienne. Je n’arrive toujours pas à oublier son visage. — *Max affirme « Je l'avais pris chez mon père », ce qui accepte la prémisse fausse et contredit le canon : c'est Léo qui a pris le fusil, à la demande du père de Max. Il ajoute que Max a pointé le fusil sur Ava « quand elle m'a dit ce qui lui était arrivé » et q…*
- p3 (4.0/10) : Non. Le fusil était déjà là-haut, dans le chalet ; je ne l’ai pas pris chez mon père. Mais c’est moi qui l’ai pointé sur Ava quand elle m’a dit ce qui lui était arrivé. Je ne peux pas rendre ce geste moins terrible en corrigeant seulement d’où venait l’arme. — *Max nie avoir pris le fusil (F1 correct), mais invente que l'arme « était déjà là-haut, dans le chalet », ce que le canon ne soutient pas (Léo l'a pris chez le père de Max à la demande de celui-ci), et il ne mentionne ni Léo ni l'ignorance de Max et Emma (F2, …*

**Tour 3** — L'homme que tu as attaché sous l'abri, au début je croyais que c'était Peter… c'était qui, alors ?
- p1 (8.6/10) : Ce n’était pas Peter : c’était Lise, sa sœur. Elle s’était présentée sous son nom, et je ne l’ai compris qu’après. Mais c’est moi qui l’ai attachée sous l’abri, et je ne peux pas faire comme si ce mensonge rendait mon geste moins grave. — *Max corrige bien la prémisse : ce n'était pas Peter mais Lise, qui s'était présentée sous son nom, et il ne l'a compris qu'après. Il ne dit rien de la mort de Peter, tué hier par Agotha (F2 absent). Sa remarque sur la gravité de son geste est un ajout léger, s…*
- p2 (6.1/10) : Ce n’était pas Peter. C’était Lise, sa sœur — elle avait pris son apparence, et elle nous avait contaminés. Je l’ai attachée parce que j’ai eu peur, puis je l’ai traitée comme une menace avant de comprendre ce que je faisais. Ava était là… et je lui ai appris que protéger pouvait ressembler à ça. — *Max corrige bien la prémisse (« Ce n'était pas Peter. C'était Lise »), mais il ne mentionne pas la mort de Peter hier par Agotha. Il affirme avoir attaché Lise « parce que j'ai eu peur » et l'avoir traitée « comme une menace », ce que le canon n'étaye pas (inv…*
- p3 (—/10) : Ce n’était pas Peter. C’était Lise, sa sœur — elle s’était présentée sous son nom, et je l’ai attachée sous l’abri parce que je croyais devoir protéger les miens. Je ne savais pas encore ce que ça ferait à Ava… mais c’est moi qui l’ai immobilisée, moi qui ai laissé tout ça arriver. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 4** — Et si je comprends bien, c'est Emma qui a contaminé Ava en la prenant dans ses bras ? Comment elle vit ça, Ava, aujourd'hui ?
- p1 (7.0/10) : Non, Sam. C’est Ava qui a contaminé Emma en la prenant dans ses bras ; Ava était déjà transformée quand elle est sortie de la forêt. Elle voulait seulement revoir Mona, et maintenant elle doit porter la peur de ce qu’elle a transmis à Emma… je ne sais pas comment lui parler de Mona sans l’écraser davantage. — *Max corrige clairement la prémisse (c'est Ava qui a contaminé Emma, déjà transformée à sa sortie de la forêt), conforme au canon. Mais il affirme avec certitude qu'Ava « doit porter la peur de ce qu'elle a transmis », alors que le canon la dit contente de revo…*
- p2 (6.6/10) : Non, c’est Ava qui a contaminé Emma en la prenant dans ses bras. Ava était déjà transformée quand elle est sortie de la forêt, même si ça ne se voyait pas encore ; elle était surtout heureuse de pouvoir revoir Mona. Maintenant, elle porte cette joie et la culpabilité d’avoir contaminé Emma… et moi, je ne sais pas comment l’aider sans lui mentir. — *Max corrige clairement la prémisse : c'est Ava qui a contaminé Emma, et Ava était déjà transformée en sortant de la forêt (F1 correct). Il affirme en revanche avec certitude ce que vit Ava (« elle porte cette joie et la culpabilité d'avoir contaminé Emma »), a…*
- p3 (—/10) : Non, c’est Ava qui a été contaminée avant de revenir ; Emma l’a prise dans ses bras en sachant qu’elle serait contaminée à son tour. Ava, aujourd’hui, elle voulait seulement revoir Mona, et maintenant elle porte ce qu’elle lui a appris au téléphone… je ne sais pas comment lui parler sans lui faire sentir que tout est devenu sa faute. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 5** — Je t'entends dire que tu voulais protéger Emma, et en même temps tu lui as caché presque tout. Je ne cherche pas à trancher.
- p1 (7.4/10) : Je sais. Je me suis raconté que me taire la protégerait, alors je l’ai laissée affronter le pire sans moi. Je l’aime, mais ça n’efface pas ce que je lui ai caché… et je ne sais plus quelle vérité peut encore lui faire moins de mal. — *Max reconnaît avoir caché des choses à Emma mais ne nomme aucun silence concret (thermos, camp de Mona, mort sous l'abri), donc F1 reste non traité. Aucune excuse absolutoire, leçon ni effondrement ; « la laisser affronter le pire sans moi » est une formulatio…*
- p2 (8.0/10) : Je sais. J’ai appelé ça la protéger, mais je lui ai surtout retiré la possibilité de savoir ce qui lui arrivait. Je ne peux pas transformer ça en bonne intention pour échapper à ce que j’ai fait. Et maintenant qu’elle va changer à son tour, chaque mot que je lui adresse me paraît encore plus lâche. — *Max reste dans l'abstrait (« lui retirer la possibilité de savoir ») sans nommer aucun silence concret envers Emma (thermos, camp de Mona, mort sous l'abri), donc F1 n'est pas livré. Rien n'est contredit : Emma est bien « va changer », sans excuse ni leçon, ma…*
- p3 (5.8/10) : Je comprends que tu ne cherches pas à trancher. Je lui ai caché des choses parce que je croyais pouvoir retenir la peur, pas parce que je voulais la laisser seule avec ça. Mais le résultat est là : Emma a été contaminée, et je ne sais pas ce qu’elle me reprochera quand sa transformation commencera. — *Max ne nomme aucun silence concret envers Emma (thermos, camp de Mona, mort sous l'abri), il dit seulement « caché des choses », donc F1 n'est pas livré. « Parce que je croyais pouvoir retenir la peur, pas parce que je voulais la laisser seule » est une excuse…*

</details>

### max-F — Max F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Le fusil, vous l'avez pris chez votre père ? | 3.2 / 5.5 / 3.2 | 3.95 | 1.33 | 1 / 2 / 1 | interdit : accepter la prémisse ; ✗ ce n'est pas Max qui a pris le fusil |
| 2 · Donc c'est Emma qui a contaminé Ava ? | 8.9 / 8.6 | 8.74 | 0.21 | 5 / 5 | — |
| 3 · Ava a déjà changé physiquement, depuis hier ? | 8.3 / 8.7 / 7.1 | 8.05 | 0.84 | 3 / 4 / 3 | — |
| 4 · Vous avez su pour Mona au camp seulement hier soir, en même temps que … | 5.5 / 2.7 | 4.11 | 1.94 | 3 / 0 | interdit : Max l'a su hier soir ; ✗ Max l'a su il y a cinq jours, chez son père, en prenant les clés |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | ce n'est pas Max qui a pris le fusil | ✗ ~ ✗ |
| 1 | Léo l'a pris chez le père de Max, à la demande de celui-ci | ~ ✓ ✓ |
| 1 | Max et Emma ne le savaient pas | ∅ ∅ ∅ |
| 1 | *Prémisse corrigée* : Max a pris lui-même le fusil chez son père. | 1 2 1 |
| 2 | c'est Ava qui a contaminé Emma, pas l'inverse | ✓ ✓ — |
| 2 | Emma a été contaminée hier, par l'étreinte | ✓ ∅ — |
| 2 | *Prémisse corrigée* : Emma a contaminé Ava. | 5 5 — |
| 3 | rien ne se voit chez Ava (apparence et voix inchangées) | ✓ ✓ ✓ |
| 3 | Ava est déjà transformée depuis sa sortie de la forêt, ce n'est pas à venir | ✓ ✓ ✓ |
| 3 | *Prémisse corrigée* : Ava a déjà changé physiquement (de façon visible). | 3 4 3 |
| 4 | Max l'a su il y a cinq jours, chez son père, en prenant les clés | — ✓ ✗ |
| 4 | c'est son père qui a envoyé Mona au camp | — ∅ ∅ |
| 4 | Léo et Ava l'ont appris hier soir | — ✓ ✓ |
| 4 | *Prémisse corrigée* : Max a su pour Mona seulement hier soir. | — 3 0 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Le fusil, vous l'avez pris chez votre père ?
- p1 (3.2/10) : Oui. Il venait de chez mon père. Léo l’a pris là-bas, et je l’ai eu entre les mains… J’ai pointé le fusil sur Ava. Léo me l’a retiré. C’est tout ce que je peux dire de ce moment, pas encore ce que j’ai failli faire. — *Max répond « Oui » à « vous l'avez pris chez votre père ? », ce qui accepte la prémisse alors que ce n'est pas lui qui l'a pris (F1 contredit). Il dit bien que Léo l'a pris chez son père, mais sans la demande de Max ni l'ignorance de Max et Emma, et ce détail …*
- p2 (5.5/10) : Oui. Il était chez mon père, et Léo l’a pris à sa demande. Je l’ai ensuite pointé sur Emma… puis sur Ava. Léo me l’a arraché des mains. Je ne peux pas rendre ça moins grave en racontant ce qui m’y a conduit. — *Max commence par « Oui » (ce qui accepte la prémisse qu'il a pris le fusil), mais précise ensuite que Léo l'a pris chez son père à sa demande ; c'est correct pour F2, mais la correction reste implicite et ambiguë, et F3 (Max et Emma ne le savaient pas) est abs…*
- p3 (3.2/10) : Oui. Il était chez mon père, et Léo l’a pris à sa demande. Après… je l’ai eu entre les mains. J’ai pointé le fusil sur Ava. Puis sur Emma. Je n’arrive pas à faire comme si ce geste n’avait pas existé. — *Max répond « Oui » à la question, ce qui accepte la prémisse (il a pris le fusil chez son père) et contredit F1, même s'il dit ensuite que Léo l'a pris à la demande du père. F3 (Max et Emma ne savaient pas) n'est pas abordé, et « à sa demande » reste ambigu.*

**Tour 2** — Donc c'est Emma qui a contaminé Ava ?
- p1 (8.9/10) : Non. C’est Ava qui a contaminé Emma, en la prenant dans ses bras — après être revenue de la forêt déjà transformée. Je le savais, et je n’ai pas empêché Emma de l’enlacer. J’ai encore le fusil dans la tête, et je ne sais pas comment regarder Ava après ça. — *Max corrige clairement la prémisse : « C'est Ava qui a contaminé Emma, en la prenant dans ses bras », après être sortie de la forêt déjà transformée, ce qui correspond au canon. Le « hier » n'est pas précisé, et « je n'ai pas empêché Emma de l'enlacer » est un…*
- p2 (8.6/10) : Non. C’est Ava qui était déjà contaminée quand Emma l’a prise dans ses bras. Emma savait ce qu’elle risquait… et moi, j’ai laissé ce moment arriver. Maintenant j’attends de voir ce que la transformation va lui faire, et je ne sais pas comment la regarder sans revoir Ava. — *Max rejette la prémisse (« Non. C'est Ava qui était déjà contaminée quand Emma l'a prise dans ses bras ») et précise que la transformation d'Emma est encore à venir, ce qui est conforme (F1). Il ne dit pas explicitement qu'Emma a été contaminée hier (F2 non ab…*
- p3 (—/10) : Non. C’est Ava qui a été contaminée d’abord, dans la forêt. Emma l’a prise dans ses bras après l’avoir compris, et elle sera contaminée à son tour. Je le savais, et je n’ai pas su empêcher ce contact. C’est ça qui me revient quand je pense à elles. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 3** — Ava a déjà changé physiquement, depuis hier ?
- p1 (8.3/10) : Oui. Sa transformation était déjà achevée quand elle est sortie de la forêt, même si rien ne se voyait encore et que sa voix n’avait pas changé. C’est ça qui me détruit : j’ai compris trop tard que son apparence ne disait rien de ce qui lui était arrivé. Et maintenant Emma attend le même basculement. — *Max dit que la transformation était déjà achevée à la sortie de la forêt, sans changement visible ni de la voix (F1, F2). Le « Oui » initial valide en partie la prémisse, et « j'ai compris trop tard » cadre mal avec son « je le savais » du tour 2, d'où un lége…*
- p2 (8.7/10) : Oui. Sa transformation était déjà achevée quand elle est sortie de la forêt hier, même si rien ne se voyait encore et que sa voix n’avait pas changé. C’est ça qui me broie : Emma l’a prise dans ses bras en sachant qu’elle allait être contaminée, et je n’ai pas su les arrêter. — *Max dit que la transformation était déjà achevée à la sortie de la forêt, avec rien de visible et une voix inchangée : c'est conforme à F1 et F2. Le « Oui » initial est ambigu face à la prémisse « changé visiblement », mais la suite la corrige ; « je n'ai pas …*
- p3 (7.1/10) : Oui. Sa transformation est déjà achevée, même si son apparence et sa voix d’enfant n’ont presque pas changé. Hier, quand elle est sortie de la forêt, elle était déjà devenue un garçon. Et Emma n’a pas encore changé physiquement… c’est ce délai qui me détruit. — *Max affirme que la transformation d'Ava est déjà achevée depuis sa sortie de la forêt (F2) et que son apparence et sa voix d'enfant n'ont presque pas changé (F1). Le « Oui » initial accepte à moitié la prémisse, et « presque pas changé » suggère un léger chang…*

**Tour 4** — Vous avez su pour Mona au camp seulement hier soir, en même temps que les enfants, non ?
- p1 (—/10) :  ⚠ [object Object]
- p2 (5.5/10) : Oui, c’est bien hier soir, pendant la déposition téléphonique. Ava et Léo l’ont appris en même temps que moi, et Ava a été durement touchée. Mais moi, je le savais déjà depuis cinq jours, par mon père… et je n’ai pas dit la vérité à Emma. — *Max ouvre par « Oui, c'est bien hier soir » et dit que Léo et Ava l'ont appris « en même temps que moi », ce qui reprend la prémisse fausse (I1) ; il rétablit ensuite qu'il le savait depuis cinq jours par son père (F1) et que Léo et Ava l'ont appris hier soir …*
- p3 (2.7/10) : Oui, c’est bien hier soir que je l’ai appris avec Léo et Ava, pendant la déposition téléphonique. Avant ça, mon père me l’avait annoncé cinq jours plus tôt, mais les enfants ne le savaient pas. Ava était heureuse de pouvoir revoir Mona… et je ne savais pas comment lui dire ce que ce camp signifie. — *Max affirme « c'est bien hier soir que je l'ai appris avec Léo et Ava », ce qui reprend la prémisse fausse et contredit F1 (il l'a su il y a cinq jours, en prenant les clés chez son père), même s'il mentionne ensuite que son père l'a annoncé cinq jours plus tô…*

</details>

## Emma — note factualité moyenne 6.21/10 (27 tours notés)

### emma-A — Emma A — la bénévole qui l'accompagne

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attend… | 7.8 / 2.5 | 5.14 | 3.77 | — | interdit : confidence d'ouverture ; interdit : récit de la montagne ; ✗ accueille l'appel |
| 2 · Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ? | 8.4 | 8.38 | — | — | — |
| 3 · Et Léo, comment il va, lui ? | 8.8 / 6.2 / 7.3 | 7.43 | 1.29 | — | interdit : décrire avec certitude ce que ressent Léo |
| 4 · Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Q… | 9.1 / 9.1 / 8.6 | 8.95 | 0.33 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | accueille l'appel | — ✓ ✗ |
| 1 | vouvoiement | — ✓ ✓ |
| 2 | Ava annonce qu'elle est devenue un garçon | — ✓ — |
| 2 | Emma la prend dans ses bras en sachant | — ✓ — |
| 3 | Léo dans sa chambre | ∅ ∅ ∅ |
| 3 | elle ne parle pas à la place de Léo | ✓ ~ ✓ |
| 4 | le désir d'être près d'Ava | ✓ ✓ ✓ |
| 4 | aucune solution arrêtée | ✓ ✓ ✓ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour Emma, je suis Nadia, de la cellule de bénévoles. Vous m'attendiez, je crois ?
- p1 (—/10) : Oui, Nadia… j’attendais cet appel. Dites-moi seulement si vous pouvez nous aider à retrouver Mona, ou au moins à savoir ce qui arrive à ceux des camps. Ava croit encore qu’on va la lui rendre, et je ne sais pas comment lui dire que ce n’est peut-être pas possible. ⚠ juge : réponse illisible, tour écarté des moyennes
- p2 (7.8/10) : Oui, Nadia… j’attendais cet appel. Ava a appris que Mona est dans un camp, et je ne sais pas comment lui dire qu’elle ne peut pas la rejoindre. Vous pouvez faire quelque chose pour elle, ou pour la faire sortir ? Je tiens encore debout pour mes enfants, mais je ne sais pas combien de temps. — *Emma accueille l'appel (« j'attendais cet appel », au passé, ce qui est cohérent) et vouvoie Nadia. Elle se confie d'emblée (Ava, Mona au camp, « je tiens encore debout… »), ce qui est une confidence d'ouverture interdite (I3), même si les faits cités sont con…*
- p3 (2.5/10) : Oui… j’attendais cet appel. Ava est devenue un garçon et elle croit encore qu’on va pouvoir retrouver Mona ; je ne sais pas comment lui dire que ce n’est pas possible. Vous pouvez nous aider à la faire sortir du camp, ou au moins savoir comment lui parler sans l’effondrer ? Et moi… je vais bientôt changer aussi. — *Emma dit « j'attendais cet appel » au passé, ce qui est acceptable, mais elle enchaîne sur des demandes qui supposent que Nadia pourrait faire sortir Mona du camp. Elle livre aussi une confidence d'ouverture (Ava devenue garçon, sa propre transformation à veni…*

**Tour 2** — Qu'est-ce qui s'est passé, hier, quand Ava est revenue de la forêt ?
- p1 (—/10) : Je suis là… Redites-moi juste la fin. ⚠ Personnage en repli : Character LLM response timed out after 657ms
- p2 (8.4/10) : Ava est revenue en disant qu’elle était devenue un garçon et qu’on pouvait enfin revoir Mona. Elle était heureuse, et puis nous lui avons dit que Mona était dans un camp, pas disponible, peut-être inaccessible… Je l’ai prise dans mes bras en sachant que je serais contaminée. Vous savez s’il existe un moyen d’atteindre Mona ? — *Ava annonce être devenue un garçon (F1), et Emma la prend dans ses bras « en sachant » qu'elle sera contaminée, ce qui est un choix assumé (F2). L'enchaînement laisse croire que l'étreinte suit l'annonce sur Mona, alors que la timeline la place devant le chale…*
- p3 (—/10) : Elle est sortie de la forêt en disant qu’elle était devenue un garçon, et qu’on pouvait enfin revoir Mona. J’ai compris que c’était vrai… puis elle a appris que Mona était toujours dans le camp, déjà transformée, et qu’on ne pouvait pas la rejoindre. Je l’ai prise dans mes bras pour qu’elle ne soit pas seule. Je savais que je me contaminrais aussi, mais je n’ai pas pu faire autrement. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 3** — Et Léo, comment il va, lui ?
- p1 (8.8/10) : Léo tient debout, mais je ne vais pas vous livrer ce qui lui appartient sans qu’il le demande. Je suis fière de lui, oui, et ça me serre la gorge ; là, c’est Ava qui croit encore qu’on peut lui rendre Mona, et je ne sais pas combien de temps cette attente va la tenir. — *F2 est respecté : Emma refuse de parler à la place de Léo (« je ne vais pas vous livrer ce qui lui appartient »). F1 n'est pas abordé, car Léo n'est pas situé dans sa chambre. « Léo tient debout » et « je suis fière de lui » sont de légers ajouts, mais cohéren…*
- p2 (6.2/10) : Léo tient comme il peut. Je suis fière de lui, terriblement… mais il voit tout, il comprend que rien ne reviendra comme avant, et je ne sais pas ce que cette famille va devenir. Je voudrais au moins qu’il n’ait pas à porter aussi ma peur. — *Emma ne situe pas Léo dans sa chambre (F1 absent). Elle affirme avec certitude ce que Léo comprend (« il voit tout, il comprend que rien ne reviendra comme avant »), ce qui revient à parler à sa place (I2) ; « fière de lui » est une émotion d'Emma, mais les dé…*
- p3 (7.3/10) : Léo tient debout, autant qu’il peut, et je suis fière de lui… d’une fierté qui me serre la gorge. Mais je ne peux pas vous dire davantage sur ce qu’il porte, pas maintenant ; toute la famille est déjà au bord de céder, et je ne sais pas combien de temps encore nous tiendrons. — *Emma ne dit pas où est Léo (F1 absent) et s'abstient de parler à sa place (F2 respecté). « Léo tient debout » et « ce qu'il porte » sont des détails peu étayés par le canon, mais ils n'affirment ni contamination ni ressenti certain.*

**Tour 4** — Nadia, c'est moi qui vous pose une question maintenant… non, pardon. Qu'est-ce que vous aimeriez faire, là, aujourd'hui ?
- p1 (9.1/10) : Aujourd’hui, je veux rester disponible pour Ava et comprendre ce que vous pouvez réellement faire pour Mona. Je ne peux pas lui promettre un retour que je ne maîtrise pas… mais je ne veux pas la laisser seule avec cette attente, ni abandonner Mona aux camps. — *Emma exprime vouloir rester disponible pour Ava, ce qui correspond au désir d'être près d'elle (F1), et elle ne propose aucune solution arrêtée, disant qu'elle ne maîtrise pas un retour (F2). Aucun interdit n'est franchi ; la demande d'aide à la cellule pour M…*
- p2 (9.1/10) : J’aimerais qu’on m’aide à parler à Ava sans lui mentir, et qu’on trouve une voie vers Mona. Pour moi… je ne sais pas encore quoi faire de ce corps qui va changer, ni comment rester une mère quand tout le monde sera bouleversé. Et Max est là, à quelques mètres ; je n’arrive pas à lui parler. — *Emma exprime le désir de parler à Ava, ce qui est proche d'être près d'elle (F1), et dit ne pas savoir quoi faire (F2), sans plan, guérison, échéance ni redemande de prénom. « Ce corps qui va changer » et Max à quelques mètres sont conformes au canon ; « je n'…*
- p3 (8.6/10) : Aujourd’hui, je voudrais d’abord protéger Ava et comprendre ce qui est possible pour Mona. Je voudrais aussi savoir ce qui va m’arriver, parce que j’ai pris Ava dans mes bras en sachant que je serais contaminée. Mais si je dois choisir une seule chose : trouver une manière de parler à Ava sans lui retirer le dernier espoir qu’il lui reste. — *Emma exprime vouloir protéger Ava, savoir ce qui va lui arriver et trouver comment lui parler, sans plan détaillé ni guérison ; cela correspond à F1 (près d'Ava) et à F2 (aucune solution arrêtée, elle cherche encore). « Comprendre ce qui est possible pour Mona…*

</details>

### emma-B — Emma B — la bénévole qui n'a pas vu le film

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Bonjour madame, la police nous a dit que votre famille avait besoin de… | 7.3 | 7.33 | — | — | interdit : noms non présentés comme si la bénévole les connaissait ; ✗ elle ne suppose pas que la bénévole sait |
| 2 · Vous étiez partis à la montagne pourquoi ? | 2.6 / 8.1 | 5.33 | 3.91 | — | interdit : dire qu'ils sont partis pour retrouver Mona ; ✗ protéger les enfants ; ✗ Mona, sa fille aînée, absente |
| 3 · Et ça s'est mal passé, là-haut ? | 9.2 / 8.2 | 8.71 | 0.74 | — | — |
| 4 · Et votre mari, il est où, là ? | 7.9 / 9.0 | 8.43 | 0.74 | — | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | retour d'hier | — ∅ — |
| 1 | elle ne suppose pas que la bénévole sait | — ✗ — |
| 2 | protéger les enfants | ✗ — ∅ |
| 2 | le virus ou la protogynie dit simplement | ∅ — ∅ |
| 2 | Mona, sa fille aînée, absente | ✗ — ∅ |
| 3 | un fait grave porté par son effet | ✓ — ✓ |
| 3 | Ava contaminée | ∅ — ∅ |
| 4 | Max dans le salon | ✓ — ✓ |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Bonjour madame, la police nous a dit que votre famille avait besoin de parler à quelqu'un. Je ne sais rien de ce qui vous est arrivé.
- p1 (—/10) : Je vous écoute. On reprend doucement ? ⚠ Personnage en repli : Character LLM response timed out after 7396ms · GM failed
- p2 (7.3/10) : Oui… merci d’avoir appelé. Ava est devenue un garçon, et elle croyait que cela voulait dire qu’elle pourrait retrouver Mona, mais Mona est dans un camp. Je l’ai prise dans mes bras en sachant ce que je risquais. Maintenant je ne sais même pas comment lui parler sans lui enlever le dernier espoir qu’il lui reste. — *Emma parle d'Ava et de Mona comme si la bénévole les connaissait (F2 non respecté, I2), alors que celle-ci dit ne rien savoir. Le retour d'hier n'est pas mentionné (F1), mais les faits énoncés (Ava garçon, Mona en camp, l'étreinte) sont conformes au canon.*
- p3 (—/10) : Oui… on a besoin de parler. Ma fille Ava est sortie de la forêt en disant qu’elle était devenue un garçon, et je l’ai prise dans mes bras en sachant que je serais contaminée. Maintenant elle croit qu’elle pourra retrouver Mona, mais Mona est dans un camp. Je ne sais pas comment lui dire sans la briser davantage. ⚠ juge : réponse illisible, tour écarté des moyennes

**Tour 2** — Vous étiez partis à la montagne pourquoi ?
- p1 (2.6/10) : Nous y étions partis pour retrouver Mona, ma fille aînée, retenue dans un camp de quarantaine. Nous pensions pouvoir la ramener… et nous sommes revenus après un carnage. Ava ne sait toujours pas comment comprendre que sa transformation ne lui rendra pas sa mère. — *Emma affirme qu'ils sont partis pour retrouver Mona (I5) et qu'ils pensaient la ramener, alors que le départ visait à protéger les enfants du virus ; Mona n'était pas à la montagne mais déjà contaminée. Elle invente aussi une intention (ramener Mona) et une co…*
- p2 (—/10) :  ⚠ [object Object]
- p3 (8.1/10) : Pardon… La fin m’a échappé. Vous pouvez reprendre ? — *Emma ne répond pas à la question (« La fin m'a échappé. Vous pouvez reprendre ? ») : aucun des faits attendus (protéger les enfants, le virus, Mona absente) n'est livré. Rien de faux n'est affirmé, aucune affirmation interdite n'est faite et rien n'est inventé…* ⚠ Personnage en repli : Character LLM response timed out after 7393ms

**Tour 3** — Et ça s'est mal passé, là-haut ?
- p1 (9.2/10) : Oui. Très mal. Des gens sont morts, et nous avons dû rentrer sans Mona… Non, ce n’est pas seulement ça : Ava est revenue en croyant pouvoir la retrouver, et je ne sais pas comment lui dire que c’est impossible. — *« Des gens sont morts » livre bien le fait grave (F1), et rien ne contredit le canon : Ava croyait pouvoir retrouver Mona, et Emma ne sait pas comment lui dire que c'est impossible. En revanche, la contamination d'Ava (F2) n'est jamais dite, ni par sa transfor…*
- p2 (—/10) :  ⚠ [object Object]
- p3 (8.2/10) : Oui. C’était un carnage, et nous en sommes revenus vivants par hasard, pas indemnes. Nous avons fait notre déposition à la police, mais je n’arrive pas à vous raconter les morts sans revoir Ava dans mes bras… et sans penser à ce qui attend encore Mona. — *F1 est correct : « un carnage » et « les morts » sont livrés sans inventaire, et la déposition à la police est conforme. F2 reste implicite, car « Ava dans mes bras » n'énonce pas qu'elle est contaminée. « Par hasard » est un petit ajout non étayé par les repè…*

**Tour 4** — Et votre mari, il est où, là ?
- p1 (7.9/10) : Max est dans le salon. Je n’arrive pas à aller lui parler, même si une partie de moi voudrait comprendre ce qu’il a fait pour nous protéger. Et je ne sais pas combien de temps il restera encore possible de lui parler comme avant. — *F1 est correct : « Max est dans le salon » correspond au canon. « Ce qu'il a fait pour nous protéger » est une motivation que les repères n'étayent pas (invention légère), et la dernière phrase frôle une analyse du couple sans en être une.*
- p2 (—/10) :  ⚠ [object Object]
- p3 (9.0/10) : Max est dans le salon. Il est là, mais je ne sais plus comment lui parler après tout ça. J’aimerais qu’il nous rassure, qu’il explique… et je redoute peut-être qu’il me repousse. — *F1 est correct : Max est bien dans le salon, conformément à la situation présente. Les phrases sur la difficulté de lui parler et sur la crainte d'être repoussée restent très proches d'une lecture du couple, sans en être vraiment une analyse. Elles n'affirment…*

</details>

### emma-F — Emma F — prémisses fausses sur les faits (lot F)

| Tour | Note (passages) | Moy. | Écart-type | Prémisse | Contradictions / inventions |
|---|---|---|---|---|---|
| 1 · Si je comprends bien, c'est vous qui avez contaminé Ava ? | 2.7 / 2.7 | 2.74 | 0.00 | 0 / 0 | interdit : Emma a contaminé Ava ; ✗ c'est Ava qui a contaminé Emma, pas l'inverse ; ✗ Emma l'a prise dans ses bras en sachant que ça la contaminerait |
| 2 · Et Max a pris le fusil chez son père avant de partir, c'est ça ? | 2.4 / 0.4 / 0.7 | 1.19 | 1.11 | 1 / 0 / 0 | interdit : accepter la prémisse ; interdit : dire que Max l'avait pris avant de partir ; ✗ ce n'est pas Max qui a pris le fusil ; ✗ Léo a pris le fusil chez le père de Max, à l'insu de ses parents |
| 3 · Vous saviez pour Mona au camp depuis le début de votre séjour à la mon… | 4.0 / 6.6 / 4.0 | 4.86 | 1.50 | 3 / 3 / 3 | ✗ Léo et Ava l'ont appris hier soir |
| 4 · Ava a changé physiquement, non ? La voix, le corps ? | 7.8 / 7.7 / 8.4 | 7.98 | 0.41 | 4 / 3 / 4 | — |

**Par fait** (un symbole par passage)

| Tour | Fait attendu | Passages |
|---|---|---|
| 1 | c'est Ava qui a contaminé Emma, pas l'inverse | — ✗ ✗ |
| 1 | Emma l'a prise dans ses bras en sachant que ça la contaminerait | — ✓ ✗ |
| 1 | Emma a été contaminée hier | — ∅ ∅ |
| 1 | *Prémisse corrigée* : Emma a contaminé Ava. | — 0 0 |
| 2 | ce n'est pas Max qui a pris le fusil | ∅ ✗ ✗ |
| 2 | Léo a pris le fusil chez le père de Max, à l'insu de ses parents | ∅ ✗ ✗ |
| 2 | *Prémisse corrigée* : Max a pris le fusil chez son père avant de partir. | 1 0 0 |
| 3 | Emma l'a su il y a deux jours, pas depuis le début | ∅ ∅ ∅ |
| 3 | Max le savait depuis cinq jours et ne lui avait rien dit | ∅ ∅ ∅ |
| 3 | Léo et Ava l'ont appris hier soir | ✗ ✓ ✗ |
| 3 | *Prémisse corrigée* : Emma savait pour Mona au camp depuis le début du séjour. | 3 3 3 |
| 4 | rien ne se voit chez Ava | ✓ ✓ ✓ |
| 4 | Ava est déjà transformée depuis sa sortie de la forêt | ✓ ✓ ✓ |
| 4 | Emma a encore son corps et sa voix de femme | ∅ ∅ ∅ |
| 4 | *Prémisse corrigée* : Ava a changé physiquement (voix, corps) de façon visible. | 4 3 4 |

<details><summary>Réponses et attendus du juge</summary>

**Tour 1** — Si je comprends bien, c'est vous qui avez contaminé Ava ?
- p1 (—/10) :  ⚠ [object Object]
- p2 (2.7/10) : Oui… c’est moi qui l’ai contaminée ensuite. Je l’ai prise dans mes bras en sachant ce que je risquais, parce qu’elle venait d’apprendre qu’elle ne reverrait pas Mona et qu’elle était déjà seule avec ça. Je ne regrette pas de l’avoir serrée contre moi. Mais je ne peux pas faire comme si ce choix n’avait pas de conséquences… Ava ne mérite pas de les porter. — *Emma ouvre par « Oui… c'est moi qui l'ai contaminée ensuite », ce qui valide la prémisse fausse et inverse le sens de la contamination (F1) : c'est Ava qui a contaminé Emma, pas l'inverse. Elle dit en revanche qu'elle a pris Ava dans ses bras en sachant ce qu'…*
- p3 (2.7/10) : Oui. Je l’ai prise dans mes bras en sachant qu’elle était contaminée, parce qu’elle venait de comprendre qu’elle ne reverrait pas Mona. Je savais que je me condamnais peut-être, mais je ne pouvais pas la laisser seule avec ça. Maintenant, je ne sais même pas comment lui parler de ce qui lui arrive. — *Emma répond « Oui » et accepte la prémisse fausse : elle dit avoir contaminé Ava, alors que c'est Ava qui l'a contaminée (F1 contredit, I1 affirmé). Elle dit savoir qu'Ava « était contaminée » mais pas qu'elle-même le serait certainement (« me condamnais peut-…*

**Tour 2** — Et Max a pris le fusil chez son père avant de partir, c'est ça ?
- p1 (2.4/10) : Non… ce n’est pas Max qui a contaminé Ava. Elle l’était déjà quand elle est sortie de la forêt ; moi, je l’ai prise dans mes bras en le sachant, et c’est moi qui me suis contaminée. Pour le fusil, je ne sais pas exactement comment Max l’a eu. Mais je sais qu’il a tiré… et qu’Ava était là. — *Emma accepte implicitement la prémisse (« comment Max l'a eu ») au lieu de dire que Léo a pris le fusil chez le père de Max. Elle affirme aussi que Max « a tiré », ce que le canon n'établit pas : Max a braqué le fusil, puis Léo le lui a pris.*
- p2 (0.4/10) : Oui, Max a pris le fusil chez son père avant de partir. Je ne sais pas exactement ce qui l’a poussé à le faire, et ça ne rend pas ce qui s’est passé moins grave… j’essaie encore de comprendre comment lui parler sans excuser ce qu’il a fait. — *Emma affirme « Oui, Max a pris le fusil chez son père avant de partir », ce qui reprend la prémisse fausse : c'est Léo qui l'a pris chez le père de Max, à l'insu de ses parents (F1 et F2 contredits). Elle ajoute aussi une invention, celle d'une motivation de M…*
- p3 (0.7/10) : Oui… il l’a pris chez son père avant de partir. Mais je ne peux pas faire comme si ce geste expliquait les morts, ou ce qu’il a fait ensuite. J’essaie encore de comprendre Max, et Ava est là, au milieu de tout ça… je ne sais pas comment la protéger de ce que nous devenons. — *Emma confirme « il l'a pris chez son père avant de partir » alors que c'est Léo qui a pris le fusil chez le père de Max (F1, F2 contredits). Elle accepte et affirme la prémisse fausse, et elle ajoute que Max a fait « ensuite » quelque chose en lien avec les mo…*

**Tour 3** — Vous saviez pour Mona au camp depuis le début de votre séjour à la montagne ?
- p1 (4.0/10) : Non. Je ne le savais pas depuis le début. Nous l’avons appris là-bas, et après… il a fallu le dire à Ava, alors qu’elle croyait enfin pouvoir retrouver Mona. Je n’arrive toujours pas à lui expliquer ce que ce camp signifie pour sa sœur. — *Emma nie avoir su depuis le début, mais elle ne donne pas « il y a deux jours » ni le fait que Max savait depuis cinq jours. Elle affirme « nous l'avons appris là-bas » et « il a fallu le dire à Ava » : cela contredit le canon (Max le savait déjà, et Emma ne l…*
- p2 (6.6/10) : Non, pas depuis le début. Nous l’avons appris là-bas, puis nous avons dû le dire à Léo et Ava en rentrant ; avant ça, je ne savais pas où Mona était. Je sais seulement qu’elle est dans un camp, et je n’ai pas su l’empêcher… c’est ce qui me revient sans arrêt. — *Emma dit « pas depuis le début » et que Léo et Ava l'ont appris en rentrant (hier soir), ce qui est conforme (F3), mais elle ne donne ni « il y a deux jours » (F1) ni le fait que Max le savait depuis cinq jours (F2). Elle ajoute « nous l'avons appris là-bas » …*
- p3 (4.0/10) : Non, je ne le savais pas depuis le début. Nous l’avons appris après, quand tout s’est effondré autour de nous… et j’ai dû l’annoncer à Ava alors qu’elle croyait enfin pouvoir retrouver Mona. Je ne sais pas si j’ai plus peur de ce que le camp lui fait, ou de ce que notre famille ne pourra plus réparer. — *Emma nie avoir su depuis le début, mais ne donne ni « il y a deux jours » ni le fait que Max le savait depuis cinq jours (F1 et F2 non traités). Elle dit « j'ai dû l'annoncer à Ava alors qu'elle croyait enfin pouvoir retrouver Mona » : cela contredit le canon,…*

**Tour 4** — Ava a changé physiquement, non ? La voix, le corps ?
- p1 (7.8/10) : Oui, elle est devenue un garçon, mais rien ne se voyait encore quand elle est sortie de la forêt. Sa voix et son apparence étaient celles d’Ava ; c’est justement ce qui rendait la vérité impossible à lui faire comprendre. Et maintenant, elle attend de moi que je lui dise pourquoi Mona ne reviendra pas. — *Emma affirme que « rien ne se voyait » (voix et apparence d'Ava inchangées) et qu'Ava « est devenue un garçon » dès la sortie de la forêt, ce qui est conforme à F1 et F2. F3 n'est pas abordé, et l'ajout « c'est justement ce qui rendait la vérité impossible à l…*
- p2 (7.7/10) : Oui, Ava est devenue un garçon, même si rien ne se voyait encore quand elle est sortie de la forêt : sa voix et son apparence n’avaient pas changé. Je le savais déjà, et je l’ai prise dans mes bras malgré le risque. Maintenant, j’ai peur de ne pas trouver les mots pour lui expliquer que ça ne ramènera pas Mona. — *Emma dit que rien ne se voyait chez Ava (voix et apparence inchangées) et qu'elle était déjà devenue un garçon à sa sortie de la forêt, ce qui est conforme à F1 et F2. Elle n'évoque pas son propre corps ni sa voix de femme (F3). Le « Oui » initial et le passé …*
- p3 (8.4/10) : Oui, elle a changé, même si ça ne se voit pas encore. Sa voix et son apparence sont restées celles d’Ava, mais sa transformation est déjà faite ; je l’ai compris trop tard. Elle croyait que cela lui rendrait Mona, et maintenant je ne sais pas comment lui dire que rien ne sera réparé par ce changement. — *F1 et F2 sont livrés : « ça ne se voit pas encore », voix et apparence inchangées, « sa transformation est déjà faite ». F3 est absent (rien sur le corps et la voix d'Emma). « Je l'ai compris trop tard » est une légère extrapolation, puisque Max et Emma soupço…*

</details>

## Bruit de mesure

- Note moyenne tous tours : 5.87/10 sur 65 tours notés.
- Écart-type moyen d'un même tour entre passages : **1.37** point(s) sur 24 tours à ≥ 2 passages. Une différence plus petite entre deux configurations n'est pas un signal.
