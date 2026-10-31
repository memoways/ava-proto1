# Prompt de reprise — Lot G1.4 : recette du passage, décisions de latence d'Ulrich

Copier dans un nouveau chat sur Ava, après une nouvelle recette d'Ulrich.

---

Lot G1.4 Ava. G1.3 est livré (voir `docs/plan_gravite_ava_latence_g1.md`, sections « G1.3a »
et « Exécution G1.3 ») : session `e6918bd8…` lue ; le MJ avait validé deux fois le passage à
Emma, mais l'offre non préparée était révoquée (« Je passe Emma » non reconnu), puis Max
répétait la pause scriptée. Corrigé : formulations reconnues, accord validé préparé après coup
avec les mêmes gardes (bouton, clic du joueur inchangé), jamais deux pauses de suite.
G1.2 confirmé : prompt 25–58 ms, un `prd4_chat` par tour, premier son hors passage 3,2–4,7 s.
Décision 1 appliquée le 31 octobre : `endOfSpeechMs` sandbox 2 000 → 900 ms (réglage
`admin_settings` seul, production déjà à 900, retour arrière = remettre 2 000).

Préalable : Ulrich a refait une recette en sandbox (Max, demande claire de parler à Emma, puis
Emma) et donné l'identifiant de session, ou l'a explicitement reportée. Il a aussi répondu
aux décisions G1.3b, ou les a reportées.

Étapes, chacune arrêtable :
- **G1.4a Vérifier G1.3 (sans code)** : `experience_events` — `handoff_prepared` puis
  `handoff_proposed`/`handoff_accepted`, aucun `handoff_blocked` à raison `consent_validated` ;
  aucune pause de transfert répétée dans `conversation_log` ; bouton vu par Ulrich. Si une
  préparation échoue encore (`assessment_missing`), lire `gm_post_turn_log.validation_issues`
  et la réplique de Max ; ne pas réparer une preuve du MJ (invariant « jamais réparée »).
- **G1.4a bis Mesurer la fin de parole à 900 ms** : écart fin de parole → décision de tour
  (gain attendu jusqu'à 1,1 s) et phrases coupées trop tôt selon l'écoute d'Ulrich ; lui
  proposer le retour à 2 000 ms si une coupure gêne.
- **G1.4b Décisions G1.3b restantes d'Ulrich** (chiffres dans le plan) : streaming LLM →
  ElevenLabs ; modèle plus rapide ; RAG 0,68–1,75 s ; acceptation vocale du passage
  (aujourd'hui clic). N'implémenter que ce qu'il accepte, un point à la fois, mesuré
  avant/après.

Contraintes : base Caractères Notion en lecture seule (proposer, ne rien écrire) ; prompts
éditoriaux dans Notion, surcharges admin_settings/localStorage à vérifier ; façade
`src/services/tts` ; secrets côté serveur ; Edge/backend via Lovable uniquement ; invariants
parole/mains libres et « Transfers alone await preparation » d'AGENTS. Une simulation ne
prouve pas le rendu vocal : l'écoute est celle d'Ulrich. Gradium inchangé.

Livraison : CI sur PR puis garde `ship-pr.mjs`, CHANGELOG/STORY/état courant dans la branche.
À la clôture, livrer le prompt de reprise du lot suivant dans `docs/` (ou dire qu'aucun ne
suit), avec cette même obligation.

Première action : lire la session de recette donnée par Ulrich (`public.sessions`,
`experience_events`, `gm_post_turn_log`, spans `:character`) via le MCP Lovable Ava.
