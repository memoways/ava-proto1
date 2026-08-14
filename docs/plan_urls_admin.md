# Plan — URL propres pour le back-office

## Objectif

Donner à chaque vue du back-office une URL canonique, lisible et partageable,
sans modifier son comportement métier. Le détail d'une session doit également
être ouvrable directement par URL.

## Format retenu

- Une page admin suit la forme `/admin/<rubrique>/<page>`.
- Une session suit la forme `/admin/donnees/sessions/<id-session>`.
- Les filtres secondaires des outils de diagnostic restent en query string
  (`session`, `turn`, etc.), car ils ne représentent pas une page différente.
- Les anciens liens `/admin?tab=<id>` restent acceptés et sont remplacés par
  leur URL canonique, en conservant leurs autres paramètres.

## Mise en œuvre

1. Centraliser la correspondance entre identifiants internes, rubriques et
   chemins lisibles dans le service de navigation admin.
2. Faire dériver l'onglet actif du chemin courant et naviguer avec l'historique
   du navigateur lors d'un changement de rubrique ou de page.
3. Ajouter le segment de session au chemin et synchroniser la sélection de la
   liste avec cette URL, y compris après rechargement ou accès direct.
4. Convertir les liens internes du back-office vers les nouveaux chemins et
   conserver la compatibilité des anciens liens à query string.
5. Couvrir les correspondances, la résolution des chemins, la compatibilité
   legacy et les URL de session par des tests unitaires, puis lancer les tests,
   le lint et le build Lovable-compatible.

## Hors périmètre

- Aucun changement de base de données, migration, Edge Function ou secret.
- Aucun changement de plateforme de build ou de publication : Lovable reste
  l'unique chaîne de livraison.
