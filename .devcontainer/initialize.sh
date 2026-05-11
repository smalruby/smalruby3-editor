#!/usr/bin/env bash
# .devcontainer/initialize.sh
#
# Runs on the host before the devcontainer starts (devcontainer.json の
# initializeCommand から呼ばれる)。macOS の `gh` は PAT を keychain に
# 保存するため、~/.config/gh/hosts.yml を bind mount しただけでは
# コンテナ内 `gh` から認証できない。ホスト側で `gh auth token` を実行して
# 取得し、環境変数 GH_TOKEN として export することで、devcontainer.json の
# remoteEnv 経由でコンテナに渡す。
#
# 注意: このスクリプトは export を親プロセス (devcontainer CLI / VS Code) に
# 反映できない。実際は devcontainer.json の `${localEnv:GH_TOKEN}` を
# 解釈するのは devcontainer ツール側なので、利用者は事前に手元で
#   export GH_TOKEN=$(gh auth token)
# しておく必要がある。本スクリプトは GH_TOKEN が未設定だった場合に
# 警告を出し、ユーザーに手順を案内する。

set -euo pipefail

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

exit 0
