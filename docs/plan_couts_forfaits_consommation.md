# Coûts — forfaits dans la consommation

Tâche : [modèle de coûts IA](https://app.notion.com/p/91962322e59583d182f4813546ddf490).
Ce lot couvre la mesure dans Technique avancée. Les scénarios de diffusion et le self-hosting restent le lot suivant.

## Lecture

Le bloc s'ouvre replié. La période est une rangée de boutons. Les sandboxes sont incluses, sauf si on coupe l'interrupteur.

Un service est soit un abonnement mensuel, soit un crédit prépayé valable jusqu'à épuisement. L'état actif, en pause ou résilié dit si la mensualité court encore. Fish Audio n'a pas de solde à recharger.

Un abonnement mensuel demande aussi la date du premier prélèvement. Le total depuis le début compte chaque facture jusqu'au prochain renouvellement. La fin de la période reste vide tant que l'abonnement continue.

## Ce qui faussait la lecture

Les onglets Voix et Streaming Avatar multipliaient chaque appel par un tarif public. Un abonnement ElevenLabs, Gradium, Anam ou Tavus était donc compté une deuxième fois, et le dépassement n'apparaissait pas.

## Règle de calcul

Pour chaque service, sur le cycle qui se termine à la date de renouvellement saisie (sinon le mois calendaire) :

- le montant fixe est celui de la facture, prérempli par un forfait public seulement quand on le choisit ;
- la consommation vient des journaux déjà là (`audio_latencies`, `sessions`, `llm_usage`) ;
- ce qui reste dans le quota coûte 0 en plus ;
- seules les unités au-dessus du quota sont multipliées par le prix de dépassement ;
- le total du cycle = fixe + dépassement.

Les forfaits sont une seule ligne `billing.service_plans` dans `admin_settings` (environnement `prod`). Pas de nouvelle table. Sandboxes comprises dans le forfait, parce que la facture ne les sépare pas.

## Unités

- Voix : crédits ou caractères réellement journalisés. Les minutes sont une estimation, 750 caractères ≈ 1 minute. ElevenLabs Multilingual v2 : 1 caractère = 1 crédit.
- Vidéo : minutes de session Ava. Tavus facture 30 secondes minimum ; Anam à la seconde. HeyGen : crédits, 2 par minute en FULL, 1 en LITE, au choix dans la fiche.
- OpenRouter : dollars déjà renvoyés. Pas d'abonnement public. Un crédit mensuel saisi n'est pas ajouté une seconde fois.
- Voyage (RAG) : abonnement saisissable. Ava n'enregistre pas le prix de chaque embedding. Le rerank OpenRouter est déjà dans le total LLM.

Tarifs publics lus le 22 novembre 2026. Un écart avec la facture se corrige dans le champ, il n'est pas deviné.

## Hors de ce lot

Coût marginal par session une fois les forfaits saisis, scénarios 1 / 5 / 20 lieux, hébergement, entraînement, self-hosting.
Reprise : [prompt](prompt_reprise_couts_scenarios_diffusion.md).
