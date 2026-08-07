# Finalisation Lovable — Expérience, réglages GM, PostHog et handoff Emma

> **Catégorie :** Interface externe et runbook d’activation
>
> **Services :** Lovable Cloud, Supabase fourni par Lovable, PostHog EU
>
> **Dernière mise à jour :** 7 août 2026
>
> **Statut :** Code 0.55.2 prêt, synchronisation et recette Lovable à réaliser

## Objectif

Ce document explique comment finaliser dans Lovable les livraisons décrites dans
le [plan d’assainissement de l’orchestration GM](../plan_assainissement_mecanique_orchestration_gm.md)
et le [plan d’orchestration globale et de réglages GM](../plan_orchestration_experience_et_reglages_gm.md) :

- nouvelle navigation Expérience / Qualité / Technique avancée ;
- orchestration GM versionnée ;
- cinématiques recommandées par le directeur ;
- handoff Max→Emma ;
- mémoire inter-personnages V2 ;
- vraie vue Latences PostHog ;
- comparaison avec la télémétrie interne et canary multi-source.
- orchestration globale de la durée, du questionnaire et des personnages actifs ;
- éditeur GM structuré générant le prompt publié et ses garde-fous runtime ;
- prise en compte de l’ouverture, du provider et de la voix configurés pour Max.

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

- groupe **🧭 Expérience**, visuellement distinct de **🎭 Personnages** ;
- **Expérience** : Orchestration, Réglages GM, Réglages personnages,
  Cinématiques et Comment ça marche ;
- **Qualité** : Latence & blocage, Latences PostHog, Laboratoire RAG, Traces Max ;
- **Technique avancée** : STT, RAG, LLM, TTS, Streaming Avatar, Consommation
  LLM, Consommation Voix, Consommation Streaming Avatar ;
- Validateur et Métriques hallu. absents du menu principal ;
- accès direct `?legacy=1` ou `?tab=validator|metrics` réservé à l’admin et
  journalisé ;
- switch Voix TTS / Avatar vidéo intact.

Ne pas publier en Production à cette étape.

### 8. Configurer l’expérience et tester les versions GM

Dans **Expérience → Orchestration** :

1. Vérifier la durée, le switch du questionnaire et la liste des personnages.
2. Confirmer que Max est actif et non désactivable dans ce prototype.
3. Laisser Emma inactive tant que sa checklist n’est pas complète.
4. Démarrer une session avec questionnaire actif, terminer et vérifier son
   affichage ; répéter avec le questionnaire inactif et vérifier le passage
   direct aux remerciements sans enregistrement vide.

Dans **Expérience → Réglages GM** :

1. Vérifier la version baseline publiée et démarrer une session A en notant son
   `orchestration_version_id`.
2. Créer un brouillon dérivé et modifier au moins une sélection simple, une
   priorité multiple, un switch, un nombre et une consigne libre.
3. Vérifier que l’aperçu du prompt généré reflète exactement chaque choix.
4. Tester le brouillon avec un message et une réponse de personnage ; aucune
   session, mémoire ou événement live ne doit être créé.
5. Publier le brouillon uniquement en environnement interne.
6. Vérifier que la session A conserve l’ancienne version et qu’une session B
   épingle la nouvelle.
7. Vérifier qu’un handoff ou une cinématique désactivé est bloqué par le runtime,
   même si le LLM recommande encore cette action.
8. Vérifier le premier tour autorisé et le timeout configuré.
9. Archiver un brouillon de test puis utiliser **Restaurer en brouillon** ; une
   archive ne doit jamais redevenir éditable directement.

### 9. Préparer Emma sans l’activer trop tôt

Dans le profil runtime Emma :

1. Laisser Emma désactivée dans **Expérience → Orchestration**.
2. Ouvrir **Expérience → Réglages personnages** et confirmer qu’aucune checkbox
   d’activation n’y subsiste.
3. Renseigner `characters.id` pour la fiche Emma synchronisée.
4. Renseigner la phrase d’ouverture et l’URL de portrait.
5. Renseigner le provider TTS actuellement actif dans Technique avancée et le
   Voice ID Emma compatible avec ce provider.
6. Vérifier que la fiche personnage et son prompt sont réellement consommés
   quand `characterName = Emma`.
7. Vérifier que le corpus RAG filtré par Emma est non vide et ne retourne aucun
   chunk privé Max.
8. Exécuter les tests qualitatifs et le scénario anti-fuite ci-dessous.
9. Cocher les validations **Tests qualitatifs** et **Isolation des connaissances**
   uniquement avec une preuve.
10. Revenir dans Orchestration et activer Emma seulement lorsque le badge devient
    **configuré** et que tous les prérequis de readiness sont verts.

Pour Max, remplacer temporairement sa phrase d’ouverture par une valeur de test,
ouvrir une nouvelle session et confirmer que cette valeur exacte est affichée et
prononcée. Vérifier dans les traces que le provider et le Voice ID du profil ont
été utilisés. Restaurer ensuite la phrase éditoriale validée.

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

1. Désactiver Emma depuis le sélecteur de personnages du panel Orchestration
   pour empêcher tout nouveau handoff ; vérifier ensuite la valeur persistée dans
   `character_runtime_profiles`.
2. Restaurer la version GM précédente en créant un brouillon depuis l’archive,
   le tester puis le publier. Les sessions en cours gardent leur version.
3. Conserver les nouvelles tables et colonnes ; ne jamais tenter de les supprimer
   pendant un incident.
4. Si PostHog est indisponible, conserver Latence & blocage comme source interne
   explicitement distincte. Ne pas afficher ces données sous le badge PostHog.
5. Laisser les pages Technique avancée et le mode Streaming Avatar inchangés.

## Prompt prêt à coller dans Lovable

> **Configuration Prompt Factory**
>
> - Rôle : ingénieur full-stack senior Lovable/Lovable Cloud
> - Domaine : expérience narrative voice-to-voice Ava / PRD4
> - Format : Markdown structuré directement copiable dans Lovable
> - Mode : avancé
> - Résultat attendu : intégration du commit, preview interne, preuves de recette
>   et demande d’approbation avant Production
> - Qualité : rôle, contexte, contraintes, séquence, critères d’acceptation,
>   erreurs et rollback explicités
> - Taille indicative : environ 2 900 tokens

```text
Tu es l’ingénieur full-stack senior responsable de finaliser dans Lovable et
Lovable Cloud la livraison 0.55.2 « Orchestration globale et éditeur GM
réellement câblés » du projet Ava / PRD4.

## Mission

Synchronise le dernier commit de la branche GitHub `main` du dépôt
`memoways/ava-proto1`, vérifie que Lovable contient exactement
l’implémentation déjà réalisée et finalise uniquement les actions nécessaires
dans Lovable/Lovable Cloud. Ne réécris pas les composants et ne recrée pas une
architecture parallèle. Corrige seulement une erreur reproductible qui empêche
le build ou un critère de recette ci-dessous.

Le résultat attendu est une preview interne Lovable fonctionnelle, accompagnée
de preuves. Tu ne dois pas publier en Production sans mon approbation explicite.

## Sources de vérité à lire avant toute modification

Lis dans cet ordre :

1. `AGENTS.md` ;
2. `CHANGELOG.md`, entrée 0.55.2 ;
3. `STORY.md`, entrée « Les réglages d’expérience cessent d’être décoratifs » ;
4. `docs/plan_orchestration_experience_et_reglages_gm.md` ;
5. `docs/interfaces/lovable-experience-orchestration-finalization.md` ;
6. les diffs du dernier commit `main` dans :
   - `src/components/GameMasterConfigTab.tsx` ;
   - `src/components/GameMasterSettingsTab.tsx` ;
   - `src/components/CharacterRuntimeSettingsTab.tsx` ;
   - `src/pages/IndexPRD4.tsx` ;
   - `src/services/experienceOrchestration.ts` ;
   - `src/services/experienceDirector.ts` ;
   - `src/services/gameMasterPromptBuilder.ts` ;
   - `src/services/streamingAvatar/localTtsOutput.ts` ;
   - `src/types/index.ts`.

Commence ton compte rendu par le SHA `main` réellement synchronisé et confirme
que l’entrée 0.55.2 est visible. Si Lovable n’a pas encore ce commit, arrête les
mutations, resynchronise GitHub puis recommence la vérification.

## État déjà implémenté à préserver

Le commit contient déjà :

- l’icône 🧭 pour le groupe Expérience, distincte de 🎭 Personnages ;
- un panneau Orchestration avec durée, questionnaire final on/off et personnages
  actifs ;
- Max obligatoire comme personnage d’entrée et Emma activable pour le handoff ;
- le retrait de « Personnage activable par le runtime » des Réglages personnages ;
- un éditeur GM structuré avec sélections simples, sélection multiple, switches,
  nombres, texte libre et aperçu du prompt généré ;
- une configuration GM versionnée transportée jusqu’aux garde-fous runtime ;
- le blocage déterministe des handoffs/cinématiques désactivés, du handoff avant
  le tour minimum et du quota de handoffs ;
- le timeout GM configuré appliqué à l’appel post-tour ;
- la phrase d’ouverture de Max lue depuis
  `character_runtime_profiles.opening_line`, avec la constante intégrée comme
  fallback uniquement ;
- le provider et le Voice ID du personnage transmis à toutes ses répliques TTS,
  y compris après un fallback avatar → TTS ;
- les validations manuelles « Tests qualitatifs » et « Isolation des
  connaissances » dans Réglages personnages ;
- `SHOW_QUESTIONNAIRE` persisté dans le JSON de gameplay et consommé par la
  machine d’état de fin.

Aucune nouvelle migration n’est nécessaire pour 0.55.2 : les nouvelles valeurs
utilisent `admin_settings.value` et
`experience_orchestration_versions.config`, tous deux déjà en JSON, ainsi que
le champ `enabled` existant de `character_runtime_profiles`. N’invente pas de
migration si le schéma attendu est déjà présent.

## Contraintes absolues

- Lovable est l’unique chaîne de build et de publication.
- Base, Auth, RLS, Edge Functions et secrets restent dans le Supabase fourni par
  Lovable Cloud.
- Ne configure ni Vercel, ni Netlify, ni projet Supabase externe, ni autre chaîne
  CI/CD ou hébergeur.
- N’exécute aucune migration destructive et ne supprime aucune donnée, table,
  colonne, policy, RPC, session, télémétrie ou réglage legacy.
- Ne modifie aucun secret et n’affiche jamais sa valeur.
- Ne remplace pas le stockage JSON existant par de nouvelles tables pour cette
  finalisation.
- Ne change pas la variante de prompt Max, les réglages RAG, STT, Streaming
  Avatar ou les providers globaux.
- Ne prétends jamais qu’une opération Cloud a réussi sans preuve observable.
- Ne publie pas en Production sans approbation explicite d’Ulrich.

## Séquence d’exécution obligatoire

### Phase 1 — Synchronisation et baseline en lecture seule

1. Synchronise GitHub `main` et rapporte son SHA.
2. Vérifie les fichiers et comportements listés dans « État déjà implémenté ».
3. Capture avant mutation :
   - migrations déjà appliquées ;
   - présence et colonnes de `character_runtime_profiles` ;
   - version publiée de `experience_orchestration_versions` ;
   - structure JSON actuelle de `admin_settings` pour
     `ava_gameplay_settings`, sans exposer de secret ;
   - erreurs récentes du build et des Edge Functions ;
   - réglages actifs Voix TTS / Avatar vidéo.
4. Si la migration
   `20260807120000_experience_orchestration_foundations.sql` n’est pas appliquée,
   suis d’abord le runbook du présent document. Si elle est déjà appliquée,
   n’essaie pas de la rejouer à l’aveugle.

### Phase 2 — Build Lovable sans réécriture

1. Laisse Lovable compiler le commit tel quel.
2. Si les types Supabase doivent être régénérés, accepte uniquement un diff de
   typage mécanique compatible avec le schéma Lovable Cloud actuel.
3. En cas d’erreur, fournis le fichier, la ligne et le message exact avant toute
   correction.
4. N’ajoute aucune dépendance pour remplacer les composants shadcn existants.
5. Ouvre une preview interne ; ne publie pas en Production.

### Phase 3 — Recette de l’orchestration globale

Dans Admin → 🧭 Expérience → Orchestration :

1. Vérifie que la durée est chargée et sauvegardable.
2. Active le questionnaire, démarre une nouvelle session, termine-la et confirme
   l’affichage du questionnaire.
3. Désactive le questionnaire, démarre une autre nouvelle session, termine-la et
   confirme le passage direct de l’écran de fin aux remerciements.
4. Vérifie qu’aucune réponse questionnaire vide n’est enregistrée dans ce second
   scénario.
5. Vérifie que Max est actif et non désactivable.
6. Vérifie qu’Emma est activable ici et qu’aucun contrôle d’activation ne subsiste
   dans Réglages personnages.
7. Confirme qu’une sauvegarde du profil Emma ne réactive ni ne désactive Emma.

Les réglages globaux sont lus au démarrage d’une nouvelle session. Ne considère
pas comme un défaut qu’une session déjà ouverte conserve son état.

### Phase 4 — Recette des profils personnages

Dans Admin → 🧭 Expérience → Réglages personnages :

1. Pour Max, note la phrase d’ouverture éditoriale actuelle.
2. Remplace-la temporairement par une phrase de test unique, sauvegarde, puis
   démarre une nouvelle session.
3. Confirme que cette phrase exacte est affichée, ajoutée au transcript et
   prononcée comme première réplique. L’ancienne constante « Hallo… à qui ai-je
   affaire ? » ne doit apparaître que si le profil est absent, inaccessible ou
   vide.
4. Contrôle dans les traces TTS que le provider et le Voice ID du profil Max sont
   utilisés pour l’ouverture puis pour une réponse normale.
5. En mode Avatar vidéo, provoque seulement dans un environnement interne un
   fallback contrôlé vers TTS et vérifie que le même provider et Voice ID sont
   conservés.
6. Restaure la phrase éditoriale initiale de Max.
7. Pour Emma, vérifie la phrase, le portrait, le provider, le Voice ID, le prompt
   et le corpus RAG.
8. Coche « Tests qualitatifs » et « Isolation des connaissances » uniquement
   après les scénarios correspondants.
9. Active ensuite Emma depuis Orchestration, jamais depuis sa fiche.

Si un provider ne reconnaît pas le Voice ID saisi, signale l’incompatibilité ;
ne remplace pas silencieusement le provider global.

### Phase 5 — Recette de l’éditeur GM

Dans Admin → 🧭 Expérience → Réglages GM :

1. Crée un brouillon depuis la version publiée.
2. Modifie successivement :
   - la posture du directeur ;
   - la longueur de guidance ;
   - au moins deux priorités de la sélection multiple ;
   - le switch handoff ;
   - le switch cinématiques ;
   - le premier tour de handoff ;
   - le timeout ;
   - les instructions complémentaires.
3. Après chaque catégorie, vérifie que l’aperçu du prompt généré reflète le choix
   avec un texte compréhensible et sans supprimer le contrat JSON de base.
4. Sauvegarde puis recharge : tous les contrôles et le prompt doivent être
   identiques.
5. Lance le test sans effet réel et confirme qu’il ne crée ni session, ni mémoire,
   ni événement live.
6. Publie uniquement dans l’environnement interne.
7. Prouve qu’une session commencée avant publication garde son ancienne
   `orchestration_version_id` et qu’une nouvelle session épingle la nouvelle.
8. Désactive les handoffs, force un scénario où le LLM en recommande un et
   confirme `handoff_disabled`.
9. Désactive les cinématiques, force une recommandation et confirme
   `cinematic_disabled`.
10. Réactive le handoff avec un tour minimum de 6 : une recommandation au tour 5
    doit être bloquée et une recommandation au tour 6 peut être acceptée si Emma
    est prête.
11. Vérifie qu’un timeout GM retourne une décision neutre sans bloquer la réponse
    du personnage ni sa voix.
12. Restaure ou republie la configuration interne souhaitée après les tests.

Distingue dans le rapport :

- contrôles déterministes : autorisations, tour minimum, quota et timeout ;
- contrôles probabilistes injectés dans le prompt : posture, longueur, priorités
  et instructions complémentaires.

### Phase 6 — Non-régression du parcours existant

Exécute au minimum :

1. une session Max complète avec questionnaire ;
2. une session Max complète sans questionnaire ;
3. un handoff Max→Emma accepté ;
4. un handoff refusé ;
5. une reprise avant et après le handoff ;
6. une cinématique jouée après la voix ;
7. Max en Voix TTS ;
8. Max en Avatar vidéo avec puis sans fallback ;
9. le scénario anti-fuite mémoire Max→Emma décrit dans ce runbook ;
10. un chargement/sauvegarde/rechargement des pages STT, RAG, LLM, TTS,
    Streaming Avatar et consommations, sans changement de valeur.

Confirme que les sessions historiques restent lisibles et que les nouveaux
réglages n’altèrent pas une conversation déjà démarrée.

## Critères d’acceptation

La finalisation est acceptée uniquement si toutes les affirmations suivantes ont
une preuve :

- le SHA `main` synchronisé contient l’entrée 0.55.2 ;
- le build Lovable est vert ;
- 🧭 Expérience est distinct de 🎭 Personnages ;
- le questionnaire on/off produit les deux parcours attendus ;
- Max reste obligatoire et Emma s’active uniquement depuis Orchestration ;
- la phrase d’ouverture test de Max est effectivement affichée et prononcée ;
- provider et Voice ID du personnage apparaissent dans les traces TTS ;
- l’éditeur GM restaure ses valeurs et génère le prompt attendu ;
- les actions désactivées sont bloquées par une raison déterministe ;
- une version GM publiée n’altère pas une session déjà épinglée ;
- le test de brouillon n’écrit aucune donnée live ;
- handoff, cinématique, reprise, mémoire privée et modes de sortie ne régressent
  pas ;
- aucune migration ou infrastructure externe n’a été créée ;
- aucune donnée ou configuration historique n’a été supprimée ;
- aucune publication Production n’a eu lieu sans autorisation.

## Gestion des erreurs

- Permission Lovable Cloud manquante : indique l’écran et l’autorisation
  nécessaires, puis poursuis les vérifications indépendantes.
- Schéma attendu absent : arrête les mutations et compare avec la migration
  fondatrice ; ne crée pas une approximation.
- Build rouge : fournis l’erreur exacte et propose le plus petit correctif
  compatible avec le commit.
- Test fonctionnel rouge : rapporte étapes, session, tour, valeur attendue,
  valeur observée et trace associée.
- Donnée de test modifiée : restaure sa valeur d’origine avant de conclure.
- Secret ou provider indisponible : marque le scénario « bloqué », jamais
  « réussi ».

## Rollback

Si la preview présente une régression :

1. ne publie pas en Production ;
2. restaure les réglages globaux précédents dans `admin_settings` ;
3. republie une version GM issue du dernier archive stable ;
4. désactive Emma depuis Orchestration ;
5. conserve toutes les tables, colonnes et données ;
6. reviens au commit `main` stable précédent uniquement via le workflow GitHub
   et Lovable, jamais par une chaîne externe ;
7. documente chaque valeur restaurée et vérifie une nouvelle session Max.

## Compte rendu final obligatoire

Réponds avec ces sections :

1. **Version** — SHA GitHub et SHA/build Lovable.
2. **Baseline** — migrations, schéma et réglages observés avant mutation.
3. **Changements Lovable** — uniquement les actions réellement effectuées.
4. **Build et preview** — résultat et URL interne.
5. **Recette orchestration** — durée, questionnaire et activation personnages.
6. **Recette profils** — ouverture Max, provider, voix et validations.
7. **Recette GM** — contrôles, prompt généré, guards et versioning.
8. **Non-régression** — handoff, cinématiques, reprise, mémoire et sorties.
9. **Sécurité/compatibilité** — secrets, RLS, absence de migration externe ou
   destructive.
10. **Blocages** — permissions, données ou preuves manquantes.
11. **Décision** — prêt ou non pour Production, sans publier.
12. **Question d’approbation** — demande explicite à Ulrich avant Production.

Pour chaque test, indique attendu, observé, preuve et verdict PASS/FAIL/BLOQUÉ.
N’invente aucune preuve et ne transforme jamais un scénario bloqué en succès.
```

## Documentation liée

- [Plan orchestration globale et réglages GM](../plan_orchestration_experience_et_reglages_gm.md)
- [Plan approuvé et état d’implémentation](../plan_assainissement_mecanique_orchestration_gm.md)
- [Changelog 0.55.2](../../CHANGELOG.md)
- [Chronique produit](../../STORY.md)
- [Audit observabilité PostHog historique](../posthog_latency_observability_audit.md)
- [Activation `optimized_v3`](../optimized_v3_lovable_runbook.md)
- [Déploiement Lovable sans interruption](../lovable_phase1_activation_runbook.md)

## Journal d'activation Lovable Cloud — 7 août 2026

> Le tableau ci-dessous conserve la trace de l’activation précédente. Le lot
> 0.55.2 décrit dans ce document reste à synchroniser et à recetter dans Lovable.

| Élément | Résultat |
|---|---|
| Lot 0.55.2 | En attente de synchronisation du nouveau commit `main`, de preview et de recette selon le prompt ci-dessus |
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
