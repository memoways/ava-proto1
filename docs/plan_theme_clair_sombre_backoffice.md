# Plan — Mode clair / sombre du back-office

Plan approuvé le 2026-09-23, archivé aussi dans
`.lovable/plan/plan-mode-clair-sombre-du-back-office-2026-09-23.md`.

## Objectif

Ajouter au back-office une bascule entre le rendu sombre existant et un rendu
clair à fond blanc, sans modifier l’apparence sombre de l’expérience joueur.
Le choix est propre au navigateur et persiste entre les visites.

## Décisions

- Le thème clair est réservé aux chemins `/admin`.
- Toute navigation vers l’expérience joueur rétablit le thème sombre.
- La préférence est enregistrée localement, sans donnée en base.
- Les couleurs s’appuient sur les variables sémantiques déjà utilisées par les
  cartes, formulaires, onglets, menus et fenêtres.
- Les couleurs fonctionnelles des alertes et graphiques sont conservées, avec
  des variantes de texte lisibles dans les deux thèmes.

## Mise en œuvre

1. Brancher le fournisseur de thème déjà disponible dans le projet.
2. Appliquer la préférence admin à l’entrée dans `/admin` et le sombre partout
   ailleurs.
3. Définir une palette claire et limiter au sombre les règles qui forçaient le
   texte et les placeholders en blanc.
4. Ajouter un bouton soleil/lune accessible dans l’en-tête du back-office.
5. Adapter les rares badges et alertes écrits spécifiquement pour fond sombre.
6. Tester la mémorisation, le repli sombre et les écrans représentatifs.

## Vérification

- Bascule immédiate et préférence restaurée après rafraîchissement.
- Fond blanc et contraste lisible en mode clair.
- Expérience joueur toujours sombre.
- Formulaires, tableaux, graphiques, menus, notifications et fenêtres lisibles
  dans les deux modes.
- Aucun changement de données, d’accès ou de logique métier.