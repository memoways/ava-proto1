# Banc LLM latence — 26 novembre 2026 (lot 2, mesure seule)

Plan : [plan_latence_conversationnelle_llm_tts.md](../plan_latence_conversationnelle_llm_tts.md), section « Lot 2 ».
Statut : **outils livrés et vérifiés sur un petit échantillon réel ; runs complets à lancer par Ulrich, puis ce rapport est complété.** Aucun réglage d'Ava modifié, rien en production.

## Ce qui est livré

| Outil | Rôle | Coût |
|---|---|---|
| `npm run eval:llm-latency -- --compile-only` | Assemble les vrais prompts de Max et Emma (questions du corpus `eval:judge`, chaîne réelle `processPRD4Turn`, `optimized_v3`, vrai RAG). L'appel au personnage est intercepté avant l'envoi : ni LLM, ni GM, rien d'enregistré en base. Analyse la stabilité du préfixe. | RAG seul |
| `npm run eval:llm-latency -- --prompts @…` | Rejoue chaque prompt **en flux** via `proxy-llm` pour chaque candidat : premier token, première phrase sûre (vrai `ResponseIntentParser`), fin, en-tête d'intent valide, tokens en cache, tokens de raisonnement, coût facturé (`usage.cost` d'OpenRouter). 3 répétitions, médiane et p90. `--list` montre les candidats. | ≈ 0,5 $ pour 14 candidats × 10 prompts × 3 |
| `npm run eval:llm-recall -- --models a,b` | Rappel en conversation longue : [scénario de 40 tours](rappel_long_v1.json) par personnage, faits donnés aux tours 1 à 9 et redemandés aux tours 30 à 40. Chaîne réelle avec la mémoire structurée (deltas du GM), comme `eval:judge:sequences`. Notation lexicale, sans juge. | ≈ 0,15 $ par modèle et par personnage |
| `proxy-llm` : champ `provider` optionnel | Préférence de fournisseur OpenRouter (`sort`, `only`, `order`, `allow_fallbacks`), filtrée. Seul le banc l'envoie : le payload des appels d'Ava est inchangé (testé). **Actif seulement après redéploiement de `proxy-llm` par Lovable** ; avant, le rapport marque « ⚠ routage non appliqué ». | – |

Code : `src/services/llmLatencyBench.ts`, `src/services/llmRecallScenario.ts`, `scripts/eval-judge/llmLatency.ts`, `scripts/eval-judge/llmRecall.ts`, `supabase/functions/proxy-llm/payload.ts`. Les fichiers bruts vont dans `output/eval-judge/` (ignoré par git).

## Mesuré par l'agent (petit échantillon, sandbox-ulrich)

### Référence en flux (4 prompts réels, 1 passage, 0,005 $)

| Candidat | n | 1er token méd. / p90 | 1re phrase sûre méd. / p90 | fin méd. / p90 | intent valide | cache | tokens in / out | coût moyen |
|---|---|---|---|---|---|---|---|---|
| gpt-5.6-luna (OpenAI) | 4 | 0,77 / 0,94 s | 1,28 / 1,40 s | 1,91 / 2,00 s | 100 % | 0 % | 4 978 / 105 | 0,0014 $ |

Lecture prudente (n = 4, dans le bruit) : à modèle constant, **le flux donne une première phrase prête ≈ 0,7 s avant la réponse entière** (1,28 s contre ≈ 1,9-2,0 s). C'est le levier du lot 4 (LLM streamé), indépendant du choix du modèle.

### Taille réelle du prompt

Les prompts compilés font **18,6 à 21,7 k caractères, soit 4,6 à 5,5 k tokens** au tour 1. C'est presque deux fois la référence de 2,8 k du plan (7 jours de `voice_turn_events`, en partie avant la place réservée aux souvenirs du 24 novembre, limite 13 900 → 22 500 car.). Le délai avant le premier token dépend de cette taille ; la comparaison entre modèles reste juste, car tous reçoivent le même prompt.

### Stabilité du préfixe (cache de prompt)

Comparaison des prompts système entre deux questions du même personnage :

| Personnage | préfixe commun | longueur | ce qui casse le préfixe |
|---|---|---|---|
| Max | 9 787 car. (≈ 2,7 k tokens, 49 %) | 20 139 car. | **Noyau choisi selon la question** : la section « VOIX ET POSTURE » est présente pour une question, absente pour l'autre, juste après « FAITS ÉTABLIS ». |
| Emma | 13 124 car. (≈ 3,6 k tokens, 67 %) | 19 508 car. | **Directive relationnelle du tour** : les « sujets sensibles reconnus » dépendent de la question. |

- Avant la divergence : identité, gravité, passage téléphonique, hiérarchie, contrat de conversation, noyau (moteur, repères, faits établis). Plus de 1 024 tokens stables : un cache implicite (OpenAI, Gemini) est possible sur cette partie.
- Après : cadre de l'appel, directive relationnelle, état, canon pertinent, souvenirs (RAG), puis le **contrat de flux en fin** (« FORMAT DE SORTIE IMPÉRATIF », 2 175 car. communs). Placé après le contenu variable, il ne peut jamais être en cache. Le déplacer avant le noyau allongerait le préfixe stable d'≈ 600 tokens, mais cela change l'ordre des sections : **non fait**, à décider avec la tâche « Supprimer la coupure des prompts ».
- Mesure sur 4 appels : 0 token en cache, y compris pour la seconde question de Max (préfixe commun ≈ 2,7 k). OpenRouter répartit gpt-5.6-luna entre plusieurs fournisseurs (OpenAI, Azure, Bedrock), et le cache est propre à chacun. À confirmer par le run complet (les répétitions 2 et 3 rejouent le même prompt : borne haute).

### Constats sur les candidats (catalogue OpenRouter vérifié le 26 novembre)

- **Llama 4 n'est plus servi par Cerebras ni Groq** sur OpenRouter (Scout : DeepInfra seul ; Maverick : Parasail seul). Les deux sont gardés au banc, sans fournisseur rapide. gpt-oss-120b reste servi par Cerebras et Groq.
- gpt-5.6-luna a un point d'accès `openai/fast` : candidat de routage à ajouter si `provider.sort: "latency"` ne le choisit pas de lui-même.
- **Température** : le réglage live est `LLM_TEMPERATURE = 1,4`. gpt-5.6-luna l'ignore (paramètre refusé, retiré avant l'envoi). Mais il s'appliquerait tel quel à tout autre modèle. Le banc et le test de rappel envoient donc 0,8 / 0,95 (valeurs par défaut de `proxy-llm`). **Le lot 3 doit fixer la température avec le modèle.**
- Raisonnement : `proxy-llm` coupe la réflexion de gpt-5.6 (`effort: none`), de GPT-5 mini et 5.4 mini (`minimal`) et des Gemini 2.5 Flash et Flash-Lite (`disable_reasoning`). Il ne la coupe pas pour gpt-oss-120b ni pour les Gemini 3.x : ils réfléchissent par défaut, et la colonne « raison. » du banc le montre. Le chemin personnage n'envoie jamais `disable_reasoning` aujourd'hui (constat du plan).
- Hors OpenRouter (Cerebras, Groq, Google en direct) : candidats `direct-*`, mesurés seulement si `CEREBRAS_API_KEY`, `GROQ_API_KEY` ou `GEMINI_API_KEY` sont dans `.env.eval.local`. Sinon, ils sont signalés « non mesurés ». Aucune intégration.

## Runs à lancer par Ulrich (ordre conseillé)

1. Après le redéploiement de `proxy-llm` par Lovable, compiler 10 prompts (5 Max, 5 Emma), puis lancer le banc sur tous les candidats du proxy (≈ 0,5 $, ≈ 15-20 min). Le fichier de prompts est rappelé à la fin de la première commande :
   ```bash
   npm run eval:llm-latency -- --compile-only
   ```
   ```bash
   npm run eval:llm-latency -- --prompts @output/eval-judge/llm-latency-prompts-DATE.json
   ```
2. Facultatif, surcoût d'OpenRouter : clés Cerebras, Groq et Google dans `.env.eval.local`, puis `--candidates oss-cerebras,direct-cerebras-oss,oss-groq,direct-groq-oss,gemini-25-flash,direct-gemini-25-flash`.
3. Qualité des 2 ou 3 meilleurs en première phrase (≈ 3 $ par run de 126 tours) :
   ```bash
   npm run eval:judge -- --candidate optimized_v3 --candidate-json '{"model":"MODELE","temperature":0.8,"topP":0.95}' --dry-run
   ```
4. Rappel en conversation longue, référence et finalistes (≈ 0,9 $ pour 3 modèles × 2 personnages) :
   ```bash
   npm run eval:llm-recall -- --models openai/gpt-5.6-luna,MODELE_1,MODELE_2
   ```

## Résultats complets (à remplir après les runs)

### Latence (banc complet)

_Tableau de `npm run eval:llm-latency` (sortie Markdown, aussi dans `output/eval-judge/llm-latency-*.md`)._

### Surcoût OpenRouter

_Écart médian du premier token entre `oss-cerebras` et `direct-cerebras-oss`, `oss-groq` et `direct-groq-oss`, `gemini-25-flash` et `direct-gemini-25-flash`. Attendu : 30 à 100 ms._

### Qualité (`eval:judge`)

_Moyenne pondérée référence contre candidat, par personnage. Bruit du juge ≈ 0,6 à 1,4 point : aucun gain déclaré en dessous._

### Rappel en conversation longue

_Tableau de `npm run eval:llm-recall` : faits rappelés sur 7 par conversation, contradictions, dernier tour fusionné en mémoire._

## Recommandation (à rédiger après les runs)

Grille de décision proposée pour le lot 3 :

1. Première phrase sûre médiane au moins 0,3 s sous la référence en flux, et p90 non dégradé.
2. Intent valide ≥ 98 % (sinon relances, coûteuses en lot comme en flux).
3. Qualité au juge dans le bruit de la référence, ou meilleure.
4. Rappel ≥ celui de la référence, sans contradiction nouvelle.
5. Coût par tour du même ordre (≤ 2 × la référence), à préciser par Ulrich.

Sans candidat qui remplit 1 à 4, garder gpt-5.6-luna et ne retenir que le routage s'il gagne (`provider.sort` ou `openai/fast`), puis passer au lot 4 (flux), dont le gain est déjà visible ci-dessus.
