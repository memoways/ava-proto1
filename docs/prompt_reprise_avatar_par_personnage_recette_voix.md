# Reprise — recette à la voix du service vidéo par personnage

Ce prompt ne lance rien tant qu'Ulrich ne le demande pas.

```
Ava Proto 1 — lot « recette à la voix du service vidéo par personnage ». Dépôt https://github.com/memoways/ava-proto1, checkout canonique, main à jour.
État : le service vidéo par personnage est fusionné (docs/plan_avatar_video_par_personnage.md, section 9 ; résolution src/services/callVideoRouting.ts ; écran Réglages personnages). En sandbox-ulrich, Emma est liée à Nuance `sonia`, Texte d'Ava (global). Recette automatisée avec micro simulé silencieux : vidéo d'Emma ouverte, rappel de Max depuis la grille en voix, Max sans lien inchangé. Une phrase anglaise courte a été rendue mot pour mot (transcription Nuance). Micro refusé = repli voix (le SDK Nuance exige un micro). Rien n'a été écouté.
Objectif : guider Ulrich pour une recette humaine au micro, une action à la fois, puis corriger ce qu'elle révèle.
À vérifier : (1) l'aperçu Lovable contient le commit ; (2) appel d'Emma : le visage dit-il la réplique française, la refuse-t-il ou la reformule-t-il ; phrase anglaise courte ; (3) passage proposé par le GM pendant un appel vidéo d'Emma vers Max : Max en voix, jamais dans la salle d'Emma ; (4) comparer un second service sur Emma (3 ouvertures de salle au plus par 10 minutes) ; (5) délai : l'appel attend au plus le délai de connexion global après les sonneries, alors que Nuance peut demander 35 s.
Hors lot : multilingue M1/M7, changement de salle en cours d'appel, fiche personnage ou RAG dans Nuance, production.
Livraison : selon CLAUDE.md/AGENTS (branche, PR, CI verte sur le HEAD exact, garde ship-pr.mjs), puis stop et prompt de reprise du lot suivant.
```
