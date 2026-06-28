# autopilot — Claude による Issue ライフサイクル自律オーケストレーター

> **🆕 Smalruby 独自** — 開発運用のために作られた仕組み。upstream（Scratch Foundation）には存在しない。

autopilot は、複数の GitHub Issue を Claude が**並行**して

> 起票 → トリアージ → 実装 PR → 敵対的レビュー → 人間レビュー → DoD → マージ

まで自律的に進めるための常駐プログラム群と運用規約。状態は smalruby organization の
専用 **GitHub Projects v2「Autopilot」** のフィールドで一元管理する。

設計の出発点となった課題と意思決定の経緯は Issue #760（EPIC）に集約されている。
スキル/Runner が従う詳細な契約は [`autonomous-contract.md`](./autonomous-contract.md) を参照。

---

## 全体像

```
            GitHub Projects v2「Autopilot」 = 状態の単一の真実（Issue のみ管理）
                    ▲  poll / 更新 (gh GraphQL, GitHub App bot)
                    │
        ┌───────────┴────────────────────────────────────────────┐
        │  autopilot daemon（常駐・単独プロセス）                    │
        │   - Project をポーリングし着手可能 item を並行数上限内で処理  │
        │   - フェーズ state machine 駆動                            │
        │   - pause / resume / force-stop、CLI からの割り込み投入(HTTP) │
        └───┬───────────────────┬────────────────────┬────────────┘
            │                   │                    │
     Claude runner        Web ステータスモニタ        CLI（単発検証）
   tmux send-keys +       一覧 / 状態 / ログ /        例: あるフェーズだけ
   watchdog, worktree隔離  手動 操作                   1 Issue で試す
```

### コンポーネント

| 要素 | 役割 | 実装 |
|---|---|---|
| **状態モデル** | フェーズの単一の真実 | GitHub Projects v2「Autopilot」 |
| **daemon** | Project をポーリングし着手可能 item を処理。並行制御・pause/resume/force-stop・HTTP 割り込み | `tools/autopilot/src/daemon.js` |
| **Claude runner** | 対話 Claude Code を tmux で起動し send-keys で駆動、watchdog で監視 | `tools/autopilot/src/runner.js` |
| **Web モニタ** | item 一覧・状態・ログ閲覧・手動操作（daemon が `GET /` で配信） | `tools/autopilot/src/monitor.js` |
| **CLI** | 単一フェーズを単一 Issue で実行（動作確認・ドライラン） | `tools/autopilot/bin/autopilot` |
| **フェーズ・スキル** | 各フェーズの「頭脳」。非対話で1フェーズを遂行 | `.claude/skills/autopilot-*` |
| **worktree** | Issue ごとの隔離作業場（軽量・即作成） | `bin/autopilot-worktree` |

> daemon は常駐の単独プロセスとして起動する。並行数は設定可能（既定 2、必要に応じて増やす）。

---

## 状態モデル（GitHub Projects v2）

状態は **Issue のみ**を Project で管理する（PR を Project に入れると二重管理になる）。

### Status — 人間の Scrum ボード列（人間にとってのフェーズ）

```
No Status(未設定) → Backlog / Icebox → Sprint Backlog(autopilot キュー)
  → In Progress → Review → DoD → Close
```

| Status | 意味 |
|---|---|
| No Status | 起票直後・未トリアージ（Status 未設定の列。Projects v2 UI では「No Status」列に並ぶ） |
| Backlog | やると決めた |
| Icebox | やらないと決めた（保留） |
| Sprint Backlog | autopilot のキュー（着手対象） |
| In Progress | 実装〜PR〜敵対的レビュー |
| Review | 人間レビュー待ち |
| DoD | approve 後の Playwright DoD |
| Close | 完了（merge 後） |

> 実装メモ: Status 未設定（UI の「No Status」列）は内部的に `'New Item'` という sentinel で
> 正規化して扱う（`tools/autopilot/src/phases.js` の `status || 'New Item'`）。本ドキュメントの
> 表記は UI に合わせて「No Status」で統一する。

### AI Status — AI 専用の細フェーズ（各値 ≈ 1 スキル）

人間は Status を見れば十分。AI Status は daemon が「次に呼ぶスキル」を引くための内部状態で、
Issue を状態の正とすることで daemon が落ちても現在地が分かる。

| AI Status | 対応スキル | 主な Status |
|---|---|---|
| Triaging | autopilot-triage | No Status |
| Understanding | autopilot-understand | No Status / Backlog（EPIC） |
| Decomposing | autopilot-decompose | Backlog（EPIC→sub-issue） |
| EPIC Decomposed | —（親トラッカー化） | In Progress（EPIC） |
| Implementing / Creating PR | autopilot-implement | In Progress |
| Self-Reviewing | autopilot-review | In Progress |
| Addressing Comments | autopilot-address-review | Review |
| Running DoD | autopilot-verify | DoD |

### その他フィールド

- **HITL**（Yes/No）— 人間の番か（後述）
- **Size**（small / middle / large）— leaf Issue の重み付け（EPIC は付けない）
- **Kind**（EPIC / Issue）
- **Current Step / Worktree / Tmux Window**（text, observability）

---

## HITL（Human In The Loop）

HITL は「人間の番」を表す。set と release で非対称のルールを持つ。

- **set（人間に渡す）**: daemon が **全面を一括 Yes** にして整合を保つ（Project フィールド +
  Issue/PR の `🙋 HITL` ラベル）。
- **release（AI に戻す）**: 適用される signal の **いずれか1つでも No/除去**されたら autopilot は
  処理を進める（OR 解除）。人間はレビュー中、目の前の PR ラベルを外すだけでよい。実装は
  `tools/autopilot/src/phases.js` の `isHitlReleased`。

人間が判断/レビューに使う HITL ゲート: EPIC 理解・分解承認・人間レビュー（approve）・merge。

---

## merge は独立した「前進シグナル」

PR が merge されたら、HITL ラベル/フィールドが残っていても autopilot は前進する。

- **leaf Issue**: ひも付く PR が merge されたら Issue を **Close** へ進める（人間が HITL を別途
  クリアする必要はない）。
- **EPIC**: 子 PR の merge では完了しない（後述の EPIC 運用）。

autopilot は **自動 merge しない**。daemon はポーリングのたびに「PR が出た後〜Close 前」の leaf
（Status が In Progress / Review / DoD）について、`Closes #<issue>` などで紐付く PR が **人間に
merge 済みか**を GitHub に問い合わせ（`closedByPullRequestsReferences`）、merge 済みなら Status を
**Close**・AI Status をクリア・HITL を No にする。判定は `phases.js` の `selectMergeCandidates` /
`mergeProgressionIntents`（純粋関数）、問い合わせと書き込みは `project.hasMergedPullRequest` と
daemon の `applyMergeProgression`。実行中（run が所有する）item は触らない。

---

## Review 解除後の自動遷移（address-review / verify）

`Review` の item は人間レビュー待ち（HITL=Yes）。人間がレビューを終えて HITL を解除すると、
daemon が PR のレビュー状態を見て次フェーズを自動ディスパッチする（`phaseForItem` + `getReviewContext`）。

| PR レビュー状態（HITL 解除後） | 自動ディスパッチ |
|---|---|
| 変更要求 / 未対応の人間レビューコメントが残る | `autopilot-address-review`（指摘対応へ） |
| approve のみ（未対応コメントなし） | `autopilot-verify`（DoD 確認へ） |
| どちらの signal も無い | 何もしない（保守的に待つ） |

- コメントは approve より優先する（approve しつつ未対応コメントを残したら指摘対応が先）。
- 解除の権威シグナルは当面 **Project の HITL フィールド** のみ。`🙋 HITL` ラベルでの OR 解除は
  ラベルを atomic に同期する変更（PR ラベル/Draft/sticky 同期）が入って初めて健全に効く。
  判定ロジック（`phaseForItem`）は OR 解除を扱えるので、その時点で `hitlSignals` を足せば拡張できる。
- address-review / verify は **既存 PR ブランチ**で作業する（daemon が worktree を `--pr` で用意）。

---

## EPIC の扱い

EPIC は「作業項目」ではなく「**トラッカー**」。

1. daemon は **leaf（Kind=Issue）だけ**をキューから拾う。EPIC は分解後キューに入れない。
2. EPIC の Status: `Backlog`(未分解) → `In Progress`(子を追っている) → `Done`(子が全部完了)。
   一時停止は `Icebox`。AI Status は分解完了で `EPIC Decomposed`。進捗は標準の
   「Sub-issues progress」で見る。
3. 「もう十分」のときは **納品スライスを Done + 残りをフォローアップ EPIC** に切り出す
   （半分終わった EPIC を滞留させない）。
4. EPIC を Done にする遷移は **HITL**（未クローズの子がある EPIC を勝手に閉じない）。

---

## PR 側の状態可視化（Issue のみ Project 管理 + PR は投影）

PR を見ただけで連携 Issue の状態が分かるよう、daemon が PR へ状態を投影する（Project が真実、
PR 側は読み取り投影）。

| 手段 | 意味 |
|---|---|
| `🤖 autopilot` ラベル | autopilot 管理対象（AI 処理対象） |
| `🙋 HITL` ラベル | 人間の対応待ち |
| Draft ⇄ Ready for review | Draft=AI 作業中 / Ready=人間レビュー待ち |
| sticky ステータスコメント | bot が1コメントを編集し続け、連携 Issue の Project 状態を投影 |

「作業中」専用ラベルは作らない（Draft が兼ねる）。

---

## Claude runner の堅牢性

対話 Claude Code を tmux で起動し send-keys で駆動する。完了検出の権威は
**「結果ファイル（`AUTOPILOT_RESULT_FILE`）の出現」**（pane トークンは人間観測用の補助）。
watchdog が次を処理する:

| 課題 | 検出 | 対応 |
|---|---|---|
| 起動しない | pane が準備完了するまでポーリング（ブラインド sleep しない） | `T_ready` 超で kill→再起動 |
| インタビューで停止 | pane 無変化が継続 | `T_idle` 超で再起動（no-interview 指示を強めて再投入） |
| 原因不明の長時間稼働 | 絶対上限 `T_max` / 手動 force-stop | tmux 窓 kill |
| 終了したのに状態不変 | サブプロセス実体をポーリング（`pane_dead` 等） | 最終結果を反映 |

再起動回数を数え、上限超で `Blocked` + HITL に escalate。判断ロジックは
`tools/autopilot/src/phases.js` の `evaluate`（純粋関数・テスト済み）。

---

## 自律コントラクト

すべての `autopilot-*` スキルは [`autonomous-contract.md`](./autonomous-contract.md) に従う。要点:

- **対話的に人間へ質問しない**。判断が要れば bot で Issue/PR にコメントし `AUTOPILOT_HITL` で終了。
- 終了直前に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークン（`AUTOPILOT_DONE` /
  `AUTOPILOT_HITL` / `AUTOPILOT_ERROR`）を出す。
- Project フィールドは直接書かない（意図は結果ファイルで伝え、daemon が書く＝単一ライター）。
- 冪等・再入可能。bot identity（`bin/bot-git` / `bin/bot-token`）で作業。
- 非対話権限で動く（権限プロンプトで止めない）。

---

## 使い方

### worktree（Issue ごとの隔離作業場）

```bash
bin/autopilot-worktree create <issue> [base-ref]   # 軽量（既定 base: origin/develop）
bin/autopilot-worktree create <issue> --full        # npm install + build:dev も行う
bin/autopilot-worktree path <issue>                 # パス表示
bin/autopilot-worktree remove <issue> [--delete-branch]
bin/autopilot-worktree list
```

軽量モードは `.env` をコピーし `node_modules`/dist を main checkout へ symlink するので、
`npm install` / `build:dev` 無しで即作業できる（`@smalruby/*` は main の dist に解決される）。
単一パッケージのソース編集を想定。クロスパッケージのソース編集は `--full`。

### daemon（常駐・本番運用）

実ワークロードは **常駐 daemon** が回す。Project をポーリングし、着手可能な item を並行上限内で
拾って Claude runner にディスパッチし、結果を Project に反映する。pause/resume/force-stop と
Web モニタは daemon が立てる HTTP サーバ（既定 `:8787`）で操作する。

#### 起動

```bash
# 既定: owner=smalruby / project=4 / repo=smalruby/smalruby3-editor / concurrency=2 / interval=300s / port=8787
node tools/autopilot/bin/autopilot daemon

# オプション指定の例（並行 3・60 秒ポーリング・ポート 9000）
node tools/autopilot/bin/autopilot daemon --concurrency 3 --interval 60 --port 9000

# 1 サイクルだけ回して終了（動作確認・cron 的運用）
node tools/autopilot/bin/autopilot daemon --once
```

daemon オプション: `--owner` / `--project` / `--repo` / `--concurrency` / `--interval`（秒）/
`--port` / `--once`。起動すると PID ファイル（`$TMPDIR/autopilot-daemon.pid`、通常
`/tmp/autopilot-daemon.pid`）を書き、ログを stderr に出す。バックグラウンド常駐は tmux か
`nohup ... &` で。

```bash
# tmux で常駐させる例
tmux new -d -s autopilot 'node tools/autopilot/bin/autopilot daemon 2>&1 | tee /tmp/autopilot-daemon.log'
```

#### 監視（Web モニタ）

ブラウザで **`http://localhost:8787/`** を開くと自己完結 HTML のモニタが表示される
（2 秒ごとに `/status` をポーリング）。実行中 item の一覧・phase・pause/resume・各 item の
force-stop・pane ログ閲覧ができる。

HTTP API（curl からも操作可能）:

| メソッド・パス | 用途 |
|---|---|
| `GET /` | Web モニタ（HTML） |
| `GET /status` | `{paused, concurrency, running:[{issue,phase}]}` を JSON で返す |
| `GET /log?issue=<n>` | 実行中 item の tmux pane キャプチャ（人間観測用） |
| `POST /pause` | 新規ディスパッチを止める（実行中はそのまま） |
| `POST /resume` | ポーリング再開 |
| `POST /stop?issue=<n>` | その item の tmux セッションを kill して force-stop |
| `POST /inject?issue=<n>&phase=<p>` | 並行上限を超えて 1 フェーズを割り込み投入 |
| `POST /shutdown` | daemon プロセスを安全停止 |

```bash
curl -s localhost:8787/status | jq          # 状態確認
curl -X POST localhost:8787/pause            # 一時停止
curl -X POST localhost:8787/resume           # 再開
curl -X POST 'localhost:8787/stop?issue=123' # #123 を force-stop
```

#### 停止

```bash
# 安全停止（推奨）: HTTP で止める
curl -X POST localhost:8787/shutdown

# または PID ファイル経由（pkill -f は daemon 自身を巻き込むため使わない）
kill "$(cat /tmp/autopilot-daemon.pid)"
```

SIGTERM / SIGINT でも終了し、PID ファイルは終了時に削除される。

### CLI（単発フェーズ実行・動作確認）

```bash
# あるフェーズだけを 1 Issue で試す
node tools/autopilot/bin/autopilot <phase> <issue> [options]

# 例: triage を試す（claude を起動せず配線だけ確認）
node tools/autopilot/bin/autopilot triage 123 --dry-run

# 実 claude で triage を通す（worktree を作って実行、結果を Project に反映）
node tools/autopilot/bin/autopilot triage 123
```

主なオプション: `--owner` / `--project` / `--repo` / `--command`（claude 起動コマンド差し替え）/
`--worktree <path>` / `--no-worktree` / `--dry-run` / `--no-apply`。

`phase` は `triage` / `understand` / `decompose` / `implement` / `review` / `address-review` /
`verify`（`tools/autopilot/src/phases.js` の `PHASE_BY_COMMAND`）。

### テスト

```bash
cd tools/autopilot && node --test    # 純粋ロジックの unit テスト（依存なし）
```

---

## ファイル構成

| パス | 内容 |
|---|---|
| `docs/autopilot/README.md` | 本ドキュメント（機能全体の入口） |
| `docs/autopilot/autonomous-contract.md` | スキル/Runner の契約 |
| `.claude/skills/autopilot-*/` | 各フェーズのスキル |
| `bin/autopilot-worktree` | 軽量 worktree スクリプト |
| `tools/autopilot/src/contract.js` | 番兵/結果ファイルの検証（純粋） |
| `tools/autopilot/src/phases.js` | フェーズ↔スキル、結果→フィールド意図、watchdog 判断、HITL 解除、merge-progression（純粋） |
| `tools/autopilot/src/project.js` | GitHub Projects v2 への gh ラッパ |
| `tools/autopilot/src/runner.js` | tmux runner + watchdog |
| `tools/autopilot/src/daemon.js` | 常駐 daemon（ポーリング・ディスパッチ・HTTP 制御・merge-progression） |
| `tools/autopilot/src/monitor.js` | Web ステータスモニタ（自己完結 HTML） |
| `tools/autopilot/src/cli.js`, `bin/autopilot` | CLI（単発フェーズ + `daemon` サブコマンド） |
| `tools/autopilot/test/` | unit テスト |

---

## 認証

コミット/PR/Project 操作は GitHub App bot **`smalruby3-editor-bot`** 名義で行う
（`bin/bot-git` / `GH_TOKEN="$(bin/bot-token)" gh ...`）。詳細は
[`docs/github-app-bot/README.md`](../github-app-bot/README.md)。

---

## 運用上の注意（実地で得た知見）

- **worktree のスキル可用性**: `autopilot-*` スキルが対象ブランチに存在する必要がある（develop に
  マージ済みなら worktree でも解決可能）。
- **非対話権限**: runner は権限プロンプトで止まらない設定（許可ツール指定など）で claude を起動する。
