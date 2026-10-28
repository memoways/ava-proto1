#!/usr/bin/env bash
# Isolate one Ava delivery process. No global auth configuration or credential-store access.
set -euo pipefail
set +x
fail() { printf '%s\n' "$1" >&2; exit 1; }
config_file="${AVA_GITHUB_1PASSWORD_CONFIG:-${HOME}/.config/git-ship/ava-1password.env}"
if [[ -f "$config_file" ]]; then
 while IFS='=' read -r key value; do
  case "$key" in
   AVA_GITHUB_APP_ID|AVA_GITHUB_APP_INSTALLATION_ID|AVA_GITHUB_APP_KEY_REFERENCE|AVA_GITHUB_TOKEN_REFERENCE|OP_ACCOUNT) [[ -n "${!key:-}" ]] || export "$key=$value" ;;
   ''|'#'*) ;;
   *) fail 'Champ de configuration 1Password inconnu ; aucun repli personnel.' ;;
  esac
 done < "$config_file"
fi
reference="${AVA_GITHUB_TOKEN_REFERENCE:-}"
app_reference="${AVA_GITHUB_APP_KEY_REFERENCE:-}"
if [[ -n "$app_reference" ]]; then
 [[ "$app_reference" == op://* && "$app_reference" != *$'\n'* && "${AVA_GITHUB_APP_ID:-}" =~ ^[0-9]+$ && "${AVA_GITHUB_APP_INSTALLATION_ID:-}" =~ ^[0-9]+$ ]] || fail 'Configuration GitHub App 1Password invalide ; aucun repli personnel.'
else
 [[ "$reference" == op://* && "$reference" != *$'\n'* ]] || fail 'Définir AVA_GITHUB_TOKEN_REFERENCE avec une référence 1Password GitHub ; aucun repli personnel.'
fi
[[ $# -gt 0 ]] || fail 'Usage: AVA_GITHUB_TOKEN_REFERENCE=op://… bash .github/scripts/github-1password.sh COMMANDE ARGUMENTS…'
case "$1" in git|gh) ;; session|git-ship) [[ -n "$app_reference" ]] || fail 'La session et git-ship exigent la GitHub App dédiée via 1Password ; aucun repli personnel.' ;; node) [[ "${2:-}" == .github/scripts/ship-pr.mjs ]] || fail 'Seule la garde Ava est autorisée avec node.' ;; *) fail 'Commandes autorisées : session, git, gh, git-ship avec App dédiée ou node .github/scripts/ship-pr.mjs.' ;; esac
[[ "$1:${2:-}" != gh:auth ]] || fail 'Aucun login/refresh/logout personnel ; utiliser uniquement l’identifiant fourni par 1Password.'
command -v op >/dev/null || fail 'CLI officielle 1Password absente ; aucun repli personnel.'
remote="$(git remote get-url origin)"
[[ "$remote" == https://github.com/memoways/ava-proto1 || "$remote" == https://github.com/memoways/ava-proto1.git ]] || fail 'Remote Ava incorrect ; aucun accès aux secrets.'
[[ "$(git remote)" == origin ]] || fail 'Remote Ava unique requis ; aucun accès aux secrets.'
for mode in fetch push; do
 if [[ "$mode" == push ]]; then urls="$(git remote get-url --push --all origin)"; else urls="$(git remote get-url --all origin)"; fi
 [[ "$urls" == https://github.com/memoways/ava-proto1 || "$urls" == https://github.com/memoways/ava-proto1.git ]] || fail 'Remote Ava incorrect ; aucun accès aux secrets.'
done
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
helper="${script_dir}/github-1password-credential.sh"
[[ -f "$helper" ]] || fail 'Helper Ava absent.'
# Existing process-local Git configuration is replaced, never persisted.
export GIT_CONFIG_COUNT=5
export GIT_CONFIG_KEY_0=credential.helper GIT_CONFIG_VALUE_0=''
export GIT_CONFIG_KEY_1=credential.helper GIT_CONFIG_VALUE_1="!bash '${helper}'"
export GIT_CONFIG_KEY_2=credential.useHttpPath GIT_CONFIG_VALUE_2=true
export GIT_CONFIG_KEY_3=core.askPass GIT_CONFIG_VALUE_3=/usr/bin/false
export GIT_CONFIG_KEY_4=credential.interactive GIT_CONFIG_VALUE_4=false
export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=/usr/bin/false SSH_ASKPASS=/usr/bin/false GIT_SSH_COMMAND=/usr/bin/false
# A fresh empty gh config prevents personal-account lookup even if a child asks for a profile.
isolated_config="$(mktemp -d "${TMPDIR:-/tmp}/ava-gh-1password.XXXXXX")"
trap 'rm -rf "$isolated_config"' EXIT
export GH_CONFIG_DIR="$isolated_config"
unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN GITHUB_ENTERPRISE_TOKEN AVA_GITHUB_TOKEN_REFERENCE
if [[ -n "$app_reference" ]]; then
 export AVA_GITHUB_APP_PRIVATE_KEY="$app_reference"
 unset AVA_GITHUB_APP_KEY_REFERENCE
 if [[ "$1" == session ]]; then
  op run -- node "${script_dir}/github-1password-app.mjs" --session
 else
  op run -- node "${script_dir}/github-1password-app.mjs" "$@"
 fi
 exit $?
fi
export GH_TOKEN="$reference"
# op resolves the reference only for this child; its default output masking remains enabled.
op run -- bash -c '
 set -euo pipefail
 set +x
 case "${GH_TOKEN:-}" in ghp_*|github_pat_*|ghs_*|gho_*|ghu_*) ;; *) printf "%s\n" "Identifiant GitHub absent ou invalide ; aucun repli personnel." >&2; exit 1 ;; esac
 exec "$@"
' ava-github-1password "$@"
