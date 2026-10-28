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

## CT1 — trois décisions approuvées le 28 octobre 2026

Ulrich a répondu « Appliquer les trois » : CI complète sur PR une fois,
contexte/skills proportionnés et diagnostic court avec repli GitHub vérifié.
Cette validation inclut les fichiers personnels concernés, sous réserve des
permissions système. Aucun changement fonctionnel, vocal, Cloud ou production.

1. Adapter AGENTS/CLAUDE ensemble, enregistrer un ADR et garder une page courte
   `docs/etat_courant.md`. Les grands historiques se consultent sur besoin.
2. Tester explicitement le HEAD de PR, vérifier qu'il contient main et ne plus
   lancer la campagne sur push main. Conserver les navigateurs et assertions.
   Ajouter une garde de livraison versionnée : attendre le bon run et son job,
   refuser un HEAD/base obsolète, fusionner avec SHA attendu, comparer arbre et
   parent après squash. Aucun succès annoncé si la comparaison échoue.
3. Faire passer git-ship par cette garde pour Ava ; conserver ses identités et
   son comportement pour les autres dépôts. Diagnostic identité/ressource borné.
4. Dédupliquer visual-plan avec sauvegarde récupérable, réserver visual-plan,
   canvas et research à leur invocation pertinente ; remplacer le score de
   confidence-check par des conditions observables. Retirer le ciblage global
   vexp vers un autre dépôt et configurer Ava dans son seul périmètre.
5. Vérifier refus de fusion (CI absente/en attente/rouge, ancien HEAD, base
   déplacée, mauvais dépôt, arbre différent), attendre le cas vert ; tests
   déterministes avec transport GitHub simulé et dépôt Git temporaire.
   Qualité locale, puis une campagne PR complète. Comparer durée réelle avec
   #104 sans promettre de gain de vitesse des tests ni de parallélisme.
6. Tout commiter avant push, PR/fusion/garde, supprimer notre branche seulement,
   vérifier la synchronisation Lovable et mémoriser dans les bonnes cibles Notion.
   Livrer la reprise CT2 de mesure sur un lot fonctionnel comparable ; F4 reste
   une recette humaine séparée. Aucun lancement automatique.

Base vérifiée : `a9f5c72d357d09daedb0d09b0801a7eb766623b5`, dépôt public,
main sans protection de branche (404 de l'API), PR étrangère #24 conservée et
sans recouvrement des fichiers CT1. Lovable Ava/Memoways ready sur cette base.
La suppression du second passage complet sur main est explicite et approuvée.
La garde sera une obligation de livraison locale ; elle ne constitue pas une
protection serveur contre une fusion manuelle qui la contourne.

### Validation CT1 avant push

23 tests de garde verts ; défaut git-ship reproduit sur transports simulés avant,
refus correct après. Qualité locale verte : 71 régressions, 1 115 unitaires,
42 intégrations, lint/typage/build. Bash/TOML/YAML relus, config Codex vexp résolue
sur Ava, doublon archivé et politiques de skills appliquées. Détails et limites :
[livraison CT1](livraison_contexte_travail_ct1.md).

La fusion et les métadonnées CI seront vérifiées sur GitHub dans le compte rendu
et Notion. Aucun second commit de clôture pour connaître son propre futur SHA.
Suite préparée : [CT2 — mesurer un lot comparable](prompt_reprise_contexte_travail_lot_ct2.md),
sans démarrage automatique. F4 reste une recette humaine distincte, sans publication.
