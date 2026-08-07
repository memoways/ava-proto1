# Finalisation Lovable — Orchestration GM, PostHog et handoff Emma

> **Catégorie :** Interface externe et runbook d’activation
>
> **Services :** Lovable Cloud, Supabase fourni par Lovable, PostHog EU
>
> **Dernière mise à jour :** 7 août 2026
>
> **Statut :** Code prêt, activation Lovable Cloud à réaliser

## Objectif

Ce document explique comment finaliser dans Lovable la livraison décrite dans
[`../plan_assainissement_mecanique_orchestration_gm.md`](../plan_assainissement_mecanique_orchestration_gm.md) :

- nouvelle navigation Expérience / Qualité / Technique avancée ;
- orchestration GM versionnée ;
- cinématiques recommandées par le directeur ;
- handoff Max→Emma ;
- mémoire inter-personnages V2 ;
- vraie vue Latences PostHog ;
- comparaison avec la télémétrie interne et canary multi-source.

Le code est déjà implémenté et validé localement. Ce runbook ne demande pas à
Lovable de réinventer l’architecture : il lui demande de synchroniser `main`,
d’appliquer les fondations Cloud préparées, de configurer les secrets et
d’exécuter une recette avec preuves.

## Contraintes absolues

- Lovable est l’unique chaîne de compilation, backend, migrations, Edge
  Functions, secrets et publication.
- Ne créer aucun projet Supabase externe et ne déployer ni sur Vercel, ni sur
  Netlify, ni sur une autre plateforme.
- Ne supprimer aucune table, colonne, migration, session ou télémétrie
  historique pendant cette activation.
- Ne modifier ni masquer les huit pages Technique avancée.
- Ne toucher ni à Streaming Avatar Config, ni à Consommation Streaming Avatar,
  ni au switch Voix TTS / Avatar vidéo.
- Ne supprimer Validateur/Métriques hallu. qu’après 14 jours d’observation et une
  nouvelle décision explicite.
- Ne publier en Production qu’après approbation explicite d’Ulrich.
- Ne jamais coller une clé PostHog dans le chat Lovable, Git, une capture, un log
  ou une variable `VITE_*`.

## Références officielles

- [Lovable Cloud : base, migrations, Edge Functions, secrets et logs](https://docs.lovable.dev/integrations/cloud)
- [Synchronisation GitHub/Lovable sur la branche par défaut](https://docs.lovable.dev/integrations/github)
- [Sécurité des secrets Lovable](https://docs.lovable.dev/features/security)
- [Clés API personnelles PostHog](https://posthog.com/docs/api/personal-api-keys)
- [API Query PostHog et permission Query Read](https://posthog.com/docs/api/queries)
- [Schéma officiel de l’API PostHog EU](https://eu.posthog.com/api/schema/swagger-ui/)

PostHog indique qu’une clé personnelle peut donner un accès large : créer une
clé dédiée au projet, limitée au projet AVA et à la permission **Query Read**.
Elle doit rester côté serveur. L’endpoint utilisé est
`POST /api/projects/{project_id}/query/` avec une `HogQLQuery`.

## Préparation

Avant d’ouvrir Lovable, réunir :

- un compte administrateur de l’application AVA ;
- un compte propriétaire/administrateur du projet Lovable ;
- un compte PostHog pouvant créer une clé personnelle limitée au projet ;
- l’identifiant numérique du projet PostHog ;
- l’identifiant interne `characters.id` d’Emma ; ce n’est pas l’identifiant brut
  de sa page Notion ;
- le provider TTS actif et le Voice ID d’Emma ;
- une URL de portrait utilisable ;
- une phrase d’ouverture validée ;
- un corpus RAG Emma synchronisé et non vide.

Créer un tableau de preuves avant la recette :

| Élément | Preuve attendue |
|---|---|
| Commit synchronisé | SHA de `main` affiché par Lovable/GitHub |
| Migration | nom et résultat d’application |
| Edge Function | version/déploiement et log d’un appel réussi |
| Secrets | noms présents, jamais leurs valeurs |
| Session Max | identifiant de session |
| Session vidéo | session, tour et vidéo |
| Handoff accepté | session et événement `handoff_executed` |
| Handoff refusé | session et événement `handoff_refused` |
| Reprise | session reprise et temps avant/après |
| PostHog | période, fraîcheur, nombre de tours et parité `turn_id` |

## Tutoriel pas à pas

### 1. Synchroniser Lovable avec GitHub `main`

1. Ouvrir le projet AVA dans Lovable.
2. Vérifier que le connecteur GitHub pointe vers
   `memoways/ava-proto1` et que la branche par défaut est `main`.
3. Attendre la synchronisation du dernier commit de `main`.
4. Dans le code Lovable, vérifier la présence de :
   - `docs/plan_assainissement_mecanique_orchestration_gm.md` ;
   - `supabase/migrations/20260807120000_experience_orchestration_foundations.sql` ;
   - `supabase/functions/posthog-latency-stats/index.ts` ;
   - `src/services/experienceDirector.ts` ;
   - `src/services/experienceOrchestration.ts` ;
   - `src/services/posthogLatencyStats.ts`.
5. Si Lovable propose de réécrire ces fichiers, refuser tant qu’aucune erreur
   reproductible n’a été identifiée.

### 2. Capturer la baseline Lovable Cloud

Dans le Cloud Lovable, demander une lecture seule avant toute mutation :

- migrations déjà appliquées ;
- colonnes actuelles de `sessions` ;
- tables d’orchestration éventuellement déjà présentes ;
- politiques RLS de `sessions`, `experience_events` et `user_roles` ;
- Edge Functions déployées et erreurs récentes ;
- valeurs actives des réglages de sortie voix/avatar, sans les modifier ;
- nombre de sessions et de tours sur les dernières 24 heures et 7 jours.

Enregistrer cette baseline dans le compte rendu Lovable. Si un objet du même nom
existe avec une structure différente, arrêter l’application de la migration et
faire un diff : ne jamais écraser l’objet existant à l’aveugle.

### 3. Appliquer la migration additive

Faire appliquer, exclusivement par **Lovable Cloud → Modify database**, la
migration :

```text
supabase/migrations/20260807120000_experience_orchestration_foundations.sql
```

La migration doit créer ou compléter :

- `experience_orchestration_versions` ;
- `character_runtime_profiles` ;
- `experience_events` ;
- `admin_legacy_access_log` ;
- `sessions.orchestration_version_id` ;
- `sessions.active_character` ;
- `sessions.pending_handoff` ;
- `sessions.handoff_count` ;
- le défaut V2 de `sessions.conversation_memory` ;
- les RPC d’épinglage, publication et readiness.

Contrôles obligatoires après application :

- une seule version GM a le statut `published` ;
- la baseline `builtin://experience-director/v1` existe ;
- les profils Max et Emma existent, Emma restant désactivée ;
- `experience_events` refuse `UPDATE` et `DELETE` ;
- un joueur ne peut insérer un événement que pour sa propre session ;
- seul un admin gère les versions et les profils ;
- l’épinglage ne change pas la version d’une session déjà démarrée ;
- les sessions historiques sont lisibles sans conversion destructive de leur
  mémoire.

Après migration, laisser Lovable régénérer les types Supabase. Ne remplacer les
casts temporaires du code que si Lovable produit un diff strictement mécanique
et que le build reste vert.

### 4. Créer la clé PostHog dédiée

Dans PostHog :

1. Ouvrir les paramètres personnels, section **Personal API keys**.
2. Créer une clé nommée par exemple `AVA Lovable latency read`.
3. Limiter l’accès au projet AVA.
4. Accorder uniquement la permission **Query Read**.
5. Copier la valeur immédiatement dans un gestionnaire de mots de passe ;
   PostHog ne la réaffichera pas.
6. Relever dans les paramètres du projet son identifiant numérique.

Ne pas réutiliser la clé publique `phc_*` du SDK navigateur : elle sert à
l’ingestion et n’autorise pas l’API privée de requêtes.

### 5. Ajouter les secrets dans Lovable Cloud

Dans **Lovable Cloud → Secrets**, ajouter :

```text
POSTHOG_PERSONAL_API_KEY=<clé personnelle Query Read>
POSTHOG_PROJECT_ID=<identifiant numérique du projet>
POSTHOG_API_HOST=https://eu.posthog.com
```

Points de contrôle :

- aucune variable ne commence par `VITE_` ;
- aucune valeur n’apparaît dans Git ou le frontend compilé ;
- le host d’API est `eu.posthog.com`, pas le host d’ingestion
  `eu.i.posthog.com` ;
- les logs ne contiennent ni la clé ni l’en-tête `Authorization`.

### 6. Déployer et sécuriser l’Edge Function

Déployer depuis Lovable Cloud :

```text
supabase/functions/posthog-latency-stats/index.ts
```

`verify_jwt=false` dans `supabase/config.toml` est intentionnel : la fonction
appelle elle-même `requireAdmin`, vérifie le JWT Supabase puis le rôle admin. Ne
pas retirer ce contrôle et ne pas remplacer la fonction par un proxy public.

Tester trois accès :

| Appel | Résultat attendu |
|---|---|
| Sans JWT | `401` |
| JWT utilisateur non admin | `403` |
| JWT admin | `200` ou état PostHog explicite |

Puis vérifier :

- requête limitée aux périodes/filtres prédéfinis ;
- aucune requête HogQL libre envoyée par le navigateur ;
- `X-AVA-Cache: MISS` au premier appel puis `HIT` dans la minute ;
- erreur PostHog `401/403`, quota `429` ou indisponibilité affichée sans repli
  silencieux sur Supabase.

### 7. Compiler dans Lovable et contrôler la navigation

Lancer le build Lovable. Dans l’aperçu interne administrateur, vérifier :

- **Expérience** : Orchestration, Cinématiques ;
- **Qualité** : Latence & blocage, Latences PostHog, Laboratoire RAG, Traces Max ;
- **Technique avancée** : STT, RAG, LLM, TTS, Streaming Avatar, Consommation
  LLM, Consommation Voix, Consommation Streaming Avatar ;
- Validateur et Métriques hallu. absents du menu principal ;
- accès direct `?legacy=1` ou `?tab=validator|metrics` réservé à l’admin et
  journalisé ;
- switch Voix TTS / Avatar vidéo intact.

Ne pas publier en Production à cette étape.

### 8. Configurer Orchestration et tester les versions

Dans **Expérience → Orchestration** :

1. Vérifier la version baseline publiée.
2. Démarrer une session A et noter son `orchestration_version_id`.
3. Créer un brouillon dérivé.
4. Tester le brouillon avec un message et une réponse de personnage.
5. Vérifier qu’aucune session, mémoire ou événement live n’est créé par ce test.
6. Publier le brouillon uniquement en environnement interne.
7. Vérifier que la session A conserve l’ancienne version.
8. Démarrer une session B et vérifier qu’elle épingle la nouvelle version.
9. Archiver un brouillon de test puis utiliser **Restaurer en brouillon** ; une
   archive ne doit jamais redevenir éditable directement.

### 9. Préparer Emma sans l’activer trop tôt

Dans le profil runtime Emma :

1. Laisser **Personnage activable par le runtime** décoché.
2. Renseigner `characters.id` pour la fiche Emma synchronisée.
3. Renseigner la phrase d’ouverture et l’URL de portrait.
4. Renseigner le provider TTS actuellement actif dans Technique avancée et le
   Voice ID Emma compatible avec ce provider.
5. Vérifier que la fiche personnage et son prompt sont réellement consommés
   quand `characterName = Emma`.
6. Vérifier que le corpus RAG filtré par Emma est non vide et ne retourne aucun
   chunk privé Max.
7. Exécuter les tests qualitatifs et le scénario anti-fuite ci-dessous.
8. Cocher chaque validation uniquement avec une preuve.
9. Activer Emma seulement lorsque le badge devient **prêt**.

Scénario anti-fuite minimal :

1. Avec Max, confier un secret clairement formulé et ne jamais le promouvoir en
   mémoire partagée.
2. Accepter ensuite le handoff vers Emma.
3. Demander à Emma ce qu’elle sait de cette confidence.
4. Emma ne doit ni connaître, ni suggérer, ni paraphraser le secret.
5. Vérifier dans la mémoire V2 que l’élément est `private`, visible uniquement
   par `max`.

### 10. Recette handoff Max→Emma

Exécuter au minimum ces scénarios dans des sessions séparées :

| Scénario | Résultat attendu |
|---|---|
| Recommandation avant le tour 4 | Bloquée avec raison explicite |
| Recommandation après le tour 4 | Guidance injectée au prochain tour Max |
| Max propose Emma | Carte de choix après la fin de sa voix |
| Refus | Max continue, aucune seconde proposition |
| Acceptation | Même session/timer, écran d’appel puis Emma TTS |
| Rechargement avant le choix | Offre, timer et personnage restaurés |
| Rechargement après acceptation | Emma reste active, timer inchangé |
| Emma devenue incomplète | Handoff bloqué sans casser Max |

Vérifier les événements PostHog et `experience_events` : recommandé/proposé,
accepté ou refusé, exécuté ou bloqué. Un retry ne doit pas créer un doublon grâce
à `event_key`.

### 11. Recette cinématiques

1. Vérifier la synchronisation du catalogue Notion/Gumlet.
2. Vérifier qu’une vidéo sans URL est bloquée.
3. Faire recommander une vidéo disponible.
4. Confirmer qu’elle démarre après la fin de la voix et ne coupe ni le texte ni
   le TTS.
5. Utiliser **Passer** et vérifier l’événement correspondant.
6. Vérifier que le contexte post-vidéo arrive au personnage actif.
7. Vérifier cooldown, maximum par session et absence de répétition.
8. Si le GM recommande un handoff, confirmer qu’aucune cinématique concurrente
   ne prend sa priorité.

### 12. Recette Latence & blocage

Vérifier sans changer la disposition générale :

- détails et graphiques empilés ;
- provider, modèle, session et `turn_id` ;
- premier son séparé du playback ;
- données legacy `tts_ms` marquées ambiguës ;
- GM pré-tour, label pass et validateur marqués non exécutés en PRD4 ;
- aucune mesure absente convertie en zéro ;
- tours Max et Emma visibles ;
- drill-down session/tour et lien Traces Max.

### 13. Recette Latences PostHog

Après avoir généré plusieurs sessions internes :

1. Tester 24 h, 7 jours et 30 jours.
2. Vérifier source, fraîcheur et période réellement interrogée.
3. Comparer sessions/tours avec Supabase.
4. Contrôler plusieurs `turn_id` manuellement dans les deux sources.
5. Vérifier p50/p95 texte prêt, premier son et end-to-end.
6. Vérifier STT, RAG, Max LLM, TTS et GM post-tour.
7. Vérifier erreurs, fallbacks, blockers, modèles et providers.
8. Vérifier les compteurs cinématiques et handoffs.
9. Vérifier que « aucun événement » est affiché comme absence de données.
10. Saisir un budget par session et confirmer que le canary reste en données
    manquantes tant qu’un autre critère n’est pas mesuré.

Pour simuler une indisponibilité sans toucher aux secrets Production, bloquer
temporairement la requête Edge dans les outils réseau du navigateur ou utiliser
un environnement interne isolé. Ne jamais remplacer une clé Production par une
fausse valeur si sa restauration n’est pas garantie.

### 14. Non-régression Technique avancée

Pour chaque page, charger les réglages, effectuer une sauvegarde sans changement
fonctionnel, recharger et comparer :

- STT Config ;
- RAG Config ;
- LLM Config ;
- TTS Config ;
- Streaming Avatar Config ;
- Consommation LLM ;
- Consommation Voix ;
- Consommation Streaming Avatar.

Tester séparément les modes Voix TTS et Avatar vidéo avec Max. Le handoff Emma
V1 reste TTS ; il ne doit désactiver ni modifier la configuration Streaming
Avatar globale.

### 15. Décision de publication

Avant toute Production, produire un compte rendu avec :

- commit `main` synchronisé ;
- migration et objets vérifiés ;
- résultat build Lovable ;
- version Edge Function et tests 401/403/200 ;
- noms des secrets configurés ;
- résultats des sessions Max, vidéo, handoff accepté/refusé et reprise ;
- test anti-fuite ;
- résultats PostHog 24 h/7 j/30 j et parité `turn_id` ;
- non-régression Technique avancée ;
- valeur du budget canary et décision ;
- erreurs/logs restant à traiter.

Demander alors explicitement l’autorisation d’Ulrich. Sans réponse positive,
laisser la version en aperçu/interne.

## Retour arrière

Le rollback est fonctionnel, pas destructif :

1. Désactiver Emma dans `character_runtime_profiles` pour empêcher tout nouveau
   handoff.
2. Restaurer la version GM précédente en créant un brouillon depuis l’archive,
   le tester puis le publier. Les sessions en cours gardent leur version.
3. Conserver les nouvelles tables et colonnes ; ne jamais tenter de les supprimer
   pendant un incident.
4. Si PostHog est indisponible, conserver Latence & blocage comme source interne
   explicitement distincte. Ne pas afficher ces données sous le badge PostHog.
5. Laisser les pages Technique avancée et le mode Streaming Avatar inchangés.

## Prompt prêt à coller dans Lovable

```text
Finalise dans Lovable/Lovable Cloud la livraison « Orchestration GM, cinématiques,
handoff Max→Emma, mémoire V2 et Latences PostHog » déjà implémentée dans le
dernier commit de la branche GitHub `main` du dépôt `memoways/ava-proto1`.

Commence par synchroniser intégralement `main`, puis lis avant toute action :
- `AGENTS.md` ;
- `docs/plan_assainissement_mecanique_orchestration_gm.md` ;
- `docs/interfaces/lovable-experience-orchestration-finalization.md` ;
- l’entrée 0.55.0 de `CHANGELOG.md` ;
- l’entrée du 7 août 2026 de `STORY.md`.

Le code est déjà implémenté et validé localement : build réussi, lint ciblé sans
erreur, 58 fichiers de tests et 233 tests réussis. Ne réécris pas l’architecture
et ne remplace pas les services existants. Ne corrige que les erreurs réelles,
reproductibles, qui empêchent l’application ou la recette dans Lovable.

Contraintes absolues :
- Lovable est l’unique chaîne de build, backend, migrations, Edge Functions,
  secrets et publication ; n’utilise aucun Supabase ou hébergeur externe ;
- aucune migration destructive, suppression de donnée ou nettoyage legacy dans
  cette finalisation ;
- conserve toutes les pages Technique avancée, notamment Streaming Avatar Config
  et Consommation Streaming Avatar, ainsi que le switch Voix/Avatar ;
- Validateur et Métriques hallu. restent accessibles 14 jours en legacy admin
  journalisé ;
- ne mets jamais une clé PostHog dans le code, le frontend, une variable `VITE_*`,
  le chat ou les logs ; demande-moi de la saisir dans l’interface Secrets ;
- n’active pas Emma avant que toute sa checklist soit prouvée ;
- ne publie pas en Production sans mon approbation explicite.

Exécute dans cet ordre :

1. Confirme le SHA du commit `main` synchronisé et la présence des fichiers du
   plan, de la migration `20260807120000_experience_orchestration_foundations.sql`
   et de l’Edge Function `posthog-latency-stats`.

2. Capture en lecture seule la baseline Lovable Cloud : migrations appliquées,
   schéma de `sessions`, tables/RLS d’orchestration existantes, Edge Functions et
   erreurs récentes. Signale toute collision de schéma avant de muter la base.

3. Applique exclusivement via Lovable Cloud la migration additive
   `supabase/migrations/20260807120000_experience_orchestration_foundations.sql`.
   Vérifie tables, colonnes, contraintes, indexes, policies et RPC. Confirme la
   baseline GM publiée, les profils Max/Emma, l’append-only/idempotence de
   `experience_events`, l’isolation propriétaire et l’épinglage immuable de la
   version GM par session. Régénère ensuite les types Supabase via Lovable.

4. Demande-moi de saisir dans Lovable Cloud → Secrets, sans afficher leurs
   valeurs : `POSTHOG_PERSONAL_API_KEY` (clé dédiée au projet avec Query Read),
   `POSTHOG_PROJECT_ID` et `POSTHOG_API_HOST=https://eu.posthog.com`.

5. Déploie `posthog-latency-stats` via Lovable Cloud. Conserve le contrôle
   `requireAdmin` : sans JWT = 401, utilisateur non admin = 403, admin = réponse
   PostHog ou erreur explicite. Vérifie que la clé et l’Authorization sont absents
   du bundle et des logs, que le navigateur ne fournit aucune requête HogQL libre
   et que le cache passe de MISS à HIT dans la minute.

6. Lance le build Lovable et ouvre un aperçu interne. Vérifie la navigation
   Expérience/Qualité/Technique avancée, les huit pages Technique, l’accès legacy
   journalisé et le switch Voix/Avatar. Ne publie pas encore en Production.

7. Dans Orchestration, vérifie la version baseline, crée et teste un brouillon
   sans effet réel, publie-le uniquement en interne, puis prouve qu’une session
   démarrée avant publication conserve son ancienne version et qu’une nouvelle
   session épingle la nouvelle. Teste archive et restauration par brouillon.

8. Prépare le profil Emma sans l’activer : utilise le `characters.id` interne de
   sa fiche synchronisée, une phrase d’ouverture, un portrait, le provider TTS
   actif et un Voice ID compatible. Vérifie prompt, corpus RAG Emma non vide,
   tests qualitatifs et isolation des connaissances. Active Emma uniquement quand
   toutes les preuves existent et que le badge est prêt.

9. Exécute les scénarios : Max seul ; handoff bloqué avant quatre tours ; handoff
   accepté ; handoff refusé ; reprise avant et après choix ; Emma devenue
   indisponible ; session longue. Vérifie une seule offre par session, même timer,
   même session, TTS Emma et événements idempotents.

10. Exécute un test anti-fuite : confie à Max un secret privé non promu, accepte
    Emma puis questionne-la. Elle ne doit ni connaître ni paraphraser le secret.
    Vérifie la visibilité V2 en base et l’absence de transcript/résumé Max dans le
    payload Emma.

11. Teste les cinématiques : média manquant bloqué, vidéo disponible après la fin
    de la voix, bouton Passer, contexte post-vidéo, cooldown, quota, doublon et
    priorité du handoff.

12. Vérifie Latence & blocage sans modifier sa disposition : premier son séparé
    du playback, données legacy ambiguës, segments PRD4 non exécutés, aucun zéro
    synthétique, tours Max/Emma, provider/modèle/session/turn_id et drill-down.

13. Vérifie Latences PostHog sur 24 h, 7 j et 30 j : source, fraîcheur, période,
    p50/p95, services, erreurs/fallbacks/blockers, providers, cinématiques et
    handoffs. Compare sans fusion à Supabase et contrôle plusieurs `turn_id`.
    Une absence de données ou une panne doit rester explicite. Le canary ne doit
    décider que si sessions, tours, premier son, erreurs, persistance et coût sont
    tous mesurés et que le budget par session est approuvé.

14. Effectue une non-régression chargement/sauvegarde/rechargement pour STT, RAG,
    LLM, TTS, Streaming Avatar et les trois pages de consommation. Teste Max en
    Voix TTS puis Avatar vidéo ; le handoff Emma reste TTS sans changer la config
    Streaming Avatar.

15. Ne supprime rien après la recette. Démarre seulement la fenêtre d’observation
    legacy de 14 jours. Avant toute Production, présente-moi un rapport factuel et
    demande mon approbation explicite.

À la fin, rends un compte rendu avec : SHA `main`, migration et objets vérifiés,
version/déploiement Edge, noms des secrets présents, build/URL d’aperçu, IDs de
sessions et traces, tests 401/403/200, résultats GM/vidéo/handoff/reprise/mémoire,
parité PostHog/Supabase, non-régression Technique, canary et tous les blocages.
N’invente jamais une opération Cloud réussie : si une permission ou une valeur
manque, demande-la précisément puis poursuis toutes les vérifications
indépendantes encore possibles.
```

## Documentation liée

- [Plan approuvé et état d’implémentation](../plan_assainissement_mecanique_orchestration_gm.md)
- [Audit observabilité PostHog historique](../posthog_latency_observability_audit.md)
- [Activation `optimized_v3`](../optimized_v3_lovable_runbook.md)
- [Déploiement Lovable sans interruption](../lovable_phase1_activation_runbook.md)

## Journal d'activation Lovable Cloud — 7 août 2026

| Élément | Résultat |
|---|---|
| Commit synchronisé | `e76d3551c85ce668915aa1421bea11e503016c9a` |
| Baseline Cloud avant migration | 77 sessions conservées, 5 fiches personnages, aucune table ni colonne d'orchestration préexistante, `private.has_role` disponible |
| Migration fondations | Appliquée par Lovable Cloud. Ajout obligatoire constaté : les tables du schéma `public` ne reçoivent aucun droit par défaut, des `GRANT` explicites (`authenticated`, `service_role`) ont été inclus, puis les droits `anon` révoqués |
| Contrôles post-migration | 1 seule version `published`, baseline `builtin://experience-director/v1` présente, profils `max:true` / `emma:false`, 4 colonnes ajoutées à `sessions`, 4 RPC créées, `experience_events` sans politique `UPDATE`/`DELETE`, 77 sessions intactes |
| Types Supabase régénérés | Oui ; corrections strictement mécaniques de typage (`SessionRow`, exports mémoire V2, projection du label pass, narrowing action cinématique) |
| Build et tests | Build vert, 59 fichiers / 244 tests réussis |
| Edge Function | `posthog-latency-stats` déployée ; sans JWT → `401`, JWT invalide → `401` |
| Secrets PostHog | **Manquants** : `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` à saisir dans l'interface Secrets |
| Emma | Volontairement désactivée ; checklist runtime non renseignée |
| Publication Production | Non effectuée, en attente d'approbation explicite |
