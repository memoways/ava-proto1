# Plan — hygiène des branches et fin de lot

## Constat (2026-10-22)

- 7 branches et 7 PR ouvertes ; 3 branches sans ancêtre commun avec `main`.
- La PR de consolidation #68 a été fusionnée alors que son contrôle `regression-gates`
  était resté `queued` depuis 9 minutes : aucune CI (E2E compris) n'avait tourné avant
  la fusion. Seule la CI post-fusion de `main` a pu valider.
- Cinq branches de PR fermées sont restées : la suppression automatique à la fusion ne
  couvre pas les PR fermées sans fusion, et un agent sans droit de suppression ne peut pas
  les retirer.

## Décision d'Ulrich

Tout lot va jusqu'au bout : dans `main`, CI verte, branche supprimée, rien ne traîne.
À ne jamais avoir à redire.

## Mise en œuvre

1. `AGENTS.md` : section « Fin de lot » (source de vérité pour tous les agents).
2. `CLAUDE.md` et `.cursor/rules/fin-de-lot-zero-branche.mdc` : rappel impératif.
3. `.github/PULL_REQUEST_TEMPLATE.md` : case à cocher « CI verte sur le HEAD exact ».
4. `.github/workflows/prune-branches.yml` + `.github/scripts/prune-branches.sh` :
   suppression automatique des branches terminées (à la fermeture d'une PR, chaque lundi,
   à la demande). Jamais de suppression d'une branche avec du travail absent de `main`
   et sans PR : avertissement.

## Limite connue — action d'Ulrich

Les règles guident les agents mais ne peuvent pas bloquer une fusion. Seule une règle de
protection de `main` exigeant le contrôle `regression-gates` l'empêche (Settings → Branches
→ Branch protection rule sur `main` → *Require status checks to pass* → `regression-gates`).

## Vérification

- Simulation du script sur le dépôt réel : 5 branches périmées visées, la branche de la
  PR ouverte #24 gardée.
- Après fusion : exécution manuelle du workflow, puis liste des branches restantes.
