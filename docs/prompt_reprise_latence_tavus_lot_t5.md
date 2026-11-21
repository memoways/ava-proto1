# Prompt de reprise — Latence Tavus, lot T5 (rerank conditionnel, après accord d'Ulrich)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md), [lot T4](prompt_reprise_latence_tavus_lot_t4.md).

---

Objectif : si Ulrich a choisi l'option (a) (rerank conditionnel ou retiré en voix, ≈ −0,2 s sur `character_rag`), la rejouer d'abord en qualité, puis seulement alors la réaliser. Sans accord explicite d'Ulrich dans la demande : ne rien changer, rappeler la décision attendue.

État vérifié (21 novembre) : T3 sur main sans régression RAG (0 erreur, 6,0 passages, `character_rag` 740 → 690 ms). Rerank `rerank-2.5-lite`, médiane 206 ms, `retrieve_k` 15 → 5 ; `RAG_RERANK_ENABLED` est vrai dans `src/config/settings.json`. Lecture des mesures : MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, `voice_turn_events` (`t_rag_total_ms`, `rag.matches_count`).

Périmètre : 1. rejeu laboratoire RAG (`RAGLabTab`) et `evalJudge` avec et sans rerank sur les mêmes questions des personnages ; critère de seuil convenu avec Ulrich. 2. Si validé : rerank conditionnel dans `supabase/functions/query-rag/index.ts` (écart des cosinus du top 5) ou réglage voix, sans toucher Anam, LemonSlice, Gradium ni TTS seul. 3. Mesure sur sandbox-ulrich (≥ 10 tours) avant/après.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu. Redéploiement de la fonction à demander à Lovable (vérifier `rag_profile.start_ms` et la présence du nouveau comportement).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
