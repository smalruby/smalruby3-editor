#!/usr/bin/env bash
# .devcontainer/post-create.sh
#
# Runs inside the container after creation (devcontainer.json の
# postCreateCommand から呼ばれる)。
#
# 役割:
#   1. gh CLI と Claude Code をインストール
#      (devcontainer features は devpod + docker-compose で build context を
#       壊すバグがあるため、postCreate で代替する)
#   2. worktree であれば bin/setup-worktree を実行 (env コピー + npm install + build:dev)
#   3. main checkout であれば追加 setup なし
#
# tools のインストールが含まれるため、main checkout でも post-create.sh は
# 早期 exit せず常に実行する。

set -euo pipefail

cd /app

# --- 1) gh CLI のインストール (Debian bookworm) ---
if ! command -v gh >/dev/null 2>&1; then
    echo "post-create: installing gh CLI..."
    type -p curl >/dev/null || apt-get update -qq && apt-get install -y --no-install-recommends -qq curl ca-certificates
    install -dm 0755 /etc/apt/keyrings
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list >/dev/null
    apt-get update -qq
    apt-get install -y --no-install-recommends -qq gh
    rm -rf /var/lib/apt/lists/*
    echo "post-create: gh CLI installed: $(gh --version | head -1)"
else
    echo "post-create: gh CLI already installed: $(gh --version | head -1)"
fi

# --- 2) Claude Code のインストール (npm 経由) ---
if ! command -v claude >/dev/null 2>&1; then
    echo "post-create: installing Claude Code..."
    npm install -g @anthropic-ai/claude-code 2>&1 | tail -3
    echo "post-create: Claude Code installed: $(claude --version 2>&1 | head -1)"
else
    echo "post-create: Claude Code already installed: $(claude --version 2>&1 | head -1)"
fi

# --- 3) worktree のときだけ bin/setup-worktree ---
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo "")

if [[ -z "${GIT_COMMON_DIR}" ]]; then
    echo "post-create: not a git repository, skipping worktree setup"
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
