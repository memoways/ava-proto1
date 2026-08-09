## Contexte

Les changements récents du 7 août ont introduit une nouvelle couche de normalisation pour l'orchestration d'expérience (`src/services/experienceOrchestration.ts`) sans suite de tests dédiée sur ces fallbacks.

## Portée

- verrouiller la normalisation des bornes numériques
- verrouiller les fallbacks des priorités éditeur
- verrouiller la remise à zéro des champs contraints (`handoffTarget`, `maximumHandoffsPerSession`, `customInstructions`)

## Hors portée

- refonte des services Supabase
- ajout de tests d'intégration UI larges
- modifications produit hors orchestration récente
