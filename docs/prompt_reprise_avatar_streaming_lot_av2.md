# Prompt de reprise — avatars streaming, lot AV2 (Anam en mode texte)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS.
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver ; aucune PR ouverte ne doit toucher `src/services/streamingAvatar/`,
   `StreamingAvatar*.tsx` ni l'Edge Function `streaming-avatar-session`, sinon demander à Ulrich).
   Actualise main propre (`git pull --ff-only`), puis crée `feat/avatar-streaming-av2`.
3. Lis `docs/plan_avatar_streaming_multi_fournisseurs.md` en entier, surtout « Anam » (section 3),
   D2 (section 4) et « Exécution AV1 ».
4. **Avant tout code, une seule action d'Ulrich :** saisir le secret `ANAM_API_KEY` dans les
   secrets Lovable Cloud du projet Ava. Une action, un endroit, « réponds **fait** ». Le code peut
   avancer en parallèle ; la recette en a besoin. D2 : AV2 = option (a), `talk` avec une voix
   choisie chez Anam (recommandation du plan), sauf décision contraire d'Ulrich.

## 2. État vérifié à la fin d'AV1 (2 novembre 2026)

- Module pur partagé `supabase/functions/_shared/streamingAvatarRequest.ts` : fournisseurs connus
  `heygen | tavus | anam | lemonslice`, sélectionnables `heygen | tavus`
  (`SELECTABLE_STREAMING_AVATAR_PROVIDERS`), bornes `STREAMING_AVATAR_BOUNDS`, constructeurs de
  corps HeyGen/Tavus testés hors Deno (`src/services/streamingAvatar/streamingAvatarRequest.test.ts`).
- Client : `types.ts` (`StreamingAvatarProviderId` = sélectionnables, `ResponseOutput.setListening?`),
  `settings.ts` (normalisation tolérante, tests `settings.test.ts`), `registry.ts`
  (`Record<StreamingAvatarProviderId, fabrique>`), `protocolCommands.ts`, `providers/heygen.ts`,
  `providers/tavus.ts`. Edge Function : actions `start`, `end`, `check` (admin, Tavus `test_mode`).
- Admin `StreamingAvatarConfigTab.tsx` : blocs « Essentiel » et « Avancé » repliable, composants
  `EnumField`, `NumberField` (bornes, désactivation), `SwitchField`.
- Vérifie au démarrage si la recette humaine AV1 a été faite (HeyGen et Tavus en sandbox, réglage
  avancé changé, interruption) et si l'Edge Function a été déployée par Lovable ; ne la refais pas.

## 3. Périmètre AV2

- **Socle :** rendre `anam` sélectionnable (ajout à `SELECTABLE_STREAMING_AVATAR_PROVIDERS`), une
  fabrique `providers/anam.ts`, réglages `anam` dans le même JSON avec normalisation tolérante et
  bornes partagées ; LemonSlice reste connu et non sélectionnable.
- **Edge Function :** `startAnam` → `POST /v1/auth/session-token` avec `ANAM_API_KEY`, corps
  construit par un helper pur du module partagé (liste blanche) ; forcés par Ava :
  `llmId: "CUSTOMER_CLIENT_V1"` (LLM Anam coupé), `skipGreeting: true`. Liaison
  `sessions.streaming_avatar_provider = "anam"` et fin de session comme HeyGen/Tavus ; statut
  `configured.anam` ; sonde admin.
- **SDK `@anam-ai/js-sdk` :** vérifie la dernière version publiée depuis au moins deux semaines,
  les noms exacts dans la doc et le paquet installé : `talk()` ou `createTalkMessageStream()`,
  événements de début/fin de parole, `interruptPersona()`. Micro **désactivé** côté SDK : aucun
  son publié vers Anam.
- **Réglages :** `avatarId`, `avatarModel` (`cara-3`, `cara-4`, `cara-4.1-express`,
  `cara-4-latest`), `voiceId`, `languageCode`, `maxSessionLengthSeconds` ; `directorNotes`
  (Cara 4) : `presetStyle` **ou** `customStylePrompt` (2 000 car.) + `customIdlingStylePrompt`,
  `expressivity` 0–1 ; `voiceGenerationOptions` selon le moteur de la voix (n'envoyer que les
  champs lus) ; `sessionOptions` utiles (`videoQuality`, `region`/`regionPolicy`).
- **Émotion :** défaut `sad` pour Max et Emma, attitude au repos fermée (même logique que les
  émotions parler/écouter de Tavus, #137–#140), balise de jeu en tête de réplique (`[sad]`,
  `[distressed]`…) si la doc la confirme, retirée des transcriptions.
- **Admin :** carte Anam, « Essentiel » + « Avancé », panneau de test inchangé dans sa forme.
- **Tests :** corps de session Anam (liste blanche, bornes, champs non lus non envoyés), anciens
  réglages relus sans perte, cycle de vie du fournisseur avec SDK simulé (prêt, parole, fin,
  interruption, micro jamais publié).
- **Docs :** plan (section « Exécution AV2 »), CHANGELOG, état courant ; prompt AV3 « LemonSlice en
  mode audio » préparé avant push (D1 à faire trancher par Ulrich : salle Daily recommandée).

## 4. Invariants

- Ava garde micro, STT, LLM ; l'avatar ne fait que dire le texte. Micro jamais publié vers un
  fournisseur. Repli TTS local inchangé. HeyGen et Tavus (émotions tenues, interruption, écoute)
  intacts.
- Aucune URL de salle, jeton ou texte prononcé dans les diagnostics ni les journaux.
- Edge Function : déploiement uniquement par Lovable (MCP Ava
  `1265958d-b74e-40f2-917d-182fe05163fc`) ; aucun Supabase direct, aucune migration, aucune
  publication production. Secret saisi par Ulrich uniquement.

## 5. Validation et livraison

- `npm run test:quality` et `npm run test:delivery` verts, tout commité avant le premier push ;
  CI PR/HEAD exact contenant main, job `regression-gates` vert ; fusion uniquement par
  `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
- Recette humaine d'Ulrich après déploiement Lovable : une session Anam en français, synchro
  labiale, aucun sourire, interruption en cours de réplique, repli TTS si Anam échoue.
- Clôture : prompt AV3 dans `docs/`, lien dans le compte rendu (obligation reprise dans ce prompt).

## 6. Première action exécutable

`git status && git fetch --prune origin && git log --oneline -6 origin/main`, puis la liste des PR
ouvertes par `~/CodeProjects/_shared/scripts/github-delivery-exec gh pr list --repo memoways/ava-proto1`.
