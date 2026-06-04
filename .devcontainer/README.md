# .devcontainer

Claude Code をホスト直接実行せず、隔離されたコンテナ内で動かすための devcontainer 設定です。

## 設計方針

- **Dockerfile-only**: 既存 `Dockerfile` を直接ビルドする構成。`docker-compose` は使わない (devpod との相性問題を回避するため)。
- **既存 `docker compose` ワークフローには影響なし**: `docker compose up app` / `docker compose run --rm app ...` / `bin/dx` は従来通り使える。devcontainer はそれと**別の経路**で動く。
- **named volume を共有**: `docker compose run app npm install` で作った `node_modules` を devcontainer も使う。`bin/dx` の起動高速化メリットと同じ。git worktree 切替時も再インストール不要。
- **個人別設定はテンプレート方式**: `.devcontainer/devcontainer.json` は `.gitignore` 対象。`devcontainer.json.example` をコピーして自分の mount を編集する。

## 利用者の前提

このディレクトリの devcontainer は **devpod / VS Code Dev Containers で開発したい人** 向けです。`docker compose run --rm app ...` で十分な人は無視して構いません。

## 初回セットアップ

### 1. テンプレートから自分の `devcontainer.json` を作る

```bash
cp .devcontainer/devcontainer.json.example .devcontainer/devcontainer.json
```

`.devcontainer/devcontainer.json` は `.gitignore` 対象なので、個人の編集は他開発者に共有されません。

### 2. 必要に応じて mounts を編集

`devcontainer.json` の `mounts` セクションの末尾にある **個人マウント** がコメントアウト状態で入っています:

- `~/ghq` (関連 OSS の参照)
- `~/.claude.json`, `~/.claude/skills`, `~/.claude/plugins`, etc. (Claude Code 設定)

使うものだけアンコメントする。

### 3. macOS: GH_TOKEN を export

macOS の `gh` は PAT を Keychain に保存するため、`~/.config/gh` を bind mount しても
`oauth_token` がコンテナに渡らない。devcontainer 起動前にホスト側のシェルで以下を実行:

```bash
export GH_TOKEN=$(gh auth token)
```

`initialize.sh` が `GH_TOKEN` 未設定なら警告を出します。

## 起動方法

### VS Code Dev Containers

```bash
export GH_TOKEN=$(gh auth token)   # 必須 (上述)
code /path/to/smalruby3-editor
```

VS Code 側で `Cmd+Shift+P` → **Dev Containers: Reopen in Container**。

### devpod (CLI)

```bash
# 初回のみ
brew install devpod
devpod provider add docker

# 起動
export GH_TOKEN=$(gh auth token)   # 必須
cd /path/to/smalruby3-editor
devpod up . --ide none             # or --ide vscode

# シェルに入る
devpod ssh smalruby3-editor

# 停止
devpod stop smalruby3-editor

# 完全削除
devpod delete smalruby3-editor
```

## コンテナ作成後の自動セットアップ (post-create.sh)

`postCreateCommand` で `post-create.sh` がコンテナ内で実行され、以下を行う:

1. **tmux セットアップ**: `tmux.conf` を `~/.tmux.conf` にインストールし、tpm
   (TMUX Plugin Manager) とプラグイン (tmux-sensible) を git clone する
2. **SSH ログイン時の tmux 自動アタッチ**: `~/.bash_profile` に追記。対話的な
   `devpod ssh` で自動的に `work` セッションへ入る (`tmux new-session -A -s work`)。
   `devpod ssh -- command` のような非対話実行には干渉しない
3. **git クレデンシャル設定**: ホストの `~/.gitconfig` は読み取り専用マウントの
   ため `gh auth setup-git` (global 書き込み) は使えない。代わりに repo-local
   設定で `gh auth git-credential` をクレデンシャルヘルパーに指定し、`git push`
   と `gh` (issue/PR) を同一の `GH_TOKEN` に一本化する
4. **worktree セットアップ**: git worktree であれば `bin/setup-worktree` を実行
   (env コピー + npm install + build:dev)。main checkout なら何もしない

## tmux

### 設定の構成

| ファイル | 役割 |
|---|---|
| `tmux.conf` | tmux 設定本体。`post-create.sh` が `~/.tmux.conf` にインストール |
| `osc52.sh` | コピーモードの選択テキストを OSC 52 (DCS パススルー) でホスト端末のクリップボードへ送るスクリプト |

主な設定: prefix は `C-z`、`mode-keys emacs`、マウスモード ON (`prefix m` でトグル)。

### クリップボード連携 (OSC 52)

コンテナ内には pbcopy/xclip がないため、SSH 越しに **OSC 52** でホスト端末の
クリップボードへコピーする。**ホスト側ターミナルは iTerm2 必須**
(macOS 標準 Terminal.app は OSC 52 非対応)。初回のみ iTerm2 で以下を有効にする:

```
iTerm2 > Preferences > General > Selection >
    ☑ Applications in terminal may access clipboard
```

### コピーモードのキー操作

| キー | 動作 |
|---|---|
| `C-Space` | 選択開始 |
| `y` / `M-w` | 選択をコピーしてコピーモード終了 (`osc52.sh` 経由でホストのクリップボードへ) |
| `C-w` | 同上 (tmux デフォルト。`set-clipboard on` 経由) |
| マウスドラッグを離す | 選択を自動コピーしてコピーモード終了 (`osc52.sh` 経由) |

注意: tmux の emacs コピーモードのキーテーブル名は `copy-mode`
(`copy-mode-emacs` というテーブルは存在しない。vi のみ `copy-mode-vi`)。

### tmux.conf を更新したとき

`post-create.sh` は **既存の `~/.tmux.conf` を上書きしない**。リポジトリ側の
`tmux.conf` が更新された場合、既存コンテナでは手動で反映する:

```bash
cp /app/.devcontainer/tmux.conf ~/.tmux.conf
tmux source-file ~/.tmux.conf   # または prefix r
```

## マウント解説

### 全員共通 (テンプレートに有効状態で含まれる)

| ホスト側 | コンテナ内 | 用途 |
|---|---|---|
| repo root | `/app` | 作業ディレクトリ |
| `~/.gitconfig` | `/root/.gitconfig` (ro) | git ユーザー情報 |
| `~/.config/gh` | `/root/.config/gh` | gh CLI 設定 |
| named volume `smalruby3-editor_smalruby3-editor_node_modules` | `/app/node_modules` | compose と共有 |
| named volume `smalruby3-editor_smalruby3-editor_root_npm` | `/root/.npm` | npm cache 共有 |
| named volume `smalruby3-editor_smalruby3-editor_root_cache` | `/root/.cache` | 各種 cache 共有 |

### 個人 (テンプレートにコメントアウトで含まれる)

| ホスト側 | コンテナ内 | 用途 |
|---|---|---|
| `~/ghq` | `/ghq` | 関連 OSS の参照・push |
| `~/.claude/settings.json` | 同上 (ro) | Claude Code グローバル設定 (host で編集、container は読むだけ) |
| `~/.claude/skills` | 同上 (ro) | 自作 skills |
| `~/.claude/plugins` | 同上 (ro) | プラグイン |
| `~/.claude/statusline-command.sh` | 同上 (ro) | カスタム statusline |
| `~/.claude/projects/-app` | `/root/.claude/projects/-app` (rw) | このプロジェクト固有 memory (host と共有) |

### Claude Code 認証は **マウントしない** (重要)

`~/.claude.json` は host のものを意図的に共有しない。理由:

- container 内 Claude が auto-update すると host の version 表記を書き換える (host
  側 Claude との不整合発生源になる)
- host secrets / API tokens を container に持ち込まないという Anthropic 公式の
  原則とも整合する

代わりに container 内では **初回 `claude` 起動時にログインを行う**。container fs に
保存された auth は `devpod stop` / `devpod up` を跨いで永続。`devpod delete` または
devcontainer rebuild で消えるが、再ログインは数十秒で済む。

加えて **`DISABLE_AUTOUPDATER=1`** を `containerEnv` に設定済み。container 内
Claude は自動アップデートしない。version 固定は IDE 側で features が install する
最新版を build 時に決め打ちする扱い。

**マウントしないもの (全員)**: `~/.ssh`, `~/.aws`, `~/Documents`, `~/Downloads`,
`~/Desktop`, `~/Library`, 他案件ディレクトリ、**`~/.claude/projects/`,
`~/.claude/sessions/`, `~/.claude/history.jsonl`, `~/.claude/file-history/`,
`~/.claude/shell-snapshots/`** (他プロジェクトの転写・履歴の漏れを防ぐ)。

### Claude Code memory の共有メカニズム

このプロジェクトの memory (`~/.claude/projects/<host slug>/memory/`) はホスト側スラッグがユーザーのパスに依存するため、`initialize.sh` がホスト側に
**`~/.claude/projects/-app` → `~/.claude/projects/<host slug>`** のシンボリックリンクを作成する。コンテナ内では workspace=`/app` のため slug=`-app` で固定され、リンク経由で同じ memory を読み書きできる。他のマシンや他の worktree に切り替えても、`initialize.sh` がそのときの host slug にリンクを張り直す。

## なぜ docker-compose を使わないか

過去のリビジョンでは `dockerComposeFile` 形式で `app` サービスを共有していたが、以下の問題があり Dockerfile-only に移行した:

1. **devpod での features 失敗**: `dockerComposeFile` + `features` の組み合わせで devpod が Dockerfile-with-features の build context を壊し、`COPY entrypoint.sh` が "not found" で失敗
2. **port 衝突**: 通常 `docker compose up app` と devcontainer 用 compose が同時に host port 8601 を取り合い、後発の network attach が失敗 → DNS 孤立
3. **個人別の override 困難**: compose の override 構文 (`docker-compose.local.yml`) は便利だが、devcontainer.json 自体の個人別カスタマイズには使えない

Dockerfile-only にすることで:
- devpod でも features (claude-code, github-cli) がそのまま動く
- 通常 compose とは独立した volume / network のため衝突が起きない (named volume だけは共有して deps を再利用)
- `.devcontainer/devcontainer.json` 自体を `.gitignore` 対象にして個人別に編集できる

通常開発で `docker compose` を使い続けたい人は、本ディレクトリを無視して従来通り `docker compose run --rm app ...` 等を使えば良い。

## AWS CDK deploy について

`~/.aws` は **マウントしません**。`cdk deploy` は人間が diff を見て発動する操作なので、
**ホスト側で実行** することを推奨します。コンテナ内では `cdk synth` / `cdk diff` まで (AWS 認証不要)。

## トラブルシューティング

- **gh auth が効かない**: macOS では PAT が keychain に格納されるため、`export GH_TOKEN=$(gh auth token)` を実行してから devcontainer を起動する
- **`/ghq` が空 or マウントエラー**: `devcontainer.json` の `mounts` で ghq 行をアンコメントしているか確認。`ghq root` が `~/ghq` 以外を指している場合は source パスを書き換える
- **node_modules が共有されない**: `docker compose run --rm app npm install` を一度実行して named volume を作ってから devcontainer を起動する
- **`devcontainer.json` が無いと言われる**: `.example` からコピーする (上記「初回セットアップ」を参照)
- **コピーモードの `y` でホストのクリップボードに届かない**: iTerm2 の
  "Applications in terminal may access clipboard" が ON か確認 (上記「tmux」を参照)。
  また `~/.tmux.conf` が古い可能性があるので `cp /app/.devcontainer/tmux.conf ~/.tmux.conf && tmux source-file ~/.tmux.conf` で更新する
- **`M-w` が効かない**: iTerm2 の Profiles > Keys > General > **Left Option key を
  「Esc+」** にすると Option+w が Meta-w として送信される (`y` で代用可能)
