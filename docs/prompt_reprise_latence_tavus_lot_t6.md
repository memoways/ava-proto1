# Prompt de reprise — Latence Tavus, lot T6 (qualité du rerank par evalJudge)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md) (lot T5).

---

Objectif : trancher par `evalJudge` si le rerank améliore réellement les réponses de Max/Emma, donc s'il peut être retiré en voix (≈ −0,2 s sur `character_rag`). Ne rien changer à `RAG_RERANK_ENABLED` sans accord d'Ulrich.

État vérifié (21 novembre) : T3 sur main sans régression RAG ; rejeu T5 : le rerank (`rerank-2.5-lite`, retrieve_k 15 → 5) modifie fortement le top 5 (recouvrement 2,4/5 avec le cosinus, premier passage identique 32 %), aucun critère de cosinus ne désigne un cas sûr. Outil de rejeu : `npm run eval:rerank-replay` (compte d'`.env.eval.local`, lancé par Ulrich ; les agents n'utilisent pas ces identifiants).

Périmètre : 1. comparer `evalJudge` (`npm run eval:judge`, sandbox) rerank activé et désactivé sur les mêmes séquences, par Ulrich ou avec son feu vert explicite ; critère de seuil à convenir avec lui. 2. Si le retrait est validé : réglage voix seulement (pas de changement pour le laboratoire RAG), Anam, LemonSlice, Gradium et TTS seul inchangés. 3. Sinon, alternatives chiffrées : `retrieve_k` 15 → 10, embedding sur transcript partiel.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu. Aucun usage des identifiants d'`.env.eval.local` par l'agent.
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
