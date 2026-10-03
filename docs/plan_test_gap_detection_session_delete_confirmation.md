# Plan — couverture de confirmation de suppression de session

## Contexte

Le changement `e711fa1` remplace la confirmation native, indisponible dans
l’iframe de prévisualisation Lovable, par une confirmation à deux clics dans
`SessionsTab`.

## Lacune ciblée

Le premier clic ne doit pas appeler la suppression Supabase ; seul le second
clic sur la même action doit déclencher la requête.

## Vérification

Ajouter un test de composant ciblé dans `SessionsTab.ragLab.test.tsx`, puis
exécuter ce seul fichier avec la commande de tests unitaires.
