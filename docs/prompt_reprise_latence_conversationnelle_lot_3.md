# Prompt de reprise — Latence conversationnelle, lot 3 (adoption du LLM et du routage)

À copier dans un nouveau chat Ava. Plan : [plan_latence_conversationnelle_llm_tts.md](plan_latence_conversationnelle_llm_tts.md), sections « Lot 2 » (résultat) et « Lot 3 ». Rapport du banc : [banc_llm_latence_20261126.md](eval/banc_llm_latence_20261126.md). Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

---

**Objectif** : appliquer **en sandbox seulement** le choix d'Ulrich issu du banc du lot 2 : modèle du personnage, préférence de fournisseur OpenRouter, température adaptée au modèle. Rendre la latence et le cache visibles dans `llm_usage`, corriger la perte totale d'historique en `optimized_v3`, puis mesurer en usage réel. Ce lot seulement ; ne pas commencer le lot 4 (LLM streamé sur toutes les sorties).

**Précondition (à vérifier en premier)** : le rapport du banc contient les runs complets (latence, qualité `eval:judge`, rappel long) **et** une décision écrite d'Ulrich (modèle, routage, ou statu quo). Si l'un manque, ne rien coder : dire à Ulrich quel run ou quelle décision manque (une seule action), puis s'arrêter.

**État vérifié (26 novembre 2026, fin du lot 2)**

- **Résultats du lot 2 (27 novembre)** : 1re phrase sûre médiane de gpt-5.6-luna à 1,25 s par le routage par défaut, **0,82 s avec `provider.sort: "latency"`** (Amazon Bedrock, même modèle, même coût, intent 100 %). Gemini 2.5 Flash : 0,78 s, qualité + 0,04 (dans le bruit), 3 × le coût, Emma refuse les questions de rappel. gpt-oss-120b (Cerebras) : 0,60 s, qualité − 0,52, invente : écarté. Rappel long : la mémoire structurée ne garde que le prénom et le rôle de la personne. **Recommandation de l'agent : luna + `sort: latency`** ; la décision d'Ulrich reste la précondition.
- Outils d'évaluation : `eval:judge --candidate-json` et `eval:llm-recall --models` acceptent `provider`, `reasoningEffort` et `disableReasoning` (PR #290). Les noms du banc (`luna-latency`, `gemini-25-flash`…) sont acceptés par `eval:llm-recall`.

- Outils livrés : `npm run eval:llm-latency` (banc en flux via `proxy-llm`, 14 candidats, médiane et p90), `npm run eval:llm-recall` (40 tours avec la mémoire réelle, 7 faits), [scénario](eval/rappel_long_v1.json). Vérifier le SHA de fusion du lot 2 avec `git log origin/main` (il figure dans le compte rendu et la tâche Notion).
- `proxy-llm/payload.ts` accepte `provider` (`sort`, `only`, `order`, `allow_fallbacks`, filtré). Aucun appelant d'Ava ne l'envoie encore. Vérifier qu'il est redéployé : un appel `oss-cerebras` du banc doit indiquer le fournisseur Cerebras, sans « ⚠ routage non appliqué ».
- Échantillon : gpt-5.6-luna en flux, 1re phrase sûre 1,28 s, fin 1,91 s. Les prompts réels font 4,6 à 5,5 k tokens. Aucun token en cache. Le préfixe stable couvre 2,7 k tokens (Max) et 3,6 k (Emma).
- `LLM_TEMPERATURE = 1,4` est ignoré par gpt-5.6-luna (paramètre retiré avant l'envoi), mais s'appliquerait tel quel à un autre modèle. Le banc a mesuré les autres modèles à 0,8 / 0,95.
- Mémoire : en `optimized_v3`, un dernier échange de plus de 1 200 car. n'envoie aucun historique (`src/services/conversationMemory.ts`, `selectOptimizedConversation`).

**Sources à lire**

- Rapport du banc (résultats et décision d'Ulrich), plan « Lot 3 ».
- `supabase/functions/proxy-llm/payload.ts` et `index.ts` ; `src/services/openRouterLLM.ts` (`streamLLM`, `callLLMWithUsage`, options transmises) ; `src/agents/maxAgent.ts` (`simulateMaxResponse`, options de l'appel personnage).
- `src/services/settingsService.ts` (`LLM_MODEL`, `LLM_TEMPERATURE`, catalogue des modèles, réglages admin `admin_settings` qui surchargent les défauts) ; `src/services/llmModelCapabilities.ts`.
- `src/services/llmUsageTracker.ts` et le schéma `llm_usage` (migration nécessaire pour la latence et les tokens en cache).
- `src/services/conversationMemory.ts` et ses tests.

**Périmètre**

1. Réglage sandbox (sandbox-ulrich) du modèle retenu et de sa température, par le réglage admin existant. Les défauts du code ne changent que si Ulrich le demande. Si le modèle reste gpt-5.6-luna, seul le routage change.
2. Préférence de fournisseur pour l'appel du personnage : nouveau réglage (défaut vide, aucun changement) lu par `simulateMaxResponse` et transmis à `proxy-llm` (`provider`). On n'active que ce que le banc a mesuré (par exemple `sort: "latency"` ou `order: ["openai/fast"]`).
3. `llm_usage` : enregistrer la latence (premier token si flux, totale sinon) et les tokens en cache (`prompt_tokens_details.cached_tokens`). Migration additive. Rappel : Lovable n'applique pas les migrations à la synchro ; coller le SQL dans le chat Lovable.
4. Correctif mémoire : en `optimized_v3`, garder au moins le dernier échange, tronqué, plutôt qu'aucun historique. Test unitaire. L'ordre et le contenu des autres sections du prompt restent inchangés (tâche « Supprimer la coupure des prompts »).
5. Mesure : au moins 20 tours en sandbox (voix seule, puis Tavus), relecture `voice_turn_events` et `llm_usage`. Puis `eval:judge` avec le modèle choisi et `eval:llm-recall` après le correctif mémoire (coûts annoncés ; Ulrich lance les runs payants). Écoute d'Ulrich.

**Hors périmètre** : LLM streamé (lot 4), fin de parole (lot 5), TTS, Tavus, Anam, cache (déplacement du contrat de flux) sans décision écrite, production.

**Invariants et limites d'autorisation**

- Sandbox uniquement. La production n'est pas publiée. Toute migration passe par Lovable, et seulement dans ce périmètre (colonnes additives de `llm_usage`).
- Base Caractères Notion en lecture seule. Gami DigiDouble exclu.
- Interruption, passage de personnage et cinématiques inchangés (invariants de fin d'AGENTS).
- Appels payants bornés et annoncés. Les `eval:*` passent par `.env.eval.local` : l'agent vérifie (essai à blanc, petit échantillon), Ulrich lance les runs complets. Bruit du juge ≈ 0,6 à 1,4 point.

**Validations**

- Tests : payload `provider` transmis seulement quand réglé ; tracker avec latence et cache ; correctif mémoire (dernier échange tronqué) ; réglage absent = comportement actuel.
- `npm run typecheck`, lint, `npm run test:quality` et `npm run test:delivery` verts avant le push. CI de la PR verte, avec `regression-gates`. Si `PeriodCostLines.test.tsx` échoue localement sur « 1'500 », c'est la locale ICU de Node ; la CI fait foi.

**Livraison** : branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, puis fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier sur origin/main (arbre et parent), supprimer notre branche, synchroniser en local et sur Lovable (Edge Functions redéployées, migration appliquée). Mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan (section lot 3 : mesures, statut).

**Première action exécutable** : ouvrir [le rapport du banc](eval/banc_llm_latence_20261126.md) et vérifier qu'il contient les résultats complets et la décision d'Ulrich. Si c'est le cas, lire `simulateMaxResponse` et `callLLMWithUsage` pour tracer le chemin du réglage `provider` jusqu'au proxy.

**Clôture obligatoire** : avant le push, écrire `docs/prompt_reprise_latence_conversationnelle_lot_4.md` (LLM streamé sur toutes les sorties, section « Lot 4 » du plan). Il contient l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture. Donner le lien direct dans le compte rendu. Ne pas lancer le lot 4.
