# Plan — couverture de la borne de température Gradium

## Contexte

Entre `9d1098a` et `b268fa4`, `applyGradiumPerformance` a réduit et plafonné
la hausse de température Gradium afin d'éviter les hésitations et problèmes de
prononciation. Le test existant vérifiait encore uniquement l'ancienne borne
large de `1.4`.

## Portée

Ajouter un test unitaire à l'API publique `applyGradiumPerformance` avec une
intention `angry` d'intensité `2` et une température de base de `0.8`.
La température attendue est `0.85`.

## Critère observable

Le test aurait échoué avant ce correctif (ancienne valeur : `1.06`) et protège
désormais la borne de diction Gradium, sans modifier le comportement de
production.
