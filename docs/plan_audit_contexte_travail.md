# Plan — audit du contexte de travail

Date : 28 octobre 2026. Demande : expliquer les délais, les défauts malgré les
tests, les instructions/skills et les blocages Notion/GitHub.

## Périmètre autorisé

Audit en lecture seule des configurations et services ; création du rapport,
du présent plan et du prompt de reprise. Aucune modification de workflow,
préférence, skill, authentification ou application dans ce lot.

## Travaux effectués

1. Vérifier les identités et cibles Notion personnelle/Gamilab et GitHub Ava.
2. Examiner contrats, scripts, configuration filtrée et skills pertinents.
3. Lire 14 jours de métadonnées CI et quatre jobs récents ; comparer la durée
   des étapes et relire les limites des simulations et les erreurs F3.
4. Rapprocher les observations des traces du dernier chat de développement.
5. Documenter causes vérifiées, risques et inconnues, puis proposer trois décisions.

Résultat : [audit sourcé](audit_contexte_travail_2026-10-28.md).

## Validation et livraison

Lot exclusivement Markdown : relecture des mesures, liens, périmètre du diff et
absence de changement du code/workflow. Pas de nouvelle campagne de tests selon
l'exception documentaire du contrat. Référence code verte : main
`9adabdce5b5a4f9be6f6fdc6545868659cb4120a`,
[CI 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202).
Base documentaire de l'audit : main `0445a4f4954c0ae7472e1e7b40ce2661b93dc78b`.
Livraison par PR documentaire puis fusion et suppression de notre branche.
L'état final et le SHA de fusion sont fournis par lecture GitHub dans le compte rendu.

## Suite proposée

[CT1 — simplifier le contexte et les contrôles](prompt_reprise_contexte_travail_lot_ct1.md),
après choix explicite des modifications proposées. Pas de démarrage automatique,
pas de nouvelle recette humaine Ava, pas de publication. Actualiser ce plan lors
de la reprise et fournir à la clôture son prompt suivant, ou indiquer qu'aucun
lot ne suit.
