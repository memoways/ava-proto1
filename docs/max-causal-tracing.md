# Traces causales des réponses de Max

## Résultat

Le mode diagnostic PRD4 relie chaque réponse générée de Max à l’ensemble exact des données qui l’ont produite : message utilisateur, mémoire sélectionnée, résumé, RAG et scores, prompt final, messages et payload OpenRouter, modèle, paramètres, sortie brute, réponse diffusée et latences.

Le mode est désactivé par défaut. Une session normale ne demande aucun payload détaillé au proxy et n’écrit aucune ligne dans `conversation_turn_traces`.

## Mode d’emploi express

1. Se connecter à `/admin` avec un compte portant le rôle `admin`.
2. Ouvrir **Mécanique → Traces Max**.
3. Cliquer sur **Lancer une session tracée** et jouer la session PRD4 dans le nouvel onglet.
4. Parler normalement avec Max : chaque réponse générée est durablement mise en file locale avant son affichage et sa lecture, puis synchronisée hors du chemin vocal.
5. Revenir dans **Traces Max**, cliquer sur **Rafraîchir**, puis choisir la session et le tour.
6. Déplier les huit catégories, copier une section ou exporter le JSON complet.

Il existe aussi un raccourci : dans **Admin → Sessions**, ouvrir une session marquée **Tracée**, puis cliquer sur **Analyser ce tour** sous la réponse de Max concernée.

## Que regarder selon le problème ?

| Problème observé | Sections à vérifier en premier |
|---|---|
| Max invente ou contredit un fait | Mémoire, chunks RAG et scores, prompt système final |
| Max oublie ce qui a été dit | Historique sélectionné, résumé compressé et dernier tour résumé |
| Le ton ou le comportement de Max paraît incorrect | Prompt maître, fiche personnage, règles techniques et guidance GM causale |
| Le mauvais modèle ou de mauvais réglages semblent utilisés | Payload OpenRouter exact, modèle demandé/retourné, température, tokens et raisonnement |
| La réponse est lente | Chronologie et section Latences : RAG, assemblage, LLM, proxy et écriture de trace |
| La réponse affichée diffère de la génération | Sortie LLM brute, réponse diffusée et origine `llm`/`fallback` |

Les blocs **Labels GM** et **GM post-tour** n’expliquent pas la réponse courante : le premier tourne en parallèle et le second prépare le tour suivant. La seule guidance GM causale éventuelle est celle héritée du tour précédent.

## Exemple de diagnostic

Si Max donne un lieu incorrect :

1. ouvrir **Chunks RAG sélectionnés et scores** pour voir si le bon fait a été retrouvé ;
2. vérifier **Contexte formaté injecté** pour confirmer qu’il a réellement rejoint le prompt ;
3. ouvrir **Prompt système final**, puis **Payload OpenRouter exact**, et vérifier que leur message `system` est identique ;
4. comparer **Sortie LLM brute** et **Réponse diffusée** pour déterminer si l’erreur vient du modèle ou d’un fallback.

Le paramètre d’URL `?diagnostic=full` n’accorde aucun privilège : le navigateur vérifie le rôle, le proxy LLM le revérifie, et la base refuse l’activation ainsi que toute lecture/écriture à un non-administrateur.

## Garantie de diffusion et de synchronisation

Pour une session diagnostique administrateur, l’orchestrateur attend uniquement la mise en file IndexedDB locale, avec un budget maximal de 100 ms. La réponse est ensuite affichée et le TTS démarre sans attendre Supabase. La confirmation distante est asynchrone : après l’audio, pendant une période inactive, au retour en ligne ou à la prochaine ouverture.

Un nouveau PTT suspend et annule l’upload en cours. La trace locale reste présente jusqu’à confirmation distante ; les compléments Labels/GM sont fusionnés localement tant que l’upsert n’a pas abouti. Si IndexedDB est indisponible, le parcours vocal continue avec un état explicite non durable en mémoire.

Le délai de génération Max et le délai de première voix utilisent des contrôleurs distincts. Le délai de première voix commence au lancement du TTS et n’annule que cette sortie audio : il ne supprime ni le texte de Max, ni la trace.

Les labels GM et l’évaluation post-tour complètent ensuite la trace. Ils sont marqués comme parallèles ou destinés au tour suivant ; le GM pré-tour et le validateur apparaissent comme `not_executed` dans une trace PRD4 live.

## Données et sécurité

- `sessions.diagnostic_trace_enabled` verrouille le mode pour toute la session.
- `conversation_turn_traces` impose un tour unique par `session_id + turn_index`, ce qui rend les reprises d’upload idempotentes, et supprime ses lignes en cascade avec la session.
- Les politiques RLS et les triggers exigent le rôle `admin` et une session diagnostique active.
- `patch_conversation_turn_trace` complète atomiquement les branches GM sans écrasement concurrent.
- Les clés API, JWT et en-têtes d’autorisation ne sont jamais ajoutés à la trace.
- Les contrats `ConversationTurnTraceV1` et `ConversationTurnTraceV2` sont lisibles côte à côte. V2 déduplique les gros blocs et conserve l’ordre des champs pour reconstruire exactement le payload OpenRouter.

## Diagnostic réseau passif

Aucun speed test et aucun appel payant ne sont ajoutés. Le navigateur expose seulement `navigator.onLine` et, lorsqu’ils existent, `effectiveType`, `rtt`, `downlink` et `saveData`. Le débit montant est calculé à partir de la taille et de la durée des vrais uploads de traces, toujours hors phase vocale.

Le panneau distingue la compatibilité voix de la synchronisation diagnostique. La synchronisation est lente sous 1 Mbit/s ou au-delà de 3 s, et critique sous 0,25 Mbit/s ou au-delà de 10 s. Une connexion mesurée à 11,5 Mbit/s descendant et 0,58 Mbit/s montant affiche donc : **« Voix compatible — synchronisation des traces lente »**.

## Déploiement requis

Dans la chaîne Lovable exclusivement, appliquer d’abord `20260721120000_conversation_turn_traces.sql` si nécessaire, puis `20260804183715_allow_conversation_trace_v2.sql`, et republier `proxy-llm`. La migration V2 conserve la table existante et autorise `schema_version IN (1, 2)`.

## Vérifications automatisées

Les tests couvrent notamment : reconstruction exacte et réduction V2, reprise IndexedDB, fusion concurrente, backoff, pause PTT, absence de doublon, comportement inchangé sans trace, rattachement GM, affichage différé des longs prompts, seuils réseau passifs et RLS admin/cascade.
