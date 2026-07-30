# Audit de l’implémentation Lovable `rich_v2`

> Date : 30 juillet 2026
> Périmètre : synchronisation GitHub, conformité au plan
> `docs/plan_optimisation_payload_max.md`, compilation du prompt Max, tests et
> état Lovable visible.
> Cet audit ne modifie ni Notion, ni Lovable Cloud, ni la variante active.

## 1. Conclusion

Lovable n’a pas implémenté `rich_v2` à partir d’une ancienne version du plan.
Le commit du plan enrichi, `cbea7a1`, est l’ancêtre direct des quinze commits
Lovable suivants. L’historique Lovable confirme en outre que le plan et
`docs/proposition-fiche-max.md` ont été lus avant l’implémentation.

La synchronisation Git est saine :

- branche locale : `main` ;
- branche distante : `origin/main` ;
- commit commun : `82944c823df0c252b1d37b20ee4c09f669439470` ;
- arbre de travail propre ;
- Lovable référence le même commit.

L’implémentation respecte plusieurs décisions structurantes, mais elle ne doit
pas encore être activée globalement. Des erreurs de sélection apparaissent avec
les vrais textes longs de Max alors que les tests synthétiques passent.

## 2. Ce qui est conforme

- `rich_v2` est une troisième variante distincte ; `legacy` reste la valeur par
  défaut dans le dépôt.
- Le chemin `rich_v2` utilise `character_prompts` et ne concatène pas
  `characters.system_prompt`.
- Aucun nouvel hébergeur, backend externe ou appel LLM bloquant n’a été ajouté.
- Le RAG est spécifique à la variante : trois souvenirs de 900 caractères au
  maximum pour `rich_v2`, sans métadonnées techniques dans le texte destiné à
  Max.
- Le contrat conversationnel `rich_v2` est cohérent : réponse directe, une à
  trois phrases en général, quatre phrases courtes pour un souvenir, questions
  rares, interprétation charitable des ambiguïtés et erreurs STT.
- La trace expose les sections, les sous-parties, les omissions, la timeline
  retenue et l’ancrage de profondeur.
- La prévisualisation du noyau statique est disponible dans l’éditeur de
  personnage.
- `npm run test:quality` passe : 36 tests de régression, 168 tests unitaires et
  le build de production.

## 3. Écarts à corriger avant la canary

### P1 — La vraie timeline peut perdre « aujourd’hui » et le carnage d’hier

Le classement cherche les mots `hier` et `aujourd’hui` dans tout le texte d’un
événement. Un événement intitulé « il y a cinq jours » devient donc
artificiellement prioritaire s’il mentionne à l’intérieur quelque chose arrivé
« hier ». Le préambule éditorial contenant « aujourd’hui » est lui aussi traité
comme un événement récent.

Avec la timeline longue de la trace de référence, le compilateur retient le
préambule et l’événement « il y a cinq jours », mais peut omettre :

- l’événement explicitement intitulé « Aujourd’hui à Lausanne » ;
- l’événement explicitement intitulé « Hier — jour 4 », avec le carnage, le
  fusil et Léo.

Cela contredit l’ordre prévu par le plan : présent, hier, séjour, pivots anciens.

Correction attendue :

- distinguer le préambule des événements ;
- classer un événement d’abord à partir de son intitulé ou de son repère
  temporel initial, pas d’un mot trouvé dans son corps ;
- garantir explicitement au moins un événement « aujourd’hui » et un événement
  « hier » lorsqu’ils existent ;
- ajouter un test utilisant la timeline complète de Max, avec des mentions
  temporelles imbriquées.

### P1 — « Vérité nue » déclenche par erreur le niveau bonus

La sélection de profondeur associe actuellement l’expression `vérité nue` au
niveau bonus. Or, dans le contenu éditorial de Max, « NIVEAU 3 — Vérité nue »
est le nom du niveau 3. Un résumé de session tel que « Max reconnaît la vérité
nue » peut donc faire sauter Max directement au bonus.

Correction attendue :

- réserver le bonus à un marqueur explicite de niveau bonus ou à ses marqueurs
  éditoriaux réellement validés ;
- faire correspondre « vérité nue » au niveau 3 tant que c’est le titre Notion
  actif ;
- tester les libellés exacts de la fiche Notion, pas seulement des libellés
  simplifiés.

### P1 — Le préambule du champ de profondeur est supprimé

Le parseur commence au premier titre `NIVEAU 1` et ignore tout le texte qui le
précède. Le préambule riche prévu dans le plan — matière de voix et non scripts,
usage naturel des lectures, persistance de la profondeur, absence d’aveu
automatique en fin d’appel — n’est donc pas injecté. Il est remplacé par une
phrase générique plus courte.

Correction attendue :

- conserver ce préambule comme invariant de progression ;
- l’exposer comme sous-partie dans la trace ;
- tester sa présence avec le texte Notion complet.

### P1 — La profondeur est découpée depuis le début, pas sélectionnée par ancres

Dans la trace de référence, le champ `profondeur_par_niveau` contient environ
10 300 caractères ; seulement environ 1 200 sont injectés. La quantité seule
n’est pas le problème : le plan autorise une sélection runtime. Le défaut est
que chaque niveau est coupé à une frontière de phrase depuis son début, sans
identifier les sous-parties sémantiques prévues :

- posture intérieure ;
- matière révélable ;
- mécanisme de défense ;
- marqueurs de voix ;
- formulations d’ancrage.

Le résultat peut conserver quatre titres tout en perdant les détails qui font
la différence. Le test actuel vérifie la présence des quatre niveaux, pas la
présence de leurs fonctions éditoriales.

Correction attendue :

- segmenter chaque niveau par sous-titres, puces ou paragraphes sémantiques ;
- garantir une représentation de chaque fonction utile ;
- accorder plus de matière au niveau ancré sans couper systématiquement le
  début du niveau ;
- tracer les ancres retenues et omises ;
- utiliser la fiche Notion réelle comme fixture de non-régression anonymisée.

### P2 — Les listes Notion peuvent être traitées comme un seul bloc

Le parseur générique utilise les doubles sauts de ligne lorsqu’il ne trouve pas
les libellés `NOYAU`, `NUANCES` ou `REPÈRES DE VOIX`. Une liste de puces sans
ligne vide devient alors une seule sous-partie. Si elle dépasse son budget, elle
est coupée depuis le début.

Le champ « Ce que tu ne fais jamais » de la trace de référence est ainsi détecté
comme une seule sous-partie et réduit d’environ 1 274 à 811 caractères.

Correction attendue :

- reconnaître les puces, listes numérotées et sous-titres Notion ;
- ne couper une sous-partie unique que comme ultime recours ;
- tester une vraie liste Notion sans lignes vides.

### P2 — Le budget statique tracé sous-compte le prompt final

Le compilateur respecte son budget interne de 12 000 caractères, mais le rendu
final ajoute l’en-tête de fiche ensuite. Sur les données de la trace, le noyau
réel atteint environ 12 001 à 12 038 caractères selon la profondeur, tandis que
le rapport du compilateur annonce environ 11 945 à 11 982.

Le plafond absolu de 18 000 n’est pas dépassé dans ce test, mais la métrique
`staticChars` ne correspond pas exactement au texte envoyé.

Correction attendue :

- compter tous les séparateurs et en-têtes dans le budget final ;
- tester l’égalité entre somme tracée et longueur exacte du prompt rendu ;
- faire appliquer le plafond de 12 000 au noyau réellement envoyé.

### P2 — Le fallback `rich_v2` contient deux contrats de longueur

Si les champs structurés ne sont pas disponibles, `maxAgent` concatène le
fallback historique — une à deux phrases, 45 mots — et le contrat `rich_v2` —
une à trois phrases, parfois quatre. Le chemin nominal est sain, mais le chemin
de secours redevient contradictoire.

Correction attendue :

- créer un fallback minimal propre à `rich_v2` sans règle de longueur
  concurrente ;
- ajouter un test du chemin sans `character_prompts`.

### P3 — Documentation de tests inexacte

Le changelog et `STORY.md` annonçaient 178 tests. L’exécution locale en compte
168, tous au vert. Les 17 nouveaux tests ont bien été ajoutés à une base de 151,
ce qui donne 168.

La mention « typecheck propre » n’a pas pu être reproduite séparément dans cet
environnement, car le dépôt n’expose pas de script `typecheck` et l’outil
invoqué par Lovable n’est pas installé localement. Le build TypeScript/Vite
passe néanmoins.

## 4. Vérifications Lovable Cloud encore nécessaires

La base Lovable Cloud est active, mais le connecteur disponible pour cet audit
ne possède pas la permission de lecture du projet. Aucun accès alternatif ni
aucune modification de production n’a été tenté.

Avant la canary, vérifier dans l’interface :

1. que `MAX_PROMPT_VARIANT` est encore `legacy` globalement ;
2. que la prévisualisation `rich_v2` de Max montre bien les textes Notion
   fraîchement synchronisés ;
3. que `situation_summary` commence par le présent à Lausanne et contient les
   faits récents validés ;
4. que la dernière synchronisation a été faite en `fields_only` ;
5. qu’aucune réindexation RAG n’a remplacé le corpus avant validation des champs.

## 5. Décision de rollout

Ne pas activer `rich_v2` globalement dans cet état.

Ordre recommandé :

1. corriger les quatre écarts P1 et leurs fixtures réalistes ;
2. corriger les écarts P2 ;
3. exécuter `npm run test:quality` ;
4. vérifier manuellement les cinq points Lovable Cloud ci-dessus ;
5. lancer une session diagnostique `rich_v2` ;
6. contrôler dans la trace la timeline retenue, le niveau choisi, les ancres de
   profondeur et la longueur exacte ;
7. seulement ensuite lancer la comparaison canary avec `legacy`.

## 6. Critères de sortie complémentaires

- « Aujourd’hui à Lausanne » et « Hier — jour 4 » sont toujours présents quand
  ces événements existent dans la timeline.
- Une mention interne de `hier` ne change pas la date principale d’un événement.
- « Vérité nue » sélectionne le niveau 3 avec la fiche éditoriale actuelle.
- Le préambule de progression est injecté et tracé.
- Chaque niveau de profondeur conserve au moins une posture, une matière
  révélable et un marqueur de voix lorsque ces éléments existent.
- Une liste Notion sans ligne vide produit plusieurs sous-parties.
- Le nombre de caractères tracé égale exactement la longueur rendue.
- Le fallback `rich_v2` ne contient qu’un seul contrat de longueur.
