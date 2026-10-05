# Invitations de test — période de validité

- Formulaire : nom/pseudonyme + deux sélecteurs de date (début, fin incluse).
- Base : colonne `valid_from` (défaut now()); `expires_at` = fin de période.
- `redeem_external_test_invitation` refuse avant `valid_from` et après `expires_at`; l'accès activé dure jusqu'à `expires_at` (remplace les 4 h fixes).
- Statut « Programmée » avant le début. Période max 1 an, fin > début, validée côté serveur.
