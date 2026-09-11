# Plan — portraits runtime dans l'expérience

## Objectif

Faire du portrait configuré dans **Admin → Expérience → Réglages personnages**
la source affichée par l'expérience PRD4, dans la production comme dans la
sandbox active. Un portrait intégré au bundle reste uniquement le repli quand
aucun portrait runtime n'est défini.

## Complément — sélection, sonnerie et clôture

La carte de sélection doit rester concise : les personnages disponibles
indiquent uniquement leur disponibilité, sans résumé de situation. La situation
reste affichée pendant la sonnerie, où elle donne le contexte utile avant la
conversation.

Le portrait reçu depuis le profil runtime doit aussi être passé directement à
l'écran de sonnerie. Celui-ci ne doit donc plus réafficher l'ancien asset
intégré lorsqu'un portrait a été uploadé dans le back-office.

Enfin, la clôture de session est indépendante du personnage avec qui la
conversation a eu lieu : elle indique seulement que la communication est
coupée et que cette version du prototype s'arrête ici.

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
4. Transmettre sans délai le portrait du profil sélectionné à l'écran de
   sonnerie, afin d'éviter tout retour à l'ancien portrait d'Emma.
5. Alléger les cartes de sélection et rendre la clôture de session neutre.
6. Ajouter des tests de régression qui vérifient l'affichage de l'URL runtime
   sur les écrans concernés, puis valider le typage et les tests ciblés.

## Critères de réception

- Après l'upload puis la sauvegarde d'Emma dans un environnement, son nouveau
  portrait apparaît dans la sélection, pendant la sonnerie et dans la
  conversation de cet environnement.
- Le portrait de production ne fuit pas vers une sandbox configurée, et les
  assets empaquetés servent de repli si aucune URL n'est encore configurée.
- Les cartes disponibles ne montrent pas de résumé de situation ; le contexte
  initial reste visible pendant la sonnerie.
- Aucun prénom n'est mentionné dans la conclusion de l'expérience.
