# Prompt de reprise — Réglages, lot 3 : appliquer les deux arbitrages d'Ulrich

À copier dans un nouveau chat Ava. Origine : clôture du lot 2 (27 novembre 2026). **Ne commencer qu'avec les réponses d'Ulrich aux deux questions.**

## Objectif
Appliquer les deux décisions restées ouvertes, et rien d'autre.

## État vérifié à la fin du lot 2
- Lot 1 confirmé : appel d'Ulrich resté en voix (global « Voix », Max lié à Tavus) ; tours en base `output_stream.output = tts`, une entrée `llm`.
- Tri des réglages de test fait (Orchestration, Tavus, Anam, RAG, Cinématiques). Détail : `docs/plan_avatar_video_par_personnage.md` §9.3 ter.
- Non vérifié par l'agent : rendu dans l'aperçu Lovable (compte du navigateur intégré sans accès au projet ; contrôle fait en local sur `sandbox-ulrich`).
- SHA de fusion : voir le compte rendu et `git log origin/main`.

## Questions à Ulrich
1. **Appareil sur « avatar » et global « Voix ».** Aujourd'hui l'appareil garde la vidéo. Si le global doit couper aussi cet appareil : ligne `choice !== "avatar" && configuredMode === "tts"` de `resolveCallOutputMode`, tests « keeps a device explicitly set to the live avatar », textes de la page Avatar vidéo et §9.3 bis.
2. **`VOICE_ONLY_UI`.** Sans écran. Valeur enregistrée `true` dans les cinq environnements lus le 27 novembre (défaut du code : `false`). Son seul effet observé : préparer une réplique de secours et la jouer si la sortie vocale échoue (`IndexPRD4.tsx`) ; `ConversationScreen` reçoit la propriété sans l'utiliser. Choix : le figer à « actif » (retirer le drapeau, garder la réplique de secours, recommandé) ou retirer drapeau et secours. Les sessions ouvertes gardent `voicePreset.voiceOnly`.

## Sources
`src/services/callOutputMode.ts`, `src/services/settingsService.ts`, `src/services/prd4Session.ts`, `src/pages/IndexPRD4.tsx`, `src/services/conversationMemoryV1.ts`.

## Invariants et limites d'autorisation
Sandbox uniquement, production non publiée. Aucune valeur enregistrée réécrite automatiquement ; ne pas toucher `sandbox-romed`, `sandbox-benoit`, `sandbox-julien`. Aucune migration attendue. Base Caractères Notion en lecture seule. Gami DigiDouble exclu. Passage de personnage, cinématiques, interruption inchangés.

## Validations
Tests ciblés des fichiers touchés, `npm run typecheck`, lint, `npm run test:quality`, `npm run test:delivery`, CI de PR avec `regression-gates`. `PeriodCostLines.test.tsx` peut échouer localement sur « 1'500 » (locale ICU) ; la CI fait foi.

## Livraison
Branche de lot depuis main à jour, commit, push, PR, puis `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier arbre et parent sur origin/main, supprimer notre branche, synchroniser en local et sur Lovable, mettre à jour `docs/etat_courant.md` et le CHANGELOG.

## Première action exécutable
Poser les deux questions à Ulrich, une à la fois.

## Clôture obligatoire
Avant le push, s'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire. Donner le lien direct dans le compte rendu. Ne pas lancer de lot suivant.
