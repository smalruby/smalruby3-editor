#!/usr/bin/env bash
# .devcontainer/post-create.sh
#
# Runs inside the container after creation (devcontainer.json の
# postCreateCommand から呼ばれる)。
#
# - worktree であれば bin/setup-worktree を実行 (env コピー + npm install + build:dev)
# - main checkout であれば既存の node_modules / dist / .env がそのままあるので
#   何もしない (husky hooks も既にインストール済みのはず)

set -euo pipefail

cd /app

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
