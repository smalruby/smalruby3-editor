---
name: autopilot
description: autopilot の総合サポート。初期設定（必要情報のインタビュー → 起動スクリプト tmp/autopilot_up.sh の生成 → 認証確認の上 Claude が起動/再起動）、Issue の enroll ショートカット（本文や末尾に「enroll autopilot」）、トラブル診断（check-autopilot へ委譲）、運用中の操作支援。「init autopilot」「autopilot開始」「go autopilot」「play autopilot」「enroll autopilot」「update autopilot」など、autopilot と一緒にやろうと汲み取れるひとことで起動する。
---

# autopilot — 総合サポートスキル

ユーザーが autopilot に関する短い呼びかけをしたときに起動し、**モードを判定**して対応する。
このスキルは**人間と対話するセッション用**（autopilot worker のプロンプトではないので、
不足情報は遠慮なく AskUserQuestion でインタビューしてよい）。

参照ドキュメント: `docs/autopilot/README.md`（全体）/ `docs/autopilot/state-machine.md`（状態遷移）/
`docs/autopilot/autonomous-contract.md`（worker 契約）。

## モード判定

| ユーザーの発話（例） | モード |
|---|---|
| `init autopilot` / `autopilot開始` / `go autopilot` / `play autopilot` / 「autopilot を使いたい・始めたい」 | **A: 初期化 & 起動サポート** |
| メッセージや Issue 下書きの本文・末尾に `enroll autopilot` | **B: Issue enroll ショートカット** |
| `check autopilot` / `check autopilot #N` / 「止まってる」「Blocked になってる」等のトラブル | **C: 診断（check-autopilot スキルへ委譲）** |
| その他の autopilot に関する質問・操作依頼 | **D: 運用サポート** |

迷ったら daemon の状態（`curl -s localhost:8787/board`）を先に見て、未起動なら A、
異常があれば C、正常稼働なら D と判断する。

---

## A: 初期化 & 起動サポート

ゴール: 必要な情報を揃え、起動スクリプト **`tmp/autopilot_up.sh`** を用意し、
**認証が有効なら Claude が自分で daemon を起動する**（AWS SSO 再認証だけは人間 —
末尾「起動/再起動は Claude が実行してよい」を参照）。

### A-1. 前提チェック（揃っているものはスキップ）

```bash
command -v tmux && command -v gh && command -v claude && node --version   # 実行環境
bin/bot-token --whoami                                                    # bot 認証（最重要）
GH_TOKEN="$(bin/bot-token)" gh project view 4 --owner smalruby --format json | head -c 200  # Project アクセス
ls ~/.config/autopilot/settings.json 2>/dev/null                          # worker settings（任意）
```

- `bot-token` が失敗する場合、`~/.config/smalruby-bot/config`（APP_ID / INSTALLATION_ID /
  APP_SLUG）と秘密鍵の有無を確認する。鍵は次のどちらか:
  - ローカル `~/.config/smalruby-bot/private-key.pem`
  - `PRIVATE_KEY_SECRET_ID`（AWS Secrets Manager。`AWS_PROFILE`/`AWS_REGION` も必要なら）
    → この場合 `aws sts get-caller-identity` で SSO の有効性も確認し、失効していれば
    `aws sso login --sso-session smalruby --use-device-code` を人間に依頼する
- 揃えられない項目（App の鍵の入手など）は、何をどこから入手するかを具体的に案内して中断してよい。

### A-2. 不足情報のインタビュー

AskUserQuestion で**不足しているものだけ**聞く（既定値を推奨選択肢の先頭に）:

| 項目 | 既定 | 補足 |
|---|---|---|
| assignee（GitHub login） | `git config user.name` や gh から推定して提案 | enroll モデル。「全件処理（未指定）」も選択肢に |
| concurrency | 2 | 同時に走る worker 数 |
| port | 8787 | Web モニタのポート |
| interval | 300 秒 | ポーリング間隔 |
| worker への追加許可ディレクトリ | なし | 例 `~/ghq`。指定があれば settings.json に反映 |
| フェーズ別 model/effort の上書き | 既定（実装/レビュー系 opus・分類系 sonnet） | こだわりがあるときのみ |

### A-3. ファイル配置

- settings のカスタマイズがあれば `~/.config/autopilot/settings.json` を作成/更新する
  （形式は `tools/autopilot/src/settings.js` の DEFAULT_SETTINGS を参照。addDirs / phases のみ書けばよい）。
- 起動スクリプトを **`tmp/autopilot_up.sh`** として生成し `chmod +x` する（テンプレート）:

```bash
#!/usr/bin/env bash
# autopilot daemon 起動スクリプト（autopilot スキルが生成。人間が実行する）
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SESSION=autopilot-daemon
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "既に起動しています: tmux attach -t $SESSION / http://localhost:<PORT>/"
    exit 0
fi
mkdir -p tmp
tmux new-session -d -s "$SESSION" \
  "node tools/autopilot/bin/autopilot daemon --assignee <LOGIN> --concurrency <N> --interval <SEC> --port <PORT> 2>&1 | tee tmp/autopilot-daemon.log"
echo "started."
echo "  monitor: http://localhost:<PORT>/"
echo "  log:     tail -f tmp/autopilot-daemon.log  (or tmux attach -t $SESSION)"
echo "  stop:    curl -X POST localhost:<PORT>/shutdown"
```

`<LOGIN>`（未指定なら `--assignee` ごと省略）/`<N>`/`<SEC>`/`<PORT>` はインタビュー結果で埋める。

### A-4. 起動（Claude が実行してよい）

**認証が有効なら Claude が自分で起動する。** まず `bin/bot-token >/dev/null 2>&1` で認証を確認し:

- **成功**: `bash tmp/autopilot_up.sh` を実行して起動する（`docker compose` 等でラップしない）。
  数秒待って `curl -s localhost:<PORT>/status` で疎通・assignee・paused・authError を確認し、
  結果を報告して **D: 運用サポート** に移る。
- **失敗（AWS SSO 失効など）**: **起動しない**（daemon は bot-token 取得不能だとクラッシュしうる）。
  人間に `aws sso login --sso-session smalruby --use-device-code`（device code + ブラウザ承認 =
  人間のみ）を依頼し、完了後 `bin/bot-token --whoami` で疎通を再確認してから起動する。

> 起動/再起動の条件と再起動（update autopilot）手順は末尾「起動/再起動は Claude が実行してよい」を参照。

---

## B: Issue enroll ショートカット

ユーザーのメッセージ（Issue の下書きや依頼文）の本文・末尾に **`enroll autopilot`** が
含まれていたら、その内容から **autopilot に最適化した Issue を作成して enroll まで行う**。

1. **本文整形**: `enroll autopilot` の行/語は Issue 本文から**取り除く**。タイトルは
   Conventional Commits 風（`feat(scope): ...` / `fix(scope): ...`）に整える。必要に応じて
   受け入れ条件（`## DoD` チェックリスト）を補い、ベースブランチ指定があれば行頭に
   `autopilot-base: <branch>`、依存があれば `autopilot-after: #N` を入れる。
2. **作成 + enroll**（すべて bot 名義 `GH_TOKEN="$(bin/bot-token)"`）:
   ```bash
   # 1) Issue 作成（body は Write ツールで tmp/issue-body.md に書いてから）
   GH_TOKEN="$(bin/bot-token)" gh issue create --repo smalruby/smalruby3-editor \
     --title "<title>" --body-file tmp/issue-body.md --assignee <LOGIN>
   # 2) Project #4 に追加
   GH_TOKEN="$(bin/bot-token)" gh project item-add 4 --owner smalruby --url <issue-url>
   # 3) フィールド設定（item-edit）: Status / Kind / Size
   #    フィールド/オプション ID は gh project field-list 4 --owner smalruby --format json で都度取得
   ```
3. **最適な値の判断**:
   - **担当者** = 起動中 daemon の assignee（`curl -s localhost:8787/status` の `assignee`。
     取れなければユーザーの login を確認して assign）。未 assign のままだと誰も拾わない。
   - **Kind** = 1 PR で終わる粒度なら `Issue`、分割が要る規模なら `EPIC`
   - **Size**（leaf のみ）= small / middle / large
   - **Status** = 既定 `Sprint Backlog`（即着手）。設計相談から始めたい内容なら
     `New Item`（triage → 必要ならディスカッション）を提案して確認する
   - ラベルは付けない（`🤖 autopilot` は daemon が付与する）
4. 作成した Issue 番号・URL・設定値（Status/Kind/Size/担当）を報告する。

`enroll autopilot` が**複数案件**を含むときは、1 案件 = 1 Issue に分けてから同じ手順を繰り返す。

---

## C: 診断（check-autopilot へ委譲）

トラブル対応は **`check-autopilot` スキル**の手順に従う（Skill ツールで `check-autopilot` を
起動するか、`.claude/skills/check-autopilot/SKILL.md` を読んでそのまま実行する）。
`check autopilot #N` の形なら該当 Issue の Blocked 診断を必ず行う。

---

## D: 運用サポート（セッション常駐）

初期化後・稼働中は、このセッションで次を支援する:

- **状態の要約**: `curl -s localhost:8787/board` を読み、Board の状態・実行中・Blocked を
  日本語で要約する（モニタ URL も添える）
- **操作**（人間の依頼があったとき）: `POST /tick`（今すぐ確認）/ `/pause` / `/resume` /
  `/stop?issue=N` / `/inject?issue=N&phase=<p>`。破壊的な stop / inject は実行前に確認する
- **起動 / 再起動 / 更新反映（update autopilot）**: Claude が実行してよい（末尾の規約に従う）。
  「update autopilot」は `git pull`（develop）→ 再起動で最新スナップショットを反映する
- **enroll 依頼**（B）や **トラブル**（C）を検知したら該当モードへ
- **質問対応**: 状態遷移・HITL 解除・ディレクティブ等は `docs/autopilot/` を根拠に答える

## 起動/再起動は Claude が実行してよい

`tmp/autopilot_up.sh` が用意されていれば、**daemon の起動・再起動・更新反映は Claude が
自分で実行してよい**（従来「人間のみ」だったが解禁）。ただし次を守る:

- **起動前に必ず認証を確認する**: `bin/bot-token >/dev/null 2>&1`（または `--whoami`）。
  失敗したら**起動しない**。daemon は bot-token 取得不能だと未捕捉例外でクラッシュしうる
  （実際に SSO 失効でプロセスごと落ちた事例あり）。
- **AWS SSO 再認証は人間のみ**: device code + ブラウザ承認は Claude が代行できない。失効時は
  `aws sso login --sso-session smalruby --use-device-code` を人間に依頼し、
  `bin/bot-token --whoami` で回復を確認してから起動する。
- **起動**: `bash tmp/autopilot_up.sh`（tmux 未起動なら新規起動・既起動なら no-op）。
- **再起動 / 更新反映（update autopilot）**: `curl -X POST localhost:<PORT>/shutdown` →
  必要なら `/app` で `git pull origin develop` → `bash tmp/autopilot_up.sh`。走行中 worker が
  あれば中断されるので、**完了を待つか中断可否を人間に確認**する。
- **起動後は必ず疎通確認**: `curl -s localhost:<PORT>/status` で paused / authError / boot commit を確認して報告する。
- スクリプトが無い場合は Mode A の手順で `tmp/autopilot_up.sh` を生成してから起動する。

## 注意

- Project の Status / AI Status を Claude が直接書き換えない（単一ライターは daemon。
  例外は B の enroll 時の初期フィールド設定、および Blocked 復旧時の再ルートのみ）。
- 秘密（トークン・鍵・SSO 情報）を出力・コミットに含めない。
