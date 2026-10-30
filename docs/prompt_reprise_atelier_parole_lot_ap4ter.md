# Ava — AP4-ter : ElevenLabs fonctionnel et modèle expressif par défaut

Exécute uniquement AP4-ter, dans un chat neuf. Ce prompt a été préparé le
30 octobre 2026, après la livraison d’AP4-bis et le retour d’Ulrich. Il ne
lance rien d’autre. AP5 (comparaison des fournisseurs avec les voix custom de
Max) attend la fin d’AP4-ter.

## État vérifié

- Main `27d45a09766735cad05d333d415102e266060706` : AP4-bis fusionné par
  #114 via la garde. CI 41054126650 et `regression-gates` verts ; arbre
  `50631b9…` identique au HEAD testé, parent `1ccf0f3` (#115, accès GitHub
  direct). Lovable a reçu `27d45a0` (« pending » à la lecture). Production non
  publiée. Seule autre PR ouverte : #24, à préserver.
- Ce prompt est commité seul sur la branche locale non poussée
  `claude/ap4-ter-elevenlabs` (depuis `27d45a0`). La reprendre pour le lot ;
  elle n’a aucun code.

## Retour d’Ulrich (30 octobre)

Dans l’atelier, la carte ElevenLabs affiche :
« ElevenLabs indisponible ou en échec : ElevenLabs TTS error: 400
(unsupported_model) ». Il demande de corriger le bug, de mettre à jour tous
les réglages ElevenLabs de TTS Config pour qu’ils fonctionnent, et d’indiquer
le bon modèle expressif par défaut, pour que ElevenLabs marche au mieux dans
Ava.

## Diagnostic (fait, à confirmer par une seule requête réelle)

- L’atelier envoie `eleven_v3` (`ELEVENLABS_WORKSHOP_MODEL`,
  `auditionModelId`). Le provider client
  (`src/services/tts/providers/elevenlabs.ts`) transmet tous les réglages de
  TTS Config ; l’Edge Function `supabase/functions/proxy-tts/index.ts` appelle
  `POST /v1/text-to-speech/{voice}/stream` avec **toujours**
  `optimize_streaming_latency=<n>` en query (0 par défaut), plus
  `language_code`, `apply_text_normalization`, `voice_settings` complet,
  `seed`, `previous_text` / `next_text`.
- Cause la plus probable : `optimize_streaming_latency` est **déprécié** dans
  la doc officielle, et des retours de développeurs montrent qu’`eleven_v3`
  répond 400 `unsupported_model` quand il est présent, même à 0. Les
  paramètres de continuité (`previous_request_ids`) sont aussi rejetés par
  `eleven_v3_conversational`. À confirmer dans les logs `proxy-tts` (le corps
  d’erreur ElevenLabs est loggé) ou par un seul essai depuis l’atelier.
- Modèles actuels (doc « Models », lue le 30 octobre) : `eleven_v4`
  (le plus émotif selon ElevenLabs, 90+ langues, 10 000 caractères),
  `eleven_v4_turbo` (~100 ms, balises audio), `eleven_v3` (jeu dramatique,
  70+ langues, 5 000 caractères), `eleven_v3_conversational` (~165 ms,
  balises audio), `eleven_multilingual_v2`, `eleven_flash_v2_5`.
  `eleven_turbo_v2_5` et `eleven_turbo_v2` sont **dépréciés** (remplacer par
  Flash). Tous ceux-là, sauf `eleven_flash_v2`, parlent français.
  La doc ne tranche pas entre « le plus expressif » v4 et v3 ; la
  disponibilité dépend du compte.
- Le code est figé sur v3 : `ELEVENLABS_MODELS` et `TTS_PRESETS`
  (`src/services/settingsService.ts`) proposent encore les Turbo dépréciés et
  ignorent v4 ; `applyElevenLabsPerformance` n’ajoute les balises
  (`ELEVENLABS_V3_TAGS`) que si `modelId === 'eleven_v3'` ; le type
  `auditionModelId` n’accepte que `'eleven_v3'` ; `providerPlan` affiche v3.
- Le jeu : Max et Emma sont sur Gradium dans `sandbox-ulrich`. Changer le
  modèle ElevenLabs ne change la voix du jeu que pour un personnage déjà sur
  ElevenLabs.

## Périmètre

1. **Vérifier avant de coder**, une fois : lire les logs récents de
   `proxy-tts` (MCP Lovable) pour le corps exact de l’erreur ; lister les
   modèles du compte (`GET /v1/models` côté serveur, via une action
   d’administration de `proxy-tts` ou un essai minimal) pour savoir lesquels
   sont accessibles. Ne jamais exposer la clé.
2. **Corriger `proxy-tts`** avec une table de capacités par modèle :
   n’envoyer `optimize_streaming_latency` que pour les modèles qui l’acceptent
   (jamais pour v3/v4 ; le paramètre est déprécié) ; n’envoyer
   `previous_text` / `next_text` / `language_code` / `seed` que là où ils sont
   acceptés ; borner le texte à la limite du modèle. Réponse d’erreur
   inchangée côté client (code et type fournisseur lisibles).
3. **Mettre à jour les réglages ElevenLabs de TTS Config** : liste de modèles
   actuelle (v4, v4 Turbo, v3, v3 Conversational, Multilingual v2, Flash
   v2.5), Turbo dépréciés retirés et convertis vers Flash à la lecture d’un
   réglage stocké, explications en mots simples, contrôle « latence » masqué
   ou désactivé pour les modèles qui ne l’acceptent pas, presets corrigés.
4. **Modèle expressif par défaut** : proposer à Ulrich, preuve à l’appui
   (modèles accessibles sur le compte, une écoute de chaque candidat), le
   défaut de l’atelier et de TTS Config entre `eleven_v4` et `eleven_v3`.
   Recommandation de départ : `eleven_v4` s’il est accessible et accepte les
   balises audio en français, sinon `eleven_v3`. Ulrich choisit ; le défaut
   choisi remplace `ELEVENLABS_WORKSHOP_MODEL` et le type `auditionModelId`.
   Le réglage stocké du jeu ne change que par un enregistrement explicite de
   TTS Config.
5. **Balises d’émotion** : les appliquer à tous les modèles qui les
   supportent (pas seulement `eleven_v3`) ; carte de l’atelier et
   `providerPlan` à jour (modèle, balise, réglages appliqués/ignorés).
6. **Documents** : plan (section AP4-ter dans
   `docs/plan_lot_b_rendu_vocal.md`), CHANGELOG, `docs/etat_courant.md`,
   prompt AP5 actualisé si le modèle ElevenLabs de la comparaison change.

## Invariants

- Inchangés : fiches Notion, prompt GM, modèle/température LLM, mapping des
  états, budget, capture/STT, interruptions/mains libres, transferts, voix et
  fournisseur du jeu (hors enregistrement explicite dans TTS Config).
- Secrets côté serveur uniquement ; aucune clé dans le client, les logs ou
  les documents. Aucune migration. Pas de `.env`. Aucun audio durable. Aucun
  juge LLM. Gami DigiDouble exclu, aucun animal affiché.
- Edge Function modifiée dans le dépôt et déployée par Lovable uniquement ;
  vérifier son déploiement dans Lovable avant de déclarer le bug corrigé.
- Aucune publication en production, aucun lancement automatique d’AP5.
- Plateforme : Lovable est la seule chaîne Cloud, SQL/logs par le MCP Lovable.
  GitHub : appliquer la voie décrite dans AGENTS.md à jour (#115 : accès App
  direct, 1Password en secours), sans Trousseau ni rafale 1Password.

## Validations

- Unitaires : table de capacités (`optimize_streaming_latency` absent pour
  v3/v4, présent pour Multilingual/Flash), conversion des Turbo dépréciés,
  balises pour chaque modèle compatible, plan de carte ElevenLabs, défaut de
  l’atelier.
- Test de l’Edge Function (corps de requête construit par modèle) si le
  dépôt en a l’outillage ; sinon fonction pure testée côté `src`.
- E2E `speech-workshop.spec.ts` : carte ElevenLabs avec le nouveau modèle par
  défaut, corps envoyé sans paramètre refusé.
- `npm run test:quality` et `npm run test:delivery` verts avant le push.
- Recette humaine distincte : après déploiement Lovable, Ulrich génère une
  carte ElevenLabs dans la preview `sandbox-ulrich` et confirme qu’elle joue
  (plus de 400). Une CI verte ne prouve pas ce point.

## Livraison

- Une CI sur la PR, sur le HEAD exact contenant main à jour. Fusion
  uniquement par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`,
  puis vérification de l’arbre et du parent. Si main avance pendant la CI
  (refus de la garde), rebaser et relancer.
- Supprimer notre seule branche. Vérifier Lovable synchronisé et
  `proxy-tts` déployé. Aucune seconde campagne complète sur main.
- Notion : relire la tâche Gamilab
  https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d, ajouter la section
  AP4-ter avec « Last updated by », puis relire l’écriture.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. Lire `git status`, AGENTS.md (version #115), `docs/etat_courant.md`, le
   début du CHANGELOG, puis les sections AP4 et AP4-bis du plan.
2. Vérifier les chats actifs, le remote unique, les branches et PR,
   `git fetch --prune` selon AGENTS, puis main par pull ff-only.
3. Reprendre la branche `claude/ap4-ter-elevenlabs` (rebasée sur main à jour).
4. Lire les logs `proxy-tts` récents par le MCP Lovable Ava
   `1265958d-b74e-40f2-917d-182fe05163fc` pour confirmer la cause du 400.
5. Lire
   `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Règle de travail (demande d’Ulrich)

À chaque nouveau lot, après le diagnostic et **avant tout code**, rédiger le
prompt de reprise du lot pour un chat neuf, le donner à Ulrich et s’arrêter.

## Clôture obligatoire

Dans le même tour, actualiser le prompt autonome d’AP5
(`docs/prompt_reprise_atelier_parole_lot_ap5.md`) : comparaison des
fournisseurs avec les voix custom de Max, ElevenLabs sur le modèle choisi. Il
contient l’état vérifié, les sources, le périmètre, les invariants, les
validations, la livraison, la première action exécutable et cette même
obligation. Donner son lien direct, sans lancer AP5.

Si AP4-ter reste incomplet, enregistrer la reprise exacte et l’unique action
humaine indispensable. Le bilan indique PR/SHA/CI/arbre/parent, les branches
restantes, l’état du déploiement de `proxy-tts` et rappelle que la production
n’est pas publiée.
