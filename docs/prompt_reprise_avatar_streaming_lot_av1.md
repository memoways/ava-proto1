# Prompt de reprise — avatars streaming, lot AV1 (socle et réglages complets HeyGen + Tavus)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS sans redemander
   d'approbation : ce lot est approuvé.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver). Actualise main propre (`git pull --ff-only`), puis crée la branche
   `feat/avatar-streaming-av1`.
3. Ce prompt et le plan ne sont pas encore sur main : copie-les dans ta branche depuis
   `~/CodeProjects/memoways/ava-proto1/.claude/worktrees/avatar-streaming-services-b79f0a/docs/`
   (`plan_avatar_streaming_multi_fournisseurs.md`, `prompt_reprise_avatar_streaming_lot_av1.md`)
   et commite-les avec le lot. Lis `docs/plan_avatar_streaming_multi_fournisseurs.md` en entier (inventaire des réglages,
   décisions D1–D3, lots, non-régression). Les décisions D1–D3 ne bloquent pas AV1.

## 2. État vérifié (2026-11-02, main `201bda0`)

- `src/services/streamingAvatar/` : `types.ts` (`StreamingAvatarProviderId = "heygen" | "tavus"`),
  `settings.ts` (normalisation), `registry.ts`, `api.ts`, `protocolCommands.ts`,
  `providers/heygen.ts` (SDK `@heygen/liveavatar-web-sdk` 0.0.19, `repeat` = `avatar.speak_text`),
  `providers/tavus.ts` (Daily, `conversation.echo` + balise `dejected`, `set_emotion` tenu
  toutes les 5 s pendant l'écoute).
- Edge Function `supabase/functions/streaming-avatar-session/index.ts` : `startHeyGen` (mode
  FULL, PUSH_TO_TALK, `quality`, `is_sandbox`), `startTavus` (PAL Echo vérifié, `language`
  déprécié, timeouts 120/30 codés en dur), sondes admin.
- Admin : `src/components/StreamingAvatarConfigTab.tsx`, `StreamingAvatarTestPanel.tsx`.

## 3. Périmètre AV1

- **Socle** : ouvrir le type fournisseur à `anam | lemonslice` dans les types et l'Edge Function
  sans les rendre sélectionnables (pas de fabrique, pas de secret) ; réglages par fournisseur
  dans le même JSON `ava_streaming_avatar_settings`, normalisation tolérante (anciens réglages
  relus sans perte ; champ inconnu ou hors bornes → défaut) ; dans l'Edge Function, une liste
  blanche et des bornes par champ (aucune valeur cliente transmise telle quelle).
- **HeyGen** : `quality` + `very_high`, `encoding` (VP8/H264), `max_session_duration`,
  `avatar_persona.voice_settings` par moteur (ElevenLabs, Fish, Cartesia ; n'envoyer que les
  champs lus par le modèle choisi), `avatar.interrupt` à l'interruption,
  `avatar.start_listening`/`stop_listening` pendant que le joueur parle si le SDK l'expose
  (sinon le documenter). Vérifie les noms exacts dans la doc LiveAvatar et le SDK installé.
- **Tavus** : `properties.languages` (remplace `language`, défaut `["fr"]`), timeouts réglables,
  `enable_closed_captions`, `apply_greenscreen`, `policy: "eu"` optionnel, `test_mode` pour le
  panneau de test, `conversation.interrupt` à l'interruption. Voix du PAL : lecture seule et
  affichage des réglages effectifs (D3 non tranchée : aucune écriture du PAL).
- **Admin** : par fournisseur, bloc « Essentiel » puis « Avancé » repliable ; bornes visibles,
  aide d'une ligne en français, champ désactivé quand le modèle ne le lit pas.
- **Tests** : normalisation (anciens JSON, bornes, valeurs inconnues), construction des corps
  HeyGen/Tavus (helper pur partagé si possible, testable hors Deno), commandes `interrupt`,
  non-envoi des champs non supportés.
- Docs : plan (section « Exécution AV1 »), CHANGELOG, état courant ; prompt AV2 « Anam en mode
  texte » préparé avant push.

## 4. Invariants

- Ava garde micro, STT, LLM ; l'avatar ne fait que dire le texte. Micro jamais publié vers un
  fournisseur. Repli TTS local inchangé. Émotion Tavus tenue (#137–#139) intacte.
- Edge Function : déploiement uniquement par Lovable (MCP Ava
  `1265958d-b74e-40f2-917d-182fe05163fc`) ; aucun Supabase direct, aucun secret modifié, aucune
  migration, aucune publication production.
- Recette humaine d'Ulrich après déploiement : une session HeyGen et une Tavus en sandbox avec
  un réglage avancé changé, interruption en cours de réplique.
