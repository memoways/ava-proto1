# Prompt de reprise — cinématiques en superposition, lot 2 (après recette)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor), **seulement après** la recette humaine du lot 1.

---

Objectif : traiter les constats de la recette humaine du mode « Superposer à la réponse » des cinématiques et ajuster
ses paramètres, sans changer le mode « Interrompre la conversation ».

État vérifié au 19 novembre 2026 : lot 1 fusionné sur `main` (voir CHANGELOG « Cinématiques : interruption ou
superposition »). Mode choisi dans Backoffice → Expérience → Cinématiques (`ava_video_trigger_settings.PRESENTATION`,
défaut `interrupt` ; `OVERLAY_VIDEO_GAIN_DB` −15). Sélection dédiée sur le texte de la réplique
(`src/services/overlayVideoSelector.ts`, échéance 2 s, confiance ≥ 0,6), machine `src/services/cinematicTransition.ts`
(phases `overlay_*`), câblage `src/pages/IndexPRD4.tsx`, lecteur `GumletVideoPlayer` (muet/atténué), écran
`ConversationScreen` (`cinematicOverlay`). Aucune publication production.

Sources à lire : `AGENTS.md`, `docs/etat_courant.md`, [plan](plan_cinematiques_interruption_superposition.md) (choix,
limites, protocole de recette), tâche Notion
[Comparer les cinématiques…](https://app.notion.com/p/ef162322e59583b7ae03818368ce9008) (Gamilab `7e1a9a09…`) et le
compte rendu de recette d'Ulrich et Romed. Événements `experience_events` de la recette (via MCP Lovable Ava, lecture
seule) : `cinematic_*` avec `presentation`, `selectionMs`, `visibleMs`, `blockedReason`.

Première action : lire le compte rendu de recette et les événements sandbox correspondants ; classer chaque constat
(pertinence, intelligibilité, fluidité, appareil, barge-in) et proposer les ajustements dans le plan avant de coder.

Périmètre possible selon les constats : dB par défaut ; échéances (sélection 2 s, média 2,5 s) et seuil de durée
restante ; confiance minimale ; consigne du sélecteur ; atténuation sur iOS par Web Audio si la vidéo muette déplaît ;
faux barge-in causés par le son de la vidéo ; événement de fin lors d'une annulation pendant l'affichage.

Limites : ne pas modifier la base Caractères ni les fiches ; ne pas publier en production sans autorisation distincte ;
préserver le mode interruption et ses E2E (lot 3b) ; Lovable reste l'unique chaîne de livraison.

Validations : `npm run test:quality`, `npm run test:delivery`, E2E Chromium `-g "superposition|lot 3b"`, puis CI PR
complète ; recette humaine distincte de la livraison technique.

Livraison : branche du lot depuis `main` à jour, plan et CHANGELOG mis à jour, commit, push, PR, CI verte sur le HEAD
exact, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via `github-delivery-exec`), vérification
de l'arbre fusionné, nettoyage de la branche, tâche Notion mise à jour.

Clôture : s'il reste un lot identifié, livrer son prompt de reprise autonome dans `docs/` avec cette même obligation ;
sinon le dire explicitement.
