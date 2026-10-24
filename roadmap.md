# Roadmap — Ava Proto 1

## En cours

- Lot A parole incarnée : correctifs et 863 tests verts en preview ; attend écoute
  humaine Max/Emma et mesure de latence. Code détecté sur le site publié le 24 octobre.
- Lot B : code et banc connecté vérifiés, 878 tests verts ; attend auditions réelles,
  sauvegarde/activation sandbox et comparaison diction/latence. Tags Gradium fermés.
  Code détecté sur le site publié ; plan `docs/plan_lot_b_rendu_vocal.md`.
- Clôture de livraison : main GitHub c300a1a vérifié le 24 octobre ; CI 40095526200
  en cours au contrôle (qualité réussie, E2E en cours). Attend résultat terminal.
  PR #24/branche étrangère préservées, décision d'Ulrich nécessaire pour leur sort.
  Concordance exacte du déploiement et état Cloud non vérifiés faute de connecteur
  MCP Lovable Ava accessible ; voir le relevé d'audit dans CHANGELOG.md.

- Serveur MCP de statistiques (lecture seule, protégé par connexion) : publier
  le site puis connecter Codex et vérifier un premier relevé de chiffres ;
  attend publication. Plan `docs/plan_mcp_statistiques.md`.


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
