# Prompt de reprise — Réglages GM, lot C : modes GM off / léger / fort et vue « GM → personnage »

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : permettre à Ulrich de sentir l'incidence du GM sur les tours en comparant trois modes (off, léger, fort),
et de voir, tour par tour, le texte exact que le GM a transmis au personnage. Lot C du plan validé le 19 novembre 2026,
après le lot A (registre et compilation runtime des réglages, livré le 19 novembre).

Lire d'abord : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`, `git status`, les six commits récents de `main`, le
début du CHANGELOG, puis [le plan](plan_reglages_gm_lisibles_gradues.md) (sections « État des lots », « Lot C » et
« Principe directeur ») et [le plan guidage de parole #203](plan_guidage_parole_gm_ab.md).

État vérifié au 19 novembre 2026 (fin du lot A) :
- Registre `src/services/gmSettingsRegistry.ts` : une entrée par réglage (destination GM / personnage / code et texte
  exact). Toute nouvelle option (ici `gmMode`) y entre avec son texte par valeur ; l'aperçu `GmSettingPreview` de
  Réglages GM l'affiche sans autre code.
- Le bloc de réglages est compilé à chaque tour depuis la config épinglée (`resolveDirectorSystemPrompt`,
  `src/agents/gameMasterPRD4.ts`), `builtin://` compris. sandbox-romed (v4) et sandbox-benoit (v5) sont en `builtin://`.
- `editor.speechGuidance` (booléen, #203) coupe seulement le conseil de parole : `resolveCharacterGuidance`
  (`src/services/gmSpeechGuidance.ts`), lu dans `src/services/prd4Orchestrator.ts:386` ; surcharge
  `evaluationOverrides.gmSpeechGuidance` (`prd4Orchestrator.ts:142`) utilisée par le juge J3
  (`evalJudgePipeline.ts`, `evalJudgeSequenceLive.ts`). Le GM post-tour est appelé `prd4Orchestrator.ts:544`.
- Historique des sessions : `src/components/admin/SessionsTab.tsx:898-955` affiche `speech_guidance` par évaluation
  GM ; export `src/services/sessionMarkdownExport.ts:90`. `gm_speech_guidance` part dans la trace (`IndexPRD4.tsx:2579`).
- Nouveaux du lot A utiles ici : interrupteur `editor.characterTimeCues` (repères de temps du personnage, tracé
  `memory.characterTimeCues`) ; température `LLM_GM_TEMPERATURE` (défaut 0.2).

Périmètre du lot C (détail dans le plan) :
1. `editor.gmMode: 'off' | 'light' | 'full'` remplace `editor.speechGuidance` (normalisation : `false` → `light`,
   sinon `full`), fixe pour la session. off : aucun appel GM post-tour ; le personnage garde fiche, RAG, mémoire de
   conversation, cadre ; ni passage proposé par le GM ni cinématique ; fin au minuteur ; demande explicite du joueur
   de changer de personnage conservée. light : comportement actuel « guidage désactivé ». full : comme aujourd'hui.
   Les recadrages des garde-fous en mode light restent un arbitrage ouvert (lot 2 de #203) : ne pas le trancher.
2. Persister par tour le texte exact injecté chez le personnage depuis le GM (champ `injected` de
   `gm_post_turn_log[]`), plus `gmMode`.
3. Historique des sessions et export Markdown : colonne « GM → personnage » (texte injecté, ou « rien : mode off /
   light ») à côté de la réplique.
4. Juge J3 : `evaluationOverrides.gmMode` remplace `gmSpeechGuidance`.
5. UI : sélecteur 3 crans avec une phrase par mode, entrée au registre (aperçu automatique).

Hors périmètre : priorités en curseurs (lot B), radar d'état (lot D), courbe d'expérience (chantier E).

Limites : base Caractères Notion en lecture seule, fiches intactes ; aucun Supabase direct (MCP Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc` en lecture pour vérifier) ; aucune publication production ; aucun appel IA
ajouté sur le chemin du tour (le mode off en retire un). Si une migration s'avérait nécessaire, la livrer en fichier et
la faire appliquer via le chat Lovable.

Première action : vérifier en lecture (MCP Lovable) les valeurs `editor.speechGuidance` des versions publiées par
environnement, puis écrire les tests (normalisation, GM non appelé en off dans `prd4Orchestrator.test.ts`, `injected`
persisté, juge) avant le code.

Validations : tests unitaires, `npm run test:quality`, `npm run test:delivery`, contrôle navigateur (page hors-ligne
`/__preview/gm-settings` en dev pour le sélecteur, historique des sessions), CI de la PR verte (`regression-gates`).

Livraison : branche du lot depuis `main` à jour ; plan (« État des lots »), CHANGELOG et `docs/etat_courant.md` mis à
jour ; prompt de reprise du lot B écrit avant push ; commit, push, PR, CI verte sur le HEAD exact, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via `~/CodeProjects/_shared/scripts/github-delivery-exec`),
vérification de l'arbre fusionné, nettoyage de la branche, tâche Notion
[5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) mise à jour (tâches uniquement).

Clôture : s'il reste un lot identifié (B, puis D, E), livrer son prompt de reprise autonome dans `docs/` avec cette
même obligation ; sinon le dire.
