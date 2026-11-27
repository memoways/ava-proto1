# Banc LLM latence — 26 novembre 2026 (lot 2, mesure seule)

Plan : [plan_latence_conversationnelle_llm_tts.md](../plan_latence_conversationnelle_llm_tts.md), section « Lot 2 ».
Statut : **lot 2 terminé (26-27 novembre) : banc, qualité et rappel mesurés. Recommandation : garder gpt-5.6-luna avec le routage `provider.sort: "latency"` (− 0,43 s sur la première phrase, qualité identique). **Décision d'Ulrich (27 novembre) : oui au routage, à appliquer au lot 3.** Aucun réglage d'Ava modifié, rien en production.

## Ce qui est livré

| Outil | Rôle | Coût |
|---|---|---|
| `npm run eval:llm-latency -- --compile-only` | Assemble les vrais prompts de Max et Emma (questions du corpus `eval:judge`, chaîne réelle `processPRD4Turn`, `optimized_v3`, vrai RAG). L'appel au personnage est intercepté avant l'envoi : ni LLM, ni GM, rien d'enregistré en base. Analyse la stabilité du préfixe. | RAG seul |
| `npm run eval:llm-latency -- --prompts @…` | Rejoue chaque prompt **en flux** via `proxy-llm` pour chaque candidat : premier token, première phrase sûre (vrai `ResponseIntentParser`), fin, en-tête d'intent valide, tokens en cache, tokens de raisonnement, coût facturé (`usage.cost` d'OpenRouter). 3 répétitions, médiane et p90. `--list` montre les candidats. | ≈ 0,5 $ pour 14 candidats × 10 prompts × 3 |
| `npm run eval:llm-recall -- --models a,b` | Rappel en conversation longue : [scénario de 40 tours](rappel_long_v1.json) par personnage, faits donnés aux tours 1 à 9 et redemandés aux tours 30 à 40. Chaîne réelle avec la mémoire structurée (deltas du GM), comme `eval:judge:sequences`. Notation lexicale, sans juge. | ≈ 0,15 $ par modèle et par personnage |
| `proxy-llm` : champs `provider` et `reasoning_effort` optionnels | Préférence de fournisseur OpenRouter (`sort`, `only`, `order`, `allow_fallbacks`) et effort de raisonnement (`none` à `high`), filtrés. Seul le banc les envoie : le payload des appels d'Ava est inchangé (testé). **Actif seulement après redéploiement de `proxy-llm` par Lovable** ; avant, le rapport marque « ⚠ routage non appliqué ». | – |

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
- **gpt-oss-120b via le proxy, sans réglage : 4 réponses vides sur 4** (appel de contrôle après fusion). Il réfléchit par défaut, consomme les 360 tokens de sortie (349 à 371 tokens de raisonnement) et s'arrête en `length` avant de parler. Le banc lui envoie maintenant `reasoning_effort: "low"` (champ facultatif de `proxy-llm`, banc seulement). Le même appel a été servi par **Google**, pas par Cerebras : le `provider` n'était pas encore actif. L'alerte « ⚠ routage non appliqué » tient désormais compte des appels en erreur.
- **Claude Haiku 5.5, même cas : 19 réponses vides sur 20** dans le premier run complet. Il réfléchit par défaut et consomme les 360 tokens. Le banc lui envoie `reasoning_effort: "none"` : la 1re phrase arrive alors à ≈ 1,1 s, intent valide. Haiku compte aussi ≈ 9,7 k tokens d'entrée pour le même prompt (tokeniseur différent, soit ≈ 1,8 × luna).
- **Premier run complet interrompu** au bout de ≈ 250 appels : un appel GPT-5 mini est resté bloqué, puis une erreur réseau a arrêté le script, et les résultats gardés en mémoire ont été perdus. Le banc enregistre désormais chaque appel dans un journal (`.jsonl`) et reprend avec `--resume` sans refaire ni repayer. Une erreur réseau compte comme un appel en échec, et chaque appel est borné à 45 s.
- Raisonnement : `proxy-llm` coupe la réflexion de gpt-5.6 (`effort: none`), de GPT-5 mini et 5.4 mini (`minimal`) et des Gemini 2.5 Flash et Flash-Lite (`disable_reasoning`). Il ne la coupe pas pour gpt-oss-120b ni pour les Gemini 3.x : ils réfléchissent par défaut, et la colonne « raison. » du banc le montre. Le chemin personnage n'envoie jamais `disable_reasoning` aujourd'hui (constat du plan).
- Hors OpenRouter (Cerebras, Groq, Google en direct) : candidats `direct-*`, mesurés seulement si `CEREBRAS_API_KEY`, `GROQ_API_KEY` ou `GEMINI_API_KEY` sont dans `.env.eval.local`. Sinon, ils sont signalés « non mesurés ». Aucune intégration.

## Runs à lancer par Ulrich (ordre conseillé)

1. **Fait le 26 novembre** (résultats ci-dessous). Pour un nouveau run : compiler 10 prompts (5 Max, 5 Emma), puis lancer le banc sur tous les candidats du proxy (≈ 0,5 $, ≈ 15-20 min). Le fichier de prompts est rappelé à la fin de la première commande :
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

## Résultats complets

### Latence (banc complet)

Run d'Ulrich du 26 novembre 2026 (sandbox-ulrich, après le redéploiement de `proxy-llm`) : 10 prompts réels (5 Max, 5 Emma, 17,1 à 21,7 k car.) × 3 répétitions × 14 candidats, + 1 appel de chauffe par candidat, hors mesures. **434 appels, 0 erreur, 0,705 $.** Temps depuis l'envoi de la requête, sans le RAG. Classement par première phrase sûre (médiane).

| Candidat | n | erreurs | 1er token méd. / p90 | 1re phrase sûre méd. / p90 | fin méd. / p90 | intent valide | cache (rép. 1 / suivantes) | tokens in / out / raison. | coût moyen | fournisseur |
|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b · Cerebras | 30 | 0 | 0.57 s / 0.75 s | 0.60 s / 0.77 s | 0.62 s / 0.80 s | 100 % | 68 % / 99 % | 4929 / 185 / 90 | 0.00186 $ | Cerebras |
| Gemini 2.5 Flash-Lite · sans raisonnement | 30 | 0 | 0.44 s / 0.56 s | 0.65 s / 0.79 s | 0.78 s / 0.94 s | 13 % | 20 % / 85 % | 5121 / 101 / 0 | 0.00026 $ | Google AI Studio |
| gpt-oss-120b · Groq | 30 | 0 | 0.58 s / 0.88 s | 0.70 s / 0.91 s | 0.72 s / 0.96 s | 97 % | 33 % / 54 % | 4997 / 175 / 85 | 0.00068 $ | Groq |
| Gemini 2.5 Flash · sans raisonnement | 30 | 0 | 0.48 s / 0.58 s | 0.78 s / 0.91 s | 1.04 s / 1.26 s | 100 % | 14 % / 4 % | 5121 / 117 / 0 | 0.00173 $ | Google AI Studio |
| gpt-5.6-luna · provider.sort latency | 30 | 0 | 0.65 s / 0.72 s | 0.82 s / 1.01 s | 1.07 s / 1.33 s | 100 % | 11 % / 100 % | 4865 / 110 / 0 | 0.00056 $ | Amazon Bedrock |
| Mistral Small 2603 | 30 | 0 | 0.51 s / 0.69 s | 0.91 s / 1.11 s | 1.36 s / 1.59 s | 90 % | 26 % / 44 % | 4969 / 105 / 0 | 0.00059 $ | Mistral |
| Gemini 3.5 Flash-Lite (raisonnement par défaut) | 30 | 0 | 0.71 s / 0.85 s | 0.96 s / 1.22 s | 1.22 s / 1.41 s | 100 % | 8 % / 64 % | 5119 / 107 / 0 | 0.00118 $ | Google |
| Mistral Medium 3.5 | 30 | 0 | 0.59 s / 1.01 s | 1.02 s / 1.56 s | 1.22 s / 1.90 s | 100 % | 96 % / 96 % | 4969 / 73 / 0 | 0.00827 $ | Mistral |
| Llama 4 Scout (DeepInfra) | 30 | 0 | 0.67 s / 0.94 s | 1.09 s / 1.50 s | 1.89 s / 2.76 s | 83 % | 0 % / 0 % | 4929 / 105 / 0 | 0.00061 $ | DeepInfra |
| Claude Haiku 5.5 | 30 | 0 | 0.75 s / 0.89 s | 1.19 s / 1.37 s | 1.75 s / 1.90 s | 100 % | 0 % / 0 % | 8563 / 190 / 0 | 0.00095 $ | Claude Platform on AWS |
| gpt-5.6-luna (référence) | 30 | 0 | 0.76 s / 1.09 s | 1.25 s / 1.60 s | 1.85 s / 2.06 s | 100 % | 11 % / 100 % | 4865 / 112 / 0 | 0.00056 $ | OpenAI |
| GPT-5 mini (raisonnement minimal) | 30 | 0 | 0.79 s / 0.91 s | 1.26 s / 1.53 s | 1.75 s / 2.20 s | 100 % | 98 % / 98 % | 4865 / 119 / 0 | 0.00038 $ | OpenAI |
| Llama 4 Maverick (Parasail) | 30 | 0 | 0.86 s / 1.09 s | 1.30 s / 1.76 s | 1.97 s / 2.82 s | 100 % | 35 % / 34 % | 4929 / 106 / 0 | 0.00153 $ | Parasail |
| GPT-5.4 mini (raisonnement minimal) | 30 | 0 | 1.26 s / 1.54 s | 1.59 s / 1.87 s | 2.06 s / 2.44 s | 100 % | 32 % / 32 % | 4865 / 174 / 71 | 0.00340 $ | OpenAI |

Lecture :

- **Gain sans changer de modèle** : gpt-5.6-luna avec `provider.sort: "latency"` (servi par Amazon Bedrock) donne la 1re phrase à **0,82 s, contre 1,25 s** par le routage par défaut (OpenAI), soit **− 0,43 s en médiane et − 0,59 s en p90**, sans changer le modèle, le coût ni le format (intent 100 %). C'est le levier le moins risqué.
- **Plus rapides, à valider en qualité et en mémoire** : gpt-oss-120b sur Cerebras (**0,60 s**, intent 100 %, 0,0019 $ par appel) et Gemini 2.5 Flash sans raisonnement (**0,78 s**, intent 100 %, 0,0017 $). gpt-oss sur Groq : 0,70 s, mais intent 97 % et moins de cache.
- **Écartés** : Gemini 2.5 Flash-Lite (intent valide 13 % : il ne respecte presque jamais l'en-tête privé), Mistral Small (90 %), Llama 4 Scout (83 %). Mistral Medium est 15 × plus cher que luna. GPT-5.4 mini et Llama 4 Maverick sont plus lents que la référence.
- **Cache** : il marche sur un prompt identique (répétitions 2 et 3 : 99-100 % pour luna, Cerebras, GPT-5 mini). Entre deux questions différentes, la part en cache reste faible (11 % pour luna), car le préfixe stable ne couvre que ≈ la moitié du prompt (tableau ci-dessous). Le gain de latence du cache n'est pas visible à cette taille.
- Claude Haiku 5.5 compte ≈ 8,6 k tokens d'entrée pour le même prompt (tokeniseur différent).

Stabilité du préfixe sur les 10 prompts :

| Personnage | prompts | préfixe commun min / méd. | longueur méd. | fin commune | première différence |
|---|---|---|---|---|---|
| max | 5 | 9787 / 12305 car. | 19116 car. | 2174 car. | ## VOIX ET POSTURE (4) ; ## MOTEUR DE L'APPEL (3) ; # CADRE DE L'APPEL — PRIORITAIRE (2) |
| emma | 5 | 10420 / 10420 car. | 20045 car. | 2174 car. | ## IDENTITÉ ET CONTRADICTION (6) ; # DIRECTIVE RELATIONNELLE DU TOUR — PRIORITAIRE (2) ; ## MANIÈRE DE PARLER (2) |

### Surcoût OpenRouter

Non mesuré : aucune clé Cerebras, Groq ou Google en direct dans `.env.eval.local`. Ce n'est pas bloquant, car la recommandation reste sur OpenRouter.

### Qualité (`eval:judge`, 21 questions × 3 passages, juge Claude Sonnet 5.5, 26-27 novembre)

| Candidat contre gpt-5.6-luna | Référence | Candidat | Δ /10 | Bruit | Questions en hausse / baisse | Verdict |
|---|---:|---:|---:|---:|---|---|
| gpt-oss-120b · Cerebras (`reasoningEffort: low`) | 4,55 | 4,04 | **− 0,52** | ± 0,59 | 4 / 10 | baisse sur 10 critères sur 11 (éléments exigés − 0,90, parole incarnée − 0,74, ton − 0,55) ; **écarté** |
| Gemini 2.5 Flash (`disableReasoning`) | 4,57 | 4,61 | **+ 0,04** | ± 0,66 | 7 / 7 | **équivalent** (dans le bruit) |

Run gpt-oss : `afcaa174-…`, arrêté au plafond de 4 $ après 120 tours sur 126, 4,10 $ mesurés. Run Gemini : `d3f90e76-…`, 126 tours, ≈ 3,04 $. La session s'est coupée avant l'écriture du rapport, finalisé par `--resume` sans rejouer de tour. La référence joue à T = 1,4, que luna ignore ; les candidats jouent à 0,8 / 0,95.

### Rappel en conversation longue (`eval:llm-recall`, 40 tours, 1 conversation par personnage)

| Modèle | Max | Emma | Total | Observations |
|---|---|---|---|---|
| gpt-5.6-luna | 2/7 | 2/7 | 4/14 | dit « je ne sais pas » plutôt qu'inventer ; « Lausanne » pour Sion (Max) |
| gpt-oss-120b · Cerebras | 3/7 | 5/7 | 8/14 | **invente** : « Léo » comme fils de Claire, « quinze ans » (Max) |
| Gemini 2.5 Flash | 4/7 | 0/7 | 4/14 | Emma refuse toutes les questions (« j'ai la tête ailleurs ») alors que la mémoire contient le prénom |

Lecture :

- **Le premier facteur est la mémoire d'Ava, pas le modèle.** En fin de conversation, la mémoire structurée ne garde que « Claire, infirmière bénévole » pour les trois modèles. La ville, le fils, le frère et le rendez-vous ne survivent pas aux 1 200 car. d'historique mot pour mot. Le correctif mémoire du lot 3 compte autant que le choix du modèle.
- La notation lexicale est approximative : « je me souviens de Léo, mon fils à moi » a été compté comme une contradiction pour luna. Avec une seule conversation par personnage, et un run qui a croisé le juge (limite de 60 appels par minute : quelques mises à jour de mémoire du GM perdues, 3 tours en erreur pour gpt-oss avec Max), les écarts restent indicatifs.

## Recommandation

**Garder gpt-5.6-luna et activer le routage OpenRouter `provider.sort: "latency"` pour l'appel du personnage.**

| Option | 1re phrase méd. / p90 | Qualité | Rappel | Coût par appel | Risque |
|---|---|---|---|---|---|
| luna, routage par défaut (aujourd'hui) | 1,25 / 1,60 s | référence | 4/14 | 0,00056 $ | – |
| **luna + `sort: latency` (Bedrock)** | **0,82 / 1,01 s** | **identique (même modèle)** | identique | 0,00056 $ | le fournisseur change (Amazon Bedrock) ; à vérifier en usage réel |
| Gemini 2.5 Flash | 0,78 / 0,91 s | équivalente (+ 0,04) | 4/14, Emma refuse | 0,00173 $ (≈ 3 ×) | jeu d'Emma, coût |
| gpt-oss-120b · Cerebras | 0,60 / 0,77 s | **− 0,52** | 8/14 mais invente | 0,00186 $ | qualité, inventions |

- Le routage « latence » gagne **0,43 s en médiane et 0,59 s en p90** sur la première phrase. Il ne change ni le modèle, ni le texte, ni le coût, ni le format (intent 100 %). Gemini 2.5 Flash n'est plus rapide que de 0,04 s, coûte trois fois plus et change le jeu d'Emma : rien ne justifie de changer de modèle.
- gpt-oss-120b est le plus rapide, mais il joue nettement moins bien et invente : écarté.
- Coût total des mesures du lot 2 : ≈ 8,2 $ (banc 0,71 $, juge gpt-oss 4,10 $, juge Gemini ≈ 3,04 $, rappel ≈ 0,3 $, essais ≈ 0,05 $).

Lot 3 proposé, sur accord d'Ulrich : réglage sandbox de la préférence `sort: latency` pour l'appel du personnage, latence et cache dans `llm_usage`, correctif de mémoire, température cohérente, puis mesure en usage réel (au moins 20 tours). Le lot 4 (flux sur toutes les sorties) reste le plus gros gain suivant : à modèle égal, la réponse entière arrive ≈ 0,7 s après la première phrase.
