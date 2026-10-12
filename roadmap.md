# Roadmap — Ava Proto 1

## En cours


- Resynchronisation des fiches Notion Max/Emma corrigées : attend l’action d’Ulrich. La fiche Game Master et ses extraits ont déjà été retirés de la base de l'app.
- Validation GM en sandbox : publier une version avec cadre commun activé et vérifier conversations Max/Emma, parcours vu/non vu, garde-fous, passages et reprise ; attend configuration et écoute humaine.

- Rédiger le corpus de questions dans la base Notion « AVA LLM-as-judge »
  (min. 5 lignes complètes, idéalement les 4 catégories) puis lancer un
  premier test dans Qualité → LLM as judge.


- Game Master multipersonnage : élargir `RuntimeCharacter`, les alias de passage et `summarize-session` avant Ava / Léo ; activation en attente des validations éditoriales et runtime. Nettoyage legacy réalisé.

## À court terme

- Questionnaire — tâche distincte à réaliser plus tard, sans changement dans le lot GM : valider la refonte des questions 3/4/6, aligner formulaire/types/vue admin/mapping Notion, versionner sans altérer l'historique et tester sauvegarde/synchronisation ; attend décision éditoriale d’Ulrich.

- Séparer les coûts et métriques par environnement (`llm_usage`,
  `conversation_turn_traces`).
- Ajouter un filtre d'environnement par défaut sur les onglets Latence, Usage
  LLM et Traces Max.
