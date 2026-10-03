# Plan — Mise à jour RAG Voyage (rerank-3)

Date : 2026-10-03 — Statut : étape 1 implémentée, bascule par défaut à valider

## État des lieux
- Profil actif `voyage-4-realtime` (docs `voyage-4-large`, requêtes `voyage-4-lite`), 216 chunks, rebuild 2026-09-11.
- Reranker par défaut `rerank-2.5-lite`.

## Nouveautés Voyage
- `rerank-3` / `rerank-3-lite` (2026-09-30) : meilleurs que 2.5 au même prix, gros gain sur documents longs, sans réindexation.
- Voyage 4 : espace partagé, requêtes en `voyage-4` possibles sans réindexation.

## Fait
- `rerank-3` et `rerank-3-lite` ajoutés (app, laboratoire RAG, config RAG, `query-rag` avec liste autorisée). 2.5 conservés pour rollback.
- `query-rag` redéployée.

## Comparaison rapide (Max, « Où habites-tu et avec qui ? », top 3)
| Modèle | #1 | #2 |
|---|---|---|
| rerank-2.5-lite | Famille / Lausanne (0,77) | Chalet, chambres (hors sujet) |
| rerank-3-lite | Famille / Lausanne (0,78) | Retour à l'appartement de Lausanne (pertinent) |
| rerank-3 | Famille / Lausanne (0,82) | Retour à l'appartement de Lausanne (pertinent) |

## Reste à faire
1. Comparer sur davantage de questions dans Laboratoire RAG (Max + Emma).
2. Sélectionner `rerank-3-lite` en sandbox, puis Production via « Enregistrer les réglages ».
3. Profil « Voyage 4 · équilibré » : non retenu tant qu'aucun gain net n'est mesuré.
