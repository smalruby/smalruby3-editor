# GitHub App (Bot) — コミット/PR を Bot 名義で行う

Claude が行う **コミット・push・PR 作成/マージ・Issue/PR コメント・Projects 操作** は、人間の
個人アカウントではなく **GitHub App ボット `smalruby3-editor-bot[bot]` 名義**で実行する。
これにより、人間は自分自身として PR をレビュー・承認・コメントできる。

詳細・背景・権限一覧・トラブルシューティングは **`docs/github-app-bot/README.md`** を参照。
本ファイルは Claude が日々従う最小ルール。

## 前提（コンテナ内・直接実行・人間と共有）

devpod コンテナ内で作業しているので、コマンドは `docker compose run` / `bin/dx` で包まず
直接実行する（`CLAUDE.md`「Development Environment」参照）。秘密は `~/.config/smalruby-bot/`
に置く（`private-key.pem` + `config`）。`bin/bot-token` がトークンを発行・キャッシュする。

**同じ checkout を人間と共有する。** 人間が Claude 外で叩く plain `git` / `gh` は人間名義
（`Kouji Takao` / takaokouji）でなければならない。だから **共有 git 設定（`.git/config`）は
絶対に Bot に書き換えない**。Bot 名義は Claude の操作時だけ `bin/bot-git` で注入する。

## 毎回の操作ルール

1. **コミット/push は `bin/bot-git` を使う**（plain `git` は人間名義なので Bot 操作に使わない）:
   ```bash
   bin/bot-git commit -m "..."          # author/committer = Bot（-c 注入、共有設定は不変）
   bin/bot-git push -u origin <branch>  # Bot トークンで認証
   ```
   コミットメッセージ末尾の `Co-Authored-By: Claude ...` フッターは従来どおり残す。
   `git log` / `git diff` / `git status` 等の読み取りは plain `git` で構わない。
2. **gh コマンドは必ずトークンを注入する**（Claude の Bash は env を保持しないため、毎回付ける）:
   ```bash
   GH_TOKEN="$(bin/bot-token)" gh pr create --repo smalruby/smalruby3-editor --base develop ...
   GH_TOKEN="$(bin/bot-token)" gh pr merge <n> --repo smalruby/smalruby3-editor --merge --delete-branch
   GH_TOKEN="$(bin/bot-token)" gh pr checks <n> --repo smalruby/smalruby3-editor
   GH_TOKEN="$(bin/bot-token)" gh api graphql -f query='...'   # Projects v2 等
   ```
   > 読み取り専用の確認（`gh pr view` 等）も Bot トークンで行ってよい。
3. **確認**: コミット後に `git log -1 --format='%an <%ae>'` が `smalruby3-editor-bot[bot]` か見る。

## トークンは 3 経路。用途で使い分ける (#1164)

| 用途 | トークン | 使い方 |
|---|---|---|
| **名義が見える書き込み** (commit / PR / コメント / ラベル / Projects) | Bot (GitHub App) | `bin/bot-git` / `GH_TOKEN="$(bin/bot-token)" gh ...` |
| **読み取り** (一覧・PR/Issue 情報。レート予算の分散) | 個人 (read) | autopilot が `AUTOPILOT_READ_TOKEN` → `GH_TOKEN` → `gh auth token` の順で解決 |
| **repo 設定の変更** (Actions の Variables / Secrets / Environments) | 個人 (admin) | **`bin/gh-admin` 経由のみ** |

**なぜ admin を分けるか**: bot トークンでは repo 設定を変更できない
(`Resource not accessible by integration`)。かといって個人 PAT を `GH_TOKEN` に置くと、
`gh` が無条件に拾い、autopilot の読み取り解決も `GH_TOKEN` を経由するため
**daemon の全読み取りが admin 権限で走る**。名義も権限も混ざり、事故時の被害が最大になる。

```bash
bin/gh-admin --whoami                    # 持ち主と権限 (variables / secrets / environments)
bin/gh-admin variable set KEY --body V   # --repo は既定で smalruby/smalruby3-editor
bin/gh-admin secret set NAME < infra/<project>/.env.stg
bin/gh-admin api --method PUT repos/{owner}/{repo}/environments/stg
```

- トークンは `~/.config/smalruby-gh/admin-token` (repo 外・0600)。devcontainer では
  host の同じパスを **read-only** マウントする (`.devcontainer/README.md`)。
- ラッパは **repo 設定の API 以外を実行前に拒否**する。merge / branch protection などは
  通らない (通す必要があるものは bot トークンで実行する)。
- **`export GH_TOKEN=<admin>` は禁止**。`gh auth login` で admin を既定にするのも禁止。
- **secret 名にハイフンは使えない** (英数字と `_` のみ)。`smalruby-admin` のような
  プロジェクト名から作るときは `INFRA_STG_DOTENV_SMALRUBY_ADMIN` のように変換する。

## やってはいけないこと

- **共有 `.git/config` を Bot に書き換えない**（`git config user.email '...bot...'` 等）。人間の
  手動コミットまで Bot 名義になる。Bot 名義は必ず `bin/bot-git` の `-c` 注入で行う。
- `~/.config/smalruby-bot/private-key.pem` や `~/.cache/smalruby-bot/token.json` を **コミットしない**。
  `.pem` を一時的に repo 内（`tmp/` 等）で受け取ったら、`~/.config/smalruby-bot/` へ移動した後
  **必ず repo 内から削除**する。
- Bot で **自分の PR を承認しない**（レビュー・承認・コメントは人間の役割）。
- Bot 操作に plain `git` / plain `gh` を使わない（人間名義になる）。

## 確認コマンド

```bash
bin/bot-token --whoami            # App 情報 + トークン取得可否
bin/bot-token --bot-email         # Bot の name / email
bin/bot-git config user.name      # → smalruby3-editor-bot[bot]（注入の確認）
git config user.name              # → Kouji Takao（共有設定が人間のままか確認）
git log -1 --format='%an <%ae>'   # 直近コミットが Bot 名義か
```
