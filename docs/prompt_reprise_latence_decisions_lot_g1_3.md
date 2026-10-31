# Prompt de reprise — Lot G1.3 : latence, décisions d'Ulrich

Copier dans un nouveau chat sur Ava, après une nouvelle recette d'écoute d'Ulrich.

---

Lot G1.3 Ava. G1.2 est livré (voir `docs/plan_gravite_ava_latence_g1.md`, sections
« G1.2a » et « Exécution G1.2b ») : recette d'Ulrich lue (gravité tenue, aucune relance
LLM, premier son 4,1–4,8 s), déduplication du compilateur `optimized_v3` mise en cache
(construction du prompt mesurée à 0,77–0,96 s par tour avant le correctif), phrases scriptées
en cours d'appel au « tu » quand le personnage tutoie déjà.

Préalable : Ulrich a refait une recette en sandbox (Max puis Emma, ElevenLabs v4 Turbo) et
donné l'identifiant de session, ou l'a explicitement reportée.

Étapes, chacune arrêtable :
- **G1.3a Vérifier G1.2 (sans code)** : `character_prompt_build` doit tomber sous ~100 ms ;
  écart `context_ready → llm_request` idem ; premier son hors passage attendu vers 3,3–4 s.
  Aucune pause de transfert ni reprise vouvoyée après un tutoiement. Gravité toujours tenue,
  un seul `prd4_chat` par tour. Croiser avec l'écoute d'Ulrich (`Ahva`, cassures de voix).
- **G1.3b Décisions d'Ulrich, à lui présenter avec chiffres, sans les prendre seul** :
  1. `endOfSpeechMs` sandbox 2 000 → 900 ms (prod 900) : gain jusqu'à 1,1 s, risque de couper
     une phrase hésitante.
  2. Streaming du LLM vers ElevenLabs (premier son après la première phrase ; le chemin
     incrémental n'existe que pour Gradium). `VOICE_INCREMENTAL_OUTPUT` inchangé sans accord.
  3. Modèle de Max/Emma plus rapide, comparé sur gravité et langue.
  4. RAG 0,8–1,35 s (embedding, rerank) : parallélisation ou cache, à mesurer d'abord.
  5. Transfert retenu par le MJ alors que le joueur le demande clairement : voulu ou non.
- **G1.3c** : n'implémenter que ce qu'Ulrich a accepté, un point à la fois, mesuré.

Contraintes : base Caractères Notion en lecture seule (proposer, ne rien écrire) ; prompts
éditoriaux dans Notion, surcharges admin_settings/localStorage à vérifier ; façade
`src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable uniquement ; invariants
parole/mains libres d'AGENTS. Une simulation ne prouve pas le rendu vocal : l'écoute est
celle d'Ulrich. Gradium doit rester inchangé.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne
suit), avec cette même obligation.
