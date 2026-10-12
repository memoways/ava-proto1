# Prompt de reprise — lot 1 : mesures fiables et MCP Ava

Ce document est le prompt à transmettre au prochain assistant de développement. Il prépare le **lot 1 / P0** du [plan général](plan_optimisation_latence_voice_to_voice.md), sans dupliquer les spécifications des lots suivants.

## Mission

Mets en œuvre uniquement le lot 1 du plan d'optimisation voice-to-voice d'Ava Proto 1. L'objectif observable est de reconstruire la chronologie d'un tour, avec fournisseur/modèle effectifs, mesures correctement définies et couverture explicite, dans les outils admin et le MCP Ava. Rétablis aussi les prérequis de dépendances et de CI identifiés par l'audit.

Ulrich demande des lots séparés. Conduis ce lot jusqu'au push et au **squash merge d'une PR vers `main`**, puis fournis un prompt de reprise Lovable pour vérifier, publier et tester. Tu es autorisé à réaliser ces étapes ; les tests et la revue doivent précéder la fusion. La validation Lovable et les mesures publiées clôturent la validation fonctionnelle du lot. Ne commence pas le lot 2 dans cette reprise.

## État de départ vérifié — 12 octobre 2026

- Projet : `ava-proto1`, `/Users/ulrich/CodeProjects/memoways/ava-proto1`.
- Dépôt : `https://github.com/memoways/ava-proto1.git` ; branche locale et distante `main` synchronisées, sans modification locale avant la rédaction de ce prompt.
- Dernière révision vérifiée avant ce document : `2980417dbf58d396ab8f070f9dbe1f6200a4c636`. Les commits suivants de documentation sont attendus : récupère `origin/main` et note la révision effective avant de coder.
- Base applicative de l'audit : `0433518`. L'audit, le snapshot et le choix acoustique sont livrés ; aucune optimisation applicative du plan n'est encore réalisée.
- Lovable / Lovable Cloud est l'unique plateforme de compilation et de publication. Projet backend du repo : `iralfqlslqndgvexixis`. Vérifie cette cible avant toute action backend ; utilise le projet Lovable associé à ce dépôt.
- MCP Ava actif : `https://iralfqlslqndgvexixis.supabase.co/functions/v1/mcp`, OAuth admin ; outils de lecture actuellement limités aux agrégats. PostHog Ava : projet `137897`, organisation MemoWays, données horaires UTC.
- Vérifié lors de l'audit : 423 tests unitaires passent sur `0433518`. Typecheck en échec après résolution isolée du SDK MCP : schémas Zod 3 incompatibles avec Zod 4 attendu par le SDK. `npm ci --dry-run --ignore-scripts` échoue sur les lockfiles désynchronisés ; `regression-gates` était déjà en échec. Ces résultats historiques sont à rejouer, pas à déclarer encore verts.
- Non vérifié : état runtime des réglages mains libres dans chaque environnement, chronologie physique récente, fonctionnement publié des changements du lot 1.

## Contexte à lire avant modification

1. `AGENTS.md` et les instructions personnelles applicables.
2. [Plan général](plan_optimisation_latence_voice_to_voice.md), surtout P0 et section 6.
3. [Audit détaillé](audit_voice_conversation_max.md) et [snapshot anonymisé](latency_voice_snapshot_2026-10-12.json).
4. [Plan MCP existant](plan_mcp_statistiques.md), [guide PostHog](posthog-setup-guide.md) et [base mains libres](plan_conversation_mains_libres.md).
5. `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md` pour la clôture et la reprise.

Vérifie d'abord les changements intervenus depuis l'audit. Préserve les modifications d'autres travaux. Réutilise les modules, protections et tests existants ; complète ce document avec le périmètre réellement livré et les preuves, sans créer un second plan concurrent.

## Travaux du lot 1

### A. Dépendances reproductibles et CI

- Réaligner `package.json`, `package-lock.json` et `bun.lock` selon les usages effectifs de Lovable et de la CI. Vérifier une installation propre, sans changement de chaîne de livraison ni mise à niveau générale de dépendances.
- Conserver Zod 3 pour les formulaires. Pour le SDK MCP 3.0.5 audité, l'alias séparé `zod-mcp: npm:zod@4.6.6` a passé le typecheck sur une copie temporaire des quatre outils ; vérifier cette compatibilité sur les versions réellement verrouillées avant de la retenir. Le simple `zod/v4` de Zod 3.25 n'a pas suffi lors de l'audit.
- Rejouer les tests des schémas, des outils et de l'OAuth. Les corrections nécessaires pour rétablir les gates font partie du lot ; si une autre régression dépasse son périmètre, la documenter précisément et traiter le blocage avant fusion, sans désactiver le contrôle.

### B. Télémétrie V2 additive

- Propager `schema_version=2`, `turn_id`, `attempt_id`, environnement, personnage, mode de saisie réel, transport et versions de code/prompt/config disponibles. Préserver les événements et colonnes V1 pour les lectures historiques. Éviter doublons de finalisation et confusion entre retries, interruptions et tours suivants.
- Distinguer fournisseur/modèle demandés, résolus et effectifs, overrides de personnage et fallback. Les métadonnées doivent venir du résultat réellement exécuté ; éviter de reporter les réglages globaux comme preuve du fournisseur effectif. Vérifier la cohérence avec le chunking, sans retoucher les buffers ou la prosodie.
- Ajouter les jalons réellement observables du chemin courant : capture/envoi/flush/final STT, contexte prêt, requête LLM/en-têtes/réponse, texte envoyé au TTS, premier chunk, scheduling/sortie estimée, fin/annulation audio. Ajouter des spans serveur RAG (quota/profil/embedding/recherche/rerank) et GM (génération/validation/persistance/disponibilité).
- Utiliser des durées monotones dans chaque processus et des identifiants pour corréler client/Edge/provider. Ne pas soustraire des horloges indépendantes ni sommer des percentiles ou des spans qui se chevauchent. Séparer dépassement de budget et attente critique, avec état de couverture incomplète.
- Prévoir les futurs jalons intention/phrase sûre/candidat acoustique/atténuation/confirmation/rejet/reprise. Ils restent absents ou `null` tant que ces mécanismes n'existent pas. Le LLM batch ne fournit pas un vrai premier token ; une release PTT ne prouve pas la fin physique de parole. Exposer origine et précision, sans fabriquer ces mesures ni implémenter P1/P2 pour les obtenir.
- Séparer première sortie, génération totale et lecture. Une sortie estimée n'est pas un timestamp acoustique exact. Ne calculer fin de voix → premier son en V2 que si la fin de voix est réellement observée ; sinon garder une autre origine explicitement nommée.
- Corriger le traitement null → zéro du proxy de statistiques. Conserver un zéro réel lorsque mesuré. Inclure états commencé/terminé/interrompu/annulé/timeout/échec/sans audio et couverture ; ne pas masquer les échecs en ne gardant que les tours terminés.
- La collecte reste bornée et asynchrone : aucune persistance ou requête de statistiques attendue sur le chemin vocal, aucune dépendance fonctionnelle à sa réussite. Ne pas introduire de transcription privée, prompt, token ou secret dans les nouvelles projections.

### C. MCP et vues admin

- Étendre le serveur existant plutôt que le reconstruire. Lire `voice_turn_events` et les projections techniques PRD4/GM ; conserver les statistiques legacy, clairement séparées. Rendre possible une chronologie diagnostique par tour sans exposer son dialogue.
- Ajouter les filtres utiles de période, environnement, personnage, fournisseur/modèle effectifs, transport et version, seulement là où les données permettent de les appliquer. Une absence de champ n'est pas un filtre satisfait.
- Retourner effectifs, couverture, fenêtre effective, source/version, méthode de percentile, caps et pagination. Préserver les percentiles interpolés existants ou versionner explicitement une nouvelle méthode ; distinguer la référence de septembre calculée au rang supérieur.
- Conserver OAuth, autorisation admin, RLS, lecture seule et validation des retours. Ne pas employer de clé privilégiée pour contourner les droits de l'appelant. Toute migration éventuelle est additive, documentée et appliquée via Lovable Cloud.
- Mettre à jour les vues de latence existantes et la documentation du contrat. Utiliser le MCP Ava et le connecteur PostHog natifs pour les lectures réelles ; aucun contournement navigateur ou accès direct externe à la base Lovable.

Points d'entrée à vérifier : `src/services/voiceTelemetry.ts`, `latencyTelemetry.ts`, `latencyServiceMetadata.ts`, `posthogLatencyStats.ts`, `src/pages/IndexPRD4.tsx`, `prd4Orchestrator.ts`, `openRouterLLM.ts`, `src/services/stt/`, `src/services/tts/`, `src/services/streamingAvatar/localTtsOutput.ts`, `src/lib/mcp/`, `supabase/functions/query-rag/`, `proxy-llm/`, `posthog-latency-stats/`. Ce sont des points de lecture, pas une obligation de modifier tous ces fichiers. Le MCP backend généré par le plugin ne doit pas devenir une implémentation parallèle maintenue à la main.

## Protections et limites du lot

Conserver le comportement vocal, les valeurs d'environnement, les fournisseurs, les prompts métier, le RAG, les deadlines, la mémoire, le PTT, les cinématiques et le handoff. La cible finale est bien voix seule avec interruptions acoustiques confirmées, mais ce lot prépare sa mesure : il n'active ni cette stratégie, ni le streaming LLM/TTS, ni la nouvelle mémoire de livraison, ni la suppression du texte public.

Préserver l'isolation Max/Emma, les confidences, le rôle et la relation. `experienceFrame.ts` reste le constructeur unique du cadre injecté au GM et au personnage ; la réponse initiale sur le film reste partagée et conservée lors du replay de l'introduction. Les accès anonymes ne gagnent aucune permission. Éviter tout nouveau service de build ou de déploiement et toute modification d'un autre projet.

## Vérification et critères de livraison

- Tests ciblés sur l'attribution réelle/override/fallback, `null` versus zéro, mesures partielles, origines, corrélation/retries, annulation et callbacks tardifs, absence de blocage si la télémétrie échoue.
- Tests MCP : V1/V2 séparées, PRD4 présent, erreurs et tours incomplets visibles, caps/filtres/pagination/percentiles, projections sans contenu privé, accès refusé sans droit admin. Une absence de donnée ne produit pas un chiffre inventé.
- Installation propre avec les lockfiles livrés, typecheck, tests de régression, unitaires et intégrations pertinents ; exécuter le parcours de `.github/workflows/core-experience-quality.yml` et obtenir ses checks GitHub verts sur le dernier HEAD de la PR. Les contrôles locaux sont des diagnostics de compatibilité ; Lovable reste la livraison.
- Smoke tests du parcours existant : Max puis Emma, PTT, mains libres dans son réglage actuel, interruption existante, introduction/film, handoff et lecture audio ; fournisseurs simulés pour races et erreurs. Les essais réels se font dans Lovable et `sandbox-ulrich`.
- Documenter ce qui passe, ce qui est indisponible et les limites de couverture. La baseline réelle se capture après publication, avec configuration inchangée, dates/effectifs/navigateurs/providers et révision ; ne pas la confondre avec les 41 tours de septembre. Le protocole 300 tours / 10 sessions concerne les comparaisons d'optimisation ultérieures.

## Livraison GitHub : une PR du lot, fusion par squash

1. Vérifier le remote, actualiser `origin/main`, noter la révision et créer une branche dédiée `codex/latency-lot-1-observability` depuis cette base. Réutiliser la branche si elle existe déjà pour ce lot. Isoler les travaux non liés sans les écraser.
2. Implémenter, tester et relire le diff. Inclure seulement le lot et sa documentation dans les commits. Réutiliser l'authentification GitHub sécurisée existante, avec la GitHub App de livraison en priorité lorsqu'elle est configurée.
3. Pousser la branche, ouvrir une PR vers `main` et attacher son URL au chat. La description présente problème, comportement résultant, preuves avant/après, compatibilité et rollback ; suivre le template du repo ou le skill PR applicable.
4. Corriger les retours et les échecs, obtenir les checks requis verts sur le HEAD exact et vérifier la revue. Fusionner avec **squash merge** (`gh pr merge --squash` si aucun connecteur GitHub natif adéquat n'est disponible). Ne pas utiliser de bypass admin, de force push sur `main` ou une fusion classique suivie d'une réécriture.
5. Vérifier l'état merged, relever PR et SHA squash réellement présent sur `origin/main`. Vérifier aussi les checks post-merge ; GitHub livré ne signifie pas Lovable publié. Si une gate bloque, présenter le blocage réel et continuer les corrections autorisées, sans annoncer une fusion non effectuée.

## Clôture et prompt Lovable à produire

À la fin, fournir résultat, fichiers, tests exécutés, PR, branche, SHA source et SHA squash, état GitHub/preview/production et reste. Produire en réponse un **prompt Lovable complet prêt à coller**, renseigné avec les valeurs réelles ci-dessous. Tant que la publication et les tests n'ont pas été effectués, les marquer « à faire ».

Le prompt Lovable doit demander, dans cet ordre :

1. **Reprise vérifiée** : ouvrir le projet Ava Proto 1 associé à `memoways/ava-proto1`, vérifier Lovable Cloud `iralfqlslqndgvexixis`, synchroniser `main` et confirmer que le SHA squash indiqué est inclus. Lire la PR, ce document et le plan général. Ne pas commencer le lot 2.
2. **Contrôle de compatibilité** : vérifier installation/lockfiles, alias Zod limité au MCP, compilation Lovable et fonctions/migrations précises du diff. Déployer les modifications backend par Lovable Cloud ; préserver secrets, OAuth, droits, réglages et comportement vocal. Une correction éventuelle reste dans le périmètre et doit être tracée avec sa révision réelle.
3. **Preview puis publication** : tester les parcours existants et les vues admin en preview. Si les contrôles passent, publier depuis Lovable pour permettre les tests du lot 1. Le MCP généré est vérifié après publication, car sa présence en preview n'est pas garantie. Ne pas activer les futurs flags voice-to-voice.
4. **Test publié** : via l'accès sandbox authentifié, lancer les scénarios Max/Emma, PTT et mains libres actuel, interruption, film et handoff. Vérifier que les nouvelles données PRD4 apparaissent dans MCP/admin/PostHog, que l'attribution TTS est cohérente avec l'adaptateur exécuté et que les tours incomplets/échecs sont visibles. Vérifier aussi le refus d'accès non autorisé. Recueillir une baseline récente dans `sandbox-ulrich` avec réglages inchangés et origines de mesure explicites.
5. **Retour de preuve** : donner URL publiée, révision effectivement servie ou méthode de vérification, état des fonctions/migrations, scénarios exécutés et résultats, couverture/effectifs, p50/p95 descriptifs, coût et anomalies éventuelles. Aucun gain de latence n'est revendiqué par ce lot d'observabilité. Distinguer les vérifications automatiques des tests qui restent à faire par Ulrich.
6. **Rollback** : en cas de régression, restaurer le comportement précédemment publié via Lovable et un revert tracé sur `main` ; conserver les données historiques et les migrations additives. Ne pas passer au lot 2 avant validation du lot 1.

Le prompt final nomme la **PR réelle**, le **SHA squash réel**, les **fichiers/fonctions/migrations réellement changés** et les **tests réellement passés**. Aucun numéro de PR ou SHA fictif, aucune promesse de publication déjà effectuée. Si l'assistant ne peut pas piloter Lovable par un outil autorisé, remettre ce prompt à Ulrich comme unique action : le coller dans le projet Lovable Ava Proto 1 ; le retour attendu est une publication identifiée accompagnée des résultats de test.

## Exécution en cours — 12 octobre 2026

Base actualisée : `95634e11e2f8b62ecb86a19b56d36e33db4b6848`. Branche :
`codex/latency-lot-1-observability`. Le diagnostic `npm ci --dry-run
--ignore-scripts` reproduit EUSAGE (SDK MCP absent, HeyGen et Drizzle divergents).
Accès GitHub au dépôt confirmé avec l'identité existante. MCP Ava natif : sur
1 jour dans sandbox-ulrich, 4 mesures audio et zéro tour legacy ; ce n'est pas
une baseline V2.

Implémentation additive dans les points d'entrée existants : événements V2
started/finished/GM bornés, attribution du résultat TTS et chunking au provider
résolu, chronologie client monotone et spans Edge isolés. Les jalons physiques
non observables restent null. MCP/admin lisent la projection technique sans
dialogue et séparent V1/V2. Dépendances alignées et Zod 4 réservé au MCP.
Aucun réglage de capture, d'interruption, de délai, de prompt ou de mémoire ne
change. Aucun déploiement externe ; vérification publiée à reprendre dans Lovable.

Les preuves de tests, de revue et de livraison seront consignées ici avant PR.

### Contrat réellement implémenté (P0)

- `voice_turn_started`, `voice_turn_finished` et `voice_turn_gm` dans
  `voice_turn_events.metadata_json`, et dans PostHog : `schema_version=2`,
  `attempt_id` UUID distinct par tentative, `turn_id` causal stable,
  environnement/personnage/mode/origine, version de code technique, versions de
  fiche et orchestration disponibles. V1 `voice_turn_completed`, tables et champs
  historiques conservés. Une annulation ne peut pas être refinalisée par un
  callback audio tardif. GM reste une observation distincte, hors dénominateur des
  tours, sans changement de mémoire ni de lancement.
- Offsets client par `performance.now()` relatifs à release PTT, décision
  applicative ou transcript final ; offsets capture antérieurs éventuellement
  négatifs. Spans Edge RAG : contrôle/quota, profil, embedding, recherche, rerank.
  Proxy LLM : contrôle/quota, headers upstream, body. GM côté client : génération,
  validation JSON/relation, persistance et disponibilité. Chaque processus a son
  `request_id` et son horloge ; aucune soustraction entre horloges indépendantes.
- Fin physique de voix, premier token batch, intention, phrase sûre et candidat
  acoustique restent null. Le premier chunk PCM, le scheduling et la sortie
  estimée sont distincts. Un Blob reçu n'est pas assimilé à son premier chunk.
  `t_turn_voice_ready_ms` V2 reste null sans vraie fin de voix. Les origines sont
  ventilées ; la couverture inclut les futurs jalons réservés et reste donc
  partielle en P0. Le dépassement de budget LLM ne prouve aucun segment critique.
- Résultat TTS exécuté pour provider/modèle/transport, override de personnage et
  fallback REST ; provider résolu utilisé pour le chunking, sans changer ses
  seuils, la concurrence (2) ou la prosodie. Modèles absents non inventés.
- Collecte V2 : 3 événements maximum par tentative (début, fin, disponibilité GM),
  tableaux bornés, 8 inserts simultanés maximum et abort à 5 s. Les erreurs et
  rejets sont absorbés ; aucun write attendu sur le chemin vocal. Saturation ou
  panne peut laisser une tentative `started` ou absente : ce n'est pas un succès
  inféré. Projection technique allowlistée avant collecte et avant lecture MCP.
- `get_voice_latencies` ajoute `summary.v2`, fenêtre effective, méthode de
  percentile, filtres d'environnement/personnage/versions/turn/attempt et
  provider/modèle/transport effectifs d'un **même service** (TTS par défaut).
  Données absentes exclues des filtres. 100 événements/page par défaut, maximum
  300, cap 3 000, ordre stable date/id et pagination. Statistiques **de la page**,
  pas d'une cohorte entière ; collecter les pages/dédupliquer les attempts avant
  une baseline. Les branches audio/turn legacy conservent l'interpolation
  linéaire, avec attribution historique non vérifiée et filtres limités à
  fenêtre/environnement. Le proxy PostHog V1 conserve son rang supérieur,
  maintenant annoncé explicitement, et ne convertit plus null/vide/booléen en 0.
- Admin Latences : section V2 distincte dans la vue existante, période sélectionnée,
  environnement actif, filtres et chronologie technique par événement, sans
  dialogue. Tous les outils MCP vérifient le rôle admin avec le client portant
  le JWT de l'appelant + publishable key ; aucun contournement RLS/service role.
- Dépendances : SDK 3.0.5 exact, alias `zod-mcp: npm:zod@4.6.6`, Zod 3 maintenu pour
  les formulaires. L'installation npm propre révèle que les types SDK suivent le
  peer hoisté : adaptateur typé/validé Zod 4 dans `src/lib/mcp/defineTool.ts`.
  Le plugin SDK 3.0.5 externalise mal les aliases npm : le wrapper Vite
  `scripts/lovableMcpPlugin.ts` lui fournit le specifier Deno `npm:zod@4.6.6`.
  La fonction MCP et son manifeste sont **régénérés par le SDK**, jamais édités
  à la main. Un seul package déjà verrouillé change de version : HeyGen 0.0.18
  → 0.0.19 pour satisfaire le manifeste préexistant ; aucune upgrade générale.
- CI : la gate complète reste active. Lint appliqué aux sources ; bundle MCP
  généré exclu, exception `prefer-const` limitée au broker d'auth généré Lovable.
  Regex OAuth et Gradium corrigées sans modifier leur acceptation. Fixtures E2E
  complétées avec les données d'attribution/fiche exigées par les gardes existantes ;
  le test film inspecte tous les messages du GM et conserve son assertion.

### Fonctions, migrations et livraison Lovable

Fonctions modifiées : `query-rag`, `proxy-llm`, `posthog-latency-stats` et `mcp`
(cette dernière générée). Helpers partagés `monotonicSpans.ts` et
`telemetryNumbers.ts`. **Aucune migration, aucun secret, aucune variable ni flag
modifié.** Ne déployer ces fonctions que dans Lovable Cloud
`iralfqlslqndgvexixis`. Le MCP doit être vérifié après publication.

Vérifications locales déjà réalisées : installation `npm ci`, typecheck,
`tsc -p tsconfig.node.json --noEmit`, lint, 43 régressions, 461 tests unitaires,
16 intégrations PGlite, compilation Vite de compatibilité et extraction du
manifeste MCP. Suite Playwright : **17/17** (15 existants et 2 nouveaux cas d’échec d’entrée) en mode CI
(Chromium, scénarios médias Firefox/WebKit), fournisseurs et réseau simulés.
Tests publiés Max/Emma, mains libres/barge-in réel, baseline sandbox-ulrich et
compilation/publication Lovable : **à faire**. Ces diagnostics locaux ne sont ni
une preview Lovable validée ni une publication. Aucun gain de latence revendiqué.

La cible PostHog 137897 « AVA prototype 1 », organisation
`019adb98-f8a7-0000-ad7c-552998c1fc21`, fuseau UTC, a été confirmée via sa liste native
sans lire sa clé API. Les données V2 publiées ne sont pas encore disponibles.

Rollback : revert du squash du lot sur main par PR, synchroniser/recompiler et
republier via Lovable. Restaurer le comportement précédemment publié si incident ;
conserver tables/événements historiques, aucune migration à inverser. Lot 2
bloqué jusqu'au retour de validation fonctionnelle publiée du lot 1.

### Revue et corrections avant fusion — PR #25

Revue indépendante via le skill `code-review`, deux axes sur la base `95634e1` :
Standards, zéro violation/smell actionnable ; Spec, trois lacunes corrigées avant
fusion. Les tentatives commencent désormais au geste de capture (origine
`capture_start` pour les entrées échouées), conservent leur attempt_id lors du
rebasage à release/décision, et finalisent échecs micro/STT ou flush vide. Les
jalons d'un ancien input ne sont pas réutilisés. Capture commencée côté adapter
et capture prête côté façade sont deux jalons distincts. Les spans HTTP d'erreur sont
conservés par RAG/LLM. Les spans GM ont `client_anchor_ms`, obtenu exclusivement
entre horloges client identiques ; les spans Edge restent isolés.

Premier check GitHub sur `79dd669` : échec d'un test Inworld préexistant, dû aux
classes Blob distinctes de Node Fetch et jsdom (fixture sérialisée en `[object
Blob]`). Fixture HTTP corrigée en contenu audio direct et assertion du contrat
size/type, sans changement fournisseur. Aucun check désactivé. Les tests et la
revue sont rejoués sur le dernier HEAD avant toute fusion.

PR : https://github.com/memoways/ava-proto1/pull/25 ; SHA squash à relever après
fusion. Preview Lovable, production et baseline publiée restent à faire.

La relecture des corrections a identifié un dernier cas de STT mains libres
réutilisé : son erreur ne doit jamais finaliser le tracker déjà transféré à la
sortie, ni viser la première capture lors d'un énoncé suivant. Le raccordement
sélectionne uniquement le tracker d'entrée courant du STT actif ; un ancien STT
ne finalise pas le nouveau. Test simulé ajouté : erreur pendant sortie, puis
pendant capture suivante, puis callback d'une ancienne session STT.

La barrière d'appartenance protège le **callback onError entier**, y compris
le teardown et ses effets UI. Le test vérifie que le teardown fourni n'est jamais
appelé pour l'ancienne session, et que le teardown du STT actif ne reclassifie pas
son input failed en cancelled.

Relecture finale sur le code `2d31836` : **Standards : 0 violation restante,
0 smell actionnable ; Spec : aucun blocage restant**. Les remarques précédentes
sont corrigées et leurs cas simulés testés. La PR #25 doit obtenir les gates
GitHub verts sur son dernier HEAD ; relever ensuite le squash réel et les checks
post-merge. Aucune publication Lovable n'a été effectuée dans ce lot local.

## Reprise de validation publiée — 12 octobre 2026, 18:46 CEST

Périmètre : uniquement lot 1 / P0. Compilation et publication passent
exclusivement par Lovable/Lovable Cloud ; aucune activation P1/P2 ni changement
de fournisseur, voix, prompt, mémoire, RAG, délai, capture ou interruption.

### Preuves vérifiées dans cette reprise

- `git fetch origin main` effectué sur le remote vérifié
  `https://github.com/memoways/ava-proto1.git`. `HEAD` et `origin/main` :
  `12d5f29311f6371af3d63a9c49e7cfc3626da352`, arbre propre avant cette mise à jour.
- [PR #25](https://github.com/memoways/ava-proto1/pull/25) lue via `gh`
  authentifié avec l'identité existante : `MERGED`, fusion le 12 octobre à
  14:27:41 UTC, squash `12d5f29311f6371af3d63a9c49e7cfc3626da352`, HEAD source
  `cbb4c3d3a792ebe8cdcc1ecd3ecb8875662adf7a`. Aucun diff entre leurs arbres.
- [Gate avant fusion](https://github.com/memoways/ava-proto1/actions/runs/38262317183)
  : `SUCCESS` sur le HEAD source.
  [CI post-merge](https://github.com/memoways/ava-proto1/actions/runs/38263082891)
  : `success` sur le squash ; étapes `npm ci`, `test:quality`, installation
  Playwright et `test:e2e` réussies. Tests automatiques historiques vérifiés
  par leurs résultats CI, pas rejoués localement dans cette reprise.
- Lecture de l'adaptateur `src/lib/mcp/defineTool.ts`, du wrapper
  `scripts/lovableMcpPlugin.ts` et du bundle généré : SDK 3.0.5 et imports
  `npm:zod@4.6.6` présents. Aucune régénération ni correction nécessaire sur
  cette seule inspection ; la compilation Lovable reste à vérifier.
- PostHog natif : cible `137897`, « AVA prototype 1 », organisation Memoways
  `019adb98-f8a7-0000-ad7c-552998c1fc21`, UTC, vérifiée et sélectionnée.
  La découverte `read-data-schema` retourne un snapshot
  `2026-10-12T11:50:14.540157+00:00`, antérieur à la fusion. Les noms
  `voice_turn_started`, `voice_turn_finished`, `voice_turn_gm` n'y figurent
  pas ; cela ne prouve pas leur absence après publication. Aucune cohorte,
  percentile ou coût récent calculé à partir de ce snapshot.

### Accès bloquants constatés

- Connecteur Lovable découvert dans le catalogue : disponible, **non installé**
  dans cette session. Aucun outil Lovable callable. Les instructions personnelles
  imposent l'activation du connecteur adapté avant l'accès au service ; aucun
  navigateur utilisé pour le contourner. La cible Cloud
  `iralfqlslqndgvexixis` est confirmée dans le dépôt, pas dans le projet Lovable
  distant. Installer le plugin Lovable et connecter le compte ayant accès au
  projet associé à `memoways/ava-proto1` est la prochaine action humaine.
- MCP Ava natif, `get_voice_latencies` avec `days=1` et
  `environment=sandbox-ulrich` : `tool execution failed`, code de connecteur
  `INVALID_ARGUMENT`, sans détail de cause. Aucune donnée retournée ; cette
  erreur seule ne démontre ni expiration OAuth ni panne du backend. Le schéma
  exposé dans cette session ne propose encore que `days`/`environment`, alors
  que le code fusionné ajoute `from`/`to` et pagination. Vérifier le MCP publié
  puis actualiser sa découverte avant une collecte V2 complète.
- PostHog : lectures de projet et découverte accessibles. Le chargement des
  skills internes au projet signale le scope `llm_skill:read` manquant ; le
  skill général de requêtes est accessible. Aucune reconnexion effectuée et
  aucune modification de données ou réglages PostHog.

### État réel et suite autorisée

| Surface | État vérifié |
| --- | --- |
| GitHub | P0 fusionné, SHA squash et CI vérifiés |
| Preview Lovable | Non ouverte, synchronisation et compilation non vérifiées |
| Production | URL documentée `https://ava-proto1.lovable.app` ; version effectivement servie non vérifiée, aucune publication dans cette reprise |
| Fonctions Cloud | `query-rag`, `proxy-llm`, `posthog-latency-stats`, `mcp` : état de déploiement non vérifié |
| Tests réels | Aucun scénario preview ou publié exécuté dans cette reprise |
| Baseline sandbox-ulrich | Non relevée ; effectifs, couverture, p50/p95 et coût indisponibles |

Après connexion Lovable : vérifier projet/dépôt/Cloud et inclusion du squash,
compiler et contrôler les quatre fonctions, exécuter les scénarios preview
de la demande, puis publier si les gates passent. Rejouer ensuite les scénarios
publiés, refus non-admin inclus, et collecter la baseline récente avec bornes
`from`/`to` fixes, pagination et déduplication par `attempt_id`. Conserver
révision servie, navigateur/version, sessions, configuration et attribution
effective. Le lot 2 reste non commencé jusqu'à validation fonctionnelle publiée.

Rollback inchangé : restauration de la version précédemment publiée dans
Lovable, revert tracé du squash `12d5f29311f6371af3d63a9c49e7cfc3626da352`
par PR, synchronisation, compilation et republication Lovable. Aucune migration
à inverser ; conserver toutes les données historiques. Aucun gain revendiqué.

## Reprise Lovable — 12 octobre 2026, 16:52 UTC (connecteur Lovable installé)

Périmètre : lot 1 / P0 seulement. Le blocage « connecteur Lovable absent » de la
section précédente est désormais historique.

### Cible et révision
- Projet Lovable « AVA Prototype 1 » ; HEAD `81f2226e277c4582714e4e795c22dfc79553b1cf`,
  ancêtre contenant le squash `12d5f29311f6371af3d63a9c49e7cfc3626da352`.
- Backend Lovable Cloud : `project_id = "iralfqlslqndgvexixis"` (config.toml, `.env`,
  ref inliné dans le bundle MCP) ; même instance pour preview et site publié.

### Compilation
- `tsgo -p tsconfig.app.json --noEmit` : 0 erreur. `bunx vitest run` : 100 fichiers,
  477 tests réussis (simulés, aucun fournisseur réel).
- `deno check` : `proxy-llm`, `posthog-latency-stats` sans erreur ; `query-rag`
  avait une erreur de type (TS2339 `rerank_score` absent de `RagDatabaseMatch`,
  introduite par le squash). Correctif P0 type seul : champ optionnel
  `rerank_score?: number` ; aucun changement runtime. Ensuite sans erreur.
- `mcp` : bundle régénéré par l'extraction du SDK `@lovable.dev/mcp-js@3.0.5`
  (4 outils), imports `npm:zod@4.6.6`, aucun import Zod 3 ; Zod 3 conservé pour les
  formulaires. `deno check` signale des `any` implicites dans le code généré par
  le SDK (non édité à la main). `defineTool.ts` et `lovableMcpPlugin.ts` inchangés.
- Erreurs Deno préexistantes hors P0, non corrigées : `manage-test-invitations`,
  `rag-question-corpus`, `redeem-test-invitation`.

### Fonctions Cloud
- Déployées : `query-rag` (sha256 source 912edf0f…a46), `proxy-llm`
  (58da1984…c80), `posthog-latency-stats` (b894a300…20e).
- `mcp` : retenue par Lovable lors du déploiement de développement ; ne sera
  déployée qu'à la publication. Le serveur MCP actuellement en ligne reste
  l'ancienne révision (log : `get_voice_latencies` → « Voice V2 diagnostics could not
  be read », cohérent avec l'erreur `INVALID_ARGUMENT` déjà constatée).
- Accès anonyme : `query-rag` et `proxy-llm` 401 « Invalid game identity »,
  `posthog-latency-stats` 401 « invalid token », `mcp` 401 sans jeton.

### Preview (Playwright headless, session admin ulrich injectée)
- Admin, sandbox-ulrich : vue Données/Sessions chargée (50 sessions).
- Parcours joueur bloqué à « Préparation… » : Chromium headless ne lit pas le
  codec H.264 du HLS d'introduction (`manifestIncompatibleCodecsError`). Le
  micro n'existe pas dans ce bac à sable (périphérique factice seulement).
- Non exécutés : Max, Emma, PTT, mains libres, interruption, audio complet,
  cinématiques, réponse film et replay, handoff, erreurs micro/STT, capture vide.
  À faire manuellement dans un vrai navigateur avec micro sur la preview.

### Verdict
Gate P0 partiel : compilation et trois fonctions OK ; MCP et scénarios vocaux
réels en attente. Aucun gain de latence revendiqué. Rollback : retirer le champ
optionnel (type seul) et redéployer les trois fonctions ; rollback global inchangé.

### Preuves complémentaires — 12 octobre 2026, ~17:00 UTC
- `bun run build` (lock `bun.lock`) : exit code `0`, sortie redirigée vers un fichier, sans pipeline. Seul avertissement : taille de chunk.
- Bundle MCP : bannière « AUTO-GENERATED by @lovable.dev/mcp-js », 6 imports `npm:zod@4.6.6`, 0 import `zod`/Zod 3.
- SHA256 des fichiers (différents des empreintes Lovable, qui portent sur fichiers + réglages) :
  - query-rag `fcfb39d3080167c8203a7d169100872db49011dfcbca562aba06abfcd0af5368`
  - proxy-llm `5c8370bd4cc3c8316bd830343793215f197c42f1b507cf581bce0814415c035d`
  - posthog-latency-stats `f18c6dd5f1f627f55fb4427ad3bebcab9ad2819927b9e8f7b946fd494fa31035`
  - mcp `ec4f25f3d554e38107e26f0ae1dfad940ea7e3aabec3db3da8ffea39cd3b1495`
  - _shared/monotonicSpans `2383744d480ad8b68bc5cb786325f9b83d027d44e6ce38aade3917bcea78eee1`, _shared/telemetryNumbers `7b804c3c1b4f85cb76de17e5b103515ecc1768db776afec091d540cd6b2187be`
- Correction `rerank_score` : commit `42266a97a2bab286ac8c5db03028195f6d1dd8e8`. HEAD `f3adb2f205e017146d15ce6b3d60c9bb1f1ad999` = `main` GitHub (API publique memoways/ava-proto1).
- Logs (16:55–16:58 UTC) : boot/listen/shutdown normaux sur les trois fonctions. `query-rag` et `proxy-llm` : `42501 permission denied for function consume_game_rate_limit` lors des requêtes anonymes de contrôle, suivies du refus 401 attendu. Origine non diagnostiquée, aucun droit modifié.
- Erreurs Deno du bundle MCP (TS7006, `any` implicite) : effet bloquant non observé. Le déploiement de `mcp` a été retenu par Lovable, pas tenté. Aucune conclusion possible avant la publication.
- Version MCP servie : non déterminable. Le seul message « Voice V2 diagnostics could not be read » ne prouve pas l'ancienne révision.

### Diagnostic « Mesures V2 indisponibles » — 12 octobre 2026, ~17:05 UTC (lecture seule)
- Cause observée : la table `public.voice_turn_events` **n'existe pas** dans Lovable Cloud `iralfqlslqndgvexixis`
  (`to_regclass` = NULL ; aucune colonne, RLS, grant ni policy). PostgREST, requête de `voiceTurnQuery.ts` :
  `PGRST205 — Could not find the table 'public.voice_turn_events' in the schema cache`. `voice_error_events` est absente aussi.
- Migration `20260522103000_voice_observability_events.sql` absente de l'historique appliqué (seule `20260821085107` est enregistrée).
  `20260821085107` n'ajoute `environment_id`/`context_type` que si la table existe (`IF to_regclass … IS NOT NULL`), donc l'ajout n'a pas eu lieu.
- Écart de contrat : la migration historique ne crée pas `environment_id` ; la requête V2 filtre dessus. Policies historiques `USING (true)` (lecture publique), incompatibles avec la règle « projections techniques refusées aux non-admin ».
- Écritures client : `voiceTelemetry.ts` désactive les inserts internes quand la table manque (non bloquant pour la voix) ; aucune donnée V2 n'a donc été stockée en base.
- Correction minimale proposée (non appliquée) : **une migration additive** créant `voice_turn_events` (colonnes historiques + `environment_id` FK `environments`, `context_type`), index `(environment_id, created_at DESC)`, GRANT INSERT à `anon`/`authenticated`, SELECT à `authenticated`, ALL à `service_role` ; RLS : insertion limitée à sa propre session, lecture réservée aux admins (`private.is_admin_member(auth.uid())`). Nécessite migration et droits, à valider avant.
- Build local : `dist/assets/index-DvEiVgQ4.js` (sha256 `78853a8d46bdf91c194b252d8b863eae41814f620d13db8eb5eece9c09f83331`), `index-DzvdyyNt.css`. Diffère du nom servi `index-42YnFYBP.js` ; le nom seul ne permet pas de conclure sur la révision servie.
