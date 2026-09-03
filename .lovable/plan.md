# Plan — Rapport de vérification du mécanisme sandbox + page mode d'emploi admin

## Contexte de la vérification

L'utilisateur veut s'assurer que :
- Ulrich seul voit le dropdown de sandbox et peut basculer sans re-login.
- Les réglages sont propres à chaque sandbox, mais les données RAG/synchro Notion
  et les métriques/statistiques sont partagées.
- Un mode d'emploi est ajouté dans l'admin, lié au compte utilisateur, pour
  expliquer ce fonctionnement en termes simples.

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

## Livrable 1 : rapport `docs/rapport_sandbox_environnements.md`

Un document complet contenant :

- le tableau « isolé par sandbox » vs « partagé globalement » ;
- le mode d'emploi technique pour Ulrich, Benoît et Romed ;
- la liste des points de vigilance, avec action recommandée ;
- une section « écarts constatés » listant les métriques non filtrées
  et l'absence de colonne d'environnement sur `llm_usage` /
  `conversation_turn_traces`.

## Livrable 2 : page admin « Mon compte / Mode d'emploi sandbox »

### Emplacement

Nouvelle rubrique « Mon compte » (groupe admin `account`, chemin `mon-compte`)
avec un unique onglet « Mode d'emploi » (`mode-emploi`). Ajouté dans
`src/services/adminNavigation.ts`, sans toucher aux autres groupes.

### Contenu de la page

Texte court et vulgarisé, structuré en sections :

1. **Ton compte** — qui tu es, quel environnement est actif, que tu peux tester
   sans casser la production.
2. **Les sandbox, c'est quoi ?** — chacun a ses propres réglages : modèle LLM,
   voix, STT, etc. Ce que Benoît change reste dans sa sandbox.
3. **Ce qui est commun à tout le monde** — les fiches Notion (personnages,
   règles, vidéos), le RAG, les coûts et les stats. Explication que sync Notion
   met à jour le contenu partagé pour tout le monde.
4. **Comment tester ton expérience** — bouton « Tester l'expérience » + explication
   que seul ce bouton lance le jeu avec les réglages de ta sandbox.
5. **Bons réflexes** — 5 points clés à retenir (ne pas rebuild le RAG à la
   légère, vérifier l'environnement actif avant une sync vidéo, etc.).
6. **En cas de doute** — contact / instruction simple.

### Composant

Création de `src/components/admin/SandboxGuideTab.tsx`. Affichage des données
utilisateur via `useAdminEnvironment()` et du contexte actif (environnement,
type). Style cohérent avec les autres onglets admin (cartes, alertes, listes à
puces). Pas de mutation, juste de l'information.

## Validation

- `npm run build` réussi.
- Tests unitaires existants toujours verts (navigation admin, environmentContext).
- Aucune migration SQL ni Edge Function dans ce plan : documentation + UI
  uniquement.

## Suite possible

Ajouter `environment_id` à `llm_usage` et `conversation_turn_traces` pour
séparer les coûts, et poser un filtre d'environnement par défaut sur les onglets
Latence, Usage LLM et Traces Max.
