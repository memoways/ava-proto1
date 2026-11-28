# Plan — Compression de la fiche personnage

Statut au 28 novembre 2026 : **plan approuvé par Ulrich ; lot 1 à faire** ([reprise](prompt_reprise_compression_fiche_lot_1.md)). Aucun code dans ce plan.

## Demande

Ulrich découvre que Max et Emma ne reçoivent qu'environ 15 % de leur fiche Notion à chaque réplique. Pour lui, tout ce qui est écrit dans Notion et synchronisé doit servir.

Il veut :

- vérifier que l'application a bien tout le texte de Notion ;
- pouvoir réduire la compression, voire la couper, depuis le back-office, sans créer de nouvelle version ;
- comparer ensuite réactivité, coût et qualité des réponses.

## Constat (mesuré le 28 novembre, `optimized_v3`, fiches de sandbox-ulrich)

| | Max | Emma |
|---|---|---|
| Fiche synchronisée, tous champs | 54 027 car. | 52 072 car. |
| Noyau envoyé à chaque tour (médiane) | 7 249 car. | 7 151 car. |
| Canon trié envoyé en plus (médiane) | 636 car. | 743 car. |
| Prompt système complet (médiane, 605 questions) | 16 498 car. | 15 306 car. |

Taille des champs (Max) :

| Champ | Taille |
|---|---|
| Timeline | 13 206 |
| Références intellectuelles | 8 489 |
| Dynamique de la conversation | 7 756 |
| Ce que tu sais sur l'utilisateur | 5 622 |
| Sujets sensibles | 4 983 |
| Ce que tu ne fais jamais | 4 111 |
| Identité fondamentale | 4 033 |
| Manière de parler | 2 793 |
| Qui tu es | 2 284 |
| Présent | 750 |

**Comment le tri marche aujourd'hui.** Ni le Game Master ni une recherche sémantique ne trient. Le compilateur (`selectStaticUnits` dans [maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts)) envoie toujours le présent, les faits établis, le moteur, la Manière de parler et « Ce que tu cherches dans cet appel ». Pour le reste, il compte les mots communs entre la question (plus la mémoire) et chaque morceau de la fiche, dans environ 650 caractères.

Conséquence : une consigne valable pour tout l'appel (« tu te fermes si… », « une question hors sujet te déroute ») ne partage aucun mot avec les questions et ne passe presque jamais ([diagnostic, lot 1 du cadre de l'appel](plan_cadre_appel.md)). Seuls les souvenirs (recherche `query-rag`) font revenir une partie de la Timeline.

## Décisions d'Ulrich (28 novembre)

- **Trois niveaux par nature de texte**, pas un pourcentage : monter le pourcentage avec le même tri ferait passer plus de morceaux, mais pas les bons.
- **Réglage par personnage**, dans Réglages personnages, enregistré par sandbox, sans nouvelle version d'orchestration ni du Game Master, effet au prochain appel.
- Le bloc « Comment tu réponds » (lot 2 du cadre de l'appel) **n'est pas à coller** : il devient inutile dès le niveau « Consignes entières ». Le code reste, inactif sans bloc.
- La Bible des réponses attend la fin de ce chantier. Elle sera écrite sur un personnage qui reçoit sa fiche.

## Les trois niveaux

| Niveau | Envoyé en entier | Trié selon la question | Part de la fiche (Max, estimée) |
|---|---|---|---|
| **Actuel** (défaut) | présent, faits établis, moteur, Manière de parler, « Ce que tu cherches » | tout le reste, ≈ 650 car. | ≈ 15 % |
| **Consignes entières** | en plus : Identité fondamentale, Qui tu es, Dynamique, Ce que tu ne fais jamais, Ce que tu sais sur l'utilisateur | Timeline, Sujets sensibles, Références (et souvenirs) | ≈ 50 % |
| **Fiche entière** | tous les champs | rien | 100 % |

Principes :

- Les souvenirs restent en plus, sans doublon avec ce qui est déjà envoyé.
- Mémoire, cadre, directive relationnelle, état et parole du tour gardent leur place.
- Sur le niveau Actuel, le prompt reste identique à aujourd'hui (vérifié par rejeu).
- Le texte fixe va en tête du prompt, pour profiter de la mise en cache par le fournisseur.

## Lots

1. **Lot 1 : vérifier, régler, mesurer sans modèle.**
   - Notion et l'application ont-elles le même texte, champ par champ ?
   - Réglage à trois niveaux par personnage, et aperçu « Voir ce que reçoit le personnage » par niveau.
   - Rejeu des 605 questions : taille du prompt et place de chaque section par niveau.
   - Si Ulrich donne son accord sur le coût annoncé : un petit banc avec le modèle sur sandbox-ulrich (délai de la première phrase, part en cache, coût).
2. **Lot 2 : qualité.**
   - Juge automatique sur un même jeu de questions, à chaque niveau : respect des limites, hors-sujet, tests, approbation, faits.
   - Appels de recette d'Ulrich.
   - Décision du niveau par défaut.
3. **Ensuite :** reprise de la [Bible des réponses](plan_cadre_appel.md#bible-des-réponses) sur le niveau retenu.

## Risques connus

- **Délai** : le prompt passerait d'environ 16 500 à environ 35 000 caractères (Consignes entières) ou environ 62 000 (Fiche entière). Le cache peut en absorber une partie : à mesurer.
- **Coût** par tour : jusqu'à 3 à 4 fois plus sans cache.
- **Personnage noyé** dans un prompt long : c'est l'objet du lot 2.
- **Dédoublonnage de la mémoire** contre les mots du noyau entier : avec un noyau plus long, plus de phrases de mémoire peuvent tomber à tort (constaté au lot 2 du cadre de l'appel). À mesurer au lot 1, et à corriger si cela arrive.
