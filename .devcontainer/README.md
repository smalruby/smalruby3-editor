# .devcontainer

Claude Code をホスト直接実行せず、隔離されたコンテナ内で動かすための devcontainer 設定です。
NaCl Claude Code 利用ガイドライン **階層 B（OSS / 自社開発）** に準拠します。

## 設計方針

- **既存の `docker-compose.yml` の `app` サービスを再利用** する。`docker-compose.devcontainer.yml` で mount のみ追加する override 構成
- ホスト全体ではなく、**作業に必要なディレクトリのみ** をマウントする（物理アクセス範囲の制限）
- 既存の `bin/dx` / `bin/setup-worktree` / git worktree 運用と共存する
- VS Code Dev Containers と devpod の両方で動作する標準準拠

## マウント一覧

| ホスト側 | コンテナ内 | 用途 |
|---|---|---|
| `<repo root>` | `/app` | 作業ディレクトリ（既存 compose と同じ） |
| `~/ghq` | `/ghq` | submodule の origin/upstream、関連 OSS の参照・push |
| `~/.gitconfig` | `/root/.gitconfig` (ro) | git ユーザー名・コミット署名 |
| `~/.config/gh` | `/root/.config/gh` | gh CLI の設定 (ホスト名・ユーザー名) |

**マウントしないもの**: `~/.ssh`, `~/.aws`, `~/Documents`, `~/Downloads`, `~/Desktop`, `~/Library`, 他案件ディレクトリ。

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
| `bin/setup-worktree` | `postCreateCommand` で自動実行（`|| true` で初回失敗を許容） |
| git worktree | compose の `name: smalruby3-editor` 固定で named volume を共有 |

## AWS CDK deploy について

`~/.aws` はマウントしません。`cdk deploy` は人間が diff を見て発動する操作なので、
**ホスト側で実行** することを推奨します。コンテナ内では `cdk synth` / `cdk diff` まで（AWS 認証不要）。

必要時のみ短命 STS token を環境変数で注入する運用も可能（要検討）。

## トラブルシューティング

- **gh auth が効かない**: macOS では PAT が keychain に格納されるため、`export GH_TOKEN=$(gh auth token)` を実行してから devcontainer を起動する (上記「gh CLI の認証トークンについて」参照)
- **`/ghq` が空**: `ghq root` の出力が `~/ghq` 以外を指していないか確認
- **ポート 8601 が見えない**: VS Code は `forwardPorts` で自動転送。devpod / 直接 compose では `docker-compose.yml` の `ports` 設定で `localhost:8601` に公開される
