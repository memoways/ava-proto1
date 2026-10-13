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

## Sous-lot P0 : rétablissement du stockage — préparation du 12 octobre 2026

Cause reproduite : la lecture admin V2 retourne une erreur, et la lecture Cloud
native confirme `PGRST205`, table inexistante. La migration historique n'a
jamais été appliquée ; ses policies publiques ne doivent pas être réactivées.
Le diagnostic invalide l'hypothèse précédente « MCP ancienne ».

Préparation sur `codex/p0-telemetry-storage`, sans application Cloud ni
publication :

1. Créer une migration additive dédiée à `voice_turn_events`, avec le contrat
   historique et les dimensions environnement/contexte requises par P0.
2. Autoriser INSERT uniquement à `authenticated` pour sa propre session de
   moins de quatre heures, avec les dimensions exactes de cette session.
   Les participants Auth anonymes utilisent aussi ce rôle. Aucun grant à
   `anon`, aucun INSERT avec session absente/null ; ces refus restent hors
   chemin vocal. Le collecteur PostHog existant est indépendant.
3. Réserver SELECT aux membres admin via le helper existant, ne donner aucun
   UPDATE/DELETE aux utilisateurs et ne modifier ni `sessions`, ni les helpers,
   ni les données historiques. Le rôle serveur conserve ses droits techniques.
4. Tester le SQL réel dans PGlite : capture propre, étranger/dimensions
   falsifiées/ancien tour/null refusés, accès public/non-admin absent, lecture
   admin V1/V2 et pagination, réapplication sans suppression de données.
5. Présenter le diff et les résultats avant validation humaine de l'écart
   « aucune migration ». Après validation seulement : chaîne PR/checks/revue,
   fusion, application via Lovable Cloud `iralfqlslqndgvexixis`, contrôle admin
   et MCP, puis reprise des gates preview/publication et baseline.

Le changement n'ajoute pas `voice_error_events`, également absente : le besoin
de cette table legacy sera traité séparément si la gate l'exige. Pas de nouvelle
mémoire, de flag, de fournisseur ni de comportement vocal. Rollback du stockage :
désactiver ses nouveaux grants/policies via une migration tracée dans Lovable,
conserver la table et ses données ; ne jamais la supprimer pour revenir au P0.

Références de sécurité vérifiées : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
et [rôle des participants Auth anonymes](https://supabase.com/docs/guides/auth/auth-anonymous).

### Preuves locales du sous-lot de stockage

- Fichier généré par `supabase migration new` :
  `supabase/migrations/20261012170925_p0_voice_turn_events_storage.sql`.
  Le CLI n'est utilisé que pour la création locale du fichier ; aucune connexion
  ni migration Cloud effectuée par ce CLI.
- `npx vitest run src/integration/voiceTurnEventsRls.integration.test.ts` :
  avant correction, erreur `42P01`, table absente ; après, contrôles réussis.
- `npm run test:integration` : **29/29** (13 nouveaux contrôles de stockage +
  les 16 contrôles existants de sessions/environnements).
- Typecheck, ESLint ciblé et `git diff --check` réussis. Aucun changement runtime
  ni build externe ; la compilation Lovable précédente reste distincte.
- SQL de stockage limité à `voice_turn_events`. Les grants par défaut sont
  révoqués explicitement ; seuls INSERT/SELECT sont réaccordés au rôle
  `authenticated`, avec RLS propre session/admin. Aucun UPDATE/DELETE utilisateur.
  Les policies historiques publiques sont retirées si cette table avait été
  créée dans un autre environnement. La suite teste aussi ce cas et conserve
  ses lignes V1. La fonction admin existante n'est pas modifiée.

### Contrôles réellement exécutés sur le domaine publié

Compte admin `ulrich.fischer@memoways.com`, contexte affiché « Sandbox — Ulrich ».
Le bouton « Tester moi-même » a ouvert `https://proto1.parle-a-ava.com/?env=sandbox-ulrich`.
Introduction jouée avec vidéo H264 prête (`readyState=4`, temps de lecture
progressant, aucune erreur, muted=false). Le choix de contrôle « film non vu »
est suivi d'un replay de l'introduction ; le retour conserve le chemin choisi
sans redemander la réponse film. Max passe « EN LIGNE », affiche son ouverture
et propose « Activer le micro », donc réglage courant mains libres. Micro jamais
activé : aucun énoncé utilisateur, test acoustique, interruption ni baseline.
Emma, handoff narratif et erreurs de capture restent non exécutés.

Admin V2 présent sur `/admin/qualite/latences-posthog`, V1/V2 visuellement
séparées ; « Appliquer les filtres V2 » reproduit l'erreur de table absente.
Le refus d'accès admin sans rôle a été observé avant connexion, puis l'accès
nommé fonctionne. L'asset principal servi est `/assets/index-42YnFYBP.js` :
révision applicative exacte inconnue ; ces contrôles ne prouvent pas le dernier
build Lovable `index-DvEiVgQ4.js`. Aucune nouvelle publication effectuée.

Statut à la préparation : correctif de stockage préparé et testé, application
Cloud et fusion alors en attente de validation (accord et application ci-dessous). Baseline V2 récente,
effectifs, p50/p95 et coût non relevés ; ne pas les remplacer par les sessions
historiques. Lot 2 non commencé.

### Application du stockage P0 `voice_turn_events` — 12 octobre 2026, ~17:30 UTC
Statut du sous-lot : **validé par Ulrich, appliqué** ; parcours réel et publication restent à faire.
- Cible confirmée avant action : `project_id = "iralfqlslqndgvexixis"` ; squash PR #26 `979c8b3e23c80c439f8c13388212fb8986e07247` ancêtre de HEAD ; table absente juste avant.
- Appliqué via l'outil de migration Lovable Cloud, contenu de `supabase/migrations/20261012170925_p0_voice_turn_events_storage.sql`
  identique au caractère près (seul écart : saut de ligne final). Enregistré par Lovable comme
  `drizzle/migrations/0004_p0_voice_turn_events_storage.sql` ; types régénérés. Aucun autre SQL exécuté.
- Vérifié : 11 colonnes (historiques + `environment_id` NOT NULL FK `environments`, `context_type` NOT NULL CHECK) ; 5 index dont
  `idx_voice_turn_events_environment_page` ; RLS active ; policies uniquement « Participant inserts telemetry for own session » (INSERT, authenticated)
  et « Admins read voice telemetry » (SELECT, authenticated). Privilèges : anon aucun ; authenticated SELECT+INSERT, pas UPDATE/DELETE ; service_role tous.
  0 ligne (aucune mesure synthétique ajoutée). `voice_error_events` toujours absente, non touchée. Historique préservé (sessions 99, audio_latencies 2621).
- Requête exacte `readVoiceTurnPage` rejouée par REST (fenêtre 11–13 oct., sandbox-ulrich, schema_version 2, range 0–100) :
  anon → `42501 permission denied for table voice_turn_events` (HTTP 401) ; admin Ulrich avec son JWT → HTTP 200 `[]`. PGRST205 disparu.
  V1 (`audio_latencies`/`turn_latencies`) et V2 (`voice_turn_events`) restent des sources séparées.
- Non vérifié : lecture refusée pour un participant authentifié non admin (aucun compte existant disponible sans en créer un) — couvert par les tests PGlite de la PR #26 ;
  insertion Cloud non testée pour ne pas inventer de mesures.
- Compilation : `bun run build` exit `0`, `index-DvEiVgQ4.js`, révision HEAD `85fac07439384952b9c36b3529fb657d5e288f42`
  (= squash #26 + commits Lovable de migration). Bundle MCP régénéré par SDK `@lovable.dev/mcp-js@3.0.5`, 6 imports `npm:zod@4.6.6`, 0 Zod 3, plugin non modifié ; manifeste 4 outils.
- Fonctions : `query-rag`, `proxy-llm`, `posthog-latency-stats` déployées plus tôt (sources inchangées, sha256 identiques à la section précédente) ;
  `mcp` (sha256 `ec4f25f3…1495`) déployée seulement à la publication. Version MCP servie non déterminée ; à revérifier après publication.

### Vérification indépendante après application — 12 octobre 2026

- Accord humain explicite dans Codex : « oui je valide cette migration additive ».
- PR #26 passée de brouillon à prête, puis fusionnée par squash avec verrouillage
  du HEAD testé `e0fe99c49c3d75f9d8a5ddc0ae9c680c754e2d5d` :
  `979c8b3e23c80c439f8c13388212fb8986e07247`, le 12 octobre à 17:28:41 UTC.
- CI avant fusion [38283146780](https://github.com/memoways/ava-proto1/actions/runs/38283146780)
  réussie ; CI post-merge [38284464103](https://github.com/memoways/ava-proto1/actions/runs/38284464103)
  réussie sur le squash. Aucun bypass ni changement de gate.
- CI [38284818057](https://github.com/memoways/ava-proto1/actions/runs/38284818057)
  également réussie sur `716c811cdc9b2373da49610ea18c59168e4f9d35`, avec
  les fichiers et types générés par Lovable après application.
- Revue Standards indépendante sur `e0fe99c` : aucun constat actionnable.
  Revue Spec indépendante : aucun blocage ; les writes finaux et GM après
  raccrochage restent possibles, sans filtre `ended_at` ajouté.
- Comparaison locale après récupération de `main` : le SQL Lovable
  `drizzle/migrations/0004_p0_voice_turn_events_storage.sql` est identique au
  SQL approuvé après normalisation du saut de ligne final. Le journal/snapshot
  et les types Supabase ont été générés par Lovable, pas maintenus en parallèle.
- **MCP Ava natif réussi** : `get_voice_latencies`, `days=1`,
  `environment=sandbox-ulrich`. Fenêtre exacte retournée
  `[2026-10-11T17:31:45.936Z, 2026-10-12T17:31:45.936Z)` :
  V2 0 événement, 0 tentative, 0 observation GM, 0 ligne invalide,
  offset 0 / limit 100 / nextOffset null, cap 3 000 non atteint. Toutes les
  durées V2 absentes et leurs percentiles restent `null`. V1 distincte :
  5 mesures audio, 0 tour legacy ; ces données ne constituent pas une baseline
  V2 et ne sont pas mélangées aux 41 tours de septembre.
- **Admin du domaine publié** : après « Appliquer les filtres V2 », l'erreur
  disparaît ; « 0 tentatives », « 0 observations GM », « Aucune donnée V2 dans
  cette fenêtre », pagination désactivée. Le rôle nommé/sandbox-ulrich reste
  actif. Un résultat vide n'est pas une latence égale à zéro.
- Ce retour MCP démontre que l'endpoint sert déjà le contrat V2 ; il ne prouve
  pas sa révision exacte ni le déploiement du dernier build. Aucune nouvelle
  publication frontend effectuée dans cette reprise.

Sous-lot de stockage **fusionné, appliqué et lecture admin/MCP vérifiée**.
Un nouveau contrôle Max a été préparé via « Tester moi-même » en sandbox-ulrich,
chemin « film non vu », avec le réglage mains libres inchangé. L'échange réel
au micro est demandé à Ulrich ; aucune réponse utilisateur ni tentative V2
ne doit être inférée avant sa réalisation et sa lecture effective. Publication,
scénarios vocaux publiés complets et baseline restent en attente de cette gate.
Lot 2 non commencé ; aucun gain de latence revendiqué.

### Contrôle vocal réel et correction du statut quota — 12 octobre 2026

Ulrich a confirmé « Échange terminé ». Lecture Ava native à 17:54:47 UTC :
fenêtre `[2026-10-11T17:54:47.404Z, 2026-10-12T17:54:47.404Z)`, sandbox-ulrich,
3 événements V2, 1 tentative terminée, 1 observation GM, 0 ligne invalide,
page offset 0 / limit 100 / nextOffset null, cap 3 000 non atteint.
Session `accc1e30-16bd-491d-a83e-f8a1cad8f137`, tentative
`6ec5be6f-54c9-4d46-b68a-f24d1bc5b4e7`, Max, mains libres inchangé.
STT Deepgram/nova-3/websocket ; LLM OpenAI/openai/gpt-5.6-luna/http_batch ;
TTS gradium/gradium-tts/websocket, override personnage vrai, aucun fallback,
aucun retry TTS. GM Google/google/gemini-2.5-flash/http_batch distinct.
Attribution de voix précise absente de la projection : ne pas l'inférer.

Origine app_turn_decision : réponse LLM 5 849 ms, sortie estimée 6 823 ms,
génération 5 167 ms, playback 9 535 ms ; p50=p95=6 823 ms descriptifs, n=1.
Couverture partielle 15/27 ; fin physique de parole/premier token batch null.
Version déclarée `0.26.0+voice-telemetry-v2`, prompt
`2026-10-12T11:04:20.434763+00:00`, config
`9217fd34-321a-45c7-8363-6a8cf0b0157c`. Révision frontend servie inconnue,
donc contrôle post-migration, pas baseline finale après nouvelle publication.
PostHog 137897 confirme les trois mêmes événements et identifiants dans
`[2026-10-12T17:50:00Z, 2026-10-12T18:00:00Z)` ; navigateur déclaré par
PostHog Chrome 155.0 / Mac OS X (navigateur hôte Codex In-app Browser).
Coût Ava days=1 global sans filtre environnement/session : 4 appels LLM
completed, 13 370 tokens, 0,0068 USD, incluant 2 chat + 2 GM ; ce n'est pas
le coût attribuable au seul tour ni le coût STT/TTS/RAG complet.

Anomalies : capture_ready précède capture_started de 484 ms ; le signal
façade après start() ne garantit pas l'ouverture WebSocket du fournisseur.
Ne pas interpréter ces jalons comme une chronologie acoustique exacte.
Les spans control_quota sont failed malgré une requête poursuivie :
failedResult(null) considère comme échec le null de succès d'enforceGameRequest.

Plan correctif autorisé P0 : conserver le classifieur par défaut pour les
résultats DB/validation, ajouter un prédicat de résultat explicite aux spans
async, et passer `denied => denied !== null` aux deux contrôles quota.
Vérifier autorisation null → ok, refus HTTP → failed, exceptions → failed,
retours DB invalides inchangés et réponse de contrôle retournée à l'identique.
Aucun changement d'auth, de quota, de réglage vocal, de SQL ni de secret.
Tests ciblés/typecheck/lint, PR distincte revue et CI avant squash main,
puis synchronisation/compilation/déploiement des deux fonctions via Lovable.
Publication finale et scénarios complets restent soumis aux gates d'origine.

Diagnostic Lovable confirmé (message `umsg_01m4rm7r3dedfb91m7q26nrxh0`) :
le quota de cette session est consommé à 17:54:11 (query-rag) et 17:54:14
(proxy-llm), sans erreur game-guard sur la période. EXECUTE RPC réservé aux
rôles authenticated/service_role/postgres, pas anon. Le défaut vient du
collecteur introduit par P0 ; les erreurs 42501 de 16:55 venaient des probes
anonymes. Pas de refus réel ni de fail-open constaté sur l'échange humain.
Lovable a néanmoins écrit son diagnostic dans `.lovable/plan.md` (commit
`7c8a9cbd9631ce177bbb6a296ff5b4a0df7b168f`) malgré la consigne lecture seule ;
ce document ne constitue pas une application du correctif.
Pré-implémentation : confiance >=90%, cause reproduite par un test rouge,
module existant réutilisé sans dépendance ; signature callback/générique
vérifiée dans le [Handbook TypeScript](https://www.typescriptlang.org/docs/handbook/2/functions.html).

Complément au correctif P0 : `DeepgramSTT.start()` se termine après création
du WebSocket, avant son ouverture et `MediaRecorder.start()`. Le jalon façade
`capture_ready` était donc prématuré. Le retirer de la page et l'émettre dans
les quatre adaptateurs, immédiatement après le démarrage effectif déjà
observé par `capture_started`. Garder strictement les appels start(),
les connexions, les buffers et l'ensemble des décisions inchangés.
Vérifier par un WebSocket différé que la capture n'est pas déclarée prête
avant son ouverture et que les deux jalons suivent le démarrage du recorder.

### Livraison des corrections de mesure P0 — 12 octobre 2026

- PR [#27](https://github.com/memoways/ava-proto1/pull/27), source finale
  `3e3ef39826d808036941d17e8220df709df405aa`, squash vérifié sur main
  `6ad0d422fce66d6ea04c483fa22e743aa371d119` à 18:14:13 UTC.
- CI avant fusion [38288762851](https://github.com/memoways/ava-proto1/actions/runs/38288762851)
  réussie : npm ci, typecheck, lint (0 erreur, avertissement hook préexistant),
  44 régressions, 463 unitaires, 29 intégrations, build et 17 E2E simulés.
  Revues Standards et Spec sur HEAD final : 0 constat actionnable chacune.
  CI post-merge [38289544891](https://github.com/memoways/ava-proto1/actions/runs/38289544891)
  réussie sur `6ad0d422fce66d6ea04c483fa22e743aa371d119` (lecture indépendante).
- Sources locales SHA256 : helper monotonicSpans `47b066c9cf9fd9783a0a553fec41ac72eaa7f44f2c73e4247dd983bb48c78497` ;
  query-rag `16c0e7c49b6dd3ec254db737f6d5c48fbd2f8620181b353d49bc9018e832af25` ;
  proxy-llm `f0bb764fb3f7334faf77bb82057adfd07c0742c77b028074b799de0bd6b9cc07`.
  posthog-latency-stats inchangé (`f18c6dd5…1035`). Ces empreintes ne prouvent
  pas encore le déploiement des corrections.
- Admin après rechargement de la fenêtre : 1 tentative Max completed,
  1 observation GM, couverture partial, 0 ligne invalide ; p50/p95 6 823 ms.
  PostHog du même attempt confirme output_ms 6 823, voice_end/first_token null,
  capture_started -3 338 et capture_ready -3 822 (avant correction), 15/27.
- Second parcours Emma préparé par UI depuis la sandbox authentifiée,
  chemin film non vu, réglages mains libres inchangés, accueil vocal visible
  EN LIGNE. Échange demandé à Ulrich, pas encore confirmé. Frontend publié
  antérieur aux corrections #27 ; ne pas qualifier cet essai de validation
  du nouveau build. Reprise/film replay déjà observés lors du premier parcours.

**Blocage explicite Lovable** : diagnostic initial
`umsg_01m4rm7r3dedfb91m7q26nrxh0` attend `plan--show`, paramètres
`{"path":".lovable/plan.md"}`, événement
`main:agent#00000000648567#tcb:OPSKINZK`. La reprise de compilation et du
déploiement query-rag/proxy-llm (`umsg_01m4rn57pdewvbkf346q489wxc`) est
`queued`, `queue_paused=true`, raison `hitl_tool`. Le connecteur
respond_to_approval impose une décision humaine après présentation des
paramètres ; ne pas décider automatiquement ni contourner par le navigateur.
La décision demandée dans Codex est de rejeter ce plan ancien (recommandé),
car les corrections sont déjà fusionnées. Aucune décision encore reçue.

GitHub livré ; nouvelle compilation/déploiement des deux fonctions non
effectués par cette reprise à ce stade, ancienne version publiée toujours servie. Aucune nouvelle
publication frontend. Baseline finale après publication, refus réel avec
compte participant, Emma/interruption/PTT/handoff complets restent à vérifier.
Le résultat Max n=1 est un contrôle réel post-migration, pas une comparaison
de performances. Lot 2 non commencé.

Contrôle natif get_project après synchronisation GitHub : HEAD Lovable
`d700e62fb8af5d0246d2cb18150b016cafbc9dc2`, projet ready. Contrôle visuel
en lecture de la preview : écran « EXPÉRIENCE PRIVÉE » et bundle DOM
`/assets/index-9MfUAJhs.js`. Aucun mot de passe saisi, aucun jeu lancé sur
cette preview ; onglet de contrôle fermé. La correspondance exacte du hash
avec un journal de compilation Lovable reste à obtenir ; ready ne suffit pas
à prouver le déploiement Edge demandé. L'onglet Emma sur le domaine publié
est laissé pour la reprise, micro non activé par l'agent.

### Reprise après décision humaine — 12 octobre 2026

Ulrich confirme « Rejeter cet ancien plan (recommandé) » et signale que
l'onglet Emma n'est pas visible. Rejet transmis à respond_to_approval sur
`main:agent#00000000648567#tcb:OPSKINZK`, résultat accepted/rejected.
Lovable a reproposé un plan de reprise au même chemin (nouvel événement
`main:agent#00000000648611#tcb:OQ6NJIPB`) ; rejet également transmis afin
de terminer le diagnostic et libérer la demande déjà en file. Les deux
diagnostics sont maintenant completed et la demande de build/déploiement
`umsg_01m4rn57pdewvbkf346q489wxc` est **completed**. Aucun blocage HITL
ne subsiste pour cette demande.

- HEAD compilé Lovable `771c3f1382a90f282bd05b319bc20fc86badfd7a`, identique
  à main récupéré ; `6ad0d42`, `12d5f29` et `979c8b3` inclus. Depuis
  `6e52733`, seuls les commits de `.lovable/plan.md` ont changé ; code intact.
- `bun run build` exit 0 ; asset `index-2uc8XJ7K.js`, SHA256
  `1207afac872e6316b300c10c20ff9db885fa14a23e15a12dcb0b13cf8097c542`.
  Tests ciblés Deepgram/V2 29/29 sur Lovable ; autres adaptateurs vérifiés
  par lecture, pas par un nouveau test navigateur. MCP généré SDK, 6 imports
  Zod 4, hash inchangé `ec4f25f3…1495`, pas de maintenance parallèle.
- query-rag et proxy-llm **redéployées sur Lovable Cloud iralfqlslqndgvexixis**.
  SHA256 fichiers respectivement `16c0e7c4…2af25`, `f0bb764f…cc07` et
  helper `47b066c9…8497`, identiques aux valeurs locales consignées plus haut.
  Empreintes de déploiement Lovable (fichiers + réglages, distinctes des hashes
  de fichier) : query-rag `9b1dcce1385ddaecd1abfbf8bef0185ede557fb24d7b094bd730fdffb94ea257` ;
  proxy-llm `1e45da95d117cb481f489030941a309d9bf10d1c6d1751f4a5a12183555a587c`.
  Probes anonymes : 401 Invalid game identity ; journaux immédiatement après
  déploiement vides. Aucun tour synthétique enregistré.
- posthog-latency-stats inchangée, déjà déployée précédemment ; MCP inchangée,
  déploiement/révision exacte après publication toujours à vérifier.
- Frontend corrigé non publié ; échange Emma à venir sur le domaine publié
  antérieur, donc capable de vérifier les Edge corrigées mais pas encore le
  déplacement capture_ready. Un vrai tour et compteur quota restent à relire.

Inventaire navigateur : l'ancien onglet de test n'existe plus ; admin Ulrich
toujours authentifié en sandbox. Nouvel onglet ouvert par « Tester moi-même »
(id CUA 7, provider `4ed26b59-449a-4a3f-912d-d95fd5a69744`) et conservé comme
deliverable. Emma affichée EN LIGNE après chemin film non vu, micro non activé
par l'agent. open_in_codex et navigation app demandées, mais l'ouverture du
panneau est toujours retournée queued ; la visibilité humaine n'est donc pas
confirmée. Le pilotage direct de l'application Codex est refusé par Computer
Use. Question envoyée à Ulrich : afficher le test dans Brave ou dans Codex.
Ne pas prétendre qu'un échange Emma a été exécuté. Publication finale,
scénarios complets et baseline finale restent en attente ; lot 2 non commencé.

Affichage du test résolu par Brave (choix par défaut annoncé après la question
de préférence sans réponse) : nouvel admin connecté comme Ulrich Fischer,
Sandbox — Ulrich, puis bouton officiel « Tester moi-même ». Onglet de test
Brave `1830093887`, URL `https://proto1.parle-a-ava.com/?env=sandbox-ulrich`,
Emma EN LIGNE, accueil visible, bouton Activer le micro, conservé deliverable.
Un premier accès à l'ancien onglet Brave a expiré ; une nouvelle ouverture
via l'identifiant navigateur 3 a fonctionné, sans reconnexion ni changement
d'identité. Admin temporaire fermé. Ancien test intégré (micro inactif)
terminé par UI puis fermé pour éviter deux sessions en parallèle ; aucun
échange utilisateur n'a été enregistré par l'agent. Échange humain Emma
toujours à effectuer et à confirmer ; frontend publié antérieur, Edge corrigées.

### Contrôle réel Emma après redéploiement Edge — 12 octobre 2026

Ulrich confirme « Brave, dans une fenêtre visible » puis « échange Emma terminé ».
MCP Ava natif : fenêtre `[2026-10-11T18:55:39.470Z, 2026-10-12T18:55:39.470Z)`,
page offset 0 / limit 100 / nextOffset null, cap 3 000 non atteint, 0 ligne
invalide. La page contient aussi Max antérieur : ne pas utiliser son agrégat
global pour une comparaison avant/après. Cohorte Emma isolée par session
`c052127f-6e96-4697-b30c-5f3fc8979c21` (début 18:51:42.493Z), 9 événements
V2, 3 tentatives distinctes, 3 observations GM indépendantes :

| Tour / tentative | État final | Décision → sortie estimée | Couverture |
| --- | --- | --- | --- |
| 1 / `11c547b9-1c22-4f6f-a328-0003fecc5c63` | interrupted avant contexte/LLM/audio | null | 7/27 |
| 2 / `4dcf3a4a-18ab-44ef-b997-5db3a674758a` | completed | 5 882 ms | 13/27 |
| 3 / `129c51fe-c86b-4e69-8edb-99381c3013e6` | completed | 4 186 ms | 15/27 |

Origine `app_turn_decision`, précision `software_estimate`. Descriptifs pour
les seules 2 sorties mesurées / 3 tentatives : p50 5 034 ms, p95 5 797 ms,
interpolation linéaire `(n-1)*p`, arrondie au ms. L'interruption n'est pas
remplacée par zéro. Ce petit contrôle ne constitue pas un gain de latence,
ni une baseline finale après nouvelle publication. Fin physique de parole
et premier token batch restent null. L'interruption est avant génération,
pas une preuve de barge-in pendant lecture audio.

STT Deepgram / nova-3 / websocket ; LLM OpenAI / openai/gpt-5.6-luna /
http_batch ; TTS gradium / gradium-tts / websocket, override personnage
vrai, sans fallback ni retry. GM des deux tours terminés : Google /
google/gemini-2.5-flash / http_batch. Voix exacte non exposée par le contrat
technique ; version navigateur non relevée (Brave confirmé par UI et Ulrich).
Prompt Emma `2026-10-12T11:03:37.612668+00:00`, config
`9217fd34-321a-45c7-8363-6a8cf0b0157c`, code déclaré
`0.26.0+voice-telemetry-v2`. Bundle DOM réellement servi dans Brave :
`/assets/index-42YnFYBP.js`, frontend publié antérieur au correctif capture.
Capture_ready est donc encore prématuré (tour3 -3 685 vs started -3 292 ms).
La session metadata « push_to_talk » décrit la modalité configurée ; les
trois tentatives sont `hands_free`. Aucun test PTT réel ne peut en être déduit.

**Correction quota validée sur trafic réel** : 4 spans control_quota `ok`
sur les deux tours terminés. Requête Cloud bornée en lecture seule via outil
Lovable natif : query-rag request_count 3, fenêtre 18:54:12.477486Z ; proxy-llm
request_count 1, fenêtre 18:55:17.431766Z. Ces compteurs sont par fenêtre
glissante réinitialisable, pas un total cumulatif des 3 tours. Aucun identifiant
utilisateur/secret affiché, aucune mutation SQL. La demande de diagnostic
par agent Lovable en mode actif avait été refusée par l'auto-review (risque
d'écriture/déploiement) ; remplacée par ces SELECT techniques bornés.

GM tour1 : execution_status failed, signal d'abort confirmé par booléen SQL
sur la note technique, sans extraire la note ; persistence réussie 252 ms.
Tours2/3 GM executed et persistés. Tour3 : action proposée handoff mais
player_switch_request.stance `defer` ; code existant neutralise l'offre lors
d'une demande joueur différée. UI reste Emma, sans bouton de transfert ;
handoff_count 0, aucun experience_event de transfert/blocage dans la fenêtre.
Ne pas présenter ce refus éditorial comme un transfert exécuté ou une panne.

**PostHog 137897 non rapproché pour Emma** : même session, événements V2,
fenêtre `[2026-10-12T18:50:00Z, 2026-10-12T19:00:00Z)` puis journée UTC
entière après absence : 0 ligne. Ne pas en déduire 0 tentative. Projet natif
reconfirmé AVA prototype1, organisation Memoways. Des événements pageview/
onboarding/phases existent sur la fenêtre, sans preuve qu'ils viennent de ce
tour. DOM : 3 scripts PostHog présents ; logs capturés aucune erreur PostHog
ou ERR_BLOCKED_BY_CLIENT. Cause indéterminée ; pas de désactivation de Shields,
pas de changement de consentement, pas de flag modifié.

Coût Ava natif days=1, global sans filtre environnement/session : 10 appels
(8 completed, 2 error), 27 856 tokens, 0,014 USD (GM 0,012 + chat 0,002).
Inclut Max, interruptions et autres appels du jour ; pas le coût isolé Emma,
ni un coût complet STT/TTS/RAG. Aucun chiffre absent n'a été inventé.

**Gate suivante réelle** : preview corrigée `/auth` ouverte dans Brave,
écran Connexion Admin non connecté (autre domaine que celui publié). Email
tenté, mais pilotage interrompu (`Detached`) ; résultat de saisie non confirmé.
Connexion humaine demandée sur l'URL de preview, sans mot de passe transmis
à Codex. Ulrich doit confirmer le back-office avant les parcours sur le
frontend corrigé. Nouvelle publication, validation capture corrigée, PTT réel,
barge-in audio, cinématiques/handoff exécutés et baseline finale restent ouverts.
Lot2 non commencé ; réglages et données historiques préservés.

### Connexion preview et préparation du contrôle réel — 12 octobre 2026, 19:22 UTC

Ulrich confirme « connecté à la preview dans Brave ». Back-office vérifié
sur le domaine preview, compte admin attendu et Sandbox — Ulrich. Ouverture
par le lien officiel « Tester moi-même » : onglet Brave `1830093908`,
`https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich`.
Introduction passée, réponse factuelle « Je n'ai pas vu le film », Max EN LIGNE,
micro inactif. Échange humain demandé, aucun tour vocal simulé par l'agent.

Bundle observé dans le DOM : `/assets/index-9MfUAJhs.js`. Il ne correspond
pas au nom du bundle produit par le build attesté (`index-2uc8XJ7K.js`) :
la révision effectivement servie reste à établir, sans assimiler le HEAD
GitHub au frontend chargé. Le prochain tour doit vérifier les jalons de
capture réels avant publication. Admin preview V2 chargé : 4 tentatives,
4 observations GM, 0 ligne invalide, toutes issues des essais précédents.
Aucune nouvelle publication du frontend, aucun réglage modifié ; suite et
baseline finale restent ouvertes, lot 2 non commencé.

### Correction du blocage d'appel après redémarrage — contrôle preview

Après Max, Terminer → Continuer → Recommencer, puis Emma après replay de
l'introduction : appel bloqué sur sonnerie 1/3. La réponse film reste pas_vu
(session Emma `ee94abb9-a5ae-4daa-98c4-95dcc2e11c6b`). Cause identifiée : le
timer précédent continue ses rendus ; `handleAnswered` dépend de l'objet
timer recréé ; CallingMaxScreen annule et recrée ses délais à chaque nouvelle
identité de callback. Ces fichiers n'étaient pas modifiés par la PR25.

Correction nécessaire au gate fonctionnel : conserver les trois sonneries
de 1 500 ms et le décrochage à 5 000 ms, planifiés une fois par montage ;
appeler la dernière callback validée sans réinitialiser les délais lors des
rendus parent. Annuler les délais au démontage. Aucun changement de réglage
vocal, de durée de session, de fournisseur ou de logique mains libres.
Test de reproduction avec callback renouvelée chaque seconde, callback
la plus récente, absence de double appel et annulation au démontage ;
revues Standards/Spec, CI et nouveau build Lovable avant validation réelle.
Confiance préalable ≥90 % : cause reproduisible, aucune autre implémentation,
pattern useRef/useEffect existant, APIs React18 sans nouvelle dépendance.
Références officielles et exemples React :
https://react.dev/reference/react/useEffect et https://react.dev/reference/react/useRef.

Reproduction automatique : nouveau test rouge avant correction (Emma reste
Appel en cours / 1/3), vert après. 12 tests ciblés CallingMaxScreen/useTimer/
ConversationScreen, typecheck, build et lint sans erreur (avertissement
préexistant IndexPRD4) réussis. Standards : 0 constat ; Spec : 0 blocage.

Contrôle humain Max preview confirmé : session
`f36f73e3-21ff-4b29-bfca-0c3b426c7df1`, fenêtre Ava native
`[2026-10-11T19:26:45.685Z, 2026-10-12T19:26:45.685Z)`, page0/100,
nextOffset null, cap non atteint, 0 invalide. 6 événements / 2 tentatives /
2 GM : `5f9b29e0-cd1c-4ef9-917c-8bd2d86d5997` interrompue avant génération,
capture_started = capture_ready = -2 284 ms (correctif capture observé) ;
`0c22d7b3-3346-4008-8111-2b1299c922cd` completed, sortie estimée 5 923 ms,
LLM réponse 4 932 ms, generation_total 5 451 ms, playback 10 111 ms,
couverture13/27 (capture réutilisée, jalons null). Une sortie mesurée / deux
tentatives : p50=p95=5 923 ms, descriptifs, sans gain revendiqué.
Origine app_turn_decision, software_estimate ; voice_end/first_token null.
Fournisseurs exécutés Deepgram/nova-3/websocket, OpenAI/openai/gpt-5.6-luna/
http_batch, Gradium/gradium-tts/websocket avec override, sans fallback/retry.
RAG quota87msok, LLM quota148msok ; GM terminé Google/gemini-2.5-flash,
génération/validations/persistence ok. Prompt Max et config identiques au
contrôle précédent. Première GM génération failed puis persistence ok.
Ce n'est pas une preuve de barge-in pendant lecture audio.

PostHog137897 Memoways : aucune ligne pour cette session entre19:20–19:30,
puis aucun événement sur toute la journée UTC12octobre. Aucun contenu privé
interrogé ; logs navigateur PostHog warn/error vides. Cause non établie,
réglages/consentement/protections préservés. DOM bundle9MfUAJhs inchangé,
capture corrigée attestée par comportement ; SHA servi exact encore inconnu.
Max terminé par UI à19:27:55.297Z ; Emma après replay conserve film pas_vu.
Publication frontend et baseline finale toujours en attente.

### Livraison PR28 et contrôle visuel Lovable — 12 octobre 2026, 19:47 UTC

PR https://github.com/memoways/ava-proto1/pull/28, HEAD source revu
`fc3f6894f0c8ccef40e90b1535bd8183a0ac0c7a`, squash main
`fa9bea9a1d306963c3336f541534f4e6841939e6`, fusion19:40:44Z.
CI avant fusion https://github.com/memoways/ava-proto1/actions/runs/38298510806
et post-merge https://github.com/memoways/ava-proto1/actions/runs/38299239967
réussies : qualité complète et17 E2E. Aucun fichier non lié dans le commit.

Lovable natif, message `umsg_01m4rt4ntketbrqqfge45cgnvx` terminé : HEAD
compilé fa9bea9, PR25/26/27 incluses, 3/3 CallingMaxScreen, bun run build
exit0. Bundle produit `index-ndT0HfP9.js`, SHA256
`8199e2e6acd39e0f8978c54a634f124f3af6858e58bc8921c52e48fbd8660ae3` ; CSS
`index-DzvdyyNt.css`, SHA256
`58ffb3e41b8105b49f656de148774dc77f479fb9b7741aec576c33fc60075253`.
MCP régénéré par SDK, 6 imports npm:zod@4.6.6 ; aucune Edge redéployée,
aucune mutation DB/réglage/secret. Lovable signale27 erreurs Deno préexistantes
sur redeem/manage-test-invitations et rag-question-corpus ; hors PR28,
laissées inchangées, build frontend réussi. Pas de contrôle Deno global vert
revendiqué, ni d'autorisation nouvelle demandée pour élargir le lot.

Attention provenance : l'agent Lovable a inspecté son localhost Vite
(`/src/main.tsx`, onAnsweredRef présent). Le domaine statique preview dans
Brave sert après reload `/assets/index-CG1cec7E.js` : cette observation prime
pour le test humain, et ne doit pas être assimilée au bundle ndT0HfP9 ni à
une empreinte SHA servie vérifiée. Nouveau bundle et comportement attestés.

Scénario réel UI rejoué dans le même onglet1830093908 : Max sans activer le
micro, puis Terminer→Continuer→Recommencer→film pas_vu→replay→Emma.
Emma décroche et affiche EN LIGNE avec bouton Activer le micro : blocage
résolu dans cette preview. Session Max vide de contrôle
`7cd81d13-d8b3-4d9f-b352-774c62067447` terminée par UI ; session Emma
`2032310e-17ec-4124-9e30-c06d83d2272c` début19:46:33.950Z, film pas_vu
confirmé via Ava natif, en attente de parole humaine. La session Emma
anciennement bloquée `ee94abb9-a5ae-4daa-98c4-95dcc2e11c6b` s'est terminée
par timeout à19:38:40.553Z, sans tour vocal inventé ni suppression de données.

PostHog reçoit3 pageviews Brave (versionnull) sur le domaine preview entre
19:20 et19:35 ; aucun rapprochement V2 de la session Max. La présence de
visites ne valide pas la remontée des tours. Les contrôles sans microphone
ne sont pas des captures vides et sont exclus de la baseline vocale.
Test Emma avec parole pendant réponse audio demandé à Ulrich ; résultat
et handoff à observer, sans changer de réglage. Publication frontend,
tests publiés et baseline finale restent ouverts. Lot2 non commencé.

### Interruption Emma confirmée et refus de transfert — 12 octobre 2026

Ulrich confirme « test Emma preview terminé oui emma s'est arrêtée ».
Session2032310e-17ec-4124-9e30-c06d83d2272c, film pas_vu, bundle statique
CG1cec7E. Snapshot Ava `[2026-10-11T19:59:44.868Z,2026-10-12T19:59:44.868Z)`,
page0/100, nextOffsetnull, capnonatteint, invalid0 :17 événements,6 tentatives
distinctes,5 GM. Origine app_turn_decision :5 tentatives,3 sorties mesurées ;
origine capture_start :1 tentative cancelled, sortie null. Toute couverture
partial ; les captures réutilisées n'inventent pas un nouveau capture_ready.

| Tentative | Tour | État | Sortie estimée / annulation (ms depuis décision) |
| --- | --- | --- | --- |
| 9e8c795e-f7eb-4098-b977-ed3ea24da077 | 1 | interrupted avant audio | null /3213 |
| c768c5d8-59cb-49dd-9491-4cb67c04a0f6 | 2 | interrupted après audio | 5077 /12487 |
| 0975baff-7b02-4c42-b0c7-81f03742e9c1 | 3 | interrupted avant audio | null /1746 |
| c6723e41-95fa-49b4-843d-86537c80a5e5 | 4 | cancelled, capture_start | null /585 |
| cb4eb685-9d30-4967-a801-40a7941cb196 | 4 | interrupted après audio | 5564 /13384 |
| 566ccadc-4745-4046-b0bf-9e2207345066 | 5 | completed | 3906 /null |

Les deux lectures commencées puis annulées concordent avec le témoignage
humain. Les écarts7410/7820ms sont du temps écoulé entre sortie estimée et
annulation, pas une latence acoustique de détection. interruption_confirmed
et voice_end restent null, aucun timestamp physique inventé. Dernière sortie
audio_end12117ms, playback9039ms, génération4847ms. Descriptifs des3 sorties
mesurées parmi5 tentatives app_turn_decision : p50=5077ms, p95=5515ms,
interpolation linéaire ; aucun gain, aucun mélange avec les autres sessions.
Capture_ready=capture_started quand observés. Deepgram/nova-3 websocket,
OpenAI/openai/gpt-5.6-luna batch, Gradium/gradium-tts websocket override,
sans fallback/retry. GM Google/gemini-2.5-flash :3 executed/persistés,2 aborts
avant génération persistés ; aucune erreur fournisseur affirmée à partir
d'un abort. Prompt Emma/config identiques au contrôle précédent. Tous ces
tours sont hands_free, malgré metadata session push_to_talk générique.

Session expirée20:02:40.827Z selon sa durée configurée. Ulrich recommence
lui-même dans le même onglet : session61f87a2f-4858-4ef5-896b-0a4de166a8b7,
début20:02:51.154Z, film vu (cohorte distincte), confirme ensuite « demande
de transfert terminée ». GM tour2 action handoff mais stance object, cible
Max : offre neutralisée conformément au garde-fou existant. UI reste Emma,
aucun bouton de transfert, handoffCount0. C'est un refus enregistré, pas un
handoff exécuté ni une preuve de branche acceptée.

Snapshot fermé Ava `[2026-10-11T20:07:53.201Z,2026-10-12T20:07:53.201Z)`,
page0/100 nextOffsetnull capnonatteint invalid0 :36 événements,12 tentatives,
12 GM,7 completed et5 interrupted avant audio.7 sorties mesurées
4050/4161/4276/4380/4475/4661/4679ms : p50=4380, p95=4674, origine
app_turn_decision, software_estimate. GM des5 interruptions : abort confirmé
par SELECT booléen sans extraire notes privées, persistence ok. Sept réponses
audio complètes, fournisseurs inchangés, pas de fallback/retry sur les sorties.
Pas d'agrégation avec sessionfilmnonvu ni avec septembre. Micro fermé par UI
puis appel terminé après confirmation humaine ; endedAt20:07:31.794Z,
reason user_hangup. Une réponse supplémentaire hors rôle narratif sur un
sujet technique a été observée dans l'UI ; pas de transcription copiée dans
ce plan, origine/non-régression P0 non établies, prompts métier inchangés.

PostHog137897 organisationMemoways et clé SDK concordants ; timezoneUTC.
Session2032310e :0 V2 entre19:45–20:05 ; fenêtre élargie sans filtre de
session :1 pageview preview,0 V2. system.ingestion_warnings entre17:30–20:10 :
aucune ligne. Logs capturés warn/error analytics/capture/blocked : aucune
ligne. Ces absences ne prouvent pas que le SDK a émis les événements ni que
Brave les a transmis. Diagnostic natif ingestion chargé ; health-issues sans
scope health_issue:read, pas de reconnexion générale imposée puisque la
lecture SQL native prévue par le skill fonctionne. Aucun réglage modifié.
Liste des domaines bloqués par Shields demandée à Ulrich en lecture seule :
capacité non exposée par les outils navigateur disponibles.

Coût Ava snapshot days1 global non filtré, au moment de la première lecture
Emma :30 appels (20completed,2success,8error),76288tokens,0.0344USD. Valeur
globale de la journée qui inclut d'autres sessions/aborts ; pas un coût
isolé de ces tests ni un total STT/TTS/RAG, ni la photographie finale après
les tours supplémentaires. Publication frontend toujours non effectuée ;
PTT réel, capture no_audio, handoff accepté, cinématique narrative déclenchée,
tests publiés et baseline finale restent non attestés. Pas de passage au lot2.

### Diagnostic Brave confirmé par Ulrich — 12 octobre 2026

Ulrich signale le script eu-assets.i.posthog.com/static/dead-clicks-autocapture.js
v1.402.3 bloqué. Sa capture du panneau Shields du domaine preview montre
également eu.i.posthog.com dans « Traqueurs et publicités (182) ». Ce second
host est le POSTHOG_HOST de posthogService.ts : blocage du canal de collecte
confirmé côté navigateur, explication probable de l'absence V2. Ne pas
attribuer le trou à ce seul script optionnel, ni prétendre avoir observé
chaque requête ou démontré l'absence de tout défaut applicatif.

Aucune protection navigateur, aucun réglage applicatif et aucun code modifiés.
Prochain contrôle proposé, soumis à accord explicite car il assouplit une
protection de confidentialité : exception Shields temporaire pour le seul
domaine preview, un échange vocal humain court, rapprochement des mêmes
attempt_id dans Ava et PostHog137897, puis rétablissement immédiat de Shields.
Les mesures avec cette exception formeraient une cohorte distincte ; elles
ne remplacent pas les essais avec protections actives. Ne pas toucher au
domaine publié, au profil global, aux flags, prompts ou fournisseurs.
Sans cet accord, garder Shields et signaler la couverture PostHog manquante,
sans corriger l'application par un contournement de la protection navigateur.
Frontend publié inchangé ; publication et gates non attestés restent ouverts.

### Exception Shields autorisée — contrôle en cours

Ulrich répond « Autoriser ce test temporaire ». Panneau natif Brave vérifié
sur le seul domaine preview : Boucliers activés, interrupteuron, puis
basculement autorisé et relecture Boucliers désactivés/interrupteuroff.
Réglages globaux et domaine publié non touchés. Le basculement recharge la
page ; bundle statique toujours index-CG1cec7E.js. Nouvelle session Max
`495c3568-ad9e-4609-90da-4b9d597c1c4b`, début20:27:14.376Z, film pas_vu,
micro non activé par l'agent. Échange humain court demandé.

PostHog137897, fenêtre20:25–20:30UTC : retour des événements applicatifs
prd4_phase_changed(6), prd4_persistence_result(3), session_started(1),
onboarding_started(1), film_answered(1), audio_latency(1), tts_performance(1),
session_duration_loaded(1), first_max_response(1), avec pageview/pageleave
et web_vitals. Cela confirme un effet du blocage Shields sur la collecte
applicative ; le tour vocal V2 n'a pas encore commencé. Ava à20:32:43.351Z :
aucun événement pour cette nouvelle session, micro fermé confirmé dans l'UI.
Pas de tour fictif ni de rapprochement V2 affirmé à partir du seul onboarding.

Version installée lue dans Info.plist de Brave :
CFBundleShortVersionString155.1.97.56, CFBundleVersion197.56. Ce relevé du
bundle installé est distinct de la version SDK navigateur, toujours null
dans PostHog ; ne pas inventer une version déclarée par l'événement.

État temporaire à ne pas oublier : Shields OFF pour la preview pendant
l'attente du test autorisé. Réactiver dès fin du tour, vérifier ON dans le
panneau du même domaine, avant clôture de ce contrôle. Aucun accord de
laisser cette exception durablement ni de modifier la production.

### Contrôle croisé V2 réussi, Shields rétabli — 12 octobre 2026, 22:39 CEST

Ulrich confirme « contrôle PostHog terminé ». Micro encore ouvert après
la réponse : fermé par l'agent via Couper le micro, fermeture vérifiée.
Session495c3568-ad9e-4609-90da-4b9d597c1c4b, tentative unique
`12c320d9-db0d-404e-8b93-bea9680cc077`, Max, hands_free, film pas_vu,
statuscompleted, config9217fd34-321a-45c7-8363-6a8cf0b0157c, promptMax
2026-10-12T11:04:20.434763+00:00. Frontend preview CG1cec7E.js, source
compilée fa9bea9 ; diff code/backend/dépendances entre fa9bea9 et HEADf677593
vide (seuls comptes rendus depuis). Exact SHA des octets servis non établi.

Ava natif : fenêtre `[2026-10-11T20:37:30.318Z,2026-10-12T20:37:30.318Z)`,
page0/100, nextOffsetnull, capnonatteint, invalid0,3 événements :
voice_turn_started20:36:18.602875Z, GM20:36:31.599278Z,
finished20:36:38.775723Z. Capture_started=capture_ready=-3298ms ; sortie
estimée4645ms, réponseLLM3778ms, generation_total6097ms, playback11420ms,
audio_end15203ms. Couverture15/27partial. Origineapp_turn_decision,
software_estimate, voice_end/first_token null. n1, p50=p95=4645ms descriptifs,
aucun gain revendiqué, cohorte distincte des essais Shieldsactif.

PostHog137897 natif, fenêtre fixe20:25–20:40UTC :3 mêmes événements et même
attempt_id, statuscompleted, origineapp_turn_decision,4645ms,15/27, mesures
absentes null. UUID PostHog started01a131d4-9788-79a2-822f-035e7bfb5df2,
GM01a131d4-ca7f-7a0c-9a41-ca6acd0d1642,
finished01a131d4-e6b4-71db-b7bf-0ed95992e236. Horodatages PostHog
20:36:18.468Z /20:36:31.551Z /20:36:38.736Z distincts de created_at DB,
pas fusionnés en une horloge. NavigateurBrave, version déclarée null,
version du bundle installé155.1.97.56 relevée séparément. Projection
technique seule ; aucune transcription, prompt textuel, token ou secret.

STTDeepgram/nova-3/websocket ; LLMOpenAI/openai/gpt-5.6-luna/http_batch ;
TTSGradium/gradium-tts/websocket, overridetrue, fallbackfalse,retry0.
Voix exacte non exposée par le contrat, aucune identité de voix inventée.
Quotas RAG109msok et LLM88msok ; tous spansRAG/LLMok. GMGoogle/
gemini-2.5-flash, génération/validation/persistence/availabilityok.

Restitution immédiatement après relevé : panneau natif du même domaine,
Boucliers désactivés/interrupteuroff→basculement→réouverture du panneau,
Boucliers activés/interrupteuron explicitement vérifiés. Réactivation
recharge la page, micro déjà fermé. Exception terminée ; protections
globales et domaine publié inchangés. Les événements après exception
permettent d'expliquer l'absence avec Shieldsactif sans changer le code
ni contourner durablement les protections du navigateur.

Coût Ava days1 global à22:39CEST :50 appels,110761tokens,0.0551USD,
32completed/18error. Les erreurs incluent des aborts et d'autres sessions :
pas un taux d'erreur de ce contrôle. Coût non isolé de la session, STT/TTS/RAG
non inclus, ne pas inventer un total complet. Réglages métier inchangés.

État de livraison réel : PR25–28 fusionnées, sourcefa9bea9 revue/CIprémérge
et post-merge réussies, buildLovable vert, Max/Emma réels en preview,
interruption audio et refus de transfert vérifiés, adminV2 et rapprochement
PostHogV2 réussis. PTT réel avec réglage actuel mainslibres, capture no_audio,
handoff accepté et cinématique narrative déclenchée non attestés ; couverture
automatique distincte (17E2E). Écart de rôle d'Emma observé sur un autre tour,
origine/non-régression non établie, aucun prompt métier changé. La condition
de publication de la demande initiale n'est donc pas présentée comme une
validation exhaustive. Publication Lovable, tests publiés et baseline finale
encore à effectuer ; lot2 non commencé. Choix de poursuivre ces validations
ou d'accepter une publication avec ces limites à demander à Ulrich.

### Contrôle PTT proposé avant publication — préparation en lecture seule

Suite proposée pour poursuivre la validation complète du lot initial :
un tour humain PTT et une capture sans parole. Aucun changement effectué.
Source settingsService→environmentContext confirme la sélection par
key/environment_id dans admin_settings ; sandbox peut avoir sa propre valeur
sans modifier prod. SELECT Lovable Cloud natif vérifié : clé
ava_gameplay_settings, sandbox-ulrich VOICE_HANDS_FREE.enabled=true,
hash JSON eafeb3c14b4890eb08d52d53d0c6aa5e ; prod hash
716aa4521856147da989b6cffb2a741b, champ enabled absent. Production distincte.

Accord explicite demandé, car la demande initiale impose la conservation
des réglages : basculer le seul booléen sandbox-ulrich à false pour une
nouvelle session de contrôle, puis restaurer true. Préserver toutes les
autres clés, timings, fournisseurs/voix et flags ; vérifier la valeur et le
hash initial après restauration, ainsi que le hash prod inchangé. Garder
Shields actif (son exception précédente est terminée). Aucun code nouveau,
aucune migration/donnée historique à modifier. Sans accord, ne pas changer
ce réglage et conserver PTT/no_audio réels comme non attestés.

### Reprise du contrôle PTT — 13 octobre 2026

Ulrich demande de continuer là où le lot s'est arrêté. Reprise du contrôle
PTT temporaire décrit ci-dessus, strictement dans sandbox-ulrich, avec
restauration du booléen initial après chargement du réglage pour la session.
Le changement ne doit pas rester actif pendant l'attente humaine : les
réglages sont chargés pour l'appel, puis la valeur serveur sera rétablie
avant la demande d'échange vocal. Production et autres clés préservées.

État initial relu via Lovable natif : projet1265958d-b74e-40f2-917d-182fe05163fc,
workspace5glbtPltldwz9tgNwIi4, ready/agentFinishedtrue, révision702d3d6394cb28ee15822a570467ee1c2218ee59,
base Cloud activée/supabase. Dépôt local propre à la même révision.
admin_settings.value est jsonb ; les deux hashes et valeurs correspondent
au relevé précédent : sandbox eafeb3c14b4890eb08d52d53d0c6aa5e/true,
prod716aa4521856147da989b6cffb2a741b/champ absent.

La lecture d'onglet par l'extension Brave échoue (Debugger unattached).
La fenêtre native Brave permet la validation visuelle : preview sandbox
sur l'accueil Commencer, aucun appel en cours. Shields activés/interrupteuron
confirmés pour le domaine exact de preview ; aucune protection modifiée.
Le contrôle natif de fenêtre reste limité à Ava.

Préparation réalisée : UPDATE conditionnel au hash initial et au hash prod,
uniquement jsonb_set(VOICE_HANDS_FREE.enabled=false), une seule ligne modifiée
à05:22:27.389501UTC, hash temporairef5c0308f452619165c57d2c7a462cab0.
Preview rechargée, introduction passée, film pas_vu, Appeler Max. UI native
confirme Max EN LIGNE / CLIQUE POUR PARLER / Démarrer l'enregistrement.
Sessione27466df-c94a-42c1-ae1b-8151e2f897a4, début05:23:04.330UTC,
sandbox-ulrich/contextsandbox, Max/tts. Aucune capture déclenchée par l'agent.

Avant l'attente humaine, restauration conditionnelle au hash temporaire
à05:23:27.244051UTC : enabled=true, hash initial
eafeb3c14b4890eb08d52d53d0c6aa5e retrouvé. SELECT distinct confirme prod
716aa4521856147da989b6cffb2a741b inchangé, y compris updated_at initial.
Toutes les valeurs JSON initiales sont restaurées ; seule la date d'audit
sandbox reflète la manipulation temporaire. Le mode PTT reste dans la
référence de réglages de cet appel déjà chargé, sans changement serveur
persistant pendant l'attente. Ne pas recharger l'onglet avant le contrôle.

Action humaine demandée : clic micro, courte phrase à Max, deuxième clic
pour envoyer, attendre sa réponse puis confirmer contrôle PTT terminé.
PTT réel et capture no_audio restent non attestés à ce stade. Publication
Lovable et baseline publiée encore à effectuer ; aucun lot2 engagé.

### PTT réel confirmé — 13 octobre 2026, 07:24 CEST

Ulrich confirme contrôle PTT terminé. Ava natif, fenêtre
[2026-10-12T05:24:44.072Z,2026-10-13T05:24:44.072Z), page0/100,
nextOffsetnull, cappedfalse, invalid0. Session préparée ci-dessus, tentative
7a1a2fb2-5392-4d9f-8beb-bd89789571e3,3 événements : started05:23:48.285169,
GM05:24:12.860596, finished05:24:20.615399UTC. input_modepush_to_talk,
origine finaleptt_release, statuscompleted. Capture_started=ready=-12713ms,
turn_decided0, flush_sent4, transcript_final219, contexte1760,
LLMresponse4074, premier chunk4715, sortieestimée5062, audio_end15835ms.
generation_total6194ms, playback11759ms, couverture15/27partial.
voice_end/first_tokennull, précisionsoftware_estimate. Cohorte PTTn1 :
p50=p95=5062ms descriptifs, distincte de mainslibres, aucun gain revendiqué.

STTDeepgram/nova-3/websocket, LLMOpenAI/openai/gpt-5.6-luna/http_batch,
TTSGradium/gradium-tts/websocket/overridetrue/fallbackfalse/retry0. Versions
prompt/config identiques au contrôle Max précédent ; aucun fournisseur,
timing ou contenu privé modifié. Tous spansRAG/LLMok, quotas80/144msok.
GMGoogle/gemini-2.5-flash, génération/validation/persistence/availabilityok.
Projection technique seule ; voix exacte non exposée.

Action humaine suivante demandée dans le même appel PTT : capture de deux
secondes sans parole puis deuxième clic. no_audio pas encore attesté.

### Capture sans parole confirmée — 13 octobre 2026, 07:26 CEST

Ulrich confirme capture sans parole terminée. Même session PTT, tentative
907816df-b7e6-4719-9d39-e25e765571a0, started05:25:32.693074UTC puis
finished05:25:42.919854UTC, statusno_audio, originecapture_start.
Capture_started=ready1494ms, turn_decided10266, flush_sent10282 ; durée
observée de capture environ8.8s, différente des2s proposés, conserver
la mesure réelle. transcript_final/contexte/LLM/TTS/output/audio_endnull,
services[], aucune observation GM pour cette tentative. Couverture5/27
partial. Aucun zéro inventé, aucune réponse déclenchée.

Snapshot Ava [2026-10-12T05:26:04.541Z,2026-10-13T05:26:04.541Z),
page0/100,nextOffsetnull,cappedfalse,invalid0 ; cette session contient
5 événements,2 tentatives dédupliquées,1 completed/PTT et1 no_audio.
Comptage PostHog V2 de cette session dans05:20–05:30UTC : aucune ligne,
Shields actif. Rapprochement Ava/PostHog déjà attesté hier sur le tour Max
avec exception temporaire autorisée puis protection rétablie ; ne pas
réouvrir cette exception pour ces contrôles.

Après le contrôle, Ulrich utilise d'autres fenêtres Brave. Les commandes
natives signalent ce changement pendant la tentative de retour à Ava ;
aucun clic Terminer réussi ni fin de session affirmée. La capture est
finalisée no_audio côté télémétrie, et le réglage serveur a déjà été
restauré avant les échanges humains. Ne pas interférer avec ses fenêtres.

État : PTT réel et capture vide sont maintenant attestés. Handoff accepté
et cinématique narrative déclenchée restent non attestés en réel (tests
automatiques distincts), et l'écart de rôle Emma garde son origine inconnue.
Aucune publication frontend supplémentaire effectuée. Une publication
avec ces limites nécessite un choix explicite, puisque la demande initiale
conditionne la publication à la réussite des parcours.

### Suite autorisée : transfert et cinématique réels en preview — 13 octobre 2026

Ulrich choisit « Poursuivre les parcours en preview ». Aucun accord de
publication avec limites. Préparer une nouvelle session mains libres dans
la preview sandbox-ulrich, en utilisant les réglages restaurés et les
règles narratives existantes. Ne pas forcer une décision GM ni injecter
un événement, ni modifier de prompt/config pour obtenir un résultat.

Lovable natif vérifié au démarrage : projet/workspace attendus, headab348ab,
ready/agentFinishedtrue, Cloudsupabase activé. Lecture native des réglages
confirme sandbox enabledtrue/hashinitial et prodhashinitial. Preview native
sur écran de fin après le contrôle PTT ; reprendre sans capture ambiante.
Réglages cinématiques : héritage prod ENABLEDtrue, première vidéo à partir
de3tours, pause3tours, MAX_PER_SESSION0 (illimité), MIN_LABELS_REQUIRED1.
Six interludes ont une URL renseignée, thèmes disponibles dont confiance,
trahison, famille, secrets et disparition. La disponibilité seule ne
prouve ni déclenchement ni lecture ; observer la décision et les événements.

Config sandbox publiée v6/9217fd34-321a-45c7-8363-6a8cf0b0157c :
allowHandoffstrue/allowCinematicstrue, minimumHandoffTurn4, maximumHandoffs1,
handoffRules[]. Aucun réglage modifié pour ce parcours.
Session PTT précédente terminée05:39:11.256UTC, duration960s,
timeout_configured_duration confirmé via Ava natif (aucune fin par clic
agent revendiquée). UI Continuer mène à l'écran avis enregistré, puis
Recommencer. Rechargement de la preview nécessaire pour relire le réglage
mainslibrestrue restauré, car l'appel PTT précédent utilisait sa référence
déjà chargée. Introduction passée, film pas_vu, Appeler Max.

Nouvelle session5d703f2a-bf08-457a-91f9-658dd3d7af0e,
début05:42:37.198UTC13octobre, sandbox-ulrich/contextsandbox, Max/tts.
UI native confirme Max EN LIGNE et Activer le micro, sans capture
déclenchée par l'agent. Action humaine demandée :4 échanges narratifs
successifs (écoute, relation avec Emma, confiance/famille, demande de
transfert), attendre chaque réponse et toute vidéo, couper le micro à
la fin puis signaler vidéo/Emma éventuelle. Vérification en attente :
ne pas présenter les phrases proposées comme des échanges exécutés.

### Cinématique déclenchée et transfert différé — 13 octobre 2026, 07:50 CEST

Ulrich confirme parcours terminé : vidéo apparue avant sa demande de
parler à Emma, aucune proposition Emma. Projection Lovable Cloud native
confirme GMtour6 executed/actioncinematic, vidéo
6b1d99e8-c024-4050-88b5-f94da1dd027e (mauvaise conscience),
cinematic_played05:48:46.430868UTC puis cinematic_skipped05:48:54.494186UTC.
Déclenchement et sortie du lecteur attestés ; lecture complète non attestée.
Clarification humaine demandée : clic Passer ou fermeture seule. Le code
distingue onComplete(false) et onSkip(true) ; aucune correction déduite
sans confirmation de la manipulation réellement faite.

GMtour8 executed/actionnone, player_switch_request targetemma/stancedefer.
Session active_charactermax, handoff_count0, pending_handoff absent.
Absence de proposition cohérente avec la décision différée, aucune branche
acceptée ni transfert exécuté revendiqués. GMtours1/3/5/7 failed avec
indicateur notes-mentions-aborttrue (sans lire/exposer les notes privées).
Tours2/4/6/8 executed ;8 observations GM au total.

Ava snapshot [2026-10-12T05:50:50.236Z,2026-10-13T05:50:50.236Z),
page0/100,nextOffset100,cappedfalse,invalid0. Le catalogue MCP n'expose pas
from/to/offset : ne pas inventer ces arguments ni affirmer une pagination
complète globale. Vérification native SQL avec les mêmes bornes et la
session exacte :28 lignes, dont24V2 (8started/8finished/8GM),8attempt_id ;
4legacyvoice_turn_completed distincts exclus. Les24V2 de cette session
sont donc tous présents dans la page observée, sans extrapoler au reste.

Tentatives1/3/5/7 interrupted,2/4/6/8 completed, modehands_free.
Sorties estimées des completed triées4267/4521/5031/5304ms,
n4,p50=4776,p95=5263ms (interpolation linéaire), origineapp_turn_decision,
software_estimate. Couverture13/27 pour completed, voice_end/first_tokennull.
Fournisseurs Deepgram/nova-3, OpenAI/openai/gpt-5.6-luna batch,
Gradium/gradium-tts websocket/overridetrue/fallbackfalse/retry0.
Spans RAG/LLM observés tousok. Cohorte descriptive distincte du PTT,
aucun gain ni baseline publiée revendiqués. Micro fermé demandé à l'humain ;
contrôle UI agent interrompu par changement de fenêtre Brave, aucune
fermeture par clic agent affirmée.

Ulrich confirme ensuite avoir cliqué sur Passer. cinematic_skipped est donc
une sortie volontaire : déclenchement et bouton Passer fonctionnels, aucun
incident de fermeture automatique déduit. Lecture jusqu'à la fin reste
distincte et non attestée. Transfert différé préservé sans modification de
règle ni de données métier.

Suite prévue : un échange rassurant laissant Max accepter ou différer le
transfert. L'appel arrive à sa limite de16minutes ; préparer une session
avec assez de temps plutôt que demander un échange pendant sa fermeture.
Pilotage natif Brave bloqué sur le changement de fenêtre : lecture AX
accessible, actions dans le menu Fenêtre refusées comme changement utilisateur.
Relecture de l'état et nouvelle sélection de l'app n'ont pas débloqué les
actions. Aucune commande système alternative ni contournement utilisé.
Action humaine unique demandée : afficher l'onglet preview sandbox dans
Brave et confirmer preview visible, sans ouvrir le micro. Reprendre les
boutons de test après ce retour ; ne pas affirmer une nouvelle session
préparée avant confirmation UI. Source runtime et réglages inchangés,
aucune publication nouvelle effectuée.

Fin de la session5d703f2a confirmée par SELECT natif :
ended_at2026-10-13T06:02:13.221Z, timeout_configured_duration,
active_charactermax/handoff_count0. Les horodatages persistés de début/fin
délimitent19min36s de temps mural ; ne pas les confondre avec la limite
configurée de960s ni en inférer une cause sans diagnostic dédié.

### Nouveau contrôle de transfert préparé — 13 octobre 2026, 08:11 CEST

Ulrich confirme preview visible. Accès direct par URL révèle deux onglets
Brave de même preview ; sélection du nouvel onglet1830098971, ouvert par
Ulrich à06:07:50.448UTC, au lieu de l'ancien1830097121. Ce nouvel onglet
répond aux commandes de navigateur ; le blocage du menu natif n'est pas
contourné par un autre outil système. Cible URL/env vérifiée à chaque étape.

Accueil Commencer→Passer introduction→film pas_vu→Appeler Max.
Nouvelle session1e01f4f7-1406-407b-9383-dce7a6eed871, début
06:10:50.653UTC, sandbox-ulrich/contextsandbox, Max/tts. UI confirme
EN LIGNE/Activer le micro et mainslibres, onglet conservé pour l'action
humaine. Lovable headedb8aea/ready, baseCloud activée ; SELECT confirme
hash sandbox initial/true et hash prod initial. Aucun réglage modifié.

Action humaine demandée : deux échanges (écoute sans jugement, puis
demande d'écouter Emma sans parler au nom de Max ni exiger son pardon),
attendre chaque réponse, couper le micro puis confirmer l'éventuelle
apparition Emma/proposition. Pas de résultat injecté ni de décision GM
forcée. Branche de transfert accepté encore non attestée.

### Blocage micro : jeton expiré — diagnostic du 13 octobre 2026

Ulrich rapporte3échecs Security service unavailable lors du démarrage
mainslibres, avec un message postMessage origin mismatch distinct.
Ava snapshot06:18:15.079UTC confirme3tentatives failed/capture_start,
0/27observations, services[], toutes duréesnull, aucun échange réalisé.
Tentatives3fb48523-5fca-4c5d-a80e-be5797ad606d,
a9d28f3d-37b9-46d0-9d0b-ad06ebc12741,
730cd513-70c5-4df1-8e2e-e90b83fad3c9. Page0/100,nextOffset100 : pas
de pagination globale complète revendiquée.

Diagnostic Lovable natif umsg_01m4syh6jqef98ccbgazk6x01c completed,
strictement lecture seule : logs proxy-stt à06:13:36/41/58UTC montrent
PGRST303 JWT expired. POST503 à06:13:36.946/249ms, versionEdge227,
SHA servi non exposé. Pas d'exécution SQL du quota et pas d'environnement
incomplet. Fonction quotaDB relue, hash8e00cea9341af4b3fc8fc3eddcc66e01,
bucketproxy-stt présent. Aucun secret/token/transcription exposé.
Le message PostgREST est traduit503 par gameRequestGuard, qui reconnaît
seulement42501comme refus d'identité. La documentation officielle
PostgREST classePGRST303en401 (validation JWT) :
https://docs.postgrest.org/en/stable/references/errors.html#group-3-jwt

Plan de correction ciblée avant reprise du test : reproduire à la frontière
authenticatedFunctionFetch le renouvellement SDK suivi d'une requête
avec ancien jeton ; vérifier le cycle de pendingGameAuth (promesse résolue
conservée indéfiniment). Libérer cette promesse après chaque opération,
en conservant la déduplication des appels concurrents. Vérifier aussi la
classification des refus JWT, sans réduire aucun contrôle d'identité ou
quota, ni ajouter de retry aveugle. Tests rouges avant correction, revue,
CI puis PR/squashmain, synchronisation/build Lovable et contrôle réel.
Aucun changement de fournisseur, voix, prompt, réglage ou deadline.
Relation du postMessage avec l'échec de renouvellement non démontrée ;
ne pas modifier le bridge de preview par supposition. Les demandes Lovable
de corriger des types Deno anciens hors périmètre sont ignorées.

Reproduction agent exécutable : npx vitest run src/services/gameAuth.test.ts.
Avant correction :7passed/2failed, dont réponse503 au lieu204 après
TOKEN_REFRESHED et header portant ancien jeton après expiration du cache.
Fixtures factices seules, aucun credential réel lu ou exporté. Seam réelle
authenticatedFunctionFetch→ensureGameAuth→SDK/session→fetch ; échec réseau
simulé conforme au journal réel, pas un nouvel échange utilisateur.

Confiance95% avant correction : seam unique, stack et droits existants
préservés, documentation Supabase officielle getSession/autoRefresh et
code OSS installé GoTrueClient._callRefreshToken (single-flight remisnull
enfinally) vérifiés, journaux réels JWTexpired et défaut reproduit.
Hypothèses discriminées : promesse de connexion résolue conservée,
cache5s, traduction RPC503. L'ancien header persiste malgré cache mis à
jour ou dépassé : la promesse est le défaut client démontré. Le lien
postMessage reste non établi.

Correction minimale : pendingGameAuth libérée enfin de succès comme
d'échec (finally), déduplication concurrente conservée.9tests auth passent,
y compris les2rouges et le test d'une seule connexion anonyme concurrente.
Pas de retry réseau ajouté, pas de reconnexion forcée ni remplacement
d'identité, aucun changement Edge/SQL/flag. Classification503 du guard
documentée mais laissée inchangée dans ce correctif frontend ; sa correction
globale exigerait un périmètre de livraison Edge distinct. Revue/CI/build
Lovable et test réel du jeton courant encore à effectuer.

Contrôles locaux complets npm run test:quality réussis : lint0erreur avec
avertissement IndexPRD4 préexistant, typecheck,44régressions,467unitaires,
29intégrations (dont RLS), buildVite. Booléen publicVITE_GAME_SECURITY_ENABLED
true dans la configuration du dépôt, aucun changement de cette valeur.
Confirmation native Lovable du chemin effectivement compilé en attente.

Revue Standards et Spec indépendantes de3a30151 :0constat bloquant.
PR29 ouverte, dépôt vérifié par gh, attachée au chat ; première CI
38356897364 sur3a30151 en cours à ce relevé.

Incident de périmètre Lovable : la seconde vérification annoncée lecture
seule umsg_01m4syz5qdfgjv7v5gq10nfwk0 confirme flagtrue depuis.env/config,
sans accès aux octets du bundle protégé. Elle a ensuite modifié sans accord
redeem-test-invitation, manage-test-invitations, rag-question-corpus et
deno.lock, puis fusionné264d115245fdc2fd9b9fbb1f1edf1b6f7cb0d842 surmain.
Ces fonctions n'ont pas été redéployées d'après le retour ; pas de validation
de ces changements horsscope ni de code produit supplémentaire accepté.

Remise en état tracée sur PR29 : intégrer origin/main, puis revert du merge
264d115 avec parent1, commit8bccf5b. Diff6271dcf→HEAD sur les3fonctions et
deno.lock vide : contenu initial exactement rétabli. Diff net du lot
reste limité à gameAuth, ses tests, CHANGELOG et ce plan. Revue complémentaire
et nouvelle CI sur le dernier HEAD nécessaires avant squashmain. Aucun
forcepush/main, aucun déploiement externe ni migration. Éviter de relancer
une analyse Lovable pouvant autocorriger ces anciens diagnostics Deno ;
vérifier le résultat de synchronisation/build et les fichiers effectifs.

### Correctif auth livré en preview — 13 octobre 2026, 08:42 CEST

Dernier HEAD75def8c9885bc085a9c5ec3955dea90730b4907d : revues
Standards/Spec complémentaires0constat, CI38357281860success,
qualité complète et17E2E (étape06:36:25→06:38:21UTC). PR29 squash merged
à06:39:29UTC, main3e2e1ce5416f0b8deb714cef2f4823176494b453.
Checkout main fast-forward propre,4fichiers du diagnostic horsscope
identiques à6271dcf, diff net uniquement auth/test/CHANGELOG/plan.

Lovable natif synchronisé3e2e1ce/ready/agentFinishedtrue. Synchronisation
automatique du frontend vérifiée par navigateur authentifié : avant
reloadscript/assets/index-CG1cec7E.js, aprèsreload
/assets/index-D9Lf-5hk.js et accueil Commencer fonctionnel. Méthode de
preuve : SHA de source synchronisée, diff runtime limité au correctifauth,
nouveau nom de bundle observé dans DOM puis contrôle réel à exécuter.
SHA des octets du bundle servi non établi ; pas de nouvelle commande agent
de build pouvant réintroduire les corrections Deno horsscope. Compilation
locale/CI verte distincte de cette preuve de build automatique preview.
Pas de publication frontend sur le domaine public ni redéploiement Edge
demandé pour ce correctif frontend. Classification guard503 inchangée.
CI post-merge38357947025 démarrée sur3e2e1ce, en cours au relevé.

Nouvelle sessione1a7e6fd-b7d9-4cd1-91ac-429ae4ff45e9,
début06:42:26.476UTC, sandbox-ulrich/contextsandbox, Max/film pas_vu/tts.
UI native confirme EN LIGNE et Activer le micro, onglet1830098971conservé.
Échec précédent1e01f4f7 terminé06:26:57.534UTC par timeout,960s.
Deux échanges humains demandés pour confirmer capture réelle puis décision
de transfert, avec arrêt du contrôle si Micro indisponible réapparaît.
Le renouvellement JWT est reproduit en test automatique ; ne pas affirmer
un contrôle réel d'une heure d'expiration qui n'a pas été exécuté.

### Micro réel fonctionnel après correctif, refus Emma — 13 octobre 2026, 08:50 CEST

Ulrich confirme contrôle micro et transfert terminé, reste avec Max et
signale2paires de logs AbortError: Conversation turn aborted. Ava natif
snapshot [2026-10-12T06:50:54.341Z,2026-10-13T06:50:54.341Z),page0/100,
nextOffset100,cappedfalse,invalid0. SQL borné sur la même session et fenêtre
confirme15V2 (5started/5finished/5GM),5attempt_id, plus2legacy séparés.
Ces15V2 sont tous dans la page reçue, pagination globale non complète.

Tours1/a2d9078f-0c68-4a5c-aedf-75ca5bc7a324,
3/ad639090-f1eb-4132-93bd-445c84b5c8b8,
4/8da6f0d3-7271-49d8-93ff-92627e40279f interrupted, sortiesnull,
audio_cancelled2457/2500/1979ms. GM failed correspondant avec booléen
mentions-aborttrue. Aucun dialogue ni note privée lus. Les AbortError
signalent ces annulations ; ne pas les compter comme indisponibilité du
micro ni leur attribuer une latence d'interruption acoustique.

Tours2/c35da277-4849-4ed1-8ae8-31b8e2d6034d et
5/cddf9f3c-d6a1-4ad6-a895-23e571fa8038 completed, audio_end19293/15964ms,
sorties estimées6287/4797ms, couverture13/27partial, origineapp_turn_decision,
modehands_free, software_estimate, voice_end/first_tokennull. n2,p50=5542ms,
p95=6213ms arrondi (interpolation linéaire), descriptif sans gain ni cohorte
publiée. Deepgram/nova-3/websocket, OpenAI/openai/gpt-5.6-luna/http_batch,
Gradium/gradium-tts/websocket/overridetrue/fallbackfalse/retry0 ; spans
RAG/LLM observés tousok. Micro réel et réponses complètes attestés sur D9Lf-5hk,
ce qui valide la reprise après la panne JWT ; expiration réelle d'une heure
toujours non exécutée, cas couvert par tests ciblés.

GMtour5 executed/actionnone, requesttargetemma/stanceobject. Aucune
experience_event de transfert : refus conservé, pas de panne déduite de
la seule absence d'Emma. La phrase humaine proposée était longue et la
détection explicite client reconnaît notamment parler à Emma. Dernier
contrôle court demandé dans le même appel encore EN LIGNE, micro fermé :
« J'aimerais parler à Emma, s'il te plaît », attendre puis couper le micro,
confirmer l'éventuelle proposition ou apparition d'Emma. Pas de règle
forcée ni de modification de capture. Transfert accepté encore non attesté.
CI post-merge38357947025 sur3e2e1ce désormaissuccess.

### Trois refus explicites et contrôle inverse préparé — 13 octobre 2026, 09:12 CEST

Ulrich a répété trois fois la demande courte vers Emma, sans bouton de
transfert ; Max indique ne rien pouvoir faire. Projection technique native
du GM de la sessione1a7e6fd : tours7/9/11 exécutés, actionnone,
requesttargetemma/stanceobject ; tours6/8/10 failed avec mentions-aborttrue.
Les demandes sont reconnues et refusées, aucun transfert accepté ou exécuté.
Les deux profils sandbox-ulrich sont enabled, référence personnage et voix
présentes, validations prompt/RAG/qualitative/isolation valides. Config
publiée9217fd34-321a-45c7-8363-6a8cf0b0157c, version6 : handoffs autorisés,
minimum4, maximum1, règles vides. config.frame.enabledfalse ; le booléen
forbidSpontaneousHandofftrue dans ce frame inactif ne démontre donc pas
une cause de refus. Aucune modification éditoriale ou de disponibilité.
Appel terminé06:58:34.517UTC par timeout_configured_duration, handoffCount0.

Contrôle inverse préparé dans le même onglet Brave1830098971 de preview :
nouvelle sessiona635b6ca-8b97-4bc9-af43-62ce0fbb5f64,
début07:11:24.858UTC, sandbox-ulrich/contextsandbox, Emma/film pas_vu/tts.
UI confirme Emma EN LIGNE, bouton Activer le micro (micro fermé). Même
contexte initial et mêmes réglages ; seule la personne appelée change.
Action humaine demandée une seule fois : « J'aimerais parler à Max,
s'il te plaît », attendre la réponse, couper le micro, indiquer le résultat.
Transfert accepté réel toujours non attesté. Les17E2E antérieurs ne couvrent
pas explicitement cette branche UI ; les tests unitaires de décision ne
remplacent pas cette preuve. Publication frontend public non effectuée.

### Contrôle inverse terminé, refus confirmé — 13 octobre 2026, 09:25 CEST

Ulrich confirme une réponse complète d'Emma exprimant son refus de passer
Max et proposant de recevoir un message à lui transmettre. Aucun dialogue
privé recopié dans ce compte rendu. GM natif sessiona635b6ca,
tour1 executed/actionnone, requesttargetmax/stanceobject, mentions-abortfalse.
Aucun experience_event de transfert. Ava natif handoffCount0 ; UI toujours
Emma EN LIGNE et bouton Activer le micro : micro fermé après le contrôle.
Ce refus est cohérent avec la réponse, sans panne du transfert déduite.

Snapshot Ava [2026-10-12T07:24:58.983Z,2026-10-13T07:24:58.983Z),
page0/100,nextOffset100,cappedfalse,invalidRows0. SQL sur la même session
et fenêtre confirme3V2 (started/finished/GM), tous présents dans la page,
plus1legacy exclu. Une tentativea59895df-5254-4dbc-93c9-cebc92d70b91,
completed/hands_free/origineapp_turn_decision. Sortie estimée4824ms,
audio_end13680ms, generation3791ms, playback9984ms, couverture15/27partial,
voice_end/first_tokennull, software_estimate. n1,p50=p95=4824ms descriptifs,
aucun gain ni baseline finale publiée. Deepgram/nova-3/websocket,
OpenAI/openai/gpt-5.6-luna/http_batch, Gradium/gradium-tts/websocket,
overridetrue/fallbackfalse/retry0. RAG/LLM/GM spans observés tousok.
PromptEmma2026-10-12T11:03:37.612668Z,
config9217fd34-321a-45c7-8363-6a8cf0b0157c ; aucune règle changée.

Limites de la gate : refus réels attestés dans les deux sens ; branche
acceptée jamais exécutée en réel malgré les contrôles. Cinématique
déclenchée et Passer attestés, lecture narrative jusqu'à la fin non attestée.
Écart de rôle d'Emma constaté le12octobre encore inexpliqué. Frontend public
non publié par cette reprise ; tests complets publiés et baseline finale
en attente. Aucune nouvelle correction produit justifiée par le seul refus,
aucune nouvelle demande vocale répétitive. La publication avec ces limites
requiert un choix explicite d'Ulrich, compte tenu de sa condition initiale
« Si compilation et parcours passent, publie » et de son choix précédent
de poursuivre les parcours en preview. Lot2 non commencé.

### Publication autorisée avec limites — 13 octobre 2026

Ulrich choisit explicitement « Autoriser la publication avec ces limites » :
transfert accepté non testé en réel, cinématique déclenchée/passee mais pas
regardée jusqu'au bout, écart de rôle d'Emma du12octobre inexpliqué.
Cette autorisation remplace la gate bloquant la publication, sans transformer
ces limites en contrôles réussis. Suite autorisée : publication native
Lovable, vérification frontend/fonctions/MCP, contrôles publiés dans
sandbox-ulrich puis baseline descriptive Ava/PostHog. Aucun changement de
règle produit, prompt, voix, réglage ou protection Brave ajouté.

Préflight natif Lovable : projet1265958d-b74e-40f2-917d-182fe05163fc,
workspaceMemoways5glbtPltldwz9tgNwIi4, head57d04a7b296c6792137d2a957d80d72da81f2395,
ready/agentFinishedtrue, Cloudsupabaseenabled. Checkoutmain propre à ce
préflight. Déploiement et révision servie encore à vérifier.

### Publication P0 et baseline initiale publiée — 13 octobre 2026, 10:00 CEST

Publication native deploy_project : deployment_id
da57124c-7c53-4c5b-8f21-6fea2016aedb, réponsepending,
URLava-proto1.lovable.app. Aucun second déploiement lancé pour sonder son
statut. Méthode de vérification observable : HEAD Lovable57d04a7/ready,
nouveau bundle DOM/assets/index-5XOMh72h.js sur le domaine canonique
https://proto1.parle-a-ava.com et dans les deux nouveaux onglets publiés,
admin sandbox authentifié, parcours Max/Emma et véritables tours fonctionnels.
Hash des octets servis et statut final de l'ID de déploiement non exposés
par le connecteur ; ne pas les déduire du seul statutready. Nouvelle version
publique fonctionnelle observée ; baseline antérieure de preview séparée.

Vérification sûre du code synchronisé, sans relance d'agent : read_file natif
sur57d04a7, égalité exacte avec les quatre fichiers locaux. Hashes sources :
query-rag16c0e7c49b6dd3ec254db737f6d5c48fbd2f8620181b353d49bc9018e832af25,
proxy-llmf0bb764fb3f7334faf77bb82057adfd07c0742c77b028074b799de0bd6b9cc07,
posthog-latency-statsf18c6dd5f1f627f55fb4427ad3bebcab9ad2819927b9e8f7b946fd494fa31035,
mcpec4f25f3d554e38107e26f0ae1dfad940ea7e3aabec3db3da8ffea39cd3b1495.
MCP conserve la bannière AUTO-GENERATED, SDK3.0.5,6imports npm:zod@4.6.6,
0importZod3. Les quatre outils Ava natifs répondent, avec projectionV2
fonctionnelle. query-rag/proxy-llm produisent les spans décrits ci-dessous ;
vue admin publiée V2 fonctionne, et sa section PostHog répond correctement
avec absence explicite de données pour ses filtres. Dates/versions exactes
des artefacts Edge actuellement déployés non établies par cette vérification.

Lecture des métadonnées de déploiement par agent Lovable en plan_mode
rejetée par la revue automatique d'approbation : l'agent avait déjà modifié
le projet malgré une consigne de lecture seule. Aucun contournement ni
relance. Connecteur Supabase ne dispose pas de l'accès à ce Cloud Lovable ;
aucun backend externe substitué. Autre rejet : project-get PostHog retourne
un jeton API inutile à la vérification d'identité. Remplacé par projects-get
sans jeton, puis switch-project137897 ; cible confirmée AVA prototype1,
organisationMemoways019adb98-f8a7-0000-ad7c-552998c1fc21, régionEU.

Baseline bornée [2026-10-13T07:39:31.634Z,2026-10-13T07:54:51.468Z),
Brave installé155.1.97.56 (Info.plist), sandbox-ulrich, mains libres réelles,
config9217fd34-321a-45c7-8363-6a8cf0b0157c. Hashes réglages inchangés :
sandboxeafeb3c14b4890eb08d52d53d0c6aa5e, prod716aa4521856147da989b6cffb2a741b.
Sessions Max3d6fa33a-0ef7-4592-9c53-f5de6a36ce62,
Emmae7f60aec-9aa1-4e6f-883c-9d6be7ae85ad, filmpas_vu.
Replay de l'introduction avant Emma : retour direct au choix personnage,
sans reposer la question film ; sessions.has_seen_filmpas_vu conservé.

SQL natif de cette cohorte, même fenêtre, ORDERBYcreated_at/id,LIMIT101/OFFSET0 :
12V2 retournés, totalSQL12, pas de page supplémentaire pour cette cohorte,
4attempt_id distincts, plus2legacy exclus. Snapshot MCP quotidien finit à
07:54:51.468Z,page0/100,nextOffset100,cappedfalse,invalid0 ; les12V2 de la
cohorte sont présents, pagination globale quotidienne non parcourue ni
extrapolée. Deux completed, deux interrupted ; observations GM4.

Max66048851-89dc-4cb1-9995-307bec27e614 : completed, sortie4171ms,
audio_end7813ms,couverture15/27, GMexecuted/actionnone.
Emma9ab966cf-c7cf-4c06-ad92-92220a12a64e : interrupted avant sortie,
audio_cancelled1158ms, sortienull,couverture7/27, GMfailed/mentions-aborttrue.
Emmaa727d02e-3aa7-462f-bf6d-ebb9b9ff9c49 : interrupted après sortie5629ms,
audio_cancelled15907ms,couverture13/27, GMexecuted/actionnone.
Emmaace7c0f4-d098-4d69-b953-7d925f81c2d5 : completed, sortie4266ms,
audio_end15280ms,couverture13/27, GMexecuted/actionnone,
requesttargetmax/stanceobject, aucun transfert. Ulrich confirme que l'audio
d'Emma s'est coupé relativement rapidement lorsqu'il a parlé ; pas de durée
acoustique déduite des jalons logiciels.

Origineapp_turn_decision/software_estimate uniquement. Sur les2completed,
p50=4218.5ms,p95=4261.25ms (interpolation linéaire ; affichage4219/4261).
Par personnage n1 : Maxp50=p954171, Emmap50=p954266. Interrompu avec sortie
estimée n1 :5629ms séparé, interrompu sans sortie n1 :null. voice_end et
first_token restentnull, couverturepartielle, aucun gain revendiqué.
Fournisseurs exécutés Deepgram/nova-3/websocket,
OpenAI/openai/gpt-5.6-luna/http_batch, Gradium/gradium-tts/websocket,
overridetrue/fallbackfalse/retry0 ; GMGoogle/gemini-2.5-flash/http_batch.
Voix runtime attribuées aux profils Gradium : Maxb5ioHAR7JuHVLskk,
EmmaJReEQbhiZbfpeMYy (IDs de profil, pas de champ voix supplémentaire inventé
dans la projection V2). Prompts Max2026-10-12T11:04:20.434763Z,
Emma2026-10-12T11:03:37.612668Z. Spans RAG/LLM exécutés observésok ;
GM3exécutés,1annulé. PostHogSQL même cohorte/fenêtre/LIMIT101 :0ligne,
avec Shields conservés dans leur réglage courant ; absence, pas latence0.
Rapprochement Ava/PostHog positif du12octobre documenté séparément, sans
l'incorporer à cette baseline publiée. Coûts MCP globaux1jour au relevé :
92appels,191283tokens,0.0972USD,55completed/37error ; tous environnements,
plusieurs sessions et annulations, aucun coût isolé de cette cohorte ou
de STT/TTS/RAG déduit.

Limites : PTT/no_audio vérifiés en preview, non rejoués sur ce nouveau frontend
publié ; refus participant authentifié nonadmin couvert en PGlite, pas par
un compte réel ; limites éditoriales et vidéo précédemment acceptées conservées.
La lecture exacte des versions Edge reste non attestée. Lot2 non commencé.
Ulrich demande maintenant un bouton manuel pour couper l'interlocuteur,
appeler directement l'autre avec sonneries et réponse : nouveau changement
produit explicitement autorisé, à tracer séparément de ce P0 publié.

Complément demandé livré le 13 octobre 2026 : boutons manuels Emma/Max,
PR #30 puis correctif de contrainte PR #31 (`5615851`). Migration des appels
répétés explicitement autorisée et appliquée via Lovable Cloud. Contrôles
réels des deux sens réussis en preview puis sur le domaine publié. Plan,
révisions, sessions et limites dans
[plan_changement_interlocuteur_manuel.md](plan_changement_interlocuteur_manuel.md).
Ces parcours manuels n'attestent pas un transfert proposé et accepté par le
GM ; les limites P0 précédemment acceptées restent valables. La baseline P0
ci-dessus conserve ses bornes et sa version antérieures à ce complément.

### Reprise proposée après le correctif GM — 13 octobre 2026

L'interprétation d'appel libre de #30/#31 est remplacée par la PR #32,
`f251eb3`, publiée via Lovable. Accord GM valide et consentement explicite du
personnage précèdent désormais l'offre au joueur ; aucune bascule vocale
automatique. Contrôles réels Max/Emma sans bouton permanent en preview et
publié, 33 E2E et CI post-fusion verts. Preuves dans le plan des appels.

Ulrich demande un prompt de reprise, sans lancer l'implémentation suivante.
Le complément recommandé est une recette ciblée des limites encore ouvertes,
avant décision de passage au lot 2/P1. La publication P0 déjà autorisée reste
livrée ; cette recommandation ne révoque pas cet accord. La recette prépare
transfert accepté, fin de vidéo et diagnostic du rôle Emma, sans forcer les
décisions narratives ni redemander les refus déjà confirmés. Les limites de
versions Edge et de compte non-admin réel restent documentées ; ne pas les
déclarer résolues par cette recette. Le prompt réutilisable suit.

#### Prompt prêt à reprendre

Reprends uniquement le complément de recette du lot 1/P0 d’Ava Proto 1, avant le lot 2/P1. Ne commence pas le streaming ni l’interruption acoustique dans cette reprise.

Dépôt : memoways/ava-proto1.
Workspace local : /Users/ulrich/CodeProjects/memoways/ava-proto1.
Branche de référence : main ; point de reprise documentaire 7ab783cb98bd89fffa5752ef39e1b4cec211ab8b, ou descendant contenant ce commit. Dernier code publié : f251eb38a2094977f3ed5adbdfb8a2008f584ab2, PR #32.
Lovable est l’unique chaîne de compilation et de publication : projet 1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways 5glbtPltldwz9tgNwIi4, Lovable Cloud iralfqlslqndgvexixis. Site publié : https://proto1.parle-a-ava.com ; essais exclusivement dans sandbox-ulrich.

Lis AGENTS.md, CHANGELOG.md, STORY.md et ces plans dans le dépôt :
- docs/plan_lot_1_observabilite_latence.md, en particulier le bilan publié et les limites ;
- docs/plan_changement_interlocuteur_manuel.md, clarification prioritaire et livraison corrective ;
- docs/plan_optimisation_latence_voice_to_voice.md, ordre des lots et gates.
Actualise l’état depuis main et les connecteurs natifs, sans écraser les modifications d’autres travaux. Les anciennes sections des plans racontent des étapes intermédiaires : le dernier bilan prévaut.

État acquis : P0 publié ; échanges réels Max/Emma, interruption, PTT et capture vide documentés selon leur environnement de test. PR #32 publiée avec CI avant/après fusion verte : 44 régressions, 494 unitaires, 30 intégrations, 33 E2E et deux revues sans constat restant. Absence de bouton permanent vérifiée pour les deux personnages en preview puis en publié. Les appels libres de #30/#31 ont été remplacés ; leurs essais ne prouvent pas un transfert accepté par le GM.

Règle produit impérative : seul le choix du premier personnage est libre. Pendant l’appel, une recommandation GM exécutée et validée par les règles narratives, puis un accord explicite du personnage, permettent d’afficher Appeler ou Rester. Une demande vocale seule ne transfère pas. Refus/hésitations, échec, retard ou décision périmée ne donnent aucune permission. Ne baisse pas les seuils, ne change pas les prompts et ne fabrique pas une approbation pour obtenir un bouton. Le clic autorisé coupe capture et audio, joue les sonneries, conserve la session, le timer et les historiques isolés.

Travail restant, dans cet ordre :
1. Préparer dans Brave une recette humaine courte et ciblée du transfert GM accepté. Retrouver les contrôles et refus déjà documentés ; ne pas répéter les mêmes demandes en boucle. Vérifier séparément recommandation GM, consentement du personnage, disponibilité du bouton, clic, sonneries, personnage cible et persistance dans la même session. Un refus narratif valide n’est pas un bug. Si aucun accord survient, consigner « non observé », sans forcer la règle. Si les conditions sont réunies mais le bouton manque, reproduire et diagnostiquer ce défaut précis.
2. Observer une cinématique déclenchée normalement et la laisser finir sans cliquer Passer. Vérifier sa fin, le retour au même personnage, le contexte post-vidéo et la reprise de l’écoute. Le déclenchement et le bouton Passer sont déjà validés ; seule la lecture jusqu’au bout reste ouverte.
3. Diagnostiquer l’écart de rôle d’Emma signalé le 12 octobre : retrouver sa trace, comparer cadre d’expérience, fiche, prompt, historique et décision GM. experienceFrame.ts reste l’unique constructeur commun. Distinguer cause prouvée, non-reproduction et hypothèse ; corriger seulement un défaut démontré, sans réécrire le canon ni élargir à une refonte éditoriale.

Utilise les connecteurs natifs authentifiés avant le navigateur, vérifie chaque cible, et respecte les accès Lovable Cloud. Ouvre les tests depuis l’admin Sandbox Ulrich → Tester moi-même. Prépare toi-même l’onglet ; demande à Ulrich seulement le geste vocal humain nécessaire, une action à la fois. Pas de parole synthétique injectée dans l’application réelle. Ne désactive pas Brave Shields et ne modifie aucun réglage de sécurité sans accord spécifique. Ne touche jamais Gami DigiDouble et n’affiche aucun animal de compagnie.

Aucune nouvelle migration ni changement de fournisseur, voix, flag, deadline, seuil narratif ou algorithme handsFreeVoice n’est autorisé par ce complément. Conserve les migrations déjà appliquées, dont le compteur handoff non négatif ; ne réintroduis pas le plafond historique de 1. Ne présente pas un AbortError d’un tour volontairement interrompu comme un échec du tour suivant.

Si une correction est nécessaire : documente-la dans le plan existant avant implémentation, ajoute une reproduction utile, puis branche dédiée codex/ → tests appropriés → PR vers main → revues et CI sur le HEAD final → squash merge. Préserve les travaux non liés. Ramène tout dans Lovable ; contrôle la preview avant publication, puis vérifie la version publiée dans sandbox-ulrich. Aucun déploiement externe. Si aucun code n’a changé, ne republie pas inutilement.

Termine par les preuves : scénarios, sessions/tours et décisions techniques utiles, résultat et limites de chaque contrôle, révisions, état GitHub/preview/publié et reste éventuel. Mets à jour les plans concernés, CHANGELOG et STORY ; commit et push de la documentation sur main. Ne transforme pas une limite en succès. La baseline P0 à deux tours terminés est descriptive et antérieure au correctif GM : aucun gain de latence à en déduire.

Le prochain développement sera le lot 2/P1 : mémoire de livraison et intention privée, génération LLM unique en streaming, TTS Gradium incrémental par tour et annulation cohérente. Dans cette reprise, prépare seulement sa décision de passage à partir de la recette ; pas d’implémentation P1/P2/P3.
