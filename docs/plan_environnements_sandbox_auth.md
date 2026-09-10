# Plan — environnements de réglages, authentification et traçage

## Objectif

Livrer la version 0.26.0 avec un contexte `prod` immuable pour les visiteurs
publics et trois contextes sandbox sélectionnables par les membres authentifiés,
sans ajouter d'appel réseau dans le pipeline voix après le bootstrap.

## Extension — invitations externes uniques pour les sandboxes

Permettre à Benoît, Romed et Ulrich de créer depuis « Mon compte » une
invitation nominative donnant à un testeur externe un accès temporaire aux
réglages de la sandbox active, sans jamais accepter un environnement provenant
directement de l'URL.

- L'invitation appartient à son créateur, cible uniquement une sandbox et
  expire après 7 jours si elle n'est pas utilisée.
- Le lien contient un identifiant opaque et le mot de passe est transmis
  séparément. Le mot de passe aléatoire est affiché une seule fois et seule son
  empreinte est conservée.
- La première validation lie l'invitation à une identité Auth anonyme unique.
  Cette identité peut lancer plusieurs sessions pendant 4 heures ; un autre
  navigateur ne peut pas réutiliser le mot de passe.
- Les lectures sandbox sont autorisées par RLS uniquement pour cette identité
  et conservent le repli sandbox → Production. Une révocation empêche toute
  nouvelle session sans interrompre une session déjà créée.
- Chaque session externe porte `context_type = user_test`, l'invitation et le
  libellé du testeur ; `started_by_user_id` est imposé côté serveur avec le
  compte qui a créé l'invitation.
- « Tester moi-même » conserve le parcours actuel. « Inviter un testeur » ouvre
  la gestion des invitations créées par le compte connecté.

### Mise en œuvre retenue

1. Ajouter une migration Lovable Cloud additive pour les invitations, les
   grants temporaires, le lien de session, le rate limiting et les politiques
   RLS de lecture runtime.
2. Ajouter les Edge Functions `manage-test-invitations` (list/create/revoke,
   admin) et `redeem-test-invitation` (status/redeem, identité anonyme).
3. Ajouter `/test/:invitationId`, configurer le runtime uniquement depuis le
   contexte signé renvoyé par la fonction, puis laisser la base imposer à
   nouveau cette attribution lors de l'insertion de session.
4. Ajouter l'onglet « Invitations de test », les deux actions distinctes et les
   informations d'invitation dans l'historique de sessions et PostHog.
5. Couvrir l'activation unique, la fenêtre de 4 heures, l'expiration, la
   révocation, l'isolation RLS et la non-régression Production par des tests
   unitaires, d'intégration et Playwright.

## Périmètre d'implémentation

1. Ajouter une migration Lovable Cloud additive et idempotente pour les quatre
   environnements, les membres admin, le contexte des réglages et l'attribution
   des sessions. Conserver les droits d'écriture nécessaires au parcours public
   existant et documenter la migration inverse.
2. Centraliser la résolution du contexte et le stockage local sous la forme
   `ava:<env>:<clé>`, avec la chaîne sandbox → prod → valeur codée en dur.
3. Remplacer la vérification `user_roles` du back-office par `admin_users`, puis
   exposer le membre et l'environnement actif à tous les écrans admin.
4. Ajouter le sélecteur persistant, l'indicateur visuel de contexte et l'action
   « Tester l'expérience », puis recharger les réglages au changement de contexte.
5. Ajouter le portail public et la fonction Lovable Cloud
   `verify-public-access`; ignorer `?env=` pour tout utilisateur non membre.
6. Dériver et enregistrer `environment_id`, `context_type`, `campaign_id` et
   `started_by_user_id` à la création de session, puis enrichir PostHog de ces
   propriétés de contexte.
7. Ajouter les filtres et l'attribution aux vues de sessions, exclure les
   sandboxes par défaut des vues analytiques, et fournir un onglet Alertes fondé
   sur les signaux existants.
8. Ajouter les tests unitaires demandés, mettre à jour les types et la version,
   puis exécuter tests, lint ciblé et build.

## Audit de non-régression des lectures de réglages

- `settingsService.ts` : les réglages LLM, TTS, gameplay, vidéo, GM, prompt Max,
  RAG/validation lisent `admin_settings`; `prod` conserve les mêmes clés et les
  mêmes valeurs, seul le stockage navigateur est migré vers un préfixe explicite.
- `services/stt/settings.ts` et `services/stt/providerSettings.ts` : même
  résolution, avec cache invalidé au changement d'environnement.
- `services/tts/providerSettings.ts` et `services/streamingAvatar/settings.ts` :
  même résolution et mêmes valeurs de repli.
- `services/characterPromptService.ts` : le prompt éditorial effectif de Max et
  des personnages suit le même fallback sandbox → prod; la synchronisation
  Notion continue d'alimenter uniquement la référence prod.
- `services/experienceOrchestration.ts` : les profils runtime personnage
  (activation, ouverture, provider et voix TTS) ainsi que les versions GM sont
  isolés par environnement, avec copie initiale des profils prod.
- Les composants admin qui écrivaient directement dans `localStorage` passent
  par l'utilitaire de clé contextualisée.
- Le runtime public résout toujours `prod`; une sandbox ne peut être choisie que
  si le compte courant existe dans `admin_users`.
- Les réglages restent chargés une fois au bootstrap et lus synchroniquement
  pendant les tours voix.

## Validation Lovable

La migration et la nouvelle Edge Function sont destinées exclusivement au projet
Lovable Cloud lié à ce dépôt. Après le squash merge sur `main`, la création
manuelle des quatre comptes, la désactivation du sign-up public, l'application
de la migration, la publication de la fonction et la checklist d'acceptation
doivent être effectuées dans la preview Lovable avant toute publication.

### État Lovable Cloud — 2026-08-21 (préparation v0.26.0, non publiée)

- Migration `20260821120000_settings_environments_admin_users.sql` : appliquée.
- 4 environnements créés (`prod`, `sandbox-ulrich`, `sandbox-romed`, `sandbox-benoit`),
  13 réglages historiques conservés en `prod`, 87 sessions historiques en `prod`,
  4 profils personnages par environnement, 1 version GM publiée par environnement.
- Edge Functions publiées : `verify-public-access`, `posthog-latency-stats`,
  `streaming-avatar-session`, `sync-notion`.
- Auth : inscription publique désactivée, authentification anonyme conservée.
- Restant à faire par l'équipe : créer les comptes `info@memoways.com` et
  `benoitperrincreate@gmail.com` (mots de passe définis dans l'interface Auth),
  puis enregistrer le mot de passe public prod depuis Admin → Technique.

### Ordre d'activation dans Lovable Cloud

1. Créer manuellement les quatre comptes Auth avec les adresses prévues dans la
   spécification, puis désactiver le sign-up public dans les réglages Auth.
2. Appliquer `20260821120000_settings_environments_admin_users.sql`. Le trigger
   rattache aussi automatiquement un compte autorisé créé après la migration.
3. Publier `verify-public-access` depuis Lovable Cloud, sans ajouter de secret :
   la fonction utilise les variables Supabase déjà fournies par Lovable.
4. Depuis Admin → Technique en contexte Production, enregistrer le premier mot
   de passe public. Seule son empreinte SHA-256 est stockée.
5. Exécuter les dix scénarios d'acceptation sur la preview Lovable, sur mobile et
   desktop, puis vérifier les deux domaines de production avant publication.

### Résultats automatisés locaux

#### Extension invitations externes — 2026-09-10

- Implémentation locale terminée : migration additive, deux Edge Functions,
  barrière `/test/:invitationId`, gestion dans « Mon compte », traçage des
  sessions et enrichissement PostHog.
- `npm test` : 75 fichiers et 320 tests réussis.
- Tests d'intégration migration/RLS : 16 scénarios réussis, migration et
  activation unique rejouées sur une base PostgreSQL de test.
- Playwright ciblé `public-surface.spec.ts` : 3 scénarios Chromium réussis,
  dont activation et reprise après rechargement.
- `npm run typecheck`, build, contrôle syntaxique des Edge Functions, ESLint
  ciblé et `git diff --check` : réussis.
- Le lint global reste bloqué uniquement par l'erreur historique
  `previewAuthStorage.ts:38` (`prefer-const`), hors fichiers modifiés.
- État de livraison : code local uniquement. La migration et les Edge
  Functions ne sont pas encore appliquées ou publiées dans la preview Lovable.

#### Activation de l'extension dans Lovable Preview

1. Appliquer `20260910121943_external_test_invitations.sql` dans le projet
   Lovable Cloud lié à ce dépôt.
2. Publier `manage-test-invitations` et `redeem-test-invitation` depuis la
   chaîne Lovable, sans ajouter de secret externe.
3. Exécuter les contrôles de sécurité de la base après migration, puis créer
   une invitation depuis le compte Benoît et l'activer dans une fenêtre privée.
4. Vérifier dans l'historique que le testeur, la sandbox et Benoît sont bien
   attribués avant toute publication Production.

- `npm test` : 64 fichiers, 263 tests réussis, dont migration rejouée deux fois
  et tests RLS existants.
- `npm run build` : réussi avec Vite 5.4.19.
- `npm run test:e2e` : 11 scénarios Playwright réussis sur Chromium, Firefox et
  WebKit; le fixture reproduit le portail public déverrouillé, le contexte prod,
  un compte membre autorisé et une orchestration publiée.
- ESLint ciblé sur les nouveaux fichiers et les modules runtime refactorisés :
  aucune erreur ni avertissement.
- `npm run lint` global : reste rouge sur des erreurs historiques hors périmètre
  dans des fichiers non modifiés; aucune nouvelle utilisation de `any` n'est
  introduite par cette version.
- `git diff --check` : réussi.

### Checklist manuelle Lovable Preview — à valider avant fusion

- [ ] Visiteur anonyme : portail, bon mot de passe, session `public` en `prod`.
- [ ] Lien campagne : campagne conservée et session `user_test` attribuée.
- [ ] Membre connecté : portail contourné et accès admin nominatif.
- [ ] Changement du mot de passe prod : effet immédiat dans un nouvel onglet.
- [ ] `?env=sandbox-benoit` anonyme : ignoré et runtime `prod`.
- [ ] Modification TTS sandbox : aucune mutation de la ligne prod.
- [ ] Chaque membre peut modifier chaque contexte, production comprise.
- [ ] Action Tester : sandbox et compte visibles dans l'historique.
- [ ] Filtres sessions et toggles analytics : sandbox exclue par défaut.
- [ ] PRD4 voix, PostHog et latence : comportement prod inchangé après portail.

## Retour arrière

Voir `docs/down_migration_environnements_sandbox_auth.sql`. Le retour arrière
archive d'abord les lignes non-prod et retire uniquement les objets ajoutés par
cette version; aucune donnée prod n'est supprimée silencieusement.
