# Plan — Rapport de vérification du mécanisme sandbox

## Ce que la vérification du code montre déjà

Bascule sans re-login : confirmé. Le sélecteur n'est rendu que pour
`ulrich.fischer@memoways.com` (`canSwitchEnvironments`), il écrit le choix dans
`sessionStorage` puis recharge la page. La session Auth n'est pas touchée : pas
de reconnexion. Deux limites à connaître : la sélection vit dans
`sessionStorage`, donc un nouvel onglet repart sur l'environnement par défaut du
compte, et chaque bascule provoque un rechargement complet de l'admin.

Réglages isolés par sandbox : confirmé. Tout passe par `admin_settings`
(clé + `environment_id`) via `loadEnvironmentSetting` / `saveEnvironmentSetting`,
avec chaîne de repli sandbox → prod → valeur codée en dur, et miroir navigateur
préfixé `ava:<env>:<clé>`. Sont isolés : LLM, TTS (y compris Gradium), STT
(providers + dictionnaire), gameplay, vidéo, GM, prompt Max, RAG, avatar
streaming, historique de sync vidéo, réglages LLM-as-judge. Sont aussi isolés :
`character_prompts`, `character_runtime_profiles` et les versions
d'orchestration GM (`experience_orchestration_versions`), chacun avec repli
prod. Conséquence voulue : Benoît règle sa sandbox sans impacter prod ni les
autres.

Données et connexions partagées : confirmé. `characters`, `embeddings`,
`rules`, `storyworld`, `gameplay_steps`, `video_triggers` et `rag_index_state`
n'ont pas de colonne `environment_id` : le corpus RAG, l'index vectoriel et les
contenus Notion sont communs. Les secrets et Edge Functions (OpenRouter, Voyage,
Deepgram, ElevenLabs/Gradium, HeyGen/Tavus, Notion, PostHog) sont uniques pour
tout le projet.

Métriques : partagées en lecture, mais avec des nuances réelles.
`sessions`, `turn_latencies`, `audio_latencies` portent un `environment_id` ;
l'onglet Sessions offre un filtre d'environnement (valeur par défaut « tous »),
tandis que Latence, Usage LLM, Traces Max et Hallucinations lisent sans filtre :
les tours de sandbox y sont donc mélangés à la production. Seul l'onglet Alertes
filtre strictement sur l'environnement actif. `llm_usage`,
`conversation_turn_traces` et `openrouter_cost_error_logs` n'ont pas de colonne
d'environnement : impossible de séparer les coûts sandbox des coûts prod.

## Points d'attention à documenter

1. Sync Notion : écrit toujours en `prod` (`character_prompts` en
   `environment_id: 'prod'`). Une sandbox qui a déjà surchargé un prompt ne
   reçoit pas la mise à jour Notion jusqu'à suppression de sa surcharge.
2. Rebuild RAG / changement de profil d'embeddings : global. Lancé depuis une
   sandbox, il réindexe le corpus pour tout le monde, production comprise.
3. Coûts : un test en sandbox consomme les mêmes quotas fournisseurs que la
   production et n'est pas séparable dans l'onglet Usage LLM.
4. Vidéos et cinématiques : `video_triggers` est global, donc la sync Notion
   « État = En ligne » affecte immédiatement la production.
5. `rag_index_state`, `rag_lab_question_corpus_cache` et `eval_items` sont des
   tables globales : leurs actions de rebuild/sync sont à traiter comme des
   opérations de production.
6. Le runtime public est toujours verrouillé sur `prod` ; un `?env=` d'un
   visiteur anonyme est ignoré. « Tester l'expérience » depuis une sandbox est
   la seule façon de jouer avec des réglages sandbox.

## Livrable

Un rapport `docs/rapport_sandbox_environnements.md` contenant :

- le tableau « isolé par sandbox » vs « partagé globalement », dressé à partir
  du code et du schéma vérifiés ci-dessus ;
- le mode d'emploi pour Ulrich (bascule, portée d'un changement, retour en
  production) et pour Benoît / Romed (ce qu'ils peuvent régler, ce qu'ils ne
  doivent pas déclencher) ;
- la liste des six points de vigilance, avec l'action recommandée pour chacun ;
- une section « écarts constatés » listant les métriques non filtrées
  (Latence, Usage LLM, Traces Max, Hallucinations) et l'absence de colonne
  d'environnement sur `llm_usage` / `conversation_turn_traces`, à traiter comme
  amélioration possible et non comme régression.

Aucune modification de code, de migration ou de réglage dans cette livraison :
c'est un rapport de vérification et un mode d'emploi.

## Suite possible (à décider après lecture)

Si tu veux aller plus loin, deux chantiers séparés : ajouter
`environment_id` à `llm_usage` et `conversation_turn_traces` pour séparer les
coûts, et poser un filtre d'environnement par défaut sur les onglets Latence,
Usage LLM et Traces Max.
