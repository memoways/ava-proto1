# Roadmap — Ava Proto 1

## En cours

- Resynchronisation des fiches Notion Max/Emma corrigées : attend l’action d’Ulrich (la resync complète retire aussi l’ancienne fiche Game Master archivée et ses 12 extraits RAG).
- Questionnaire : question 4 « résumé de rôle » obsolète — attend décision d’Ulrich (liée à Notion).

- Rédiger le corpus de questions dans la base Notion « AVA LLM-as-judge »
  (min. 5 lignes complètes, idéalement les 4 catégories) puis lancer un
  premier test dans Qualité → LLM as judge.


- Game Master multipersonnage : nettoyage du code legacy (attente validation) ; élargir `RuntimeCharacter` avant Ava / Léo.

## À court terme

- Séparer les coûts et métriques par environnement (`llm_usage`,
  `conversation_turn_traces`).
- Ajouter un filtre d'environnement par défaut sur les onglets Latence, Usage
  LLM et Traces Max.
