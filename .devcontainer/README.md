# .devcontainer

Claude Code をホスト直接実行せず、隔離されたコンテナ内で動かすための devcontainer 設定です。

## 設計方針

- **Dockerfile-only**: 既存 `Dockerfile` を直接ビルドする構成。`docker-compose` は使わない (devpod との相性問題を回避するため)。
- **既存 `docker compose` ワークフローには影響なし**: `docker compose up app` / `docker compose run --rm app ...` / `bin/dx` は従来通り使える。devcontainer はそれと**別の経路**で動く。
- **named volume を共有**: `docker compose run app npm install` で作った `node_modules` を devcontainer も使う。`bin/dx` の起動高速化メリットと同じ。git worktree 切替時も再インストール不要。
- **個人別設定はテンプレート方式**: `.devcontainer/devcontainer.json` は `.gitignore` 対象。`devcontainer.json.example` をコピーして自分の mount を編集する。
- **egress allowlist firewall**: コンテナの外向き通信を default-DROP にし、GitHub / npm / Anthropic / AWS など必要な宛先だけ許可する (`init-firewall.sh`)。AWS SSO の一時クレデンシャルや in-container Claude ログインなど非公開認証情報がコンテナに到達するため、隔離ガイドラインに沿って到達先を限定する。詳細は下記「egress allowlist firewall」。

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

## egress allowlist firewall

コンテナの外向き通信を **default-DROP** にし、必要な宛先のみ許可する firewall を
`postStartCommand` で**毎起動時**に張る (`init-firewall.sh`)。iptables ルールは
コンテナの network namespace に属し `devpod stop`/`up` で消えるため、起動のたびに
張り直す必要がある。

### なぜ必要か

このコンテナは **非公開認証情報** を保持する:

- `cdk deploy` 用の AWS SSO 一時クレデンシャル (in-container で `aws sso login`)
- in-container でログインする Claude Code の認証

NaCl の隔離ガイドラインでは「非公開認証情報が到達する隔離環境は egress を allowlist で
限定する」ことが必須要件。よって本 devcontainer では firewall を**既定で有効**にしている。

### 許可している宛先

| 区分 | 宛先 | 用途 |
|---|---|---|
| GitHub | `api.github.com/meta` の公開レンジ (web/api/git) | git / gh / upstream fetch / 一部 npm 依存 |
| npm | `registry.npmjs.org`, `objects.githubusercontent.com`, `codeload.github.com`, `nodejs.org` | `npm install` とバイナリ取得 |
| Anthropic | `api.anthropic.com`, `sentry.io` | Claude Code |
| AWS | `ip-ranges.json` のうち **デプロイリージョン + us-east-1 + GLOBAL**、加えて SSO 系 (`oidc/portal.sso/sso.<region>.amazonaws.com`, SSO ポータル) | `cdk deploy` / `aws sso login` |
| DNS | `/etc/resolv.conf` のリゾルバ + docker DNS (127.0.0.11) の 53 番のみ | 名前解決 (任意 DNS への exfil を遮断) |

- AWS のリージョンと SSO ポータルは **`infra/aws-sso.env`** から自動取得する
  (fork 時はそのファイルだけ書き換えれば firewall も追従)。
- IPv4 allowlist のみ。**IPv6 は egress を全遮断**する (allowlist を IPv4 で組むため、
  IPv6 を開けると素通りの抜け道になる)。
- **fail-closed**: allowlist の構築に一部失敗しても、最後の DROP は必ず適用される。

### 重要な性質 (ハマりポイント)

- **ビルド時 (Dockerfile / 最初の `postCreate`) の取得は firewall より前**に走るので
  影響を受けない。影響するのは **コンテナ起動後**の `npm install` / `cdk` / `git fetch` など。
- 取りこぼすと「npm install が固まる」「cdk deploy が失敗」になる。**段階的に
  allowlist を広げる**運用が現実的。
- `forwardPorts` (dev server の `localhost:8601` 転送) は firewall と無関係。

### 許可先を追加する

詰まったら、弾かれた宛先を `curl -v <url>` で特定して以下のいずれかに足す:

1. **全員に効かせる**: `init-firewall.sh` の `EXTRA_HOSTS`(dig 解決する小規模サービス)
   か、GitHub/AWS のようにレンジで取り込む箇所を編集する。
2. **自分だけ一時的に**: `.devcontainer/firewall-allow.local` (gitignored) に
   ホスト名か CIDR を 1 行ずつ書く (`#` でコメント可)。再起動 or `init-firewall.sh`
   再実行で反映。

```text
# .devcontainer/firewall-allow.local の例
example.internal.service.com
203.0.113.0/24
```

### 検証

起動ログ末尾に以下が出れば成功:

```
init-firewall: applied. allowlist entries: <N>
init-firewall: verify OK: github reachable
init-firewall: verify OK: example.com blocked
```

手動で張り直す / 状態を見るには (コンテナ内、root):

```bash
.devcontainer/init-firewall.sh          # 張り直す
ipset list allowed-dst | head           # 許可宛先を確認
iptables -L OUTPUT -n --line-numbers    # ルールを確認
```

### 既存コンテナへの反映 / 一時無効化

- `.example` から作った**自分の `devcontainer.json`** に `runArgs` と
  `postStartCommand` を追記する必要がある (テンプレ更新前に作った人は手で足す)。
  `runArgs` を足したら devcontainer を rebuild (`devpod delete` → `devpod up`)。
- 一時的に切りたいときは `devcontainer.json` の `postStartCommand` 行をコメントアウト
  (非推奨)。次回起動から firewall 無しになる。

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
| `~/.config/smalruby-bot` | 同上 (ro) | GitHub App bot 設定 (非秘密)。rebuild/delete を跨いで永続させる。詳細は下記 |
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

### 原則: ホストの認証ディレクトリを rw でマウントしない

新たに何かの認証をコンテナに持ち込むときは、必ず次を守る:

- **ホストの認証ディレクトリを rw bind マウントしない。** 特に「壊れた / 復号できない
  認証ファイルを自動削除・再生成する」タイプのツールは危険。コンテナ側の環境 (鍵が
  無い等) で認証を「壊れている」と誤判定して削除すると、rw 共有では **ホスト側の認証
  ファイルまで巻き添えで消える** (別案件で実際に発生し、ホストの認証が切れた)。
- 認証は **コンテナ内で取得 (in-container login)** し、**コンテナ専用の fs / volume** に
  置いてホストと分離する。
- 本 devcontainer はこの原則に沿っている: Claude 認証は in-container ログイン、AWS は
  in-container SSO ログイン、`~/.gitconfig` は **read-only**、gh は `GH_TOKEN` env のみ
  (`~/.config/gh` には PAT 本体を含めない)。

### GitHub App bot 設定を rebuild を跨いで永続させる

autopilot や bot 名義コミット (`bin/bot-git` / `bin/bot-token`) が使う
`~/.config/smalruby-bot/` は、何もしないと **コンテナ fs 上** に置かれ、
devcontainer rebuild / `devpod delete` で消える (毎回作り直しになる)。

永続させたい場合は、**秘密鍵を AWS Secrets Manager に逃がした上で**、非秘密の
`config` だけを host から **read-only** bind マウントする (上記「個人マウント」)。

1. **秘密鍵を Secrets Manager 化する**: `~/.config/smalruby-bot/config` に
   `PRIVATE_KEY_SECRET_ID=<secret-id>` (+ 必要なら `AWS_PROFILE` / `AWS_REGION`) を
   設定する。`bin/bot-token` はこれがあれば AWS から鍵を取得し、ローカル
   `private-key.pem` は不要になる (手順は `.claude/rules/github-app-bot.md` /
   `docs/github-app-bot/README.md`)。
2. **config を host に置く**: `~/.config/smalruby-bot/config` を **host 側** に用意する
   (中身は APP_ID / INSTALLATION_ID / APP_SLUG / PRIVATE_KEY_SECRET_ID 等の非秘密設定)。
3. **ro マウントをアンコメント**: `devcontainer.json` の `~/.config/smalruby-bot` 行を
   有効化して rebuild する。

なぜ **read-only** か: `bin/bot-token` はこのディレクトリを **読むだけ**
(発行済み token のキャッシュは `~/.cache/smalruby-bot/` = 別の named volume 側で、
これは rebuild を跨いで残る)。ro にすることで、コンテナ側の誤動作で host の設定を
消す事故を防ぐ (上記「rw でマウントしない」原則の適用)。生の `.pem` は host にも
マウントにも載せないので、共有されるのは非秘密の識別子だけになる。

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

**ホストの `~/.aws` は mount しません** (host secrets をコンテナに持ち込まない原則)。
コンテナ内で deploy する場合は、in-container で SSO ログインして一時クレデンシャルを
取得する:

```bash
bin/setup-aws-sso                                       # ~/.aws/config を生成
aws sso login --sso-session smalruby --use-device-code  # URL をホストのブラウザで承認
export AWS_PROFILE=smalruby
cdk diff && cdk deploy
```

egress firewall は `infra/aws-sso.env` のリージョンと SSO ポータルを allowlist に
取り込むため、in-container での `aws sso login` / `cdk deploy` は通る。詰まる宛先が
あれば「egress allowlist firewall」の手順で追加する。`cdk synth` / `cdk diff` は AWS
認証不要なので firewall とも無関係に動く。ホスト側で deploy しても構わない。

> 取得した一時クレデンシャル (`~/.aws/sso/cache`) はコンテナ fs に残り、ホストとは
> 分離される。短命トークンなので volume 永続化は不要 (`devpod delete` で消えてよい)。

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
