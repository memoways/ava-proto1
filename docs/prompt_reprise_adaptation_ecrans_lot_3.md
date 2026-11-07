# AVA — Reprise adaptation aux écrans, lot 3 : tablette optimisée et recette multi-appareils

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Lot **visible sur tablette uniquement** (avatar vidéo
gardé, cadrage et ergonomie tactile) plus projets Playwright appareils et document de recette. Desktop et smartphone
gardent leur chemin. Aucune migration prévue. Une action humaine à la fois.

Plan complet et décisions d'Ulrich : [plan_adaptation_ecrans.md](plan_adaptation_ecrans.md) (sections « Lot 3 »,
« Exécution lot 1 » et « Exécution lot 2 »). Tâche Notion : https://app.notion.com/p/a23c4fd90fa848c49e55605c53a9db17.

## État vérifié au départ (lots 1 et 2)

- Lot 1 (#170, `820816c`) : `src/services/deviceClass.ts`, `getDeviceClass()` figée au premier appel, forçage
  `?ecran=telephone|tablette|desktop` (sessionStorage `ava_device_class_override`) ; `sessions.device_class` /
  `device_info` en base ; `device_class` dans les tours, latences et PostHog ; filtre « Appareil » dans l'admin.
- Lot 2 (smartphone en appel vocal) : aiguillage `src/services/callOutputMode.ts` (`resolveCallOutputMode`,
  `conversationLayoutFor`) appelé une fois dans `IndexPRD4` ; `src/components/prd4/ConversationScreen.tsx` a une
  prop `layout` (`video` / `call`), capsules et micro partagés en blocs JSX. Attention : l'écran monté est
  `src/components/prd4/ConversationScreen.tsx`, pas l'ancien `src/components/ConversationScreen.tsx`.
- `viewport-fit=cover` volontairement absent d'`index.html` (il ferait passer accueil, grille et questionnaire sous
  l'encoche iPhone) : à reprendre seulement avec une marge de sécurité globale, vérifiée sur chaque écran.
- À vérifier au démarrage : PR du lot 2 fusionnée sur main, synchronisation Lovable faite, recette iPhone du lot 2
  rendue par Ulrich (si elle signale un défaut smartphone, le corriger avant la tablette).

## Objectif du lot 3

1. Tablette (`getDeviceClass() === "tablet"`, forçage `?ecran=tablette`) : revue de `ConversationScreen` (layout
   `video`), grille, accueil et lecteur sur 768×1024, 820×1180, 1024×1366, portrait et paysage : cadrage de la vidéo
   avatar (`object-fit`, visage non masqué par l'en-tête), cibles tactiles ≥ 44 px (capsule cinématique « Ignorer »
   comprise), capsules non superposées, pas de dépendance au raccourci Espace seul, `100svh`. Toute adaptation passe
   par une prop calculée une fois depuis la classe (comme `layout`), jamais par une lecture de `window` dans les
   composants ; le rendu desktop ne change pas.
2. Playwright : projets `iphone` (WebKit, iPhone 13) et `ipad` (WebKit, iPad Pro 11) limités à un sous-ensemble
   tagué `@device`, sans alourdir les 4 shards actuels (mesurer la durée CI avant/après ; si WebKit n'est pas
   installé en CI, l'ajouter au cache existant ou garder ces projets en local et le dire).
3. Recette humaine : rédiger `docs/recette_adaptation_ecrans.md` (iPhone Safari, Android Chrome, iPad Safari,
   desktop Chrome — permissions micro, sortie audio haut-parleur / écouteurs / Bluetooth, mains libres, cinématique,
   passage Max ↔ Emma, raccrocher, questionnaire ; comparaison des latences par appareil dans l'admin), avec une
   case par point et la date.

Hors périmètre : `VOICE_ONLY_UI` (inchangé), réglages admin, Game Master, prompts, smartphone (sauf défaut de
recette du lot 2).

## Anti-régression

- Desktop : aucune condition nouvelle évaluée différemment ; avatar Anam connecté comme avant.
- Smartphone : appel vocal du lot 2 inchangé (E2E « écran téléphone » vert sans retouche).
- `handsFreeVoice.ts`, `cinematicTransition.ts`, `experienceFrame.ts`, Game Master, passage Max ↔ Emma : intacts.
  Lire les invariants de la fin d'AGENTS avant de toucher `IndexPRD4.tsx` ou `ConversationScreen.tsx`.
- Les tests existants (unitaires + 4 shards E2E) passent sans retouche ; un test qui doit changer signale une
  régression à expliquer.

## Tests attendus

- Unitaire des éventuelles props tablette (rendu tablette vs desktop identique hors différence voulue).
- E2E `@device` : iPad (WebKit) appel Max avec avatar demandé (vidéo montée, capsules visibles et cliquables),
  iPhone (WebKit) parcours du lot 2 ; E2E existants verts.

## Recette (Ulrich, après fusion et synchronisation Lovable)

1. Lot 2 si pas encore fait : iPhone Safari, appel Max en voix seule avec vignette, cinématique et teaser lus,
   passage Emma, raccrocher ; desktop sans paramètre : avatar Anam connecté comme avant.
2. Lot 3 : dérouler `docs/recette_adaptation_ecrans.md` sur les quatre appareils et le signer.

## Invariants

Secrets côté serveur ; base Caractères Notion en lecture seule (seules les tâches Notion se mettent à jour) ; aucun
prompt modifié ; Gami DigiDouble exclu ; aucun animal affiché ; façade `src/services/stt` intacte. Production non
touchée.

## Validations et livraison

`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`, section « Exécution
lot 3 » du plan dans la branche ; commit, push, PR, CI `regression-gates` verte sur le HEAD exact contenant main à
jour, fusion uniquement par `node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu ; aucun Trousseau). Supprimer la branche,
actualiser main, vérifier la synchronisation Lovable. Fusion ≠ publication.

## Obligation de reprise

Avant le push de ce lot, préparer le prompt de reprise du lot suivant en y reprenant cette même obligation ; si
aucun lot ne suit dans le plan (le lot 3 est le dernier), le dire explicitement dans le plan, `docs/etat_courant.md`
et le compte rendu, avec la recette humaine restante.

## Première action exécutable

`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire
`src/components/prd4/ConversationScreen.tsx`, `src/services/callOutputMode.ts`, `playwright.config.ts` et la section
« Lot 3 » du plan.
