# autopilot — 状態機械・ラベル・単一ライターの規約

状態遷移の**正準表と不変条件の解説**は `docs/autopilot/state-machine.md`。本ファイルは
「変更するときに何と何を対で更新するか」「逸脱をどう見分けるか」に限定する。

## 状態・トリガーを変更するときの 3 点セット（必須）

`phaseForItem` / `isGateReleased` / select 系（`tools/autopilot/src/phases.js`）、
Status / AI Status / ラベルの集合を変更したら、**必ず次の 3 つを同時に更新**する:

1. `tools/autopilot/src/phases.js` の純粋関数
2. `docs/autopilot/state-machine.md` の遷移表
3. `tools/autopilot/test/state-machine.test.js` の期待値（HUMAN_DRIVEN whitelist / gate 集合）

このテストは Status × AI Status × HITL × Kind × 解除シグナルの全組み合わせを列挙して
「**出口の無い状態が存在しない**」ことを機械的に担保する。テストを黙らせる方向の変更
（whitelist に安易に足して出口なし状態を許す等）は逸脱。

### 遷移設計の不変条件（要点。全文は state-machine.md）

- **I1 出口保証**: すべての非終端状態に A（フェーズ）/ D（daemon tick）/ H（人間）いずれかの
  出口トリガーを定義する。
- **I2〜I3 ゲート解除**: 人間ゲート（Review / DoD / Blocked / Discussing / Awaiting
  Continuation）の解除は **3 系統の OR**（ラベル解除 / 発言解除 `humanSpokeLast` /
  changesRequested 解除 `hasUnhandledChangesRequest`）。新しいゲートを作るときも
  「ラベルを触らずコメントだけ返す人間」で固着しないこと。解除後の `phaseForItem` は
  必ず非 null。
- **I4 提案で退避系へ動かさない**: `signal=hitl` の `nextStatus` に **Icebox / Close / Done を
  提案しない**（プロンプト側の規約。出口の無い状態に落ちる）。Icebox への遷移は人間のみ。
- **I5 再発火防止**: 解除シグナルには watermark（`state.gateHandled` /
  `state.gateReviewHandled`）を対で用意し、同じ発言・同じレビューで毎 tick 再発火させない。

## 単一ライター原則（書き込み責務の分離）

| 書き込み対象 | 書いてよいのは | 備考 |
|---|---|---|
| Project フィールド（Status / AI Status / Size / Kind） | **daemon / CLI のみ**（`project.applyIntents`） | プロンプトは結果ファイルで意図を伝えるだけ（`applyResult` が意図に変換） |
| `🙋 HITL` ラベル（Issue/PR 両面） | **daemon のみ**（face sync） | プロンプトは `hitl` / `signal=hitl` で希望を伝える（`hitlDesireFromResult`） |
| Issue / PR への副作用（コメント・PR 作成・sub-issue 作成・commit・sub-issue の assignee / `🤖 autopilot` ラベル） | **プロンプト（worker）** | Issue 自体のプロパティは Project 状態と別物（#914） |
| PR の Draft/Ready・sticky コメント・その他投影ラベル | **daemon**（PR 投影・face sync） | Project が真実、PR 側は読み取り投影 |

逸脱例: プロンプトが `gh project item-edit` を直接叩く / daemon 以外が 🙋 を付け外しする
コードを書く — どちらも二重ライター競合を生むので却下。

## ラベル規約（定数は `phases.js` に集約）

| ラベル | 定数 | 意味 | 付け外しの主体 |
|---|---|---|---|
| `🤖 autopilot` | `AUTOPILOT_LABEL` | autopilot 管理対象。**広い GitHub 問い合わせの限定キー**を兼ねる | daemon が非終端 item に毎 tick 担保（label healing）。外さない |
| `🙋 HITL` | `HITL_LABEL` | 人間の番（**HITL の唯一の真実**・#813。Project に HITL フィールドは無い） | set = daemon が Issue/PR 両面へ一括付与。release = 人間（どちらか片面の除去で OR 解除）。steady-state 同期では**人間が外したラベルを再付与しない**（`hitlLabelAction` の force 分岐） |
| `🧭 tracking` | `TRACKING_LABEL` | 分解済み親のトラッカー（作業 item ではない） | daemon が**分解済み**（`subIssues.total > 0`）の Kind=EPIC に付与（`labelActions`）。**未分解 EPIC には付けない**（付けると `phaseForItem` が decompose 前に締め出して分解が走らないデッドロックになる・#680/#681/#1130）。**自動では外さない**（人間の手動トラッカー指定を潰さない） |
| `⏳ waiting` | `WAITING_LABEL` | `autopilot-after` の先行 Issue 待ち | daemon が**毎 tick 状態から動的に導出**して付け外し（`waitingLabelAction`）。静的に一度付ける実装にしない |
| `👥 human-review-required` | `HUMAN_REVIEW_LABEL` | Bot 権限外パスを含む PR（個人トークン経路） | プロンプトが付与。**autopilot は外さない**（外すのは人間） |

### ラベル判定は `labelActions()` が唯一の真実（二重定義しない）

ラベルの付け外しを決める判定は **`phases.js` の `labelActions()`（と薄いラッパ
`healingLabelActions()`）だけ**に置く。daemon の label healing（`applyLabelHealing`）は
この純粋関数を呼ぶだけで、**同じ判定を自前で書かない** — 判定を 2 経路に持つと
`decomposed` ガードのような後付け修正が片方にしか当たらず、未分解 EPIC への 🧭 付与
（= decompose デッドロック）が復活する（#1130 が #680/#681 の再発）。

- Project の item-list は sub-issue 件数を返さないため、healing は 🧭 未付与の EPIC についてのみ
  件数を補完してから判定する（board キャッシュ優先 + 不足分だけバッチ GraphQL）。
  **件数が取れないときは 🧭 を付けない**（デッドロック側に倒れない安全側の既定）。
- healing は **🙋 HITL を扱わない**（`skipHitl`）。人間が外した 🙋 は解除シグナルなので、
  healing が再付与すると今度は人間ゲートで固着する。🙋 の同期は面投影（`syncFacesForItem`）の責務。
- 同じ理由で、ゲート ctx 収集の対象判定（`isGateItem`）も `phaseForItem` と同じ `phases.js` に置く。

新しいラベルを追加するときは: phases.js に定数 + 純粋な action 関数 → daemon が実行、の形に
する（ラベル名リテラルを daemon / プロンプトに直書きしない）。

## フェーズ・AI Status の正準

- フェーズ名 ↔ プロンプト ↔ AI Status の対応の正準は `phases.js` の **`PHASE_BY_COMMAND`**
  （+ checkpoint 用 `AWAITING_CONTINUATION_STATUS`）。
- **新フェーズを追加する手順**: ① `PHASE_BY_COMMAND` にエントリ追加 →
  ② `tools/autopilot/prompts/<skill>.md` を作成（規約は
  `.claude/rules/autopilot/prompts.md`）→ ③ `settings.js` の `DEFAULT_SETTINGS.phases` に
  model 推奨値 → ④ `phaseForItem` に遷移を組み込み 3 点セット更新 →
  ⑤ `docs/autopilot/README.md` の AI Status 表を更新。
- GitHub Projects 側の AI Status option 追加は**人間の操作**（daemon は option を作れない）。
  コードだけ足して option 未追加だと `setField` が失敗する。

## checkpoint（協調的チェックポイント・EPIC #906）の表現規約

- **専用の signal 値を作らない**。checkpoint は既存の `signal:"hitl"` に
  `nextAiStatus:"Awaiting Continuation"` を乗せた形で表現する（`isCheckpointResult`）。
  `contract.js` の `SIGNALS` / `TOKENS` / `validateResult` に checkpoint 分岐を足すのは逸脱。
- `nextStatus` は付けない（Status は In Progress のまま）。checkpoint は**常に HITL**。
- continuation ファイルは `tmp/autopilot-continuation-<issue>.md`（`continuationFilePath`）。
  冒頭マーカー `<!-- autopilot-continuation issue=N phase=P iteration=I -->` +
  見出しは **「完了済み / 残タスク / 次の一手 / 継続して安全か」の日本語 4 つ固定**
  （daemon の `parseContinuationFile` が固定フォーマットとして読む。見出しを変えたら parser と
  autonomous-contract.md §2.5 を対で更新）。
- 反復上限は `DEFAULT_MAX_CHECKPOINT_ITERATIONS = 3`（超過で Blocked へエスカレーション）。

## bot コメントのマーカー規約

daemon / プロンプトが GitHub に置く「機械が識別するコメント」は必ず **HTML コメントの
マーカー**を持ち、**冪等判定とセット**で実装する（毎 tick / 再実行で重複投稿しない）:

| マーカー | 用途 | 冪等の仕組み |
|---|---|---|
| `<!-- autopilot-sticky-status -->`（`STICKY_MARKER`。旧 `<!-- autopilot:sticky -->` も検出対象） | sticky ステータスコメント | `stickyUpsertPlan` — 本文が同一なら **PATCH スキップ**、重複は先頭に集約して削除 |
| `<!-- autopilot:dod-handoff issue=N pr=M -->` | DoD headful 引き継ぎ | `hasDodHandoffComment` — 既にあれば再投稿しない |
| `<!-- autopilot-pr-link -->` | 非デフォルト base 宛て PR の Issue 側リンク | **base 非デフォルト時のみ**投稿（`needsPrLinkSticky`） |
| `<!-- autopilot-continuation ... -->` | checkpoint の残タスク | ファイル + コメント。iteration で世代管理 |
| `<!-- autopilot-tracker-status -->`（`TRACKER_STICKY_MARKER`） | 分解済み EPIC（トラッカー）Issue 本体の sub-issue 進捗 + Close 指示（#934） | `upsertMarkedComment` → 内部で `stickyUpsertPlan` を再利用（本文同一なら PATCH スキップ）。対象選別は `needsTrackerSticky`（トラッカー && 非終端 && sub-issue total>0） |

新種のマーカー付きコメントを追加するときも同じ形（マーカー定数 + 判定純粋関数 +
upsert/skip 計画を phases.js に、I/O を project.js/daemon に）にする。

## 機密のサニタイズ

worker のエラー理由・watchdog の失敗理由など**コマンド出力由来の文字列を GitHub に
surface するときは必ず `sanitizeForSurface`（`phases.js`）を通す**（トークン・API キー・
JWT・PEM・URL クエリを redact、600 字で切り詰め）。新しい「GitHub にエラーを書く」経路を
追加するとき、この関数を通さない実装は逸脱。生ログはローカル（daemon ログ / worktree）で
確認する運用。
