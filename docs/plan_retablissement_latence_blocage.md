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

## Extension — personnages, historique complet et fidélité des graphiques

Demande du 15 octobre : personnages réellement rencontrés dans les métadonnées
et les titres, changements de personnage visibles, filtres extensibles ; vérifier
les sessions manquantes et les représentations graphiques.

Constats Cloud en lecture seule : 111 sessions présentes au moment du contrôle,
99 avec timings ; historique depuis le 8 mars. Les 50 plus récentes s'arrêtent
au 17 juillet. Les deux lecteurs (`Admin`, `LatencyBlockingTab`) imposent 50.
676 réponses avec pipeline, dont 102 avec origine explicite du total, 94 avec
premier son mesuré et 8 sans premier son mesuré. Aucun parcours multipersonnage
dans les données actuellement conservées ; ce cas doit être vérifié par fixtures.

Plan :
1. Produire les métadonnées structurées `character_keys`, `character_sequence`
   et `character_switch_count` depuis `conversation_log` déjà persisté.
   Réutiliser le registre pour les noms et compléter les options avec les clés
   observées, sans limiter le filtre à Max/Emma. Une sélection sans conversation
   reste distincte d'un échange réel. Aucun backfill ni écriture côté joueur.
2. Partager un lecteur admin paginé par curseur `id`, sans plafond arbitraire,
   tri chronologique après lecture ; annulation au changement de vue et erreur
   explicite si une page échoue. La pagination par curseur évite les décalages
   d'offset lors des suppressions. Chargement uniquement dans le back-office.
3. Conserver les totaux et leur origine dans les agrégats et les détails ;
   distinguer mesures et cumuls historiques estimés, ne pas afficher un son non
   mesuré comme 0 ms. Séparer cumul des services et attente observée (les spans
   se chevauchent). Pourcentages normalisés sur le cumul des services.
4. Ne pas attribuer aux tours historiques la configuration actuelle quand leurs
   métadonnées manquent. Ne pas relier les trous de couverture dans les courbes,
   utiliser des segments linéaires et afficher date/nom de session au survol.
   Distinguer étape dominante et dépassement du budget indicatif.
5. Tests de non-régression : plus de 50/100 sessions, erreurs d'une page,
   annulation, sessions mixtes et futurs personnages, calculs pondérés par tour,
   totaux mesurés/non mesurés et fidélité des barres/courbes. Typage/lint, puis
   synchronisation et contrôle visuel Lovable. Aucun changement de conversation,
   STT/TTS, capture, orchestration, schéma ou fonction Cloud. Publication en attente.

Implémentation et vérifications locales :
- Lecteur partagé `adminSessionHistory.ts` : pages de 100 par curseur UUID,
  tri final par date, métadonnées `character_metadata` structurées produites à
  la lecture depuis les messages persistés. Aucune colonne dupliquée, migration,
  écriture ou modification du parcours joueur. Anciennes sessions prises en charge.
- Titres et détails : participants, ordre des échanges et nombre de changements ;
  noms manuels conservés. Options issues du registre et des personnages observés.
  Un filtre personnage isole ses tours dans une conversation mixte.
- Les totaux observés sont conservés dans les moyennes, maximums et détails.
  Percentiles par origine de mesure ; cumuls legacy séparés des mesures.
  Barres dimensionnées sur le cumul des services, marqueur d'attente distinct,
  pourcentages normalisés et trous des courbes non interpolés. Configuration
  actuelle jamais attribuée à des métadonnées historiques absentes.
- « Blocage » de l'ancien écran désignait toute étape dominante, même rapide.
  Les badges et filtres parlent désormais de dépassements des budgets indicatifs,
  avec choix du dépassement relatif le plus important ; aucun diagnostic causal
  de blocage n'est inventé à partir de la seule durée d'un segment.
- Avant correction : tests composant rouges sur la 51e session et le total
  observé de 1 850 ms remplacé par le cumul de services chevauchants.
- Après correction : **117 fichiers / 603 tests unitaires réussis**, typage et
  ESLint ciblé sans erreur, `git diff --check` propre. Compilation locale de
  compatibilité avec la configuration Lovable : `npm run build`, exit 0,
  12,84 s. Ce build local n'est pas un déploiement.
- Les fixtures couvrent Max → Emma → Max, un futur personnage, l'isolation des
  tours Emma, les 205 sessions paginées, une suppression entre pages, une erreur
  de page et l'annulation. Aucun scénario synthétique injecté en base.
- Révision `a93ef8f3db7d45005a932a3aa40a3b4dab41338c` poussée sur main
  et synchronisée dans Lovable. Preview authentifiée Ulrich contrôlée :
  **111 sessions chargées / 99 sessions avec timings** ; filtre Emma :
  **13 sessions**, comparaison des 8 sélectionnées sur **55 tours**.
  Options Max/Emma/Ava/Léo visibles ; titres Max et Emma dans la liste et les
  graphiques. Données → Sessions affiche **111/111**, et les métadonnées
  « Personnages rencontrés / Parcours / Changements » sont visibles dans le détail.
- Contrôle visuel : barres de service distinctes du marqueur d'attente,
  couverture indiquée (Emma sélectionnée : 51/55 débuts de lecture mesurés),
  percentiles séparés entre transcription finalisée et fin PTT.
- Ajustements de présentation après contrôle : titres longs contenus dans la
  colonne, graduations espacées lorsque de nombreuses sessions sont sélectionnées,
  tableaux de courbes défilables, titre de détail cohérent avec le nom automatique.
  Après ajustements : 15 tests ciblés, typage et lint ciblé réussis.
- Aucun échange réel multipersonnage n'étant conservé, validation de cette branche
  par fixtures uniquement. Pas de publication de production ; l'accord explicite
  demandé précédemment reste nécessaire.
