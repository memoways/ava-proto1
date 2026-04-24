## Objectif
Produire un livrable clair sur la mécanique actuelle entre le Game Master et Max, puis proposer une évolution pour mieux contrôler ce que Max sait, dit, et la manière dont il le dit.

## Schéma de la mécanique actuelle
```text
Utilisateur parle
   |
   v
STT (transcription voix -> texte)
   |
   v
processConversationTurn()
   |
   +--> RAG: recherche de contexte narratif pertinent
   |
   +--> Max Agent
   |      - system prompt personnage (DB / characters.system_prompt)
   |      - règles de gameplay fixes
   |      - contexte RAG injecté
   |      - post_video_context éventuel
   |      => génère la réponse de Max
   |
   +--> TTS: lecture audio de la réponse
   |
   +--> Game Master Agent (après la réponse de Max)
          - lit historique récent
          - lit message user + réponse de Max
          - lit trust actuel + temps écoulé + triggers déjà joués
          => retourne JSON:
             trust_delta
             trigger_video_id
             game_over
             gate_reached
             moderation_flag
             notes

Ensuite l'application:
- met à jour trust_level
- déclenche une vidéo éventuelle
- passe au gate si gate_reached = true
- termine la session si game_over = true
- sinon reprend la conversation
```

## Explication simple de la mécanique actuelle
1. Max parle avant que le Game Master ne tranche.
2. Le Game Master n’écrit pas la réponse de Max: il la juge après coup.
3. Le contrôle réel de Max aujourd’hui vient surtout de 4 blocs:
   - le prompt personnage de Max
   - les règles fixes ajoutées au prompt
   - le contexte RAG récupéré
   - le contexte post-vidéo
4. Le Game Master agit surtout comme arbitre de progression:
   - confiance
   - vidéos
   - fin de partie
   - ouverture de gate

## Réponses aux questions / constats clés
### 1) Comment le Game Master interagit-il avec l’expérience utilisateur ?
Il orchestre la progression, mais pas finement le contenu de parole de Max. En pratique, le joueur perçoit Max comme agent principal, et le Game Master comme logique invisible de scoring / gating.

### 2) Pourquoi Max invente-t-il vite ?
Parce qu’il n’existe pas encore de garde-fou fort entre “ce que Max sait” et “ce qu’il peut dire”. Aujourd’hui:
- le prompt dit d’utiliser le contexte narratif comme vérité,
- mais Max peut encore combler les trous par inférence,
- le Game Master ne bloque pas la réponse avant envoi,
- il n’y a pas de validation factuelle systématique avant lecture TTS.

### 3) Où est la limite principale de l’architecture actuelle ?
Le contrôle arrive trop tard. Le GM intervient après la génération de Max. Donc il peut sanctionner ou déclencher, mais pas empêcher une hallucination déjà produite.

### 4) Entre custom prompt et texte de contexte, que faut-il privilégier ?
Il faut séparer clairement 4 couches, au lieu de tout mettre dans un seul prompt:
- Identité stable de Max
- Règles comportementales de parole
- Connaissances autorisées du tour
- Intentions / état émotionnel du moment

C’est cette séparation qui donnera du contrôle éditorial.

## 3 exemples simulés
### Exemple 1 — Bonne interaction, contrôle faible
- User: “Est-ce qu’Ava t’avait parlé de fuir avant sa disparition ?”
- RAG remonte un souvenir partiel sur Ava et une tension familiale.
- Max répond: “Oui, je sentais qu’elle voulait partir depuis un moment. Elle avait même préparé des affaires.”
- Problème: la seconde phrase peut être inventée si elle n’est pas explicitement dans le contexte.
- GM ensuite met trust +1 et ne voit pas forcément le problème.

Conclusion: même quand la mécanique de jeu marche, la vérité narrative peut dériver.

### Exemple 2 — Interaction émotionnelle, contrôle de ton insuffisant
- User: “Tu ne me fais pas confiance, mais tu m’appelles quand même.”
- Max devrait répondre de façon brève, tendue, défensive.
- Aujourd’hui il peut produire une réponse trop explicative, trop littéraire, ou trop ouverte émotionnellement.
- GM peut juger la sincérité du joueur, mais ne cadre pas le style exact de Max.

Conclusion: il manque un “style controller” par état émotionnel et par phase narrative.

### Exemple 3 — Trigger narratif correct mais timing éditorial faible
- User évoque l’enfance / la famille.
- Max répond longuement sur son passé.
- Ensuite GM déclenche `trigger_famille`.
- Dramaturgiquement, on voudrait parfois l’inverse: d’abord rétention, puis micro-révélation, puis trigger vidéo.

Conclusion: le GM devrait décider du mode de réponse attendu avant génération: retenue, révélation partielle, esquive, confrontation, aveu.

## Pistes de solution recommandées
### A. Faire passer le Game Master avant Max sur chaque tour important
Le GM ne doit plus seulement scorer après coup. Il doit produire un “brief de tour” pour Max, par exemple:
- intention de la réponse
- niveau d’ouverture
- niveau émotionnel
- informations autorisées
- informations interdites
- objectif conversationnel
- éventuel trigger à préparer

### B. Séparer le contrôle de Max en 4 blocs
1. Persona durable
   - qui il est
   - comment il parle
   - ce qu’il veut globalement
2. Bible factuelle
   - ce qu’il sait comme vérité
   - ce qu’il ignore
   - ce qu’il croit sans certitude
3. État dynamique du tour
   - confiance actuelle
   - pression temporelle
   - émotion dominante
   - phase de relation avec le joueur
4. Directive de réponse du tour
   - répondre brièvement
   - éviter tel sujet
   - poser une question
   - révéler 1 seul fait max

### C. Introduire une politique de vérité stricte
Chaque fait devrait être classé:
- certain
- probable
- inconnu
- interdit à révéler maintenant

Max ne doit jamais transformer “probable” en “certain”.

### D. Mettre en place des modes de parole éditoriaux
Exemples:
- fermé / méfiant
- testeur
- fragile
- accusateur
- confiant
- révélateur partiel

Le GM choisit le mode, Max exécute.

### E. Ajouter un validateur de réponse avant TTS
Avant lecture audio:
- vérifier si la réponse contient des faits absents du contexte autorisé
- vérifier longueur / ton / interdits
- si échec: régénération avec consigne corrective

## Plan proposé
### Phase 1 — Documenter et rendre visible la mécanique
- Ajouter dans l’admin une vue “pipeline conversationnel” avec:
  - entrée user
  - contexte RAG injecté
  - prompt effectif de Max
  - sortie GM
  - décision finale
- Ajouter un schéma lisible et un mini glossaire des rôles GM / Max / RAG / TTS / trust.

### Phase 2 — Repenser le contrat entre GM et Max
- Faire produire au GM un objet structuré de “direction de tour” avant appel à Max.
- Remplacer le simple post-analyse par une orchestration en 2 temps:
  1. GM prépare le tour
  2. Max répond sous contraintes
  3. GM post-analyse légère pour trust / trigger / fin

### Phase 3 — Cadrer la connaissance de Max
- Structurer le contexte injecté en sections:
  - faits certains
  - souvenirs activés
  - hypothèses
  - sujets interdits / non débloqués
- Réduire la liberté du prompt libre personnage en le transformant en gabarit plus normé.

### Phase 4 — Ajouter des garde-fous anti-hallucination
- Validation pré-TTS de la réponse.
- Régénération si:
  - fait non sourcé
  - ton interdit
  - longueur excessive
  - révélation trop rapide

### Phase 5 — Outiller l’équipe éditoriale
- Dans l’admin, séparer:
  - prompt identitaire de Max
  - règles de style
  - connaissance autorisée
  - règles de révélation
  - profils de tour / modes émotionnels
- Permettre de tester un tour simulé depuis l’admin avec trace complète.

## Détails techniques
### Ce que le code montre aujourd’hui
- Le GM lit les 6 derniers messages, le trust, les triggers et le temps écoulé.
- Max reçoit un prompt personnage + règles fixes + RAG + post_video_context.
- Le GM est appelé après la génération complète de Max.
- Le `gate_reached` est surtout déterminé par le GM, avec un complément de vérification sur le seuil de trust.
- Le contrôle “MIN_QUESTIONS_BEFORE_GATE” et “MAX_INSULT_TOLERANCE” dépend aujourd’hui surtout du prompt, pas d’une vraie logique stricte dans le pipeline montré.

### Refactor cible recommandé
```text
Tour utilisateur
  -> GM pre-turn planner
     -> response_mode
     -> allowed_knowledge
     -> forbidden_topics
     -> trust_policy
     -> reveal_budget
  -> Max responder
  -> response validator
  -> TTS
  -> GM post-turn scorer
  -> state update
```

### Livrables d’implémentation
- Un schéma UI ou document dans l’admin
- Une nouvelle structure de prompt pour Max
- Un nouveau format JSON de consignes GM -> Max
- Un validateur de réponse
- Un écran ou panneau de simulation de tours

## Priorité recommandée
1. Schématiser et tracer le pipeline actuel
2. Introduire le GM pre-turn planner
3. Structurer la connaissance autorisée
4. Ajouter le validateur anti-hallucination
5. Outiller l’admin pour tests éditoriaux

## Résultat attendu
Après cette évolution, Max ne sera plus seulement “bien prompté”. Il sera piloté par une couche de direction éditoriale et narrative beaucoup plus contrôlée, ce qui réduira fortement les inventions, améliorera la cohérence, et donnera une vraie maîtrise sur ce qu’il dit, quand il le dit, comment il le dit, et ce qu’il sait.