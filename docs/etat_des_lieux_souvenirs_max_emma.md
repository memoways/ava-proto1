# État des lieux — pourquoi Max et Emma « oublient » leurs souvenirs

24 novembre 2026 · pour Romed, Ulrich et l'équipe · aucune modification faite, ce document explique et propose.

## Ce qui s'est passé

Le 23 novembre, Romed a fait deux longs appels (65 et 70 échanges), avec Max puis Emma. Plusieurs fois, il a posé une
question dont la réponse est écrite noir sur blanc dans les souvenirs du personnage, dans Notion :

- pourquoi le père de Max a envoyé Mona au camp ;
- comment le fusil du grand-père est arrivé au chalet ;
- comment Emma a appris que Mona était devenue protogyne ;
- la scène de Mona qui sonne à la porte.

À chaque fois, le personnage n'invente pas : il dit **« je ne sais pas »** ou **« je ne peux pas le confirmer »**.
Max dit aussi « je peux demander aux bénévoles », alors qu'il parle justement à un bénévole.

## Ce qu'on a vérifié

On a rejoué les questions de Romed avec ses vraies fiches, sa vraie conversation et la vraie recherche de souvenirs,
sans faire répondre le personnage. On a regardé ce qui part réellement vers Max ou Emma.

**1. La recherche de souvenirs fonctionne.** Pour chaque question, le bon souvenir est trouvé, et presque toujours en
première position : le souvenir du père et du camp pour Max, celui du fusil pour Max et pour Emma, celui de l'appel
de Mona pour Emma.

**2. Mais il n'arrive jamais au personnage.** Ce qu'on envoie à Max à chaque réplique a une taille limitée, comme une
valise. On la remplit toujours dans le même ordre :

1. les règles de conduite (comment parler, ce qu'il ne doit jamais faire, l'ordre de priorité) ;
2. le cœur de sa fiche (qui il est, ce qui est vrai aujourd'hui, sa manière de parler) ;
3. la situation de l'appel ;
4. le résumé de ce qui s'est déjà dit dans l'appel ;
5. les autres passages de la fiche utiles à la question ;
6. **les souvenirs retrouvés pour cette question.**

Les deux premiers remplissent déjà presque toute la valise. Dans les cinq questions rejouées, il ne reste rien pour
les points 4, 5 et 6 : **ni les souvenirs, ni le résumé de la conversation, ni les passages utiles de la fiche ne
partent.** Le personnage répond avec ses règles, le cœur de sa fiche et les trois ou quatre dernières répliques.
Quand on lui demande un détail qui n'est que dans un souvenir, il ne l'a pas sous les yeux, et ses règles lui disent
d'avouer quand il n'est pas sûr. D'où « je ne sais pas ».

Cela touche aussi la mémoire de l'appel : comme le résumé de la conversation ne part pas, le personnage ne se
souvient, en pratique, que des derniers échanges.

**3. Comment on en est arrivé là.** Ces dernières semaines, on a enrichi le cœur de la fiche et les règles (le vécu,
l'ordre de priorité, les faits établis en entier). Chaque fois, on a agrandi la valise d'autant, en pensant que le
reste garderait sa place. Mais le reste n'avait pas de place réservée : il prenait ce qui restait. Rien ne
l'affichait. L'écran « Ce que reçoit Max » ne montre pas de vrai tour (pas de question, pas de souvenirs), donc ses
« absent » n'alertaient pas.

**4. Le cadre « bénévole » est éteint.** Dans la configuration utilisée, le texte qui dit au personnage qu'il parle à
une personne bénévole est désactivé. Il ne l'a donc jamais reçu.

**5. Deux phrases de fiche orientent mal.** Le paragraphe « ce qui est vrai aujourd'hui » de Max dit qu'il a su pour
Mona « en prenant les clés chez lui ». Max en déduit que son père ne lui a rien dit, ce qui contredit le souvenir où
son père le lui annonce. Et la phrase qui accompagne les souvenirs dit « jamais leur contenu récité » : même retrouvé,
un souvenir est présenté comme une émotion, pas comme un fait à donner si on le demande.

## Comparaison avec l'audit fait par Cursor

Les deux audits sont d'accord sur : l'écran trompeur, le peu de place laissé aux passages utiles de la fiche, la
phrase « en prenant les clés », le fusil absent des faits établis, la phrase « jamais leur contenu récité », le cadre
éteint.

Ils divergent sur la cause principale. Cursor pense que **le bon souvenir n'est pas trouvé** et propose de le forcer
en tête de la recherche. La mesure montre l'inverse : **il est trouvé, puis jeté faute de place.** Forcer sa
recherche ne changerait rien tant que la place manque. Il faut donc d'abord corriger la place ; l'idée de Cursor
pourra être reprise ensuite si une mesure montre des souvenirs mal trouvés.

## Ce qu'il faut faire

**Étape 1 — donner une place garantie à chaque chose, et la contrôler.**
- Chaque partie a sa place réservée : les souvenirs (jusqu'à trois en entier), le résumé de l'appel, les passages
  utiles de la fiche, l'état du personnage. La valise grandit de ce qu'il faut pour les contenir.
- Chaque réplique enregistre ce qui est réellement parti (quelles parties, quels souvenirs), sans le texte. On pourra
  le lire dans Admin › Sessions pour n'importe quel appel.
- Si une partie ne tient pas, une alerte visible le dit, au lieu de la retirer en silence.
- L'écran « Ce que reçoit Max » peut simuler un vrai tour long.

**Étape 2 — rallumer le cadre et ajuster deux consignes.** Réactiver le texte « bénévole ». Dire qu'un souvenir
présent fait foi et qu'on donne le fait quand on le demande, sans réciter le souvenir de soi-même.

**Côté Romed (fiches, Notion)** : reformuler « en prenant les clés » ; décider si le fusil donné par le grand-père
fait partie des faits établis ; dire si « Max n'a jamais essayé de sortir Mona du camp » doit y figurer.

## Comment éviter de casser autre chose

- **Un test automatique avec les vraies fiches** de Max et Emma, sur un tour long : il échoue si le cœur de la fiche,
  les souvenirs, le résumé ou les passages utiles manquent. Il protège aussi contre la prochaine fois qu'on enrichit
  une fiche.
- **Avant / après sur les mêmes questions** : les questions de Romed et le jeu de questions de faits déjà utilisé. On
  compare les réponses, pas seulement les chiffres.
- **Coût et délai mesurés.** Envoyer plus de texte coûte plus : environ 40 % de texte en plus par réplique, à
  confirmer. Le délai de réponse dépend surtout de la longueur de la réponse, pas de celle de la question : on attend
  peu d'effet, mais on le mesure sur au moins 10 répliques.
- **Effets à surveiller** : un personnage qui récite trop ses souvenirs (d'où la consigne de l'étape 2), des réponses
  plus longues, un ton qui change. Romed écoute quelques appels complets avant toute mise en production.
- **Rien d'autre ne bouge** : le Game Master, les vidéos, la voix et les fiches Notion ne sont pas touchés. Le
  changement est réglable et peut être annulé.
- **Une étape à la fois**, chacune vérifiée avant la suivante. Rien ne part en production sans accord.

Détail technique et chiffres : [audit](audit_souvenirs_absents_20261124.md).
