# Rétablir les visualisations Latence et blocage

Date : 15 octobre 2026. Base : `1b2f709`, `main`.

## Objectif et contraintes

Afficher les mesures récentes dans Qualité → Latence et blocage sans modifier
la conversation, le STT, le TTS, les interruptions, les prompts ou la collecte.
La correction reste dans la vue administrateur, sur les données déjà persistées.
Aucune requête, attente, migration ou nouvelle instrumentation côté joueur.

## Diagnostic vérifié

Cible : Lovable « AVA Prototype 1 », `1265958d-b74e-40f2-917d-182fe05163fc`,
Cloud Supabase `iralfqlslqndgvexixis`. Lecture par le connecteur natif Lovable.

Le SQL reproduisant la requête de l'écran (50 sessions hors sandbox) retourne
376 tours avec `pipeline`, dernière session le 16 septembre à 12:31:46 UTC,
aucun tour récent. Le filtre `context_type <> sandbox` est présent depuis
`146cda9` du 21 août ; il n'a pas été introduit le 16 septembre.

La session du 16 septembre est `user_test` ; les conversations suivantes sont
`sandbox`. Les journaux contiennent 58 tours mesurés après le 16 septembre
(55 sandbox-ulrich et 3 sandbox-benoit), jusqu'au 14 octobre à 14:07:58 UTC.
Les 50 sessions les plus récentes, sandboxes incluses, contiennent 53 tours
mesurés dans 23 sessions, tous postérieurs au 16 septembre. Le plafond de
50 sessions ne cause donc pas l'absence des données récentes ; il borne
l'historique disponible dans cette vue et doit être explicite.

Les tables audio_latencies et voice_turn_events ont également des enregistrements
du 14 octobre. La table legacy turn_latencies s'arrête au 22 mai : elle n'est
pas la source de cet écran. Ne pas réactiver sa collecte pour traiter ce défaut.
Les mesures absentes ne seront ni reconstituées artificiellement ni mises à zéro.

## Plan d'exécution

1. Couvrir le défaut par un test de composant : une session sandbox du 14 octobre
   doit alimenter les graphiques dès l'ouverture, avec l'ancien historique disponible
   lorsque les sandboxes sont exclues explicitement.
2. Inclure les sandboxes par défaut, afficher le périmètre et les environnements,
   garder le filtre d'exclusion volontaire. Réinitialiser la sélection au changement
   de périmètre pour que les graphiques soient alimentés dans les deux cas.
3. Vérifier les tests de la vue, les calculs de segments et le typage. Synchroniser
   le commit sur main dans Lovable, compiler et vérifier visuellement les mesures
   existantes avant publication via Lovable uniquement.

## Critères observables

- Ouverture de l'écran : sessions et visualisations du 14 octobre présentes.
- Exclusion volontaire des sandboxes : périmètre annoncé et historique visible.
- Mesures partielles toujours distinguées des zéros ; calculs existants conservés.
- Aucun fichier du chemin de conversation ni aucune fonction Cloud modifiés.

## Livraison et vérifications

- Correctif : `afd85e41d1538cf9f058d4473d8ec98735f6f740`, poussé sur
  `main` de `memoways/ava-proto1` avec la GitHub App du dépôt ; synchronisation
  de cette révision confirmée par le connecteur Lovable.
- Test avant correction : 2 échecs, la session sandbox du 14 octobre est absente.
- Après correction : 16 tests réussis (vue, segments et métadonnées),
  TypeScript sans erreur, ESLint ciblé et `git diff --check` sans erreur.
- Preview Lovable authentifiée Ulrich : 23 sessions mesurées disponibles,
  sélection automatique de 8 sessions / 15 tours, barres de latence affichées
  pour le 14 octobre. Capture visuelle du rendu vérifiée.
- Aller-retour du filtre vérifié : hors sandbox, sélection automatique de
  8 sessions / 38 tours, historique du 16 septembre ; retour sandbox inclus,
  8 sessions / 15 tours récents. L'ancien écran restait à 0 sélection au
  changement de périmètre ; le correctif rétablit aussi cette sélection.
- Une requête sessions bornée comme avant, un champ environnement ajouté à
  la projection existante. Aucun polling, écriture de données ou instrumentation
  supplémentaire. Le seul fichier runtime modifié est le composant administrateur.
- Compilation Lovable : `bun run build`, exit 0, 20,7 s sur `afd85e4` ;
  `tsgo`, typecheck et les 16 tests ciblés également réussis dans Lovable.
  Bundle JS `index-BjHCv81Y.js`, SHA256
  `76e3c10c0d1ddc5fe0b669041f75efe239e86c2ba9bb20c2fbe8e64d564ad080`.
- Écart d'exécution Lovable : après avoir confirmé ces contrôles, son agent a
  modifié trois fonctions Cloud hors lot et `deno.lock`, malgré l'interdiction
  explicite (`c772ebd`). Ces ajouts sont retirés avant publication en restaurant
  exactement les quatre fichiers de `afd85e4`. Les erreurs Deno historiques
  de ces fonctions restent un lot séparé ; ne pas les déployer pour cette vue.
- Comparaisons par segment/service et courbes temporelles contrôlées visuellement
  en preview sur les mesures existantes.
- Restauration : `51afe887e5ca0bf85ee045b6efe517c5634d7d20`, poussée sur
  main et synchronisée dans Lovable. Diff final depuis `1b2f709` : uniquement
  `LatencyBlockingTab.tsx`, son test et ce plan. Aucune différence Cloud ni lockfile.
- Publication tentée par le connecteur Lovable : refusée par le contrôle
  automatique d'autorisation, qui exige un accord humain explicite pour la
  publication en production. Aucun contournement et aucun déploiement effectué.
- Local et GitHub : correction terminée et poussée sur main. Preview Lovable :
  graphiques et filtres vérifiés. Production : inchangée, contrôle du correctif
  impossible avant publication. Reste : accord explicite, publication native
  Lovable, puis contrôle de la page publiée.

## Où voir le résultat

- [Preview — Qualité / Latence et blocage](https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/admin/qualite/latence-et-blocages)
- [Projet Lovable](https://lovable.dev/projects/1265958d-b74e-40f2-917d-182fe05163fc)
- [Code sur main](https://github.com/memoways/ava-proto1/commit/51afe887e5ca0bf85ee045b6efe517c5634d7d20)

Référence API consultée : [Supabase JavaScript select/range](https://supabase.com/docs/reference/javascript/range).
Changelog officiel du 15 octobre consulté ; les changements PostgreSQL et
middleware signalés ne concernent pas le filtre de lecture existant.

## Complément — noms des sessions, 15 octobre 2026

Demande : reprendre dans la liste le titre déjà utilisé par Données → Sessions,
par exemple « Ulrich · 14.10.26 16:07 · test court (1 tours), fin … ».

Plan : réutiliser `autoSessionTitle` de `admin/sessionTitle.ts` lorsque `name`
est vide ; conserver en priorité les noms manuels. Ajouter à la projection
sessions existante les métadonnées requises (durée, invitation, libellé testeur).
Le libellé commun de cette vue alimente également les graphiques et les détails.
Afficher le titre complet au survol. Aucun nouveau calcul ni réseau côté joueur.
Vérifier le cas sans nom et la conservation des noms manuels, puis pousser main
et confirmer la synchronisation Lovable. Publication toujours en attente d'accord.

Réalisé : fonction partagée réutilisée, noms manuels prioritaires, titre complet
au survol. Vérifications : 5 tests ciblés réussis (vue et helper des titres),
typecheck, ESLint ciblé et `git diff --check` sans erreur. Changement limité à
l'affichage administrateur et aux champs de sa requête existante.
