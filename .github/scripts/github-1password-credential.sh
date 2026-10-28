#!/usr/bin/env bash
# Git reads this only over its credential pipe; never install it as a global helper.
set -euo pipefail
set +x
[[ "${1:-}" == get ]] || exit 0
protocol='' host='' path=''
while IFS='=' read -r key value; do
 case "$key" in protocol) protocol="$value" ;; host) host="$value" ;; path) path="${value%.git}" ;; esac
done
[[ "$protocol" == https && "$host" == github.com && "$path" == memoways/ava-proto1 ]] || exit 0
[[ -n "${GH_TOKEN:-}" && "$GH_TOKEN" != op://* ]] || exit 1
printf 'username=x-access-token\npassword=%s\n' "$GH_TOKEN"
