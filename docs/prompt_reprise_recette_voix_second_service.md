# Reprise — recette au micro : coupure Nuance, passage vers Max, second service

Ce prompt ne lance rien tant qu'Ulrich ne le demande pas.

```
Ava Proto 1 — lot « recette au micro : second service vidéo pour Emma ». Dépôt https://github.com/memoways/ava-proto1, checkout canonique, main à jour (contient la PR « cut Nuance when it does not read Ava's line »).
État : service vidéo par personnage fusionné (docs/plan_avatar_video_par_personnage.md, section 9 ; src/services/callVideoRouting.ts). Recette écoutée le 25 novembre sur l'aperçu, sandbox-ulrich, Emma liée à Nuance `sonia`, mains libres, VOICE_ONLY_UI (aucun texte de personnage à l'écran : tout se juge à l'oreille), interrupteur global sur Avatar vidéo et fournisseur global Nuance (un appel direct à Max ouvre donc Nuance `sam`). Constat : Nuance improvise en anglais au lieu de lire la réplique française. Corrigé : transcription comparée (src/services/streamingAvatar/spokenLineMatch.ts), coupure et voix d'Ava ; attente après sonneries portée à 35 s pour Nuance. Un rappel depuis la grille est toujours en voix.
Objectif : guider Ulrich, une action à la fois, puis corriger ce que la recette révèle.
À vérifier : (1) l'aperçu Lovable contient le commit ; (2) appel d'Emma sur Nuance : improvisation coupée vite, réplique dite en français par la voix d'Ava, aucune double réplique ; (3) lier Emma à un second service (HeyGen, Tavus, Anam ou LemonSlice) dans Réglages personnages et juger visage, français, délai (3 ouvertures de salle au plus par 10 minutes) ; (4) passage proposé par le GM pendant un appel vidéo d'Emma vers Max : Max en voix, jamais dans la salle d'Emma ; (5) choisir le service à garder pour Emma.
Hors lot : multilingue M1/M7, changement de salle en cours d'appel, fiche personnage ou RAG dans Nuance, vidéo au rappel depuis la grille (à demander), production.
Livraison : selon CLAUDE.md/AGENTS (branche, PR, CI verte sur le HEAD exact, garde ship-pr.mjs), puis stop et prompt de reprise du lot suivant, avec cette même obligation.
```
