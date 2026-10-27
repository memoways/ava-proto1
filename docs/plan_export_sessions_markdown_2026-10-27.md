# Export Markdown des sessions — 27 octobre 2026

## Objectif
Depuis Données → Sessions, exporter une ou plusieurs sessions cochées dans un seul
document Markdown : contexte en tête de chaque session, statistiques de latence,
incidents connus, puis échanges chronologiques utilisateur/personnage.

## Mise en œuvre
- Ajouter une action à côté de la suppression, sans modifier cette dernière.
- Relire les sessions sélectionnées et leur télémétrie avec les droits admin existants.
- Préserver les textes et les personnages enregistrés, sans reconstruction par IA.
- Calculer les moyennes uniquement sur des mesures numériques disponibles ; indiquer
  les unités et le nombre d'échantillons, distinguer les métriques sans les additionner.
- Inclure les métadonnées historiques dans des annexes JSON, pas les réglages actuels.
- Signaler les blocages, erreurs, replis et diagnostics incomplets sans inventer leur cause.
- Préparer le fichier puis proposer son téléchargement, compatible avec l'activation
  utilisateur des navigateurs tactiles. Aucun fichier n'est envoyé à un service externe.

## Risques et invariants
Une absence de télémétrie ne prouve pas l'absence de problème. Les erreurs de lecture
doivent apparaître dans le rapport. Ne pas toucher aux voix, tours, réglages, invitations,
permissions, migrations ou à la production. Le document contient des données personnelles
et doit rester partagé volontairement par l'administrateur.

## Validation
Tests du calcul des moyennes, attribution Max/Emma et autres personnages, incidents,
sélection unique/multiple et absence de télémétrie. Vérification du téléchargement
depuis l'écran admin avec sessions réelles quand une session autorisée est disponible.
La livraison GitHub et la publication restent distinctes de la validation locale.