# autopilot — Claude による Issue ライフサイクル自律オーケストレーター

> **🆕 Smalruby 独自** — 開発運用のために作られた仕組み。upstream（Scratch Foundation）には存在しない。

autopilot は、複数の GitHub Issue を Claude が**並行**して

> 起票 → トリアージ → 実装 PR → 敵対的レビュー → 人間レビュー → DoD → マージ

まで自律的に進めるための常駐プログラム群と運用規約。状態は smalruby organization の
専用 **GitHub Projects v2「Autopilot」** のフィールドで一元管理する。

設計の出発点となった課題と意思決定の経緯は Issue #760（EPIC）に集約されている。
プロンプト/Runner が従う詳細な契約は [`autonomous-contract.md`](./autonomous-contract.md) を参照。

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
| **フェーズ・プロンプト** | 各フェーズの「頭脳」。非対話で1フェーズを遂行 | `tools/autopilot/prompts/autopilot-*` |
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
| DoD | approve 後の headful 検証（daemon が引き継ぎ生成 → ホスト Claude が検証・#821） |
| Close | 完了（merge 後） |

> 実装メモ: Status 未設定（UI の「No Status」列）は内部的に `'New Item'` という sentinel で
> 正規化して扱う（`tools/autopilot/src/phases.js` の `status || 'New Item'`）。本ドキュメントの
> 表記は UI に合わせて「No Status」で統一する。

### AI Status — AI 専用の細フェーズ（各値 ≈ 1 プロンプト）

人間は Status を見れば十分。AI Status は daemon が「次に呼ぶプロンプト」を引くための内部状態で、
Issue を状態の正とすることで daemon が落ちても現在地が分かる。

| AI Status | 対応プロンプト | 主な Status |
|---|---|---|
| Triaging | autopilot-triage | No Status |
| Understanding | autopilot-understand | No Status / Backlog（EPIC） |
| Decomposing | autopilot-decompose | Backlog（EPIC→sub-issue） |
| EPIC Decomposed | —（親トラッカー化） | In Progress（EPIC） |
| Implementing / Creating PR | autopilot-implement | In Progress |
| Self-Reviewing | autopilot-review | In Progress |
| Addressing Comments | autopilot-address-review | Review / DoD（NG 差し戻し） |
| Running DoD | daemon `applyDodHandoffs`（引き継ぎ生成。autopilot-verify は手動 inject 用に残置） | DoD |

### その他フィールド

- **Size**（small / middle / large）— leaf Issue の重み付け（EPIC は付けない）
- **Kind**（EPIC / Issue）
- **Current Step / Worktree / Tmux Window**（text, observability）

---

## HITL（Human In The Loop）— `🙋 HITL` ラベルに一本化（#813）

HITL は「人間の番」を表す。状態は **`🙋 HITL` ラベル**が唯一の真実で、Issue と PR の両面に投影される
（Project に HITL フィールドは設けない／daemon は読まない・書かない）。**PR は Project フィールドを
持てない**ため、ラベルなら 1 系統で Issue/PR を賄え、成果物ページにも見える。set と release で
非対称のルールを持つ。

- **set（人間に渡す）**: daemon が **Issue/PR の両面に一括で `🙋 HITL` ラベルを付与**して整合を保つ。
- **release（AI に戻す）**: 適用される signal の **いずれか1つでも除去**されたら autopilot は
  処理を進める（OR 解除。signal は Issue ラベル / PR ラベルの 2 面）。人間はレビュー中、目の前の
  PR ラベルを外すだけでよい。実装は `tools/autopilot/src/phases.js` の `isHitlReleased`。

人間が判断/レビューに使う HITL ゲート: EPIC 理解・分解承認・人間レビュー（approve）・merge。

> **移行注意（#813）**: 走行中 daemon は再起動するまで旧コード（HITL フィールド読み）。この変更を
> merge + daemon 再起動して初めてラベル主体に切り替わる。既存の HITL フィールド値が残っていても
> daemon はラベルだけを見るので実害はない（Project の HITL 単一選択フィールドは将来削除可）。

---

## merge は独立した「前進シグナル」

PR が merge されたら、`🙋 HITL` ラベルが残っていても autopilot は前進する。

- **leaf Issue**: ひも付く PR が merge されたら Issue を **Close** へ進める（人間が `🙋 HITL` ラベルを
  別途外す必要はない。daemon が両面のラベルを除去する）。
- **EPIC**: 子 PR の merge では完了しない（後述の EPIC 運用）。

autopilot は **自動 merge しない**。daemon はポーリングのたびに「PR が出た後〜Close 前」の leaf
（Status が In Progress / Review / DoD）について、`Closes #<issue>` などで紐付く PR が **人間に
merge 済みか**を GitHub に問い合わせ（`closedByPullRequestsReferences`）、merge 済みなら Status を
**Close**・AI Status をクリアし、両面の `🙋 HITL` ラベルを除去する。close リンクは PR が
**非デフォルト base 宛て**（EPIC サブ Issue を親 epic ブランチに積む等）だと登録されないため、
close リンクで見つからなければ head ブランチ `topic/autopilot-<N>` の merged PR も見て base 非依存に
検知する（#831）。判定は `phases.js` の
`selectMergeCandidates` / `mergeProgressionIntents`（純粋関数）、問い合わせと書き込みは
`project.hasMergedPullRequest` と daemon の `applyMergeProgression`（ラベル除去は force 同期）。
実行中（run が所有する）item は触らない。

非デフォルト base 宛て PR では GitHub の `Closes #N` 自動 close が効かないため、Status を **Close**
へ進めた leaf は `project.closeIssue`（`gh issue close`・冪等）で **GitHub issue も明示的に閉じる**
（#843 Fix A）。

### closed-issue → Project Close 整合（#843 Fix B）

merge-progression は leaf の連携 PR merge しか見ないため、(A) 非デフォルト base 宛て PR で手動
close した leaf、(B) 統合 PR の `Closes #<epic>` で閉じた EPIC、(C) 人手で閉じた issue が Project に
取り残される。daemon はポーリングのたびに `applyClosedReconcile` で **GitHub 上で closed な issue**
（`project.listClosedIssueNumbers`）のうち Project Status が終端（Close / Done）でないものを
**Status=Close + AI Status クリア**へ整合する。closed という事実だけを根拠にするので **EPIC も対象**。
判定は `phases.js` の `selectClosedToReconcile`（純粋関数・終端は `TERMINAL_STATUSES`）。実行中
（run が所有する）item は触らない。冪等。

---

## implement→review の自動ディスパッチ（自己レビュー）

`autopilot-implement` が完了すると Status=`In Progress` / AI Status=`Self-Reviewing` / `🙋 HITL`
ラベル無しになる。daemon はこの状態を検知して **`autopilot-review`（敵対的レビュー）を自動ディスパッチ**
し、人間の介入なしに implement→review→（人間レビュー待ちの）Review/HITL まで前進させる。

- 判定は `phases.js` の `phaseForItem`（純粋関数）: `status==='In Progress' && aiStatus==='Self-Reviewing'`
  → `'review'`。`🙋 HITL` ラベルがあるときは人間の番なので渡さない。
- review は **既存 PR ブランチ**で作業する（`PR_BRANCH_PHASES` に含む）。
- 二重起動は daemon の running セットで防止（review 実行中も In Progress / Self-Reviewing のままだが
  `selectActionable` が running の item を除外する）。

---

## Review 解除後の自動遷移（address-review に一本化・#815）

`Review` の item は人間レビュー待ち（`🙋 HITL` ラベルあり）。人間がレビューを終えてラベルを外すと、
daemon は **構造化シグナル（approve/changes-requested）で機械的に分岐せず、必ず
`autopilot-address-review` を起動する**（`phaseForItem` が Review 解除 → `address-review`）。

approve でも本文に改善依頼が書かれていたり、"changes requested" でも実質 LGTM だったりと、
自由文の意図は構造化シグナルでは判定できない。そこで**判断はプロンプト側に置く**: address-review が
PR の **diff と全コメント（Issue/レビュー本文/インライン）**を読んで分類する。

| プロンプトの分類（HITL 解除後） | 対応 |
|---|---|
| 質問 | bot で返信（必要ならコード修正）→ 再レビューへ |
| 改善依頼 / 変更要求 | worktree で修正・push → 再レビューへ |
| LGTM / 対応不要 | 何もしない → 人間のマージ待ち |
| 判断がつかない | 論点を整理してコメント + `AUTOPILOT_HITL`（人間に質問） |

- 解除シグナルは **OR セマンティクス**: Issue の `🙋 HITL` ラベル / PR の `🙋 HITL` ラベルの
  **いずれか1つでも除去**なら解除（`getReviewContext` が2面を集め、`phaseForItem` が `isHitlReleased`
  で判定）。daemon が両面を atomic に同期する（後述「PR 側の状態可視化」）ので、人間は目の前の
  PR ラベルを外すだけで差し戻せる。
- address-review は **既存 PR ブランチ**で作業する（daemon が worktree を `--pr` で用意）。
- **コンフリクトは autopilot で解消しない**（rebase/merge コンフリクトは人間の役割）。プロンプトは
  解消を試みず HITL で人間に渡す。

---

## DoD — headful 検証の引き継ぎ生成（#821）

DoD（Definition of Done）は実機ブラウザでの確認が要る最終ゲート。**コンテナ内の daemon は
headless なので実ブラウザを動かせない**。そこで daemon は DoD を「自分で検証するフェーズ」では
なく「**ホスト側 Claude（headful Playwright）に渡す引き継ぎを生成するフェーズ**」として扱う。
LLM は in-container で回さず、**純粋な I/O + 文字列テンプレート**で完結する（child Claude 不要）。

### トリガと生成（daemon の tick ステップ）

人間がコードレビューを終え「次は DoD 検証」と判断して Status を **Review → DoD** にすると、daemon は
ポーリングのたびに `Status=DoD` の leaf について次を行う（`applyDodHandoffs`、`🙋 HITL` は維持）:

1. 連携 PR と Issue 本文の **DoD チェックリスト**を取得（`extractDodChecklist`）。
2. **プレビュー URL** を PR の CI コメントから拾う（`extractPreviewUrl`。
   `https://smalruby.jp/smalruby3-editor/<branch>/`）。
3. **テンプレートで引き継ぎ本文を生成**（`dodHandoffBody`）して `autopilot:dod-handoff` マーカー付き
   コメントを PR に投稿する。本文は「プレビュー URL ＋ Issue の DoD チェックリスト転記 ＋ 定型 headful
   手順（`?no_beforeunload=1`、スクショは `tmp/`→`docs/<feature>/screenshots/`、秘密情報は本文に
   書かずローカル `.env` 参照、本番 Chrome で確認）＋ 報告の出口」。
4. sticky ステータスコメントに「DoD 引き継ぎあり」の 1 行ポインタが出る（`renderSticky`。sticky 本体は
   上書きされない別コメント）。

**冪等**: 既に `autopilot:dod-handoff` コメントがあれば再投稿しない（`hasDodHandoffComment` /
`needsDodHandoff`）。判定は `phases.js` の純粋関数、I/O と投稿は `project.js` / daemon の
`applyDodHandoffs`。実行中（run が所有する）item は触らない。

### 報告の出口（ホスト Claude → 人間）

- **OK**: ホスト Claude が PR に「DoD 検証 OK」+ スクショ要約をコメントし、必要なスクショ commit を
  push。人間が merge → 既存 merge-progression が leaf を **Close**（DoD は `MERGE_CHECK_STATUSES`）。
- **NG**: ホスト/人間が PR に NG をコメントし `🙋 HITL` を外す → daemon が **DoD 解除 → address-review**
  を起動（Review と対称。`phaseForItem` が DoD 解除 → `address-review`、OR セマンティクスも同じ）。

> 既存の `autopilot-verify` プロンプト（`tools/autopilot/prompts/`）は手動 inject 用に残してよいが、
> 自動経路はこの daemon 生成（`applyDodHandoffs`）を使う（#821）。

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
PR 側は読み取り投影）。実装は daemon の `applyPrProjection`（ポーリングのたびに走る per-tick 同期）
と、フェーズ適用後・merge 前進後の権威的な同期 `syncFacesAfterIntents`（force）。判定は
`phases.js` の純粋関数（`labelActions` / `draftAction` / `renderSticky` / `selectPrSyncCandidates`）、
書き込みは `project.js`（`editLabels` / `setPrDraft` / `upsertStickyComment`）。実行中（run が
所有する）item は触らない（live phase と競合しない）。

| 手段 | 意味 | 同期ルール |
|---|---|---|
| `🤖 autopilot` ラベル | autopilot 管理対象（AI 処理対象） | Issue/PR に常時担保 |
| `🙋 HITL` ラベル | 人間の対応待ち（**HITL の唯一の真実**・#813） | 人間に渡すとき Issue/PR の両面に付与 / release・merge で除去 |
| Draft ⇄ Ready for review | Draft=AI 作業中 / Ready=人間が見る段階 | **Status 基準**（#815）: `Review`/`DoD`/`Close`/`Blocked`→Ready / それ以外（`In Progress` 等）→Draft |
| sticky ステータスコメント | bot が1コメントを編集し続け、連携 Issue の Project 状態を投影 | Status / AI Status / HITL（ラベル由来）/ Size をマーカー付き 1 コメントに upsert |

- 対象は連携 PR を持ちうる post-PR ステータス（In Progress / Review / DoD / Blocked）の leaf。
  EPIC は実装 PR を持たないので除外（`selectPrSyncCandidates`）。
- **Review 中の `🙋 HITL` ラベルは人間の「解除ジェスチャ」を兼ねる**ため、steady-state（per-tick）の
  同期では**人間が外したラベルを再付与しない**（解除シグナルを潰さない）。Review への handoff は
  force 同期で明示的に付与する（`hitlLabelAction` の `force` 分岐）。
- 「作業中」専用ラベルは作らない（Draft が兼ねる）。

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

すべての `autopilot-*` プロンプトは [`autonomous-contract.md`](./autonomous-contract.md) に従う。要点:

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
（2 秒ごとに `/status` をポーリング）。実行中 item の一覧・phase・pause/resume・**今すぐ確認
（即時 tick）**・各 item の force-stop・pane ログ閲覧ができる。

「⚡ 今すぐ確認」ボタンは interval（既定 5 分）を待たず `POST /tick` を叩いて 1 サイクルだけ
即実行する（レビュー直後など「今すぐ次を処理させたい」とき用）。実行中は再入防止で `409 busy`、
pause 中は no-op（`paused:true` で返る）。

HTTP API（curl からも操作可能）:

| メソッド・パス | 用途 |
|---|---|
| `GET /` | Web モニタ（HTML） |
| `GET /status` | `{paused, concurrency, running:[{issue,phase}]}` を JSON で返す |
| `GET /log?issue=<n>` | 実行中 item の tmux pane キャプチャ（人間観測用） |
| `POST /tick` | interval を待たず 1 サイクル即実行。`{ran, paused, picked:[...], running:[...]}` を返す。実行中は `409 {busy:true}`、pause 中は `{ran:true, paused:true, picked:[]}` の no-op |
| `POST /pause` | 新規ディスパッチを止める（実行中はそのまま） |
| `POST /resume` | ポーリング再開 |
| `POST /stop?issue=<n>` | その item の tmux セッションを kill して force-stop |
| `POST /inject?issue=<n>&phase=<p>` | 並行上限を超えて 1 フェーズを割り込み投入 |
| `POST /shutdown` | daemon プロセスを安全停止 |

```bash
curl -s localhost:8787/status | jq          # 状態確認
curl -X POST localhost:8787/tick | jq        # 今すぐ 1 tick 実行
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
| `docs/autopilot/autonomous-contract.md` | プロンプト/Runner の契約 |
| `tools/autopilot/prompts/autopilot-*/` | 各フェーズのプロンプト |
| `bin/autopilot-worktree` | 軽量 worktree スクリプト |
| `tools/autopilot/src/contract.js` | 番兵/結果ファイルの検証（純粋） |
| `tools/autopilot/src/phases.js` | フェーズ↔プロンプト、結果→フィールド意図、watchdog 判断、HITL 解除、merge-progression、PR 投影（純粋） |
| `tools/autopilot/src/project.js` | GitHub Projects v2 + Issue/PR ラベル・Draft・sticky への gh ラッパ |
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

- **worktree のプロンプト可用性**: `autopilot-*` プロンプトが対象ブランチに存在する必要がある（develop に
  マージ済みなら worktree でも解決可能）。
- **非対話権限**: runner は権限プロンプトで止まらない設定（許可ツール指定など）で claude を起動する。

---

## ライセンス

autopilot のツール群（`tools/autopilot/**`）と autopilot プロンプト（`tools/autopilot/prompts/autopilot-*/**`）は、
リポジトリ全体の AGPL-3.0 ではなく **MIT ライセンス**とする。詳細は `tools/autopilot/LICENSE` を参照。
