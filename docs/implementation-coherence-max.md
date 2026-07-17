# Implémentation — Cohérence du personnage Max (Phases 1 & 2)

> Suite directe de `docs/analyse-coherence-max.md` (diagnostic). Ce document décrit **ce qui a été implémenté, pourquoi et comment**, ce qui reste à faire, et comment vérifier chaque correctif.
> Périmètre : parcours live PRD4. Session du 2026-07-17.

---

## Vue d'ensemble

| # | Correctif | Cause traitée (analyse) | Fichiers clés | Coût runtime |
|---|-----------|------------------------|---------------|--------------|
| S1 | Cache client des résumés de session | Cause 1 (mémoire cassée par RLS) + re-résumé chaque tour | `sessionMemoryService.ts` | Néant (économise 1 appel LLM/tour) |
| S2 | Présent temporel dans le prompt de Max | Cause 3 (aucun repère temporel) | `maxAgent.ts`, `prd4Orchestrator.ts` | Néant (données déjà calculées) |
| S3 | Boucle GM→Max (`next_turn_guidance`) | Cause 4 (GM passif) + Cause 7 (pas de drive) | `maxAgent.ts`, `prd4Orchestrator.ts`, `IndexPRD4.tsx` | Néant (donnée déjà produite, auparavant jetée) |
| S4 | Unification des règles de style | Cause 5 (couches contradictoires) | `settingsService.ts`, `maxAgent.ts` | Néant |
| S5 | Docs canon + règles projet | Cause 5 (identité père/frère) | `CLAUDE.md`, `STORY.md` | — |

Aucune migration SQL, aucune modification d'Edge Function, aucune relaxation de sécurité. Tous les correctifs sont couverts par des tests unitaires (16 nouveaux tests ; suite complète : 119 verts).

---

## S1 — Réparer la mémoire de session

**Pourquoi.** La migration `20260712150404` réserve le SELECT sur `session_summaries` aux admins ; le joueur anonyme recevait 0 ligne sans erreur. Le bloc `## SOUVENIRS DE LA SESSION` n'était donc jamais injecté (amnésie au-delà des 10 derniers messages) et `last_turn` perçu valait 0, déclenchant une re-summarisation LLM à chaque tour dès le tour 4.

**Comment.** L'Edge Function `summarize-session` renvoie déjà `{summary, last_turn}` au client. On met ce résultat en **cache mémoire** (`Map` par `session_id`) dans `sessionMemoryService.ts` ; `fetchSessionSummary` lit ce cache **avant** la BDD (le fallback BDD reste pour le contexte admin/banc d'essai, et met lui aussi en cache). Les sessions ne survivant pas à un rechargement de page (l'historique `conversationRef` est en mémoire), le cache couvre tout le besoin runtime.

**Pourquoi pas une policy RLS ?** Le durcissement de juillet avait une raison de sécurité (ne pas exposer les résumés de toutes les sessions). Une policy par `session_id` n'est pas possible proprement sans lier les sessions à `auth.uid()`, et rouvrir `USING (true)` annulerait le durcissement. Le cache client est plus simple, sans surface d'attaque nouvelle. Si un jour la **reprise de session après reload** est implémentée, il faudra alors une lecture serveur (Edge Function service-role, comme l'écriture).

**Vérification.** `src/services/sessionMemoryService.test.ts` (6 tests : cache après summarisation, fallback BDD, échec non caché, isolation par session) + test orchestrateur « skips summarization when the cached summary is recent enough ». En prod : la console doit montrer `summarize-session` tous les 4 tours (et non à chaque tour), et le system prompt de Max (debug logger) doit contenir `SOUVENIRS DE LA SESSION` à partir du tour 5.

## S2 — Présent temporel de Max

**Pourquoi.** Max n'avait aucune notion du temps écoulé, du tour, ni de la progression de l'appel (seul le GM recevait ces repères) — d'où les confusions de temporalité et une conversation sans arc.

**Comment.** Nouveau bloc `## OÙ EN EST L'APPEL` dans le system prompt (`buildTemporalContextBlock`, fonction pure exportée dans `maxAgent.ts`) : durée écoulée en minutes, numéro de tour, phase (début < 25 %, milieu, fin > 75 % de la durée configurée), avec consigne d'usage **implicite** (« ne jamais citer ces chiffres »). Câblé depuis `prd4Orchestrator.ts` (champ `temporalContext` de `MaxAgentInput`) — les données existaient déjà, zéro appel LLM ajouté. Le champ est optionnel : les autres consommateurs (`conversationOrchestrator` legacy, `maxTestPipeline`) sont inchangés.

**Vérification.** `src/agents/maxAgent.blocks.test.ts` (4 tests de phases et bornes) + test orchestrateur « transmet le contexte temporel et la guidance GM à Max ».

**Reste éditorial (hors code).** Le « présent canonique » de la fiction (depuis quand Ava a disparu, ce que Max faisait avant l'appel) doit être défini dans la fiche Notion (champ `timeline`) — le bloc temporel ne couvre que le temps *de l'appel*.

## S3 — Boucle GM→Max (Game Master actif léger)

**Pourquoi.** Le GM post-tour produisait à chaque tour un `next_turn_guidance` (« ce que Max devrait faire au tour suivant »)… qui était jeté sans être réinjecté. Le GM observait sans jamais piloter.

**Comment.** Dans `IndexPRD4.tsx` : le handler du `postTurnPromise` du tour N mémorise `ev.next_turn_guidance` dans `pendingGmGuidanceRef` et cumule `ev.topics_covered` (dédupliqués, plafonnés à 24) dans `gmTopicsCoveredRef`. Au tour N+1, la guidance est **consommée one-shot** (une guidance périmée ne survit pas à son tour : si le post-tour échoue ou si l'utilisateur enchaîne trop vite, le tour se joue sans guidance — comportement dégradé sûr). Transmission via `PRD4TurnInput.gmGuidance`/`gmTopicsCovered` → `MaxAgentInput.gmGuidance` → bloc `## CONSEIL DE MISE EN SCÈNE` (`buildGmGuidanceBlock`), qui rappelle explicitement que **la fiche personnage reste prioritaire**. Les refs sont remis à zéro au démarrage de chaque session.

**Coût.** Zéro appel LLM et zéro latence ajoutés : la donnée était déjà produite en fire-and-forget.

**Vérification.** `maxAgent.blocks.test.ts` (3 tests du bloc guidance : note interne, plafond de 12 sujets affichés, sujets vides ignorés) + 2 tests orchestrateur (transmission, guidance vide ignorée).

**Levier de réglage.** La qualité de la boucle dépend du **prompt du GM post-tour** (`gameMasterPRD4.ts`) : c'est lui qui rédige la guidance. Si Max paraît « téléguidé », affiner d'abord la consigne de rédaction du `next_turn_guidance` côté GM (bref, orienté attitude, pas de contenu imposé).

## S4 — Unification des règles de style

**Pourquoi.** Trois couches valorisaient les « questions de contrôle » alors que la règle live interdit les questions systématiques — régression déjà constatée une fois (« Max trop assistant », CHANGELOG). Deux consignes de longueur coexistaient (1-2 phrases/45 mots vs 2-3 phrases).

**Comment.**
- Exemple du planner GM (`settingsService.ts`) : « poser une question de contrôle » → « ne poser une question que si elle sert l'objectif du tour (jamais par réflexe) ».
- `responseStyle` (MaxPromptControl) : suppression de « les questions qui testent l'autre », interdiction explicite de terminer chaque réponse par une question, longueur alignée sur 1-2 phrases / 45 mots.
- `FALLBACK_SYSTEM_PROMPT` (`maxAgent.ts`) : 2-3 phrases → 1-2 phrases / 45 mots.
- Le *drive* légitime (« tester la sincérité de l'interlocuteur ») est conservé.

**⚠️ Action admin requise.** Ces textes sont des **défauts** : si une valeur a déjà été sauvegardée dans `admin_settings`/localStorage (clés `ava_max_prompt_control_settings`, `ava_gm_prompt_settings`), l'ancienne version continue de primer. Faire un **reset** de ces clés depuis l'admin pour activer les nouveaux textes.

**⚠️ Action éditoriale requise (le vrai levier).** En live, le comportement « questions » vient surtout de la **fiche Notion** — auditer `dynamique_conversation` et retirer toute incitation à questionner (cf. annexe B de l'analyse).

## S5 — Canon documentaire

- `CLAUDE.md` : Max décrit comme **père d'Ava** (~55 ans, Lausanne, avec Emma) ; ajout de trois règles projet (piège RLS/anon silencieux, canon dans Notion, défauts surchargés par admin_settings).
- `STORY.md` : note de péremption sous le bloc « Initial Vision » (le pitch « frère développeur 28 ans » est une archive, pas le canon).

---

## Ce qui reste à faire (Phase 3 de l'analyse — non implémenté ici)

1. **Vérifier la fiche Notion** (annexe B de l'analyse) : identité sans ambiguïté, présent canonique dans `timeline`, retrait des incitations aux questions. **C'est le levier principal restant** — aucune correction code ne compense une fiche ambiguë. → **Fait le 2026-07-17** sur la base de l'export complet de la fiche : voir `docs/proposition-fiche-max.md` (diagnostic + textes prêts à coller, champ par champ).
2. **Drive éditorial** (S4 de l'analyse) : objectifs propres de Max, peurs, lignes rouges, arc émotionnel — dans la fiche Notion.
3. **Structure en actes / beats** (S5 de l'analyse) : chantier design à part entière.
4. **Test A/B d'un modèle plus capable** (S6) : mesurer latence avant de lever `SLOW_LIVE_MODEL_FALLBACKS`.
5. **Reprise de session après reload** : nécessiterait une lecture serveur des résumés (Edge Function service-role) et la relecture de `sessions.conversation_log`.

## Comment valider en conditions réelles

1. Lancer une session live de **plus de 8 échanges** en donnant des détails personnels aux tours 1-3 (prénom, lien avec Ava).
2. Aux tours 7+, vérifier que Max se souvient de ces détails (avant : amnésie systématique).
3. Vérifier que Max fait référence au temps qui passe de façon naturelle et resserre l'échange en fin de session.
4. Compter les réponses terminées par une question : attendu « rarement », pas « à chaque tour » (dépend aussi de la fiche Notion, cf. S4).
5. Dans l'admin (onglet Sessions), comparer `gm_post_turn_log` : `confusion_detected` doit chuter par rapport aux sessions antérieures au correctif ; la `next_turn_guidance` du tour N doit se refléter dans l'attitude de Max au tour N+1.
