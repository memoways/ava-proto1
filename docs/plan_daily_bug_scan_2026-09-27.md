# Plan — correction de la borne Gradium

## Contexte

Le correctif Gradium livré dans `b268fa4` indique que la température doit être
plafonnée à `0.85` afin de limiter les défauts de diction. Toutefois,
`applyGradiumPerformance` utilisait `Math.max(base.temp, 0.85)` comme borne
haute : une configuration déjà supérieure à `0.85` restait donc inchangée.

## Portée

Employer une borne haute fixe de `0.85` pour la température Gradium dès qu'une
intention de performance est appliquée. Ajouter une régression avec une base à
`1.1`, cas qui échouait avec le calcul livré.

## Critère observable

Une intention Gradium avec une température de base supérieure à `0.85` renvoie
`0.85`, sans modifier les réglages sans intention.
