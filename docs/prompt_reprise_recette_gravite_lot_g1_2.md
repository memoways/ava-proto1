# Prompt de reprise — Lot G1.2 : recette gravité, « Ava » et latence

Copier dans un nouveau chat sur Ava, après la recette d'écoute d'Ulrich.

---

Lot G1.2 Ava. G1.1 est livré (voir `docs/plan_gravite_ava_latence_g1.md`, section
« Exécution G1.1 ») : invariant de gravité et garde locale côté texte, voix de Max/Emma
jamais légères par défaut, « Ava » écrit `Ahva` pour ElevenLabs v3/v4, relance LLM évitée
(pensée ouverte en suspension, sauvetage local de l'en-tête), spans `character_*` dans
`voice_turn_finished.metadata_json.server`.

Préalable : Ulrich a fait sa recette en sandbox (Max 5 tours puis Emma, ElevenLabs v4
Turbo) et donné l'identifiant de session, ou l'a explicitement reportée.

Étapes, chacune arrêtable :
- **G1.2a Lecture de la recette (sans code)** : pour la session donnée, lire
  `sessions.conversation_log` (aucune trivialité ni légèreté ; phrases retirées visibles par
  `character_gravity_guard`), `llm_usage` (un seul `prd4_chat` par tour hors relance réelle),
  et les spans `<turn>:character` : raison des relances restantes, `character_context_reads`,
  `character_prompt_build`, écart `context_ready → llm_request`. Croiser avec le ressenti
  d'Ulrich sur « Ava » (`Ahva` correct, à changer, ou dictionnaire ElevenLabs) et le décroché
  d'Emma. Présenter le constat.
- **G1.2b Correctifs ciblés** seulement sur ce que la recette montre : graphie de « Ava »,
  termes de la garde (faux positifs ou oublis), attente évitable nommée par les spans.
- **Décisions d'Ulrich, à ne pas prendre seul** : `endOfSpeechMs` sandbox 2 000 → 900 ms
  (prod : 900) ; streaming du LLM vers ElevenLabs (le chemin incrémental n'existe que pour
  Gradium) ; modèle de Max plus rapide. `VOICE_INCREMENTAL_OUTPUT` inchangé sans accord.

Contraintes : base Caractères Notion en lecture seule (proposer, ne rien écrire) ; prompts
éditoriaux dans Notion, surcharges admin_settings/localStorage à vérifier ; façade
`src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable uniquement ; invariants
parole/mains libres d'AGENTS. Une simulation ne prouve pas le rendu vocal : l'écoute est
celle d'Ulrich. Gradium doit rester inchangé.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne
suit), avec cette même obligation.
