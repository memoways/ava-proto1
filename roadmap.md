# Roadmap — Ava Proto 1

## En cours

- Resynchronisation des fiches Notion Max/Emma corrigées : attend l’action d’Ulrich. Vérifier lors du nettoyage que la fiche Notion GM n’est plus utilisée ; réglages GM uniquement dans l’app.

- Rédiger le corpus de questions dans la base Notion « AVA LLM-as-judge »
  (min. 5 lignes complètes, idéalement les 4 catégories) puis lancer un
  premier test dans Qualité → LLM as judge.


- Game Master multipersonnage : nettoyage du code legacy (attente validation) ; élargir `RuntimeCharacter` avant Ava / Léo.

## À court terme

- Séparer les coûts et métriques par environnement (`llm_usage`,
  `conversation_turn_traces`).
- Ajouter un filtre d'environnement par défaut sur les onglets Latence, Usage
  LLM et Traces Max.
