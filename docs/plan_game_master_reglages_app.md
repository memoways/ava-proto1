# Game Master entièrement réglé dans l'app — nettoyage Notion et legacy

## Constat
- La fiche Notion « Game Master » archivée existe encore dans la base de l'app (1 fiche, 12 extraits mémoire). Son texte décrit l'ancien GM « narrateur » qui co-créait le rôle du joueur : obsolète (cadre bénévole, plusieurs personnages, GM invisible). La synchro Notion ignore désormais toute fiche « Game Master » (déjà déployé).
- Le GM actuel (directeur après chaque réplique) est construit à partir des réglages de l'onglet Réglages Game Master + du cadre commun. Il ne reçoit aucun « contexte projet » durable (enjeux, monde, règles méta).
- L'ancien moteur (GM avant le tour, ancien prompt GM, seuil de confiance, tolérance insultes, nb min. de questions) n'est plus appelé par le jeu.
- Les écrans âge/genre/lien familial ne sont plus dans le parcours.

## 1. Contexte projet du GM, réglable dans l'app
Nouveau bloc « Contexte de l'expérience » dans Réglages Game Master, versionné avec le reste (brouillon → publication) :
- Enjeux du projet et promesse (repris et réécrits depuis la fiche Notion, ce qui reste vrai : immersion, pas de méta IA, une idée à la fois, ne pas expliquer le lore, guidage par le mystère, « oui, et… »).
- Monde narratif : résumé court. Le détail reste dans le monde narratif déjà synchronisé (39 entrées) via la recherche, jamais copié en entier → pas de coût de latence.
- Questions ouvertes, affichées comme telles et transmises au GM comme « à traiter prudemment » : le joueur parle du film, le joueur demande qui il est, etc. Liste éditable.
- Taille limitée (compteur de caractères) pour protéger la latence. Aucun appel IA ajouté.

## 2. Garde-fous conversationnels (légers)
Dans le même onglet, trois réglages simples, appliqués par le directeur existant (pas de nouvel appel) :
- Faux statut (policier, psychologue…) : le personnage reste prudent ET le GM ajoute une consigne au tour suivant.
- Conversation qui déraille (insultes, hors sujet, absurde) : avertir via le personnage → recadrer → proposer de terminer l'appel ; seuil réglable.
- Confiance : jauge qualitative déjà suivie par la mémoire (ouverture/fermeture), exposée en réglage « vitesse d'ouverture » au lieu de l'ancien seuil numérique.

## 3. Suppressions
- Ancien moteur de conversation, ancien GM avant le tour, ancien prompt GM et leurs tests ; anciens réglages sans effet retirés des écrans (les données historiques en base restent).
- Écrans âge/genre/lien familial et leur service de résumé de rôle (fonction serveur retirée).
- Fiche « Game Master » et ses 12 extraits supprimés de la base après reprise de son contenu utile dans le bloc 1.
- Commentaires/filtres qui mentionnent encore la fiche GM Notion.

## 4. Vérification
Tests : faux statut → consigne GM au tour suivant ; seuil de dérapage ; taille max du contexte ; aucun écran âge/genre atteignable ; build et typecheck. Conversation test en sandbox. Rien en Production.

## Détails techniques
- Config : nouveaux champs `editor.projectContext`, `editor.openQuestions[]`, `editor.guardrails { falseStatus, derailThreshold, opennessPace }` dans `experience_orchestration_versions.config` (JSON, pas de migration) ; parse rétrocompatible dans `experienceOrchestration.ts`.
- Injection dans `buildExperienceDirectorPrompt` ; consigne faux statut via `nextTurnGuidance` existant ; détection côté directeur.
- Suppression : `conversationOrchestrator.ts`, `gameMasterAgent.ts` (+ tests), `GameMasterPromptSettings` legacy de `settingsService.ts`, `RoleCaptureScreen`, `RoleSummaryScreen`, phases `role_capture/role_summary`, Edge Function `summarize-role`.
- Données : DELETE de la ligne `characters` GM (cascade embeddings/prompt) via requête de données.
- Plan enregistré dans `docs/plan_game_master_reglages_app.md`.
