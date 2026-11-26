# Reprise — importation Gumlet : première utilisation réelle

Ava (`memoways/ava-proto1`). Lire `AGENTS.md`, `docs/etat_courant.md`, `docs/plan_import_videos_gumlet.md`, `git status`.

## État

Lot 1 fusionné sur main (onglet « Importation vidéo », fonction `import-gumlet-videos`, huit champs Notion). Tests avec réponses simulées seulement. Vérifier dans Lovable (projet `1265958d-b74e-40f2-917d-182fe05163fc`) que la fonction est déployée et que le secret `GUMLET_API_KEY` existe (ajouté par Ulrich, jamais dans le chat).

## Périmètre

1. Admin › Expérience › Importation vidéo : la liste s'affiche, les compteurs sont cohérents avec Gumlet.
2. Importer **une** vidéo choisie par Ulrich, relire la fiche Notion (workspace Gamilab) : titre, lien, couverture, métadonnées, « A vérifier ».
3. Actualiser : la vidéo n'est plus proposée.
4. Corriger les écarts de format de l'API Gumlet constatés (espace, champs, pagination), avec tests.

## Interdits

Base Caractères ; modification de fiches existantes ; migration ; publication en production.

## Livraison

Contrat AGENTS (PR, CI verte, garde `ship-pr.mjs`), puis déploiement de la fonction si le code change. Terminer par le prompt de reprise du lot suivant (compléter les métadonnées des anciennes fiches, ou Transcription / Description IA avant « En ligne »), ou dire qu'il n'y en a pas. Puis STOP.
