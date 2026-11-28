# Prompt de reprise — Bible des réponses, lot 1 : préparer la matière

À copier dans un nouveau chat Ava, quand Ulrich lance ce lot. Ce lot seulement.

## Objectif

Préparer, depuis les vrais appels, la matière de la [Bible des réponses](plan_cadre_appel.md#bible-des-réponses). Il s'agit des réponses qui sonnent « IA », classées en cas, chiffrées et illustrées. Ulrich écrira ensuite le « pourquoi » et le « quoi faire à la place ». **Aucune règle de style n'est écrite ni envoyée au personnage dans ce lot.**

## État au 28 novembre (à revérifier sur origin/main)

- Cadre de l'appel, lot 2 livré ([plan](plan_cadre_appel.md), [mesures](eval/cadre_appel_lot2_mesures_20261128.md)). Un paragraphe « Comment tu réponds » de la fiche (900 caractères au plus) arrive en entier à chaque tour, avec sa propre place. Ulrich doit encore coller le [texte proposé](proposition_bloc_comment_tu_reponds.md) dans Notion : vérifier s'il l'a fait (aperçu « Voir ce que reçoit le personnage », ou `npm run eval:judge:sheets -- --env sandbox-ulrich`).
- Premier tic déjà mesuré :
  - « je ne sais pas / je n'arrive pas / je n'ai pas » dans la dernière phrase : 175 répliques sur 361 chez Max, 35 sur 79 chez Emma ;
  - points de suspension : 318 sur 361 et 68 sur 79 ;
  - cause probable, non testée : le gabarit de [responseHook.ts](../src/agents/responseHook.ts).
- Familles déjà repérées au lot 1 : A (se prête aux tests et commente l'outil), B (décline poliment, sans conséquence), C (répond à tout, approuve : « Oui, c'est juste », « Tu as raison »).
- Outil de rejeu des prompts sans modèle : `npm run eval:replay:reply-block` ([script](../scripts/eval-judge/replyBlockReplay.ts)).

## Périmètre

1. **Relever les tics en lecture seule**, sur les répliques de Max et Emma depuis le 19 novembre, sur sandbox-ulrich, sandbox-romed et sandbox-benoit. Ouvertures d'appel à part. Pour chaque tic : la formule, sa fréquence par personnage, l'endroit dans la réplique (début, fin), et ce qui le déclenche quand c'est visible (type de question, moment de l'appel). Au moins :
   - aveu d'impuissance en fin de réplique ;
   - « Oui » / « Tu as raison » d'approbation ;
   - reformulation de la question ;
   - question de relance réflexe ;
   - points de suspension ;
   - émotion nommée (« je ressens ») ;
   - méta sur la conversation ou l'outil.
   Compter par mots est approximatif : le dire et donner la méthode.
2. **Écrire les cas** dans `docs/bible_reponses_matiere.md`, au format en cinq points du plan :
   - contexte : moment de l'appel, parole de l'interlocuteur, enjeu ;
   - réponse refusée, citée d'un vrai appel avec la session et la date ;
   - « Pourquoi » : vide, pour Ulrich ;
   - principe : vide ;
   - bonnes réponses : vide.
   Deux ou trois exemples réels par tic, les plus parlants, sans transcript complet.
3. **Proposer un jeu de questions de contrôle** (20 à 40 vraies questions, Max et Emma), à rejouer avant et après la Bible, avec la manière de compter les tics. Rien n'est lancé contre un modèle sans accord.
4. **Poser les décisions ouvertes à Ulrich**, une à la fois, avec un exemple concret pour chacune : où vivent les principes (bloc « Comment tu réponds », Manière de parler, autre), ce qui est commun aux deux personnages ou propre à chacun, et la place qu'ils prendront.

## Hors de ce lot

- Écrire les principes ou les bonnes réponses à la place d'Ulrich.
- Modifier `responseHook.ts`, le contrat de conversation, la règle hors-champ ou la directive relationnelle.
- Raccrocher.
- Les synonymes des sujets sensibles.
- Corriger le dédoublonnage de la mémoire contre le noyau entier (constaté au lot 2) : seulement le signaler s'il gêne.

## Limites

- Lecture seule en base, par le connecteur ou les scripts d'évaluation existants. Aucune migration, aucune écriture en base, aucun réglage ni prompt modifié sans accord.
- Base Caractères Notion en lecture seule ; aucun texte collé dans une fiche par l'agent.
- Production non lue pour les répliques, non publiée.
- Gami DigiDouble exclu. Un seul agent actif sur Ava.

## Livraison et clôture obligatoire

- Lot documentaire selon `AGENTS.md` : relire contenu, liens et diff, et vérifier que le code est inchangé. Si un script d'évaluation est ajouté, c'est un lot de code : `npm run test:quality` et `npm run test:delivery` verts, puis PR, CI, fusion par la garde.
- Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG.
- Préparer ensuite le prompt du lot suivant (`docs/prompt_reprise_bible_reponses_lot_2.md`) avec cette même obligation. Ce lot suivant sera l'écriture des principes avec Ulrich, puis leur emplacement. S'il ne reste rien, le dire.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis la section « Bible des réponses » du [plan](plan_cadre_appel.md).
