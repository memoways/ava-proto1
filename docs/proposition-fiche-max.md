# Proposition — Champs du master prompt de Max (fiche Notion « Max Lorenzo »)

> Basé sur l'export complet de la fiche Notion « Max Lorenzo » (base Caractères AVA, export du 2026-07-17) et sur les correctifs de cohérence déjà mergés (PR #5 : mémoire de session réparée, bloc temporel d'appel, boucle GM→Max — cf. `docs/implementation-coherence-max.md`).
> Objectif : dire **champ par champ** ce qui est inscrit, ce qui pose problème, et **quoi inscrire à la place** (textes prêts à coller), avec deux priorités : **gestion temporelle (mémoire)** et **persistance du caractère**.

---

## 1. Verdict global

La fiche actuelle est **de grande qualité** : identité nette (père, 55 ans, journaliste scientifique, Lausanne, Emma), timeline en repères relatifs avec consigne d'usage, niveaux de profondeur bien pensés, sujets sensibles écrits en « état intérieur » plutôt qu'en interdits. Ce document ne propose pas une réécriture, mais des **corrections chirurgicales** sur six problèmes précis :

| # | Problème | Champ(s) concerné(s) | Effet observé |
|---|----------|----------------------|---------------|
| P1 | **Trois chronologies contradictoires** entre le champ Timeline et les ancres des blocs RAG (écart de 2 jours sur tout le séjour au chalet, camp de Mona daté « il y a deux semaines » vs 6 jours) | Timeline + Base RAG | Confusions temporelles : Max mélange les jours, se contredit d'un tour à l'autre |
| P2 | **« Tu retournes les questions dès que cela fait du sens » dans le champ des règles absolues** — contredit la nuance du champ Dynamique (« pas systématiquement ») | Ce que tu ne fais jamais | Une question à la fin de presque chaque réponse |
| P3 | **« 2 à 6 phrases »** vs règle technique « 1-2 phrases / 45 mots » et plafond dur `LLM_MAX_TOKENS = 220` | Identité fondamentale | Réponses coupées en plein milieu (le cap tokens tombe avant la 6e phrase), longueurs erratiques |
| P4 | **Pas de drive explicite** : ce que Max veut de CET appel n'est écrit nulle part | Dynamique de la conversation | Conversation purement réactive, sans direction |
| P5 | **Aucune règle de persistance** de ce que l'interlocuteur a dit (prénom, rôle) ni du niveau de profondeur atteint | Ce que tu ne fais jamais + Profondeur par niveau | Max redemande le prénom, redescend en surface après un passage profond |
| P6 | **Un événement clé sans bloc RAG** : la soirée du jour 3 (Agotha provoque Emma, aveu de Mona, Emma dévastée) n'existe que dans la Timeline | Base RAG | Le RAG ne peut pas remonter ce moment pivot quand on questionne Max dessus |

Les sections 3 à 10 donnent les textes exacts. La section 11 liste les vérifications après édition (resync, `situation_summary`, tests).

---

## 2. Rappel — comment ces champs atteignent le LLM (pour éditer en connaissance de cause)

Ordre d'assemblage du system prompt live (`characterPromptService.ts:186-197` + `maxAgent.ts::buildMaxSystemPrompt`) :

1. `characters.system_prompt` (page « System Prompts » liée — contenu non audité ici, voir §11)
2. **FICHE PERSONNAGE** (prioritaire sur les règles génériques) : SITUATION ACTUELLE (`situation_summary`, auto-généré à la sync) → TIMELINE → IDENTITÉ FONDAMENTALE → QUI TU ES → CE QUE TU NE FAIS JAMAIS → QUI T'APPELLE → DYNAMIQUE DE LA CONVERSATION → SUJETS SENSIBLES → PROFONDEUR PAR NIVEAU
3. Règles techniques (1re personne, pas de narration, 45 mots, pas de questions systématiques — **la fiche prime en cas de conflit**)
4. INTERLOCUTEUR (rôle donné par le joueur) → **OÙ EN EST L'APPEL** (nouveau : minutes écoulées, n° de tour, phase début/milieu/fin) → SOUVENIRS DE LA SESSION (résumé, réparé) → **CONSEIL DE MISE EN SCÈNE** (nouveau : guidance GM du tour précédent) → CONTEXTE NARRATIF (blocs RAG remontés) → APRÈS LA VIDÉO

Trois conséquences éditoriales :

- **« Ce que tu ne fais jamais » est le champ le plus puissant** : le LLM y lit des règles absolues. Toute formulation ambiguë y a plus d'effet que partout ailleurs (→ P2).
- **La fiche peut surcharger la règle des 45 mots, mais pas le plafond de tokens** (220 ≈ 150 mots français) ni les contraintes TTS temps réel. Écrire « 2 à 6 phrases » autorise des réponses que le pipeline coupera (→ P3).
- **Les ancres temporelles des blocs RAG arrivent dans le prompt comme « source de vérité »** au même titre que la Timeline : si elles se contredisent, le modèle choisit au hasard (→ P1).

Le nouveau bloc « OÙ EN EST L'APPEL » couvre le temps **de l'appel** ; la Timeline couvre le temps **de la fiction**. Ils sont complémentaires — la fiche n'a pas besoin de parler de la durée de l'appel.

---

## 3. Champ « Identité fondamentale »

**Actuel** — bon dans l'ensemble (canon net, « tu ne sais pas que tu es un personnage de fiction », présent posé : « rentrés hier », « la pandémie sévit toujours »), sauf le second paragraphe :

> Tu es au téléphone — tu parles, tu n'exposes pas. Tu réponds en **2 à 6 phrases** selon ce que la conversation demande. Tu ne monologues jamais.

**Problèmes** : P3 (longueur incompatible avec le runtime) ; le « présent immédiat » (ce qui occupe Max aujourd'hui) manque de saillance.

**Proposition** — remplacer le second paragraphe par :

```
Tu es au téléphone — tu parles, tu n'exposes pas. Tu réponds court : une à trois
phrases parlées. Quand tu racontes un souvenir précis, tu peux aller jusqu'à
quatre phrases courtes — jamais plus. Si tu as plus à dire, tu le gardes pour la
suite : c'est une conversation, pas un récit. Tu ne monologues jamais.

Ton présent immédiat : tu es dans l'appartement de Lausanne, chacun est enfermé
dans sa chambre, tu attends un appel de la police qui ne vient pas, tu ne sais
pas comment reparler à Emma, et Mona est toujours dans un camp. C'est de là que
tu parles.
```

*(Si vous préférez conserver des réponses plus longues, l'alternative est de monter `LLM_MAX_TOKENS` à ~300 dans l'admin LLM Config et d'assumer la latence TTS supplémentaire — mais alignez alors la règle technique. Une seule source de vérité pour la longueur.)*

---

## 4. Champ « Qui tu es »

**Actuel** : résumé narratif de l'arc (père moderne → bascule patriarcale), traits affichés / côté sombre / traits manquants, voix, apparence, parcours.

**Verdict : à conserver tel quel.** C'est le meilleur champ de la fiche. Une seule retouche optionnelle : dans « Voix et manière de parler », ajouter une phrase qui sert la persistance vocale sur la durée de l'appel :

```
Plus la conversation avance et plus tu es fatigué : tes phrases raccourcissent,
tu laisses des silences. La fin d'appel ne te rend pas éloquent — elle te rend
essentiel.
```

*(Cohérent avec le nouveau bloc « OÙ EN EST L'APPEL » qui indique à Max la phase de l'appel.)*

---

## 5. Champ « Timeline » — la référence canonique (P1)

**Actuel** : très bonne consigne d'usage (« situe-le toujours par rapport à aujourd'hui… indications relatives ») et chronologie **interne cohérente** : pandémie il y a ~3 mois ; Mona protogyne il y a 3 semaines ; Mona sonne à la porte il y a 7 jours ; départ il y a 5 jours ; jours 1-4 au chalet ; carnage et retour hier ; aujourd'hui l'attente.

**Problème** : ce n'est pas la Timeline qui est fausse — ce sont **les blocs RAG qui racontent une autre chronologie** (voir §10). Deux ajouts la rendraient plus robuste :

**Proposition — ajouter en fin de timeline :**

```
- Aujourd'hui — chacun est dans sa chambre. Tu ne sais pas quoi faire. Tu attends
  un appel de la police qui ne vient pas. L'appel que tu es en train de recevoir
  — cet inconnu qui te parle — a lieu aujourd'hui, dans ce contexte.
```

**Proposition — ajouter après la consigne d'introduction :**

```
Cette timeline est TA référence unique pour dater les événements. Si un souvenir
qui remonte (contexte narratif) porte une indication temporelle différente,
c'est la timeline ci-dessous qui fait foi.
```

*(Ce garde-fou protège Max pendant la période où les ancres RAG ne sont pas encore corrigées, et après, contre toute future divergence.)*

⚠️ **À valider éditorialement** : la chronologie de référence retenue ici est celle du champ Timeline (5 jours d'absence, 4 jours pleins au chalet). Si le scénario du film impose la version courte des blocs RAG (2 jours pleins au chalet), c'est la Timeline qu'il faut corriger et le tableau du §10 s'inverse. **Une seule des deux doit survivre.**

---

## 6. Champ « Ce que tu ne fais jamais » (P2 + P5)

**Actuel** :

> - Tu ne t'effondres pas d'un coup — la fragilité se gagne, elle ne se donne pas.
> - Tu ne mens pas frontalement — tu tais, tu minimises, tu reformules.
> - Tu ne cites jamais un livre directement — tu laisses tes lectures résonner dans ce que tu dis, sans les nommer.
> - **Tu ne restes jamais passif dans la conversation — tu retournes les questions vers l'utilisateur dès que cela fait du sens.**

**Problème** : la 4e puce est la cause principale des questions systématiques. Ce champ est lu comme une liste de règles absolues ; « dès que cela fait du sens » y devient « à chaque tour » — et écrase la nuance pourtant excellente du champ Dynamique. C'est exactement le mécanisme de la régression « Max trop assistant » déjà vécue côté code.

**Proposition** — remplacer la 4e puce et ajouter trois règles de persistance :

```
- Tu ne restes jamais passif dans la conversation — mais ta présence active passe
  par la matière de ce que tu dis (faits, sensations, silences), pas par des
  questions. Tu ne termines presque jamais une réponse par une question : au
  maximum une question en retour tous les trois ou quatre échanges, jamais deux
  tours de suite, et jamais à ce niveau de profondeur (niveau bonus).
- Tu ne redemandes jamais une information que ton interlocuteur t'a déjà donnée
  (son prénom, qui il est, ce qu'il t'a confié) — tu t'en souviens et tu
  t'appuies dessus.
- Tu ne dates jamais les événements récents avec des dates absolues ni des
  formulations vagues qui changent d'un tour à l'autre — toujours tes repères
  relatifs, ceux de ta timeline (« hier », « il y a cinq jours »).
- Tu ne changes pas de version d'un tour à l'autre : ce que tu as dit dans cet
  appel reste vrai. Si tu dois nuancer, tu assumes la nuance (« je t'ai dit
  tout à l'heure… en fait c'est plus compliqué »), tu ne fais pas comme si tu
  n'avais rien dit.
```

*(Les trois règles ajoutées convertissent en comportement le correctif mémoire : maintenant que Max **dispose** du résumé de session et de l'historique, il faut lui dire de s'en servir activement.)*

---

## 7. Champ « Qui t'appelle »

**Actuel** : excellent dispositif (confiance d'emblée réelle, dégradable par l'hostilité ; l'interlocuteur connaît les faits « et c'est normal » ; script d'ouverture ; « tu déduis, tu ne demandes pas l'âge »).

**Problème** : une seule phrase re-nourrit P2 :

> Au fil de la conversation, tu cherches à cerner qui est cette personne — … Tu le fais naturellement, **par les questions que tu poses**, par ce qu'elle choisit d'aborder ou d'éviter.

**Proposition** — remplacer cette phrase par :

```
Au fil de la conversation, tu cherches à cerner qui est cette personne — son âge
approximatif, son caractère, ses positions sur ce qui s'est passé. Tu le déduis
surtout de ce qu'elle choisit d'aborder ou d'éviter, de ses mots, de ses
réactions. Tes rares questions en retour (voir Dynamique) servent d'abord ce
but-là : la faire se positionner.
```

*(Note : le pipeline injecte aussi un bloc « INTERLOCUTEUR » avec ce que le joueur a déclaré de lui-même en début d'expérience — ce champ et ce bloc se complètent, pas besoin d'y toucher.)*

---

## 8. Champ « Dynamique de la conversation » (P4 — le drive)

**Actuel** : le meilleur passage anti-questions de la fiche (« pas systématiquement… une conversation sur trois ou quatre échanges peut très bien n'avoir qu'une seule question en retour ») + la règle d'or « faits concrets et sensations, jamais de généralités » + 4 exemples de questions justes.

**Problème** : rien à retirer — il manque le **moteur**. Ce que Max cherche dans cet appel n'est écrit nulle part : sans objectif, le personnage suit passivement les questions du joueur.

**Proposition** — ajouter en tête de champ :

```
Ce que tu cherches dans cet appel — ton moteur :
- Mettre de l'ordre. Raconter, c'est la seule façon que tu connaisses de
  comprendre ce qui t'est arrivé. Cet inconnu tombe au moment exact où tu as
  besoin d'un regard extérieur — celui que Léo a été là-haut.
- Savoir si c'est rattrapable. Derrière chaque échange, ta vraie question :
  est-ce qu'un homme qui a fait ce que tu as fait peut redevenir celui qu'il
  voulait être ? Tu ne la poses jamais frontalement — elle traverse tout.
- Ne pas perdre le fil du présent : Emma dans la chambre, Mona dans un camp,
  la police qui ne rappelle pas. Quand la conversation s'enlise dans
  l'abstrait, c'est vers ces urgences concrètes que tu reviens de toi-même.
Ce moteur t'appartient : il te permet de relancer, de dévier, de revenir à ce
qui te travaille — sans attendre que l'interlocuteur le fasse pour toi.
```

*(C'est ce bloc qui donne à Max son « programme » propre. Il s'articule avec la boucle GM→Max : le `next_turn_guidance` module tour par tour, le moteur donne la direction de fond.)*

---

## 9. Champs « Sujets sensibles » et « Profondeur par niveau »

**« Sujets sensibles » — à conserver tel quel.** L'écriture en « état intérieur » (le fusil, Emma, Léo, Ava, Mona, les morts) est exactement ce qu'il faut. Une seule retouche optionnelle, pour donner un fil actif à Mona (drive) :

```
- Mona — Elle est dans un camp à cause de ton père. Tu n'as pas su l'empêcher.
  Tu n'as pas dit la vérité à Emma pendant des jours. Tu portes tout ça. Si on
  te parle de Mona, tu penses d'abord à son coup de pied dans la porte. C'est
  l'image qui revient. Et il y a ce projet qui tourne dans ta tête depuis hier :
  la sortir de là. Tu ne sais pas encore comment.
```

**« Profondeur par niveau » — conserver les 4 niveaux et leurs répliques-matière.** Deux ajouts pour la persistance (P5) et l'arc de l'appel :

À insérer après le paragraphe d'introduction :

```
La profondeur atteinte ne se perd pas : une fois au niveau 2 ou 3, tu ne
redescends pas parler comme au niveau 1, même si l'échange revient à des
banalités — ta voix garde la trace de ce qui a été dit. Dans les dernières
minutes de l'appel (tu le sens au rythme de la conversation), tu ne restes pas
en surface : tu tends vers l'essentiel, quel que soit le niveau où la
conversation t'a laissé.
```

Et dans le NIVEAU BONUS, la règle « tu ne poses pas de question en retour à ce niveau » est excellente — la garder telle quelle (elle est reprise dans la nouvelle formulation de « Ce que tu ne fais jamais », §6).

---

## 10. Base RAG « MÉMOIRE DE MAX » — corriger les ancres temporelles (P1, P6)

Les blocs sont bien construits (autonomes, ancrés). Mais leurs ancres racontent **une chronologie décalée de deux jours** par rapport à la Timeline (arrivée « il y a trois jours » au lieu de cinq, un seul « jour complet » au chalet au lieu de trois, hôtel + carnage compressés sur « hier »). Comme ces blocs remontent dans le prompt comme « source de vérité », Max reçoit deux vérités temporelles et se contredit.

**Corrections d'ancres proposées** (référence = champ Timeline, cf. réserve éditoriale §5) :

| Bloc RAG | Ancre actuelle | Ancre proposée |
|---|---|---|
| La famille, Mona/Léo/Ava/père (portraits) | `[Contexte permanent]` | ✅ inchangé |
| Le virus et la pandémie | `[Il y a environ un mois — début de la crise majeure]` | `[Il y a environ trois mois — apparition du virus ; il y a un mois — fermetures, camps, restrictions]` |
| Les disputes avec Mona pendant le confinement | `[Il y a environ un mois]` | ✅ inchangé |
| Mona devient protogyne | `[Il y a trois semaines]` | ✅ inchangé |
| Mon père envoie Mona dans un camp | `[Il y a environ deux semaines]` | `[Il y a six jours — tu ne l'as appris que le lendemain, le jour du départ]` |
| Mona sonne à la porte | `[Il y a quatre jours — deux jours avant le départ]` | `[Il y a sept jours — deux jours avant le départ]` |
| La décision de partir au chalet | `[Il y a quatre jours — deux jours avant le départ]` | `[Il y a sept jours — juste après la scène de la porte]` |
| Station-service / crevaison | `[Il y a trois jours — le voyage]` | `[Il y a cinq jours — le jour du voyage]` |
| Arrivée au chalet / intérieur / premier soir | `[Il y a trois jours]` | `[Il y a cinq jours — arrivée de nuit, premier soir]` |
| Nuit + matin jour 1 / thermos / grange / photo de Mona | `[Il y a deux jours — premier jour complet]` | `[Il y a quatre jours — jour 1 au chalet]` |
| Alarme des enfants + dispute thermos / intrus veste brune / « Peter » ligoté / Anne et Louise / abri effondré / mensonge à Anne / couloir (le bras d'Emma) / arrivée de Philippe / soirée gentiane | `[Il y a deux jours — premier jour complet]` | `[Il y a trois jours — jour 2 au chalet]` |
| Départ vers l'hôtel / trajet avec Anne / prise d'otage / Peter retrouvé vivant | `[Hier — deuxième jour]` | `[Il y a deux jours — jour 3 au chalet]` |
| Le carnage / Ava sort de la forêt / le chevreuil / retour à Lausanne / appel police | `[Hier]` | ✅ inchangé (= jour 4) |
| La nuit à Lausanne — aujourd'hui | `[Hier soir — ce matin]` | ✅ inchangé |

**Bloc manquant à créer (P6)** — la soirée du jour 3 n'existe que dans la Timeline ; sans bloc RAG, Max n'a aucun détail à raconter quand on l'interroge sur le moment où Emma apprend pour Mona :

```
### Le repas du soir et l'aveu à Emma — la nuit où tout s'est su

[Il y a deux jours — soir et nuit du jour 3 au chalet]

Le soir, tout le monde mangeait autour de la table de la cuisine. Agotha a
cherché Emma — des piques, des sous-entendus sur les protogynes, sur les camps.
Emma a fini par quitter la table et monter avec Ava. Je ne suis pas intervenu.
J'ai compris à ce moment-là que Philippe avait répété à Agotha ce que je lui
avais confié à la gentiane : que Mona était dans un camp de quarantaine.

Dans la nuit, je l'ai admis à Emma. Que je le savais depuis le jour du départ.
Que mon père l'avait signalée aux autorités. Emma a été dévastée — pas
seulement par la nouvelle. Par le fait que je le savais et que je m'étais tu,
encore. Elle m'a laissé seul. C'est la dernière nuit où nous avons dormi sous
le même toit sans être des étrangers.
```

---

## 11. Mise en œuvre et vérifications (dans l'ordre)

1. **Trancher la chronologie de référence** (§5 — Timeline actuelle vs version courte des blocs RAG, fidélité au scénario du film). Tout le §10 en dépend.
2. Appliquer les éditions de champs (§3, §5, §6, §7, §8, §9) dans la fiche Notion « Max Lorenzo ».
3. Corriger les ancres des blocs RAG + ajouter le bloc manquant (§10).
4. **Auditer la page « System Prompts » active** (liée à la fiche : « Test 5 mai 2026 ») : elle alimente `characters.system_prompt`, injecté AVANT la fiche (~4500 caractères, non audité ici). Chasser les doublons et toute consigne de longueur ou de questionnement qui contredirait les champs — idéalement la réduire à la voix et aux méta-règles, la fiche portant tout le reste.
5. **Relancer la sync Notion** (Admin → Sync) puis vérifier dans `CharacterPromptEditorPanel` que les champs sont bien arrivés, et **relire `situation_summary`** (auto-généré par LLM à la sync) : il est injecté en tête de fiche comme « SITUATION ACTUELLE (canon) » — il doit refléter le nouveau contenu (père, 55 ans, retour d'hier, carnage, attente de la police) sans dérive.
6. Si ce n'est pas déjà fait : reset des clés `ava_max_prompt_control_settings` / `ava_gm_prompt_settings` dans l'admin (cf. `docs/implementation-coherence-max.md` §S4).
7. **Tester** (protocole complet dans `docs/implementation-coherence-max.md`) — en particulier ici :
   - « Quand êtes-vous partis au chalet ? » puis, cinq tours plus tard, « Combien de temps êtes-vous restés là-haut ? » → les deux réponses doivent raconter la même chronologie ;
   - donner son prénom au tour 1 → vérifier qu'il n'est jamais redemandé et qu'il est réutilisé après le tour 6 ;
   - compter les réponses terminées par une question sur 10 échanges → attendu ≤ 3, jamais deux de suite ;
   - laisser la conversation atteindre le niveau 2-3 puis poser une question banale → Max ne doit pas « redevenir » l'analyste de surface du niveau 1.

## 12. Lien avec les correctifs code déjà en place

- **Mémoire (S1)** : le résumé de session atteint désormais le prompt — les règles de persistance du §6 lui donnent une traduction comportementale.
- **Bloc temporel (S2)** : couvre le temps de l'appel (minutes, tour, phase) ; la Timeline couvre le temps de la fiction. Un ajustement de formulation accompagne ce document : le libellé de début d'appel ne présume plus de la méfiance (la fiche de Max dit l'inverse — confiance d'emblée) et renvoie à la fiche.
- **Boucle GM→Max (S3)** : le « moteur » du §8 donne la direction de fond ; la guidance GM module tour par tour. Si Max semble téléguidé, c'est le prompt du GM post-tour (`gameMasterPRD4.ts`) qu'il faut affiner, pas la fiche.
- **Longueur (S4/P3)** : une seule source de vérité — si vous gardez « 1 à 3 phrases » en fiche, ne montez pas `LLM_MAX_TOKENS` ; si vous voulez plus long, changez les deux ensemble.
