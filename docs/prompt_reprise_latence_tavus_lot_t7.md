# Prompt de reprise — Latence Tavus, lot T7 (retrait du rerank en voix, après accord d'Ulrich)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md) (lots T5 et T6).

---

Objectif : si Ulrich a décidé de retirer le rerank pour la voix (≈ −0,2 s sur `character_rag`), le faire sans toucher au laboratoire RAG ni aux autres plateformes. Sans accord explicite d'Ulrich dans la demande : ne rien changer, rappeler la décision attendue.

État vérifié (21 novembre) : T3 sans régression RAG ; rejeu T5 : le rerank change fortement le top 5 (recouvrement 2,4/5) ; `evalJudge` T6 (run `82195f92-b9b3-4874-a641-719a62c5a673`) : 4,54 avec rerank contre 4,58 sans, bruit ± 0,63, `canon_timeline` −0,16. `RAG_RERANK_ENABLED` vrai dans `src/config/settings.json` et réglable côté admin (`admin_settings`) ; `query-rag` accepte `rerank: false` par requête.

Périmètre : 1. un réglage dédié à la voix (par exemple `RAG_RERANK_VOICE`, défaut inchangé tant qu'Ulrich n'a pas activé) lu par l'orchestrateur de voix pour envoyer `rerank: false`, sans changer le laboratoire RAG ni l'évaluateur ; 2. après activation en sandbox-ulrich, une session Tavus d'au moins 10 tours : médiane et p90 de `character_rag` avant (≈ 690 ms) et après, et vérification que `rerank_used` est faux ; 3. nouvelle passe `evalJudge` seulement si un doute de qualité apparaît à l'écoute.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul. Les identifiants d'`.env.eval.local` ne sont pas utilisés par l'agent (Ulrich lance les commandes `eval:*`).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
