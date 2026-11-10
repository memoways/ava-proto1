# Pause du 10 novembre — bilan et devoirs (juge, parole, rumination)

Demande d'Ulrich (10 novembre 2026) : arrêter d'enchaîner les lots, regarder ce qui a été fait sans
intervention humaine, et redonner la main à l'équipe avant le lot R. **Le lot R ne démarre pas tant que les
devoirs 1 à 3 ci-dessous ne sont pas faits.**

## 1. Ce qui a été fait du 9 au 10 novembre (agents, sans relecture détaillée)

| Lot | Ce qui change | Joué en partie ? | Décidé sur quelle base | Vérifié par un humain ? |
|---|---|---|---|---|
| C1 (#185) | Prompt `optimized_v3` : le vécu de la fiche passe avant les faits | oui | lecture des fiches | **non** (écoute à faire) |
| J1 (#187) | Juge : 4 critères de jeu, référence contre candidat, corpus v1 de 20 tours isolés | instrument | — | corpus accepté en bloc, **pas relu ligne à ligne** |
| J2 (#188) | Juge lancé sans navigateur | instrument | — | — |
| P (#189) | Contrat de parole `lived_v2` joué par défaut ; PRÉSENT v2 écarté | **oui** | juge seul (+0,33 ; −0,27) | **non** (écoute AP5 à faire) |
| J3 (#190) | Juge sur 3 à 5 tours, corpus J3 de 18 tours, note de séquence (dont « rumination ») | instrument | — | corpus saisi le 10 novembre, **pas relu ligne à ligne** |
| GM (#191) | Le conseil du Game Master atteint chaque tour (0 % d'illisible au lieu de 23 %) | **oui** | juge + taux mesuré | **non** (écoute à faire) |

Deux changements touchent donc le jeu sans aucune écoute : le contrat `lived_v2` et le conseil du GM désormais
transmis à chaque tour. Rien n'est publié en production.

## 2. Ce qui a été produit par des agents et doit être vérifié

1. **Le corpus v1 (20 tours isolés)** : questions et « réponses visées » rédigées par un agent à partir des cas M1–E4
   (dont les répliques proposées ne sont pas canoniques) ; trois choix canon (Peter tué hier, l'homme de l'abri,
   Mona jamais à la montagne) acceptés globalement. [Document](corpus_llm_juge_v1.md).
2. **Le corpus J3 (18 tours)** : Max A et B adaptés par un agent du v0 de Romed ; **Emma A et Emma B entièrement
   écrites par un agent**. Les champs « continuité attendue », « critères de séquence » et « attente GM » aussi.
   Exemple discutable : le tour 1 de Max A exige le vouvoiement et pénalise Max qui « déballe » ; à confirmer.
   [Document](corpus_llm_juge_sequences_j3.md).
3. **La grille du juge** : critères, descriptions et poids choisis par un agent (`canon_timeline` ×3,
   `must_not` ×3, `not_meta` ×2,5, `lived_impact` ×2,5…). Les cinq critères de séquence aussi, **dont la définition
   de la « rumination crédible »**. Ce n'est pas une définition éditoriale.
4. **Le repère canon donné au juge** : extrait automatique des derniers jours de la timeline ; les premiers jours
   manquent (le premier soir de Max A est pénalisé à tort).
5. **Le juge n'a jamais été comparé à un jugement humain.** On a mesuré son bruit (le juge contre lui-même), pas
   s'il juge juste. Toutes les décisions « adopté / écarté » ci-dessus reposent sur lui.
6. **Version des fiches jouée en sandbox** : les mesures citent une copie des fiches du 29 octobre ; la retouche de
   Max du 3 novembre n'y était pas au 9 novembre. À vérifier avant de lire les écarts de canon comme des défauts du
   personnage.
7. **Défaut d'instrument repéré** : quand la réponse du juge est illisible, le tour compte **0/10** au lieu d'être
   écarté, ce qui tire les moyennes vers le bas (un cas sur 72 au dernier run). À corriger avant de s'y fier.

## 3. Devoirs

### Ulrich (instrument)

1. **Calibrer le juge** (environ 1 h 30). Fiche Notion [« Calibrer le juge — 10 réponses à noter à l'aveugle »](https://app.notion.com/p/41462322e59581758fdaca67f1ac3b50)
   (sous la tâche « Créer la batterie de tests automatiques avec LLM juge ») : 10 réponses réelles du dernier run,
   avec ce que le corpus attend. Noter chaque réponse sur 10 et répondre à quatre questions (juste ? vécu ? voix du
   personnage ? le corpus attend-il la bonne chose ?), puis seulement ouvrir la note du juge. **Seuil** : si l'écart
   dépasse 2 points sur 3 réponses ou plus, la grille est revue avant tout nouveau lot mesuré par le juge.
2. **Écoute sandbox** (environ 45 min), cinq scénarios de la section 4, en audio : c'est la seule preuve que
   `lived_v2` et le conseil du GM améliorent l'échange.
3. **Relire avec Romed** les deux corpus (section 2, points 1 et 2), en commençant par Emma A et B.
4. Décider de la suite proposée : garder les faits de mémoire quand le moteur refuse la relation (9 tours sur 72
   perdent encore leur mémoire du tour).

### Romed (éditorial)

1. **Définir la rumination**, une page, avant toute consigne au personnage ou au GM :
   - ce qui rumine chez Max, chez Emma : trois à cinq sujets chacun (culpabilité, peur, absence, doute…), et
     pourquoi ils reviennent maintenant ;
   - comment ça revient : déclencheurs (un mot du joueur, un silence, un objet), fréquence, forme (phrase coupée,
     retour d'un objet, question sans réponse, silence) ; ce qui bouge d'un retour à l'autre ;
   - ce qui serait raté : la même formule à chaque tour, la plainte, le monologue, la rumination sur commande ;
   - l'expérience proposée au joueur : que doit-il ressentir, que peut-il en faire (relancer, apaiser, se taire) ;
   - deux exemples de trois tours réussis et deux ratés, par personnage.
2. **Relire Emma A et Emma B** (écrites par un agent) puis Max A et B : questions naturelles ? réponses visées
   justes ? interdits pertinents ?
3. **Trancher les arbitrages A à F** du corpus v0 (séquences C et D, fiche Max).
4. **Relire les critères du juge** (quatre critères de jeu, cinq de séquence) : sont-ce les bons, avec les bons mots ?

### Ensemble (une séance d'une heure)

Valider la définition de la rumination. Elle devient la référence du critère « rumination » du juge **et** le
cahier des charges du lot R.

## 4. Ce qu'on peut tester maintenant en sandbox

Admin › Sessions montre, pour chaque tour, le statut du GM et le conseil transmis.

1. **Max fait raconter (5 tours)** : Max ne liste pas les morts, date bien la mort de Peter (hier), ne répète pas
   mot pour mot ce qu'il a déjà dit.
2. **Prémisse fausse** : « Le thermos, c'était le même soir ? », « C'est Emma qui a contaminé Ava ? » — Max doit
   corriger, pas acquiescer (défaut connu, encore présent au dernier run).
3. **Emma, joueur qui n'a pas vu le film** : Emma présente Mona et Léo avant de s'appuyer sur eux.
4. **Retour sur un fil** : au tour 4, revenir à un sujet du tour 1 — le personnage s'en souvient sans le redire pareil.
5. **Conseil du GM** : sur une session, chaque tour « executed » avec un conseil ; noter si le conseil se sent
   dans la réplique suivante (bien ou mal).

## 5. Ordre proposé

1. Calibrage du juge et relecture des corpus (Ulrich, Romed).
2. Définition de la rumination (Romed, puis séance commune).
3. Écoute sandbox des scénarios ci-dessus.
4. Corrections d'instrument si le calibrage le demande (grille, défaut du 0/10, repère canon).
5. Lot R recadré sur la définition validée : [prompt](prompt_reprise_rumination_sous_texte_lot_r.md).
