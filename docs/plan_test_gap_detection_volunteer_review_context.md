# Plan — couverture du retour au contexte bénévole

## Constat

L’onboarding bénévole récent ajoute depuis le sélecteur de personnage un lien
« Revoir le contexte ». Le rendu et l’action de ce lien ne figuraient dans
aucun test ciblé du sélecteur.

## Intervention minimale

Ajouter au test existant de `CharacterSelectScreen` un scénario qui fournit le
callback `onReviewContext`, active le lien, puis vérifie qu’il est appelé une
fois.

## Critère de vérification

Le test unitaire ciblé passe et protège le branchement de relecture sans
modifier la logique applicative.
