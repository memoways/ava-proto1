# Rapport — Mécanisme sandbox et multi-environnements

> Vérification du code effectuée le 3 septembre 2026.
> Migration de référence : `20260821120000_settings_environments_admin_users.sql`.

## Résumé exécutif

Le mécanisme sandbox fonctionne globalement comme attendu :

- **Ulrich seul** voit le sélecteur d'environnement et peut basculer sans
  re-login.
- **Les réglages sont isolés par sandbox** : chaque environnement a ses propres
  valeurs dans `admin_settings`, avec repli sur Production puis sur les valeurs
  codées en dur.
- **Les données (RAG, Notion, vidéos, embeddings) sont partagées** entre tous les
  environnements.
- **Les métriques sont partagées en lecture**, avec des nuances importantes :
  seul l'onglet Sessions permet de filtrer par environnement ; Latence, Usage
  LLM, Traces Max et Hallucinations mélangent les environnements.

## Tableau : isolé vs partagé

| Domaine | Isolé par sandbox | Partagé globalement | Commentaire |
| --- | --- | --- | --- |
| Réglages LLM | ✅ `admin_settings` | ❌ | Modèle, température, tokens, top-p |
| Réglages TTS | ✅ `admin_settings` | ❌ | Provider, voix, tuning Gradium |
| Réglages STT | ✅ `admin_settings` | ❌ | Provider, dictionnaire custom |
| Réglages RAG | ✅ `admin_settings` | ❌ | Top-k, rerank, threshold, provider |
| Réglages Game Master | ✅ `admin_settings` | ❌ | Prompts, timeout, trust threshold |
| Réglages orchestration | ✅ `experience_orchestration_versions` | ❌ | Versions GM publiées par environnement |
| Prompts personnages | ✅ `character_prompts` | ❌ | Fallback prod si sandbox vide |
| Profils runtime personnages | ✅ `character_runtime_profiles` | ❌ | Activation, voix, opening line |
| Fiches personnages (Notion) | ❌ | ✅ table `characters` | Source unique commune |
| Embeddings / corpus RAG | ❌ | ✅ tables `embeddings`, `rag_index_state` | Un seul index vectoriel |
| Règles, storyworld | ❌ | ✅ tables `rules`, `storyworld` | Contenus communs |
| Étapes gameplay | ❌ | ✅ table `gameplay_steps` | Contenus communs |
| Vidéos / cinématiques | ❌ | ✅ table `video_triggers` | Sync Notion impacte tout le monde |
| Sessions | ⚠️ filtrable | ✅ table `sessions` | Champ `environment_id` présent |
| Latences tour/voix | ⚠️ filtrable | ✅ tables `turn_latencies`, `audio_latencies` | Champ `environment_id` présent mais onglets non filtrés |
| Usage LLM | ❌ | ✅ table `llm_usage` | Pas de colonne `environment_id` |
| Traces Max | ❌ | ✅ table `conversation_turn_traces` | Pas de colonne `environment_id` |
| Coûts OpenRouter | ❌ | ✅ table `openrouter_cost_error_logs` | Pas de colonne `environment_id` |
| Secrets fournisseurs | ❌ | ✅ Lovable Cloud | Une seule clé par service |
| Comptes utilisateurs | ❌ | ✅ Auth Lovable Cloud | Les 4 admins existent une seule fois |

Légende : ✅ signifie « isolé », ❌ signifie « non isolé / partagé », ⚠️ signifie
« partagé mais avec un champ de filtrage existant ».

## Mode d'emploi

### Pour Ulrich (compte `ulrich.fischer@memoways.com`)

1. **Tu arrives en Production** par défaut (bandeau vert).
2. **Le menu déroulant en haut à droite** te permet de passer dans n'importe quelle
   sandbox (Romed, Benoît) ou de revenir en Production.
3. **Aucun re-login** n'est nécessaire : la page se recharge simplement.
4. Quand tu changes de sandbox, **tous les réglages** affichés sont ceux de la
   sandbox choisie.
5. Pour tester : clique sur **« Tester l'expérience »** ; cela ouvre le jeu avec
   les réglages de l'environnement actif.
6. **Important** : un nouvel onglet ou une fenêtre privée repart sur l'environnement
   par défaut de ton compte (Production). La sélection est stockée dans
   `sessionStorage`, pas dans un cookie persistant.

### Pour Romed et Benoît

1. Vous arrivez directement dans **votre sandbox** (bandeau violet).
2. Vous pouvez modifier les réglages sans crainte : cela n'affecte pas la
   Production, ni les autres sandbox.
3. Vous ne voyez **pas** le sélecteur d'environnement. Pour en changer, demandez à
   Ulrich d'utiliser son compte.
4. Pour tester vos réglages, utilisez le bouton **« Tester l'expérience »** en
   haut à droite. Ne visitez pas directement l'URL publique : elle est toujours en
   Production.

### Sync Notion

- La synchronisation depuis l'onglet **Contenu Notion → Sync Notion** écrit dans
  les tables communes (`characters`, `character_prompts` en `environment_id: prod`).
- Si une sandbox a déjà modifié un prompt via l'éditeur personnage, la sync
  Notion ne remplace **pas** automatiquement cette surcharge sandbox. Il faut
  d'abord supprimer la version sandbox pour récupérer la version Notion.
- La sync vidéo (onglet Cinématiques) prend uniquement les lignes Notion dont le
  champ **État = En ligne**. Ces vidéos deviennent immédiatement visibles en
  Production.

## Points de vigilance et actions recommandées

1. **Rebuild RAG / changement de profil d'embeddings**
   - Portée : globale.
   - Risque : lancer un rebuild depuis une sandbox réindexe le corpus pour tout
     le monde, y compris la Production.
   - Action : ne rebuild que si le nouveau profil est validé. Préférer un profil
     parallèle dans RAG Config avant de basculer.

2. **Sync vidéo « En ligne »**
   - Portée : globale.
   - Risque : une vidéo mal calibrée peut apparaître dans l'expérience publique.
   - Action : vérifier l'état Notion avant de synchroniser.

3. **Coûts fournisseurs en sandbox**
   - Portée : quotas partagés (OpenRouter, ElevenLabs, Deepgram, Voyage).
   - Risque : une session de test consomme autant qu'une session publique.
   - Action : surveiller la consommation dans les onglets « Consommation ».

4. **Métriques mélangées**
   - Portée : Latence, Usage LLM, Traces Max, Hallucinations.
   - Risque : interpréter une erreur ou un coût comme étant de la Production alors
     qu'il provient d'une sandbox.
   - Action : vérifier le contexte (`environment_id`) dans l'onglet Sessions ou
     dans les données brutes quand c'est possible.

5. **Sessions anonymes et auth**
   - Portée : globale.
   - Risque : les tests génèrent des comptes anonymes dans la table `auth.users`.
   - Action : le sign-up public est déjà désactivé ; envisager hCaptcha avant les
     campagnes externes.

6. **Nouvel onglet = environnement par défaut**
   - Portée : expérience admin.
   - Risque : croire être en sandbox alors qu'on est revenu en Production.
   - Action : lire le bandeau en haut de page avant toute modification.

## Écarts constatés (à traiter en amélioration, pas en régression)

- `llm_usage` n'a pas de colonne `environment_id` : impossible de séparer le
  coût sandbox du coût production dans l'onglet Consommation LLM.
- `conversation_turn_traces` n'a pas de colonne `environment_id` : les traces de
  Max ne sont pas filtrables par environnement.
- Les onglets Latence, Usage LLM, Traces Max et Hallucinations lisent les données
  sans filtrer sur `environment_id`, même quand le champ existe (`sessions`,
  `turn_latencies`, `audio_latencies`).
- `rag_index_state`, `rag_lab_question_corpus_cache` et `eval_items` sont globaux :
  leurs rebuild/sync sont des opérations de production.

## Recommandation de suite

Si tu veux aller plus loin, deux chantiers indépendants :

1. **Séparer les coûts et traces** : ajouter `environment_id` à `llm_usage` et
   `conversation_turn_traces`, puis mettre à jour les onglets concernés.
2. **Filtrer les métriques par environnement** : appliquer un filtre par défaut
   dans les onglets Latence, Usage LLM, Traces Max et Hallucinations, avec un
   toggle « Tous les environnements » pour conserver la vue globale.
