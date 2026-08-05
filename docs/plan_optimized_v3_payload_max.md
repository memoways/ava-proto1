# Plan — Optimisation du payload LLM de Max (`optimized_v3`)

Statut : plan approuvé, implémentation locale réalisée, activation Lovable Cloud
et synchronisations Notion à effectuer selon le runbook.

## 1. Constat et cible

- La trace de référence atteignait environ **40 000 caractères**, dont 98 % dans
  le message système : fiche structurée 27 799, RAG 5 369 et ancien prompt
  4 549 caractères.
- `rich_v2` a ramené le système autour de 12 000 caractères et exclut déjà
  `characters.system_prompt`, mais il manque encore :
  - une déduplication globale entre fiche, mémoire, historique et RAG ;
  - une mémoire persistante après rechargement ;
  - une sélection dynamique pilotée par un budget global ;
  - une vue analytique légère des traces.
- La fiche Max conserve ses **28 728 caractères éditoriaux** : aucun détail
  canonique n'est supprimé de Notion ou du corpus RAG.
- Objectif mesuré :
  - contexte généré hors message courant : **7 000–11 000 caractères**, plafond
    11 000 ;
  - payload final habituel : **8 000–12 000 caractères** ;
  - le message utilisateur courant n'est jamais tronqué ; un dépassement causé
    par celui-ci est explicitement tracé.

## 2. Nouveau compilateur global

Ajouter `MAX_PROMPT_VARIANT: "optimized_v3"` sans modifier les trois variantes
existantes.

L'assembleur produit, dans cet ordre :

1. contrat conversationnel unique ;
2. présent, identité, voix, contradiction et moteur de Max ;
3. rôle de l'interlocuteur et état temporel ;
4. mémoire structurée de la session ;
5. éléments canoniques pertinents de la fiche ;
6. souvenirs RAG réellement complémentaires ;
7. deux derniers échanges complets comme messages bruts ;
8. message utilisateur courant, intact.

Budgets indicatifs :

- contrat : 800 caractères ;
- noyau Max : 3 500–4 500 ;
- présent/timeline pertinente : 800 ;
- rôle, temps, guidance GM et garde-fous : 800 ;
- mémoire structurée : 1 200 ;
- historique brut : 1 200 ;
- RAG : 1 800, trois extraits maximum ;
- le budget inutilisé d'une section peut être repris par une autre, sans dépasser
  le plafond global.

Règles d'assemblage :

- découper les sources en paragraphes ou unités sémantiques, jamais avec un
  `slice` aveugle ;
- scorer les unités avec le message courant, les sujets mémorisés et les labels
  du GM précédent ;
- dédupliquer les unités par inclusion normalisée et similarité de shingles ;
- conserver la source prioritaire et seulement les phrases nouvelles des sources
  secondaires ;
- priorité factuelle : timeline Notion → autres champs structurés → RAG →
  historique de ce que Max a déclaré ;
- la guidance GM ne peut jamais modifier un fait ;
- toute inclusion, fusion ou omission reçoit un motif dans la trace.

Le contrat conversationnel ne dit qu'une seule fois : première personne, oralité
française, réponse directe, une à trois phrases en général, jusqu'à quatre pour
un souvenir, question rare et jamais deux tours de suite, aucune ouverture
rejouée, ambiguïtés/STT interprétés charitablement, explication distincte de
l'excuse.

## 3. RAG et textes Notion

### RAG Voyage 4

- Conserver le profil actif `voyage-4-realtime` et la mécanique récemment
  livrée : embeddings document `voyage-4-large`, requête `voyage-4-lite`, 1 024
  dimensions, reranking actuel.
- Récupérer un petit vivier supérieur au nombre final afin de pouvoir éliminer un
  doublon avec la fiche puis reprendre le souvenir suivant.
- Injecter au maximum trois souvenirs, 1 800 caractères au total, sans scores,
  identifiants ni marqueurs `Partie n/N`.
- Tracer tous les candidats avec les statuts `selected`, `duplicate_static`,
  `duplicate_memory`, `lower_rank` ou `budget`.
- Ne pas ré-embarquer le corpus pour ce changement de compilateur.

### Fiche Notion Max

Appliquer les remplacements chirurgicaux déjà détaillés dans
[`plan_optimisation_payload_max.md`](plan_optimisation_payload_max.md), section 7 :

La section 7.0 de ce document constitue le registre éditorial destiné à Romed :
elle présente, pour chaque zone, le problème, le changement prévu, sa raison et
la matière qui doit rester intacte. La section 7.10 sert de preuve d'application
après édition et synchronisation.

- `Identité fondamentale` : une seule règle de longueur, alignée avec le runtime.
- `Qui tu es` : préciser que les traits sombres sont des potentialités et non un
  ton permanent.
- `Ce que tu ne fais jamais` : retirer toute fréquence technique des questions ;
  conserver l'intention propre à Max et ajouter la distinction
  explication/excuse.
- `Qui t'appelle` : priorité au rôle dynamique, aucune ouverture obligatoire, pas
  de fermeture sur une maladresse ou une erreur STT.
- `Dynamique` : garder son moteur propre et relier toute analyse abstraite à un
  détail vécu.
- `Sujets sensibles` : commencer par faits et sensations, puis expliquer sans
  s'absoudre.
- `Profondeur` : conserver les quatre niveaux et toute la matière de voix, avec
  une seule règle introductive et une profondeur persistante.
- `Timeline` : retenir comme canon la version actuelle — départ il y a cinq jours,
  quatre journées au chalet, retour hier.
- `situation_summary` reste généré par Lovable Cloud et n'est pas édité
  manuellement.

Le corps de page RAG reste exhaustif. Corriger ses ancres pour les aligner sur la
timeline de cinq jours et garantir une section autonome sur le repas, les
provocations d'Agotha et l'aveu nocturne à Emma. Les auteurs intellectuels ne sont
nommés que si l'interlocuteur ouvre explicitement ce terrain.

Ordre de synchronisation :

1. éditer les propriétés Notion ;
2. lancer `fields_only` et contrôler `situation_summary` ;
3. valider le prompt `optimized_v3` ;
4. corriger ensuite le corps narratif ;
5. lancer `rag_only` pour Max.

## 4. Mémoire persistante et reprise après rechargement

Étendre le résultat du GM post-tour avec un `memory_delta`. Aucun appel LLM
supplémentaire n'est ajouté.

La mémoire `ConversationMemoryV1` contient :

- identité, prénom et rôle de l'interlocuteur ;
- faits confiés par l'utilisateur ;
- révélations déjà faites par Max ;
- décisions et promesses ;
- questions ou fils encore ouverts ;
- sujets déjà abordés ;
- profondeur, confiance et état émotionnel ;
- résumé du dernier échange ;
- pour chaque élément : identifiant stable, tour source et éventuel élément
  remplacé.

Après chaque échange user/Max :

1. le GM produit son analyse actuelle et le delta ;
2. un reducer déterministe normalise, déduplique et borne la mémoire ;
3. la session persiste le nouvel état avec contrôle optimiste du numéro de tour ;
4. un delta retardé ou dupliqué ne peut pas écraser un état plus récent.

Ajouter à `sessions` :

- `conversation_memory jsonb` ;
- `memory_last_turn integer` ;
- `resume_expires_at timestamptz`, fixé au démarrage selon la durée configurée
  plus cinq minutes de marge.

`optimized_v3` injecte la mémoire structurée et les deux derniers échanges bruts.
Si le GM a du retard, l'historique brut s'étend temporairement jusqu'au dernier
tour non résumé. L'ancien résumé périodique reste disponible pour les variantes
historiques, mais n'est plus la mémoire principale de `optimized_v3`.

Au rechargement :

- rechercher uniquement la dernière session appartenant à l'utilisateur, non
  terminée et non expirée ;
- afficher « Reprendre l'appel » ;
- restaurer session, transcript, mémoire, rôle et temps restant ;
- ne pas démarrer automatiquement microphone, avatar, audio ou TTS ;
- une session terminée ou expirée n'est jamais proposée.

## 5. Traces, tests et déploiement

### Trace exacte

Conserver le stockage V2 avec `textBlobs`, mais ajouter une vue analytique chargée
par défaut :

- caractères système, historique, RAG, mémoire et message courant ;
- tokens fournisseur exacts ;
- budget prévu, utilisé et omis par section ;
- unités candidates/incluses/fusionnées ;
- caractères répétitifs supprimés et source conservée ;
- mémoire avant, delta et mémoire après ;
- candidats RAG et motif de sélection ;
- variante, modèle demandé et modèle réellement retourné.

Le JSON exact reste accessible à la demande ou téléchargeable, sans être rendu
intégralement au chargement du panneau « Trace exacte des réponses de Max ».

### Tests

- déterminisme du compilateur et plafond global ;
- message courant jamais tronqué ;
- absence de `characters.system_prompt` dans `optimized_v3` ;
- aucune répétition verbatim significative entre sections ;
- présent, contradiction, moteur et vérité factuelle toujours présents ;
- récupération à la demande des détails non inclus au tour précédent ;
- maximum trois souvenirs RAG, sans métadonnées techniques ;
- remplacement d'un souvenir dédupliqué par le candidat suivant ;
- mémoire créée à chaque tour, déduplication et gestion des deltas désordonnés ;
- prénom/rôle retenus après six tours et après rechargement ;
- profondeur relationnelle conservée après un sujet banal ;
- reprise sans activation automatique du micro ou de l'audio ;
- session expirée ou appartenant à un autre utilisateur inaccessible ;
- lecture rétrocompatible des anciennes traces.

Corpus de recette : quotidien, identité, chronologie, thermos, gentiane, hôtel,
Emma/Mona/Léo/Ava, masculinité et contrôle, références intellectuelles, STT
erroné, humour, provocation et progression vers la responsabilité.

Critères :

- au moins 95 % de réponses canoniquement correctes ;
- aucune fuite d'un autre personnage ;
- aucune ouverture rejouée ;
- au plus 30 % des réponses terminées par une question, jamais deux
  consécutives ;
- cohérence de la chronologie entre deux questions espacées ;
- détails rares disponibles lorsque demandés ;
- P95 du texte Max complet ≤ 4 secondes ;
- `optimized_v3` préféré ou équivalent à `rich_v2` lors d'une comparaison
  aveugle.

### Déploiement

- Livrer `optimized_v3` comme variante activable et comparer des sessions
  séparées jouant les mêmes scénarios — aucun double appel en production.
- Conserver `rich_v2`, `compact_v1` et `legacy` comme retours arrière.
- Appliquer migrations, synchronisations, Edge Functions, build et publication
  exclusivement via Lovable/Lovable Cloud.
- Basculer le réglage global uniquement après validation quantitative,
  qualitative et éditoriale.

## 6. État d'implémentation au 5 août 2026

- Implémentation locale du compilateur, de la mémoire persistante, de la reprise,
  des traces analytiques et des tests : réalisée.
- Migration, synchronisations Notion, validation canary, Edge Functions, build et
  publication Lovable Cloud : à effectuer dans l'ordre décrit par
  [`optimized_v3_lovable_runbook.md`](optimized_v3_lovable_runbook.md).
- Aucun basculement global vers `optimized_v3` ne doit précéder les validations
  quantitative, qualitative et éditoriale.
