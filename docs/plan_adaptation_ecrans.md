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
