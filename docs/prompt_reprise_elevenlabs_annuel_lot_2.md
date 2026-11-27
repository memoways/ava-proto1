# Prompt de reprise — ElevenLabs annuel, lot 2

À copier dans un nouvel agent sur Ava. Contexte : [plan](plan_couts_forfaits_consommation.md),
[CHANGELOG](../CHANGELOG.md), [état courant](etat_courant.md).

---

**Objectif.** Lire la consommation réelle du compte ElevenLabs par une fonction serveur et l'afficher
sur la carte ElevenLabs : crédits utilisés et restants, report, date de la prochaine remise à zéro.

**État vérifié (27 novembre 2026).** Lot 1 livré par PR (vérifier le SHA sur `main`) : quota mensuel
d'un abonnement annuel (`quotaWindow`), montants `firstYearFeeUsd` / `renewalFeeUsd`, crédits par
modèle (0,22 / 0,44, déduits), lecture voix paginée. Non fait : saisie de la fiche ElevenLabs
(`admin_settings`, `billing.service_plans`, `prod`) — le contrôle des permissions a refusé à l'agent
sa lecture en base ; vérifier avec Ulrich qu'elle est saisie, sinon demander son autorisation
explicite sans contourner. Écran non recetté dans l'application. Début 2026-11-27, renouvellement
2027-11-27, 121 000 crédits, 107,02 $ la première année, 237,82 $ au renouvellement.

**Avant de coder.** Lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
de `main` et le plan. Vérifier branches et PR ouvertes, préserver les PR étrangères. Lire la
documentation officielle de l'API d'abonnement et d'usage ElevenLabs avant de nommer un champ.

**À confirmer.** Droits de la clé serveur sur ces lectures (sinon une action d'Ulrich dans Lovable
Cloud, une seule) ; rythme de remise à zéro en annuel ; crédits par caractère et par modèle (la FAQ
annonce 0,5 / 1, le relevé donne 0,21) ; prix du dépassement Creator. Corriger les taux du lot 1 si
la mesure les contredit.

**Périmètre.** Fonction serveur en lecture seule, réservée aux administrateurs, secret côté serveur.
Carte : valeur réelle du compte à côté de la mesure Ava, avec la date de lecture ; repli visible sur
la mesure Ava si l'appel échoue.

**Limites.** Pas de nouvelle table, pas d'essai d'autres produits (lot 3), pas d'achat ni de
changement d'abonnement, pas de publication en production. Aucune facture ni donnée personnelle dans
le dépôt. Base Caractères en lecture seule.

**Validations.** Tests : réponse nominale, clé sans droit, erreur réseau, accès non administrateur.
`test:quality`, `test:delivery`, CI `regression-gates` verte sur le HEAD exact ; déploiement de la
fonction vérifié via le MCP Lovable Ava.

**Livraison.** Un seul lot : commit, push, PR, garde `ship-pr.mjs`, vérification sur `main` et
Lovable. Mettre à jour CHANGELOG, état courant et plan dans la branche, écrire le prompt du lot 3 avec
cette même obligation, le donner en fin de compte rendu, puis s'arrêter.
