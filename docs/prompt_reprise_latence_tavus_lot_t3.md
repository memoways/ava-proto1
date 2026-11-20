# Prompt de reprise — Latence Tavus, lot T3 (mesure du lot T2, décisions en attente)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md), [évaluation LLM streamé](evaluation_llm_streame_vers_tts.md), [lot T2](prompt_reprise_latence_tavus_lot_t2.md).

---

Objectif : confirmer par la mesure que le lot T2 supprime les tours en retard de 1,3–1,6 s (attente du GM post-tour du tour
précédent avant le tour suivant), puis traiter ce qu'Ulrich aura décidé sur les interruptions et le LLM streamé.

État attendu (à vérifier d'abord) : le lot T2 est fusionné sur main (`handoffFinalizationWritesSnapshot` dans
`handoffCoordinator.ts`, raccourci de finalisation dans `IndexPRD4.tsx`, spans `pre_turn_handoff_prior_write`,
`pre_turn_handoff_read`, `pre_turn_handoff_own_write`). Avant T2, session `c293829f…` : `pre_turn_handoff_wait` ≈ 0,1 s
sauf aux tours 3 et 7 (1,6 s et 1,3 s), qui attendaient la fin du GM précédent ; `video_wait_ms` médian 1,0 s,
`output_estimated` médian 3,93 s. Lecture via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`
(`voice_turn_events`, `metadata_json->server`, `llm_usage` pour l'heure de fin du GM).

**Mise à jour 20 novembre : T2 mesuré** (session `d39b9221…`, 20 tours) : `pre_turn_handoff_wait` ≤ 0,17 s aux 20 tours, passage
Max → Emma validé à l'écoute, Max audible ≈ 4,1 s contre ≈ 3,5 s pour Emma (Emma n'a pas l'attente vidéo ≈ 1,0 s). Les points 1 et 2
ci-dessous sont faits ; il reste les leviers du tableau « Où reste la latence » de l'analyse : choisir avec Ulrich entre
(a) contexte (rerank en parallèle, rejouer la qualité de retrieval), (b) prototype LLM streamé, (c) expérience sur les premiers
morceaux Tavus (taille, cadence), (d) réglage de fin d'énoncé STT.

Périmètre (historique) :
1. Après synchro Lovable, demander à Ulrich **une** session Tavus sandbox-ulrich d'au moins 10 tours dont plusieurs enchaînés
   vite ; lire les trois nouveaux spans. Attendu : `pre_turn_handoff_wait` < 0,3 s à tous les tours sans passage ; sinon
   lire quelle partie (prior_write, read, own_write) domine et documenter. Compléter l'analyse (médiane, p90).
2. Vérifier à l'écoute et dans `experience_events` qu'aucun passage Max → Emma validé n'a été perdu (recette passage :
   demande explicite d'Emma, consentement de Max) ; tout `handoff_blocked` inattendu = régression à corriger en priorité.
3. Interruptions : si Ulrich veut réduire les coupures à ≈ 1,3 s après la décision, c'est un réglage de fin d'énoncé STT
   (Deepgram `utteranceEndMs` 1500, silence 900 ms) avec contrepartie de latence ; proposer des valeurs, mesurer avant/après,
   ne rien changer sans son accord.
4. LLM streamé : implémenter seulement si Ulrich valide l'évaluation ; commencer par le prototype mesuré (Tavus seul,
   première phrase seulement) décrit dans la note.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami
DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul.

Validations : tests unitaires ciblés, typecheck, lint, tests de garde, CI `regression-gates` verte sur le HEAD exact ;
mesure sandbox avant/après pour tout changement de chemin critique.

Livraison : branche de lot depuis main à jour, commit, push, PR, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`,
vérification sur origin/main, synchro locale et Lovable ; STORY/CHANGELOG/`docs/etat_courant.md`. Avant le push, s'il reste
du travail identifié, écrire le prompt de reprise du lot suivant avec cette même obligation de clôture.
