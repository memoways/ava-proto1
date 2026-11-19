# Prompt de reprise — guidage de parole du GM, lot 2 (après écoute)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor), **seulement après** l'écoute comparée d'Ulrich et
Romed.

---

Objectif : tirer les conclusions de l'écoute A/B « avec / sans guidage de parole du GM » et appliquer les arbitrages
d'Ulrich, sans changer le comportement par défaut sans décision explicite.

État vérifié au 19 novembre 2026 : lot 1 fusionné sur `main` (CHANGELOG « Guidage de parole du GM »). Interrupteur
`editor.speechGuidance` (défaut `true`) dans Réglages GM ; filtre pur `src/services/gmSpeechGuidance.ts` appliqué dans
`src/services/prd4Orchestrator.ts` ; origines des guidages dans `src/pages/IndexPRD4.tsx` ; mode figé par la version
d'orchestration épinglée à la session ; trace `gm_post_turn_log[].speech_guidance`. Production non publiée.

Sources : `AGENTS.md`, `docs/etat_courant.md`, [plan et cartographie](plan_guidage_parole_gm_ab.md), tâche Notion
[Désactiver le guidage de parole du GM…](https://app.notion.com/p/b7762322e5958387a17b81364680708e) (Gamilab
`7e1a9a09…`), compte rendu d'écoute. Sessions sandbox via MCP Lovable Ava (lecture seule) : `sessions.gm_post_turn_log`
filtré sur `speech_guidance`.

Première action : lire le compte rendu d'écoute et lister les sessions des deux modes ; classer les constats et poser à
Ulrich les arbitrages avant de coder.

Arbitrages possibles : garder les recadrages des garde-fous (hors-sujet, faux statut, dérapage) en mode désactivé ;
changer la valeur par défaut ; mesure complémentaire par le juge J3 (`evaluationOverrides.gmSpeechGuidance`, à exposer
dans `scripts/eval-judge` si demandé) ; retrait de l'interrupteur si la comparaison est close.

Limites : ne pas modifier la base Caractères ni les fiches ; ne pas publier en production sans autorisation distincte ;
préserver cinématiques, passages, mémoire, relation et fin d'appel ; Lovable reste l'unique chaîne de livraison.

Validations : `npm run test:quality`, `npm run test:delivery`, puis CI PR complète ; écoute humaine distincte.

Livraison : branche du lot depuis `main` à jour, plan et CHANGELOG mis à jour, commit, push, PR, CI verte sur le HEAD
exact, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via `github-delivery-exec`), vérification
de l'arbre fusionné, nettoyage de la branche, tâche Notion mise à jour.

Clôture : s'il reste un lot identifié, livrer son prompt de reprise autonome dans `docs/` avec cette même obligation ;
sinon le dire.
