# .devcontainer

Claude Code をホスト直接実行せず、隔離されたコンテナ内で動かすための devcontainer 設定です。
NaCl Claude Code 利用ガイドライン **階層 B（OSS / 自社開発）** に準拠します。

## 設計方針

- **既存の `docker-compose.yml` の `app` サービスを再利用** する。`docker-compose.devcontainer.yml` で mount のみ追加する override 構成
- ホスト全体ではなく、**作業に必要なディレクトリのみ** をマウントする（物理アクセス範囲の制限）
- 既存の `bin/dx` / `bin/setup-worktree` / git worktree 運用と共存する
- VS Code Dev Containers と devpod の両方で動作する標準準拠
- **devcontainer features は使わず**、`gh` / `claude` のインストールは `post-create.sh` で行う (devpod の features+compose 連携バグ回避のため。後述)

## マウント構成

devcontainer のマウントは **共有用** と **個人用** を 2 つの compose ファイルに
分けている。

### `docker-compose.devcontainer.yml` (commit、全員共通)

| ホスト側 | コンテナ内 | 用途 |
|---|---|---|
| `<repo root>` | `/app` | 作業ディレクトリ（既存 compose と同じ） |
| `~/.gitconfig` | `/root/.gitconfig` (ro) | git ユーザー名・コミット署名 |
| `~/.config/gh` | `/root/.config/gh` | gh CLI 設定 |

### `docker-compose.local.yml` (`.gitignore`、各自で `*.example` からコピー)

ghq の有無、Claude Code の利用有無などはユーザーによって違うため、個人ごとに
override する。`.devcontainer/docker-compose.local.yml.example` をコピーして
自分の環境に合わせる:

```bash
cp .devcontainer/docker-compose.local.yml.example \
   .devcontainer/docker-compose.local.yml
# 不要な mount をコメントアウトして使う
```

template には以下がデフォルトで含まれる:

| ホスト側 | コンテナ内 | 用途 |
|---|---|---|
| `~/ghq` | `/ghq` | 関連 OSS の参照・push (使わない人はコメントアウト) |
| `~/.claude.json` | `/root/.claude.json` | Claude Code 認証 |
| `~/.claude/settings.json` | 同上 (ro) | Claude Code グローバル設定 |
| `~/.claude/skills` | 同上 (ro) | 自作 skills |
| `~/.claude/plugins` | 同上 (ro) | プラグイン |
| `~/.claude/statusline-command.sh` | 同上 (ro) | カスタム statusline |
| `~/.claude/projects/-app` | `/root/.claude/projects/-app` | このプロジェクト固有 memory |

`docker-compose.local.yml` が無い場合は `initialize.sh` が空の stub を自動生成
するので、Claude Code を使わない・ghq を使わない人は何もせずそのまま動作する。

**マウントしないもの (全員)**: `~/.ssh`, `~/.aws`, `~/Documents`, `~/Downloads`,
`~/Desktop`, `~/Library`, 他案件ディレクトリ、**`~/.claude/projects/`,
`~/.claude/sessions/`, `~/.claude/history.jsonl`, `~/.claude/file-history/`,
`~/.claude/shell-snapshots/`** (他プロジェクトの転写・履歴の漏れを防ぐ)。

### Claude Code の認証・設定・memory 共有について

`~/.claude` のうち、共有して安全なもの（グローバル設定・自作 skills・認証）だけを bind mount し、**他プロジェクトの transcripts や履歴は意図的に隔離** する設計。

このプロジェクトのメモリ (`~/.claude/projects/<host slug>/memory/`) はホスト側スラッグがユーザーのパスに依存するため、`initialize.sh` がホスト側に **`~/.claude/projects/-app` → `~/.claude/projects/<host slug>`** のシンボリックリンクを作成する。コンテナ内では workspace=`/app` のため slug=`-app` で固定され、リンク経由で同じ memory を読み書きできる。他のマシンや他の worktree に切り替えても、`initialize.sh` がそのときの host slug にリンクを張り直す。

### gh CLI の認証トークンについて (macOS 必須手順)

macOS の `gh` は PAT を **Keychain** に保存するため、`~/.config/gh` を
bind mount しても `oauth_token` がコンテナに渡らない。devcontainer 起動前に
ホスト側のシェルで以下を実行して `GH_TOKEN` 環境変数として注入する:

```bash
export GH_TOKEN=$(gh auth token)
```

devcontainer.json の `remoteEnv.GH_TOKEN: "${localEnv:GH_TOKEN}"` 経由で
コンテナ内 `gh` が PAT を読み取れるようになる。未設定で devcontainer を
起動した場合、`initialize.sh` が警告を出す (devcontainer 自体は起動する)。

## 起動方法

### VS Code Dev Containers

1. VS Code に「Dev Containers」拡張をインストール
2. リポジトリを VS Code で開く
3. コマンドパレットから **Dev Containers: Reopen in Container**

### devpod (CLI)

```bash
# 初回のみ
brew install devpod
devpod provider add docker

# 起動
cd <repo root>
devpod up .

# Claude Code をコンテナ内で起動
devpod ssh smalruby3-editor -- claude

# 停止
devpod stop smalruby3-editor
```

### docker compose 直接 (CLI only)

```bash
# devcontainer のオーバーレイを適用して起動
docker compose -f docker-compose.yml -f .devcontainer/docker-compose.devcontainer.yml up -d app

# コンテナに入る
docker compose -f docker-compose.yml -f .devcontainer/docker-compose.devcontainer.yml exec app bash
```

## 既存ワークフローへの影響

| 既存仕組み | 影響 |
|---|---|
| `docker compose run --rm app ...` | 変更なし。devcontainer を立てなくても従来通り動く |
| `bin/dx` | 変更なし（devcontainer 内では二重 docker を避けるラッパーを後続フェーズで検討） |
| `bin/setup-worktree` | `.devcontainer/post-create.sh` 経由で **worktree のときだけ** 実行（main checkout では skip） |
| git worktree | compose の `name: smalruby3-editor` 固定で named volume を共有 |

## AWS CDK deploy について

`~/.aws` はマウントしません。`cdk deploy` は人間が diff を見て発動する操作なので、
**ホスト側で実行** することを推奨します。コンテナ内では `cdk synth` / `cdk diff` まで（AWS 認証不要）。

必要時のみ短命 STS token を環境変数で注入する運用も可能（要検討）。

## トラブルシューティング

- **gh auth が効かない**: macOS では PAT が keychain に格納されるため、`export GH_TOKEN=$(gh auth token)` を実行してから devcontainer を起動する (上記「gh CLI の認証トークンについて」参照)
- **`/ghq` が空**: `ghq root` の出力が `~/ghq` 以外を指していないか確認
- **ポート 8601 が見えない**: VS Code は `forwardPorts` で自動転送。devpod / 直接 compose では `docker-compose.yml` の `ports` 設定で `localhost:8601` に公開される

## なぜ devcontainer features を使わないか

devcontainer.json の `features` (例: `ghcr.io/anthropics/devcontainer-features/claude-code`,
`ghcr.io/devcontainers/features/github-cli`) は、内部的に既存 Dockerfile を
**`Dockerfile-with-features` というラッパー** に書き換えてビルドする。

`dockerComposeFile` 形式の devcontainer の場合、devpod はこのラッパービルド時に
**build context を破壊する**ことが分かった (本プロジェクトでの事例:
`COPY entrypoint.sh /app/entrypoint.sh` が "/entrypoint.sh: not found" で失敗)。
VS Code Dev Containers では同じ設定で動作するため、devpod 固有の挙動と思われる。

回避策として、features は使わず、`post-create.sh` で同等のインストールを行う:

- `gh` CLI: apt 経由 (公式リポジトリの GPG キー登録 → install)
- `claude` (Claude Code): `npm install -g @anthropic-ai/claude-code`

これにより VS Code でも devpod でも同じ手順で動作する。`postCreateCommand` は
コンテナ作成ごとに 1 回走るが、`gh` / `claude` が既にあれば再インストールしない。
