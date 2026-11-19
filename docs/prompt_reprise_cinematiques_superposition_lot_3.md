# Prompt de reprise — cinématiques en superposition, lot 3 (mesure et recette de pertinence)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : vérifier en sandbox que le lot 2 tient ses promesses — en mode « Superposer à la réponse », autant de
cinématiques que les réglages du backoffice le permettent et des vidéos en lien concret avec ce qui se dit — puis
ajuster seuils et échéance d'après les mesures, sans toucher au mode « Interrompre la conversation ».

## État (19 novembre 2026)

Lot 2 livré sur `main` (voir CHANGELOG « Cinématiques en superposition : lot 2 » et le SHA du compte rendu de
livraison). [Plan, causes confirmées et choix](plan_cinematiques_interruption_superposition.md#lot-2--fréquence-et-pertinence-19-novembre).
Sélecteur : `src/services/overlayVideoSelector.ts` (lien concret `checkOverlayLink`, échéance
`overlaySelectionTimeoutMs` 1,2–5 s, confiance ≥ 0,7, deux échanges précédents, identifiants courts) ; câblage
`src/pages/IndexPRD4.tsx` (bloc « Overlay: the GM judges a turn only after… ») ; proxy
`supabase/functions/proxy-llm/payload.ts` (`disable_reasoning`, Gemini 2.5 Flash seulement). Cas réels figés :
`src/services/overlayVideoSelector.fixtures.ts`.

## Première action

1. Vérifier que Lovable a bien redéployé `proxy-llm` avec `disable_reasoning` (sinon le demander à Lovable par son
   chat : changement versionné, aucun déploiement Supabase direct). Une fusion ne vaut pas déploiement.
2. Lecture seule (MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`) sur les sessions sandbox postérieures à la
   livraison : `experience_events` (`cinematic_recommended` source `overlay_selector` avec `selectionMs`, `timeoutMs`,
   `replyCue`/`videoCue` ; `cinematic_blocked` par `blockedReason`, dont `overlay_no_allowed_video` avec `rules` et
   `overlay_selection_weak_link` avec `detail`) et `llm_usage` (`prd4_overlay_video_selection` : part `completed`,
   tokens d'entrée/sortie). Comparer à la base du 19 novembre : 1 réussite sur 22, 20 délais à 2 s, 1 820 tokens d'entrée.
3. S'il n'y a pas encore de session, demander à Ulrich **une seule** action : une session sandbox de 15 tours avec Max
   en superposition, en abordant le fusil / l'abri / Peter, puis répondre « fait ».

## Périmètre

- Fréquence : si des `timeout` restent fréquents, envisager le lancement anticipé (première phrase en flux, contrôle
  sur le texte final) ou un modèle de sélection dédié réglable ; ajuster `OVERLAY_SELECTION_MAX_TIMEOUT_MS`.
- Pertinence : relire chaque `replyCue ↔ videoCue` ; si de bons liens sont refusés (`no_shared_word`,
  `cue_not_in_video`), ajuster `checkOverlayLink` ou `OVERLAY_PARAPHRASE_MIN_CONFIDENCE` avec un test sur le cas réel.
- Recette humaine Ulrich + Romed (protocole du plan) : pertinence 0–3 par cinématique ; distincte de la livraison.

## Limites

Base Caractères Notion en lecture seule (interdiction formelle) ; pas de publication production sans autorisation
distincte ; mode interruption et ses E2E (lot 3b) préservés ; Lovable unique chaîne de livraison ; aucun accès au
Trousseau ; `gh` uniquement via `~/CodeProjects/_shared/scripts/github-delivery-exec` ; aucune identité anonyme créée
pour sonder le proxy sans accord d'Ulrich.

## Validations et livraison

`npm run test:quality`, `npm run test:delivery`, tests du proxy si modifié, E2E Chromium `-g "superposition|lot 3b"`,
CI PR complète. Branche du lot depuis `main` à jour ; plan, CHANGELOG et `docs/etat_courant.md` à jour ; commit, push,
PR, CI verte sur le HEAD exact, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via
`github-delivery-exec`), vérification de l'arbre fusionné, nettoyage de la branche, synchronisation Lovable vérifiée,
commentaire sur la tâche Notion [Comparer les cinématiques…](https://app.notion.com/p/ef162322e59583b7ae03818368ce9008)
(Gamilab `7e1a9a09…`).

## Clôture

S'il reste un lot identifié, livrer son prompt de reprise autonome dans `docs/` avec cette même obligation ; sinon le
dire explicitement.
