# Prompt de reprise — Latence conversationnelle, lot 2 (banc d'essai LLM, mesure seule)

À copier dans un nouveau chat Ava. Plan : [plan_latence_conversationnelle_llm_tts.md](plan_latence_conversationnelle_llm_tts.md), section « Lot 2 ». Tâche Notion : [Réduire la latence conversationnelle AVA](https://app.notion.com/p/18662322e59582878b6381b14558d632) (Gamilab).

---

**Objectif** : mesurer, sans changer aucun réglage d'Ava, la latence au premier token, la qualité et le rappel mémoire des LLM candidats via OpenRouter, sur les vrais prompts de Max et d'Emma, puis remettre à Ulrich une recommandation chiffrée (latence, qualité, mémoire, coût). Ce lot seulement ; ne pas commencer le lot 3 (adoption), même si un candidat gagne nettement.

**État vérifié (26 novembre 2026)**

- Référence sur 7 jours (`voice_turn_events`, tours complétés) : le LLM `openai/gpt-5.6-luna` prend 2,0 s en médiane pour ≈ 2,8 k tokens en entrée et 58 en sortie, en `http_batch` (non streamé), sans préférence de fournisseur OpenRouter (`provider.sort`) et sans mesure du cache de prompt. C'est surtout du délai avant le premier token.
- Lot 1 livré en code (voir le plan, « Résultat du lot 1 ») : la voix seule passe en flux PCM Web Audio là où le MP3 MediaSource était impossible (navigateur sans MSE MP3, iPhone après refus de `<audio>`). Écart réponse → son mesuré à 0,42 s sur les postes qui avaient déjà le flux MP3. La mesure réelle du lot 1 (iPhone, poste de sandbox-romed) est **à faire par Ulrich** et ne bloque pas ce lot.
- Vérifier `git log origin/main` (le SHA de fusion du lot 1 est dans le compte rendu et la tâche Notion) avant de commencer.

**Sources à lire**

- Plan, sections « Constats » 2 à 4 et « Lot 2 ».
- Scripts existants : `scripts/eval-judge/` (`run.ts`, `session.ts`, `sequences.ts`, `vite.config.ts`) et `package.json` (`eval:*`, `.env.eval.local`).
- Compilation du prompt `optimized_v3` et mémoire : `src/services/conversationMemory.ts` (historique de 1 200 car.), le compilateur utilisé par `eval:judge`.
- Flux et parseur d'intent : `src/services/responseIntentStream.ts` (`ResponseIntentParser`).
- Proxy : `supabase/functions/proxy-llm/index.ts` (`ALLOWED_MODEL_PREFIXES`), `payload.ts` (préférence de fournisseur, `disable_reasoning`).

**Première action exécutable**

Lire `scripts/eval-judge/run.ts` et `session.ts` pour voir comment les prompts réels sont assemblés et envoyés à `proxy-llm`. Écrire ensuite `scripts/eval-judge/llmLatency.ts` et l'entrée `npm run eval:llm-latency`, en réutilisant ce chemin, sans nouvelle infrastructure.

**Périmètre**

1. Script `eval:llm-latency` : il rejoue de vrais prompts de Max et d'Emma (questions du corpus `eval:judge`, compilateur `optimized_v3`) en flux via `proxy-llm`. Il mesure le premier token, la première phrase sûre (`ResponseIntentParser`), la fin, le taux d'en-tête d'intent valide, les tokens en cache (`usage.prompt_tokens_details.cached_tokens`) et le coût. 3 répétitions par modèle, médiane et p90.
2. Candidats :
   - `gpt-5.6-luna` (référence), avec et sans `provider.sort: "latency"` ;
   - Gemini 2.5 Flash et Flash-Lite, raisonnement coupé ;
   - gpt-oss-120b et Llama 4 sur Cerebras et Groq ;
   - Claude Haiku, GPT-5 mini, Mistral Small et Medium ;
   - au besoin, d'autres modèles de la liste OpenRouter vérifiée au moment du lot.
   - Élargir `ALLOWED_MODEL_PREFIXES` seulement si un candidat l'exige. Le redéploiement de l'Edge Function se fait via Lovable.
3. Cache : taux de tokens en cache par modèle. Identifier ce qui casse la stabilité du préfixe (fragments du noyau choisis selon la question, contrat de flux en fin), sans rien modifier.
4. Hors OpenRouter (Cerebras, Groq, Gemini en direct) : mesurer et signaler le surcoût d'OpenRouter, sans intégration.
5. Qualité : `eval:judge --candidate-json` sur les 2 ou 3 meilleurs en latence. S'y ajoute un nouveau test de rappel en conversation longue : un scénario scripté de ≈ 40 tours, avec des faits donnés tôt et redemandés tard, rejoué par modèle avec la vraie mémoire structurée.
6. Livrable : `docs/eval/banc_llm_latence_<date>.md` avec une recommandation chiffrée.

**Hors périmètre** : changer `LLM_MODEL`, le routage ou un réglage admin ; activer le LLM streamé ; changer la mémoire (`conversationMemory.ts`), la TTS, la fin de parole, Tavus ou Anam.

**Invariants et limites d'autorisation**

- Aucun réglage d'Ava modifié, production non publiée, aucune migration.
- Base Caractères Notion en lecture seule (fiches, champs, contenu RAG). Gami DigiDouble exclu.
- Ordre et contenu des sections du prompt inchangés (coordination avec la tâche « Supprimer la coupure des prompts »).
- Appels payants bornés : annoncer le coût estimé de chaque run avant de le lancer (≈ 3 $ par run `eval:judge` de 126 tours). Les `eval:*` utilisent `.env.eval.local` : l'agent prépare et vérifie les scripts (essai à blanc ou petit échantillon), **Ulrich lance les runs payants**, puis l'agent lit les résultats.
- Bruit du juge ≈ 0,6 à 1,4 point : aucun gain n'est déclaré sans mesure comparable.

**Validations**

- Tests unitaires du calcul des mesures (premier token, première phrase sûre, médiane et p90, lecture du cache) sur des flux simulés.
- `npm run typecheck`, lint, `npm run test:quality` et `npm run test:delivery` verts avant le push ; CI de la PR verte, avec `regression-gates`.
- Si `PeriodCostLines.test.tsx` échoue localement sur « 1'500 », c'est la locale ICU de Node (77 rend « 1 500 ») ; la CI fait foi.
- Livraison technique : script et rapport (rapport rempli après les runs d'Ulrich). Recette humaine distincte : choix du modèle par Ulrich (lot 3).

**Livraison** : branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`, vérification sur origin/main (arbre et parent), suppression de notre branche, synchro locale et Lovable. Mettre à jour `docs/etat_courant.md`, le CHANGELOG et le plan (section lot 2 : mesures, statut).

**Clôture obligatoire** : avant le push, écrire `docs/prompt_reprise_latence_conversationnelle_lot_3.md` (adoption du LLM et du routage, section « Lot 3 » du plan, selon la décision d'Ulrich sur le rapport). Il contient l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture. Donner le lien direct dans le compte rendu. Ne pas lancer le lot 3.
