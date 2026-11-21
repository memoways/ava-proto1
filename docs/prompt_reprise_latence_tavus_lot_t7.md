# Prompt de reprise — Latence Tavus, lot T7 (leviers contexte restants, rerank conservé)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md) (lots T3 à T6).

---

Objectif : choisir avec Ulrich le prochain levier de latence, le rerank étant conservé (décision d'Ulrich du 21 novembre : aucun retrait). Ne rien changer sans son accord explicite dans la demande.

État vérifié (21 novembre) : T3 sans régression RAG (`character_rag` 740 → 690 ms) ; T5 : le rerank change fortement le top 5 ; T6 : `evalJudge` 4,54 avec contre 4,58 sans (bruit ± 0,63), rerank conservé. Leviers restants (médianes Max audible ≈ 4,1 s) : `retrieve_k` 15 → 10 (rerank un peu plus court, qualité à rejouer par `eval:rerank-replay` puis `evalJudge`), embedding sur transcript partiel (≈ 0,2 s, lourd), LLM streamé (0,5–0,9 s estimés, voir `evaluation_llm_streame_vers_tts.md`), attente vidéo Tavus (≈ 1,0 s, seul levier propre à Tavus).

Périmètre : proposer à Ulrich, chiffres à l'appui, un seul de ces leviers ; le réaliser seulement après son accord, avec rejeu qualité avant tout changement de réglage RAG et mesure sandbox-ulrich d'au moins 10 tours.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul. Les identifiants d'`.env.eval.local` ne sont pas utilisés par l'agent (Ulrich lance les commandes `eval:*`).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
