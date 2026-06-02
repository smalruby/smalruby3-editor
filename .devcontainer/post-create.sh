#!/usr/bin/env bash
# .devcontainer/post-create.sh
#
# Runs inside the container after creation (devcontainer.json の
# postCreateCommand から呼ばれる)。
#
# - tmux 設定と tpm を常にセットアップ
# - worktree であれば bin/setup-worktree を実行 (env コピー + npm install + build:dev)
# - main checkout であれば既存の node_modules / dist / .env がそのままあるので
#   何もしない (gh / claude のインストールは devcontainer features が build 時に行う)

set -euo pipefail

cd /app

# ----- tmux セットアップ -----
# .devcontainer/tmux.conf を ~/.tmux.conf にインストールし、
# tpm (TMUX Plugin Manager) とプラグインをセットアップする。
# 既に ~/.tmux.conf が存在する場合は上書きしない。
TMUX_CONF_SRC="/app/.devcontainer/tmux.conf"
TMUX_CONF_DST="${HOME}/.tmux.conf"
TPM_DIR="${HOME}/.tmux/plugins/tpm"

if [[ -f "${TMUX_CONF_SRC}" && ! -f "${TMUX_CONF_DST}" ]]; then
    cp "${TMUX_CONF_SRC}" "${TMUX_CONF_DST}"
    echo "post-create: installed ${TMUX_CONF_DST}"
fi

PLUGINS_DIR="${HOME}/.tmux/plugins"

if [[ ! -d "${TPM_DIR}" ]]; then
    echo "post-create: installing tpm..."
    git clone --depth=1 https://github.com/tmux-plugins/tpm "${TPM_DIR}"
    echo "post-create: tpm installed"
fi

# tpm の install_plugins は tmux サーバが必要なため使えない。
# tmux.conf に列挙したプラグインを直接 git clone する。
# プラグインを追加したときはここも合わせて更新すること。
if [[ ! -d "${PLUGINS_DIR}/tmux-sensible" ]]; then
    echo "post-create: installing tmux-sensible..."
    git clone --depth=1 https://github.com/tmux-plugins/tmux-sensible "${PLUGINS_DIR}/tmux-sensible"
    echo "post-create: tmux-sensible installed"
fi

# ----- SSH ログイン時の tmux 自動アタッチ -----
# SSH_TTY が set されている（対話ログイン）ときだけ tmux に入る。
# `devpod ssh -- command` のような非対話実行には干渉しない。
BASH_PROFILE="${HOME}/.bash_profile"
TMUX_AUTO_ATTACH='
# Auto-attach to tmux on interactive SSH login (devpod devcontainer)
if [[ -z "${TMUX:-}" ]] && command -v tmux &>/dev/null && [[ -n "${SSH_TTY:-}" ]]; then
    exec tmux new-session -A -s work
fi'

if ! grep -q 'tmux new-session' "${BASH_PROFILE}" 2>/dev/null; then
    echo "${TMUX_AUTO_ATTACH}" >> "${BASH_PROFILE}"
    echo "post-create: tmux auto-attach configured in ${BASH_PROFILE}"
fi

# ----- git / worktree セットアップ -----
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo "")

if [[ -z "${GIT_COMMON_DIR}" ]]; then
    echo "post-create: not a git repository, skipping setup"
    exit 0
fi

GIT_COMMON_ABS=$(cd "${GIT_COMMON_DIR}" && pwd)
GIT_DIR_ABS=$(cd "${GIT_DIR}" && pwd)

if [[ "${GIT_COMMON_ABS}" == "${GIT_DIR_ABS}" ]]; then
    echo "post-create: main checkout detected, no worktree setup needed"
    exit 0
fi

echo "post-create: worktree detected, running bin/setup-worktree"
exec bin/setup-worktree
