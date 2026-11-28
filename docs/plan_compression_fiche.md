# Plan — Compression de la fiche personnage

Statut au 28 novembre 2026 : **lot 1 livré, banc avec le modèle fait, limite de `proxy-llm` relevée à 120 000 caractères** (décision d'Ulrich) ; lot 2 qualité à faire ([reprise lot 2](prompt_reprise_compression_fiche_lot_2.md)).

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

## Lot 1 — livré le 28 novembre (mesure sans modèle)

### Notion et l'application ont le même texte

Pages Max et Emma lues dans Notion Gamilab (lecture seule), comparées champ par champ à `character_prompts` de sandbox-ulrich, sandbox-romed et sandbox-benoit :

- les 9 champs synchronisés sont **identiques mot pour mot** dans les trois sandboxes ;
- les retours à la ligne sont gardés ; seul le gras de Notion est perdu (les sous-titres deviennent des lignes simples), sans effet pour le personnage ;
- « Ce que tu sais aujourd'hui » est vide dans Notion comme dans l'application ;
- le corps de page (≈ 114 000 caractères par personnage) n'entre pas dans la fiche : il alimente les souvenirs (`query-rag`).

Aucune correction de synchronisation n'est nécessaire.

### Ce qui est codé

- Réglage **« Fiche envoyée »** par personnage dans Admin › Réglages personnages, enregistré par environnement dans `admin_settings` (clé `ava_character_sheet_compression`, sans migration), lu une fois à la préparation de l'appel ; noté dans la trace du tour (`budget.sheetCompression` : niveau, champs entiers, place).
- Dans `optimized_v3` ([maxOptimizedPromptCompiler.ts](../src/agents/maxOptimizedPromptCompiler.ts), niveaux dans [sheetCompression.ts](../src/agents/sheetCompression.ts)) :
  - les champs du niveau partent **en entier dans le noyau**, en tête du prompt, dans l'ordre de la fiche, sans ce que portent déjà les sections protégées ;
  - noyau et limite de contexte grandissent exactement de leur taille ;
  - au-dessus d'« Actuel », la Manière de parler ne cède plus de paragraphes aux faits établis ;
  - les sections du tour (mémoire, cadre, directive, état, parole) ne sont plus dédoublonnées contre les champs entiers ni contre le noyau entier (un texte aussi long contient presque tous les mots et faisait tomber des phrases au hasard) ; les souvenirs restent dédoublonnés contre toute la fiche envoyée, mais seulement sur un passage recopié (cinq mots de suite).
- « Voir ce que reçoit le personnage » montre le niveau choisi, la taille du prompt et la part de la fiche envoyée, champ par champ.
- Rejeu généralisé : `npm run eval:replay:compression` (reconstitution des tours dans `scripts/eval-judge/turnReplay.ts`, partagée avec `eval:replay:reply-block`).

### Mesure (605 questions réelles depuis le 19 novembre, sans modèle, sans souvenirs)

| | Actuel | Consignes entières | Fiche entière |
|---|---|---|---|
| Prompt médian Max (p90) | 16 498 (17 192) | 37 436 (38 092) | 63 522 (64 225) |
| Prompt médian Emma (p90) | 15 306 (16 438) | 38 171 (39 184) | 60 445 (61 485) |
| Part de la fiche, Max / Emma | 14 % / 14 % | 52 % / 57 % | 100 % / 100 % |
| Sections évincées | 0 | 0 | 0 |
| Alertes | Emma 14 (`canon_squeezed`) | 0 | 0 |

- **Niveau Actuel identique à `main`** : même empreinte du prompt sur 605 questions sur 605 (rejeu avec le compilateur de `main`).
- Mémoire : plus complète aux niveaux supérieurs (151 tours de Max, 77 d'Emma gardent une phrase qu'« Actuel » retirait à tort comme doublon). Aucune phrase perdue ; un seul cas chez Emma (« Mona est dans un camp ») est un vrai doublon, déjà envoyé dans le canon.
- Le défaut de doublon à tort reste en « Actuel » (prompt inchangé par décision) ; il ne grossit pas avec le noyau.
- Part de la fiche en « Actuel », champ par champ (médiane, Max) : présent 100 %, Manière de parler 90 %, Identité 36 %, Dynamique 25 %, Sujets sensibles 8 %, Ce que tu ne fais jamais 4 %, Timeline 2 %, Qui tu es et Références 0 %.

### Pas fait dans ce lot

- Banc avec le modèle (délai de la première phrase, part en cache, coût) : il attend l'accord d'Ulrich sur le coût, au début du lot 2.
- Aucun réglage enregistré, aucun appel réel, écran non regardé dans l'aperçu Lovable.

## Banc avec le modèle (28 novembre, accord d'Ulrich, 0,09 $ dépensés)

`npm run eval:llm-latency -- --sheet-compression <niveau>` compile les prompts réels du corpus du juge au niveau choisi (en mémoire, sans réglage enregistré), puis les joue en flux par `proxy-llm`, comme en jeu (`gpt-5.6-luna`, routage par latence, Amazon Bedrock). 19 questions (10 Max, 9 Emma) × 3 niveaux, deux passages, sandbox-ulrich, 115 appels.

| | Actuel | Consignes entières | Fiche entière |
|---|---|---|---|
| Jetons envoyés (médiane) | ≈ 5 000 | ≈ 10 000 (Max) / 10 500 (Emma) | — |
| Première phrase, 1er passage (médiane) | 735 ms | 782 ms | refusé |
| Premier jeton, 1er passage (médiane) | 506 ms | 588 ms | refusé |
| Coût par réplique, sans cache | 0,0013 $ | 0,0027 $ | refusé |
| Coût par réplique, prompt identique rejoué | 0,0002 $ | 0,0003 $ | refusé |

- **« Consignes entières » ne ralentit presque pas** : + 47 ms sur la première phrase, + 82 ms sur le premier jeton, dans le bruit d'un appel à l'autre.
- **Coût doublé** sans cache : ≈ 0,08 $ par appel de 30 répliques au lieu de ≈ 0,04 $.
- **Le cache ne sert qu'au même prompt rejoué** (2e passage : presque tout en cache, coût divisé par 8). D'une question à l'autre, il ne s'active pas, même avec 33 500 caractères de tête commune (0 appel sur 19 au 1er passage, 1 sur 19 en « Actuel »). Les 420 répliques jouées ces 10 jours n'ont jamais eu de cache. En jeu, il faut donc compter le coût sans cache.
- **« Fiche entière » est refusée par `proxy-llm`** : la fonction refuse tout message de plus de 60 000 caractères (`messages payload too large`, [proxy-llm](../supabase/functions/proxy-llm/index.ts)), et le prompt fait 63 000 à 67 000 caractères. 38 appels sur 38 refusés, non facturés. En jeu, ce niveau ferait répondre le personnage par la réplique de secours. Aucun niveau n'étant enregistré, aucun appel réel n'est touché.

**Décision d'Ulrich (28 novembre) : relever la limite.** `proxy-llm` accepte maintenant 120 000 caractères par requête (constante partagée [proxyLlmLimits.ts](../supabase/functions/_shared/proxyLlmLimits.ts)), assez pour « Fiche entière » avec l'historique (≈ 70 000). Le compilateur ajoute l'alerte `proxy_limit_exceeded` (trace et aperçu) quand un tour dépasserait cette limite, au lieu d'un refus silencieux. La limite reste un garde-fou contre les requêtes trop coûteuses.

## Risques connus

- **Délai** : le prompt passe d'environ 16 500 à environ 37 500 caractères (Consignes entières) ou environ 63 500 (Fiche entière), mesuré au lot 1. Le cache peut en absorber une partie : la tête du prompt (règles et noyau) ne dépend plus de la question au-dessus d'« Actuel ». À mesurer avec le modèle.
- **Coût** par tour : jusqu'à 3 à 4 fois plus sans cache.
- **Personnage noyé** dans un prompt long : c'est l'objet du lot 2.
- **Dédoublonnage de la mémoire** contre les mots du noyau entier : constaté au lot 1 sur un essai, corrigé avant mesure (voir ci-dessus).
