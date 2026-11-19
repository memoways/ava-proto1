# Prompt de reprise — Latence Tavus, lot T2 (mesure T1, attente de passage, LLM streamé)

À copier dans un nouveau chat Ava. Contexte : [analyse](analyse_latence_tavus_20261119.md), [lot T1](prompt_reprise_latence_tavus_lot_t1.md).

---

Objectif : confirmer par la mesure l'effet du lot T1 (flux PCM ElevenLabs vers Tavus), puis traiter ce qui reste de l'attente
de Max en vidéo Tavus : (1) le retard d'environ 0,9 s de certains tours (attente de passage avant le tour), (2) les
interruptions répétées pendant l'attente, (3) évaluer, sans l'implémenter d'emblée, un LLM streamé vers le TTS.

État attendu (à vérifier d'abord) : le lot T1 est fusionné sur main (`avatarAudioBridge.ts` option `streamFirstLine`,
`elevenLabsPcmStream.ts`, span client `pre_turn_handoff_wait`). Avant T1 : Max audible à 5,4–6,0 s (médiane), attente
vidéo 2,2–2,6 s ; cible T1 : `video_wait_ms` médian < 1,2 s, `output_estimated` < 4,5 s. Si la mesure T1 de
l'analyse est encore vide, la faire en premier : une session Tavus sandbox-ulrich (jouée par Ulrich), puis lecture de
`voice_turn_events` et `llm_usage` via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`.

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le début du
CHANGELOG, l'analyse, `src/services/streamingAvatar/avatarAudioBridge.ts`, `src/pages/IndexPRD4.tsx` (~1755-1800,
attente de passage), `src/services/voiceTurnTelemetryV2.ts`.

Périmètre :
1. Mesure T1 et compléter l'analyse (médiane, p90, tours en repli TTS local, écoute d'Ulrich : lèvres, coupures).
2. Lire le span `pre_turn_handoff_wait` sur 10 tours : si l'attente de l'écriture de passage précédente explique le retard,
   la sortir du chemin critique (écriture déjà lancée, ne pas l'attendre pour démarrer le LLM quand le passage est inactif) ;
   sinon documenter la vraie cause.
3. Interruptions répétées pendant l'attente : reproduire, trouver si Tavus ou le détecteur d'interruption déclenche, corriger
   seulement si la cause est établie.
4. LLM streamé : note d'évaluation dans `docs/` (gain attendu, risques pour la première phrase et la segmentation), sans code
   tant qu'Ulrich n'a pas validé.

Limites : aucun réglage GM, aucune migration, production non publiée, base Caractères Notion en lecture seule, Gami
DigiDouble exclu, pas de régression sur Anam, LemonSlice, Gradium ni sur le mode TTS seul.

Validations : tests unitaires ciblés, typecheck, lint, tests de garde, CI `regression-gates` verte sur le HEAD exact ;
mesure sandbox avant/après pour tout changement de chemin critique.

Livraison : branche de lot depuis main à jour, commit, push, PR, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`,
vérification sur origin/main, synchro locale et Lovable ; STORY/CHANGELOG/`docs/etat_courant.md`. Avant le push, s'il reste
du travail identifié, écrire le prompt de reprise du lot suivant avec cette même obligation de clôture.
