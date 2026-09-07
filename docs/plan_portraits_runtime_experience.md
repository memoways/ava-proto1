# Plan — portraits runtime dans l'expérience

## Objectif

Faire du portrait configuré dans **Admin → Expérience → Réglages personnages**
la source affichée par l'expérience PRD4, dans la production comme dans la
sandbox active. Un portrait intégré au bundle reste uniquement le repli quand
aucun portrait runtime n'est défini.

## Constats

- L'upload sauvegarde une URL signée dans `character_runtime_profiles.portrait_url`.
- La RPC de lecture de runtime ne retourne pas cette URL.
- Les écrans de sélection et de conversation importent actuellement des images
  statiques (`src/assets/characters/*.jpg`).

## Mise en œuvre

1. Ajouter `portrait_url` au contrat de lecture runtime SQL et TypeScript.
2. Charger le portrait runtime pour Max et Emma dans l'écran de sélection,
   avec les assets intégrés comme repli.
3. Transmettre le portrait effectivement lu vers l'écran de conversation,
   y compris après un transfert Max ↔ Emma et une reprise de session.
4. Ajouter des tests de régression qui vérifient l'affichage de l'URL runtime
   sur les deux écrans, puis valider le typage et les tests ciblés.

## Critères de réception

- Après l'upload puis la sauvegarde d'Emma dans un environnement, son nouveau
  portrait apparaît dans la sélection et dans la conversation de cet environnement.
- Le portrait de production ne fuit pas vers une sandbox configurée, et les
  assets empaquetés servent de repli si aucune URL n'est encore configurée.
