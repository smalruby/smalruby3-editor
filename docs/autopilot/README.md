# autopilot — Claude による Issue ライフサイクル自律オーケストレーター

> **🆕 Smalruby 独自** — 開発運用のために作られた仕組み。upstream（Scratch Foundation）には存在しない。

autopilot は、複数の GitHub Issue を Claude が**並行**して

> 起票 → トリアージ → 実装 PR → 敵対的レビュー → 人間レビュー → DoD → マージ

まで自律的に進めるための常駐プログラム群と運用規約。状態は smalruby organization の
専用 **GitHub Projects v2「Autopilot」** のフィールドで一元管理する。

設計の出発点となった課題と意思決定の経緯は Issue #760（EPIC）に集約されている。
プロンプト/Runner が従う詳細な契約は [`autonomous-contract.md`](./autonomous-contract.md)、
**状態遷移とそのトリガーの正準表**は [`state-machine.md`](./state-machine.md) を参照
（全状態の「出口」= 固着が無いことは `tools/autopilot/test/state-machine.test.js` が機械的に担保する）。

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
| **UI 確認ヘルパー** | worker が headless bundled chromium で UI を確認（スクショ `tmp/`・Playwright MCP は使わない・#891） | `tools/autopilot/bin/pw-check` |

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
| DoD | approve 後の DoD 検証（一般 UI は verify が headless で自己完結・#891 / 音・autoplay 等の実 Chrome 必須ケースのみ daemon がホスト引き継ぎ生成・#821） |
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
| Discussing | autopilot-discuss（実装前ディスカッション） | No Status / Backlog |
| Understanding | autopilot-understand | No Status / Backlog（EPIC） |
| Decomposing | autopilot-decompose | Backlog（EPIC→sub-issue） |
| EPIC Decomposed | —（親トラッカー化） | In Progress（EPIC） |
| Implementing / Creating PR | autopilot-implement | In Progress |
| Self-Reviewing | autopilot-review | In Progress |
| Addressing Comments | autopilot-address-review | Review / DoD（NG 差し戻し） |
| Running DoD | autopilot-verify（一般 UI は headless Playwright で自己完結・#891）／ 音・autoplay 等は daemon `applyDodHandoffs`（ホスト引き継ぎ生成） | DoD |

### その他フィールド

- **Size**（small / middle / large）— leaf Issue の重み付け（EPIC は付けない）
- **Kind**（EPIC / Issue）
- **Current Step / Worktree / Tmux Window**（text, observability）

---

## enroll モデル — 開発者個人ごとの daemon と担当者ベースの取り分け

プロジェクトに携わる**開発者個人個人が自分の autopilot（daemon）を起動する**運用を想定する。
daemon に `--assignee <GitHub login>`（または env `AUTOPILOT_ASSIGNEE`）を渡すと:

- **自分がオーナーの item だけ**を処理する。オーナー = **assignee の辞書順先頭**
  （複数 assignee の Issue を複数開発者の daemon が同時に拾わない決定的タイブレーク）。
- **未 assign の item は誰も拾わない**。Issue を autopilot に処理させる enroll 手順は
  「① Project に追加 → ② 担当者を assign → ③ Status を設定（例 Sprint Backlog）」。
- `--assignee` 未指定は従来どおり全件処理（単一 daemon 運用）。

### 投入順は Project Board view の見た目

着手候補は **Board view の見た目**（Status 列順 = Status フィールドの option 定義順、
列内は Project の手動並び順）で評価する。Project 上で上に置いた item から処理される。

### 本文ディレクティブ（行頭のみ反応）

Issue 本文の**行頭**に書くディレクティブで挙動を制御できる（本文中の言及では発火しない。
行頭からの HTML コメント `<!-- ... -->` 内でも可）:

| ディレクティブ | 意味 |
|---|---|
| `autopilot-base: <branch>` | PR 先・worktree 分岐元のベースブランチ（EPIC サブ Issue を親 epic ブランチに積む等） |
| `autopilot-after: #N [#M ...]` | 依存宣言。N（と M …）が完了（GitHub closed / Project Close・Done）するまで着手しない。ブロック中は次点候補が繰り上がる |

### 🧭 tracking ラベル（分解済み親のトラッカー化）

sub-issue に分解済みの親（Kind=EPIC）には daemon が **`🧭 tracking` ラベル**を付与する。
以後の tick はラベルだけで「作業 item ではない」と判定でき、merge 検知・PR 投影・
フェーズ選択から低コストに除外される（完了は closed-reconcile が拾う）。人間が任意の
Issue に手動で付けてトラッカー化してもよい（autopilot は外さない。外せば作業 item に戻る）。

---

## 実装前ディスカッション（discuss フェーズ）

triage が「実装方針の合意が必要」（Size=large・設計分岐・要件曖昧）と判断した leaf は、
方針提案コメントを投稿して **Backlog + AI Status=Discussing + `🙋 HITL`** で人間に渡す。

- 人間が**返信する**（コメントするだけでよい。`🙋` を外しても同じ）と daemon が
  `autopilot-discuss` を起動し、承認なら **Sprint Backlog を返して implement へ直接ハンドオフ**、
  継続なら改訂提案を同じスレッドに積んで再び人間へ。
- **議論の往復中 Status は Backlog に固定**され、triage との再提案ループでステータスが
  固着・振動しない。見送り（Icebox）への遷移は人間の確定操作のみ（提案では動かさない）。

---

## HITL（Human In The Loop）— `🙋 HITL` ラベルに一本化（#813）

HITL は「人間の番」を表す。状態は **`🙋 HITL` ラベル**が唯一の真実で、Issue と PR の両面に投影される
（Project に HITL フィールドは設けない／daemon は読まない・書かない）。**PR は Project フィールドを
持てない**ため、ラベルなら 1 系統で Issue/PR を賄え、成果物ページにも見える。set と release で
非対称のルールを持つ。

- **set（人間に渡す）**: daemon が **Issue/PR の両面に一括で `🙋 HITL` ラベルを付与**して整合を保つ。
- **release（AI に戻す）**: 次の **どちらでも**解除される（固着防止・詳細は
  [`state-machine.md`](./state-machine.md)）:
  1. **ラベル解除**: Issue / PR いずれかの `🙋 HITL` ラベルを外す（OR 解除・`isHitlReleased`）
  2. **発言解除**: ゲート開放中に**人間が最後に発言**した（Issue コメント / PR コメント /
     レビュー送信。`humanSpokeLast`）。ラベルを触らずレビューコメントだけ出しても止まらない。
     bot の応答・daemon の処理済み watermark より後の発言にのみ反応するので空回りしない

人間が判断/レビューに使う HITL ゲート: 実装前ディスカッション・EPIC 理解・分解承認・
人間レビュー（approve）・DoD・Blocked の対処・merge。

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

- 解除は **2 系統の OR**: (a) Issue / PR いずれかの `🙋 HITL` ラベル除去、(b) ゲート開放中の
  **人間の発言**（レビュー送信・コメント。ラベルを触らなくてよい）。`getGateContext` が
  ラベル 2 面 + 発言アクティビティを集め、`phaseForItem` が `isGateReleased` で判定する。
  daemon が両面を atomic に同期する（後述「PR 側の状態可視化」）ので、人間は目の前の
  PR ラベルを外すだけでも、コメントを返すだけでも差し戻せる。
- address-review は **既存 PR ブランチ**で作業する（daemon が worktree を `--pr` で用意）。
- **コンフリクトは autopilot で解消しない**（rebase/merge コンフリクトは人間の役割）。プロンプトは
  解消を試みず HITL で人間に渡す。

---

## DoD — headless 確認と headful 引き継ぎ（#891 / #821）

DoD（Definition of Done）は最終ゲート。確認手段は **UI 種別で分かれる**。

**worker は bundled chromium を headless で動かせる**（#891 で実証）。したがって **一般的な UI 確認は
verify フェーズ（`autopilot-verify`）が headless Playwright で自己完結**する（`tools/autopilot/bin/pw-check`
ヘルパー。Playwright MCP は host Chrome 依存で使わない）:

- **自己完結ページ（autopilot monitor 等）**: dev server 不要。daemon の `http://localhost:8787/` を開くか、
  `MONITOR_HTML` を静的 serve して確認。
- **scratch-gui の UI**: dev server（`localhost:8601`）が必要。プレビュー URL があれば優先、無ければ起動して待機。

**音・autoplay など実 Chrome が必須のケースだけ**、従来どおり daemon が「**ホスト側 Claude（headful
Playwright / 実 Chrome）に渡す引き継ぎを生成する**」。LLM は in-container で回さず、**純粋な I/O + 文字列
テンプレート**で完結する（child Claude 不要）。

### 引き継ぎのトリガと生成（daemon の tick ステップ・限定ケース）

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

> 一般 UI の DoD は `autopilot-verify` プロンプト（`tools/autopilot/prompts/`）が headless Playwright で
> 確認する（#891）。この daemon 生成（`applyDodHandoffs`）の引き継ぎは **音・autoplay 等の実 Chrome 必須
> ケース**向けに限定される（#821）。

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

## worker 設定（フェーズ別 model / effort・追加ディレクトリ）と起動時スナップショット

worker（子 claude）の起動構成は `tools/autopilot/src/settings.js` の
**DEFAULT_SETTINGS（推奨構成: 実装・レビュー系 = opus、分類・対話系 = sonnet）** を基底に、

1. リポジトリ共通の `tools/autopilot/settings.json`（任意・コミット可）
2. 開発者ごとの `~/.config/autopilot/settings.json`（または env `AUTOPILOT_SETTINGS` のパス）

の順で deep merge して決まる。設定例:

```json
{
  "addDirs": ["~/ghq"],
  "phases": {
    "default": { "effort": "medium" },
    "implement": { "model": "opus", "effort": "high" }
  }
}
```

- `addDirs` は worker に読み書きを許可する追加ディレクトリ（`--add-dir`）。参照リポジトリ群
  （ghq 等）を許可する用途。
- `phases.<phase>.model` / `.effort` / `.args` でフェーズ単位に上書き。`effort` は
  `--effort` フラグになるため、対応していない Claude Code では指定しない（既定は未指定）。
- env `AUTOPILOT_CLAUDE_CMD` は従来どおり**最優先**（settings を使わず固定コマンドで起動）。

daemon は**起動時にプロンプト一式 + 解決済み settings を tmpdir へスナップショット**し、
run 中に checkout のブランチが切り替わってもプロンプト/設定が変わらない（worker は
スナップショットの絶対パスを Read する。`--add-dir` は daemon が自動で付与）。

### 許可プロンプトで停止しない — `auto` モード + プロンプト検知→即 HITL

worker は**非対話**で動くので、許可プロンプトで止まると運用が止まる。worker は
**コンテナ内 root** で動くため、`bypassPermissions`（= `--dangerously-skip-permissions`）は
使えない（root で拒否 + 社内規定でも禁止）。そこで **`--permission-mode auto`** を採用する:

- **`auto` モード**は AI classifier（`claude auto-mode defaults` の allow / soft_deny / hard_deny
  ルール）が **通常の開発操作を自動許可・危険操作を自動拒否**し、**対話プロンプトを基本出さない**。
  `bypassPermissions` の「全バイパス」とは異なり危険操作は自動拒否するので、規定に抵触しにくい。
  root でも起動できる。
- **`auto` モードでは allowlist（`--allowedTools` / `permissions.allow`）は機能しない**（classifier が
  判定を握る）。そのため `buildClaudeCommand` は `auto` のときこれらを**出力しない**
  （`acceptEdits` 等にフォールバックしたときの保険として定義だけ残す）。
- **それでも判断を要して稀に対話プロンプトが出た場合は、待たせず即 HITL に落とす**:
  `runner.js` の `PROMPT_RE`（`❯ 1.` 選択肢 / `Esc to cancel` フッター等）で人間入力待ちを検知し、
  watchdog `tPromptMs`（既定 6 秒）超で `evaluate` が `hitl` を返す → daemon が Blocked/🙋 にして
  人間へ渡す（restart しない＝同じプロンプトの再発を避ける）。プロンプトは**出したまま待たせない**。
- review/verify フェーズは、トークンを大量消費する `/code-review` などの **動的 Workflow を起動しない**
  （プロンプト内で軽量なインライン敵対的レビューを行う。`autopilot-review.md`）。
- セキュリティ上の位置づけ: `auto` は「全許可(bypass)」ではなく **classifier による限定自動許可**。
  devpod はディスク隔離 + egress allowlist 前提（`.claude/rules/devpod-workflow.md`）。

---

## 認証の無人運用（Secrets Manager / SSO auto-pause）

- **GitHub App 秘密鍵**: `~/.config/smalruby-bot/config` に `PRIVATE_KEY_SECRET_ID`
  （+ 必要なら `AWS_PROFILE` / `AWS_REGION`）を設定すると、`bin/bot-token` が
  **AWS Secrets Manager から秘密鍵を取得**する（生 `.pem` の各自配付を廃止。ローカル
  `.pem` はフォールバック）。
- **SSO 失効の検知と auto-pause**: daemon は interval ごとに認証ヘルスチェックを行い、
  bot トークンが取得できなくなると **auto-pause**（`pausedBy: "auth"`）して Web モニタに
  再認証手順（`aws sso login --sso-session smalruby --use-device-code`）を表示する。
  再認証して回復すると**自動で resume** する（人間が押した pause は上書きしない）。
- **モニタからワンクリック再認証（device code）**: ブラウザの無い devpod 向けに、認証エラー
  バナーの **「🔐 再接続（SSO ログイン）」** ボタン（`POST /reauth`）が daemon 側で
  `aws sso login --use-device-code` を起動し、出力から**認証 URL と user code** を抽出して
  モニタに表示する。ボタンは**認証ページを別タブで自動オープン**し、**コードはコピー
  ボタン**付きで出す。ホストのブラウザでコードを承認すれば `aws sso login` が完了し、
  次の認証ヘルスチェックで **auto-resume** する（`onSuccess` で即時再チェック）。

---

## Bot 権限外パス（workflows 等）は個人トークンで push / PR

GitHub App bot は `workflows` 権限を持たないため、`.github/workflows/**` /
`.github/actions/**` を含む push は拒否される。push には **`bin/autopilot-push`** を使う:

- 変更にこれらのパスが**含まれない** → `bin/bot-git push`（Bot 名義・通常経路）
- **含まれる** → 個人クレデンシャルの plain `git push` に自動で切り替わる
  （`route=personal` を出力）。この場合プロンプトは PR も plain `gh`（個人トークン）で作成し、
  **`👥 human-review-required` ラベル**を付けて**作成者本人以外のレビューを必須**にする
  （autopilot の想定外領域の変更には他人の目を通す）。

---

## Web モニタ（俯瞰ボード）

daemon の `GET /`（既定 `http://localhost:8787/`）は **enroll 済み Issue の俯瞰ボード**
（読み取り専用・縦並び）を first view に表示する。操作（Status 変更・並び替え）は
GitHub Projects で行い、モニタは俯瞰・log 閲覧・pause/resume/即時 tick に徹する。

- **1 行のコンパクトヘッダー（3 セクション）**: **左**にタイトル + 状態 pill（RUNNING/PAUSED/AUTH ⚠）
  + 操作群（⏸/▶/⚡tick/**🔄 更新**）、**中央**に Claude 使用量、**右**にメタ情報（assignee・並行数・
  実行中・API 残・更新時刻）。右メタは固定幅 + 右寄せ + `tabular-nums` にして、`更新 Xs前` の桁変化や
  `API残`/`実行中` の増減で内容幅が変わってもヘッダーのどの要素も水平位置が動かない。中央 usage も
  内部の可変要素を `min-width` で予約して幅を一定に保つ。狭い幅（≤ 960px）では中央 usage を隠して
  右メタと重ならないようにする
- **スティッキーフッター**: **稼働バージョン（`branch @ shortCommit`）** + **⬆️ 更新ありバッジ**。
  常時見えるフッターに置き、押すと更新手順モーダルを表示する（#885）
- **Claude 使用量（ヘッダー中央）**: Claude アイコン + **セッション使用率**（rolling 5 時間制限）と
  **週間使用率**（全モデルの 7 日制限）を、それぞれ短いバー + `NN%` で表示する。使用量が上限に
  達すると autopilot だけでなく人間の開発も止まるため、早めに気づけるよう常時可視化する。
  使用量は **worker 実行時のみ更新**される（下記のとおりデータ源が status line の `rate_limits`）ため、
  最終更新からの経過（age）を薄字で併記し、**90 秒以上更新が無ければ黄色（stale）表示**にして
  worker 非稼働中の据え置きが分かるようにする。
  値の取得: `rate_limits`（`five_hour` / `seven_day` の `used_percentage`）は **Claude Code の
  status line の stdin JSON にのみ**含まれる（transcript JSONL・CLI・キャッシュには出力されない）。
  worker は対話 TUI（tmux）で動くので status line が描画される点を利用し、worker 起動時に
  `--settings` で **`tools/autopilot/bin/usage-statusline.sh`** を status line に仕込み、
  `rate_limits` を usage ファイル（`os.tmpdir()/autopilot-claude-usage.json`）へ書き出させる。
  daemon は **worker 実行のたびに**そのファイルを読み（`tools/autopilot/src/usage.js`）
  `state.claudeUsage` に反映し、`GET /board`・`GET /status` にも `claudeUsage` として載る。
  **used ≥ 80% は警告色**。Pro/Max サブスク以外や初回 API 応答前は `rate_limits` が無いため
  **「—」表示**にしてレイアウトを崩さない。
- **アラート帯**: 認証失効（auto-pause 中・再認証手順つき + **「🔐 再接続（SSO ログイン）」
  ボタン**で device code の URL 自動オープン & コードのコピー）/ Blocked 一覧。
  各アラートに **`check autopilot (#N)` のコピー用ショートカット**があり、Claude に
  貼ると `.claude/skills/check-autopilot` スキルが診断・復旧支援する
- **ボード行**: Issue（リンク + タイトル）/ Status pill / AI Status（live）/ 担当 /
  **複数 PR チップ**（📝 draft / ✅ ready / 🟣 merged / ❌ closed の色・絵文字）/
  **sub-issue 進捗**（N/M・%・バー）/ Now（実行中フェーズ + 経過分 + **log ボタン → モーダル**）
- **除外**: Close / Done / Icebox はボードに出さない（溜まると重くなるため）。さらに
  `--assignee` 起動時は **daemon の処理対象と同じ enroll 判定（ownsItem）に限定**する
  （「ボードには映るが daemon は素通り」という不一致を無くす。未指定は全件）
- **稼働バージョン + 更新検知**（#885）: 下の「稼働バージョン表示と更新検知」を参照
- **実行履歴**は最下部（最新 100 件・ログ用途のみ）
- データは `GET /board`（**poll/tick 後に再構築されるキャッシュ** + live running）。
  board の再取得（`listItems`）は 1 回 ~100 GraphQL ポイントと重いため、**専用の短周期
  タイマーは持たない**（旧: 60 秒ごと → read トークンの GraphQL 予算 5000/h を単独超過し
  枯渇していた）。すぐ最新化したいときはヘッダーの **「🔄 更新」ボタン（`POST /refresh`）**
  でオンデマンド取得する（見たいときだけ消費）。ブラウザ側は 5 秒ごとに `/board`（キャッシュ）を
  ポーリングして描画するだけなので GraphQL は消費しない

### 稼働バージョン表示と更新検知（#885）

daemon はモジュールを**起動時にロード**するので「動いているコード = 起動時のコミット」。
以降 working tree が進んでも稼働中コードは起動時コミットのままなので、**今どのブランチ・
どのコミットで動いているか**を常時可視化し、さらに `tools/autopilot/` に更新があるかを
定期チェックして「再起動が必要か」を判断しやすくする。

- **稼働バージョン**: daemon は起動時に動作中 checkout（`project.REPO_ROOT`）の
  `git rev-parse --abbrev-ref HEAD`（ブランチ）と `HEAD`（コミット・`--short` も）を取得して
  `state.version = {branch, commit, shortCommit}` に保持し、`GET /board`・`GET /status` に載せる。
  モニタのフッターに `develop @ 9380da0` のように**常時表示**する（取得できなければ「version —」）。
- **更新検知（~15 分ごと）**: 起動直後に 1 回 + 以降 15 分間隔（`unref` タイマー）で
  既定ブランチ（`origin/develop`）を `git fetch`（remote-tracking ref のみ更新・working tree は
  触らない）し、`git log <起動時コミット>..origin/develop -- tools/autopilot` の件数で
  **更新あり**を判定する。結果は `state.autopilotUpdate = {available, behind, commits, checkedAt, error}`
  として `/board`・`/status` に載る。private repo なので fetch の認証は既存の gh credential
  helper に委ねる。**失敗（ネットワーク/認証）時は前回値（available/behind/commits）を保持**し、
  `error` だけを控えめに surface して表示を崩さない。頻度は `UPDATE_CHECK_INTERVAL_MS` 定数で調整可能。
- **更新ありの表示 + 更新手順**: 更新ありのときフッターに **`⬆️ 更新あり（N 件）`** バッジを表示。
  押すと**更新手順モーダル**（テキスト表示のみ・実行はしない）を出す:
  - 主導線: Claude の autopilot セッションで **`update autopilot`** と指示（コピー用ボタンつき）
  - 手動手順: `curl -X POST localhost:8787/shutdown` → `/app` で `git pull` →
    `bash tmp/autopilot_up.sh` で再起動
  - `tools/autopilot` の差分コミット一覧（短 SHA + 件名）も表示
- 実装: 判定は `tools/autopilot/src/version.js`（`readVersion` / `checkAutopilotUpdate` —
  git は `execFile` で実行し `deps.execFileP` で差し替え可能）、daemon 連携は
  `checkForUpdate` / `startUpdateChecks`（`tools/autopilot/src/daemon.js`）。

---

## GitHub API レート制限対策

Bot 単独・GraphQL 偏重だとレート制限に当たる（実測: Bot の GraphQL 残 0 / REST 残 4987）。
次の分散・削減を行う:

| 対策 | 内容 |
|---|---|
| **トークン分散** | **書き込み**（コメント・ラベル・Draft/Ready・Project 編集・close）= Bot（名義が見える操作）。**読み取り**（一覧・PR/Issue 情報・レビュー状態・アクティビティ）= 個人トークン（`AUTOPILOT_READ_TOKEN` → env `GH_TOKEN` → `gh auth token` → Bot フォールバック）。`AUTOPILOT_READS=bot` で従来動作 |
| **GraphQL / REST の使い分け** | バッチ読み（ボード enrichment・closed 状態一括確認・レビュー状態）= GraphQL（alias 50〜100 件/回）。単発読み（PR 情報 `/pulls/N`・Issue メタ `/issues/N`・コメント一覧）= REST。別枠の予算を並行活用する |
| **問い合わせ対象の限定** | Issue/PR の広い問い合わせは **`🤖 autopilot` ラベル付き限定**（label healing が非終端 item に毎 tick 担保）。**ステータス限定**: 終端（Close/Done）は定常問い合わせから除外。旧「リポジトリ全体の closed 一覧（最大 1000 件 × 毎 tick）」は廃止し、**非終端 item + `autopilot-after` 依存先だけ**の state をバッチ確認（`getIssueStates`） |
| **書き込み削減** | sticky コメントは**内容が変わったときだけ** PATCH（`stickyUpsertPlan`）。Issue ラベルは item-list の値を再利用して面同期の再取得を廃止 |
| **残量監視・自動退避** | `rate_limit`（レート消費なし）を tick ごとに Bot / 個人の両方で確認し、最小残量をモニタに表示。**残量 < 200 で低優先処理（PR 面投影・ボード更新）を自動スキップ**（warn は < 500）。dispatch・merge 検知は継続し、回復で自動復帰 |

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
`--port` / `--once` / **`--assignee <login>`**（enroll モデル: 自分がオーナーの item だけ処理。
env `AUTOPILOT_ASSIGNEE` でも可）。起動すると PID ファイル（`$TMPDIR/autopilot-daemon.pid`、通常
`/tmp/autopilot-daemon.pid`）を書き、ログを stderr に出す。バックグラウンド常駐は tmux か
`nohup ... &` で。

```bash
# tmux で常駐させる例
tmux new -d -s autopilot 'node tools/autopilot/bin/autopilot daemon 2>&1 | tee /tmp/autopilot-daemon.log'
```

#### 監視（Web モニタ）

ブラウザで **`http://localhost:8787/`** を開くと**俯瞰ボード**が表示される
（5 秒ごとに `/board` をポーリング。詳細は上の「Web モニタ（俯瞰ボード）」）。

「⚡ tick」ボタンは interval（既定 5 分）を待たず `POST /tick` を叩いて 1 サイクルだけ
即実行する（レビュー直後など「今すぐ次を処理させたい」とき用）。実行中は再入防止で `409 busy`、
pause 中は no-op（`paused:true` で返る）。

HTTP API（curl からも操作可能）:

| メソッド・パス | 用途 |
|---|---|
| `GET /` | Web モニタ（俯瞰ボード HTML） |
| `GET /board` | 俯瞰ボードデータ（items + running + history + auth 状態 + `claudeUsage` + `version` + `autopilotUpdate`）を JSON で返す |
| `GET /status` | `{paused, pausedBy, authError, reauthHint, reauth, assignee, concurrency, claudeUsage, version, autopilotUpdate, running:[{issue,phase}]}` |
| `GET /log?issue=<n>` | 実行中 item の tmux pane キャプチャ（人間観測用） |
| `POST /tick` | interval を待たず 1 サイクル即実行。`{ran, paused, picked:[...], running:[...]}` を返す。実行中は `409 {busy:true}`、pause 中は `{ran:true, paused:true, picked:[]}` の no-op |
| `POST /pause` | 新規ディスパッチを止める（実行中はそのまま） |
| `POST /resume` | ポーリング再開 |
| `POST /reauth` | SSO 再認証（device code）を daemon 側で起動し、認証 URL と user code を抽出して返す（`{status, url, code, completeUrl}`）。成功で auto-resume |
| `POST /refresh` | 俯瞰ボードを即時再取得（`listItems`）。モニタの「🔄 更新」ボタン。レート僅少時は `{refreshed:false, skipped:'rate-limited'}` で no-op |
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

`phase` は `triage` / `discuss` / `understand` / `decompose` / `implement` / `review` /
`address-review` / `verify`（`tools/autopilot/src/phases.js` の `PHASE_BY_COMMAND`）。

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
| `docs/autopilot/state-machine.md` | 状態遷移とトリガーの正準表（固着防止の不変条件） |
| `tools/autopilot/prompts/autopilot-*/` | 各フェーズのプロンプト |
| `bin/autopilot-worktree` | 軽量 worktree スクリプト |
| `bin/autopilot-push` | push 経路の自動判定（Bot / 個人トークン。権限外パス対応） |
| `tools/autopilot/src/contract.js` | 番兵/結果ファイルの検証（純粋） |
| `tools/autopilot/src/phases.js` | フェーズ↔プロンプト、結果→フィールド意図、watchdog 判断、ゲート解除、merge-progression、PR 投影、enroll/並び順、ディレクティブ、サニタイズ（純粋） |
| `tools/autopilot/src/settings.js` | worker 設定（フェーズ別 model/effort・addDirs）+ スナップショット |
| `tools/autopilot/src/project.js` | GitHub Projects v2 + Issue/PR ラベル・Draft・sticky への gh ラッパ（非同期） |
| `tools/autopilot/src/runner.js` | tmux runner + watchdog |
| `tools/autopilot/src/daemon.js` | 常駐 daemon（ポーリング・ディスパッチ・HTTP 制御・認証ヘルスチェック・俯瞰ボード） |
| `tools/autopilot/src/monitor.js` | Web モニタ（俯瞰ボード・自己完結 HTML） |
| `tools/autopilot/src/usage.js` | usage ファイルから Claude 使用率（session/weekly）を読む純粋関数 |
| `tools/autopilot/bin/usage-statusline.sh` | worker の status line。stdin JSON の `rate_limits` を usage ファイルへ書き出す |
| `tools/autopilot/src/cli.js`, `bin/autopilot` | CLI（単発フェーズ + `daemon` サブコマンド） |
| `tools/autopilot/test/` | unit テスト（状態遷移網羅 `state-machine.test.js` を含む） |
| `.claude/skills/autopilot/` | 総合サポートスキル（初期化インタビュー→`tmp/autopilot_up.sh` 生成・enroll ショートカット・運用支援。`init autopilot` / `autopilot開始` / `go autopilot` 等で起動） |
| `.claude/skills/check-autopilot/` | モニタのショートカットに対応する診断・復旧支援スキル |

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
