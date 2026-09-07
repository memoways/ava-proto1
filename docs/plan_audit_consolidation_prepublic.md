# Plan d'audit et de consolidation prepublic

Date : 4 septembre 2026
Cible : beta externe limitee
Plateforme de livraison : Lovable et Lovable Cloud exclusivement
Statut initial : `NO-GO`, release gate fermee

Statut courant : lot 1 implemente et valide localement, en attente des revues
et de la validation CI/preview Lovable ; release gate toujours fermee.

## Objectif

Etablir un verdict factuel sur la robustesse, la securite, la fiabilite et la
maintenabilite du projet, puis corriger les constats par petits lots approuves,
reversibles et valides sans regression sur une preview Lovable isolee.

Ce document coordonne le chantier global. Les constats de securite detailles
restent suivis dans [security_improvement_plan_2026-07-16.md](security_improvement_plan_2026-07-16.md)
et les conditions d'ouverture dans [public_release_gate.md](public_release_gate.md).

## Etat de reference

- Le build de production et le typecheck passent.
- La suite complete compte 74 fichiers et 313 tests verts au demarrage du chantier.
- ESLint echoue avec 57 erreurs et 8 avertissements.
- La commande `test:unit` ne selectionne pas correctement les tests attendus.
- La CI ne lance ni le lint ni un typecheck explicite.
- Le build signale des chunks volumineux : principal a 1,44 Mo minifie et Admin
  a 979 Ko.
- La validation E2E locale est bloquee dans le bac a sable Codex ; elle doit etre
  reproduite en CI et sur une preview Lovable.
- La release gate publique reste fermee.

## Ordre des lots

### Lot 1 - Garde-fous qualite

- Corriger les scripts de test et separer clairement tests unitaires,
  integration, regression et E2E.
- Ajouter un typecheck explicite et rendre lint, typecheck, suite complete,
  build et E2E bloquants dans la CI.
- Corriger les erreurs ESLint et reduire le bruit des tests qui masque les
  erreurs reelles, sans modifier le comportement utilisateur.
- Verifier le lot par installation reproductible, lint, typecheck, tests,
  build et E2E.

### Lot 2 - Correctifs de securite a faible risque

- Requalifier les dependances, imports Edge et actions CI obsoletes.
- Retirer ou proteger le debug de production et verifier l'hygiene des secrets.
- Durcir la validation des entrees et la gestion des erreurs sans changer les
  contrats metier.

### Lot 3 - Protection des donnees

- Auditer ensemble grants, RLS, vues et fonctions SQL sur l'etat reel Lovable.
- Fermer les acces publics injustifies et lier telemetrie/couts a leur
  proprietaire ou session.
- Ajouter une matrice de tests positive et negative pour cle publique seule,
  utilisateurs anonymes A/B, administrateur et `service_role`.

### Lot 4 - Frontiere reseau des Edge Functions

- Classifier chaque fonction comme publique, utilisateur, administrateur ou
  service-to-service.
- Activer une authentification fail-closed et `verify_jwt` fonction par
  fonction, avec canary et rollback.
- Centraliser CORS, limiter origines et tailles de payload, et conserver les
  quotas atomiques.

### Lot 5 - Confidentialite et durcissement navigateur

- Valider consentement micro/analytics, redaction, retention et purge.
- Verifier les headers sur l'URL servie et introduire la CSP en Report-Only
  avant toute mise en application.
- Executer les scans Basic et Deep de Lovable et fermer tous les constats
  critiques avant publication.

### Lot 6 - Optimisations mesurees

- Profiler bundle, chargement, memoire, requetes SQL/RAG et latences du pipeline
  voix avant de modifier le code.
- Charger a la demande les surfaces admin et SDK lourds, optimiser les medias
  et ne conserver que les changements dont le gain est mesure.
- Refuser toute optimisation qui degrade les parcours critiques ou les seuils
  de fiabilite.

## Methode obligatoire par lot

1. Atteindre au moins 90 % au Confidence Check et identifier la cause ou la
   mesure de reference.
2. Definir la couture publique testee et, pour un bug, obtenir un test capable
   de reproduire l'echec avant la correction.
3. Realiser un diff minimal, sans refactorisation opportuniste.
4. Executer lint, typecheck, tests unitaires/integration/regression, build et E2E.
5. Faire une revue Bugbot puis une revue securite des changements.
6. Valider sur une preview Lovable isolee, comparer avant/apres et preparer le
   rollback.
7. Demander l'approbation avant de commencer le lot suivant.

## Contrats qui ne doivent pas regresser

- Acces public et CAPTCHA.
- Creation, reprise, mise a jour et cloture d'une session proprietaire.
- Pipeline STT -> LLM -> RAG -> TTS et changement de personnage.
- Questionnaire et synchronisation attendue.
- Isolation et fonctions d'administration.
- Consentement, telemetrie et persistance.
- Gestion des timeouts, annulations, retries et fournisseurs indisponibles.

Les changements de consolidation ne doivent pas modifier les prompts, la duree
de session, le canon narratif, les voix actives ou les reglages de production.

## Criteres de sortie de la beta limitee

- Installation reproductible et toutes les gates CI vertes.
- Aucun constat critique Lovable ni P0/P1 non resolu ou formellement accepte.
- Aucune lecture/ecriture inter-utilisateur et aucun secret dans le client.
- Une session complete avec la configuration active, un smoke minimal par
  fournisseur configure, puis au moins cinq sessions et trente tours.
- P95 premier son <= 5 s, erreurs de tours <= 2 %, persistance >= 99,5 % et
  aucune croissance non bornee sur quinze minutes.
- Consentement, retention, headers, quotas, budget et rollback verifies.
- Ouverture explicite de la release gate par le responsable du projet.

## Contraintes d'execution

- Les migrations, Edge Functions, variables et publications passent uniquement
  par Lovable/Lovable Cloud.
- Les changements sont testes sur une branche/preview isolee ; la production
  reste en lecture seule jusqu'a la decision finale.
- Les secrets ne sont jamais copies dans les rapports ou sorties.
- Sans acces a Lovable Cloud et a l'URL servie, aucun verdict `GO` public ne peut
  etre emis.

## Suivi d'execution

### Lot 1 - Garde-fous qualite (4 septembre 2026)

Statut : `EN VALIDATION`.

Realise :

- ajout d'un script `typecheck` explicite ;
- correction de la selection `test:unit` sous zsh et ajout de
  `test:integration` ;
- extension de `test:quality` pour bloquer successivement sur lint, typecheck,
  regression, unitaires, integration et build ;
- maintien de Playwright comme etape bloquante de la CI apres `test:quality` ;
- ajout d'un mode preview explicite via `PLAYWRIGHT_BASE_URL`, sans serveur Vite
  local, avec refus des URL distantes non HTTPS ;
- ajout de deux smokes Chromium sur la barriere d'acces et la page de
  confidentialite, portant la matrice Playwright a 12 executions ;
- conservation des traces, captures et rapports d'echec CI dans un artefact
  prive limite a sept jours ;
- correction des 57 erreurs et 8 avertissements ESLint sans changement
  fonctionnel intentionnel ;
- typage des payloads et resultats manipules par les fonctions
  `sync-notion` et `sync-questionnaire`, sans migration ni publication ;
- suppression du bruit parasite des tests TTS, PostHog, React Router et React
  `act(...)` au niveau de leurs mocks et harness dedies, sans filtrage global des
  erreurs console.

Preuves locales apres installation propre :

- `npm ci` : succes, 544 paquets installes depuis le lockfile ;
- `npm run lint` : succes, zero erreur et zero avertissement ;
- `npm run typecheck` : succes ;
- `npm run test:regression` : 8 fichiers, 38 tests verts ;
- `npm run test:unit` : 72 fichiers, 298 tests verts ;
- `npm run test:integration` : 2 fichiers, 15 tests verts ;
- total de reference preserve : 74 fichiers et 313 tests verts ;
- `npm run build` : succes, avec l'avertissement de taille de chunks conserve
  pour mesure et traitement au lot 6.
- chargement de la configuration Playwright locale et preview : succes, 12
  executions detectees dans 2 fichiers ;
- garde `test:e2e:preview` sans URL : echec immediat attendu avant tout lancement
  de serveur, empechant une fausse validation Lovable.

Validation restante avant cloture du lot :

- `npm run test:e2e` ne peut pas demarrer son serveur local dans le bac a sable
  Codex (`listen EPERM 127.0.0.1:4173`) ; obtenir un run Playwright vert dans la
  CI puis sur une preview Lovable isolee avec la procedure decrite dans
  [lovable-playwright-validation.md](interfaces/lovable-playwright-validation.md) ;
- executer la revue Bugbot puis la revue securite du diff ;
- verifier dans Lovable que le build de preview utilise bien la meme commande et
  qu'aucune variable, migration ou Edge Function n'est publiee par ce lot ;
- ne commencer le lot 2 qu'apres approbation explicite.

Points reportes conformement au plan :

- donnees Browserslist agees et dependances depreciees signalees par `npm ci` :
  lot 2, apres analyse de compatibilite Lovable ;
- bundles `index` (1,44 Mo minifie) et `Admin` (979 Ko minifie) : lot 6, apres
  profilage ;
- audit de vulnerabilites des dependances : lot 2, le controle local initial
  n'ayant pas produit de resultat exploitable.
