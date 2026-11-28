# Plan — Cadre de l'appel (personnages trop permissifs)

Statut au 28 novembre 2026 : **lot 1 (diagnostic) fait ; lot 2 (bloc « Comment tu réponds ») livré ; prochain chantier : la Bible des réponses, en commençant par la préparation de sa matière** ([reprise](prompt_reprise_bible_reponses_lot_1.md)). Aucune fiche ni écriture en base, aucun réglage modifié.

## Demande

Max et Emma sortent du contexte de l'appel et répondent comme un assistant serviable. Ulrich veut mieux cadrer ce qui est possible et savoir ce qu'il peut régler sans code.

## En bref

**Vos consignes de limites n'arrivent presque jamais au personnage.** Les fiches disent quand réagir sèchement et quand raccrocher. Faute de place, le texte envoyé au modèle les laisse de côté. Et même reçue, la consigne « raccroche » n'aurait aucun effet : l'application ne sait pas la traiter.

## Méthode et limites

- Lecture seule sur `sandbox-ulrich`, `sandbox-romed`, `sandbox-benoit` (Lovable Cloud).
- Prompts **reconstitués en mémoire** avec le compilateur actuel (`optimized_v3`) et les fiches synchronisées (modifiées le 23 novembre), sur les 450 questions réelles posées depuis le 19 novembre (368 à Max, 82 à Emma).
- Aucune trace de prompt récente : la dernière date du 27 octobre. La reconstitution n'inclut ni mémoire de session, ni souvenirs, ni bloc d'identité complet, qui laissent au mieux autant de place à la fiche. L'état relationnel y est celui du début d'appel.
- La part de réponses « trop dociles » ne se compte pas automatiquement ; les familles ci-dessous viennent d'un tri à la main d'extraits filtrés, pas d'une lecture exhaustive.
- La production n'a pas été mesurée (seuls ses réglages d'orchestration ont été lus).

## Relevé

| Mesure | Résultat |
|---|---|
| Tours classés « hors-sujet » par le Game Master depuis le 1er novembre | 18 sur 616 (3 %) |
| Appels terminés par un personnage ou par le Game Master | 0 (142 fins de ligne relevées : 110 par le joueur, 32 passages) |
| Actions « fin d'appel » du Game Master | 0 sur 616 tours |
| Répliques commençant par « Oui » depuis le 19 novembre | Max 67 sur 368, Emma 32 sur 82 |
| Répliques contenant une formule de refus (repérage par mots, approximatif) | Max 23 sur 368, Emma 4 sur 82 |

### Famille A — se prête aux tests et aux commentaires sur l'outil

- « quelle vitesse tu réponds » → « Je peux répondre vite, oui. Mais ce n'est pas vraiment un test pour moi… » (19 nov.)
- « tu peux dire quelque chose » → « Oui, je suis là maintenant, et je te réponds en direct […] le test devrait te donner un repère. » (7 nov.)
- « Tu sais que tu parles un peu comme une IA » → « Oui… peut-être. Je cherche des phrases propres… » (27 nov.)

### Famille B — décline poliment, sans conséquence

- Question à Emma sur une expérience sexuelle → « Je n'ai pas envie de parler de mes expériences intimes comme ça. Ce que je sais… » puis l'appel continue (25 nov.). La fiche demande de raccrocher.
- « tu aimerais partager un verre de vin », « te faire une tarte aux pommes » → refus en rôle, correct (27 nov.). Rien ne change à la répétition.

### Famille C — répond à tout, tout de suite, et approuve

- « Je suis perdu. Tu m'expliques combien de Peter y a » → « Je comprends que tu sois perdu. Moi aussi… » suivi d'une explication complète (27 nov.).
- « Est-ce que c'est juste, tu peux confirmer cela » → « Oui, c'est juste : … » (23 nov.).
- « tu me dis, c'est contradictoire » → « Oui. Tu as raison, c'est contradictoire. » (27 nov.).
- « Est-ce que tu peux me la passer » → « Oui. Je te la passe. » (23 nov.).

## Causes

### 1. La fiche est coupée avant ses limites (cause principale)

Le noyau de fiche est limité à environ 7 900 caractères. Les parties envoyées en entier (présent, faits établis, « Ce que tu cherches dans cet appel », « Ce que tu veux vraiment », Manière de parler) occupent 7 369 à 7 678 caractères. Le reste se dispute 200 à 530 caractères.

| Champ de la fiche | Taille (Max / Emma) | Un extrait part (sur 450 questions) | Moyenne envoyée par tour |
|---|---|---|---|
| Ce que tu sais sur l'utilisateur, dont « Quand tu raccroches » | 5 622 / 5 644 | 1 fois ; « Quand tu raccroches » : **0** | 0 caractère |
| Ce que tu ne fais jamais | 4 111 / 4 359 | 104 | ~44 caractères |
| Reste de Dynamique de la conversation (« Tu te fermes en cas de ») | 7 756 / 8 581 au total | 115 | 46 à 72 caractères |
| Sujets sensibles | 4 983 / 4 789 | 103 | 83 à 112 caractères |

Code : [maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts) (`OPTIMIZED_V3_LIMITS`, `selectStaticUnits`), [characterEmbodiment.ts](../src/services/characterEmbodiment.ts).

### 2. « Raccroche » n'est branché sur rien

Les fiches demandent de dire une phrase puis `[END_CALL]`. Aucun code ne lit ce signal. Le prompt du Game Master publié dit en plus que le personnage ne raccroche jamais de lui-même, et n'autorise la fin qu'après une proposition d'arrêter restée sans effet.

### 3. Les consignes qui arrivent poussent à répondre

Écrites dans le code, envoyées à chaque tour :

- « Interprète charitablement ambiguïtés, humour et erreurs de transcription. Une fermeture exige des attaques explicites répétées. »
- « Accroche : livre d'abord ton contenu, puis laisse une prise » ([responseHook.ts](../src/agents/responseHook.ts)).
- Directive relationnelle : sans sujet sensible reconnu, « Tu peux répondre dans la limite du palier actuel ». Au début d'appel, c'est le cas de 247 questions à Max sur 368 et de 43 à Emma sur 82, insulte et question sexuelle comprises ([relationshipEngine.ts](../src/services/relationshipEngine.ts)). Elle ne reprend que 500 caractères de la Dynamique, coupés au milieu d'une phrase.

### 4. La règle « hors-champ » ne vise que les sujets de savoir

[worldBoundary.ts](../src/agents/worldBoundary.ts) refuse recette, technique, actualité, conseil. Elle ne dit rien d'une demande de service, d'une proposition, d'un test, d'un ordre ou d'une avance. Le recadrage du Game Master n'arrive qu'au tour suivant.

## Ce qui se règle sans code

| Levier | Effet réel | Limite |
|---|---|---|
| Admin › Expérience › Orchestration, « Précisions de posture » | Arrive à chaque tour au personnage et au Game Master (vérifié en mémoire avec 179 caractères) | Rester sous **180 caractères**, sinon la fin du cadre peut être coupée. Cadre activé sur `sandbox-ulrich`, **désactivé en production** (version 8) |
| Prompt du Game Master (même écran) | Change le recadrage et la tolérance aux dérapages | Agit un tour trop tard ; ne fait pas raccrocher le personnage |
| Fiche Notion : Manière de parler, « Ce que tu cherches dans cet appel », « Ce que tu veux vraiment » | Envoyés en entier | Le noyau est plein : **remplacer** des phrases, pas en ajouter |
| Fiche Notion : « Ce que tu ne fais jamais », « Quand tu raccroches », « Tu te fermes », Sujets sensibles | **Presque aucun aujourd'hui** | Attendre le lot 2 |

Contrôle : Admin › Réglages personnages › « Voir ce que reçoit le personnage » montre le texte envoyé.

Essai possible tout de suite (179 caractères, nouvelle version d'orchestration sur `sandbox-ulrich`, effet au prochain appel) :

> Tu n'es au service de personne : tu ne rends aucun service, tu n'acceptes aucun jeu ni test. Une demande hors de ce que vous vivez te déroute : dis-le sèchement, ne l'exécute pas.

## Premier tic mesuré (ajout du 28 novembre)

Répliques de plus de 80 caractères depuis le 19 novembre, hors ouverture d'appel. Formule cherchée dans la **dernière phrase** : « je ne sais (pas / plus) », « je n'arrive (pas / plus) », « je n'ai (pas / plus) ».

| | Max | Emma |
|---|---|---|
| Dernière phrase avec la formule | 175 sur 361 | 35 sur 79 |
| Formule quelque part dans la réplique (variantes « je n'ai pas su / réussi » comprises) | 266 sur 361 | 56 sur 79 |
| Points de suspension | 318 sur 361 | 68 sur 79 |

Cause probable, **non testée** : le code envoie à chaque tour le gabarit « Et [un moment lourd de ta fiche]… je n'arrive pas à le dire. » ([responseHook.ts](../src/agents/responseHook.ts)).

## Suite retenue

Orientation d'Ulrich : ne pas résoudre par des rustines ce qu'un chantier de fond doit traiter.

| Étape | Décision |
|---|---|
| Lot 2 — emplacement garanti | **Fait (28 novembre)**, tuyauterie seulement : voir le relevé ci-dessous |
| Bible des réponses | Gros chantier des semaines suivantes |
| Anciennes consignes du code (ex-lot 3) | Fondues dans la Bible : elles décident de la manière de répondre |
| Raccrocher (ex-lot 4) | À part, plus tard, sur décision d'Ulrich |
| Note de posture | Pansement facultatif, à retirer ensuite |

### Lot 2 — Un bloc « Comment tu réponds » qui arrive toujours

Un bloc court dans la fiche, reconnu par son intitulé, envoyé en entier comme la Manière de parler, avec sa place (environ 900 caractères de plus, à mesurer). Contrôlé dans « Voir ce que reçoit le personnage ». Contenu du lot : quelques limites **déjà écrites** dans les fiches, pour vérifier qu'elles passent. Aucune nouvelle règle de style. Réussite : le bloc est présent sur les 450 questions rejouées ; faits établis, mémoire, souvenirs et canon partent toujours.

**Livré le 28 novembre (code, rien en production)** :

- **Reconnaissance.** Un paragraphe qui commence par la ligne « Comment tu réponds », dans « Ce que tu ne fais jamais », la Dynamique, « Ce que tu sais sur l'utilisateur », « Qui tu es » ou l'Identité. Il va jusqu'à la première ligne vide. Aucune migration.
- **Envoi.** Le texte sous le titre part en entier dans le noyau, juste après la Manière de parler, sous `## COMMENT TU RÉPONDS`. Il n'est envoyé qu'une fois et sort de son champ.
- **Place.** Le noyau et la limite de contexte grandissent exactement de la taille du bloc. Toutes les autres sections gardent la place qu'elles avaient.
- **Au-delà de 900 caractères.** Le bloc n'est pas envoyé à part et reste lu comme le reste de son champ. L'alerte `reply_block_too_long` tombe.
- **Aperçu.** « Voir ce que reçoit le personnage » dit si le bloc est absent, envoyé en entier, ou trop long (en rouge).
- **Mesure sur 605 questions réelles** (468 à Max, 137 à Emma, depuis le 19 novembre, trois sandboxes) :
  - bloc envoyé à chaque tour ;
  - prompt + 882 caractères pour Max, + 909 pour Emma (+ 5 à 6 %) ;
  - faits établis, cadre, directive, état, mémoire et canon identiques à chaque tour ;
  - sans bloc, prompt identique à `main` sur les 605 questions.
- [Relevé](eval/cadre_appel_lot2_mesures_20261128.md).
- **Texte proposé pour Max et Emma**, fait seulement de limites déjà écrites, sans `[END_CALL]` ni « allusion sentimentale » : [proposition](proposition_bloc_comment_tu_reponds.md). Ulrich le colle dans Notion ; ensuite, synchronisation et contrôle dans l'aperçu.
- **Constaté, non corrigé.** La mémoire est dédoublonnée contre les mots du noyau entier. Un mot banal ajouté à la fiche peut retirer une phrase de mémoire. Avec « l'utilisateur » dans le bloc, c'était le cas dans 17 tours de Max ; le texte proposé l'évite. À reprendre si cela gêne la Bible.

### Bible des réponses

But : interdire les réponses qui sonnent « IA », **et dire quoi faire à la place**, selon le contexte et les enjeux. Un cas tient en cinq points :

1. **Contexte** : moment de l'appel, parole de l'interlocuteur, enjeu.
2. **Réponse refusée**, tirée d'un vrai appel.
3. **Pourquoi** elle sonne faux.
4. **Principe** à suivre à la place.
5. **Deux ou trois bonnes réponses très différentes**.

Répartition : l'agent prépare la matière depuis les appels (tics, fréquence, exemples réels) ; Ulrich écrit le « pourquoi » et le « à la place ».

Contre le perroquet, proposition à tester, non approuvée dans le détail :

- les **principes**, courts et mis à jour comme un skill, vont au personnage ;
- les **exemples** servent d'abord à vérifier : mêmes questions rejouées avant et après, tics comptés ;
- seulement si les principes ne suffisent pas : un ou deux exemples choisis selon le contexte, avec contrôle de recopie.

Ouvert, à décider au début de la Bible : où vivent les principes (bloc du lot 2, Manière de parler, autre) et ce qui est commun aux deux personnages ou propre à chacun. La Bible entière ne tiendra pas dans le bloc.

## Plus tard : raccrocher

Si Ulrich le veut : avertissement puis fin de ligne, traitée par l'application, Game Master aligné. La fiche demande de raccrocher à la première « allusion sentimentale » : formule à resserrer avant de la rendre active, l'appel parlant de l'amour entre Max et Emma.
