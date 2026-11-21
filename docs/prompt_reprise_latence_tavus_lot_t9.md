# Prompt de reprise — Latence Tavus, lot T9 (remesure du LLM streamé après T8)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md) (lots T3 à T8), [évaluation](evaluation_llm_streame_vers_tts.md).

---

Objectif : lire la remesure du prototype T7 corrigé par T8 (LLM streamé, première phrase, Tavus avec voix d'Ava, réglage admin `streamedLlm`, faux par défaut) et décider avec Ulrich de la suite. Ne rien activer par défaut sans son accord explicite dans la demande.

État vérifié (21 novembre) : T7 et T8 livrés ; la salvage locale (G1) vaut maintenant en flux. T7 sur 7 tours : −0,4 à −0,65 s sur la première phrase, 2 relances d'intent sur 7 (cause : salvage absente en flux, corrigée). Remesure à faire par Ulrich : `streamedLlm` actif sur sandbox-ulrich, ≥ 10 tours, puis ≥ 10 tours désactivé.

Périmètre : lire `voice_turn_events` (Lovable Cloud, lecture seule, MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`) : `milestones` (`tts_text_sent`, `llm_response`, `output_estimated`, `safe_phrase`), `durations.video_wait_ms` et spans `character_retry_*` / `character_local_salvage` ; comparer les deux séries (médianes, relances, tours salvagés, phrases retirées) ; proposer à Ulrich de garder, activer par défaut (décision à lui), corriger ou abandonner. Autres leviers restants : `retrieve_k` 15 → 10 (rejeu `eval:rerank-replay` puis `evalJudge`), embedding partiel, attente vidéo Tavus (≈ 1,0 s). Attente du GM précédent > 1 s : environ 5 % des tours, antérieure à T7.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul. Les identifiants d'`.env.eval.local` ne sont pas utilisés par l'agent (Ulrich lance les commandes `eval:*`).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
