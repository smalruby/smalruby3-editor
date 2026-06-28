# GitHub App (Bot) — `smalruby3-editor-bot`

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby の開発運用のために追加した仕組み。

Claude Code が行うコミット・push・PR 作成/マージ・Issue 操作を、人間（リポジトリオーナー）の
アカウントではなく **GitHub App のボット `smalruby3-editor-bot[bot]` 名義**で実行するための仕組み。

## なぜ必要か

- **作業（Bot）とレビュー（人間）の分離**: コミットや PR 作成を Bot 名義にすることで、人間は
  自分自身として PR をレビュー・承認・コメントできる。GitHub 上で「誰が書いて誰が承認したか」が
  明確になる。
- **権限の最小化と監査**: Bot には必要な権限だけを付与し、操作はインストールトークン経由で行う。
  人間の個人 PAT を Claude に渡さずに済む。

## 重要: 人間と Bot の使い分け（共有設定は人間のまま）

同じ devpod コンテナ / checkout を人間と Claude が共有するため、**git の共有設定
（`.git/config`）は人間（`Kouji Takao` / takaokouji）のまま**にする。Bot 名義は
**Claude が操作するときだけ、その実行に限って明示的に注入**する。

| 実行者 | コマンド | identity / 認証 |
|---|---|---|
| **人間（Claude 外）** | 通常の `git` / `gh` | global の `Kouji Takao` + 環境の `GH_TOKEN`（takaokouji） |
| **Claude（自律操作）** | `bin/bot-git` / `GH_TOKEN="$(bin/bot-token)" gh` | `smalruby3-editor-bot[bot]` + installation token |

> ⚠️ **共有 `.git/config` を Bot に書き換えてはいけない**（`git config user.email` 等を直接
> Bot にすると、人間の手動コミットまで Bot 名義になる）。Bot 名義は必ず `bin/bot-git` の
> `-c` 注入（その実行限り）で行う。

## 構成

```
[人間(ブラウザ)]  App 作成 → 鍵生成 → smalruby3-editor に install
        │ App ID / Installation ID / private-key.pem / app slug
        ▼
[Claude(コンテナ内)]  鍵から JWT(RS256) 署名 → installation token(1時間) を取得
        │ git の author/committer = Bot, push 認証 = token, gh は GH_TOKEN=token
        ▼
   コミット・push・PR・マージ が Bot 名義で実行される
```

### 既知の値（秘密ではない）

| 項目 | 値 |
|---|---|
| App name / slug | `smalruby3-editor-bot` |
| App ID | `4165826` |
| 所有者 | `smalruby`（組織所有） |
| Installation ID | `143094377` |
| Bot コミット email | `<bot-user-id>+smalruby3-editor-bot[bot]@users.noreply.github.com`（user-id は `GET /users/smalruby3-editor-bot[bot]` で取得） |

> private key (`.pem`) **だけ**が秘密。git には絶対に入れない。

## App の権限

Repository permissions:

| 権限 | レベル | 用途 |
|---|---|---|
| Contents | Read and write | コミット push・ブランチ作成 |
| Pull requests | Read and write | PR 作成・マージ・コメント |
| Issues | Read and write | Issue コメント・作成 |
| Workflows | Read and write | `.github/workflows/*` を変更する push に必要 |
| Commit statuses | Read-only | `gh pr checks` |
| Checks | Read-only | `gh pr checks`（check runs） |
| Actions | Read-only | `gh run` で CI ログ参照（任意） |
| Metadata | Read-only | 必須（自動） |

Organization permissions（GitHub Projects v2 を操作する場合のみ）:

| 権限 | レベル | 用途 |
|---|---|---|
| Projects | Read and write | 組織の Projects v2 を GraphQL で操作 |

> ⚠️ **組織権限を後から追加した場合は、組織オーナーが installation の新権限を承認するまで有効に
> ならない**。`Organizations → smalruby → Settings → Installed GitHub Apps → smalruby3-editor-bot →
> Configure` で承認する。
> ⚠️ 現行の GitHub Projects (Projects v2) は **Organization permissions → Projects** で操作する。
> Repository permissions の "Projects" は旧 classic projects 用で効かない。

## セットアップ手順（新しいコンテナ / worktree で再設定するとき）

秘密はコンテナ内の `~/.config/smalruby-bot/` に置く（ホストへ rw マウントしない）。
`docker compose run --rm app` 等のラッパーは付けず、コンテナ内で直接実行する
（CLAUDE.md「Development Environment」参照）。

1. 秘密の配置:
   ```bash
   mkdir -p ~/.config/smalruby-bot && chmod 700 ~/.config/smalruby-bot
   # private-key.pem を ~/.config/smalruby-bot/private-key.pem に置く（chmod 600）
   cat > ~/.config/smalruby-bot/config <<'EOF'
   APP_ID=4165826
   APP_SLUG=smalruby3-editor-bot
   INSTALLATION_ID=143094377
   EOF
   chmod 600 ~/.config/smalruby-bot/config
   ```
   Installation ID 不明なら App ID + 鍵だけで引ける: `bin/bot-token --installations`
2. 動作確認（共有 git 設定は変更しない）:
   ```bash
   bin/bot-token --whoami        # app=... / installation token ok
   bin/bot-token --bot-email     # name / email
   bin/bot-git config user.name  # → smalruby3-editor-bot[bot]（その実行限りの注入）
   git config user.name          # → Kouji Takao（共有設定は人間のまま）
   ```

> 共有設定を書き換える必要はない。`bin/bot-git` が実行ごとに Bot 名義を注入するため、
> worktree ごとの git 設定作業も不要（`bin/bot-token` の config と鍵だけ用意すればよい）。

## 使い方（Claude の日常操作）

Claude が Bot 名義で操作するときは、必ず `bin/bot-git` か `GH_TOKEN="$(bin/bot-token)" gh` を使う。
**plain `git` / plain `gh` は人間名義になる**ので Bot 操作には使わない。

- **コミット**: `bin/bot-git commit -m "..."`（author/committer が Bot になる）
- **push**: `bin/bot-git push -u origin <branch>`（Bot トークンで認証）
- **gh コマンド**: トークンを都度注入する（Claude の Bash は env を保持しないため）:
  ```bash
  GH_TOKEN="$(bin/bot-token)" gh pr create ...
  GH_TOKEN="$(bin/bot-token)" gh pr merge <n> --merge --delete-branch
  GH_TOKEN="$(bin/bot-token)" gh pr checks <n>
  ```
- **GraphQL / Projects v2**:
  ```bash
  GH_TOKEN="$(bin/bot-token)" gh api graphql -f query='...'
  ```

トークンは 1 時間で失効するが、`bin/bot-token` が 50 分でキャッシュを自動更新するので運用負担はない。

### `bin/bot-git` の仕組み

共有設定を変えず、その 1 回の git 実行にだけ `-c` で Bot を注入する:

- `-c user.name` / `-c user.email` → コミット author/committer を Bot に
- `-c credential.helper=`（空でリセット）→ 人間の `gh auth git-credential` ヘルパーを一旦無効化
- `-c credential.https://github.com.helper=...bot-token...` → Bot トークンを供給

これにより、人間の手動 `git`（共有設定）には一切影響を与えずに、Claude の操作だけ Bot 名義になる。

## `bin/bot-token` のサブコマンド

| コマンド | 動作 |
|---|---|
| `bin/bot-token` | 有効な installation token を stdout に出力（キャッシュ・自動更新） |
| `bin/bot-token --installations` | App から見える installation 一覧（Installation ID 確認用、App ID + 鍵のみで可） |
| `bin/bot-token --bot-email` | Bot のコミット用 name / email を算出 |
| `bin/bot-token --whoami` | App 情報とトークン取得可否を表示 |
| `bin/bot-token --print-jwt` | App JWT を出力（デバッグ用） |

> `bin/bot-token` は **共有 git 設定を変更しない**。Bot 名義のコミット/push は `bin/bot-git`
> を使う（その実行限りで Bot を注入。詳細は上記「使い方」）。

## セキュリティ / 注意

- `~/.config/smalruby-bot/private-key.pem` と `~/.cache/smalruby-bot/token.json` は **絶対に
  コミットしない**（リポジトリ外に置いてあるので通常は問題にならないが、誤って repo 内に
  コピーしないこと）。`.pem` を一時的に `tmp/` 等へ受け取ったら、配置後に必ず削除する。
- `bin/bot-token` 自体は秘密を含まないのでコミット可。
- Bot は **自分の PR を承認できない**（する必要もない）。レビュー・承認・コメントは人間が行う。
- Verified バッジは付かない（通常の git commit のため）。必要なら GitHub の Git Data API 経由で
  サーバ側コミット生成が必要だが、rebase が多い開発では非現実的なので採用していない。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `bot-token: APP_ID not set` | `~/.config/smalruby-bot/config` が無い/未設定。上記セットアップ参照 |
| `--installations` が空 | App が未 install。`smalruby3-editor` に install する |
| push / commit が人間名義になった | `bin/bot-git` を使わず plain `git` で操作している。Bot 操作は必ず `bin/bot-git` 経由にする |
| 人間の手動 git が Bot 名義になる | 共有 `.git/config` の `user.email` 等が Bot に書き換えられている（やってはいけない）。`git config --local --unset user.name; git config --local --unset user.email` で人間（global）に戻す |
| `403` 系エラー | App の権限不足、または組織権限追加後の未承認。権限を見直し、組織で承認する |

## 関連

- 運用ルール（Claude 向け要約）: `.claude/rules/github-app-bot.md`
- 実装: `bin/bot-token`
- 開発環境（直接実行の前提）: `CLAUDE.md`「Development Environment」/ `.claude/rules/devpod-workflow.md`
