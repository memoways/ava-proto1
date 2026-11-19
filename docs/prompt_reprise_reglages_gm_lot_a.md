# Prompt de reprise — Réglages GM, lot A : transparence et réglages qui agissent vraiment

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : rendre chaque réglage du GM lisible (ce qu'il envoie, à qui) et faire en sorte qu'il agisse réellement,
quelle que soit la version d'orchestration épinglée. C'est le préalable des lots C (GM off/léger/fort), B (priorités
0–3) et D (radar d'état des personnages) du plan validé par Ulrich le 19 novembre 2026.

État vérifié au 19 novembre 2026 (`main` = `f1a7ec1` + PR de ce plan) :
- Les réglages GM sont dans la table `experience_orchestration_versions` (config jsonb + prompt), épinglés par session
  (`pin_current_orchestration_version`, `get_pinned_orchestration_runtime` dans `src/services/experienceOrchestration.ts`).
- `buildExperienceDirectorPrompt` (`src/services/gameMasterPromptBuilder.ts:73-98`) tourne seulement dans l'admin, à la
  sauvegarde du brouillon (`src/components/GameMasterSettingsTab.tsx:155, :173`). Le runtime lit le prompt enregistré
  (`src/services/prd4Orchestrator.ts:568`) ; `src/agents/gameMasterPRD4.ts:526-529` remplace un prompt `builtin://` par
  `EXPERIENCE_DIRECTOR_SYSTEM_PROMPT` **sans** le bloc « RÉGLAGES ADMINISTRATEUR ACTIFS ». sandbox-romed et
  sandbox-benoit tournent sur `builtin://experience-director/v1` : posture, longueur, priorités, garde-fous, contexte,
  questions ouvertes et instructions n'y ont aucun effet. À revérifier en lecture via MCP Lovable Ava avant de coder.
- Réglages morts : `handoffTarget` (jamais lu) ; `LLM_TEMPERATURE_GM` (curseur `LLMConfigTab.tsx:354-358`, mais
  `temperature: 0.2` en dur `gameMasterPRD4.ts:550`) ; clés Gameplay `TRUST_THRESHOLD`, `MAX_INSULT_TOLERANCE`,
  `MIN_QUESTIONS_BEFORE_GATE`. Incohérences : ratio de clôture 0.7 dans le test admin (`GameMasterSettingsTab.tsx:225`)
  contre 0.8 au runtime (`src/config/experienceRuntime.ts:11`) ; replis `??` de `IndexPRD4.tsx:2123-2125` différents de
  `DEFAULT_DIRECTOR_CONFIG`.

Sources : `AGENTS.md`, `CLAUDE.md`, `docs/etat_courant.md`,
[plan validé](plan_reglages_gm_lisibles_gradues.md) (section « Lot A » et « Principe directeur »),
[plan guidage de parole #203](plan_guidage_parole_gm_ab.md), tâche Notion
[5 développements GM](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) (Gamilab `7e1a9a09…`).

Périmètre du lot A :
1. `src/services/gmSettingsRegistry.ts` : une entrée par réglage du panneau Réglages GM (libellé, destination
   `gm_prompt` / `character_prompt` / `code` / combinaison, `fragment(valeur)` rendant le texte exact). Reprendre les
   textes actuels sans les réécrire ; le compilateur du prompt et l'UI lisent ce registre.
2. Compiler le bloc de réglages **au runtime** depuis la config épinglée, y compris pour `builtin://`. Le prompt
   enregistré ne doit pas produire un double bloc : retirer l'ancien bloc figé s'il est présent. Pour une version publiée
   existante aux réglages par défaut, le texte envoyé au GM reste équivalent (test de non-régression sur
   `src/agents/fixtures/gm-published-sandbox-v7.txt`).
3. UI Réglages GM : sous chaque réglage, aperçu repliable « ➜ envoyé au GM / au personnage / appliqué par le code » avec
   le fragment courant ; bouton « Voir ce que reçoit le GM » (bloc compilé complet).
4. Nettoyage : supprimer `handoffTarget` (normalisation tolérante des anciennes configs) ; brancher
   `LLM_TEMPERATURE_GM` sur l'appel GM avec défaut 0.2 (aucun changement de comportement par défaut) ; retirer les clés
   Gameplay mortes ; aligner 0.7 → 0.8 et les replis `??` sur `DEFAULT_DIRECTOR_CONFIG`.
5. Interrupteur « Repères de temps du personnage » (`buildTemporalContextBlock`, `src/agents/maxAgent.ts:159-172`),
   défaut activé, dans la config d'orchestration, tracé par tour.

Hors périmètre : modes GM off/léger/fort (lot C), curseurs de priorités (lot B), radar d'état (lot D), courbe
d'expérience (chantier E). Ne pas toucher à `editor.speechGuidance` sauf pour l'inscrire au registre.

Limites : base Caractères Notion en lecture seule, fiches intactes ; aucun Supabase direct (MCP Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc` seulement, lecture pour vérifier) ; aucune publication production ; aucun appel
IA ajouté sur le chemin du tour. Si une migration s'avérait nécessaire, la livrer en fichier et la faire appliquer via
le chat Lovable.

Première action : vérifier en lecture (MCP Lovable) quelles versions épinglées utilisent `builtin://` par environnement,
puis écrire les tests du registre et de la compilation runtime avant le code.

Validations : tests unitaires (registre, normalisation, compilation runtime `builtin://` et version publiée, absence de
double bloc, température), `npm run test:quality`, `npm run test:delivery`, vérification navigateur des aperçus dans
Réglages GM, puis CI PR complète (`regression-gates` verte).

Livraison : branche du lot depuis `main` à jour, plan, CHANGELOG et `docs/etat_courant.md` mis à jour, prompt de reprise
du lot C écrit avant push, commit, push, PR, CI verte sur le HEAD exact, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via `~/CodeProjects/_shared/scripts/github-delivery-exec`),
vérification de l'arbre fusionné, nettoyage de la branche, tâche Notion GM mise à jour (tâches uniquement).

Clôture : s'il reste un lot identifié (C, puis B, D, E), livrer son prompt de reprise autonome dans `docs/` avec cette
même obligation ; sinon le dire.
