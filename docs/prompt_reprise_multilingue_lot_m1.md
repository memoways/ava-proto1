# Prompt de reprise — Multilingue, lot M1 « Socle : langue de session »

À coller dans un nouveau chat. Ce prompt ne lance rien tant qu'Ulrich ne le demande pas.

## État vérifié (12 novembre 2026)

- Plan approuvé dans ses décisions : [plan_multilingue_ava.md](plan_multilingue_ava.md)
  (sections 1 et 3.1). Aucun code multilingue n'existe ; main `f21be8d` au moment du plan.
- Aucune colonne de langue sur `sessions` ; `"fr"` en dur dans STT, TTS et avatars (liste en
  section 2 du plan). M1 ne touche **pas** à ces services : il pose seulement la langue.
- Tâche Notion (Gamilab) : https://app.notion.com/p/521102f199d34abdade41f1b84cd97ac.

## Périmètre de M1

1. Migration `sessions.locale` : `text not null default 'fr'`, contrainte `fr | en | de | es`.
   Fichier dans `supabase/migrations/` ; application par le chat Lovable (action d'Ulrich).
2. Module `src/services/locale/` : type `Locale`, liste des langues, `resolveSessionLocale`
   (lien `?lang=` → invitation → station → choix mémorisé → navigateur → `fr`),
   `LocaleRuntime` minimal (code seulement à ce stade), lecture unique pour toute l'application.
3. Réglage par environnement `ava_locale_settings` : statut par langue
   (`fermée` | `sandbox` | `publique`), `fr` toujours publique. Une langue fermée dans
   l'environnement retombe sur `fr`.
4. Sélecteur de langue sur l'écran d'accueil, affiché seulement si au moins deux langues sont
   ouvertes dans l'environnement ; `<html lang>` suit la session. Les textes restent français
   (ils arrivent au lot M3).
5. Langue enregistrée sur la session, sur chaque tour (`voice_turn_events`) et dans PostHog ;
   filtre « Langue » dans Admin › Sessions ; langue dans l'export Markdown.
6. Admin › Expérience › **Langues**, volet 1 : statut par langue et par environnement.
7. Test de garde : aucun littéral `"fr"` / `'fr'` de langue hors `src/services/locale/` dans les
   fichiers que M1 touche ; la liste des exceptions restantes (STT, TTS, avatars) est écrite
   dans le test et se vide aux lots M2 et M7.

## Invariants

- Le français ne change pas de comportement : toutes les suites actuelles restent vertes sans
  modification de leurs attentes.
- Langue fixe par session ; aucune détection en cours d'appel.
- Façade `src/services/stt` seule entrée STT ; décisions de tour dans `handsFreeVoice.ts`.
- Base Caractères Notion en lecture seule ; aucune écriture Notion hors tâches.
- Lovable seule chaîne de livraison ; accès base par le MCP Lovable Ava.

## Validations

`npm run test:quality` et `npm run test:delivery` verts ; tests unitaires du module `locale`
(ordre de résolution, langue fermée, valeur inconnue) ; E2E : session `?lang=en` en sandbox
enregistre `en`, session sans paramètre enregistre `fr`.

## Livraison

Branche du lot, commit, push, PR, CI complète sur le HEAD exact, fusion par la garde
(`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `github-delivery-exec`),
nettoyage de la branche, vérification Lovable. Livraison technique distincte de la recette
humaine : Ulrich ouvre une session `?lang=en` en sandbox et vérifie la langue dans Sessions.
Mettre à jour le plan, `docs/etat_courant.md` et le CHANGELOG dans la branche.

## Première action

`git status`, `git fetch --prune`, six commits de main, puis lire
`src/services/environmentContext.ts`, `src/services/deviceServices.ts` et
`src/services/prd4Session.ts` pour reprendre leurs conventions.

## Passation

À la clôture de M1, livrer dans le même tour `docs/prompt_reprise_multilingue_lot_m2.md`
(voix : STT et TTS par langue, écoutes d'Ulrich), avec cette même obligation de passation.
