# Prompt de reprise — ElevenLabs annuel, lot 1

À copier dans un nouvel agent sur Ava. Contexte : [plan](plan_couts_forfaits_consommation.md),
[CHANGELOG](../CHANGELOG.md), [état courant](etat_courant.md).

---

**Objectif.** Les écrans de consommation voix doivent compter juste l'abonnement ElevenLabs Creator
annuel : coût, quota de crédits par mois, minutes disponibles et restantes. Puis renseigner la fiche.

**État vérifié (27 novembre 2026).** Diagnostic seulement, aucun code. Facture : Creator annuel du
27 novembre 2026 au 27 novembre 2027, 99 $ hors taxe après remise (tarif 220 $), 107,02 $ avec TVA ;
renouvellement à 220 $ hors taxe. 121 000 crédits par mois. Relevé 30 jours : 45 900 crédits pour
216 000 caractères. Détail, sources et écarts dans le plan, section « ElevenLabs en abonnement annuel ».

**Avant de coder.** Lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
de `main` et le plan. Vérifier branches et PR ouvertes, préserver la PR #24 et toute PR étrangère.
Repartir de `main` à jour. Relire les deux pages tarifaires. Lire la fiche réellement enregistrée
(`admin_settings`, `billing.service_plans`, environnement `prod`) par le MCP Lovable Ava.

**À confirmer sur le compte ElevenLabs** (lecture seule, sinon le demander à Ulrich) : date de la
prochaine remise à zéro des crédits (mensuelle attendue, non écrite sur les pages) ; crédits par
caractère de chaque modèle d'après l'export « Utilisation » groupé par modèle ; prix du dépassement
Creator (environ 0,18 $ lu pour une unité que le tableau aplati ne nomme pas).

**Périmètre.**

1. Facturation annuelle : fenêtre de quota **mensuelle**, ancrée sur le jour de début (27) ; la date
   de renouvellement affichée reste annuelle. Ne pas changer le calcul des abonnements mensuels.
2. Montant de la période en cours (promo comprise) et montant du renouvellement, saisis séparément.
   Équivalent mensuel = montant annuel / 12. Le total « depuis le début » additionne les vraies factures.
3. ElevenLabs : crédits par modèle à partir de `metadata_json.model` d'`audio_latencies`, avec un
   repli prudent et visible si le modèle manque. Minutes à environ 1 000 caractères par minute,
   toujours marquées comme estimation. Montrer la capacité mensuelle par famille de modèles.
4. Indiquer sur la carte que seuls les appels journalisés par Ava sont comptés ; signaler que le
   report de crédits n'est pas calculé.
5. Après livraison et synchronisation Lovable, renseigner la fiche ElevenLabs : abonnement actif,
   Creator, annuel, début 2026-11-27, renouvellement 2027-11-27, 121 000 crédits, 107,02 $ pour la
   période (montant payé, TVA comprise, sauf avis contraire d'Ulrich), 237,82 $ au renouvellement.
   Ulrich a demandé le 27 novembre que ces champs soient remplis ; aucun autre réglage à modifier.

**Limites.** Pas de nouvelle table, pas de lecture de l'API ElevenLabs (lot 2), pas d'essai d'autres
produits (lot 3), pas d'achat ni de changement d'abonnement, pas de publication en production.
Aucune facture ni donnée personnelle dans le dépôt. Base Caractères en lecture seule.

**Validations.** Tests : annuel avec quota mensuel (cas limite fin de mois), promo puis
renouvellement, crédits par modèle, modèle absent, mensuel inchangé. Lint, typecheck,
`test:delivery`, qualité locale, CI `regression-gates` verte sur le HEAD exact.

**Livraison.** Un seul lot : commit, push, PR, garde `ship-pr.mjs`, vérification sur `main` et
Lovable. Mettre à jour CHANGELOG, état courant et plan dans la branche, écrire
`prompt_reprise_elevenlabs_annuel_lot_2.md`, le donner en fin de compte rendu avec cette même
obligation, puis s'arrêter.
