# Importation des vidéos Gumlet dans « Vidéos AVA »

État au 26 novembre 2026 : lot 1 codé et testé avec des réponses simulées. Aucun appel réel à Gumlet.

## Lot 1 (demande d'Ulrich)

- Admin › Expérience › « Importation vidéo » (dernier onglet).
- « Comment ça marche » déplacé dans Mon compte (`/admin/mon-compte/fonctionnement`, ancienne adresse redirigée). Son contenu reste à mettre à jour par Ulrich.
- Edge Function `import-gumlet-videos` (`list`, `import`), réservée aux admins ; règles pures dans `supabase/functions/_shared/gumletImport.ts`.

## Règles

- Écrit uniquement de **nouvelles** pages dans la base `478685a5b31e45b5bc534bcf905b9124`, toujours « A vérifier ».
- « Déjà dans Notion » : identifiant Gumlet lu dans `URL Gumlet`, `URL` ou `ID Gumlet`, fiches archivées comprises. Relu avant chaque import.
- Espace Gumlet `673f29f4a5e1bf70aa645cb7` seulement (le seul que le lecteur lit). Hypothèse à confirmer au premier appel réel.
- Seule une vidéo `ready` est cochable. 50 par import, 100 affichées (les plus récentes) : un appel de détail par vidéo, limite Gumlet 1000 par heure.
- Un champ de métadonnées absent ou d'un autre type est ignoré et signalé ; `Titre de la vidéo`, `URL Gumlet` ou `État` manquant bloque tout.

## Métadonnées

| Champ Notion | Source Gumlet |
|---|---|
| Titre de la vidéo | `input.title` |
| URL Gumlet | `https://gumlet.tv/watch/{asset_id}` |
| couverture de la fiche | `output.thumbnail_url[0]` |
| ID Gumlet | `asset_id` |
| Durée (s) | `input.duration` |
| Uploadée sur Gumlet | `created_at` |
| Dimensions | `input.width`, `height`, `aspect_ratio` |
| Poids (Mo) | `input.size` |
| Dossier Gumlet, Tags Gumlet | `folder`, `tag` |
| Description Gumlet | `input.description` (le jeu lit `Description`, pas ce champ) |

Documentation : [liste](https://docs.gumlet.com/reference/tag/video-assets/get/video/assets/list/workspace_id/index.md), [détail](https://docs.gumlet.com/reference/tag/video-assets/get/video/assets/asset_id/index.md), [clés](https://docs.gumlet.com/developers/api-keys/index.md).

## Hors lot

- Compléter les métadonnées des fiches créées avant ce lot.
- Transcription et Description IA avant « En ligne » (les fonctions actuelles ne traitent que les vidéos synchronisées).
