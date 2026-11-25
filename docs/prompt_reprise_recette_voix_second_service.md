# Reprise — recette au micro : Emma sur Anam puis Tavus

Ce prompt ne lance rien tant qu'Ulrich ne le demande pas.

```
Ava Proto 1 — lot « recette au micro : Emma sur Anam puis Tavus ». Dépôt https://github.com/memoways/ava-proto1, checkout canonique, main à jour.
État : service vidéo par personnage fusionné (docs/plan_avatar_video_par_personnage.md, section 9 ; src/services/callVideoRouting.ts ; écran Réglages personnages, qui signale les champs vides d'un autre personnage que Max). Écouté le 25 novembre sur l'aperçu, sandbox-ulrich : Nuance improvise en anglais, est coupé, la voix d'Ava dit la réplique (PR 279, confirmé). Décision d'Ulrich : Nuance mis de côté, code conservé. Ulrich câble Emma sur Anam puis Tavus. À vérifier dans les réglages : le fournisseur global de sandbox-ulrich était Nuance, avec l'interrupteur global sur Avatar vidéo. Anam parle avec sa propre voix (Voice ID vidéo) ; Tavus peut garder la voix d'Ava d'Emma. VOICE_ONLY_UI : aucun texte de personnage à l'écran.
Objectif : guider Ulrich, une action à la fois, puis corriger ce que la recette révèle.
À vérifier : (1) Emma sur Anam : visage, voix, français, délai ; (2) Emma sur Tavus : idem ; 3 ouvertures de salle au plus par 10 minutes ; (3) passage proposé par le GM pendant un appel vidéo d'Emma vers Max : Max en voix, jamais dans la salle d'Emma ; (4) choisir le service d'Emma.
Hors lot : Nuance, multilingue M1/M7, changement de salle en cours d'appel, vidéo au rappel depuis la grille (à demander), production.
Livraison : selon CLAUDE.md/AGENTS (branche, PR, CI verte sur le HEAD exact, garde ship-pr.mjs), puis stop et prompt de reprise du lot suivant, avec cette même obligation.
```
