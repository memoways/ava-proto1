# AVA — Reprise adaptation aux écrans, lot 2 : smartphone en appel vocal sans avatar

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Lot **visible sur smartphone uniquement** : l'avatar vidéo
en streaming disparaît au profit d'une interface d'appel vocal. Desktop et tablette restent **exactement** sur le
chemin actuel. Aucune migration prévue. Une action humaine à la fois.

Plan complet et décisions d'Ulrich : [plan_adaptation_ecrans.md](plan_adaptation_ecrans.md) (section « Lot 2 » et
« Exécution lot 1 »). Tâche Notion : https://app.notion.com/p/a23c4fd90fa848c49e55605c53a9db17.

## État vérifié au départ (lot 1)

- Lot 1 livré en code (classe d'appareil et métriques) : `src/services/deviceClass.ts` donne
  `getDeviceClass()` → `"smartphone" | "tablet" | "desktop"`, figée au premier appel ; forçage
  `?ecran=telephone|tablette|desktop` gardé dans l'onglet (sessionStorage `ava_device_class_override`).
- `sessions.device_class` / `device_info` écrits par `createPRD4Session` ; `device_class` présent dans les tours,
  latences et PostHog ; filtre « Appareil » dans Admin → Sessions, dimension « Appareil » des latences.
- À vérifier au démarrage : la PR du lot 1 fusionnée sur main, la migration appliquée (Lovable `query_database` :
  colonnes `device_class`, `device_info` sur `sessions`), Edge Function `posthog-latency-stats` redéployée.
  Si l'un manque, le signaler et ne pas commencer le lot 2.

## Objectif du lot 2

1. **Aiguillage unique** : dans `prepareCall` (`src/pages/IndexPRD4.tsx`, ~L819 :
   `const outputMode = startingCharacter === "max" ? outputSettings.mode : "tts";`), si `getDeviceClass() ===
   "smartphone"`, `outputMode = "tts"`. Chemin déjà emprunté par Emma, les appels depuis la grille et les replis
   (`activateTTSFallback`). Enregistrer la raison (`output_mode_reason: "device_smartphone"` dans l'événement
   `prd4_session_started`, et dans la session seulement si une colonne existe déjà — sinon PostHog seul, aucune
   migration). Aucune connexion avatar : pas de `warm_up`, pas de badge « Connexion vidéo… ».
   Vérifier que le passage Max ↔ Emma et les replis ne réactivent jamais l'avatar sur smartphone.
2. **Interface d'appel** : `src/components/ConversationScreen.tsx`, variante `layout="call"` (prop calculée une fois
   depuis la classe, pas de lecture de `window` dans le composant) : vignette circulaire du personnage actif
   (portrait signé `portraitUrl`, repli `src/assets/characters/*`), nom, état (en ligne / parle / écoute, depuis les
   états déjà fournis), minuterie, bouton micro (mains libres ou PTT, mêmes handlers), **Terminer** (raccrocher →
   grille, existant), capsules « Appeler Emma » / « Rester avec Max » et « Une vidéo arrive / Ignorer » réutilisées
   telles quelles. Pas de photo plein écran ni de `<video>`/canvas avatar. Cibles tactiles ≥ 44 px,
   `env(safe-area-inset-*)`, hauteur `100svh` ; `viewport-fit=cover` dans `index.html` seulement si sans effet
   desktop (vérifier).
3. **Gardé tel quel sur smartphone** : `WelcomeScreen` + teaser, cinématiques (lecteur Gumlet commun : vérifier
   `playsInline`, plein écran et déverrouillage audio iOS au geste « Commencer »), `CharacterSelectScreen` (grille
   2 colonnes), `CallingMaxScreen`, questionnaire, fin.

Hors périmètre : tablette (lot 3), `VOICE_ONLY_UI` (inchangé), réglages admin, Game Master, prompts.

## Anti-régression

- Desktop et tablette : aucune condition nouvelle évaluée différemment ; avatar Anam connecté comme avant.
- `handsFreeVoice.ts`, `cinematicTransition.ts`, `experienceFrame.ts`, Game Master, passage Max ↔ Emma : intacts.
  Lire les invariants de la fin d'AGENTS avant de toucher `IndexPRD4.tsx` ou `ConversationScreen.tsx`.
- Les tests existants (unitaires + 4 shards E2E desktop) passent sans retouche ; un test qui doit changer signale
  une régression à expliquer.

## Tests attendus

- Unitaire `ConversationScreen` variante `call` (vignette, nom, état, micro, Terminer, capsules ; aucun élément
  vidéo avatar).
- Unitaire de l'aiguillage (`smartphone` → `tts`, `tablet`/`desktop` → réglage actuel).
- E2E `?ecran=telephone` en viewport 390×844 : commencer → teaser → film → grille → appel Max → échange → passage
  Emma → raccrocher → grille ; assertion « aucune session avatar streaming demandée » (aucun appel à la fonction
  de session avatar, `streaming_avatar_provider` nul dans l'insert) ; E2E desktop inchangés et verts.

## Recette (Ulrich, après fusion et synchronisation Lovable)

1. Sur iPhone (Safari) : appel Max en voix seule avec vignette, cinématique et teaser lus, passage Emma, raccrocher.
2. Sur desktop sans paramètre : avatar Anam connecté comme avant.

## Invariants

Secrets côté serveur ; base Caractères Notion en lecture seule (seules les tâches Notion se mettent à jour) ; aucun
prompt modifié ; Gami DigiDouble exclu ; aucun animal affiché ; façade `src/services/stt` intacte. Production non
touchée.

## Validations et livraison

`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`, section « Exécution
lot 2 » du plan dans la branche ; commit, push, PR, CI `regression-gates` verte sur le HEAD exact contenant main à
jour, fusion uniquement par `node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu ; aucun Trousseau). Supprimer la branche,
actualiser main, vérifier la synchronisation Lovable. Fusion ≠ publication.

## Obligation de reprise

Avant le push de ce lot, préparer `docs/prompt_reprise_adaptation_ecrans_lot_3.md` (tablette optimisée et recette
multi-appareils, selon le lot 3 du plan) en y reprenant cette même obligation.

## Première action exécutable

`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire `src/pages/IndexPRD4.tsx`
(`prepareCall`, ~L792-870), `src/components/ConversationScreen.tsx` et `src/services/deviceClass.ts`.
