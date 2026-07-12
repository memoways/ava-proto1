# Audit de préparation à une ouverture publique — AVA Proto 1

Date : 12 juillet 2026
Périmètre : dépôt React/TypeScript, flux PRD4, Supabase (migrations et Edge Functions), STT/LLM/TTS, télémétrie, robustesse et latence.
Méthode : revue statique en lecture seule, exécution des tests/build/typecheck/lint, `npm audit --omit=dev`. Aucune correction applicative n'a été appliquée.

> Suivi : la phase 0 a depuis restauré le build et les tests, ajouté un parcours E2E de trois tours et reproduit le blocage RLS en PostgreSQL isolé. Voir `docs/phase0_stabilisation_report.md`. Les constats de cet audit restent le snapshot initial.

## Synthèse exécutive

**Avis actuel : NO-GO pour une ouverture au public.** Le prototype contient de bonnes décisions de fluidité (LLM plafonné à 10 s, TTS préchargé, génération TTS parallèle, Game Master post-tour non bloquant, télémétrie de latence), mais quatre blocages empêchent de considérer l'application comme robuste en production :

1. les proxys payants IA/STT/TTS sont publiquement appelables sans authentification de session ni limitation de débit ;
2. le durcissement RLS récent risque de rendre inopérantes les écritures anonymes de session ;
3. le build et la suite de tests ne sont pas verts ;
4. l'expérience est explicitement limitée à 5 minutes et le chemin PRD4 ne garantit pas 15 minutes de conversation.

Le risque principal pour la fluidité n'est pas seulement une latence moyenne élevée : c'est l'existence de requêtes RAG sans timeout, d'un watchdog qui libère le verrou sans annuler le tour en cours, et d'un historique non borné qui atteint la limite serveur à environ 30 tours.

## Points solides à préserver

- `processPRD4Turn` limite l'appel Max à 10 s et fournit une réponse de repli (`src/services/prd4Orchestrator.ts:57-59`, `124-136`).
- Les appels TTS côté client utilisent un signal d'annulation à 12 s et la file génère les segments en parallèle (`src/services/tts/queue.ts:102-135`).
- Le TTS d'ouverture est préchargé pendant l'onboarding (`src/pages/IndexPRD4.tsx:176-187`, `325-342`).
- Le Game Master de labels et le post-tour sont sortis du chemin critique de la première réponse (`src/services/prd4Orchestrator.ts:99-105`, `139-176`).
- Les clés permanentes Deepgram et Gamilab ne sont plus renvoyées au navigateur ; Deepgram utilise un jeton de 60 s (`supabase/functions/proxy-stt/index.ts:8-55`).
- Les mutations Notion sensibles ont désormais un garde admin côté Edge Function (`supabase/functions/sync-notion/index.ts:92-99`, `supabase/functions/update-notion-video/index.ts:29-34`).
- Aucun chemin XSS exploitable n'a été confirmé. Le seul `dangerouslySetInnerHTML` trouvé génère du CSS de graphiques depuis une configuration interne (`src/components/ui/chart.tsx:61-86`) ; il doit rester réservé à des valeurs contrôlées.

## Constats critiques

### SEC-01 — Proxys payants publics, sans quota ni preuve de session

- **Sévérité : Critique**
- **Localisation :** `supabase/config.toml:3-22`, `supabase/functions/proxy-llm/index.ts:52-63`, `113-149`, `supabase/functions/proxy-tts/index.ts:28-45`, `supabase/functions/proxy-stt-gradium/index.ts:13-42`.
- **Preuve :** `verify_jwt = false` est configuré pour les proxys principaux. `proxy-llm` limite la taille et les familles de modèles, mais ne vérifie ni utilisateur, ni session AVA, ni origine, ni quota. Les proxys TTS/STT acceptent également directement les payloads publics et utilisent les clés serveur du projet.
- **Impact :** un tiers peut automatiser les appels aux fournisseurs aux frais du projet, épuiser les quotas et provoquer des erreurs/latences pour les vrais visiteurs. Une attaque peu coûteuse suffit à dégrader toute l'expérience publique.
- **Correction minimale :** émettre au démarrage un jeton de session signé, court et mono-usage/rotatif ; l'exiger sur tous les proxys ; appliquer des quotas par session + IP hachée + fournisseur ; limiter méthode, taille de corps, longueur texte/audio, modèle/voix et concurrence.
- **Mitigation :** plafonds budgétaires fournisseurs, alertes de consommation, WAF/rate limiting en amont et coupe-circuit global.
- **À vérifier :** les protections éventuellement configurées dans Lovable/Supabase hors dépôt. L'accès MCP à la production a été refusé pendant l'audit ; elles n'ont donc pas pu être attestées.

### ROB-01 — Le modèle RLS est incompatible avec les mises à jour anonymes du client

- **Sévérité : Critique**
- **Localisation :** `supabase/migrations/20260712150404_e1fc5992-c18a-4dd1-8ca1-8d18cad6fd53.sql:170-181`, `supabase/migrations/20260712152143_7df66392-9869-40ed-903d-5314e15c0828.sql:2-9`, `src/services/prd4Session.ts:9-78`.
- **Preuve :** le rôle anonyme reçoit `INSERT` et `UPDATE` sur `sessions`, mais aucun `SELECT`; le client fait pourtant `insert(...).select("id")` puis plusieurs `update(...).eq("id", sessionId)`. PostgreSQL RLS exige une politique `SELECT` applicable pour cibler une ligne lors d'un `UPDATE`.
- **Impact :** création de session sans ID, sauvegarde des conversations, questionnaire et clôture peuvent échouer ou toucher zéro ligne. Le jeu continue volontairement sans persistance (`src/pages/IndexPRD4.tsx:295-311`), ce qui masque la panne et rend l'audit opérationnel incomplet.
- **Correction minimale :** ne pas réouvrir la lecture publique globale. Déplacer création/mise à jour vers une Edge Function qui possède la clé service et valide un jeton de session secret ; ou introduire un propriétaire anonyme/session claim vérifiable avec politiques `SELECT/UPDATE` strictement limitées à cette session.
- **Mitigation :** métrique bloquante sur `session_created`, contrôle du nombre de lignes réellement mises à jour, alerte si le taux de persistance descend sous 99,5 %.
- **À vérifier :** état exact des policies déployées et test d'intégration anon réel. Les migrations du dépôt suffisent toutefois à démontrer l'incohérence de conception.

## Constats élevés

### UX-15M-01 — La durée demandée de 15 minutes n'est pas implémentée

- **Sévérité : Élevée / bloquante produit**
- **Localisation :** `src/pages/IndexPRD4.tsx:1-7`, `64`, `125-132`, `695-698`.
- **Preuve :** `SESSION_DURATION_S = 5 * 60`; le timeout se nomme `timeout_5min`; le Game Master peut terminer encore plus tôt via `end_recommended`.
- **Impact :** l'expérience ne peut pas « tenir 15 minutes » par définition.
- **Correction minimale :** rendre la durée configurable, fixer 15 minutes pour le mode public, et interdire au GM une clôture avant une durée minimale sauf sécurité/abandon explicite.
- **Validation requise :** test E2E avec horloge simulée + sessions réelles de 15 à 20 minutes.

### PERF-01 — RAG sans timeout et watchdog non annulant : risque de tours fantômes

- **Sévérité : Élevée**
- **Localisation :** `src/services/ragService.ts:37-52`, `src/services/prd4Orchestrator.ts:67-97`, `src/pages/IndexPRD4.tsx:365-377`.
- **Preuve :** le `fetch` de `query-rag` n'a ni `AbortController` ni timeout. L'appel Max ne commence qu'après le RAG. Après 60 s, le watchdog remet `isProcessingRef` à `false`, mais n'annule pas la promesse du tour.
- **Impact :** une requête RAG bloquée gèle la réponse ; l'utilisateur peut ensuite démarrer un nouveau tour pendant que l'ancien continue. L'ancien résultat peut arriver tard, ajouter une réponse hors ordre, lancer du TTS ou déclencher une vidéo incohérente.
- **Correction minimale :** un `AbortController` par tour englobant RAG + LLM + TTS ; timeout RAG de 1,5–2,5 s avec fallback sans RAG ; identifiant de génération vérifié avant toute mutation d'état ; annulation réelle au watchdog, à la fin de session et au démontage.
- **Mitigation :** circuit breaker par fournisseur et désactivation temporaire du rerank si p95 dépasse le budget.

### UX-15M-02 — Historique non borné et limite de 60 messages à environ 30 tours

- **Sévérité : Élevée**
- **Localisation :** `src/agents/maxAgent.ts:149-156`, `supabase/functions/proxy-llm/index.ts:125-142`, `src/agents/maxAgent.ts:313-317`.
- **Preuve :** PRD4 transmet tout `conversationHistory` au LLM, tout en réinjectant aussi les six derniers messages dans le system prompt. Le proxy refuse plus de 60 messages. À deux messages par tour plus système/message courant, environ 29–30 tours suffisent à dépasser la limite — plausible en 15 minutes.
- **Impact :** les derniers tours basculent systématiquement sur la réponse de secours ; coût et latence prompt augmentent au fil de la session.
- **Correction minimale :** mémoire glissante : résumé compact + 6 à 10 derniers messages, budget en tokens avant envoi, suppression de la duplication de l'historique récent.
- **Mitigation :** métriques `prompt_tokens`, `messages_count`, taux de fallback par numéro de tour.

### PRIV-01 — Enregistrement PostHog actif sans masquage ni consentement visible

- **Sévérité : Élevée**
- **Localisation :** `src/main.tsx:4-8`, `src/services/posthogService.ts:8-18`, `src/services/prd4Session.ts:52-75`.
- **Preuve :** PostHog démarre automatiquement, avec `autocapture: true` et `session_recording.maskAllInputs: false`. Les transcriptions et postures sont affichées dans le DOM et persistées en base. Aucun mécanisme de consentement, information, rétention automatique ou suppression utilisateur n'a été trouvé.
- **Impact :** exposition de propos personnels et risque de non-conformité RGPD/LPD lors d'un usage public. La documentation affirme que le jeu ne contient « pas de PII sensible », hypothèse intenable pour une conversation vocale libre.
- **Correction minimale :** consentement/information avant micro et analytics ; session recording désactivé par défaut ou masquage de tout texte/transcript ; minimisation des événements ; politique de rétention et purge ; DPA/localisation documentés.
- **Mitigation :** pseudonymisation, `person_profiles: 'identified_only'` si pertinent, blocage des propriétés contenant du texte libre.

### SUPPLY-01 — Dépendances vulnérables et lockfile incohérent

- **Sévérité : Élevée**
- **Localisation :** `package.json:53`, `package-lock.json`.
- **Preuve :** `hls.js` est déclaré mais absent de `package-lock.json` et de `node_modules`. `npm audit --omit=dev` signale 23 vulnérabilités (9 élevées, 14 modérées), dont React Router/open redirect-XSS, `ws`, `protobufjs`, `lodash`, `minimatch` et `glob`.
- **Impact :** build non reproductible et surface supply-chain connue. Toutes les alertes ne sont pas nécessairement exploitables dans le navigateur, mais elles doivent être qualifiées avant publication.
- **Correction minimale :** régénérer proprement le lockfile, mettre à jour par petits lots, vérifier le diff transitif, relancer build/tests/audit. Ne pas appliquer aveuglément `npm audit fix` en production.

### DATA-01 — Contenus narratifs/embeddings exposés publiquement

- **Sévérité : Élevée si les contenus sont propriétaires**
- **Localisation :** `supabase/migrations/20260308104242_cc08ffaf-8e3c-4910-aae4-9d24243e03d3.sql:143-148`, `supabase/functions/query-rag/index.ts:57-160`.
- **Preuve :** une politique historique autorise la lecture publique de `embeddings`; les migrations de durcissement ne retirent que la suppression permissive. `query-rag` emploie la clé service et renvoie le contenu des matches à tout appelant accepté.
- **Impact :** extraction du storyworld, des prompts ou de la mémoire narrative ; consommation payante d'embeddings/rerank ; reconnaissance facilitant les attaques de prompt injection.
- **Correction minimale :** retirer la lecture Data API des embeddings, n'exposer que le minimum narratif via une Edge Function liée à une session valide, avec limites et filtrage par personnage.
- **À vérifier :** sensibilité commerciale réelle des textes et policies déployées.

## Constats moyens

### WEB-01 — Baseline de sécurité navigateur absente du dépôt

- **Sévérité : Moyenne**
- **Localisation :** `index.html:1-35`.
- **Preuve :** aucune CSP ni configuration visible de `X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy` ou `Permissions-Policy`. Le SDK Gamilab est chargé depuis un tiers sans SRI (`index.html:32`).
- **Impact :** défense en profondeur XSS/clickjacking insuffisante et dépendance supply-chain exécutée avec les privilèges de l'origine.
- **Correction minimale :** définir les headers à l'edge en mode report-only puis enforcement ; restreindre `connect-src` aux fournisseurs nécessaires ; auto-héberger/pinner le SDK ou utiliser SRI si le fournisseur publie un artefact stable.
- **À vérifier :** headers réellement servis par Lovable, invisibles dans ce dépôt.

### ROB-02 — Les erreurs de persistance sont traitées comme best-effort

- **Sévérité : Moyenne**
- **Localisation :** `src/pages/IndexPRD4.tsx:545-548`, `src/services/prd4Session.ts:40-78`, `src/pages/IndexPRD4.tsx:899-917`.
- **Preuve :** sauvegardes fire-and-forget, erreurs seulement loguées, passage à l'écran de remerciement même si le questionnaire n'est pas enregistré.
- **Impact :** perte silencieuse de données et impossibilité de distinguer une expérience réussie d'une session non persistée.
- **Correction minimale :** file d'écriture sérialisée, version/ETag, retry borné avec jitter, indicateur local `persistence_degraded`, flush explicite à la fin et observabilité du succès.

### AUTH-01 — Création de comptes « admin » proposée publiquement

- **Sévérité : Moyenne à faible**
- **Localisation :** `src/pages/Auth.tsx:9-45`, `101-109`.
- **Preuve :** toute personne peut ouvrir le mode signup. Le rôle admin n'est pas attribué automatiquement, donc aucune élévation directe n'est démontrée.
- **Impact :** comptes inutiles, spam Auth, confusion et surface de bruteforce accrue.
- **Correction minimale :** désactiver l'inscription publique pour le back-office ou utiliser invitations/allowlist ; activer MFA pour les admins et protections de bruteforce.

## État qualité et validations

| Contrôle | Résultat | Interprétation |
|---|---:|---|
| `npx tsc --noEmit` | OK | Types compilables |
| `npm run build` | Échec | import `hls.js` introuvable |
| `npm test` | Échec | 3 fichiers en échec, 2 tests échoués, 2 rejets non gérés |
| `npm run lint` | Échec | 131 erreurs, 12 avertissements |
| `npm audit --omit=dev` | Échec | 23 vulnérabilités : 9 élevées, 14 modérées |

Les tests couvrent des briques unitaires utiles, mais aucun test E2E de parcours complet, test de charge, test de concurrence, test de reconnexion réseau, test de durée 15 minutes ou test réel des policies RLS n'a été trouvé.

## Budget de latence recommandé

Pour préserver une conversation vocale naturelle, viser les seuils suivants sur appareils et réseaux réels :

| Segment | p50 cible | p95 maximum | Comportement de repli |
|---|---:|---:|---|
| Relâchement PTT → transcript final | 500 ms | 1 200 ms | réinitialiser STT et proposer de répéter |
| RAG complet | 500 ms | 1 500 ms | continuer sans RAG/rerank |
| LLM → texte prêt | 1 500 ms | 4 000 ms | réponse narrative courte de secours |
| TTS → premier son | 700 ms | 1 500 ms | afficher le texte, retry fournisseur unique |
| Total fin de parole → premier son | 2 500 ms | 5 000 ms | circuit breaker et mode dégradé explicite |

Le watchdog de 60 s est trop tardif pour l'expérience : le système doit dégrader avant 5 s, tout en annulant effectivement les travaux obsolètes.

## Plan de remise à niveau sans casser l'expérience

### Phase 0 — Stop-ship et preuves (1 à 2 jours)

1. Geler toute ouverture publique.
2. Réparer lockfile/build/tests sans modifier la logique narrative.
3. Tester les policies RLS avec un vrai client `anon` sur une branche Supabase : create → update conversation → end → questionnaire.
4. Ajouter un test E2E « happy path » de 3 tours avant tout hardening supplémentaire.

### Phase 1 — Sécuriser les frontières (2 à 4 jours)

1. Introduire un jeton de session serveur et protéger tous les proxys payants.
2. Ajouter quotas, limites de payload et plafonds fournisseurs.
3. Déplacer les mutations de session derrière une Edge Function ; conserver le client public sans droit de lire les autres sessions.
4. Désactiver/masquer PostHog session recording avant lancement public.

### Phase 2 — Garantir la fluidité 15 minutes (2 à 4 jours)

1. Passer la durée à 15 minutes avec minimum de clôture.
2. Ajouter timeout/abort global par tour et garde anti-résultat obsolète.
3. Mettre en place mémoire glissante + résumé, sans dépasser 10 messages récents.
4. Soak test de 20 minutes, 35 tours, avec vidéo, erreurs fournisseur et perte réseau simulées.

### Phase 3 — Déploiement progressif

1. Canary interne, puis petit groupe public plafonné.
2. Seuils de rollback : p95 premier son > 5 s, erreurs tour > 2 %, persistance < 99,5 %, coût/session hors budget.
3. Revue quotidienne des erreurs, coûts, taux de fin et abandons durant la première semaine.

## Critères de GO public

- Build, typecheck, tests et lint bloquants verts en CI reproductible.
- Zéro endpoint fournisseur payant exploitable sans jeton/quota.
- Test RLS anon bout-en-bout vert et aucune lecture inter-session.
- 30 sessions automatisées de 15 minutes sans désordre de tours ni fuite de ressources.
- p95 « fin de parole → premier son » inférieur à 5 s ; p50 inférieur à 2,5 s.
- Taux de tours réussis ≥ 98 %, persistance ≥ 99,5 %.
- Consentement/information micro + analytics et politique de rétention validés.
- Headers de sécurité vérifiés sur l'URL réellement déployée.

## Limites de l'audit

- L'accès de lecture au projet Supabase déployé (policies, advisors, Edge Functions) a été refusé par le connecteur ; les constats backend reposent donc sur les migrations et sources versionnées.
- Aucun test destructif, appel payant de charge ou mutation de production n'a été effectué.
- Les headers et protections éventuellement ajoutés par Lovable/CDN doivent être contrôlés sur l'URL de production avant GO.
