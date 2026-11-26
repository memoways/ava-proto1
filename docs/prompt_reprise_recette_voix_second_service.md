# Reprise — recette au micro : Emma sur Tavus

Ce prompt ne lance rien tant qu'Ulrich ne le demande pas.

```
Ava Proto 1 — lot « recette au micro : Emma sur Tavus ». Dépôt https://github.com/memoways/ava-proto1, checkout canonique, main à jour (contient la PR 280, 2063fc5e).
État : service vidéo par personnage fusionné (docs/plan_avatar_video_par_personnage.md, section 9 ; src/services/callVideoRouting.ts ; écran Réglages personnages, qui signale les champs vides d'un autre personnage que Max). Écouté le 25 novembre sur l'aperçu : Nuance mis de côté (code conservé) ; Emma sur Anam validée en sandbox-ulrich (Avatar ID e9d42cb2-cfb1-479e-ada5-2b45150d024e, visage d'essai ; Voice ID vidéo a291e244-d30f-4e2c-aa57-26b48df57931, voix ElevenLabs d'Emma importée dans Anam). Max est lié à Anam dans ce sandbox ; le fournisseur global y était encore Nuance. La vidéo ne s'ouvre que pour le premier appel d'une session. VOICE_ONLY_UI : aucun texte de personnage à l'écran. sandbox-romed a reçu le 25 novembre des liens de test (Max → Tavus ; Emma → Anam avec un Voice ID égal à l'Avatar ID) : à remettre sur « Suivre le réglage global » après accord de Romed.
Objectif : guider Ulrich, une action à la fois, puis corriger ce que la recette révèle.
À vérifier : (1) Emma sur Tavus avec son Face ID, voix d'Ava d'Emma : visage, voix, français, délai (3 ouvertures de salle au plus par 10 minutes) ; (2) passage proposé par le GM pendant un appel vidéo d'Emma vers Max : Max en voix, jamais dans la salle d'Emma ; (3) choisir le service d'Emma et son visage définitif ; (4) remettre sandbox-romed en état ; (5) fournisseur global de sandbox-ulrich hors de Nuance.
Hors lot : Nuance, multilingue M1/M7, changement de salle en cours d'appel, vidéo au rappel depuis la grille (à demander), production.
Livraison : selon CLAUDE.md/AGENTS (branche, PR, CI verte sur le HEAD exact, garde ship-pr.mjs ; exception documentaire si aucun code ne change), puis stop et prompt de reprise du lot suivant, avec cette même obligation.
```
