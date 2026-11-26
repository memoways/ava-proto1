# Importation des vidéos Gumlet dans « Vidéos AVA »

État au 26 novembre 2026 : lot 1 livré (PR #282, main `f76abc7e`), fonction déployée, secret `GUMLET_API_KEY` ajouté. Liste réelle lue le jour même : 103 vidéos, 17 déjà dans Notion, 86 à importer, toutes `ready` ; l'espace `673f29f4…` est confirmé. **Aucune fiche encore créée** (création réelle non vérifiée). Lot 2 demandé, non commencé.

## Lot 1 (demande d'Ulrich)

- Admin › Expérience › « Importation vidéo » (dernier onglet).
- « Comment ça marche » déplacé dans Mon compte (`/admin/mon-compte/fonctionnement`, ancienne adresse redirigée). Son contenu reste à mettre à jour par Ulrich.
- Edge Function `import-gumlet-videos` (`list`, `import`), réservée aux admins ; règles pures dans `supabase/functions/_shared/gumletImport.ts`.

## Règles

- Écrit uniquement de **nouvelles** pages dans la base `478685a5b31e45b5bc534bcf905b9124`, toujours « A vérifier ».
- « Déjà dans Notion » : identifiant Gumlet lu dans `URL Gumlet`, `URL` ou `ID Gumlet`, fiches archivées comprises. Relu avant chaque import.
- Espace Gumlet `673f29f4a5e1bf70aa645cb7` seulement (le seul que le lecteur lit). Confirmé le 26 novembre.
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

## Lot 2 — toutes les vidéos et leurs lectures (demande d'Ulrich, 26 novembre)

1. Lister **toutes** les vidéos Gumlet : celles déjà dans Notion grisées, non cochables, avec lien vers la fiche et son État ; les autres importables. Filtre « À importer / Dans Notion / Toutes ».
2. Afficher pour chaque vidéo **combien de fois elle a été jouée**, avec tri.
3. Gêne constatée : « Tout cocher » prend 86 vidéos pour une limite de 50 (37 extraits datés du 26 novembre à cocher un à un). Ajouter un filtre par date d'envoi.
4. La limite de 100 vidéos affichées du lot 1 ne tient plus (103) : paginer ou lever.

### Sources des lectures (diagnostic du 26 novembre)

- **Ava** : événements `cinematic_played` de `experience_events`, déjà agrégés par `playCounts` (`src/services/videoDecisionLog.ts`) pour « Décisions vidéo ». Relevé en base (lecture seule) : 122 lectures, 16 vidéos, 72 sessions, dont 6 en production, du 9 août au 25 novembre ; toutes rattachées à `video_triggers`.
  - Lien vidéo Gumlet ↔ lecture : `payload.videoId` = `video_triggers.id`, dont `video_url` donne l'identifiant Gumlet.
  - À vérifier : la synchronisation supprime les lignes des vidéos sorties de « En ligne » ; leurs lectures perdraient le lien. La vidéo d'introduction ne semble pas émettre `cinematic_played`.
- **Gumlet** : `POST /v1/video/assets/{asset_id}/analytics` (`views`, `playing_time`, `date_range`, `group_by`), un appel par vidéo ([référence](https://docs.gumlet.com/reference/tag/video-assets/post/video/assets/asset_id/analytics/index.md)). `POST /v1/video/analytics` donne `top_assets` (bande passante, durée diffusée) sur 60 jours au plus. Limite 1000 appels par heure : pas d'appel par vidéo à chaque affichage.
  - Ava lit le flux HLS avec son propre lecteur, sans SDK de statistiques Gumlet. La documentation lue ne dit pas si ces lectures sont comptées ; hypothèse : non. À mesurer sur une vidéo souvent jouée avant d'afficher ce chiffre.

Proposition : « Lectures dans Ava » (total, dont production, dernière lecture) comme chiffre principal ; « Vues Gumlet » seulement si la mesure montre qu'elles veulent dire quelque chose.

## Hors lot

- Compléter les métadonnées des fiches créées avant le lot 1.
- Transcription et Description IA avant « En ligne » (les fonctions actuelles ne traitent que les vidéos synchronisées).
