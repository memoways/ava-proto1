# Cadre de l'appel, lot 2 — mesures du bloc « Comment tu réponds » (28 novembre 2026)

## Méthode

- `npm run eval:replay:reply-block -- --envs sandbox-ulrich,sandbox-romed,sandbox-benoit --since 2026-11-19 --block-max docs/eval/cadre_appel_lot2_bloc_max.txt --block-emma docs/eval/cadre_appel_lot2_bloc_emma.txt`
- Lecture seule : sessions, versions d'orchestration, fiches synchronisées (mises à jour le 23 novembre), profils radar. Aucun modèle appelé, rien écrit, production refusée.
- Chaque question du joueur suivie d'une réponse est rejouée dans l'assemblage `optimized_v3` réel : historique, mémoire finale de la session, directive relationnelle, cadre et état initial du radar. Elle est assemblée une fois avec la fiche telle quelle, une fois avec le bloc proposé collé en mémoire à la fin de « Ce que tu ne fais jamais ».
- Comme au lot 1, les souvenirs ne sont pas recherchés (aucun appel `query-rag`). Les tests unitaires couvrent les souvenirs réels (fixture du 23 novembre).
- Le même rejeu, sans bloc, a été lancé aussi sur le code de `main` (`da063634`) pour comparer les prompts.

## Résultats

605 questions : 39 sessions sur sandbox-ulrich, 18 sur sandbox-romed, 4 sur sandbox-benoit. Le lot 1 en comptait 450, sur une période plus courte.

| | Max | Emma |
|---|---|---|
| Questions rejouées | 468 | 137 |
| Prompt système sans bloc : médiane (max) | 16 498 (17 380) car. | 15 306 (17 482) car. |
| Bloc envoyé en entier | 468 / 468 | 137 / 137 |
| Taille du bloc (sous le titre) | 858 car. | 885 car. |
| Prompt en plus avec le bloc | + 882 car. à chaque tour | + 909 car. à chaque tour |
| Autres sections identiques (faits établis, cadre, directive, état, mémoire, canon) | 468 / 468 | 137 / 137 |
| Nouvelles alertes de budget | 0 | 0 |
| Sans bloc : prompt identique à `main` | 605 / 605 (empreinte du prompt) | |

Effet sur la taille : + 5 à 6 % du prompt système. La limite de contexte et le noyau grandissent exactement de la taille du bloc. Les autres sections gardent donc la même place qu'avant.

## Constat en cours de mesure

Première version du texte, avec « si l'utilisateur se montre hostile » : dans 17 tours de Max, une phrase de mémoire (« L'utilisateur souhaite parler à Emma pour savoir comment elle va ») était retirée comme doublon. Cause : la mémoire est comparée mot à mot au noyau entier. Le mot « utilisateur » faisait passer le seuil de 82 % des mots communs. Ce n'était pas un manque de place. Le texte proposé dit « ton interlocuteur », et le cas disparaît (468 / 468). La comparaison elle-même n'est pas corrigée.

## Non mesuré

- Effet sur la manière de répondre : à observer en appel après le collage dans Notion et la synchronisation.
- Souvenirs sur ces 605 questions : la place ajoutée est la taille exacte du bloc, et les tests sur les souvenirs réels montrent les mêmes souvenirs envoyés.
- Production.
