# Plan d’amélioration de la sécurité — AVA

Date de l’analyse : 16 juillet 2026  
Sources : The Code Registry, dépôt local, `npm audit`, tests locaux et documentation Supabase.  
Périmètre : application React/Vite, dépendances npm, CI GitHub Actions, Supabase Auth/RLS/Edge Functions et configuration de déploiement visible dans le dépôt.

## Synthèse exécutive

The Code Registry annonce 83 occurrences de sécurité : 2 `CRITICAL`, 24 `ERROR`, 29 `WARNING` et 28 `INFO`. Ces nombres surestiment toutefois le nombre de problèmes indépendants : les deux critiques sont deux signalements du même avis Vitest, et une grande partie des occurrences vient de dépendances transitives répétées dans `package-lock.json`.

Le risque immédiat est maîtrisable sans refonte : `npm audit fix --dry-run` propose uniquement des mises à jour correctives ou mineures dans les versions majeures déjà utilisées. La vulnérabilité Vitest ne devient exploitable que si le serveur UI de test est exposé ; les scripts du projet utilisent `vitest run`, pas l’UI. L’avis XSS React Router cité par The Code Registry ne concerne pas le mode déclaratif `<BrowserRouter>` utilisé par AVA, mais d’autres avis d’open redirect touchent quand même la version installée et justifient sa mise à jour.

Les points les plus importants découverts lors de la vérification manuelle concernent plutôt les données et la configuration Supabase : lecture publique des embeddings et des événements de télémétrie vocale, écritures de télémétrie trop permissives, et Edge Functions configurées avec `verify_jwt = false` dont la garde applicative peut s’ouvrir si une variable d’environnement manque. Les migrations RLS des sessions sont en revanche bien conçues et leurs cinq tests passent.

Le plan recommandé commence par les mises à jour et l’hygiène sans impact fonctionnel, puis durcit les données, et ne touche à l’authentification Edge/CORS/CSP qu’avec un déploiement progressif et des tests réels.

## Légende du risque de régression

- **A — faible** : ne devrait pas modifier le comportement utilisateur ; validation CI suffisante.
- **B — contrôlé** : peut affecter un outil, l’admin ou une intégration ; smoke test ciblé obligatoire.
- **C — élevé** : peut provoquer des 401/403, couper les appels LLM/STT/TTS, bloquer hCaptcha/PostHog/Gumlet ou interrompre l’écriture de données ; déploiement progressif et rollback préparé.

## Résultats The Code Registry et qualification

### SEC-01 — Dépendances vulnérables

**Sévérité : élevée. Priorité : P0. Risque de régression : B.**

The Code Registry signale Vitest dans `package-lock.json:8170` et React Router dans `package-lock.json:2364`. Le contrôle npm du 16 juillet 2026 trouve 21 paquets vulnérables uniques : 1 critique, 12 élevés, 7 modérés et 1 faible.

Versions directes concernées :

- Vitest `3.2.4` (`package.json:100`) ; cible proposée par npm : `3.2.7`.
- Vite `5.4.19` (`package.json:99`) ; cible : `5.4.21`.
- React Router DOM `6.30.1` (`package.json:69`) ; cible : `6.30.4`.
- PostCSS `8.5.6` (`package.json:95`) ; cible : `8.5.19`.

Le correctif npm mettrait aussi à jour 31 dépendances transitives, notamment Rollup, ws, DOMPurify, lodash, minimatch, glob, js-yaml, yaml, form-data, flatted, picomatch, brace-expansion et ajv. Aucune montée de version majeure directe n’est nécessaire.

**Plan**

1. Créer un commit dédié aux dépendances et exécuter `npm audit fix` sans `--force`.
2. Examiner le diff de `package.json` et `package-lock.json`, en refusant toute montée majeure inattendue.
3. Exécuter `npm audit`, `npm run test:quality`, `npm run test:rls` et `npm run test:e2e`.
4. Tester manuellement `/`, `/auth`, `/admin`, un tour voix complet, les quatre fournisseurs TTS disponibles et les fournisseurs STT configurés.
5. Ajouter un audit npm récurrent en CI et une politique de mise à jour automatique contrôlée.

**Ce qui peut casser** : changements transitifs dans Recharts/lodash, PostHog/DOMPurify, Supabase/ws, Vite/Rollup ou l’environnement de test. Le risque est limité mais le lockfile change largement.

### SEC-02 — Clé JWT trouvée dans `.env`

**Sévérité réelle : faible pour la clé, moyenne pour l’hygiène. Priorité : P1. Risque : A à B.**

The Code Registry classe `.env:2` comme secret JWT. Il s’agit d’une clé Supabase publique/`anon`, utilisée côté navigateur par conception (`src/integrations/supabase/client.ts:5-16`). Elle n’accorde pas de privilège `service_role` et n’est donc pas un secret serveur. C’est un faux positif sur la confidentialité de la valeur.

Le fichier `.env` est néanmoins suivi par Git depuis mars 2026 et `.gitignore:1-26` ne l’exclut pas. Cela crée une mauvaise habitude et augmente le risque qu’un vrai secret soit ajouté plus tard. Une ancienne paire d’identifiants admin statiques reste également documentée dans `STORY.md:718` et apparaît dans l’historique ; elle doit être considérée compromise si elle est encore réutilisée quelque part.

Supabase recommande désormais les clés `sb_publishable_...`, plus faciles à faire tourner indépendamment. La suppression des anciennes clés JWT `anon`/`service_role` est annoncée pour fin 2026, date encore indiquée comme susceptible d’évoluer.

**Plan**

1. Vérifier que l’ancienne paire d’identifiants admin n’est plus active ; la révoquer immédiatement si elle l’est.
2. Ajouter `.env`, `.env.*` avec exception pour `.env.example` à `.gitignore`.
3. Remplacer le fichier suivi par un `.env.example` contenant uniquement les noms de variables et des valeurs factices.
4. Migrer séparément de la clé JWT `anon` vers une clé `sb_publishable_...`, avec test de l’auth anonyme et de l’admin.
5. Ne réécrire l’historique Git que si un vrai secret encore valide y est découvert. Une réécriture casserait les clones, branches et références de commits.

**Ce qui peut casser** : une valeur absente dans l’hébergeur casse tout accès Supabase ; une migration de clé mal coordonnée produit des 401. Le simple retrait du fichier suivi ne doit pas être couplé à la rotation.

### SEC-03 — Références GitHub Actions mutables

**Sévérité : moyenne. Priorité : P1. Risque : A.**

`.github/workflows/core-experience-quality.yml:13-14` utilise `actions/checkout@v4` et `actions/setup-node@v4`. Un tag peut être déplacé par son propriétaire.

**Plan**

1. Épingler les deux actions à un SHA complet de 40 caractères, en conservant un commentaire `# v4.x.y` lisible.
2. Configurer Dependabot ou Renovate pour proposer les mises à jour de SHA.
3. Vérifier un run complet de la CI.

Le comportement de l’application n’est pas affecté ; seul un changement inattendu de l’action ou de son cache Node peut faire échouer la CI.

### SEC-04 — « DES cipher »

**Qualification : faux positif. Aucune correction applicative.**

Les deux correspondances sont le mot français « DES » dans des titres de prompts (`src/agents/maxAgent.ts:24` et `src/agents/maxAgent.ts:194`). Aucun appel à DES, TripleDES, CryptoJS, `createCipher` ou équivalent n’existe dans le dépôt.

**Plan** : documenter/supprimer ce signalement dans The Code Registry si l’outil permet une exclusion contextualisée. Ne pas modifier les prompts pour satisfaire le scanner.

### SEC-05 — Révision des `setTimeout`

**Qualification : information, pas une vulnérabilité confirmée. Risque : A.**

Les 18 signalements utilisent des callbacks, jamais une chaîne évaluée comme du code. Ils gèrent des délais réseau, watchdogs, retries, animation et tests. Les tests couvrent notamment les timeouts RAG, STT et audio.

**Plan** : aucune correction de sécurité. Continuer à utiliser `AbortController`, `clearTimeout` et le nettoyage React là où un composant peut être démonté. Ajouter une exclusion de règle uniquement si elle reste ciblée aux callbacks sûrs.

### SEC-06 — Code de debug disponible en production

**Sévérité : moyenne (confidentialité). Priorité : P1. Risque : B.**

Le panneau est activable par n’importe quel utilisateur ajoutant `?debug` à l’URL (`src/services/debugLogger.ts:32-37`, `src/App.tsx:15-16` et `src/App.tsx:35`). Il mémorise jusqu’à 500 entrées et affiche/copier des payloads (`src/services/debugLogger.ts:49-57`, `src/services/debugLogger.ts:79-116`). Les appels capturent des extraits de paroles STT, requêtes RAG, contenus TTS, prompts et réponses de services.

Cela ne donne pas directement les clés API, mais peut exposer une conversation, du contenu RAG ou des détails internes sur un écran partagé, une capture ou le presse-papiers.

**Plan**

1. Exclure le panneau du bundle de production ou l’autoriser uniquement pour un administrateur authentifié avec un drapeau de déploiement explicite.
2. Redacter systématiquement `Authorization`, JWT, e-mails, identifiants de session et textes utilisateur avant journalisation.
3. Réduire la taille et la durée de conservation en mémoire ; désactiver « copier tout » hors admin.
4. Conserver un mode diagnostic contrôlé pour ne pas dégrader le support.

**Ce qui peut casser** : le diagnostic terrain devient moins pratique ; aucun flux métier ne devrait changer.

## Constats manuels à ajouter au plan

### SEC-07 — Embeddings RAG lisibles publiquement

**Sévérité : élevée (confidentialité/IP). Priorité : P0. Risque : B.**

La migration initiale crée une politique de lecture publique sur `public.embeddings` (`supabase/migrations/20260308104242_cc08ffaf-8e3c-4910-aae4-9d24243e03d3.sql:142-148`). La migration de juillet retire seulement une politique de suppression permissive, pas la lecture (`supabase/migrations/20260712154557_a4a91994-526a-4a72-acb4-5a38461b22bb.sql:16-19`). Les lignes contiennent le texte RAG en clair (`...20260308104242...sql:107-130`).

L’admin lit directement cette table (`src/pages/Admin.tsx:165`), tandis que les requêtes utilisateur passent par `query-rag` avec une clé serveur. Une lecture publique n’est donc pas nécessaire au parcours public.

**Plan**

1. Confirmer la politique réellement déployée avec Supabase Security Advisor et `pg_policies`.
2. Remplacer la lecture publique par une politique admin, conserver l’accès `service_role` des fonctions RAG et de synchronisation.
3. Vérifier l’onglet Embeddings admin, `query-rag`, `sync-notion` et les recherches par personnage.

**Ce qui peut casser** : l’onglet admin si la politique admin ou le rôle n’est pas correct ; le jeu si une fonction RAG utilise par erreur la clé publique au lieu de la clé serveur.

### SEC-08 — Télémétrie vocale publiquement lisible et insérable

**Sévérité : élevée pour la confidentialité, moyenne pour l’intégrité. Priorité : P0. Risque : C.**

`voice_turn_events` et `voice_error_events` autorisent actuellement lecture et insertion à tous (`supabase/migrations/20260522103000_voice_observability_events.sql:18-23` et `:45-50`). Les erreurs peuvent contenir `error_message`, fournisseur, navigateur, identifiants de session et métadonnées (`:25-37`; `src/services/voiceTelemetry.ts:102-113`).

**Plan**

1. Retirer immédiatement la lecture publique et créer une lecture réservée aux admins.
2. Ajouter `user_id` ou vérifier l’appartenance via `session_id -> sessions.user_id` pour les insertions authentifiées.
3. Décider explicitement du traitement des événements sans `session_id` ; idéalement les faire transiter par une Edge Function à quota.
4. Limiter longueur et contenu de `error_message`/`metadata_json`, avec redaction des données utilisateur.
5. Ajouter des tests RLS « utilisateur A / utilisateur B / admin ».

**Ce qui peut casser** : la télémétrie est best-effort mais des politiques trop strictes peuvent la faire disparaître silencieusement. Déployer d’abord la lecture admin, puis l’écriture avec métriques de rejet.

### SEC-09 — Écritures de logs/usage insuffisamment liées au propriétaire

**Sévérité : moyenne (intégrité, pollution analytique). Priorité : P1. Risque : C.**

`llm_usage`, `openrouter_cost_error_logs`, `session_summaries`, `turn_latencies` et `audio_latencies` acceptent des insertions avec `WITH CHECK (true)` (`supabase/migrations/20260712150404_e1fc5992-c18a-4dd1-8ca1-8d18cad6fd53.sql:110-188`). Les mises à jour de `llm_usage` et des erreurs de coût ne vérifient que l’âge de la ligne (`supabase/migrations/20260712152143_7df66392-9869-40ed-903d-5314e15c0828.sql:11-25`), pas son propriétaire.

**Plan**

1. Ajouter un propriétaire (`user_id`) avec valeur imposée par `auth.uid()` ou vérifier la session associée.
2. Limiter update/select à l’auteur de la ligne, avec accès admin séparé.
3. Pour les données financières, préférer une écriture serveur depuis `proxy-llm` plutôt qu’une valeur de coût fournie par le client.
4. Ajouter limites de taille, enums/check constraints et quotas.
5. Étendre les tests RLS à toutes les tables de télémétrie.

**Ce qui peut casser** : le tracker fait aujourd’hui `insert(...).select('id')` puis une mise à jour asynchrone (`src/services/llmUsageTracker.ts:103-152`). Les nouvelles politiques doivent explicitement permettre ce retour et cette mise à jour au même utilisateur.

### SEC-10 — Edge Functions en vérification JWT désactivée et garde « fail-open »

**Sévérité : élevée en cas de mauvaise configuration. Priorité : P0 de vérification, P2 de changement. Risque : C.**

Les 17 fonctions déclarées dans `supabase/config.toml:3-50` ont `verify_jwt = false`. Toutes appellent bien `enforceGameRequest` ou `requireAdmin`, mais `enforceGameRequest` laisse passer la requête sans contrôle lorsque `GAME_SECURITY_ENFORCED` n’est pas exactement `true` (`supabase/functions/_shared/gameRequestGuard.ts:31-43`). La documentation interne affirme que `GAME_SECURITY_ENFORCED=true` et `VITE_GAME_SECURITY_ENABLED=true` sont actifs, mais l’accès au projet Supabase déployé a été refusé pendant cet audit ; cette affirmation n’a pas pu être vérifiée indépendamment.

La documentation Supabase actuelle recommande de laisser `verify_jwt` actif pour les fonctions appelées avec un JWT utilisateur. Elle précise aussi que les nouvelles clés publiques opaques ne sont pas des JWT et doivent être envoyées dans `apikey`, tandis que le JWT de session reste dans `Authorization`.

**Plan**

1. Avant tout changement, vérifier dans le projet déployé : versions des fonctions, `verify_jwt`, présence de `GAME_SECURITY_ENFORCED`, auth anonyme, quotas et taux de 401/403.
2. Modifier la garde pour échouer fermée en production, avec un mode preview/local explicitement nommé et impossible à activer par absence de variable.
3. Tester `verify_jwt = true` sur une fonction peu critique, puis sur STT/TTS/LLM, en validant les JWT anonymes et admin.
4. Conserver la garde applicative et le quota comme seconde couche même après activation de la gateway.
5. Préparer un rollback immédiat par version de fonction, pas par désactivation générale de la sécurité.

**Ce qui peut casser** : toute erreur de coordination produit des 401 sur les appels LLM, STT, TTS, RAG et synchronisation. Ne jamais basculer toutes les fonctions en une fois.

### SEC-11 — CORS `*` sur toutes les Edge Functions

**Sévérité : moyenne, défense en profondeur. Priorité : P2. Risque : C.**

Toutes les fonctions renvoient `Access-Control-Allow-Origin: *`, y compris les fonctions admin. Cela ne contourne pas à lui seul le JWT, mais permet à n’importe quelle origine d’essayer d’appeler les endpoints avec un jeton obtenu dans son propre contexte.

**Plan**

1. Centraliser CORS dans un helper partagé.
2. Maintenir une allowlist des domaines production, preview nécessaires et localhost de développement.
3. Répondre sans en-têtes CORS aux origines inconnues et ajouter `Vary: Origin`.
4. Déployer d’abord en journalisation, puis fonction par fonction.

**Ce qui peut casser** : previews Lovable, domaines personnalisés, localhost, hCaptcha ou tests E2E si l’allowlist est incomplète.

### SEC-12 — Imports distants Edge non épinglés

**Sévérité : moyenne (chaîne d’approvisionnement). Priorité : P1. Risque : B.**

Les helpers partagés importent `https://esm.sh/@supabase/supabase-js@2` (`supabase/functions/_shared/gameRequestGuard.ts:1`, `adminAuth.ts:3`). Le tag majeur est mutable.

**Plan**

1. Épingler une version exacte et préférer l’import npm/JSR recommandé par Supabase avec un `deno.json`/lockfile partagé.
2. Déployer une fonction canari, puis toutes les fonctions.
3. Ajouter un contrôle CI interdisant les imports HTTP non épinglés.

### SEC-13 — Serveur Vite exposé sur toutes les interfaces

**Sévérité : moyenne en développement. Priorité : P1. Risque : B.**

`vite.config.ts:8-14` configure `host: "::"`, donc le serveur de développement écoute sur toutes les interfaces. Plusieurs avis Vite/esbuild touchent précisément le serveur de développement, pas le bundle statique de production.

**Plan** : utiliser localhost par défaut et exiger un drapeau explicite pour l’accès LAN/conteneur. Ne jamais exposer `vite`, `vite preview` ou l’UI Vitest sur Internet.

**Ce qui peut casser** : previews distantes, conteneurs ou tests qui accèdent au serveur depuis une autre interface.

### SEC-14 — En-têtes de sécurité non définis dans le dépôt

**Sévérité : moyenne. Priorité : P2. Risque : A pour la plupart, C pour CSP.**

Aucune configuration visible ne définit CSP, `X-Content-Type-Options`, protection anti-framing, `Referrer-Policy` ou `Permissions-Policy`. Ils peuvent être ajoutés par Lovable/CDN ; il faut d’abord inspecter la réponse HTTP réelle.

**Plan**

1. Ajouter sans risque majeur `X-Content-Type-Options: nosniff`, une politique de referrer, une politique de permissions adaptée et `frame-ancestors`/anti-clickjacking.
2. Construire la CSP depuis les appels observés : Supabase HTTP/WebSocket, PostHog, hCaptcha, Gumlet/HLS, Grain, médias `blob:` et éventuelles polices.
3. Déployer la CSP en `Report-Only`, corriger les violations réelles, puis l’appliquer progressivement.

**Ce qui peut casser** : une CSP trop stricte peut bloquer captcha, analytics, WebSockets Supabase, streaming vidéo/audio et styles nécessaires à l’interface.

### SEC-15 — Sessions Supabase dans `localStorage`

**Sévérité : moyenne conditionnelle à un XSS. Priorité : P2. Risque : C si modifié.**

Le client persiste les sessions dans `localStorage` (`src/integrations/supabase/client.ts:11-16`). C’est un comportement courant pour une SPA, mais tout XSS sur l’origine pourrait lire les jetons. Aucun chemin XSS exploitable n’a été confirmé ; le seul `dangerouslySetInnerHTML` trouvé génère du CSS de graphiques depuis une configuration interne (`src/components/ui/chart.tsx:70`).

**Plan** : ne pas supprimer immédiatement la persistance, ce qui casserait les sessions anonymes/admin au rechargement. Réduire d’abord la probabilité d’XSS via dépendances, CSP, suppression du debug public, validation des URLs et contrôle des contenus dynamiques. Réévaluer ensuite un stockage mémoire ou séparé pour l’admin.

## Ordre de réalisation recommandé

### Phase 0 — Vérification production, sans changement

1. Obtenir un accès Supabase en lecture pour Security Advisor, `pg_policies`, versions des Edge Functions et configuration effective.
2. Vérifier les en-têtes HTTP du site déployé et les domaines réellement utilisés.
3. Confirmer que les anciennes informations admin sont révoquées et que seuls des secrets serveur existent dans les secrets Edge.
4. Exporter les politiques/migrations et préparer les requêtes de rollback.

Risque : **A**.

### Phase 1 — Correctifs rapides et peu risqués

1. SEC-01 dépendances dans les versions majeures existantes.
2. SEC-03 actions GitHub épinglées.
3. SEC-02 hygiène `.env` et retrait des anciens identifiants documentés.
4. SEC-06 debug désactivé ou admin-gaté en production.
5. SEC-12 imports Edge épinglés.
6. SEC-13 Vite sur localhost par défaut.
7. Marquer SEC-04 et SEC-05 comme faux positifs contextualisés.

Risque global : **A/B**. Un commit par sujet, sans mélange.

### Phase 2 — Protection des données

1. SEC-07 fermer la lecture publique des embeddings avec politique admin de remplacement.
2. SEC-08 fermer immédiatement la lecture publique de la télémétrie vocale.
3. SEC-09 ajouter ownership et tests RLS aux écritures de télémétrie/usage.
4. Ajouter des tests de confidentialité et d’intégrité pour utilisateur A, utilisateur B, admin, anon key seule et service role.

Risque global : **B/C**. Déployer table par table, observer les erreurs PostgREST et conserver le parcours utilisateur non bloquant lorsque la télémétrie échoue.

### Phase 3 — Authentification réseau et frontières d’origine

1. SEC-10 garde fail-closed et canari `verify_jwt`.
2. SEC-11 CORS centralisé puis allowlist progressive.
3. Migration vers les nouvelles clés Supabase publiques/secrètes.

Risque global : **C**. Nécessite smoke tests production et rollback immédiat.

### Phase 4 — Durcissement navigateur

1. SEC-14 en-têtes simples.
2. CSP Report-Only, puis enforcement.
3. Réévaluation SEC-15 du stockage de session après réduction du risque XSS.

Risque global : **A** pour les en-têtes simples, **C** pour CSP et stockage de session.

## Garde-fous et critères de sortie

État de référence au 16 juillet 2026 :

- `npm run test:quality` : 28 tests de régression + 101 tests unitaires, tous passants ; build Vite passant.
- `npm run test:rls` : 5 tests passants, couvrant anon key seule, ownership des sessions, champs protégés, side effects inter-utilisateurs et quota atomique.
- `npm audit` : 21 paquets vulnérables avant correction.
- Worktree propre après les commandes d’audit en lecture/dry-run.

Chaque phase doit conserver :

- parcours public complet avec auth anonyme invisible ;
- login/logout et toutes les lectures/écritures admin ;
- un tour complet STT → RAG → LLM/GM → TTS → audio ;
- synchronisation questionnaire et Notion ;
- lecture/écriture de télémétrie selon les nouveaux droits ;
- absence de 401/403/429 anormaux et de violations CSP bloquantes ;
- audit npm sans vulnérabilité critique ou élevée exploitable dans le contexte.

## Limites de l’analyse

Le rapport snapshot complet de The Code Registry est toujours indiqué `not_ready`; l’API structurée a fourni les comptes et les six constats principaux, mais pas chaque occurrence individuelle. Les résultats ont donc été complétés par `npm audit` et une revue locale ciblée.

Le connecteur Supabase a refusé l’accès au projet déployé. Les politiques et fonctions ont été évaluées à partir des migrations et du code du dépôt ; leur présence effective en production doit être confirmée en Phase 0 avant tout changement de niveau C.

## Références

- Supabase, Authorization headers et `verify_jwt` : https://supabase.com/docs/guides/functions/auth-headers
- Supabase, sécurisation des Edge Functions : https://supabase.com/docs/guides/functions/auth
- Supabase, migration vers les nouvelles clés : https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
- Supabase, calendrier des nouvelles clés : https://supabase.com/changelog/29260-upcoming-changes-to-supabase-api-keys
- GitHub Advisory React Router XSS : https://github.com/advisories/GHSA-2w69-qvjg-hvjx
- GitHub Advisory Vitest UI : https://github.com/advisories/GHSA-5xrq-8626-4rwp

