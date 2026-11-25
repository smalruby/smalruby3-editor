# autopilot — 開発規約（コード規約・不変条件）

`tools/autopilot/`（+ `bin/autopilot-worktree` / `bin/autopilot-push` /
`tools/autopilot/prompts/`）を変更するときの規約。**現行実装から導出した事実**であり、
ここから逸脱するコードはレビューで指摘する。

> **docs との役割分担**: 機能の全体像・運用手順は `docs/autopilot/README.md`、
> 状態遷移の正準表は `docs/autopilot/state-machine.md`、プロンプト⇔Runner の契約は
> `docs/autopilot/autonomous-contract.md`。**本 rules は「コードを書く/レビューするときの
> 規約と不変条件」に限定**し、docs の内容を繰り返さない。

## レイヤリング不変条件（最重要）

各モジュールの責務は固定されている。**判断ロジックと I/O を混ぜない**。

| モジュール | 責務 | 禁止事項 |
|---|---|---|
| `src/phases.js` | 判断ロジックの**純粋関数のみ**（フェーズ選択・ゲート解除・watchdog 判断・ラベル差分・sticky 計画・ディレクティブ解析・サニタイズ） | I/O・時計（`Date.now()`）・乱数を持ち込まない。時刻は ms epoch / ISO 文字列を**引数で受け** `toMs` で正規化する |
| `src/scheduler.js` | 並列の計画（重さの推定・上限と空きメモリ・CPU）と優先度の並べ替えの**純粋関数のみ** | /proc・`os.loadavg`・GitHub を読まない（daemon が読んで値を渡す）。時計を持ち込まない |
| `src/contract.js` | 結果ペイロード（`AUTOPILOT_RESULT_FILE`）の検証。`TOKENS` / `SIGNALS` / `validateResult` | スキーマを変えるときは `docs/autopilot/autonomous-contract.md` §2 と**対で更新** |
| `src/project.js` | GitHub（Projects v2 / Issue / PR / ラベル / sticky）への **gh CLI ラッパ**。GitHub I/O はここに集約 | 判断ロジックを書かない（純粋な選別・整形は phases.js へ） |
| `src/daemon.js` | 常駐 tick のオーケストレーション（poll → dispatch → `apply*` ステップ群 → face sync）と HTTP 制御 | 判定は phases.js の純粋関数を呼ぶ。直接 GitHub を叩かず project.js を使う |
| `src/runner.js` | worker（子 claude）の起動・キー送信・watchdog ループ。blocked は `blocked-handler.js` に任せる | 判断は `phases.js` の `evaluate` / `shouldResend` / `shouldSignalCheckpoint`（純粋）と `blocked.js` に委ねる。tmux / herdr のコマンドを直接書かない |
| `src/terminal.js` | 端末の backend（herdr / tmux）。`launch` / `snapshot` / `sendLine` / `sendKeys` / `killSession` / `listSessions` / `shutdown` を同じ形で持つ | 判断を書かない。新しい端末操作は両方の backend に足す |
| `src/blocked.js` | blocked の画面の判定・AI 判定の読み取り・人間の答えの確認・端末設定の解釈（**純粋関数**） | I/O・時計を持ち込まない |
| `src/blocked-handler.js` / `src/blocked-hub.js` / `src/blocked-panel.js` | 1 worker の blocked の扱い（答える・一時停止・待った時間）/ 止まっている worker の置き場と `/blocked` の HTTP / モニターの欄 | daemon・monitor への差分は呼び出しだけにする |
| `src/http-guard.js` | HTTP の受け付けの守り（Host / Origin の許可・合言葉の照合）の**純粋関数** | 合言葉の生成・ファイル書き出しを持ち込まない（daemon が行う）。守りは startHttp のルーティングの手前の 1 か所だけで呼ぶ |
| `src/settings.js` | worker 起動設定のロード・マージ・コマンド組み立て・run 資産スナップショット | — |
| `src/monitor.js` | Web モニタ（**自己完結 HTML**。外部 CDN / 外部リソース参照は devpod の egress allowlist で死ぬので不可） | — |
| `src/epic-summary.js` / `src/current-status.js` | EPIC ごとのまとめ・見込み・現在地の材料とテンプレートの描画の**純粋関数**。`renderEpicGroupsHtml` はモニタへ `fn.toString()` で埋め込むので**モジュールの外を参照しない** | I/O・`Date.now()` を持ち込まない（`now` を引数で受ける） |
| `src/current-status-job.js` | 現在地の job の I/O（worker の起動・状態ファイル・改善メモ）。daemon から呼ぶ割り込み型の job | 判断を書かない（`planCurrentStatusOutcome` を呼ぶ） |
| `src/usage.js` / `src/version.js` / `src/pw-check.js` | usage ファイル読取 / 稼働バージョン・更新検知 / headless UI 確認ヘルパー | — |
| `src/learnings.js` / `src/tasks.js` | 学び（M6/R1）・タスク（E1）の判断の**純粋関数** | phases.js と同じ（I/O・時計・乱数なし） |
| `src/learn-tasks.js` | 学び・タスクの I/O（`tmp/` の置き場・Issue に結びつかない worker・`/learnings*` `/tasks*`）。daemon からは tick と startHttp の 2 か所でだけ呼ぶ | 判断を書かない（learnings.js / tasks.js へ）。GitHub は project.js 経由 |

**新しい判断ロジックを追加する手順**: ① phases.js に純粋関数として書く → ② `test/` に
unit テストを付ける → ③ daemon/runner から呼ぶ。逆順（daemon に inline で判定を書く）は
逸脱。既存の `apply*` ステップ（`applyMergeProgression` / `applyClosedReconcile` /
`applyDodHandoffs` / `applyLabelHealing` / `applyAfterWaitLabels` / `applyPrProjection`）は
すべて「選別・計画 = phases.js 純粋関数、実行 = daemon + project.js」の形になっている。

## worker の端末と blocked の不変条件

- **autopilot が止まるときは worker を全部一緒に止める**（daemon の `exit` で `shutdownTerminal`。herdr は
  session ごと、tmux はその daemon が起こした worker だけ）。worker を daemon の外に残す実装にしない。
- **人間を待っているあいだは watchdog の時計（`tMax`・checkpoint）を進めない**（`activeElapsedMs`）。
- blocked に**自動で答えるのは「今回だけ」の選択肢**。「always allow」「switch to auto mode」を選ぶ規則・判定にしない。
  NG の規則（`NG_RULES`）は広めに取り、迷ったら人間を待つ側に倒す。
- 人間の答えとして送れるキーは `ALLOWED_KEYS` だけ（任意のキー列・制御文字を送らせない）。

## 依存規約

- **Node.js 標準モジュールのみ**（`fs` / `path` / `os` / `http` / `child_process` /
  `timers/promises` / `util`）。`package.json` に `dependencies` を**追加しない**
  （現在 dependencies なし・`private: true`・`license: MIT`）。
- 例外: `src/pw-check.js` の `require('playwright')` は monorepo root の `node_modules`
  から解決する（autopilot 自身はインストールしない）。
- CommonJS（`'use strict'` + `require` / `module.exports`）。ESM にしない。
- `module.exports` はファイル末尾に集約する（既存全ファイルの形）。
- JSDoc は日本語で「なぜ」を書く（既存スタイル）。定数にも由来 Issue 番号を残す。

## テスト規約

- **`node --test`**（`cd tools/autopilot && node --test`）。テストランナー・アサーション
  ライブラリを追加しない（`node:test` + `node:assert`）。
- テストは `tools/autopilot/test/*.test.js`。**純粋関数中心**に書く。
- I/O を持つ関数（daemon / project / runner / version）は **`deps` 引数の注入**で
  差し替えてテストする（例: `version.js` の `deps.execFileP`、daemon の各
  `apply*(items, cfg, state, log, deps = {})`）。実 GitHub / 実 tmux に触るテストを書かない。
- 状態・トリガー（`phaseForItem` / ゲート解除 / Status・AI Status の集合）を変えたら
  `test/state-machine.test.js` の網羅テストを必ず更新する
  （手順は `.claude/rules/autopilot/state-and-labels.md`）。

## worker 設定（settings.js）の規約

- 設定の基底は `DEFAULT_SETTINGS`（推奨構成: **実装・レビュー系 = opus、分類・対話系 =
  sonnet**）。マージ順（後勝ち）は
  `DEFAULT_SETTINGS ← tools/autopilot/settings.json（repo 共通・コミット可）←
  ~/.config/autopilot/settings.json（開発者ごと。env AUTOPILOT_SETTINGS で場所変更可）`。
- `phases` はフェーズ単位 shallow merge、配列（`addDirs` / `args` 等）は**置き換え**
  （`mergeSettings`）。この挙動を変えない。
- permission モードは **`auto`**。root では `bypassPermissions` が使えず（社内規定でも禁止）、
  `acceptEdits` は確認プロンプトで worker が停止した実績があるため。
  **`auto` のとき `--allowedTools` / `permissions.allow` を出力しない**
  （classifier が判定を握るため機能しない。`buildClaudeCommand` の `allowlistApplies` 分岐）。
- `effort` は `DEFAULT_SETTINGS` では **opt-in**（既定 null。指定すると `--effort` フラグに
  なり、未対応の Claude Code では起動が壊れるため既定では出さない）。
  ただし **repo `tools/autopilot/settings.json` が全フェーズに `model: "opus"` +
  明示 `effort` を設定して上書き**している（実装・分類系 = medium、understand/decompose/
  review/address-review/discuss = high、`default` catch-all = medium）。理由: ①`--effort` を
  渡さないと worker が**グローバル `~/.claude/settings.json` の `effortLevel`（環境により
  xhigh）を漏れ継承**し、小タスクで過剰にコストを消費していた ②triage/discuss は sonnet
  だと Large 誤判定 → 不要な decompose を誘発するため opus 必須（過去 feedback）。
  effort レベルを変えるときはこの JSON を編集する（`DEFAULT_SETTINGS` ではなく repo settings が
  真実）。`--effort` 非対応の Claude Code を使う開発者は `~/.config/autopilot/settings.json`
  で phase の effort を null に戻して無効化できる。
- env `AUTOPILOT_CLAUDE_CMD` は settings より**最優先**（固定コマンド起動）。
- 壊れた settings JSON は **warn してスキップ**し既定で動き続ける（無人運用優先。
  ロード失敗で daemon を落とさない）。

## 変更の反映は daemon 再起動

daemon はモジュールを**起動時にロード**し、さらに**プロンプト一式 + 解決済み settings を
tmpdir へスナップショット**する（`snapshotRunAssets`）。つまり `tools/autopilot/` の
コード・プロンプト・settings をいくら編集しても、**走行中の daemon には反映されない**。
変更を効かせるには daemon を再起動する（`POST /shutdown` → 再起動）。
「merge したのに挙動が変わらない」の第一容疑者はこれ。

## ライセンス

`tools/autopilot/**` と `tools/autopilot/prompts/**`、autopilot が使う Smalruby 独自のコマンド
（`bin/autopilot-worktree` / `bin/autopilot-push` / `bin/bot-token` / `bin/bot-git`）は、
リポジトリ全体の AGPL-3.0 ではなく **MIT ライセンス**（`tools/autopilot/LICENSE`。コマンドの先頭にも
`SPDX-License-Identifier: MIT` を書く）。これらに新規ファイル・コードを追加するときは
MIT のまま置けるか確認する（AGPL なコードのコピー持ち込み不可）。プロンプト /
`docs/autopilot/*.md` の末尾には License セクション（MIT 宣言）を踏襲する。
