# Reprise — importation Gumlet, lot 2 : toutes les vidéos et leurs lectures

Ava (`memoways/ava-proto1`). Lire `AGENTS.md`, `docs/etat_courant.md`, `docs/plan_import_videos_gumlet.md` (section « Lot 2 »), `git status`, les six derniers commits de `origin/main`.

## État vérifié (26 novembre 2026)

- Lot 1 sur main (PR #282, `f76abc7e`) : `src/components/admin/VideoImportTab.tsx`, `src/services/gumletImportService.ts`, `supabase/functions/import-gumlet-videos`, `_shared/gumletImport.ts`.
- Fonction déployée via Lovable (projet `1265958d-b74e-40f2-917d-182fe05163fc`), secret `GUMLET_API_KEY` présent.
- Liste réelle : 103 vidéos, 17 dans Notion, 86 à importer. Aucune fiche créée par l'onglet : vérifier d'abord dans Notion (workspace Gamilab) si Ulrich en a importé une depuis, et la relire.
- `experience_events` `cinematic_played` : 122 lectures, 16 vidéos, 72 sessions, 6 en production.

## Demande d'Ulrich

« Lister toutes les vidéos, griser celles déjà importées, montrer celles qu'on peut importer, et surtout avoir les statistiques de lecture : quelle vidéo a été jouée combien de fois. »

## Périmètre

1. Toutes les vidéos Gumlet dans l'onglet : importées grisées, non cochables, lien et État Notion ; filtre « À importer / Dans Notion / Toutes » ; filtre par date d'envoi ; lever la limite de 100 affichées.
2. Lectures par vidéo, triables : « Lectures dans Ava » (total, dont production, dernière lecture), à partir de `cinematic_played` (réutiliser `playCounts` ; attention à sa fenêtre de dates et au plafond de 5000 événements). Dire sur l'écran de quelle période et de quels environnements vient le chiffre. Traiter les vidéos retirées de `video_triggers` et l'introduction.
3. Mesurer `POST /v1/video/assets/{asset_id}/analytics` sur une vidéo souvent jouée dans Ava. Afficher « Vues Gumlet » seulement si le résultat est exploitable, sans appel par vidéo à chaque affichage (limite 1000/heure) ; sinon l'expliquer à Ulrich. Pas de SDK Gumlet dans le lecteur sans son accord.

## Interdits

Base Caractères ; modification de fiches existantes ; migration sans accord ; publication en production.

## Validations et livraison

Tests (fonction, règles, onglet), `npm run test:quality` et `npm run test:delivery` (un test `PeriodCostLines` échoue localement sous Node 22), essai réel dans l'aperçu. Contrat AGENTS : PR, CI verte, `ship-pr.mjs`, puis déploiement de la fonction par Lovable. Mettre à jour plan, état courant et CHANGELOG ; terminer par le prompt de reprise du lot suivant (métadonnées des anciennes fiches, ou Transcription / Description IA avant « En ligne ») ou dire qu'il n'y en a pas. Puis STOP.

Première action : lire la fiche éventuellement importée, puis la fonction et l'onglet du lot 1.
