# Plan — couverture des invitations à période et multi-utilisateurs

## Objectif

Vérifier au niveau intégration que les deux migrations récentes des invitations
de test empêchent l'utilisation avant `valid_from` et autorisent plusieurs
testeurs quand `multi_use` est activé.

## Périmètre

- Charger les migrations Drizzle de période de validité et de partage dans le
  banc PGlite existant.
- Ajouter un scénario ciblé qui vérifie les deux comportements directement
  dans `redeem_external_test_invitation`.
- Corriger les contraintes historiques et le contrôle d'accès qui empêchaient
  un second testeur d'utiliser une invitation partagée.

## Vérification

Exécuter le test d'intégration des migrations d'environnements avec Vitest.
