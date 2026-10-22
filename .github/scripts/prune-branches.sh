#!/usr/bin/env bash
# Supprime les branches distantes dont le travail est terminé (règle « zéro branche qui traîne »).
# Une branche est supprimée si, et seulement si, elle n'a aucune PR ouverte ET :
#   - tous ses commits sont déjà dans la branche par défaut, ou
#   - une PR fermée/fusionnée porte exactement son dernier commit (rien d'ajouté depuis).
# Toute autre branche (travail non rattaché à une PR, commits ajoutés après la fermeture)
# n'est JAMAIS supprimée : elle est signalée en avertissement.
# Variables : GITHUB_REPOSITORY, GH_TOKEN ; DRY_RUN=1 pour ne rien supprimer.
set -euo pipefail

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY requis}"
owner="${repo%%/*}"
default="$(gh api "repos/$repo" --jq .default_branch)"
dry="${DRY_RUN:-0}"
deleted=0
kept=0
warned=0

while IFS= read -r branch; do
  [ -z "$branch" ] && continue
  [ "$branch" = "$default" ] && continue

  tip="$(gh api "repos/$repo/branches/$branch" --jq .commit.sha)"
  open_count="$(gh api -X GET "repos/$repo/pulls" -f state=open -f head="$owner:$branch" --jq 'length')"
  if [ "$open_count" -gt 0 ]; then
    echo "GARDÉE   $branch (PR ouverte)"
    kept=$((kept + 1))
    continue
  fi

  ahead="$(gh api "repos/$repo/compare/$default...$branch" --jq .ahead_by 2>/dev/null || echo -1)"
  closed_on_tip="$(gh api -X GET "repos/$repo/pulls" -f state=closed -f head="$owner:$branch" \
    --jq "[.[] | select(.head.sha == \"$tip\")] | length")"

  if [ "$ahead" = "0" ] || [ "$closed_on_tip" -gt 0 ]; then
    if [ "$dry" = "1" ]; then
      echo "À SUPPRIMER (simulation) $branch"
    else
      gh api -X DELETE "repos/$repo/git/refs/heads/$branch" >/dev/null
      echo "SUPPRIMÉE $branch"
    fi
    deleted=$((deleted + 1))
  else
    echo "::warning title=Branche non terminée::$branch n'a pas de PR ouverte mais contient du travail absent de $default. À fusionner ou à abandonner explicitement."
    warned=$((warned + 1))
  fi
done < <(gh api --paginate "repos/$repo/branches" --jq '.[].name')

echo "Bilan : $deleted supprimée(s), $kept gardée(s) (PR ouverte), $warned à traiter."
