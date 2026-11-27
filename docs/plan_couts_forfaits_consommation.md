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

Sur les cartes, le bouton de période (24 heures, 7 jours, 30 jours) partage ce même abonnement : montant mensuel × jours / 30. Les minutes affichées sont celles de la période. Les minutes restantes sont celles du cycle, pas une part des jours choisis. Seules les minutes de la période qui dépassent le forfait s'ajoutent. « Tout » montre le mois en cours, sans prorata de tout l'historique. Un forfait vide reste vide.

Le coût de la période, les minutes restantes et la date de renouvellement restent en tête de chaque carte. Le bandeau du haut n'est pas répété. Un service arrêté ou en pause n'a pas de carte ; la rangée du dessus additionne les autres.

Un abonnement annuel garde un quota mensuel : la fenêtre part du jour de début (à défaut du jour de renouvellement), la fin de mois étant ramenée au dernier jour. Le montant mensuel est le montant de l'année en cours / 12.

Les forfaits sont une seule ligne `billing.service_plans` dans `admin_settings` (environnement `prod`). Pas de nouvelle table. Sandboxes comprises dans le forfait, parce que la facture ne les sépare pas.

## Unités

- Voix : crédits ou caractères réellement journalisés. Les minutes sont une estimation : 750 caractères ≈ 1 minute, 1 000 pour ElevenLabs, dont les crédits dépendent du modèle (voir la section ElevenLabs).
- Vidéo : minutes de session Ava. Tavus facture 30 secondes minimum ; Anam à la seconde. HeyGen : crédits, 2 par minute en FULL, 1 en LITE, au choix dans la fiche.
- OpenRouter : dollars déjà renvoyés. Pas d'abonnement public. Un crédit mensuel saisi n'est pas ajouté une seconde fois.
- Voyage (RAG) : abonnement saisissable. Ava n'enregistre pas le prix de chaque embedding. Le rerank OpenRouter est déjà dans le total LLM.

Tarifs publics lus le 22 novembre 2026. Un écart avec la facture se corrige dans le champ, il n'est pas deviné.

## Hors de ce lot

Coût marginal par session une fois les forfaits saisis, scénarios 1 / 5 / 20 lieux, hébergement, entraînement, self-hosting.
Reprise : [prompt](prompt_reprise_couts_scenarios_diffusion.md).

## ElevenLabs en abonnement annuel (diagnostic du 27 novembre 2026)

### Facture et grille

- Creator annuel du 27 novembre 2026 au 27 novembre 2027 : 220 $ au tarif normal, remise Black Friday de 121 $, 99 $ hors taxe, TVA 8,1 % de 8,02 $, soit **107,02 $ payés** (8,92 $ par mois).
- Renouvellement annoncé : 220 $ hors taxe (237,82 $ avec la même TVA).
- [Tarifs](https://elevenlabs.io/pricing) et [tarifs API](https://elevenlabs.io/pricing/api), lus le 27 novembre : 121 000 crédits par mois ; report des crédits non utilisés jusqu'à deux mois.
- Minutes incluses (lecture d'un tableau aplati, seule la ligne v4 est confirmée) : environ **550 min** sur v4 Turbo, Flash et v3 Conversational, **275 min** sur v4, v3 et Multilingual v2 (1 000 caractères ≈ 1 min).
- Prix API : 0,04 $ (famille Turbo) ou 0,08 $ (v4, v3, Multilingual v2) pour 1 000 caractères.

### Relevé du compte (30 jours au 27 novembre, capture d'écran)

45 900 crédits, 216 000 caractères, 3,2 h, 1 930 requêtes. Soit 0,21 crédit par caractère et 38 % d'un quota mensuel Creator. La capture ne détaille ni les produits ni les modèles.

### Écarts relevés avant le lot 1 (`src/services/servicePlans.ts`)

1. En « Annuel », `billingWindow` ouvre une fenêtre de 12 mois et lui compare le quota d'un mois : faux dépassement.
2. Un seul montant : la remise de première année serait reprise au renouvellement.
3. Un caractère compte un crédit pour tous les modèles. Les deux sources ci-dessus donnent environ 0,22 (famille Turbo) et 0,44 (v4, v3, Multilingual v2) : valeurs déduites, à confirmer sur l'export par modèle.
4. 750 caractères par minute, contre environ 1 000 chez ElevenLabs.
5. La consommation vient des journaux d'Ava : les autres usages du compte n'y sont pas.

### Lot 1 réalisé (27 novembre 2026)

- Fenêtre de quota mensuelle (`quotaWindow`), première année et renouvellement séparés ; le total ne compte que les factures annuelles déjà datées. La première année vaut pour les douze premiers mois, ensuite le montant de renouvellement ; une hausse ultérieure de ce montant recalculerait les renouvellements passés.
- Crédits : 0,22 et 0,44 par caractère. Pages relues le 27 novembre : la grille API donne 550 000 et 275 000 caractères pour l'offre à 22 $, cohérent avec le relevé du compte (0,21). La FAQ de la page tarifaire annonce au contraire 0,5 et 1 crédit par l'API : à trancher sur l'export « Utilisation » par modèle. Un crédit chargé (prépayé) reste compté au caractère.
- Pages relues : crédits remis à zéro à chaque cycle « à partir du jour de souscription » ; rien sur le rythme d'un abonnement annuel. Dépassement Creator « ~0,18 $ » par minute supplémentaire sur la grille web.
- Journal Ava sur 30 jours : tous les appels ElevenLabs ont un modèle ; presque tout est en `eleven_v4_turbo`.
- Reste : saisir la fiche (début 2026-11-27, renouvellement 2027-11-27, 121 000 crédits, 107,02 $ la première année, 237,82 $ au renouvellement) et la recette de l'écran.

### Lots

1. Annuel : code livré (ci-dessus), fiche à saisir. [Prompt d'origine](prompt_reprise_elevenlabs_annuel_lot_1.md).
2. Consommation réelle lue chez ElevenLabs par une fonction serveur (solde, report, prochaine remise à zéro). [Reprise](prompt_reprise_elevenlabs_annuel_lot_2.md).
3. Autres usages à évaluer : voix clonées professionnelles pour Max et Emma, effets sonores d'ambiance, comparaison de Scribe avec Deepgram derrière la façade STT. Musique et doublage : pas de besoin identifié. Droits, consommation et latence à vérifier avant tout essai.
