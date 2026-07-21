# Traces causales des réponses de Max

## Résultat

Le mode diagnostic PRD4 relie chaque réponse générée de Max à l’ensemble exact des données qui l’ont produite : message utilisateur, mémoire sélectionnée, résumé, RAG et scores, prompt final, messages et payload OpenRouter, modèle, paramètres, sortie brute, réponse diffusée et latences.

Le mode est désactivé par défaut. Une session normale ne demande aucun payload détaillé au proxy et n’écrit aucune ligne dans `conversation_turn_traces`.

## Mode d’emploi express

1. Se connecter à `/admin` avec un compte portant le rôle `admin`.
2. Ouvrir **Mécanique → Traces Max**.
3. Cliquer sur **Lancer une session tracée** et jouer la session PRD4 dans le nouvel onglet.
4. Parler normalement avec Max : chaque réponse générée est enregistrée avant son affichage et sa lecture.
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

## Garantie de diffusion

Pour une session diagnostique, l’orchestrateur attend l’écriture de la trace causale avant d’ajouter la réponse à l’interface ou de lancer le TTS. Si l’écriture échoue, la réponse n’est pas diffusée, le message optimiste est retiré et le même numéro de tour peut être rejoué.

Les labels GM et l’évaluation post-tour complètent ensuite la trace. Ils sont marqués comme parallèles ou destinés au tour suivant ; le GM pré-tour et le validateur apparaissent comme `not_executed` dans une trace PRD4 live.

## Données et sécurité

- `sessions.diagnostic_trace_enabled` verrouille le mode pour toute la session.
- `conversation_turn_traces` impose un tour unique par session et supprime ses lignes en cascade avec la session.
- Les politiques RLS et les triggers exigent le rôle `admin` et une session diagnostique active.
- `patch_conversation_turn_trace` complète atomiquement les branches GM sans écrasement concurrent.
- Les clés API, JWT et en-têtes d’autorisation ne sont jamais ajoutés à la trace.
- Le contrat JSON est versionné par `ConversationTurnTraceV1` et `schema_version = 1`.

## Déploiement requis

Appliquer la migration `20260721120000_conversation_turn_traces.sql`, puis redéployer les Edge Functions `proxy-llm` et `query-rag`. La migration doit être appliquée avant d’utiliser **Lancer une session tracée**.

## Vérifications automatisées

Les tests couvrent notamment : identité prompt/payload, valeurs par défaut et raisonnement OpenRouter, RAG sans rewrite, conservation des scores, comportement inchangé sans trace, blocage sur échec de persistance, rattachement GM, affichage de longs prompts et RLS admin/cascade.
