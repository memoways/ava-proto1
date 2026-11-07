# AVA — Reprise adaptation aux écrans, lot 1 : classe d'appareil et métriques par appareil

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Lot **sans changement visible pour le joueur** : il classe
l'appareil et enregistre cette classe partout où l'on compare des métriques. Une migration additive (via le chat
Lovable) et un redéploiement d'Edge Function (`posthog-latency-stats`, par Lovable). Une action humaine à la fois.

Plan complet et décisions d'Ulrich : [plan_adaptation_ecrans.md](plan_adaptation_ecrans.md).
Tâche Notion : https://app.notion.com/p/a23c4fd90fa848c49e55605c53a9db17.

## Problème

Ava doit bientôt adapter l'expérience à l'écran (lot 2 : appel vocal sans avatar sur smartphone ; lot 3 : tablette).
Aujourd'hui aucune classe d'appareil n'existe : seul `browser_family` est enregistré par tour
(`src/services/voiceTelemetry.ts:168`, `detectBrowserFamily`). On ne peut ni décider l'expérience, ni comparer les
sessions et les latences entre desktop, tablette et smartphone.

## Objectif du lot 1

1. **Classe d'appareil, une seule source** : `src/services/deviceClass.ts` (pur + petit lecteur navigateur).
   - `classifyDevice({ shortSide, pointerCoarse, maxTouchPoints, override })` → `"smartphone" | "tablet" | "desktop"`.
   - Règle validée par Ulrich : override URL valide > **tactile et petit côté de l'écran < 600 px** → smartphone >
     tactile (dont iPad qui se présente « Macintosh » avec `maxTouchPoints > 1`) → tablette > desktop. Une fenêtre
     desktop étroite reste desktop. Petit côté = `min(screen.width, screen.height)` (pas la fenêtre).
   - Override : `?ecran=telephone|tablette|desktop` (valeurs inconnues ignorées), conservé pour toute la session de
     page (survit aux changements de phase ; vérifier qu'un rechargement avec reprise de session le relit).
   - **Figée au premier appel** (mémoïsée) : une rotation ne change pas la classe en cours d'appel.
   - `getDeviceSnapshot()` : classe, source (`auto` / `url`), viewport, petit/grand côté écran, devicePixelRatio,
     orientation, pointeur grossier, tactile. Aucune donnée identifiante (pas d'user agent complet, pas d'adresse).
2. **Session** : migration additive `supabase/migrations/<horodatage>_session_device_class.sql` :
   `sessions.device_class text` nullable avec check sur les 3 valeurs, `sessions.device_info jsonb` nullable.
   Vérifier que `protect_game_session_identity` et `protect_ava_session_context_update` ne la bloquent pas et que
   la politique d'insert (`auth.uid() = user_id`) suffit. Mettre à jour `src/integrations/supabase/types.ts`.
   `createPRD4Session` (`src/services/prd4Session.ts:25-67`) écrit `device_class` et `device_info`.
   **Ordre impératif** : le code qui écrit ces colonnes ne fusionne qu'après la migration appliquée (sinon la création
   de session échoue pour tous). Séquence : PR prête et CI verte → **action d'Ulrich** : coller la migration dans le
   chat Lovable Ava → vérification par l'outil Lovable `query_database` (colonnes présentes) → fusion par la garde.
   Alternative si Ulrich préfère : écriture défensive (réessai sans les colonnes si l'erreur cite une colonne absente),
   à décider avant la PR et à tester.
3. **Tours** : `device_class` à côté de `browser_family` dans le payload des tours et des erreurs
   (`voiceTelemetry.ts` ~L220-283 et L438, `recordVoiceTurnV2`, `recordAvatarAvSync`) et dans `metadata_json` de
   `turn_latencies` / `audio_latencies` (`src/services/latencyTelemetry.ts:101,125`). Aucun changement de politique.
4. **PostHog** : `trackEvent` (`src/services/posthogService.ts:134`) ajoute `device_class` à chaque événement, comme
   l'environnement et le contexte (consentement et filtrage des clés sensibles inchangés).
5. **Admin** :
   - Sessions (`src/components/admin/SessionsTab.tsx`) : champ sur `SessionRow`, colonne/badge et filtre « Appareil »
     sur le modèle des filtres existants (L369-383, L559+). Sessions anciennes : « inconnu ».
   - Latences : dimension « Appareil » à côté de « Navigateur » : `LatencyTelemetryTab.tsx:57-73`,
     `latencyAnalytics.ts` (`LATENCY_DIMENSIONS`), `posthogLatencyStats.ts:216-233`, allowlist et requête de
     `supabase/functions/posthog-latency-stats/index.ts:13,297,308`. Edge Function à redéployer par Lovable.
   - Export Markdown des sessions : vérifier que la colonne apparaît (formateur pur, ne pas toucher au lecteur).

Hors périmètre : tout changement d'expérience (avatar, mise en page, vidéos) — c'est le lot 2 ; `VOICE_ONLY_UI`
reste tel quel.

## Anti-régression

- Aucune branche nouvelle dans `IndexPRD4.tsx` qui modifie le parcours ; seules des métriques s'ajoutent.
- `handsFreeVoice.ts`, `cinematicTransition.ts`, `experienceFrame.ts`, Game Master, passage Max ↔ Emma : intacts.
- Les tests existants passent sans retouche ; un test qui doit changer signale une régression à expliquer.

## État de départ à vérifier

- main contient `a14b7fd` (#167) et la PR docs de ce plan.
- Aucune PR ouverte sur ces fichiers ; PR étrangère #24 à préserver.
- Lecture seule via MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc` : colonnes actuelles de `sessions`.

## Tests attendus

`deviceClass.test.ts` : iPhone portrait (390×844) et paysage, Android petit, iPad portrait/paysage, iPad « Macintosh »
tactile, Android tablette, desktop fenêtre étroite (non tactile), écran tactile de portable, overrides valides et
invalides, mémoïsation. Tests d'insert de session (colonnes présentes), payload de tour avec `device_class`,
`trackEvent` enrichi, filtre admin Sessions et dimension latence. E2E existants verts ; un E2E vérifie que
`?ecran=telephone` donne `device_class = "smartphone"` dans l'insert de session sans rien changer à l'écran.

## Recette (Ulrich, après fusion et synchronisation Lovable)

1. Une session courte sur desktop, une sur iPhone, une sur iPad.
2. Admin → Sessions : filtre « Appareil » donne les trois ; Admin → latences : dimension « Appareil » disponible.

## Invariants

Secrets côté serveur ; base Caractères Notion en lecture seule (seules les tâches Notion se mettent à jour) ; aucun
prompt modifié ; Gami DigiDouble exclu ; aucun animal affiché ; invariants d'AGENTS lus avant de toucher les modules
expérience/parole ; façade `src/services/stt` intacte. Production non touchée.

## Validations et livraison

`npm run test:quality` et `npm run test:delivery` verts ; CHANGELOG, `docs/etat_courant.md`, section « Exécution lot 1 »
du plan dans la branche ; commit, push, PR, CI `regression-gates` verte sur le HEAD exact contenant main à jour, fusion
uniquement par `node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu ; aucun Trousseau). Supprimer la branche,
actualiser main, vérifier la synchronisation Lovable. Fusion ≠ publication.

## Obligation de reprise

Avant le push de ce lot, préparer `docs/prompt_reprise_adaptation_ecrans_lot_2.md` (smartphone : appel vocal sans
avatar, selon le lot 2 du plan) en y reprenant cette même obligation.

## Première action exécutable

`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire `src/services/prd4Session.ts`,
`src/services/voiceTelemetry.ts` (L160-290) et `src/services/posthogService.ts`.
