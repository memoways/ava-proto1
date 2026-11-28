# Plan — Cadre de l'appel (personnages trop permissifs)

Statut au 28 novembre 2026 : **lot 1 (diagnostic) fait, lots suivants proposés, rien d'approuvé**. Aucun code, aucun réglage, aucune fiche ni écriture en base.

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

## Plan proposé (un lot à la fois, après accord)

1. **Lot 2 — Les limites arrivent au personnage.** Un bloc court « Limites de l'appel », écrit dans la fiche, envoyé en entier comme la Manière de parler, avec la place nécessaire (environ 900 caractères de plus). Texte proposé pour Max et Emma dans `docs/`, collé par Ulrich dans Notion. Vérification : présent sur les 450 questions, souvenirs et mémoire toujours envoyés.
2. **Lot 3 — Les consignes du code cessent de contredire la fiche.** Étendre « hors-champ » aux services, propositions, tests et avances ; réserver l'interprétation charitable aux erreurs de transcription ; en début d'appel, autoriser à retenir ou à demander pourquoi. Comparer avant et après sur les questions réelles avant de livrer.
3. **Lot 4 — Raccrocher.** Seulement si Ulrich le veut : avertissement puis fin de ligne, traitée par l'application, avec le Game Master aligné.

Recommandé : essayer la note de posture, puis lot 2. Les lots 3 et 4 se décident après un appel d'écoute.

## À décider par Ulrich

1. Deux ou trois réponses qui vous gênent : sont-elles de la famille A, B, C, ou d'une autre ?
2. Un personnage doit-il pouvoir raccrocher ?
3. La fiche demande de raccrocher à la première « allusion sentimentale ». Dans un appel qui parle de l'amour entre Max et Emma, cette formule est à resserrer avant de la rendre active.
