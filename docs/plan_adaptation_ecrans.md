# Plan — Adapter AVA aux écrans (avatar vidéo sur tablette et desktop, appel vocal sur smartphone)

## Contexte

[Tâche Notion](https://app.notion.com/p/a23c4fd90fa848c49e55605c53a9db17) « Adapter AVA aux écrans » (Gamilab, État À faire). Aujourd'hui l'expérience est pensée
desktop/Chrome : avatar vidéo en streaming pour Max (Anam/Tavus/HeyGen), photo plein écran, aucune
détection d'appareil, aucune métrique par appareil (seul `browser_family` est enregistré par tour).

Décisions d'Ulrich (7 novembre 2026) :
- **Seuil** : écran tactile dont le **petit côté < 600 px** = smartphone ; classé **une fois au
  démarrage**, la rotation ne bascule pas en cours d'appel ; une fenêtre desktop étroite reste vidéo.
- **Smartphone : tout est gardé** (teaser, cinématiques, grille des personnages, questionnaire).
  Seul l'**avatar vidéo en streaming** disparaît, remplacé par une interface d'appel vocal (nom +
  vignette circulaire du personnage actif). Écart avec la tâche Notion (« aucune vidéo ») : à
  reformuler dans la tâche à la clôture.
- **Forçage** : paramètre d'URL `?ecran=telephone|tablette|desktop` (tests, E2E, recette).
- **Métriques** : classe d'appareil sur la **session** (migration via chat Lovable), dans **chaque
  tour** (`metadata_json`) et dans **PostHog** ; filtre « Appareil » dans l'admin.

Personnages : Max et Emma actifs ; Ava et Léo restent grisés (aucune promesse nouvelle).

## Principe anti-régression

- Une seule fonction pure décide la classe ; **desktop et tablette suivent exactement le chemin actuel**
  (aucune condition nouvelle n'est évaluée différemment pour eux, sauf l'ajout de métriques).
- Le smartphone change un seul aiguillage métier : `outputMode` forcé à `"tts"` dans `prepareCall`
  (`src/pages/IndexPRD4.tsx:819`), chemin déjà utilisé pour Emma, les appels depuis la grille et les
  replis (`activateTTSFallback`). Aucune modification de `handsFreeVoice.ts`, `cinematicTransition.ts`,
  `experienceFrame.ts`, du Game Master ni du passage Max ↔ Emma.
- `VOICE_ONLY_UI` (réglage existant, sans effet visuel) n'est pas réutilisé ni modifié.
- Toute la suite actuelle (unitaires + 4 shards E2E desktop) doit rester verte sans retouche des tests
  existants ; les nouveaux tests s'ajoutent.

## Lot 1 — Classe d'appareil et métriques (aucun changement visible)

1. `src/services/deviceClass.ts` (nouveau, pur) : `classifyDevice({ shortSide, pointerCoarse,
   maxTouchPoints, override })` → `"smartphone" | "tablet" | "desktop"` + `getDeviceSnapshot()`
   (classe, viewport, `screen` petit/grand côté, devicePixelRatio, orientation, pointeur, tactile,
   source `auto|url`). Règle : override URL valide > tactile et petit côté < 600 → smartphone >
   tactile (y compris iPad « Macintosh » avec `maxTouchPoints > 1`) → tablette > desktop.
   Lecture de `?ecran=` (valeurs inconnues ignorées). Classe figée au premier appel (mémoïsée).
2. Migration additive `supabase/migrations/<date>_session_device_class.sql` :
   `sessions.device_class text` (check sur les 3 valeurs, nullable) + `sessions.device_info jsonb`.
   Vérifier qu'aucun trigger (`protect_game_session_identity`, `protect_ava_session_context_update`)
   ne la bloque. **Action d'Ulrich** : la coller dans le chat Lovable ; vérification de la colonne via
   l'outil Lovable `query_database` **avant** de fusionner le code qui l'écrit (sinon l'insert de
   session échouerait). Régénérer/compléter `src/integrations/supabase/types.ts`.
3. Écriture : `createPRD4Session` (`src/services/prd4Session.ts:25`) ajoute `device_class` et
   `device_info` ; restauration de session inchangée.
4. Tours : `src/services/voiceTelemetry.ts` (payload ~L220-283, erreurs L438) ajoute `device_class`
   à côté de `browser_family` ; idem `metadata_json` de `turn_latencies`/`audio_latencies`
   (`src/services/latencyTelemetry.ts`).
5. PostHog : `src/services/posthogService.ts` `trackEvent` ajoute `device_class` à tous les
   événements (comme environnement/contexte).
6. Admin :
   - `SessionsTab.tsx` : colonne + filtre « Appareil » (même motif que les filtres L369-383, L559+).
   - Latences : dimension `device` sur le modèle de `browser` dans `LatencyTelemetryTab.tsx:57-73`,
     `latencyAnalytics.ts`, `posthogLatencyStats.ts:216-233` et l'allowlist de l'Edge Function
     `supabase/functions/posthog-latency-stats/index.ts:13,297,308` (redéploiement par Lovable).
   - Export Markdown : la colonne apparaît d'elle-même (vérifier).
7. Tests : unitaires `deviceClass.test.ts` (iPhone portrait/paysage, Android, iPad portrait/paysage,
   iPad « Macintosh », desktop fenêtre étroite, override) ; test d'insert de session ; E2E existants
   verts.

### Exécution lot 1 (7 novembre 2026)

- `src/services/deviceClass.ts` : `classifyDevice` (pur), `parseDeviceOverride`, `readDeviceOverride` (URL puis
  sessionStorage de l'onglet, clé `ava_device_class_override`, pour survivre aux changements de phase et au
  rechargement), `getDeviceSnapshot` / `getDeviceClass` figés au premier appel, libellés admin. Un point de
  toucher unique (`maxTouchPoints = 1`) sans pointeur grossier reste desktop.
- Migration `supabase/migrations/20261107211500_session_device_class.sql` : colonnes nullables, check sur les
  trois valeurs. Vérifié en lecture (Lovable `query_database`, 7 novembre) : colonnes absentes avant migration ;
  politique d'insert `Participant insert own session` (`auth.uid() = user_id`) suffisante ;
  `protect_game_session_identity` et `protect_ava_session_context_update` n'inspectent pas ces colonnes.
  Ordre : migration appliquée et vérifiée **avant** la fusion du code qui écrit les colonnes.
- `device_class` dans `voice_turn_completed`, `voice_error`, V2, `avatar_av_sync`, `turn_latencies`,
  `audio_latencies` et tous les événements PostHog (`trackEvent`). Colonne de requête HogQL ajoutée en fin de
  liste (position 26) pour ne déplacer aucun index existant.
- Admin : filtre Sessions (Smartphone / Tablette / Desktop / Inconnu), mention dans la liste et le détail ; dimension
  « Appareil » (latences internes, filtres PostHog, répartition « Appareils ») ; ligne « Appareil » de l'export.
- Tests : `deviceClass.test.ts`, `prd4Session.test.ts`, `deviceClassMetrics.test.ts`, ajouts dans
  `voiceTelemetry`, `posthogService`, `posthogLatencyEndpoint` ; E2E `?ecran=telephone` → insert
  `device_class = "smartphone"` sans changement d'écran. Deux attentes exactes de `latencyTelemetry.test.ts`
  incluent désormais `device_class` (ajout demandé, pas une régression).

## Lot 2 — Smartphone : appel vocal sans avatar

1. `prepareCall` : si classe `smartphone`, `outputMode = "tts"` et `output_mode`/provider de session
   cohérents (raison enregistrée `device_smartphone`) ; aucune connexion avatar, donc pas de
   `warm_up`, pas de badge « Connexion vidéo… ».
2. `ConversationScreen.tsx` : variante `layout="call"` (prop issue de la classe) :
   vignette circulaire (portrait signé `portraitUrl` → repli `src/assets/characters/*`), nom, état
   (« en ligne » / parle / écoute, depuis les états déjà fournis), minuterie, bouton micro
   (mains libres ou PTT, mêmes handlers), **Terminer** (raccrocher → grille, existant), capsule
   « Appeler Emma » / « Rester avec Max » et capsule « Une vidéo arrive / Ignorer » réutilisées telles
   quelles. Pas de photo plein écran ni de canvas/`<video>` avatar. Cibles tactiles ≥ 44 px,
   `env(safe-area-inset-*)` (ajouter `viewport-fit=cover` dans `index.html` seulement si sans effet
   desktop), hauteur `100svh`.
3. Gardés tels quels sur smartphone : `WelcomeScreen` + teaser, cinématiques (lecteur Gumlet commun,
   vérifier `playsInline`, plein écran et déverrouillage audio iOS au geste « Commencer »),
   `CharacterSelectScreen` (grille 2 colonnes), `CallingMaxScreen`, questionnaire, fin.
4. Tests : unitaire `ConversationScreen` variante call ; E2E `?ecran=telephone` en viewport 390×844
   (parcours : commencer → teaser → film → grille → appel Max → échange → passage Emma → raccrocher →
   grille) avec assertion « aucun avatar streaming demandé » ; E2E desktop inchangés.

### Exécution lot 2 (7 novembre 2026)

- Départ vérifié : PR #170 (lot 1) fusionnée (`820816c`), colonnes `sessions.device_class` / `device_info`
  présentes (Lovable `query_database`). Aucune colonne `output_mode_reason` : raison envoyée à PostHog
  seulement, aucune migration.
- Aiguillage unique `src/services/callOutputMode.ts` : `resolveCallOutputMode` (pur) rend `{ mode, reason }`
  — smartphone → `tts` / `device_smartphone` (prioritaire, même pour Max et même si le réglage demande
  l'avatar), autre personnage que Max → `tts` / `character_voice_only` (règle existante), sinon le réglage /
  `settings`. `prepareCall` l'appelle ; `output_mode_reason` part dans `prd4_session_started`.
  `createResponseOutput` n'est appelé que dans `prepareCall` : le passage Max ↔ Emma et les appels depuis la
  grille passent par `activateTTSFallback` (déjà en `tts` → aucun changement), aucun chemin ne réactive l'avatar.
- `src/components/prd4/ConversationScreen.tsx` (l'écran réellement monté par `IndexPRD4`, pas l'ancien
  `src/components/ConversationScreen.tsx`) : prop `layout` (`"video"` par défaut, `"call"` sur smartphone),
  calculée une fois dans `IndexPRD4` par `conversationLayoutFor(getDeviceClass())`. Les capsules (passage,
  « Rester avec », « Une vidéo arrive / Ignorer ») et les commandes micro sont extraites en blocs JSX partagés :
  le rendu vidéo garde exactement le même DOM. Variante appel : vignette ronde 144 px (portrait signé → repli
  local), nom, état « en ligne / parle… / écoute… / réfléchit… », minuterie, **Terminer** (44 px), même micro ;
  aucun `<video>` ni canvas, même si l'avatar était demandé. `100svh` et `env(safe-area-inset-*)`.
- `viewport-fit=cover` **non ajouté** : sans effet desktop, mais il ferait passer sous l'encoche iPhone tous
  les autres écrans (accueil, grille, questionnaire) qui n'ont pas de marges de sécurité. Les `env()` valent 0
  sans lui ; à reprendre au lot 3 avec une marge globale si besoin.
- Lecteur de cinématiques (Gumlet commun) vérifié sans changement : `playsInline`, plein cadre
  (`absolute inset-0`), déverrouillage audio et lecture au geste « Commencer » sur le même élément `<video>`.
- Tests : `callOutputMode.test.ts` (smartphone → `tts` quel que soit le réglage ; tablette/desktop → réglage ;
  Emma → voix), `ConversationScreen.callLayout.test.tsx` (vignette, nom, état, micro PTT et mains libres,
  Terminer, capsules, aucun élément vidéo ; rendu vidéo par défaut inchangé) ; E2E « écran téléphone » 390×844,
  `?ecran=telephone`, réglage serveur forcé sur l'avatar : commencer → teaser → film → grille → appel Max →
  quatre échanges → Appeler Emma → Terminer → grille ; insert `output_mode = "tts"`,
  `streaming_avatar_provider = null`, `device_class = "smartphone"`, aucune requête
  `streaming-avatar-session`. Contrôle de mutation : sans l'aiguillage, ce test échoue. Tests existants
  inchangés (le faux réseau gagne seulement l'option `outputMode`).
- Recette : [prompt lot 3](prompt_reprise_adaptation_ecrans_lot_3.md) reprend la recette iPhone du lot 2.

### Exécution lot 2 bis (8 novembre 2026)

- Recette iPhone (session `032b7235`, Safari) : Max muet, tours `error_type: "tts"`, `t_audio_playback_total_ms: 0`.
  Cause : sur iPhone la voix ne passe plus par l'avatar (WebRTC) mais par Gradium en Web Audio ; iOS met
  l'AudioContext en `interrupted` au démarrage du micro, état que le code ne relançait pas. Correctif dans
  `audioPlayback.ts` (relance de `interrupted`, relance à chaque geste, déverrouillage synchrone dans le geste) et
  `gradiumStreamPlayer.ts` ; `error_detail` ajouté à `voice_turn_completed` pour lire l'erreur exacte si un échec
  subsiste. Non vérifiable hors d'un vrai iPhone : à confirmer en recette.
- Responsive smartphone par `max-sm:` (< 640 px), donc tablette et desktop inchangés : question du film (image entière
  en pleine largeur, réponses en bas), accueil et fin (bouton principal en bas, pleine largeur), cibles 44 px (Passer,
  Terminer l'expérience, Revoir l'introduction, Terminer l'appel), marges de sécurité basses, libellés tactiles.
  Grille, écran d'appel et questionnaire relus à 390×844 : déjà adaptés, inchangés.
- `viewport-fit=cover` toujours absent : les marges `env()` valent 0 sans lui, d'où des `max(…)` avec un minimum fixe.

## Lot 3 — Tablette optimisée et recette multi-appareils

1. Revue de `ConversationScreen`, grille, accueil et lecteur sur 768×1024, 820×1180, 1024×1366
   (portrait/paysage) : cadrage de la vidéo avatar (`object-fit`), tailles tactiles, capsules non
   superposées, clavier absent (pas de raccourci Espace seul), `100svh`.
2. Playwright : projets `iphone` (WebKit, iPhone 13) et `ipad` (WebKit, iPad Pro 11) sur un sous-ensemble
   `@device`, sans alourdir les shards actuels (vérifier la durée CI).
3. Recette humaine d'Ulrich (document `docs/recette_adaptation_ecrans.md`) : iPhone Safari,
   Android Chrome, iPad Safari, desktop Chrome — permissions micro, sortie audio (haut-parleur,
   écouteurs, Bluetooth), mains libres, cinématique, passage Max ↔ Emma, raccrocher, questionnaire ;
   comparaison des latences par appareil dans l'admin.

### Exécution lot 3 (8 novembre 2026)

- Départ vérifié : PR #172 (lot 2 bis) fusionnée (`3023e7f`) ; recette iPhone du lot 2 / 2 bis encore à faire par
  Ulrich (reprise dans la recette ci-dessous, section iPhone).
- Prop `touchFirst` calculée une fois dans `IndexPRD4` par `touchFirstFor(getDeviceClass())` (vrai hors desktop) et
  passée à `ConversationScreen`, `CharacterSelectScreen` et `GumletVideoPlayer` ; aucune lecture de `window` dans
  les composants. Sur l'écran vidéo : `min-h-[100svh]` (barre Safari iPad), « Terminer » et « Ignorer » à 44 px,
  « Touche pour parler ». Grille : « Revoir la vidéo d'introduction » et « Terminer l'expérience » à 44 px. Lecteur :
  « Passer » à 44 px. Faux → rendu desktop strictement inchangé. Le raccourci Espace reste un bonus clavier, jamais
  le seul moyen (le bouton micro suffit).
- Revue (WebKit, `?ecran=tablette`, 768×1024, 1024×768, 820×1180, 1180×820, 1024×1366, 1366×1024) : avant
  correctif, seuls « Passer » (30 px) et « Revoir la vidéo d'introduction » (36 px) étaient sous 44 px ; après,
  aucune cible visible sous 44 px sur accueil, teaser, film, grille, conversation. Cadrage : un flux 16:9 en
  `object-cover` sur 3:4 ou 4:3 ne coupe que les côtés, le visage reste centré, la colonne des capsules (gauche,
  160 px) et « Terminer » (droite) ne le recouvrent pas ; `object-position` inchangé.
- Playwright : projets `iphone` (iPhone 13) et `ipad` (iPad Pro 11), WebKit déjà installé en CI, `grep` sur
  `@iphone` / `@ipad` ; `chromium` exclut `@device`. Deux tests courts répartis par le sharding par test.
  iPad : avatar demandé (session avatar sans réponse → `<video>` monté), `device_class = tablet`, cibles ≥ 44 px de
  l'accueil à la conversation, capsules empilées sans chevauchement, raccrocher. iPhone : appel vocal du lot 2 sous
  WebKit (Max puis Emma depuis la grille, raccrocher), sans requête avatar. Premier essai CI avec des tours de parole :
  WebKit Linux ne termine pas la lecture audio simulée puis la page plante (fragilité déjà notée pour les cinématiques) ;
  tours, clic de la capsule de passage et cinématiques restent couverts par les E2E Chromium sur les mêmes composants.
  Ce sont des émulations (viewport, tactile, moteur WebKit), pas de vrais appareils.
- Durée CI avant : run 42459423384, shards e2e 6 min 00 à 7 min 05, run 7 min 11 ; après : run 42461979370, shards
  6 min 14 à 7 min 17, run 7 min 22 (~ +11 s). Livré par PR #173 (`fa18a58`).
- Recette humaine : [docs/recette_adaptation_ecrans.md](recette_adaptation_ecrans.md).
- **Aucun lot ne suit dans ce plan.** Restent la recette humaine signée et la reformulation de la tâche Notion
  (« avatar vidéo » au lieu de « aucune vidéo »).

### Retours de recette iPhone (8 novembre 2026, après le lot 3)

- Max muet sur iPhone Safari en mains libres (session `feb8eb9b`) : chaque tour `error_type: "tts"`,
  `error_detail.name = NotAllowedError` alors que l'AudioContext est `running` ; `audio_latencies` montre
  ElevenLabs (`http_stream`) refusé en 1 ms. Cause : la voix de Max passe par ElevenLabs dans un `<audio>`
  (MediaSource) créé à chaque réplique ; iOS refuse `play()` d'un nouvel élément hors geste. Seule l'ouverture,
  lancée par l'appui sur « Appeler », passait. Le lot 2 bis avait corrigé le chemin Web Audio (Gradium), pas celui-ci.
- Correctif (`src/services/audioPlayback.ts`, `elevenLabsStreamPlayer.ts`) : un refus `NotAllowedError` avant tout
  son rejoue la même réplique par l'AudioContext déjà déverrouillé (décodage + buffer source, arrêt immédiat à
  l'interruption) ; le refus est mémorisé et les répliques suivantes vont directement en Web Audio, sans tenter le
  flux `<audio>`. Coût sur iPhone : la réplique démarre une fois le MP3 complet reçu (plus de lecture progressive).
  Desktop, Android et iPad sans refus : chemin inchangé. Le secours ne joue que si l'expérience a déverrouillé le
  contexte (appel lancé par un appui) : ailleurs (banc admin des voix), le refus reste affiché comme avant.
- Écran d'appel smartphone : « Terminer » en haut à droite avec le minutage dessous, autres personnages (capsule de
  passage, annonce de cinématique) en haut à gauche. Tablette tactile : minutage sous « Terminer » ; desktop inchangé.
- Tests : `audioAutoplayRescue.test.ts`, deux cas dans `elevenLabsStreamPlayer.test.ts`, coins vérifiés en unitaire
  et dans les E2E `@iphone` / `@ipad`.

## Livraison et documentation

- Plan versionné `docs/plan_adaptation_ecrans.md` ; une PR par lot via `github-delivery-exec` et la garde
  `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` après CI verte ; STORY/CHANGELOG/
  HANDOFF/`docs/etat_courant.md` dans la branche ; prompt de reprise du lot suivant à chaque clôture.
- Notion : mise à jour de la tâche seulement (état, critères reformulés « avatar vidéo » au lieu de
  « aucune vidéo ») ; aucune modification de la base Caractères.
- Production non touchée ; migration et Edge Function via Lovable uniquement.

## Vérification

- `npm run test:quality`, `npm run test:delivery`, CI PR (4 shards E2E + `regression-gates`) verts.
- Lot 1 : session de test → `sessions.device_class` rempli (requête Lovable), `device_class` présent
  dans `voice_turn_events.metadata_json` et PostHog, filtre admin fonctionnel.
- Lot 2 : `?ecran=telephone` sur desktop puis vrai iPhone : aucune session avatar créée
  (`streaming_avatar_provider` vide), voix jouée, cinématique et teaser lus, passage Emma et
  raccrocher OK ; desktop sans paramètre identique à avant (avatar Anam connecté).
- Lot 3 : recette humaine signée par Ulrich.
