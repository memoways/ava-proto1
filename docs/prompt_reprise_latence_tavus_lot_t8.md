# Prompt de reprise — Latence Tavus, lot T8 (mesure du LLM streamé T7, puis suite)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md) (lots T3 à T7), [évaluation](evaluation_llm_streame_vers_tts.md).

---

Objectif : exploiter la mesure du prototype T7 (LLM streamé, première phrase, Tavus avec voix d'Ava, réglage admin `streamedLlm`, faux par défaut) et décider avec Ulrich de la suite. Ne rien activer par défaut sans son accord explicite dans la demande.

État vérifié (21 novembre) : T7 livré, désactivé par défaut ; lint, typecheck, `test:regression`, suite complète et `test:delivery` verts. Gain estimé −0,5 à −0,9 s sur Max audible (≈ 4,1 s), **non mesuré**. Reste de la mesure : Ulrich active `streamedLlm` en admin (Configuration avatar, Tavus) sur sandbox-ulrich et joue ≥ 10 tours, puis ≥ 10 tours réglage désactivé.

Périmètre : lire les spans de `llm_usage`, `tts_text_sent`, `first_audio_chunk`, `output_estimated` des deux séries ; comparer médianes, taux de salvage, de coupure et phrases retirées ; proposer à Ulrich de garder, corriger ou abandonner le prototype. Corriger un défaut observé seulement si le comportement attendu est clair. Autres leviers restants : `retrieve_k` 15 → 10 (rejeu `eval:rerank-replay` puis `evalJudge`), embedding partiel, attente vidéo Tavus (≈ 1,0 s).

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul. Les identifiants d'`.env.eval.local` ne sont pas utilisés par l'agent (Ulrich lance les commandes `eval:*`).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
