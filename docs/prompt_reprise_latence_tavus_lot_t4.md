# Prompt de reprise — Latence Tavus, lot T4 (mesure de T3, puis rerank ou embedding partiel)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md), [lot T3](prompt_reprise_latence_tavus_lot_t3.md).

---

Objectif : mesurer le gain du lot T3 (lecture du profil RAG en parallèle du quota dans `supabase/functions/query-rag/index.ts`,
attendu ≈ −56 ms médian sur `character_rag`), puis traiter le levier contexte restant avec la décision d'Ulrich.

État attendu (à vérifier d'abord) : T3 fusionné sur main ; spans serveur `control_quota` et `rag_profile` désormais
chevauchants (`rag_profile.start_ms` ≈ 0). Avant T3, session `d39b9221…` (médianes) : quota 56, profil 63, embedding 214,
vector 63, rerank 208 ms ; `character_rag` client 735 ms. Lecture via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`
(`voice_turn_events`, `metadata_json->server`).

Périmètre :
1. Demander à Ulrich une session Tavus sandbox-ulrich d'au moins 10 tours après synchro Lovable ; comparer médiane et p90 de
   `character_rag` avant/après ; documenter dans l'analyse.
2. Proposer à Ulrich, chiffres à l'appui, entre : (a) rerank conditionnel ou retiré en voix (≈ 0,2 s ; rejouer la qualité via
   le laboratoire RAG et `evalJudge` avant tout changement de `RAG_RERANK_ENABLED`) ; (b) embedding lancé sur le transcript
   partiel (≈ 0,2 s ; plus lourd). Ne rien changer sans son accord.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami DigiDouble
exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul.
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`
via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY,
CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.
