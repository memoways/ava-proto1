# Prompt de reprise — coûts, scénarios de diffusion

À copier dans un nouvel agent sur Ava. Contexte : [plan](plan_couts_forfaits_consommation.md),
[tâche](https://app.notion.com/p/91962322e59583d182f4813546ddf490), [CHANGELOG](../CHANGELOG.md),
[état courant](etat_courant.md).

---

**Objectif.** Chiffrer le coût marginal d'une session, puis trois scénarios de diffusion (1 / 5 / 20 lieux),
avec la part portée par les lieux. Le self-hosting se chiffre à part, sans achat ni nouvel abonnement.

**État vérifié.** Technique avancée (Consommation LLM, Voix, Streaming Avatar) sépare
l'abonnement fixe, le quota inclus, la consommation du cycle et le dépassement. Les cartes Voix
et Streaming Avatar partagent en plus cet abonnement sur les jours choisis (1, 7 ou 30 sur 30),
avec les minutes consommées, le reste du forfait et le coût de la période. Ce coût, les minutes
restantes et la date de renouvellement sont en tête de chaque carte. Le total du dessus additionne
les services en cours : un service arrêté n'a pas de carte. « Tout » reste le mois en cours. Les forfaits sont dans `admin_settings` (`billing.service_plans`, environnement `prod`).
Le calcul est dans `src/services/servicePlans.ts` (`planSnapshot`, `periodCostReading`). Les minutes
de voix sont une estimation (750 caractères). Voyage n'est pas mesuré appel par appel. Rien de ceci
n'est en production tant que Lovable n'a pas publié.

**Avant de coder.** Lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
de `main` et le plan. Vérifier les branches et PR ouvertes. Préserver la PR #24 et toute PR étrangère
active. Repartir de `main` à jour. Lire les forfaits réellement enregistrés avant de projeter un scénario :
un forfait vide ne se remplace pas par un tarif public.

**Périmètre.**

1. Coût marginal d'une session : 0 pour les unités encore dans le quota, prix de dépassement au-delà,
   fixe mensuel montré à part (il ne se divise pas en silence dans chaque session).
2. Trois scénarios, 1 / 5 / 20 lieux, à partir des durées et des services réellement mesurés.
   La part portée par un lieu est une hypothèse écrite, pas un nouveau moteur.
3. Hébergement Lovable et self-hosting : relevé séparé, sans le mélanger à la voix ou à la vidéo.

**Limites.** Pas de nouvelle table. Pas d'achat, pas de changement d'abonnement, pas de production.
Base Caractères en lecture seule. Ne pas réécrire les tarifs publics sans relire la page du fournisseur.

**Validations.** Tests du calcul marginal. Lint, typecheck, tests de garde, CI `regression-gates`
verte sur le HEAD exact.

**Livraison.** Branche depuis `main`, commit, push, PR, fusion par
`node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`. CHANGELOG, `docs/etat_courant.md`, prompt du
lot suivant dans le même tour. S'il n'y a pas de lot suivant, l'écrire. Cette passation ne lance pas le lot.
