# Plan — Mode clair / sombre du back-office

## Conclusion de l’analyse

**Difficulté : faible à modérée.** C’est un chantier court et peu coûteux en tokens, mais pas un simple changement de couleur.

Estimation raisonnable :
- une intervention ciblée ;
- environ 4 à 6 fichiers principaux ;
- aucun changement de base de données ni de logique métier ;
- vérification visuelle nécessaire sur plusieurs pages du back-office.

Le coût reste bas car le back-office utilise déjà majoritairement les couleurs centralisées du design (`background`, `foreground`, `card`, `muted`, `border`, etc.) et la dépendance de gestion de thème est déjà installée.

## Ce que l’audit a confirmé

- Le back-office repose largement sur des composants partagés déjà compatibles avec des couleurs de thème : cartes, champs, boutons, onglets et menus.
- Le thème actuel ne définit que la palette sombre.
- Une règle globale force plusieurs catégories de texte et les placeholders en blanc pur. Elle empêcherait un vrai mode clair lisible et devra être limitée au mode sombre.
- Les exceptions de couleur directement écrites dans le back-office sont peu nombreuses. Elles concernent surtout des badges de statut, alertes et graphiques.
- Le système de notifications connaît déjà la notion de thème, mais le fournisseur de thème n’est pas encore installé autour de l’application.
- L’expérience joueur doit rester sombre en permanence ; la préférence clair/sombre ne doit s’appliquer qu’aux pages `/admin`.

## Expérience proposée

Ajouter en haut à droite du back-office un bouton compact avec icône soleil/lune et infobulle :

- **Sombre** : rendu actuel, inchangé.
- **Clair** : fond blanc, cartes légèrement contrastées, texte sombre, bordures visibles.
- Le choix est mémorisé dans ce navigateur.
- En revenant dans le back-office, le dernier choix est restauré.
- En quittant le back-office pour l’expérience joueur, le thème sombre est automatiquement rétabli.

Le choix sera strictement personnel et local au navigateur : il ne modifiera pas l’affichage des autres administrateurs.

## Mise en œuvre

1. **Installer le thème au niveau de l’application**
   - Activer le gestionnaire de thème déjà présent dans le projet.
   - Garder le sombre comme valeur sûre par défaut.
   - Éviter un flash clair au chargement.

2. **Isoler la préférence du back-office**
   - Lire et mémoriser une préférence dédiée au back-office.
   - Appliquer cette préférence uniquement pendant la navigation dans `/admin`.
   - Restaurer systématiquement le sombre dès que l’on revient à l’expérience joueur.

3. **Créer la palette claire**
   - Ajouter les valeurs claires des couleurs centralisées : fond blanc, surfaces gris très clair, texte presque noir, bordures et champs suffisamment visibles.
   - Conserver les couleurs fonctionnelles existantes : rouge principal, vert, orange, alertes et états.
   - Limiter au sombre les règles qui forcent actuellement les textes en blanc pur.

4. **Ajouter le bouton de bascule**
   - Le placer dans l’en-tête du back-office, à côté des commandes existantes.
   - Utiliser soleil/lune, libellé accessible et infobulle.
   - Assurer un affichage correct sur ordinateur et tablette.

5. **Corriger les rares exceptions**
   - Adapter les badges et alertes dont le texte est actuellement choisi uniquement pour un fond sombre.
   - Vérifier les graphiques, leurs axes, légendes et infobulles dans les deux modes.
   - Ne pas toucher aux couleurs techniques des séries de données si leur contraste reste suffisant.

6. **Tester et documenter**
   - Ajouter des tests pour la bascule, la mémorisation et le retour forcé au sombre côté joueur.
   - Contrôler visuellement les pages représentatives : accueil admin, formulaires de configuration, sessions, invitations, consommation et latence.
   - Vérifier les menus déroulants, fenêtres, notifications et états d’erreur, qui s’affichent parfois hors de la page principale.
   - Enregistrer ce plan dans `docs/plan_theme_clair_sombre_backoffice.md` au moment de l’implémentation, conformément aux règles du projet.

## Risques maîtrisés

- **Texte blanc sur fond blanc** : évité en corrigeant la règle globale de texte blanc.
- **Thème clair appliqué au jeu** : évité par un thème réservé aux pages d’administration et un retour automatique au sombre.
- **Menus ou notifications avec le mauvais thème** : vérifiés explicitement car ils sont affichés en dehors du contenu principal.
- **Graphiques peu lisibles** : validation ciblée des axes, légendes et infobulles.

## Hors périmètre

- Aucun changement visuel de l’expérience joueur.
- Aucune synchronisation du choix entre plusieurs appareils ou administrateurs.
- Aucun changement de données, d’accès ou de réglages du jeu.

## Critères de validation

- Le bouton permet de passer instantanément du sombre au clair et inversement.
- Le mode clair présente un fond blanc et tous les textes restent lisibles.
- Le choix persiste après rafraîchissement et nouvelle visite du back-office.
- L’expérience joueur reste toujours sombre.
- Les formulaires, tableaux, badges, graphiques, menus, notifications et fenêtres restent lisibles dans les deux modes.
- Aucun comportement métier du back-office n’est modifié.
