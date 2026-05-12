#!/usr/bin/env bash
# .devcontainer/initialize.sh
#
# Runs on the host before the devcontainer starts (devcontainer.json の
# initializeCommand から呼ばれる)。役割:
#
#   1. GH_TOKEN が export されていなければ案内を出す
#      (macOS の gh は PAT を keychain に保存するため、~/.config/gh の bind
#      mount だけではコンテナ内 gh から認証できない)
#   2. Claude Code を使う人向けに ~/.claude/projects/-app シンボリックリンクを
#      作成 (per-project memory bridge)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- 1) GH_TOKEN チェック -------------------------------------------------
if [[ -z "${GH_TOKEN:-}" ]]; then
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        cat <<'MSG' >&2
warning: GH_TOKEN is not set in the host shell.
The devcontainer mounts ~/.config/gh, but on macOS the token is stored in
the keychain and is not available inside the container.

To enable `gh` inside the devcontainer, run before launching:

    export GH_TOKEN=$(gh auth token)

Then start/reopen the devcontainer.
MSG
    else
        echo "warning: host gh CLI not authenticated. devcontainer-internal gh will be unusable." >&2
    fi
fi

# --- 2) Claude Code per-project memory bridge ----------------------------
# Claude Code をホスト側にインストールしていないユーザは何もしない。
# このセクションは本人が devcontainer.json で
# ~/.claude/projects/-app マウントを有効にしている場合に意味を持つ。
if [[ -d "${HOME}/.claude/projects" ]]; then
    WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
    HOST_PROJECT_SLUG="$(printf '%s' "${WORKSPACE_DIR}" | sed 's:/:-:g')"
    HOST_PROJECT_DIR="${HOME}/.claude/projects/${HOST_PROJECT_SLUG}"
    ALIAS_DIR="${HOME}/.claude/projects/-app"

    mkdir -p "${HOST_PROJECT_DIR}/memory"

    if [[ -L "${ALIAS_DIR}" ]]; then
        CURRENT_TARGET="$(readlink "${ALIAS_DIR}")"
        if [[ "${CURRENT_TARGET}" != "${HOST_PROJECT_DIR}" ]]; then
            rm "${ALIAS_DIR}"
            ln -s "${HOST_PROJECT_DIR}" "${ALIAS_DIR}"
        fi
    elif [[ -e "${ALIAS_DIR}" ]]; then
        echo "warning: ${ALIAS_DIR} exists as a non-symlink; not touching it" >&2
    else
        ln -s "${HOST_PROJECT_DIR}" "${ALIAS_DIR}"
    fi
fi

exit 0
