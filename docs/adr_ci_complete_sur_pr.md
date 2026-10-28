# ADR — une campagne complète sur PR, arbre fusionné vérifié

Date : 28 octobre 2026. Décision : approuvée par Ulrich (« Appliquer les trois »).
Portée : Ava uniquement, dépôt public memoways/ava-proto1, livraison GitHub.

## Problème

La même campagne est exécutée sur PR puis main : #104 a consommé 46 min 42 s,
dont 40 min 28 s d'E2E. Le second job seul prenait 24 min 16 s. Le git-ship
personnel demandait en outre la fusion sans attendre la CI ni préciser le HEAD.
[Audit et sources](audit_contexte_travail_2026-10-28.md).

## Décision

Le workflow qualité reste sur pull_request et conserve les contrôles et trois
navigateurs existants. Il teste explicitement le SHA de tête de la PR et vérifie
que la base main y est incluse. Le déclenchement push main de cette campagne est
**retiré explicitement** ; pas de seconde campagne après squash. Les lots purement
documentaires conservent leur exception, avec diff/lecture et référence code verte.

La garde `.github/scripts/ship-pr.mjs` exige remote unique, checkout propre,
branche/HEAD de la PR identiques, base courante ancêtre du HEAD, run du workflow
attendu et job regression-gates terminés avec succès. Elle attend les états en
cours, refuse un échec ; elle ne relance pas et ne rebase pas en secret. Le mode
sans `--merge` vérifie seulement. La fusion squash passe `sha=HEAD` à GitHub.
Après fusion, l'arbre doit égaler celui du HEAD testé et l'unique parent doit
être la base vérifiée ; main doit encore pointer sur ce commit. Ce reçu remplace
le second passage de la campagne, pas la synchronisation Lovable ou la recette.

Une base déplacée avant fusion exige mise à jour et nouveau HEAD vert. GitHub
n'offre ici de condition atomique que sur le HEAD ; une course sur la base pendant
la requête est détectée par la comparaison du parent/arbre après fusion. Dans ce
cas le lot reste ouvert : inspecter, corriger/revenir à l'état validé avant clôture.
La garde n'est pas une protection serveur ; main n'était pas protégé à la lecture
API du 28 octobre. Une fusion manuelle peut la contourner et viole le contrat.
Le lot ne modifie pas les protections serveur ni les budgets GitHub.

Le script git-ship partagé délègue à la garde seulement pour ce dépôt ; ses
identités GitHub App/personnelle sont conservées. Les autres dépôts ne changent
pas de politique. Le nettoyage est limité à notre branche vérifiée comme livrée.

## Validation et limites

Tests déterministes de refus/attente/fusion et exemple Git réel temporaire pour
l'égalité des arbres après squash. Qualité locale puis campagne PR complète.
Le SHA final, le run et le reçu seront donnés dans le compte rendu et Notion ;
les documents avant push ne peuvent pas contenir leur futur SHA de fusion.
Ce lot ne prouve aucun gain de vitesse de modèle ni de parallélisme E2E. La
mesure comparable du prochain lot fonctionnel est préparée par le prompt CT2.
Les tests simulés ne remplacent pas la recette vocale F4 ni une publication.

## Références primaires

- [GitHub : contexte PR et checkout du HEAD](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request) : le checkout PR par défaut teste un commit de merge synthétique ; le ref HEAD explicite rend le contrat non ambigu.
- [GitHub : fusion conditionnée au SHA](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request) : le paramètre sha refuse un HEAD différent.
- [Contrat](../AGENTS.md), [plan](plan_audit_contexte_travail.md).
