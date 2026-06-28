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
