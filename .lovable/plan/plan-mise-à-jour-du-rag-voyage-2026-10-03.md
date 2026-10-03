# Plan : mise à jour du RAG Voyage

## État actuel (vérifié)
- Profil actif : **Voyage 4 · temps réel**. Les documents sont indexés avec `voyage-4-large` et les questions encodées avec `voyage-4-lite`. 216 morceaux de texte, dernière reconstruction le 11/09/2026.
- Tri de pertinence (reranking) : **rerank-2.5-lite** par défaut, avec **rerank-2.5** en option. Les deux noms sont codés en dur côté app et côté serveur : tout autre nom est refusé et remplacé par la version lite.
- Profil « Contextualisé » (`voyage-context-4`) : encore expérimental, jamais validé en conditions réelles.

## Nouveautés Voyage
1. **rerank-3 et rerank-3-lite** (sortis le 30/09/2026). Ils sont meilleurs que la série 2.5, **au même prix**. La version lite atteint la qualité de rerank-2.5 pour 40 % du prix. Ils sont surtout plus performants sur les textes longs, ce qui correspond à nos fiches de personnages. **Aucune réindexation n'est nécessaire.**
2. Série Voyage 4 : tous ses modèles partagent le même espace. On peut donc passer de `voyage-4-lite` à `voyage-4` pour les questions **sans réindexer**. C'est un peu plus précis, avec un peu plus de latence.
3. `voyage-context-4` : rien de neuf depuis juin. Il reste en option expérimentale.

## Ce que je propose
1. **Ajouter rerank-3 et rerank-3-lite**, côté app et côté serveur. Ils apparaîtront dans la configuration RAG et le laboratoire RAG. Les modèles 2.5 restent disponibles pour revenir en arrière.
2. **Comparer dans le laboratoire RAG** sur les questions épinglées (Max et Emma) :
   - 2.5-lite contre 3-lite contre 3 ;
   - questions encodées en `voyage-4-lite` contre `voyage-4`.
   On regarde la pertinence des 3 premiers résultats et la latence.
3. **Changer le réglage par défaut** pour rerank-3-lite, si la comparaison le confirme. Le changement se fait d'abord en sandbox, puis en Production par une sauvegarde explicite dans l'admin.
4. Option : ajouter un profil « Voyage 4 · équilibré » (questions encodées en `voyage-4`), seulement si l'étape 2 montre un gain net.
5. Documenter le tout dans `docs/plan_rag_voyage_mise_a_jour.md` et dans le CHANGELOG.

## Détails techniques
- `src/services/ragService.ts` et `supabase/functions/query-rag/index.ts` : élargir le type `rerankModel` et la validation (liste autorisée) ; redéployer `query-rag`.
- `RAGConfigTab.tsx` / `RAGLabTab.tsx` : nouvelles options, avec une description de chacune.
- `_shared/ragProfiles.ts` : nouveau profil, seulement si l'étape 4 est retenue (pas de réindexation, même espace d'embedding).
- Tests unitaires sur la validation du modèle de tri. Pas de migration de base de données.

## Hors périmètre
- Pas de reconstruction de l'index.
- Pas de bascule automatique en Production.
