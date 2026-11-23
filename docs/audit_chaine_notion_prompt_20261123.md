# Audit — chaîne Notion → prompt du personnage, et coupure à 1 200 caractères

23 novembre 2026 · pour Ulrich et Romed · tâche Notion
[Supprimer la coupure des prompts et auditer la chaîne Notion → application](https://app.notion.com/p/a5a62322e59583969fff016553449c09).

**Ce lot est un diagnostic.** Aucun code de jeu modifié, aucune fiche touchée, rien en production. La correction
est le lot suivant ([prompt de reprise](prompt_reprise_coupure_faits_lot_2.md)).

## En bref

1. **La coupure existe et elle est destructrice.** Elle s'applique au paragraphe « Ce qui est vrai aujourd'hui » de
   l'identité de Max et d'Emma. Le code le coupe à 1 200 caractères (à la dernière phrase complète), puis **retire le
   paragraphe entier** du reste de la fiche. La fin coupée n'arrive donc nulle part dans le prompt.
2. **Ce qui est perdu, vérifié sur les fiches synchronisées (sandbox-ulrich, 21 novembre)** : 4 phrases par
   personnage, dont « Elle est toujours dans un camp de quarantaine, où ton père l'a mise » et la chronologie de qui a
   su quoi et quand. C'est exactement l'erreur mesurée par le juge (Max nie que son père ait envoyé Mona au camp, 3/3).
3. **Relever la limite seule ne suffit pas, et peut empirer.** Le noyau du personnage a un budget fixe de 7 000
   caractères. À 1 500 la fin arrive chez Max et Emma. À 1 700 ou plus, le bloc d'Emma ne tient plus : le code le
   **supprime entièrement, sans avertissement**, et la phrase manque de nouveau. Il y a donc deux coupures
   silencieuses, pas une.
4. **Coût et latence : quasi inchangés.** Le prompt reste à ≈ 10 000 caractères (≈ 2 800 tokens, estimation), car le
   budget du noyau est constant : ce que les faits gagnent, d'autres extraits de la fiche le cèdent. Mesure en jeu
   réel à faire au lot suivant.
5. **Le plus gros constat n'est pas la coupure.** Une fiche fait ≈ 53 000 caractères ; ≈ 7 000 arrivent au modèle à
   chaque tour (13 %), plus 3 souvenirs du RAG. Environ 220 extraits sont écartés par tour, faute de place. Une grande
   partie de ce qu'écrit Romed n'est jamais lue par le personnage.
6. **Le champ « Ce que tu sais aujourd'hui » n'est pas nécessaire** si la coupure est corrigée : il dirait la même
   chose que le paragraphe existant et créerait deux sources. Proposition : ne pas le remplir, ou y déplacer ce
   paragraphe tel quel (sans nouveau contenu). Décision de Romed.

## 1. La chaîne réelle, de Notion au modèle

Inspecté : `main` à `72a4322e`, variante de prompt `optimized_v3` (réglage `MAX_PROMPT_VARIANT`, lu dans
`admin_settings` : `optimized_v3` sur prod et les quatre sandboxes). Fiches lues dans `character_prompts` de
sandbox-ulrich (Max et Emma mis à jour le 21 novembre à 13 h 04). **Fiches de production non lues.**

| Étape | Où | Ce qui se passe | Modifie le texte ? |
|---|---|---|---|
| 1. Fiche Notion | Base Caractères AVA (Romed) | Champs : identité, qui tu es, ce que tu ne fais jamais, relation à l'interlocuteur, dynamique, sujets sensibles, références intellectuelles, timeline, manière de parler, situation, « Ce que tu sais aujourd'hui » (vide) ; corps de page = souvenirs | — |
| 2. Synchro | Edge `sync-notion` (bouton admin, mode `full` / `fields_only` / `rag_only`) | Champs copiés dans `character_prompts` par environnement ; corps de page découpé et vectorisé pour le RAG | Non pour les champs ; le texte envoyé au calcul des vecteurs est limité à 18 000 car. par morceau (sans effet sur le texte stocké) |
| 3. Chargement | `characterPromptService` | Fiche lue une fois puis gardée en mémoire du navigateur, **sans expiration** | Non. Après une resynchro, recharger la page |
| 4. Faits établis | `src/services/establishedFacts.ts` | Extrait le paragraphe « Ce qui est vrai aujourd'hui », ajoute les liens de famille (titres « permanent » de la timeline) et la phrase « Tu ne confonds pas les chronologies » | **Oui : coupe à 1 200 car.** |
| 5. Noyau protégé | `maxOptimizedPromptCompiler.ts`, `protectedCharacterSections` | Présent de l'appel + faits établis + vécu + incarnation ; la manière de parler cède ses derniers paragraphes si besoin | **Oui** : cède jusqu'à ≈ 1 000 car. de manière de parler ; **supprime tout le bloc des faits** s'il ne tient pas |
| 6. Sélection du reste | `selectStaticUnits` | Les autres champs sont découpés en extraits, classés selon la question, ajoutés jusqu'à 7 000 car. (noyau compris) | **Oui** : ≈ 220 extraits écartés par tour |
| 7. Couches du tour | même fichier | Contrat, hiérarchie, cadre (1 650), directive relationnelle (1 400), parole du tour, état/radar, consignes GM (800), mémoire (1 200), vidéos | Plafonds par section, coupe à la phrase |
| 8. Souvenirs | Edge `query-rag` + `ragBudget.ts` | 3 souvenirs max, 2 000 car. chacun, 6 100 au total | Plafond explicite, coupe par souvenir entier |
| 9. Envoi | `maxAgent` → `proxy-llm` | Prompt total plafonné à 13 000 car. générés / 13 500 avec l'historique | — |

## 2. Les coupures, une par une

### 2.1 Coupure destructrice — faits établis à 1 200 caractères (cause vérifiée)

- **Où** : `src/services/establishedFacts.ts`, `ESTABLISHED_FACTS_MAX_CHARS = 1_200` et `capAtSentence`.
- **Ce que « paragraphe » veut dire** : un bloc de texte séparé par une ligne vide, dans le champ « Identité
  fondamentale », qui commence par « Ce qui est vrai aujourd'hui ».
- **Quand** : à la compilation du prompt, à chaque tour. Ni à la lecture de Notion, ni au stockage : la base contient
  le texte complet.
- **Effet** : on garde le début jusqu'au dernier point avant 1 200 caractères (1 153 pour Max, 1 164 pour Emma). Puis
  `withoutEstablishedFacts` retire le paragraphe **entier** de l'identité pour ne pas le payer deux fois. La fin n'est
  donc plus nulle part. Aucune trace ne le signale dans « Voir ce que reçoit le personnage » ; seul l'outil
  `eval:judge:sheets` l'annonce.
- **Phrases perdues (vérifié : absentes du prompt final, pour trois questions différentes)** :

| Max (1 399 car., 309 perdus) | Emma (1 414 car., 313 perdus) |
|---|---|
| Elle est toujours dans un camp de quarantaine, où ton père l'a mise. | Elle est toujours dans un camp de quarantaine, où le père de Max l'a mise. |
| Tu l'as su il y a cinq jours, en prenant les clés chez lui ; Emma, il y a deux jours. | Max l'a su il y a cinq jours, en sortant de chez son père ; toi, il y a deux jours. |
| Léo et Ava ne l'ont su qu'hier soir, par vous. | idem |
| Ava était tellement contente de pouvoir retrouver Mona, et maintenant elle sais que ce n'est pas possible. | idem |

Note pour Romed : la dernière phrase contient une faute (« elle sais »), transmise telle quelle au modèle.

### 2.2 Coupure silencieuse — le bloc des faits disparaît s'il ne tient pas

- **Où** : `protectedCharacterSections` (« The facts never make a sheet unplayable »).
- **Effet** : si les faits ne tiennent pas dans les 7 000 caractères du noyau, même après que la manière de parler a
  cédé ses paragraphes, le code revient à l'ancien noyau sans faits. Le paragraphe redevient un extrait ordinaire,
  souvent écarté. Mesuré : avec une limite à 1 700 ou 2 000, Emma perd ainsi tout le bloc.
- **Jugement** : le budget de 7 000 est une contrainte explicite et justifiée ; c'est le **retour silencieux** qui ne
  l'est pas.

### 2.3 Budgets explicites (justifiés, mais à rendre visibles)

| Budget | Valeur | Effet mesuré sur Max / Emma |
|---|---|---|
| Noyau statique (`staticChars`) | 7 000 | 6 958 / 6 960 utilisés ; ≈ 46 700 / 44 600 car. de fiche écartés par tour |
| Manière de parler cédée aux faits | variable | Max cède 3 paragraphes (402, 347, 294 car.) ; Emma 3 (506, 332, 386) |
| Souvenirs RAG | 3 × 2 000, 6 100 | souvenirs entiers, pas de coupe en milieu |
| Mémoire de conversation | 1 200 | résumé structuré |
| Cadre / relation / GM | 1 650 / 1 400 / 800 | coupe à la phrase |

Tailles de fiche (Max) : identité 4 031, ce que tu ne fais jamais 4 111, relation à l'interlocuteur 5 622, dynamique
7 756, sujets sensibles 4 983, références intellectuelles 8 489, timeline 13 204, manière de parler 2 793.

### 2.4 Mécanismes historiques

Le « budget global et troncature encadrée » de l'optimisation de novembre existe encore : ce sont les budgets 2.3. Ce
n'est pas la même limite que 2.1. La coupe à 1 200 est plus récente (lot K1, 14 novembre).

## 3. Avant / après (simulation hors ligne sur les fiches réelles)

Simulation : même code, seule la limite des faits changée en mémoire, fichier restauré ensuite. Prompt système hors
couches du tour (pas de GM, pas de RAG, pas d'historique). Tokens estimés à 3,6 caractères par token.

| Limite des faits | Fin présente (Max / Emma) | Bloc des faits présent | Prompt (car.) | Tokens estimés |
|---|---|---|---|---|
| 1 200 (actuel) | non / non | oui / oui | ≈ 10 000 | ≈ 2 780 |
| 1 500 | oui / oui | oui / oui | ≈ 9 970–10 040 | ≈ 2 780 |
| 1 700 | oui / **non** | oui / **non** | ≈ 10 000–10 040 | ≈ 2 785 |
| 2 000 | oui / **non** | oui / **non** | ≈ 10 000–10 040 | ≈ 2 785 |

**Lecture** : le coût par tour ne bouge pas, puisque le noyau reste à 7 000. Ce que les faits gagnent, un ou deux
extraits de canon pertinent le cèdent (Max, question sur Mona : 11 → 10 extraits). La latence ne devrait pas
bouger non plus. **Non mesuré** : tokens facturés réels, coût en dollars, latence au fil des tours. Ce sera fait au
lot suivant avec `eval:judge:sequences` (sandbox) et la télémétrie de latence.

## 4. Doublons et contradictions

Repris et vérifiés depuis [plan_juge_direction_rounds](plan_juge_direction_rounds.md) (lots 0 et H), plus ce lot :

| Constat | Où | Impact |
|---|---|---|
| Les faits sont dans le paragraphe d'identité **et** auraient un champ dédié « Ce que tu sais aujourd'hui » (créé le 21 novembre, vide) | Notion | Deux sources pour la même vérité ; si le champ est rempli, le paragraphe est ignoré |
| Chronologie des révélations (qui a su quand) : seulement en fin de paragraphe, donc coupée | Identité | Max invente ou nie ; erreurs mesurées au lot F |
| Cinq états de parole (fiche) et cinq axes du radar (app) en parallèle | Manière de parler / `characterState.ts` | Deux réglages de l'attitude ; le lot H les fait décider par une seule décision GM |
| Radar « lucidité » haut qui pousse à analyser ; fiche qui dit « pas d'auto-analyse » | App / fiche | Max paraît « IA » ; textes vécus du radar prêts mais désactivés, en attente de Romed |
| Longueur des réponses écrite dans la fiche | Identité | Direction de jeu rangée dans la vérité du personnage |
| Références intellectuelles (8 489 car. chez Max) | Fiche | Rarement retenues faute de place ; peuvent nourrir le ton méta quand elles le sont |
| « Tu attends l'appel » | Fiche | Corrigé par Romed le 19 novembre ; garde-fou automatique en place |

## 5. Propositions à arbitrer

**Technique (Ulrich, lot suivant)**
1. Les faits établis ne sont plus coupés : tout le paragraphe passe, ou rien n'est retiré de l'identité.
2. S'ils ne tiennent pas dans le noyau, on le **signale** dans « Voir ce que reçoit le personnage » et dans
   `eval:judge:sheets`, au lieu de revenir en silence à l'ancien noyau. Ordre de priorité à décider : faits avant
   canon pertinent (proposé), puis manière de parler.
3. Afficher, par champ, la part de la fiche réellement envoyée (« 13 % de la fiche arrive au personnage »).

**Éditorial (Romed)**
1. Ne pas remplir « Ce que tu sais aujourd'hui » : avec la correction, le paragraphe actuel suffit. Si Romed préfère
   un champ séparé, y déplacer le paragraphe tel quel et le retirer de l'identité, pour garder une seule source.
2. Mettre les faits par ordre d'importance dans le paragraphe : le camp et qui y a mis Mona en premier.
3. Corriger « elle sais ».
4. Regarder les champs longs jamais transmis (références intellectuelles, dynamique, relation) : les raccourcir ou
   accepter qu'ils servent seulement de réserve.

## 6. Recette proposée (lot suivant)

1. **Hors ligne** : tests du compilateur avec un paragraphe court (800), autour de la limite (1 150, 1 250), long
   (1 600, 2 000), et un fait placé en dernière phrase ; vérifier qu'il est dans le prompt final, ou qu'un
   avertissement est produit.
2. **Sandbox, sans GM** : `eval:judge:sequences --focus factuality` sur le corpus du lot F, avant / après, Max et Emma
   (camp, qui a envoyé Mona, qui a su quand).
3. **Sandbox, avec GM et radar** : mêmes séquences, réglages d'expérience actuels.
4. **Mesures** : tokens d'entrée réels et latence (`character_llm`, Max audible) sur au moins 10 tours, avant / après.
5. **Écoute humaine** : Romed, quelques appels complets ; les tests automatiques ne valident pas le jeu.

## 7. Limites de ce rapport

- Fiches de **production** non lues ; seules celles de sandbox-ulrich l'ont été.
- Aucune conversation réelle jouée : tokens estimés par la longueur, pas comptés par le fournisseur.
- Simulation sans couches du tour (GM, radar, RAG, historique), qui ont leurs propres budgets.
- La part des fiches non transmise (≈ 87 %) est mesurée sur trois questions types, pas sur une vraie session.

Outils de ce lot : `npm run eval:judge:sheets -- --env sandbox-ulrich` (lecture seule) et un script temporaire
d'inspection du compilateur, non versionné.
