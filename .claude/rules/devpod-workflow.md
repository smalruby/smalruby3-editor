# devpod-based Development Workflow

`/Users/kouji/work/smalruby/smalruby3-editor` の開発は **devpod 経由で devcontainer 内で行う** ことを基本とする。社内ガイドライン (NaCl Claude Code 利用ガイドライン v0.2) の階層 B 要件 (隔離環境推奨) に準拠するためで、Claude Code をホスト直接実行しない。

## 前提と全体像

| 観点 | 値 |
|---|---|
| 主用途 | devcontainer の中で開発 (Claude Code, npm, git すべて中で完結) |
| エディタ | devpod ssh + tmux (VS Code Dev Containers でも可) |
| **ホスト側ターミナル** | **iTerm2 必須**（macOS 標準 Terminal.app は OSC 52 非対応のためクリップボード連携不可） |
| host から見える環境 | ブラウザ (port forwarding 経由)、git の push/PR (gh CLI 経由)、CDK deploy |
| **通信 (egress)** | **無制限ではなく allowlist**。default-DROP の firewall で GitHub / npm / Anthropic / AWS のみ許可 (`init-firewall.sh`)。詳細は「egress allowlist firewall」 |
| 採用していないもの | `docker compose run --rm app ...`, `bin/dx`, `bin/setup-worktree` (compose 前提なので不要) |
| 例外的に host で必要 | `docker compose` 自体は dev server を host から開きたい人のために残してあるが、本人は使わない |

### iTerm2 のクリップボード設定（初回のみ）

```
iTerm2 > Preferences > General > Selection >
    ☑ Applications in terminal may access clipboard
```

これを有効にしないと tmux コピーがホストのクリップボードに届かない。

### git の push 認証 (自動設定)

コンテナ内の `git push` は **gh のクレデンシャルヘルパー経由**で認証する。`post-create.sh` が
`git config --local credential.https://github.com.helper '!gh auth git-credential'` を設定するため、
通常どおり `git push origin <branch>` で push できる（URL へのトークン埋め込み不要）。

- ホストの `~/.gitconfig` は読み取り専用バインドマウント (`fakeowner ro`) なので
  `gh auth setup-git`（global 書き込み）は使えない → repo-local 設定で回避している。
- git push も `gh` の issue/PR 作成も同一の `GH_TOKEN` に一本化される。
- `gh auth status` で `Logged in ... (GH_TOKEN)` を確認できれば push も通る。

## egress allowlist firewall (重要・セキュリティ)

このコンテナの外向き通信は **無制限ではなく allowlist** で限定する。
`init-firewall.sh` を `postStartCommand` で**毎起動時**に実行し、iptables + ipset で
**default-DROP** にして必要な宛先だけ通す。

### なぜ必要か

NaCl ガイドライン v0.2 は「隔離環境でもネットワーク接続先を限定する (firewall で
ドメイン allowlist 等)」を **必須要件** とする。本 devcontainer は業務 PC 上で動き、
かつ **AWS SSO の一時クレデンシャルをコンテナ内に取得** (`cdk deploy`) し、Claude も
in-container ログインする。つまり **非公開認証情報がコンテナに到達する** ため、
ガイドラインの考え方では firewall allowlist が必須になる。

> 要件強度は階層ラベルではなく「隔離環境が到達できる資産の機微度」で決まる。
> 顧客資産はディスク隔離で到達不能にし、非公開認証情報を持つ環境では egress を
> allowlist で限定する。

### 許可している宛先 (概要)

- **GitHub** … `api.github.com/meta` の公開レンジ (git / gh / upstream fetch / 一部 npm 依存)
- **npm** … `registry.npmjs.org` + バイナリ取得元 (`objects.githubusercontent.com` / `codeload.github.com` / `nodejs.org`)
- **Anthropic** … `api.anthropic.com`, `sentry.io` (`statsig.anthropic.com` は A レコード無しなので除外)
- **AWS** … `ip-ranges.json` の「デプロイリージョン + us-east-1 + GLOBAL」+ SSO 系。
  リージョンと SSO ポータルは **`infra/aws-sso.env`** から自動取得 (fork 追従)
- **DNS** … `/etc/resolv.conf` のリゾルバ + docker DNS のみ (任意 DNS への exfil 遮断)
- IPv6 は egress 全遮断 (allowlist は IPv4 のみ。IPv6 を開けると抜け道になる)

### 運用

- **ビルド時の取得は firewall より前**に走る。影響するのは**起動後**の
  `npm install` / `cdk` / `git fetch` など。取りこぼすと固まる/失敗するので
  **段階的に allowlist を広げる**運用が現実的。
- 詰まったら `curl -v <url>` で弾かれた宛先を特定し、`init-firewall.sh` の
  `EXTRA_HOSTS`(全員)か `.devcontainer/firewall-allow.local`(自分だけ・gitignored)に足す。
- 既存の自分の `devcontainer.json` には `runArgs` (`--cap-add=NET_ADMIN/NET_RAW`) と
  `postStartCommand` を手で追記し、devcontainer を rebuild する。
- 手順・検証・追加方法の詳細は `.devcontainer/README.md`「egress allowlist firewall」。

## 認証はホストに rw マウントしない (原則)

新しい認証をコンテナに持ち込むときは必ず守る:

- **ホストの認証ディレクトリを rw bind マウントしない。** 「壊れた / 復号できない
  認証を自動削除・再生成する」ツールは、コンテナ側で鍵が無く認証を誤って「壊れている」
  と判定し削除すると、rw 共有では **ホスト側の認証ファイルまで巻き添えで消す**
  (別案件で実際に発生した事故)。
- 認証は **in-container login** で取得し、**コンテナ専用 fs / volume** に置いて分離する。
- smalruby は既にこの原則に沿う: Claude=in-container ログイン、AWS=in-container SSO
  ログイン、`~/.gitconfig`=read-only、gh=`GH_TOKEN` env のみ。**この方針を維持する。**

## 起動からの流れ (毎日のルーチン)

### 1. 初回 / `devpod delete` 後のセットアップ

```bash
# 一度だけ: provider 登録
brew install devpod
devpod provider add docker

# 各 worktree で必要: devcontainer.json を個人用にカスタマイズ
# 詳細は .devcontainer/README.md
cp .devcontainer/devcontainer.json.example .devcontainer/devcontainer.json
# 必要なら mounts を編集 (Claude マウントの有効化など)

# または対話的に: /devcontainer-setup スキル
```

### 2. ホストシェルでの 1 行ルーチン

```bash
export GH_TOKEN=$(gh auth token)   # macOS keychain 由来。毎セッション必要
cd /Users/kouji/work/smalruby/smalruby3-editor
devpod up . --ide none             # 初回 build はかかる、以降は数秒
```

### 3. tmux で入って作業

```bash
devpod ssh smalruby3-editor
```

SSH ログイン時に `.bash_profile` の自動アタッチ設定が働き、`work` セッションに
入る（なければ新規作成）。`-- bash -lc 'tmux ...'` は TTY が割り当てられないため
tmux が起動しない。

container 内で:
```bash
cd /app
claude                              # 初回ログインが必要 (host とは分離)
npm run lint                        # そのまま動く
npm start                           # dev server をここで起動 → forwardPorts でホストに公開
```

### 4. 終了 / 一時停止

```bash
# 一時停止 (container 残す、状態保持)
devpod stop smalruby3-editor

# 完全削除 (再ログイン必要、image は残る)
devpod delete smalruby3-editor
```

## docker compose ベースの旧ワークフローとの差分

以下は **本ガイドの利用者 (devpod 主体) は基本やらない** が、他のメンバーが
compose で動かしている場合に違いを理解しておくため。

| やりたいこと | 旧 (compose) | 新 (devpod) |
|---|---|---|
| dev server 起動 | `docker compose up app` | container 内で `npm start`, host の `localhost:8601` (forwardPorts で自動転送) |
| lint 1 回 | `bin/dx bash -c "npm run lint"` | container の tmux で `npm run lint` |
| 個別 jest | `bin/dx bash -c "cd packages/scratch-gui && npm exec jest test/xxx"` | 同上、container 内で実行 |
| npm install | `docker compose run --rm app npm install` | container 内で `npm install` (named volume で host 側 compose とも共有される) |
| `docker compose run` でテスト | `docker compose run --rm app npm test` | container 内で `npm test` |
| 単独のフリー仕事 (curl 確認等) | host 上で実行 | 任意。container 内でも OK |
| Playwright MCP | host の Playwright が動く想定 | host の Playwright が container の `localhost:8601` (forwardPorts) を見る |
| CDK deploy | host の `aws-vault` 等で | **container 内で AWS IAM Identity Center (SSO) ログインして実行**。`bin/setup-aws-sso` で `~/.aws/config` を生成 → `aws sso login --sso-session smalruby --use-device-code` の URL をホストのブラウザで承認 → 一時クレデンシャルがコンテナ内にキャッシュされる (詳細: `.claude/rules/infra/development.md` の AWS Credentials)。host で実行してもよい |

### named volume の共有挙動 (重要)

`.devcontainer/devcontainer.json` は **既存 docker-compose と同じ named volume** を
マウントするため、以下が同期される:

- `/app/node_modules` ↔ compose の `smalruby3-editor_smalruby3-editor_node_modules`
- `/root/.npm` ↔ `smalruby3-editor_smalruby3-editor_root_npm`
- `/root/.cache` ↔ `smalruby3-editor_smalruby3-editor_root_cache`

これにより、devpod の container で `npm install` した結果を `docker compose run app`
でも (またはその逆でも) そのまま使える。**両方の経路を混在させても OK**。

## git worktree との組み合わせ

git worktree を作るときの挙動が **compose 時代と大きく違う** ので注意。

### compose 時代の挙動 (参考)

- `docker-compose.yml` の `name: smalruby3-editor` で project 名固定
- `docker compose run app` をどの worktree から実行しても、**同じ container を共有** (一個だけ生きている)
- container の `/app` は、container 起動時にバインドされた特定 worktree のパス
- 別 worktree の作業をするには `docker compose down && cd <他 worktree> && docker compose up`
- 結果: **同時に動かせる worktree は実質 1 つ**

### devpod 時代の挙動

- devpod の workspace ID は **host の絶対パス** から生成される (`smalruby3-editor` と `smalruby3-editor-tutorial` は別 workspace)
- worktree ごとに **別の workspace = 別の container** が立ち上がる
- 別 container でも mount 経由で **以下は共有**:
  - named volume の `node_modules` / `.npm` / `.cache` (再 install 不要)
  - bind の `~/.claude/skills` / `~/.claude/projects/-app` (skills と memory)
  - bind の `~/.gitconfig` / `~/.config/gh` / `~/ghq`
- 別 container なので **以下は per-worktree**:
  - container 内 `~/.claude.json` (Claude 認証) → **各 worktree で初回再ログインが必要**
  - container 内のシェル履歴 / tmux セッション / インストールしたアドホックなツール
  - port forwarding (後述)

### worktree を作るときの手順

```bash
# 1. host で worktree を作る (CLAUDE.md / git-workflow.md の従来手順)
git worktree add ../smalruby3-editor-<feature> -b <type>/<feature> develop
cd ../smalruby3-editor-<feature>

# 2. env ファイルを copy する (compose も devpod も両方使えるよう)
bin/sync-worktree-env

# 3. devcontainer.json を個人用にコピー (worktree 内は .gitignore 対象なので別途必要)
cp .devcontainer/devcontainer.json.example .devcontainer/devcontainer.json
# 必要なら mounts を編集

# 4. devpod 起動
export GH_TOKEN=$(gh auth token)
devpod up . --ide none

# 5. tmux で入る
devpod ssh smalruby3-editor-<feature> -- bash -lc 'tmux new -A -s work'

# 6. 初回 Claude ログイン (worktree ごとに必要)
claude
```

### `bin/setup-worktree` の扱い

`bin/setup-worktree` は **docker compose 経由で npm install + build:dev を行う**
スクリプトで、compose 利用者向けに作られている。devpod 主体ならこれは不要。

ただし named volume が空 (一度も install していない) の状態で初めて worktree を
立てるときは、最低 1 度は何らかの形で `npm install` を走らせる必要がある。
container 内で:

```bash
docker compose run app npm install   # host 上で
# or
# devpod 内で:
cd /app && npm install
```

どちらでも結果は named volume に入り、以降の worktree で再利用される。

### worktree を捨てるとき

```bash
# host で
cd /Users/kouji/work/smalruby/smalruby3-editor    # main checkout に戻る
devpod delete smalruby3-editor-<feature>           # devpod workspace を削除
git worktree remove ../smalruby3-editor-<feature>  # worktree を削除
git branch -d <type>/<feature>                     # ブランチ削除 (merge 済みなら)
```

`devpod delete` を忘れると container が残りリソースを食う。

### worktree を複数同時に走らせるときの注意

devpod では **複数 workspace が同時に container 起動可能**。これは compose と
違って **完全並列開発が可能** だが、以下の制約がある:

- **port 衝突**: 各 workspace の `forwardPorts: [8601]` が同時に host port 8601 を
  欲しがる。最初の workspace は 8601、次は 8602 など devpod が自動で別 port に
  振り分ける (`devpod list` で確認できる)
- **メモリ消費**: container 1 つあたり数百 MB〜数 GB。worktree が 5 つあれば
  全部 up しているとそれなりに重い
- **アクティブでない workspace は `devpod stop`**: 停止しても state は残るので
  すぐ再開できる
- **named volume は全 workspace で共有**: `npm install` が 1 つの workspace で
  進行中に他 workspace で並列 install すると競合する。**install は同時に走らせない**

## port forwarding と dev server

| 何を見たいか | 操作 |
|---|---|
| dev server (smalruby editor) | container 内で `npm start` → host の `localhost:8601` (devpod が自動転送) で開く |
| smalruby3-gui (VNC) | これは旧 compose の `smalruby3-gui` サービス専用。devpod ではこのサービス分は立ち上げない。VNC 確認は host から `docker compose up smalruby3-gui` で起動 (devpod と独立) |
| 自分の Playwright MCP | host の Playwright が `localhost:8601` を見るだけ |

`devpod list` で実際に forward されている port を確認できる。

## Claude Code を container 内で動かす

### 認証

- 初回起動時 `claude` でログイン (host とは分離)
- `~/.claude.json` は **container 内 fs に保存**、`devpod stop/up` を跨ぐが
  `devpod delete` で消える。3 ヶ月に 1 度くらい再ログイン覚悟

### 設定の上書き不可

- `~/.claude/settings.json` は read-only bind なので container 内では変更不能
- 変更したいときは host 側 `~/.claude/settings.json` を編集 → devcontainer 再起動

### skills, plugins

- host で開発した skills / plugins が read-only bind されて container でも使える
- container 内で skills を編集することはできない (ro)

### memory (このプロジェクト固有)

- `~/.claude/projects/-app` を bind rw で共有
- container 内 Claude が memory を書くと host 側 Claude にも反映 (双方向)

### auto-update

- `containerEnv.DISABLE_AUTOUPDATER=1` で抑止済み
- container の Claude version は features が build 時に固定したものに留まる
- バージョン更新したい時は devcontainer rebuild (`devpod delete` → `devpod up`)

## できなくなること / 制約

| 旧 (compose) | 新 (devpod 主体) | 理由 |
|---|---|---|
| `bin/dx bash -c "..."` の手軽さ | container 内で同じことを 1 コマンドで | host 上 docker run が不便なので tmux に入って実行 |
| 1 つの container で全 worktree を切替使用 | 各 worktree が独立 container | devpod の workspace 設計上 |
| host の `~/.aws` を使った CDK deploy を container 内から | **container 内で SSO ログインして deploy** (`bin/setup-aws-sso` → `aws sso login --sso-session smalruby`) | host の `~/.aws` は mount しない (secret leak 防止)。代わりに IAM Identity Center の一時クレデンシャルをコンテナ内に取得する |
| host の Claude Code 認証を共有 | container 内で別途ログイン | host secrets 持ち込み禁止原則 |
| smalruby3 (Ruby gem) の SDL2 GUI | host で動かす (X server / SDL2 が container 内に無い) | devcontainer は GUI 想定外 |
| docker compose の他サービス (`infra`, `smalruby3-gui`) との同時起動 | devpod は `app` 相当のみ。他サービスは host から `docker compose up <service>` | devcontainer は単一サービス |

## トラブルシューティング

### `gh auth status` が失敗

- ホスト側で `export GH_TOKEN=$(gh auth token)` を忘れている
- 古い shell で `devpod up` していて env が更新されていない
- 対処: 新しいシェルで export してから `devpod up . --ide none`

### container 内の `npm install` が遅い / 競合

- 別 worktree の workspace で並行 install していないか確認 (`devpod list`)
- named volume が壊れていたら `docker volume rm smalruby3-editor_smalruby3-editor_node_modules` でリセット (要 npm install からやり直し)

### `claude` がいない / バージョンが古い

- features は最新を install する。固定したい時は Dockerfile で `npm install -g @anthropic-ai/claude-code@X.Y.Z`
- バージョン上げたい: `devpod delete` → `devpod up` で features の最新を取り直し

### worktree の `docker compose run app ...` が devpod workspace を壊した

`docker compose` は `name: smalruby3-editor` 固定で project を作る。devpod は
`default-XXX-` prefix で別 project を作る。両者は基本独立だが、**named volume と
port 8601 は共有リソース** なので衝突しうる:

- compose 側で port 8601 を握っていると devpod 側が conflict (DNS 孤立)
- 対処: `docker compose stop app` で compose 側を止める、または devpod を先に
  落としてから compose 起動

### tmux session が消えた

`devpod stop` は container を止めるので session も消える。**永続化させる必要が
ある作業 (長時間 build / 監視) は tmux + nohup or systemd など別途工夫が必要**。

### firewall 導入後: `npm install` / `cdk deploy` / `git fetch` が固まる・失敗する

egress allowlist で宛先が弾かれている可能性が高い (ビルド時ではなく**起動後**の取得が対象)。

- 起動ログ末尾の `init-firewall: applied` / `verify OK` 行を確認
- 弾かれた宛先を `curl -v <url>` で特定し、`init-firewall.sh` の `EXTRA_HOSTS` か
  `.devcontainer/firewall-allow.local` に追加 → `init-firewall.sh` 再実行 (再起動でも可)
- 一時的に切り分けたいときは `postStartCommand` をコメントアウトして無 firewall で再現確認
- 詳細は `.devcontainer/README.md`「egress allowlist firewall」

### firewall 適用後の `devpod ssh` で `Error tunneling to container ...` が出る

コマンド出力自体は返っており、接続終了時の teardown の **cosmetic なメッセージ**。
default-DROP が tunnel 終了パケットを落とすために出るだけで実害なし。

### workspace 名が衝突する (同名 basename の worktree)

devpod の workspace ID は **host の絶対パス** から生成されるが、basename が同じ
リポジトリ (worktree 含む) が複数あると名前が衝突しうる。
`devpod up . --id <一意な名前>` で明示すると安全。

## 参考

- 利用ポリシー: NaCl Claude Code 利用ガイドライン v0.2 §3-2
- devcontainer 設計: `.devcontainer/README.md`
- 対話的セットアップ: `/devcontainer-setup` skill
- 旧 worktree 手順 (compose 利用者向け): `.claude/rules/git-workflow.md` の「Git Worktree Setup」
- Anthropic 公式 devcontainer ドキュメント: https://code.claude.com/docs/en/devcontainer
